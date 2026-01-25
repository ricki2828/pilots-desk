"""
Analytics Router
Endpoints for call analytics and reporting
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, desc
from datetime import datetime, timedelta, date
from typing import List, Optional
import logging

from app.db.database import get_db
from app.db.models import (
    CallMetadata, SegmentScore, Agent, AgentDailyMetrics,
    NodeAnalytics, ActiveCall, ScriptVersion
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health")
async def health_check():
    """Health check for analytics service"""
    return {
        "status": "healthy",
        "service": "analytics"
    }


@router.get("/supervisor/active-calls")
async def get_active_calls(
    client_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Get all currently active calls for supervisor dashboard

    Returns real-time view of all agents currently on calls
    """
    query = db.query(ActiveCall)

    if client_id:
        query = query.join(Agent).filter(Agent.client_id == client_id)

    active_calls = query.all()

    return {
        "active_calls": [
            {
                "call_id": str(call.id),
                "agent_id": str(call.agent_id),
                "agent_name": call.agent_name,
                "current_node_id": call.current_node_id,
                "current_node_text": call.current_node_text,
                "latest_adherence_score": call.latest_adherence_score,
                "compliance_ok": call.compliance_ok,
                "started_at": call.started_at.isoformat(),
                "duration_seconds": int((datetime.utcnow() - call.started_at).total_seconds()),
                "last_updated": call.last_updated.isoformat()
            }
            for call in active_calls
        ],
        "total_active": len(active_calls)
    }


@router.get("/supervisor/team-summary")
async def get_team_summary(
    client_id: str,
    days: int = 7,
    db: Session = Depends(get_db)
):
    """
    Get team performance summary for supervisor

    Shows aggregate metrics for the team over last N days
    """
    cutoff_date = date.today() - timedelta(days=days)

    # Get team metrics
    team_metrics = db.query(
        func.count(CallMetadata.id).label('total_calls'),
        func.count(func.nullif(CallMetadata.disposition == 'SALE', False)).label('sales'),
        func.avg(CallMetadata.adherence_score).label('avg_adherence'),
        func.avg(CallMetadata.duration_seconds).label('avg_duration'),
        func.count(func.nullif(CallMetadata.compliance_ok == False, True)).label('compliance_violations')
    ).filter(
        and_(
            CallMetadata.client_id == client_id,
            func.cast(CallMetadata.started_at, Date) >= cutoff_date
        )
    ).first()

    # Get top performers
    top_performers = db.query(
        Agent.name,
        func.avg(CallMetadata.adherence_score).label('avg_score'),
        func.count(CallMetadata.id).label('calls')
    ).join(CallMetadata).filter(
        and_(
            Agent.client_id == client_id,
            func.cast(CallMetadata.started_at, Date) >= cutoff_date
        )
    ).group_by(Agent.id, Agent.name).order_by(desc('avg_score')).limit(5).all()

    return {
        "period_days": days,
        "metrics": {
            "total_calls": team_metrics.total_calls or 0,
            "sales": team_metrics.sales or 0,
            "conversion_rate": (team_metrics.sales / team_metrics.total_calls * 100) if team_metrics.total_calls else 0,
            "avg_adherence_score": round(team_metrics.avg_adherence or 0, 2),
            "avg_duration_seconds": int(team_metrics.avg_duration or 0),
            "compliance_violations": team_metrics.compliance_violations or 0
        },
        "top_performers": [
            {
                "name": p.name,
                "avg_score": round(p.avg_score, 2),
                "calls": p.calls
            }
            for p in top_performers
        ]
    }


@router.get("/call/{call_id}/summary")
async def get_call_summary(call_id: str, db: Session = Depends(get_db)):
    """Get detailed summary for a specific call"""
    call = db.query(CallMetadata).filter(CallMetadata.id == call_id).first()

    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    # Get all segments
    segments = db.query(SegmentScore).filter(SegmentScore.call_id == call_id).all()

    # Get agent info
    agent = db.query(Agent).filter(Agent.id == call.agent_id).first()

    return {
        "call_id": str(call.id),
        "agent": {
            "id": str(agent.id),
            "name": agent.name,
            "email": agent.email
        } if agent else None,
        "started_at": call.started_at.isoformat(),
        "ended_at": call.ended_at.isoformat() if call.ended_at else None,
        "duration_seconds": call.duration_seconds,
        "disposition": call.disposition,
        "adherence_score": round(call.adherence_score, 2) if call.adherence_score else None,
        "compliance_ok": call.compliance_ok,
        "segments": [
            {
                "segment_id": seg.segment_id,
                "node_id": seg.node_id,
                "adherence_score": round(seg.adherence_score, 2),
                "compliance_ok": seg.compliance_ok,
                "nudges_sent": seg.nudges_sent
            }
            for seg in segments
        ],
        "segment_count": len(segments)
    }


@router.get("/agent/{agent_id}/performance")
async def get_agent_performance(
    agent_id: str,
    days: int = 30,
    db: Session = Depends(get_db)
):
    """Get performance metrics for a specific agent"""
    cutoff_date = date.today() - timedelta(days=days)

    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Get daily metrics
    daily_metrics = db.query(AgentDailyMetrics).filter(
        and_(
            AgentDailyMetrics.agent_id == agent_id,
            AgentDailyMetrics.date >= cutoff_date
        )
    ).order_by(AgentDailyMetrics.date).all()

    # Get recent calls
    recent_calls = db.query(CallMetadata).filter(
        and_(
            CallMetadata.agent_id == agent_id,
            func.cast(CallMetadata.started_at, Date) >= cutoff_date
        )
    ).order_by(desc(CallMetadata.started_at)).limit(10).all()

    return {
        "agent": {
            "id": str(agent.id),
            "name": agent.name,
            "email": agent.email,
            "client_id": agent.client_id,
            "team": agent.team
        },
        "period_days": days,
        "daily_metrics": [
            {
                "date": str(metric.date),
                "calls": metric.calls_total,
                "sales": metric.calls_with_sales,
                "avg_adherence": round(metric.avg_adherence_score, 2) if metric.avg_adherence_score else None,
                "violations": metric.compliance_violations
            }
            for metric in daily_metrics
        ],
        "recent_calls": [
            {
                "call_id": str(call.id),
                "started_at": call.started_at.isoformat(),
                "duration_seconds": call.duration_seconds,
                "adherence_score": round(call.adherence_score, 2) if call.adherence_score else None,
                "disposition": call.disposition
            }
            for call in recent_calls
        ]
    }


@router.get("/script/bottlenecks")
async def get_script_bottlenecks(
    client_id: str,
    days: int = 30,
    min_calls: int = 10,
    db: Session = Depends(get_db)
):
    """
    Identify script bottlenecks - nodes with low adherence or high failures

    Helps identify which parts of the script need improvement
    """
    cutoff_date = date.today() - timedelta(days=days)

    bottlenecks = db.query(
        NodeAnalytics.node_id,
        func.sum(NodeAnalytics.calls_reached).label('total_reached'),
        func.avg(NodeAnalytics.avg_adherence_score).label('avg_adherence'),
        func.sum(NodeAnalytics.compliance_failure_count).label('total_failures')
    ).filter(
        and_(
            NodeAnalytics.client_id == client_id,
            NodeAnalytics.date >= cutoff_date
        )
    ).group_by(NodeAnalytics.node_id).having(
        func.sum(NodeAnalytics.calls_reached) >= min_calls
    ).order_by(desc('total_failures'), 'avg_adherence').limit(20).all()

    return {
        "client_id": client_id,
        "period_days": days,
        "bottlenecks": [
            {
                "node_id": b.node_id,
                "calls_reached": b.total_reached,
                "avg_adherence_score": round(b.avg_adherence, 2) if b.avg_adherence else None,
                "compliance_failures": b.total_failures,
                "status": "critical" if b.total_failures > 10 or (b.avg_adherence and b.avg_adherence < 0.6) else "warning"
            }
            for b in bottlenecks
        ]
    }


@router.get("/reports/daily-summary")
async def get_daily_summary(
    client_id: str,
    target_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """Get daily summary report for a client"""
    if not target_date:
        target_date = date.today()

    # Get calls for the day
    calls = db.query(CallMetadata).filter(
        and_(
            CallMetadata.client_id == client_id,
            func.cast(CallMetadata.started_at, Date) == target_date
        )
    ).all()

    # Calculate metrics
    total_calls = len(calls)
    sales = sum(1 for c in calls if c.disposition == 'SALE')
    avg_adherence = sum(c.adherence_score for c in calls if c.adherence_score) / total_calls if total_calls else 0
    compliance_violations = sum(1 for c in calls if not c.compliance_ok)

    # Get agent breakdown
    agent_breakdown = db.query(
        Agent.name,
        func.count(CallMetadata.id).label('calls'),
        func.count(func.nullif(CallMetadata.disposition == 'SALE', False)).label('sales')
    ).join(CallMetadata).filter(
        and_(
            CallMetadata.client_id == client_id,
            func.cast(CallMetadata.started_at, Date) == target_date
        )
    ).group_by(Agent.id, Agent.name).all()

    return {
        "date": str(target_date),
        "client_id": client_id,
        "summary": {
            "total_calls": total_calls,
            "sales": sales,
            "conversion_rate": round(sales / total_calls * 100, 1) if total_calls else 0,
            "avg_adherence_score": round(avg_adherence, 2),
            "compliance_violations": compliance_violations
        },
        "agent_breakdown": [
            {
                "agent_name": ab.name,
                "calls": ab.calls,
                "sales": ab.sales,
                "conversion_rate": round(ab.sales / ab.calls * 100, 1) if ab.calls else 0
            }
            for ab in agent_breakdown
        ]
    }

