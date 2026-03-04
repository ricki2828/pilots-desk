"""
Coaching Router
Endpoints for coaching framework configuration and post-call insights
"""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timedelta
import logging

from app.db.database import get_db
from app.db.models import (
    Agent, CallMetadata, SegmentScore, Nudge as NudgeModel,
    AgentDailyMetrics, PatternTracking, AgentProfile, CoachingReport,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/config")
async def get_coaching_config(req: Request):
    """
    Get coaching framework config for the desktop client.
    Returns categories, display config, and global rules.
    """
    coaching_engine = req.app.state.coaching_engine
    return coaching_engine.to_client_config()


@router.get("/agent/{agent_id}/profile")
async def get_agent_profile(agent_id: str, db: Session = Depends(get_db)):
    """Get an agent's coaching profile (tier, tenure, adjustments)"""
    profile = db.query(AgentProfile).filter(AgentProfile.agent_id == agent_id).first()
    agent = db.query(Agent).filter(Agent.id == agent_id).first()

    if not agent:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Agent not found")

    if not profile:
        # Auto-create profile with default tier
        profile = AgentProfile(
            agent_id=agent_id,
            tenure_start_date=agent.created_at,
            profile_tier="developing",
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)

    tenure_days = (datetime.utcnow() - profile.tenure_start_date).days if profile.tenure_start_date else 30

    return {
        "agent_id": agent_id,
        "agent_name": agent.name,
        "profile_tier": profile.profile_tier,
        "tenure_days": tenure_days,
        "tenure_start_date": profile.tenure_start_date.isoformat() if profile.tenure_start_date else None,
    }


@router.get("/agent/{agent_id}/patterns")
async def get_agent_patterns(agent_id: str, db: Session = Depends(get_db)):
    """Get recurring patterns/mistakes for an agent"""
    patterns = (
        db.query(PatternTracking)
        .filter(PatternTracking.agent_id == agent_id)
        .order_by(desc(PatternTracking.occurrence_count))
        .limit(10)
        .all()
    )

    return {
        "agent_id": agent_id,
        "patterns": [
            {
                "id": str(p.id),
                "error_type": p.error_type,
                "error_context": p.error_context,
                "occurrence_count": p.occurrence_count,
                "first_seen": p.first_seen.isoformat() if p.first_seen else None,
                "last_seen": p.last_seen.isoformat() if p.last_seen else None,
            }
            for p in patterns
        ],
    }


@router.post("/agent/{agent_id}/patterns/record")
async def record_pattern(agent_id: str, error_type: str, error_context: str = "", db: Session = Depends(get_db)):
    """Record an error occurrence for pattern tracking"""
    existing = (
        db.query(PatternTracking)
        .filter(
            PatternTracking.agent_id == agent_id,
            PatternTracking.error_type == error_type,
            PatternTracking.error_context == error_context,
        )
        .first()
    )

    if existing:
        existing.occurrence_count += 1
        existing.last_seen = datetime.utcnow()
    else:
        existing = PatternTracking(
            agent_id=agent_id,
            error_type=error_type,
            error_context=error_context,
            occurrence_count=1,
            first_seen=datetime.utcnow(),
            last_seen=datetime.utcnow(),
        )
        db.add(existing)

    db.commit()

    return {
        "agent_id": agent_id,
        "error_type": error_type,
        "occurrence_count": existing.occurrence_count,
    }


@router.get("/agent/{agent_id}/insights")
async def get_post_call_insights(
    agent_id: str,
    call_id: str = None,
    db: Session = Depends(get_db),
    req: Request = None,
):
    """
    Get post-call coaching insights for an agent.
    Pulls from coaching_reports table (post-call analysis).
    If call_id provided, returns insights for that specific call.
    Otherwise returns latest call insights.
    """
    import json as _json

    # Get coaching report
    query = db.query(CoachingReport).filter(CoachingReport.agent_id == agent_id)
    if call_id:
        report = query.filter(CoachingReport.call_id == call_id).first()
    else:
        report = query.order_by(desc(CoachingReport.created_at)).first()

    if not report:
        return {"agent_id": agent_id, "insights": None, "message": "No coaching reports found"}

    # Get the call metadata
    call = db.query(CallMetadata).filter(CallMetadata.id == report.call_id).first()

    # Parse JSON fields
    def _parse(val):
        if val is None:
            return []
        if isinstance(val, (list, dict)):
            return val
        try:
            return _json.loads(val)
        except (ValueError, TypeError):
            return []

    strengths = _parse(report.strengths)
    improvement_areas = _parse(report.improvement_areas)

    # Get trend from recent reports
    recent_reports = (
        db.query(CoachingReport)
        .filter(CoachingReport.agent_id == agent_id)
        .order_by(desc(CoachingReport.created_at))
        .limit(5)
        .all()
    )
    recent_scores = [r.overall_score for r in recent_reports if r.overall_score is not None]

    return {
        "agent_id": agent_id,
        "call_id": report.call_id,
        "call_duration_seconds": call.duration_seconds if call else None,
        "disposition": call.disposition if call else None,
        "metrics": {
            "overall_score": report.overall_score,
            "rating": report.rating,
            "compliance_pass": report.compliance_pass,
            "talk_listen_ratio": report.talk_listen_ratio,
        },
        "trend": report.trend_direction or "stable",
        "recent_scores": [round(s, 3) for s in recent_scores],
        "strengths": strengths,
        "improvement_areas": improvement_areas,
        "coaching_summary": report.coaching_summary,
    }
