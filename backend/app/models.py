import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean, Column, DateTime, Date, ForeignKey, Integer, Numeric,
    String, Text, Float, JSON, UniqueConstraint, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class Customer(Base):
    __tablename__ = "customers"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    phone = Column(String(20), unique=True, nullable=False, index=True)
    email = Column(String(255), nullable=True)
    loan_amount = Column(Numeric(15, 2), nullable=False, default=0)
    outstanding_amount = Column(Numeric(15, 2), nullable=False, default=0)
    dpd = Column(Integer, default=0, nullable=False)  # days past due
    due_date = Column(Date, nullable=True)
    loan_id = Column(String(100), nullable=True, index=True)
    segment = Column(String(50), default="standard", nullable=False)  # prime, standard, risky
    preferred_language = Column(String(50), default="hindi", nullable=False)
    status = Column(String(50), default="active", nullable=False, index=True)  # active, inactive, completed
    tags = Column(JSON, default=list)
    address = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    call_sessions = relationship("CallSession", back_populates="customer", lazy="select")
    campaign_associations = relationship("CampaignCustomer", back_populates="customer", lazy="select")


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), default="draft", nullable=False, index=True)  # draft, active, paused, completed
    agent_type = Column(String(50), nullable=False)  # sarvam, whisper_edge
    flow_id = Column(String(100), nullable=False)  # flow_basic, flow_standard, flow_advanced
    schedule_time = Column(DateTime(timezone=True), nullable=True)
    customer_filter = Column(JSON, nullable=True)  # {dpd_min, dpd_max, segment, tags}
    total_customers = Column(Integer, default=0)
    called = Column(Integer, default=0)
    connected = Column(Integer, default=0)
    committed = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    call_sessions = relationship("CallSession", back_populates="campaign", lazy="select")
    customer_associations = relationship("CampaignCustomer", back_populates="campaign", lazy="select")


class CallSession(Base):
    __tablename__ = "call_sessions"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    customer_id = Column(UUID(as_uuid=False), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    campaign_id = Column(UUID(as_uuid=False), ForeignKey("campaigns.id", ondelete="SET NULL"), nullable=True, index=True)
    agent_type = Column(String(50), nullable=False)  # sarvam, whisper_edge
    flow_id = Column(String(100), nullable=False)
    status = Column(String(50), default="active", nullable=False, index=True)  # active, completed, failed, voicemail, no_answer
    start_time = Column(DateTime(timezone=True), nullable=True)
    end_time = Column(DateTime(timezone=True), nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    tier = Column(String(50), nullable=True)  # tier_1, tier_2, tier_3
    outcome = Column(String(100), nullable=True, index=True)  # commitment, payment_plan, escalated, no_answer, voicemail, callback_requested, refused
    commitment_amount = Column(Numeric(15, 2), nullable=True)
    commitment_date = Column(Date, nullable=True)
    payment_made = Column(Boolean, nullable=True)
    payment_amount = Column(Numeric(15, 2), nullable=True)
    receipt_confirmed = Column(Boolean, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    # Relationships
    customer = relationship("Customer", back_populates="call_sessions")
    campaign = relationship("Campaign", back_populates="call_sessions")
    transcripts = relationship("Transcript", back_populates="session", lazy="select", cascade="all, delete-orphan")
    metrics = relationship("SessionMetrics", back_populates="session", lazy="select", uselist=False, cascade="all, delete-orphan")


class Transcript(Base):
    __tablename__ = "transcripts"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    session_id = Column(UUID(as_uuid=False), ForeignKey("call_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    speaker = Column(String(50), nullable=False)  # agent, customer
    text = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    confidence = Column(Float, nullable=True)
    language = Column(String(50), nullable=True)
    turn_index = Column(Integer, default=0, nullable=False)

    # Relationships
    session = relationship("CallSession", back_populates="transcripts")


class SessionMetrics(Base):
    __tablename__ = "session_metrics"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    session_id = Column(UUID(as_uuid=False), ForeignKey("call_sessions.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    stt_latency_ms = Column(Float, nullable=True)
    llm_latency_ms = Column(Float, nullable=True)
    tts_latency_ms = Column(Float, nullable=True)
    total_latency_ms = Column(Float, nullable=True)
    tokens_input = Column(Integer, nullable=True)
    tokens_output = Column(Integer, nullable=True)
    cost_usd = Column(Numeric(10, 6), nullable=True)
    ttfb_ms = Column(Float, nullable=True)  # time to first byte
    audio_duration_ms = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    session = relationship("CallSession", back_populates="metrics")


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False)
    phone = Column(String(20), nullable=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CampaignCustomer(Base):
    """Association table between campaigns and customers."""
    __tablename__ = "campaign_customers"

    campaign_id = Column(UUID(as_uuid=False), ForeignKey("campaigns.id", ondelete="CASCADE"), primary_key=True)
    customer_id = Column(UUID(as_uuid=False), ForeignKey("customers.id", ondelete="CASCADE"), primary_key=True)
    status = Column(String(50), default="pending", nullable=False)  # pending, called, connected, failed
    session_id = Column(UUID(as_uuid=False), ForeignKey("call_sessions.id", ondelete="SET NULL"), nullable=True)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    campaign = relationship("Campaign", back_populates="customer_associations")
    customer = relationship("Customer", back_populates="campaign_associations")
    session = relationship("CallSession")
