"""
Data models for scoring and coaching
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime


class ScoreRequest(BaseModel):
    """Request to score a transcript segment"""
    agent_id: str
    call_id: str
    segment_id: str
    script_node_id: str
    expected_text: str  # What the script says agent should say
    actual_transcript: str  # What agent actually said
    client_id: str = "SKY_TV_NZ"


class AdherenceScore(BaseModel):
    """Adherence score for a segment"""
    score: float = Field(..., ge=0.0, le=1.0, description="Adherence score 0.0-1.0")
    explanation: str
    key_points_covered: List[str]
    key_points_missed: List[str]
    recommendations: List[str] = []


class ComplianceCheck(BaseModel):
    """Compliance violation check"""
    is_compliant: bool
    violation_type: Optional[str] = None
    severity: Literal["low", "medium", "high", "critical"] = "low"
    message: Optional[str] = None
    required_text: Optional[str] = None
    actual_match_score: Optional[float] = None


class Nudge(BaseModel):
    """Coaching nudge for agent"""
    nudge_type: Literal[
        "adherence", "compliance", "pace", "energy", "keyword",
        "talk_ratio", "keyword_miss", "positive", "pattern", "upsell", "close_timing"
    ]
    severity: Literal["info", "warning", "critical"]
    message: str
    node_id: str
    display_style: str = "toast"
    color: str = "#3B82F6"
    display_duration_seconds: int = 8
    requires_acknowledgment: bool = False
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ScoreResponse(BaseModel):
    """Response from scoring endpoint"""
    segment_id: str
    adherence: AdherenceScore
    compliance: ComplianceCheck
    nudges: List[Nudge] = []
    processing_time_ms: float
    model_used: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class CallMetadata(BaseModel):
    """Metadata for a call"""
    call_id: str
    agent_id: str
    client_id: str
    script_version: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    disposition: Optional[str] = None


class SegmentScore(BaseModel):
    """Score for a single segment (stored in database)"""
    segment_id: str
    call_id: str
    node_id: str
    adherence_score: float
    compliance_ok: bool
    nudges_sent: int
    timestamp: datetime
