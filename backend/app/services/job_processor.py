"""
Job Processor Service
Background asyncio processor for transcription and analysis jobs
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.db.models import (
    AnalysisJob, CallTranscript, CoachingReport, CallMetadata,
    AgentDailyMetrics, ScriptVersion,
)
from app.services.transcription import TranscriptionService
from app.services.post_call_analyzer import PostCallAnalyzer
from app.services.pii_redactor import PIIRedactor

logger = logging.getLogger(__name__)


class JobProcessor:
    """Background processor for transcription and analysis jobs."""

    def __init__(
        self,
        transcription_service: TranscriptionService,
        analyzer: PostCallAnalyzer,
        pii_redactor: PIIRedactor,
        ws_manager=None,
    ):
        self.transcription = transcription_service
        self.analyzer = analyzer
        self.pii_redactor = pii_redactor
        self.ws_manager = ws_manager
        self.running = False
        self.max_concurrent = 2
        self.poll_interval = 5  # seconds
        self.stale_timeout = 600  # 10 minutes
        self.max_retries = 3
        self._active_count = 0

    async def start(self):
        """Start the processing loop — called from FastAPI lifespan."""
        self.running = True
        logger.info("JobProcessor started")
        asyncio.create_task(self._process_loop())

    async def stop(self):
        """Stop the processing loop gracefully."""
        self.running = False
        logger.info("JobProcessor stopping")

    async def _process_loop(self):
        """Main processing loop."""
        while self.running:
            try:
                # Recover stale jobs first
                await self._recover_stale_jobs()

                # Pick up pending jobs if we have capacity
                if self._active_count < self.max_concurrent:
                    slots = self.max_concurrent - self._active_count
                    jobs = self._get_pending_jobs(limit=slots)
                    for job_id in jobs:
                        self._active_count += 1
                        asyncio.create_task(self._process_job_wrapper(job_id))

            except Exception as e:
                logger.error(f"Error in process loop: {e}")

            await asyncio.sleep(self.poll_interval)

    async def _process_job_wrapper(self, job_id: int):
        """Wrapper that decrements active count when done."""
        try:
            await self._process_job(job_id)
        finally:
            self._active_count -= 1

    async def _process_job(self, job_id: int):
        """Process a single job: transcribe -> PII-redact -> analyze -> store."""
        db = SessionLocal()
        try:
            job = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
            if not job:
                logger.error(f"Job {job_id} not found")
                return

            call = db.query(CallMetadata).filter(CallMetadata.id == job.call_id).first()
            if not call:
                self._fail_job(db, job, "Call metadata not found")
                return

            logger.info(f"Processing job {job_id} for call {job.call_id}")

            # Check if transcript already exists (transcript-only submission)
            existing_transcript = db.query(CallTranscript).filter(CallTranscript.call_id == job.call_id).first()

            if existing_transcript:
                # Transcript already stored (desktop app submitted transcript directly)
                redacted_transcript = existing_transcript.full_transcript
                speaker_segments = json.loads(existing_transcript.speaker_segments) if existing_transcript.speaker_segments else []
                job.transcription_completed_at = datetime.utcnow()
                db.commit()
                logger.info(f"Job {job_id}: Using pre-existing transcript ({existing_transcript.word_count} words)")
            elif job.audio_file_path and job.audio_file_path != "transcript_only":
                # --- STEP 1: Transcription ---
                job.status = "transcribing"
                job.transcription_started_at = datetime.utcnow()
                call.analysis_status = "transcribing"
                db.commit()

                try:
                    transcription_result = await self.transcription.transcribe_file(job.audio_file_path)
                except Exception as e:
                    self._handle_error(db, job, call, f"Transcription failed: {e}")
                    return

                job.transcription_completed_at = datetime.utcnow()
                job.audio_duration = transcription_result.get("duration", 0.0)

                # Update call duration if not already set
                if not call.duration_seconds and transcription_result.get("duration"):
                    call.duration_seconds = int(transcription_result["duration"])
                if not call.audio_duration_seconds:
                    call.audio_duration_seconds = transcription_result.get("duration", 0.0)

                db.commit()

                # --- STEP 2: PII Redaction ---
                raw_transcript = transcription_result.get("transcript", "")
                redacted_transcript, redaction_counts = self.pii_redactor.redact(raw_transcript)

                # Also redact speaker segment texts
                speaker_segments = transcription_result.get("speaker_segments", [])
                for seg in speaker_segments:
                    seg["text"], _ = self.pii_redactor.redact(seg.get("text", ""))

                # --- STEP 3: Store Transcript ---
                transcript_record = CallTranscript(
                    call_id=job.call_id,
                    full_transcript=redacted_transcript,
                    speaker_segments=json.dumps(speaker_segments),
                    word_count=transcription_result.get("word_count", 0),
                    confidence=transcription_result.get("confidence", 0.0),
                    provider="deepgram",
                )
                db.add(transcript_record)
                db.commit()
            else:
                # No audio and no transcript — fail the job
                self._fail_job(db, job, "No audio file or transcript available")
                return

            # --- STEP 4: Analysis ---
            job.status = "analyzing"
            job.analysis_started_at = datetime.utcnow()
            call.analysis_status = "analyzing"
            db.commit()

            # Get script schema for context
            script_schema = {}
            if call.script_version_id:
                sv = db.query(ScriptVersion).filter(ScriptVersion.id == call.script_version_id).first()
                if sv and sv.schema_json:
                    script_schema = sv.schema_json if isinstance(sv.schema_json, dict) else json.loads(sv.schema_json)

            try:
                analysis_result = await self.analyzer.analyze_call(
                    transcript=redacted_transcript,
                    speaker_segments=speaker_segments,
                    script_schema=script_schema,
                )
            except Exception as e:
                self._handle_error(db, job, call, f"Analysis failed: {e}")
                return

            job.analysis_completed_at = datetime.utcnow()

            # Extract token metadata
            meta = analysis_result.pop("_meta", {})
            job.model_used = meta.get("model_used", "unknown")
            job.input_tokens = meta.get("input_tokens", 0)
            job.output_tokens = meta.get("output_tokens", 0)

            # Estimate cost (Sonnet 4.5 pricing: $3/1M input, $15/1M output)
            input_cost = (job.input_tokens / 1_000_000) * 3.0
            output_cost = (job.output_tokens / 1_000_000) * 15.0
            job.cost = input_cost + output_cost

            # --- STEP 5: Store Coaching Report ---
            report = CoachingReport(
                call_id=job.call_id,
                agent_id=call.agent_id,
                overall_score=analysis_result.get("overall_score", 0.5),
                rating=analysis_result.get("rating", "acceptable"),
                compliance_pass=analysis_result.get("compliance_pass", True),
                compliance_issues=json.dumps(analysis_result.get("compliance_issues", [])),
                strengths=json.dumps(analysis_result.get("strengths", [])),
                improvement_areas=json.dumps(analysis_result.get("improvement_areas", [])),
                node_breakdown=json.dumps(analysis_result.get("node_breakdown", {})),
                talk_listen_ratio=analysis_result.get("talk_listen_ratio"),
                objection_handling=json.dumps(analysis_result.get("objection_handling", {})),
                close_attempts=json.dumps(analysis_result.get("close_attempts", {})),
                key_moments=json.dumps(analysis_result.get("key_moments", [])),
                coaching_summary=analysis_result.get("coaching_summary", ""),
                model_used=job.model_used,
                input_tokens=job.input_tokens,
                output_tokens=job.output_tokens,
            )
            db.add(report)

            # --- STEP 6: Update daily metrics ---
            self._update_daily_metrics(
                db, call.agent_id, call.client_id,
                analysis_result.get("overall_score", 0.5),
                analysis_result.get("compliance_pass", True),
            )

            # --- STEP 7: Mark complete ---
            job.status = "completed"
            call.analysis_status = "completed"
            call.adherence_score = analysis_result.get("overall_score")
            call.compliance_ok = analysis_result.get("compliance_pass", True)
            db.commit()

            logger.info(
                f"Job {job_id} completed: score={analysis_result.get('overall_score', 0):.2f}, "
                f"rating={analysis_result.get('rating')}, cost=${job.cost:.4f}"
            )

            # --- STEP 8: WebSocket notification ---
            if self.ws_manager:
                try:
                    await self.ws_manager.send_score(call.agent_id, {
                        "type": "analysis_complete",
                        "call_id": job.call_id,
                        "overall_score": analysis_result.get("overall_score"),
                        "rating": analysis_result.get("rating"),
                        "coaching_summary": analysis_result.get("coaching_summary", ""),
                    })
                except Exception as e:
                    logger.warning(f"Failed to send WS notification for job {job_id}: {e}")

        except Exception as e:
            logger.error(f"Unexpected error processing job {job_id}: {e}")
            try:
                job = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
                if job:
                    call = db.query(CallMetadata).filter(CallMetadata.id == job.call_id).first()
                    self._handle_error(db, job, call, f"Unexpected error: {e}")
            except Exception:
                pass
        finally:
            db.close()

    def _handle_error(self, db: Session, job: AnalysisJob, call: Optional[CallMetadata], error_msg: str):
        """Handle job error with retry logic."""
        job.retry_count += 1
        job.error_message = error_msg
        job.updated_at = datetime.utcnow()

        if job.retry_count >= self.max_retries:
            job.status = "failed"
            if call:
                call.analysis_status = "failed"
            logger.error(f"Job {job.id} failed permanently after {job.retry_count} retries: {error_msg}")
        else:
            job.status = "pending"  # Reset to pending for retry
            if call:
                call.analysis_status = "pending"
            logger.warning(f"Job {job.id} error (retry {job.retry_count}/{self.max_retries}): {error_msg}")

        db.commit()

    def _fail_job(self, db: Session, job: AnalysisJob, error_msg: str):
        """Immediately fail a job without retry."""
        job.status = "failed"
        job.error_message = error_msg
        job.updated_at = datetime.utcnow()
        db.commit()
        logger.error(f"Job {job.id} failed: {error_msg}")

    def _get_pending_jobs(self, limit: int = 2) -> list:
        """Get pending job IDs from the database."""
        db = SessionLocal()
        try:
            jobs = (
                db.query(AnalysisJob.id)
                .filter(AnalysisJob.status == "pending")
                .order_by(AnalysisJob.created_at)
                .limit(limit)
                .all()
            )
            return [j.id for j in jobs]
        finally:
            db.close()

    async def _recover_stale_jobs(self):
        """Reset jobs stuck in transcribing/analyzing state for too long."""
        db = SessionLocal()
        try:
            cutoff = datetime.utcnow() - timedelta(seconds=self.stale_timeout)
            stale_jobs = (
                db.query(AnalysisJob)
                .filter(
                    AnalysisJob.status.in_(["transcribing", "analyzing"]),
                    AnalysisJob.updated_at < cutoff,
                )
                .all()
            )
            for job in stale_jobs:
                logger.warning(f"Recovering stale job {job.id} (status={job.status})")
                job.status = "pending"
                job.retry_count += 1
                job.error_message = f"Recovered from stale {job.status} state"
                job.updated_at = datetime.utcnow()
                if job.retry_count >= self.max_retries:
                    job.status = "failed"
                    job.error_message = f"Failed after recovery: exceeded max retries"
                    # Update call status too
                    call = db.query(CallMetadata).filter(CallMetadata.id == job.call_id).first()
                    if call:
                        call.analysis_status = "failed"
            if stale_jobs:
                db.commit()
                logger.info(f"Recovered {len(stale_jobs)} stale jobs")
        finally:
            db.close()

    def _update_daily_metrics(
        self, db: Session, agent_id: str, client_id: str,
        score: float, compliance_pass: bool,
    ):
        """Update or create AgentDailyMetrics for today."""
        from datetime import date
        today = date.today()

        metrics = (
            db.query(AgentDailyMetrics)
            .filter(
                AgentDailyMetrics.agent_id == agent_id,
                AgentDailyMetrics.date == today,
                AgentDailyMetrics.client_id == client_id,
            )
            .first()
        )

        if metrics:
            # Recalculate running average
            total = metrics.calls_total or 0
            current_avg = metrics.avg_adherence_score or 0.0
            new_avg = ((current_avg * total) + score) / (total + 1)
            metrics.avg_adherence_score = new_avg
            metrics.calls_total = total + 1
            if not compliance_pass:
                metrics.compliance_violations = (metrics.compliance_violations or 0) + 1
        else:
            from app.db.models import gen_uuid
            metrics = AgentDailyMetrics(
                id=gen_uuid(),
                agent_id=agent_id,
                date=today,
                client_id=client_id,
                calls_total=1,
                avg_adherence_score=score,
                compliance_violations=0 if compliance_pass else 1,
            )
            db.add(metrics)
