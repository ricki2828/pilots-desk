"""
Reports Router
Coaching report endpoints: agent reports, history, team summaries
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.db.database import get_db
from app.db.models import CoachingReport, Agent, CallMetadata

logger = logging.getLogger(__name__)
router = APIRouter()


# ---- Response models ----

class ReportSummary(BaseModel):
    call_id: str
    overall_score: float
    rating: str
    compliance_pass: bool
    created_at: str


class AgentHistoryResponse(BaseModel):
    agent_id: str
    agent_name: str
    reports: List[ReportSummary]
    aggregate: dict


class AgentTeamEntry(BaseModel):
    agent_id: str
    agent_name: str
    call_count: int
    avg_score: float
    compliance_rate: float
    trend: str


class TeamSummaryResponse(BaseModel):
    client_id: str
    period_days: int
    agents: List[AgentTeamEntry]
    team_aggregate: dict


# ---- Endpoints ----

@router.get("/agent/{agent_id}/latest")
async def get_latest_report(agent_id: str, db: Session = Depends(get_db)):
    """Get the most recent coaching report for an agent."""
    report = (
        db.query(CoachingReport)
        .filter(CoachingReport.agent_id == agent_id)
        .order_by(desc(CoachingReport.created_at))
        .first()
    )

    if not report:
        raise HTTPException(status_code=404, detail="No coaching reports found for this agent")

    return _report_to_dict(report)


@router.get("/agent/{agent_id}/history", response_model=AgentHistoryResponse)
async def get_agent_history(
    agent_id: str,
    days: int = Query(default=30, le=365),
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
):
    """Get coaching report history with trend data for an agent."""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    cutoff = datetime.utcnow() - timedelta(days=days)

    reports = (
        db.query(CoachingReport)
        .filter(
            CoachingReport.agent_id == agent_id,
            CoachingReport.created_at >= cutoff,
        )
        .order_by(desc(CoachingReport.created_at))
        .limit(limit)
        .all()
    )

    report_summaries = [
        ReportSummary(
            call_id=r.call_id,
            overall_score=r.overall_score,
            rating=r.rating,
            compliance_pass=r.compliance_pass,
            created_at=r.created_at.isoformat() if r.created_at else "",
        )
        for r in reports
    ]

    # Compute aggregate stats
    scores = [r.overall_score for r in reports if r.overall_score is not None]
    compliance_passes = [r.compliance_pass for r in reports]

    avg_score = sum(scores) / len(scores) if scores else 0.0
    compliance_rate = sum(1 for c in compliance_passes if c) / len(compliance_passes) if compliance_passes else 1.0

    # Determine trend direction
    trend_direction = "stable"
    if len(scores) >= 4:
        recent_half = scores[: len(scores) // 2]
        older_half = scores[len(scores) // 2 :]
        recent_avg = sum(recent_half) / len(recent_half)
        older_avg = sum(older_half) / len(older_half)
        diff = recent_avg - older_avg
        if diff > 0.05:
            trend_direction = "up"
        elif diff < -0.05:
            trend_direction = "down"

    return AgentHistoryResponse(
        agent_id=agent_id,
        agent_name=agent.name,
        reports=report_summaries,
        aggregate={
            "avg_score": round(avg_score, 3),
            "total_calls": len(reports),
            "compliance_rate": round(compliance_rate, 3),
            "trend_direction": trend_direction,
        },
    )


@router.get("/team/{client_id}/summary", response_model=TeamSummaryResponse)
async def get_team_summary(
    client_id: str,
    days: int = Query(default=7, le=90),
    db: Session = Depends(get_db),
):
    """Get team coaching summary with per-agent breakdowns."""
    cutoff = datetime.utcnow() - timedelta(days=days)

    # Get all agents for this client
    agents = db.query(Agent).filter(Agent.client_id == client_id, Agent.is_active == True).all()

    agent_entries = []
    all_scores = []

    for agent in agents:
        reports = (
            db.query(CoachingReport)
            .filter(
                CoachingReport.agent_id == agent.id,
                CoachingReport.created_at >= cutoff,
            )
            .order_by(desc(CoachingReport.created_at))
            .all()
        )

        if not reports:
            continue

        scores = [r.overall_score for r in reports if r.overall_score is not None]
        compliance_passes = [r.compliance_pass for r in reports]

        avg_score = sum(scores) / len(scores) if scores else 0.0
        compliance_rate = sum(1 for c in compliance_passes if c) / len(compliance_passes) if compliance_passes else 1.0
        all_scores.extend(scores)

        # Trend for this agent
        trend = "stable"
        if len(scores) >= 4:
            recent_half = scores[: len(scores) // 2]
            older_half = scores[len(scores) // 2 :]
            recent_avg = sum(recent_half) / len(recent_half)
            older_avg = sum(older_half) / len(older_half)
            diff = recent_avg - older_avg
            if diff > 0.05:
                trend = "up"
            elif diff < -0.05:
                trend = "down"

        agent_entries.append(AgentTeamEntry(
            agent_id=str(agent.id),
            agent_name=agent.name,
            call_count=len(reports),
            avg_score=round(avg_score, 3),
            compliance_rate=round(compliance_rate, 3),
            trend=trend,
        ))

    # Team aggregate
    team_avg_score = sum(all_scores) / len(all_scores) if all_scores else 0.0
    total_calls = sum(a.call_count for a in agent_entries)
    team_compliance = (
        sum(a.compliance_rate * a.call_count for a in agent_entries) / total_calls
        if total_calls > 0
        else 1.0
    )

    return TeamSummaryResponse(
        client_id=client_id,
        period_days=days,
        agents=agent_entries,
        team_aggregate={
            "avg_score": round(team_avg_score, 3),
            "total_calls": total_calls,
            "compliance_rate": round(team_compliance, 3),
            "agent_count": len(agent_entries),
        },
    )


def _report_to_dict(report: CoachingReport) -> dict:
    """Convert a CoachingReport ORM object to a full dict."""
    def _parse_json(val):
        if val is None:
            return None
        if isinstance(val, (dict, list)):
            return val
        try:
            return json.loads(val)
        except (json.JSONDecodeError, TypeError):
            return val

    return {
        "id": report.id,
        "call_id": report.call_id,
        "agent_id": report.agent_id,
        "overall_score": report.overall_score,
        "rating": report.rating,
        "compliance_pass": report.compliance_pass,
        "compliance_issues": _parse_json(report.compliance_issues),
        "strengths": _parse_json(report.strengths),
        "improvement_areas": _parse_json(report.improvement_areas),
        "node_breakdown": _parse_json(report.node_breakdown),
        "talk_listen_ratio": report.talk_listen_ratio,
        "objection_handling": _parse_json(report.objection_handling),
        "close_attempts": _parse_json(report.close_attempts),
        "key_moments": _parse_json(report.key_moments),
        "coaching_summary": report.coaching_summary,
        "trend_direction": report.trend_direction,
        "model_used": report.model_used,
        "input_tokens": report.input_tokens or 0,
        "output_tokens": report.output_tokens or 0,
        "created_at": report.created_at.isoformat() if report.created_at else None,
    }
