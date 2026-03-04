"""
SQLAlchemy ORM models for Pilot's Desk database
Uses SQLite-compatible types (no PostgreSQL-specific dialects)
"""

from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Date, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.db.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class Agent(Base):
    __tablename__ = "agents"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    client_id = Column(String(50), nullable=False, index=True)
    team = Column(String(100))
    supervisor_id = Column(String(36), ForeignKey("agents.id"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    calls = relationship("CallMetadata", back_populates="agent")
    supervised_agents = relationship("Agent", remote_side=[id])
    daily_metrics = relationship("AgentDailyMetrics", back_populates="agent")


class ScriptVersion(Base):
    __tablename__ = "script_versions"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    client_id = Column(String(50), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    version = Column(String(50), nullable=False)
    description = Column(Text)
    schema_json = Column(JSON, nullable=False)
    is_active = Column(Boolean, default=False, index=True)
    created_by = Column(String(36), ForeignKey("agents.id"))
    created_at = Column(DateTime, server_default=func.now())
    activated_at = Column(DateTime)

    # Relationships
    calls = relationship("CallMetadata", back_populates="script_version")


class CallMetadata(Base):
    __tablename__ = "call_metadata"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    agent_id = Column(String(36), ForeignKey("agents.id"), nullable=False, index=True)
    client_id = Column(String(50), nullable=False, index=True)
    script_version_id = Column(String(36), ForeignKey("script_versions.id"))
    started_at = Column(DateTime, nullable=False, index=True)
    ended_at = Column(DateTime)
    duration_seconds = Column(Integer)
    disposition = Column(String(50))
    adherence_score = Column(Float)
    compliance_ok = Column(Boolean, default=True)
    audio_file_path = Column(String(500), nullable=True)
    audio_duration_seconds = Column(Float, nullable=True)
    analysis_status = Column(String(20), nullable=True, default=None)  # mirrors job status for quick queries
    created_at = Column(DateTime, server_default=func.now(), index=True)

    # Relationships
    agent = relationship("Agent", back_populates="calls")
    script_version = relationship("ScriptVersion", back_populates="calls")
    segments = relationship("SegmentScore", back_populates="call", cascade="all, delete-orphan")
    transcript_meta = relationship("TranscriptMetadata", back_populates="call", cascade="all, delete-orphan")
    nudges = relationship("Nudge", back_populates="call", cascade="all, delete-orphan")


class SegmentScore(Base):
    __tablename__ = "segment_scores"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    call_id = Column(String(36), ForeignKey("call_metadata.id", ondelete="CASCADE"), nullable=False, index=True)
    segment_id = Column(String(100), nullable=False)
    node_id = Column(String(100), nullable=False, index=True)
    expected_text = Column(Text)
    actual_transcript = Column(Text)
    adherence_score = Column(Float, nullable=False)
    key_points_covered = Column(JSON)  # stored as JSON array
    key_points_missed = Column(JSON)   # stored as JSON array
    compliance_ok = Column(Boolean, default=True)
    compliance_severity = Column(String(20))
    nudges_sent = Column(Integer, default=0)
    processing_time_ms = Column(Float)
    model_used = Column(String(100))
    created_at = Column(DateTime, server_default=func.now(), index=True)

    # Relationships
    call = relationship("CallMetadata", back_populates="segments")
    nudges = relationship("Nudge", back_populates="segment", cascade="all, delete-orphan")


class TranscriptMetadata(Base):
    __tablename__ = "transcript_metadata"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    call_id = Column(String(36), ForeignKey("call_metadata.id", ondelete="CASCADE"), nullable=False, index=True)
    segment_count = Column(Integer, nullable=False)
    word_count = Column(Integer)
    pii_redaction_count = Column(Integer, default=0)
    pii_types = Column(JSON)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    call = relationship("CallMetadata", back_populates="transcript_meta")


class Nudge(Base):
    __tablename__ = "nudges"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    call_id = Column(String(36), ForeignKey("call_metadata.id", ondelete="CASCADE"), nullable=False, index=True)
    segment_id = Column(String(36), ForeignKey("segment_scores.id", ondelete="CASCADE"))
    nudge_type = Column(String(50), nullable=False)
    severity = Column(String(20), nullable=False)
    message = Column(Text, nullable=False)
    node_id = Column(String(100))
    acknowledged = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now(), index=True)

    # Relationships
    call = relationship("CallMetadata", back_populates="nudges")
    segment = relationship("SegmentScore", back_populates="nudges")


class AgentDailyMetrics(Base):
    __tablename__ = "agent_daily_metrics"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    agent_id = Column(String(36), ForeignKey("agents.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    client_id = Column(String(50), nullable=False)
    calls_total = Column(Integer, default=0)
    calls_with_sales = Column(Integer, default=0)
    avg_adherence_score = Column(Float)
    avg_call_duration_seconds = Column(Integer)
    compliance_violations = Column(Integer, default=0)
    nudges_received = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    agent = relationship("Agent", back_populates="daily_metrics")


class NodeAnalytics(Base):
    __tablename__ = "node_analytics"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    client_id = Column(String(50), nullable=False, index=True)
    script_version_id = Column(String(36), ForeignKey("script_versions.id"))
    node_id = Column(String(100), nullable=False, index=True)
    calls_reached = Column(Integer, default=0)
    avg_adherence_score = Column(Float)
    compliance_failure_count = Column(Integer, default=0)
    avg_time_spent_seconds = Column(Float)
    transitions_taken = Column(JSON)
    date = Column(Date, nullable=False, index=True)


class ActiveCall(Base):
    __tablename__ = "active_calls"

    id = Column(String(36), primary_key=True)
    agent_id = Column(String(36), ForeignKey("agents.id"), nullable=False, index=True)
    agent_name = Column(String(255))
    current_node_id = Column(String(100))
    current_node_text = Column(Text)
    latest_adherence_score = Column(Float)
    compliance_ok = Column(Boolean, default=True)
    started_at = Column(DateTime, nullable=False)
    last_updated = Column(DateTime, server_default=func.now(), index=True)


class PatternTracking(Base):
    __tablename__ = "pattern_tracking"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    agent_id = Column(String(36), ForeignKey("agents.id"), nullable=False, index=True)
    error_type = Column(String(100), nullable=False, index=True)
    error_context = Column(Text, default="")
    occurrence_count = Column(Integer, default=1)
    first_seen = Column(DateTime, server_default=func.now())
    last_seen = Column(DateTime, server_default=func.now())


class AgentProfile(Base):
    __tablename__ = "agent_profiles"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    agent_id = Column(String(36), ForeignKey("agents.id"), nullable=False, unique=True, index=True)
    tenure_start_date = Column(DateTime)
    profile_tier = Column(String(20), default="developing")  # new_agent, developing, experienced


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    call_id = Column(String(36), ForeignKey("call_metadata.id"), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="pending")  # pending, transcribing, analyzing, completed, failed
    audio_file_path = Column(String(500), nullable=False)
    audio_duration = Column(Float, nullable=True)
    transcription_started_at = Column(DateTime, nullable=True)
    transcription_completed_at = Column(DateTime, nullable=True)
    analysis_started_at = Column(DateTime, nullable=True)
    analysis_completed_at = Column(DateTime, nullable=True)
    model_used = Column(String(100), nullable=True)
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    cost = Column(Float, default=0.0)
    retry_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    call = relationship("CallMetadata", foreign_keys=[call_id])


class CallTranscript(Base):
    __tablename__ = "call_transcripts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    call_id = Column(String(36), ForeignKey("call_metadata.id"), nullable=False, unique=True, index=True)
    full_transcript = Column(Text, nullable=False)
    speaker_segments = Column(Text, nullable=True)  # JSON array
    word_count = Column(Integer, default=0)
    confidence = Column(Float, default=0.0)
    provider = Column(String(50), default="deepgram")
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    call = relationship("CallMetadata", foreign_keys=[call_id])


class CoachingReport(Base):
    __tablename__ = "coaching_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    call_id = Column(String(36), ForeignKey("call_metadata.id"), nullable=False, unique=True, index=True)
    agent_id = Column(String(36), ForeignKey("agents.id"), nullable=False, index=True)
    overall_score = Column(Float, nullable=False)  # 0.0 to 1.0
    rating = Column(String(20), nullable=False)  # excellent/good/acceptable/needs_improvement/poor
    compliance_pass = Column(Boolean, default=True)
    compliance_issues = Column(Text, nullable=True)  # JSON array
    strengths = Column(Text, nullable=True)  # JSON array
    improvement_areas = Column(Text, nullable=True)  # JSON array
    node_breakdown = Column(Text, nullable=True)  # JSON: {node_id: {score, notes}}
    talk_listen_ratio = Column(Float, nullable=True)
    objection_handling = Column(Text, nullable=True)  # JSON
    close_attempts = Column(Text, nullable=True)  # JSON
    key_moments = Column(Text, nullable=True)  # JSON array
    coaching_summary = Column(Text, nullable=True)  # prose summary
    trend_direction = Column(String(10), nullable=True)  # up/down/stable
    model_used = Column(String(100), nullable=True)
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    call = relationship("CallMetadata", foreign_keys=[call_id])
    agent = relationship("Agent", foreign_keys=[agent_id])
