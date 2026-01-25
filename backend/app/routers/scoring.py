"""
Scoring Router
Endpoints for real-time adherence scoring and compliance checking
"""

from fastapi import APIRouter, HTTPException, Request
from typing import List
import time
import logging

from app.models.score import ScoreRequest, ScoreResponse, AdherenceScore, ComplianceCheck, Nudge
from app.services.adherence import AdherenceScorer
from app.services.compliance import ComplianceDetector
from app.services.pii_redactor import PIIRedactor

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize services (will be attached to app state in main.py)
pii_redactor = PIIRedactor()


@router.post("/score", response_model=ScoreResponse)
async def score_segment(request: ScoreRequest, req: Request):
    """
    Score a transcript segment for adherence and compliance

    This is the main endpoint called by the desktop app after each script node.
    """
    start_time = time.time()

    logger.info(f"Scoring request for segment {request.segment_id}, node {request.script_node_id}")

    # Redact PII from transcript before processing
    redacted_transcript, pii_counts = pii_redactor.redact(request.actual_transcript)
    if pii_counts:
        logger.warning(f"PII redacted from transcript: {pii_counts}")

    try:
        # Get services from app state
        llm_provider = req.app.state.llm_provider
        adherence_scorer = AdherenceScorer(llm_provider)
        compliance_detector = ComplianceDetector(llm_provider)

        # Score adherence
        adherence, adherence_nudges = await adherence_scorer.score_segment(
            expected_text=request.expected_text,
            actual_transcript=redacted_transcript,
            node_id=request.script_node_id,
            client_id=request.client_id
        )

        # Check compliance (if this is a compliance node)
        # For now, check all nodes - later can filter by node type
        compliance, compliance_nudge = await compliance_detector.check_compliance(
            node_id=request.script_node_id,
            expected_text=request.expected_text,
            actual_transcript=redacted_transcript,
            compliance_type="general"
        )

        # Collect all nudges
        all_nudges = adherence_nudges.copy()
        if compliance_nudge:
            all_nudges.append(compliance_nudge)

        processing_time = (time.time() - start_time) * 1000

        response = ScoreResponse(
            segment_id=request.segment_id,
            adherence=adherence,
            compliance=compliance,
            nudges=all_nudges,
            processing_time_ms=processing_time,
            model_used=llm_provider.default_model
        )

        logger.info(f"Scored in {processing_time:.0f}ms: adherence={adherence.score:.2f}, compliant={compliance.is_compliant}")

        return response

    except Exception as e:
        logger.error(f"Scoring failed: {e}")
        raise HTTPException(status_code=500, detail=f"Scoring failed: {str(e)}")


@router.post("/score/batch", response_model=List[ScoreResponse])
async def score_batch(requests: List[ScoreRequest], req: Request):
    """Score multiple segments in batch (for post-call analysis)"""
    results = []

    for request in requests:
        try:
            result = await score_segment(request, req)
            results.append(result)
        except Exception as e:
            logger.error(f"Failed to score segment {request.segment_id}: {e}")
            # Continue with other segments

    return results


@router.get("/health")
async def health_check():
    """Health check for scoring service"""
    return {
        "status": "healthy",
        "service": "scoring",
        "pii_redactor": "ready"
    }
