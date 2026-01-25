"""
SQLAlchemy ORM models for Pilot's Desk database
"""

from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Date, ForeignKey, Text, ARRAY
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.db.database import Base


class Agent(Base):
    __tablename__ = "agents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    client_id = Column(String(50), nullable=False, index=True)
    team = Column(String(100))
    supervisor_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    calls = relationship("CallMetadata", back_populates="agent")
    supervised_agents = relationship("Agent", remote_side=[id])
    daily_metrics = relationship("AgentDailyMetrics", back_populates="agent")


class ScriptVersion(Base):
    __tablename__ = "script_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(String(50), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    version = Column(String(50), nullable=False)
    description = Column(Text)
    schema_json = Column(JSONB, nullable=False)
    is_active = Column(Boolean, default=False, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("agents.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    activated_at = Column(DateTime(timezone=True))

    # Relationships
    calls = relationship("CallMetadata", back_populates="script_version")


class CallMetadata(Base):
    __tablename__ = "call_metadata"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False, index=True)
    client_id = Column(String(50), nullable=False, index=True)
    script_version_id = Column(UUID(as_uuid=True), ForeignKey("script_versions.id"))
    started_at = Column(DateTime(timezone=True), nullable=False, index=True)
    ended_at = Column(DateTime(timezone=True))
    duration_seconds = Column(Integer)
    disposition = Column(String(50))
    adherence_score = Column(Float)
    compliance_ok = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationships
    agent = relationship("Agent", back_populates="calls")
    script_version = relationship("ScriptVersion", back_populates="calls")
    segments = relationship("SegmentScore", back_populates="call", cascade="all, delete-orphan")
    transcript_meta = relationship("TranscriptMetadata", back_populates="call", cascade="all, delete-orphan")
    nudges = relationship("Nudge", back_populates="call", cascade="all, delete-orphan")


class SegmentScore(Base):
    __tablename__ = "segment_scores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    call_id = Column(UUID(as_uuid=True), ForeignKey("call_metadata.id", ondelete="CASCADE"), nullable=False, index=True)
    segment_id = Column(String(100), nullable=False)
    node_id = Column(String(100), nullable=False, index=True)
    expected_text = Column(Text)
    actual_transcript = Column(Text)
    adherence_score = Column(Float, nullable=False)
    key_points_covered = Column(ARRAY(Text))
    key_points_missed = Column(ARRAY(Text))
    compliance_ok = Column(Boolean, default=True)
    compliance_severity = Column(String(20))
    nudges_sent = Column(Integer, default=0)
    processing_time_ms = Column(Float)
    model_used = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationships
    call = relationship("CallMetadata", back_populates="segments")
    nudges = relationship("Nudge", back_populates="segment", cascade="all, delete-orphan")


class TranscriptMetadata(Base):
    __tablename__ = "transcript_metadata"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    call_id = Column(UUID(as_uuid=True), ForeignKey("call_metadata.id", ondelete="CASCADE"), nullable=False, index=True)
    segment_count = Column(Integer, nullable=False)
    word_count = Column(Integer)
    pii_redaction_count = Column(Integer, default=0)
    pii_types = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    call = relationship("CallMetadata", back_populates="transcript_meta")


class Nudge(Base):
    __tablename__ = "nudges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    call_id = Column(UUID(as_uuid=True), ForeignKey("call_metadata.id", ondelete="CASCADE"), nullable=False, index=True)
    segment_id = Column(UUID(as_uuid=True), ForeignKey("segment_scores.id", ondelete="CASCADE"))
    nudge_type = Column(String(50), nullable=False)
    severity = Column(String(20), nullable=False)
    message = Column(Text, nullable=False)
    node_id = Column(String(100))
    acknowledged = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationships
    call = relationship("CallMetadata", back_populates="nudges")
    segment = relationship("SegmentScore", back_populates="nudges")


class AgentDailyMetrics(Base):
    __tablename__ = "agent_daily_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    client_id = Column(String(50), nullable=False)
    calls_total = Column(Integer, default=0)
    calls_with_sales = Column(Integer, default=0)
    avg_adherence_score = Column(Float)
    avg_call_duration_seconds = Column(Integer)
    compliance_violations = Column(Integer, default=0)
    nudges_received = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    agent = relationship("Agent", back_populates="daily_metrics")


class NodeAnalytics(Base):
    __tablename__ = "node_analytics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(String(50), nullable=False, index=True)
    script_version_id = Column(UUID(as_uuid=True), ForeignKey("script_versions.id"))
    node_id = Column(String(100), nullable=False, index=True)
    calls_reached = Column(Integer, default=0)
    avg_adherence_score = Column(Float)
    compliance_failure_count = Column(Integer, default=0)
    avg_time_spent_seconds = Column(Float)
    transitions_taken = Column(JSONB)
    date = Column(Date, nullable=False, index=True)


class ActiveCall(Base):
    __tablename__ = "active_calls"

    id = Column(UUID(as_uuid=True), primary_key=True)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False, index=True)
    agent_name = Column(String(255))
    current_node_id = Column(String(100))
    current_node_text = Column(Text)
    latest_adherence_score = Column(Float)
    compliance_ok = Column(Boolean, default=True)
    started_at = Column(DateTime(timezone=True), nullable=False)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), index=True)
