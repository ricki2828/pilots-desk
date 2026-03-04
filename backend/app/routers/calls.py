"""
Calls Router
Call lifecycle endpoints: end call, analysis status, reports, transcripts
"""

import os
import logging
from datetime import datetime
from typing import Optional, List

import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.db.database import get_db
from app.db.models import (
    CallMetadata, AnalysisJob, CoachingReport, CallTranscript, Agent,
)

logger = logging.getLogger(__name__)
router = APIRouter()

AUDIO_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "audio")
ALLOWED_EXTENSIONS = {"wav", "mp3", "ogg", "webm", "m4a"}


# ---- Response models ----

class CallEndResponse(BaseModel):
    call_id: str
    analysis_job_id: int
    status: str = "pending"


class AnalysisStatusResponse(BaseModel):
    call_id: str
    status: str
    progress_pct: int
    started_at: Optional[str] = None
    estimated_completion: Optional[str] = None


class TranscriptResponse(BaseModel):
    call_id: str
    full_transcript: str
    speaker_segments: Optional[str] = None
    word_count: int
    confidence: float
    provider: str
    created_at: str


class ReportResponse(BaseModel):
    call_id: str
    agent_id: str
    overall_score: float
    rating: str
    compliance_pass: bool
    compliance_issues: Optional[str] = None
    strengths: Optional[str] = None
    improvement_areas: Optional[str] = None
    node_breakdown: Optional[str] = None
    talk_listen_ratio: Optional[float] = None
    objection_handling: Optional[str] = None
    close_attempts: Optional[str] = None
    key_moments: Optional[str] = None
    coaching_summary: Optional[str] = None
    trend_direction: Optional[str] = None
    model_used: Optional[str] = None
    input_tokens: int = 0
    output_tokens: int = 0
    created_at: str


class RecentCallItem(BaseModel):
    call_id: str
    agent_id: str
    agent_name: str
    started_at: str
    duration_seconds: Optional[int] = None
    disposition: Optional[str] = None
    analysis_status: Optional[str] = None
    overall_score: Optional[float] = None


class RecentCallsResponse(BaseModel):
    calls: List[RecentCallItem]
    total: int
    limit: int
    offset: int


# ---- Endpoints ----

@router.post("/{call_id}/end", response_model=CallEndResponse, status_code=201)
async def end_call(
    call_id: str,
    audio: Optional[UploadFile] = File(default=None),
    agent_id: str = Form(...),
    client_id: str = Form(default="SKY_TV_NZ"),
    disposition: str = Form(default=None),
    duration_seconds: int = Form(default=None),
    transcript: str = Form(default=None),
    call_duration_ms: int = Form(default=None),
    db: Session = Depends(get_db),
):
    """
    End a call and submit for post-call analysis.
    Accepts multipart form: audio file (optional) + metadata fields.
    If audio file provided, queues transcription + analysis.
    If only transcript provided, stores transcript and queues analysis only.
    """
    audio_path = None

    # Handle audio file if provided
    if audio and audio.filename:
        ext = audio.filename.rsplit(".", 1)[-1].lower() if "." in audio.filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported audio format: .{ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
            )

        os.makedirs(AUDIO_DIR, exist_ok=True)
        audio_filename = f"{call_id}.{ext}"
        audio_path = os.path.join(AUDIO_DIR, audio_filename)

        async with aiofiles.open(audio_path, "wb") as f:
            content = await audio.read()
            await f.write(content)

        logger.info(f"Saved audio for call {call_id}: {audio_path} ({len(content)} bytes)")

    # Calculate duration from ms if not provided directly
    if not duration_seconds and call_duration_ms:
        duration_seconds = call_duration_ms // 1000

    # Create or update CallMetadata
    call = db.query(CallMetadata).filter(CallMetadata.id == call_id).first()
    if call:
        if audio_path:
            call.audio_file_path = audio_path
        call.analysis_status = "pending"
        if disposition:
            call.disposition = disposition
        if duration_seconds:
            call.duration_seconds = duration_seconds
        if not call.ended_at:
            call.ended_at = datetime.utcnow()
    else:
        call = CallMetadata(
            id=call_id,
            agent_id=agent_id,
            client_id=client_id,
            started_at=datetime.utcnow(),
            ended_at=datetime.utcnow(),
            duration_seconds=duration_seconds,
            disposition=disposition,
            audio_file_path=audio_path,
            analysis_status="pending",
        )
        db.add(call)

    db.flush()

    # If transcript provided but no audio, store transcript directly
    if transcript and not audio_path:
        from app.db.models import CallTranscript
        existing_transcript = db.query(CallTranscript).filter(CallTranscript.call_id == call_id).first()
        if not existing_transcript:
            from app.services.pii_redactor import PIIRedactor
            redactor = PIIRedactor()
            redacted, _ = redactor.redact(transcript)
            transcript_record = CallTranscript(
                call_id=call_id,
                full_transcript=redacted,
                speaker_segments="[]",
                word_count=len(redacted.split()),
                confidence=0.8,
                provider="desktop_whisper",
            )
            db.add(transcript_record)

    # Create AnalysisJob (audio path may be None for transcript-only)
    job = AnalysisJob(
        call_id=call_id,
        status="pending",
        audio_file_path=audio_path or "transcript_only",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    logger.info(f"Created analysis job {job.id} for call {call_id} (audio={'yes' if audio_path else 'transcript_only'})")

    return CallEndResponse(
        call_id=call_id,
        analysis_job_id=job.id,
        status="pending",
    )


@router.get("/{call_id}/status", response_model=AnalysisStatusResponse)
async def get_analysis_status(call_id: str, db: Session = Depends(get_db)):
    """Poll analysis progress for a call."""
    job = (
        db.query(AnalysisJob)
        .filter(AnalysisJob.call_id == call_id)
        .order_by(desc(AnalysisJob.created_at))
        .first()
    )

    if not job:
        raise HTTPException(status_code=404, detail="No analysis job found for this call")

    progress_map = {
        "pending": 0,
        "transcribing": 30,
        "analyzing": 70,
        "completed": 100,
        "failed": 0,
    }

    started_at = None
    if job.transcription_started_at:
        started_at = job.transcription_started_at.isoformat()

    return AnalysisStatusResponse(
        call_id=call_id,
        status=job.status,
        progress_pct=progress_map.get(job.status, 0),
        started_at=started_at,
    )


@router.get("/{call_id}/report", response_model=ReportResponse)
async def get_report(call_id: str, db: Session = Depends(get_db)):
    """Get the coaching report for a call."""
    report = db.query(CoachingReport).filter(CoachingReport.call_id == call_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="No coaching report found for this call")

    return ReportResponse(
        call_id=report.call_id,
        agent_id=report.agent_id,
        overall_score=report.overall_score,
        rating=report.rating,
        compliance_pass=report.compliance_pass,
        compliance_issues=report.compliance_issues,
        strengths=report.strengths,
        improvement_areas=report.improvement_areas,
        node_breakdown=report.node_breakdown,
        talk_listen_ratio=report.talk_listen_ratio,
        objection_handling=report.objection_handling,
        close_attempts=report.close_attempts,
        key_moments=report.key_moments,
        coaching_summary=report.coaching_summary,
        trend_direction=report.trend_direction,
        model_used=report.model_used,
        input_tokens=report.input_tokens or 0,
        output_tokens=report.output_tokens or 0,
        created_at=report.created_at.isoformat() if report.created_at else "",
    )


@router.get("/{call_id}/transcript", response_model=TranscriptResponse)
async def get_transcript(call_id: str, db: Session = Depends(get_db)):
    """Get the PII-redacted transcript for a call."""
    transcript = db.query(CallTranscript).filter(CallTranscript.call_id == call_id).first()
    if not transcript:
        raise HTTPException(status_code=404, detail="No transcript found for this call")

    return TranscriptResponse(
        call_id=transcript.call_id,
        full_transcript=transcript.full_transcript,
        speaker_segments=transcript.speaker_segments,
        word_count=transcript.word_count or 0,
        confidence=transcript.confidence or 0.0,
        provider=transcript.provider or "deepgram",
        created_at=transcript.created_at.isoformat() if transcript.created_at else "",
    )


@router.get("/recent", response_model=RecentCallsResponse)
async def get_recent_calls(
    agent_id: Optional[str] = Query(default=None),
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0),
    db: Session = Depends(get_db),
):
    """Get recent calls with optional agent filter."""
    query = (
        db.query(CallMetadata, Agent)
        .join(Agent, CallMetadata.agent_id == Agent.id)
        .order_by(desc(CallMetadata.started_at))
    )

    if agent_id:
        query = query.filter(CallMetadata.agent_id == agent_id)

    total = query.count()
    rows = query.offset(offset).limit(limit).all()

    calls = []
    for call, agent in rows:
        # Check if there's a coaching report for this call
        report = db.query(CoachingReport).filter(CoachingReport.call_id == call.id).first()

        calls.append(RecentCallItem(
            call_id=str(call.id),
            agent_id=str(call.agent_id),
            agent_name=agent.name,
            started_at=call.started_at.isoformat() if call.started_at else "",
            duration_seconds=call.duration_seconds,
            disposition=call.disposition,
            analysis_status=call.analysis_status,
            overall_score=report.overall_score if report else None,
        ))

    return RecentCallsResponse(
        calls=calls,
        total=total,
        limit=limit,
        offset=offset,
    )
