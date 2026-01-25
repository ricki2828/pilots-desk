"""
Transcript Search Router
Full-text search across call transcripts with PII redaction
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func, desc
from datetime import datetime, date
from typing import List, Optional
from pydantic import BaseModel
import logging

from app.db.database import get_db
from app.db.models import SegmentScore, CallMetadata, Agent
from app.services.pii_redactor import PIIRedactor

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize PII redactor
pii_redactor = PIIRedactor()


class SearchRequest(BaseModel):
    """Search request parameters"""
    query: str
    client_id: str
    agent_id: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    disposition: Optional[str] = None
    min_adherence: Optional[float] = None
    max_adherence: Optional[float] = None
    compliance_only: Optional[bool] = None
    limit: int = 50


class SearchResult(BaseModel):
    """Single search result"""
    segment_id: str
    call_id: str
    node_id: str
    agent_name: str
    transcript_snippet: str  # PII-redacted
    adherence_score: float
    compliance_ok: bool
    call_started_at: str
    call_disposition: Optional[str]
    matched_keywords: List[str]


class SearchResponse(BaseModel):
    """Search response with results and metadata"""
    results: List[SearchResult]
    total_results: int
    query: str
    search_time_ms: float


@router.post("/transcripts", response_model=SearchResponse)
async def search_transcripts(
    request: SearchRequest,
    db: Session = Depends(get_db)
):
    """
    Search call transcripts with full-text keyword matching

    Features:
    - Keyword search across all transcript segments
    - Filter by agent, date range, disposition
    - Filter by adherence score range
    - Filter by compliance status
    - PII redaction in results
    - Result highlighting and snippets
    """
    start_time = datetime.utcnow()

    # Validate query
    if not request.query or len(request.query.strip()) < 2:
        raise HTTPException(
            status_code=400,
            detail="Query must be at least 2 characters"
        )

    # Build base query
    query = db.query(
        SegmentScore,
        CallMetadata,
        Agent
    ).join(
        CallMetadata, SegmentScore.call_id == CallMetadata.id
    ).join(
        Agent, CallMetadata.agent_id == Agent.id
    ).filter(
        Agent.client_id == request.client_id
    )

    # Filter by search keywords (case-insensitive LIKE)
    search_terms = request.query.lower().split()
    search_conditions = []
    for term in search_terms:
        search_conditions.append(
            func.lower(SegmentScore.actual_transcript).contains(term)
        )

    # Require all search terms to be present (AND logic)
    if search_conditions:
        query = query.filter(and_(*search_conditions))

    # Apply optional filters
    if request.agent_id:
        query = query.filter(CallMetadata.agent_id == request.agent_id)

    if request.start_date:
        query = query.filter(func.cast(CallMetadata.started_at, Date) >= request.start_date)

    if request.end_date:
        query = query.filter(func.cast(CallMetadata.started_at, Date) <= request.end_date)

    if request.disposition:
        query = query.filter(CallMetadata.disposition == request.disposition)

    if request.min_adherence is not None:
        query = query.filter(SegmentScore.adherence_score >= request.min_adherence)

    if request.max_adherence is not None:
        query = query.filter(SegmentScore.adherence_score <= request.max_adherence)

    if request.compliance_only is not None:
        query = query.filter(SegmentScore.compliance_ok == request.compliance_only)

    # Order by relevance (most recent first, then by adherence)
    query = query.order_by(
        desc(CallMetadata.started_at),
        desc(SegmentScore.adherence_score)
    )

    # Get total count before limiting
    total_results = query.count()

    # Limit results
    query = query.limit(request.limit)

    # Execute query
    results = query.all()

    # Format results with PII redaction
    search_results = []
    for segment, call, agent in results:
        # Redact PII from transcript
        redacted_transcript, _ = pii_redactor.redact(segment.actual_transcript or "")

        # Create snippet (first 200 chars with ellipsis)
        snippet = redacted_transcript[:200]
        if len(redacted_transcript) > 200:
            snippet += "..."

        # Identify which keywords matched
        matched_keywords = [
            term for term in search_terms
            if term in redacted_transcript.lower()
        ]

        search_results.append(SearchResult(
            segment_id=str(segment.id),
            call_id=str(call.id),
            node_id=segment.node_id,
            agent_name=agent.name,
            transcript_snippet=snippet,
            adherence_score=segment.adherence_score,
            compliance_ok=segment.compliance_ok,
            call_started_at=call.started_at.isoformat(),
            call_disposition=call.disposition,
            matched_keywords=matched_keywords
        ))

    # Calculate search time
    end_time = datetime.utcnow()
    search_time_ms = (end_time - start_time).total_seconds() * 1000

    logger.info(
        f"Search completed: query='{request.query}', results={len(search_results)}/{total_results}, "
        f"time={search_time_ms:.2f}ms"
    )

    return SearchResponse(
        results=search_results,
        total_results=total_results,
        query=request.query,
        search_time_ms=round(search_time_ms, 2)
    )


@router.get("/keywords")
async def get_common_keywords(
    client_id: str,
    days: int = 30,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """
    Get most common keywords/phrases from recent transcripts

    Useful for search suggestions and trending topics
    """
    # This is a simplified version - proper implementation would use
    # text analysis (TF-IDF, word frequency, etc.)

    # For now, return some common Sky TV phrases as examples
    # In production, this would analyze actual transcripts
    common_phrases = [
        "sky sport",
        "sky movies",
        "soho",
        "package",
        "pricing",
        "installation",
        "contract",
        "promotion",
        "discount",
        "channels",
        "streaming",
        "set top box",
        "decoder",
        "rugby",
        "cricket",
        "not interested",
        "call back",
        "already have",
        "too expensive",
        "think about it"
    ]

    return {
        "client_id": client_id,
        "keywords": common_phrases[:limit],
        "period_days": days
    }
