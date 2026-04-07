from datetime import datetime, date
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# ─────────────────────────── Customer Schemas ────────────────────────────

class CustomerBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    phone: str = Field(..., min_length=7, max_length=20)
    email: Optional[str] = None
    loan_amount: Decimal = Field(default=Decimal("0"), ge=0)
    outstanding_amount: Decimal = Field(default=Decimal("0"), ge=0)
    dpd: int = Field(default=0, ge=0)
    due_date: Optional[date] = None
    loan_id: Optional[str] = None
    segment: str = Field(default="standard")
    preferred_language: str = Field(default="hindi")
    status: str = Field(default="active")
    tags: List[str] = Field(default_factory=list)
    address: Optional[str] = None

    @field_validator("segment")
    @classmethod
    def validate_segment(cls, v: str) -> str:
        valid = {"prime", "standard", "risky"}
        if v not in valid:
            raise ValueError(f"segment must be one of {valid}")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        valid = {"active", "inactive", "completed"}
        if v not in valid:
            raise ValueError(f"status must be one of {valid}")
        return v


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    loan_amount: Optional[Decimal] = None
    outstanding_amount: Optional[Decimal] = None
    dpd: Optional[int] = None
    due_date: Optional[date] = None
    loan_id: Optional[str] = None
    segment: Optional[str] = None
    preferred_language: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[List[str]] = None
    address: Optional[str] = None


class CustomerRead(CustomerBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CustomerListItem(BaseModel):
    id: str
    name: str
    phone: str
    loan_amount: Decimal
    outstanding_amount: Decimal
    dpd: int
    segment: str
    status: str
    preferred_language: str
    created_at: datetime

    class Config:
        from_attributes = True


# ─────────────────────────── Campaign Schemas ────────────────────────────

class CampaignBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    agent_type: str = Field(...)
    flow_id: str = Field(...)
    schedule_time: Optional[datetime] = None
    customer_filter: Optional[Dict[str, Any]] = None

    @field_validator("agent_type")
    @classmethod
    def validate_agent_type(cls, v: str) -> str:
        valid = {"sarvam", "whisper_edge"}
        if v not in valid:
            raise ValueError(f"agent_type must be one of {valid}")
        return v

    @field_validator("flow_id")
    @classmethod
    def validate_flow_id(cls, v: str) -> str:
        valid = {"flow_basic", "flow_standard", "flow_advanced"}
        if v not in valid:
            raise ValueError(f"flow_id must be one of {valid}")
        return v


class CampaignCreate(CampaignBase):
    customer_ids: Optional[List[str]] = None


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    agent_type: Optional[str] = None
    flow_id: Optional[str] = None
    schedule_time: Optional[datetime] = None
    customer_filter: Optional[Dict[str, Any]] = None
    status: Optional[str] = None


class CampaignRead(CampaignBase):
    id: str
    status: str
    total_customers: int
    called: int
    connected: int
    committed: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─────────────────────────── CallSession Schemas ─────────────────────────

class CallSessionBase(BaseModel):
    customer_id: str
    campaign_id: Optional[str] = None
    agent_type: str
    flow_id: str
    tier: Optional[str] = None


class CallSessionCreate(CallSessionBase):
    pass


class CallSessionRead(CallSessionBase):
    id: str
    status: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    outcome: Optional[str] = None
    commitment_amount: Optional[Decimal] = None
    commitment_date: Optional[date] = None
    payment_made: Optional[bool] = None
    payment_amount: Optional[Decimal] = None
    receipt_confirmed: Optional[bool] = None
    notes: Optional[str] = None
    created_at: datetime
    customer_name: Optional[str] = None

    class Config:
        from_attributes = True


class CallSessionDetail(CallSessionRead):
    transcripts: Optional[List["TranscriptRead"]] = None
    metrics: Optional["SessionMetricsRead"] = None


# ─────────────────────────── Transcript Schemas ──────────────────────────

class TranscriptRead(BaseModel):
    id: str
    session_id: str
    speaker: str
    text: str
    timestamp: datetime
    confidence: Optional[float] = None
    language: Optional[str] = None
    turn_index: int

    class Config:
        from_attributes = True


# ─────────────────────────── Metrics Schemas ─────────────────────────────

class SessionMetricsRead(BaseModel):
    id: str
    session_id: str
    stt_latency_ms: Optional[float] = None
    llm_latency_ms: Optional[float] = None
    tts_latency_ms: Optional[float] = None
    total_latency_ms: Optional[float] = None
    tokens_input: Optional[int] = None
    tokens_output: Optional[int] = None
    cost_usd: Optional[Decimal] = None
    ttfb_ms: Optional[float] = None
    audio_duration_ms: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─────────────────────────── Voice Schemas ───────────────────────────────

class VoiceSessionCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    # Accept both camelCase (from frontend AgentConfig) and snake_case
    customer_id: Optional[str] = Field(default=None, alias="customerId")
    campaign_id: Optional[str] = Field(default=None, alias="campaignId")
    agent_type: str = Field(default="sarvam", alias="agentType")
    flow_id: str = Field(default="flow_basic", alias="flowId")

    # Extra fields from AgentConfig (stored for context, not persisted to DB)
    customer_name: Optional[str] = Field(default=None, alias="customerName")
    loan_amount: Optional[float] = Field(default=None, alias="loanAmount")
    outstanding_amount: Optional[float] = Field(default=None, alias="outstandingAmount")
    dpd: Optional[int] = None
    due_date: Optional[str] = Field(default=None, alias="dueDate")
    language: Optional[str] = Field(default="hi-IN", alias="language")
    voice_id: Optional[str] = Field(default="priya", alias="voice")
    # LLM provider selection — controllable from the UI
    # "groq" (default) | "sarvam" | "openai"
    llm_provider: Optional[str] = Field(default="groq", alias="llmProvider")
    # Max completion tokens — for sarvam-30b set ≥ 2000 to cover thinking tokens
    llm_max_tokens: Optional[int] = Field(default=300, alias="llmMaxTokens")


class VoiceSessionResponse(BaseModel):
    session_id: str
    ice_servers: List[Dict[str, Any]]
    status: str


class SDPOfferRequest(BaseModel):
    sdp: str
    type: str = "offer"


class ICECandidateRequest(BaseModel):
    candidate: str
    sdpMid: Optional[str] = None
    sdpMLineIndex: Optional[int] = None


# ─────────────────────────── Dashboard Schemas ───────────────────────────

class DashboardStats(BaseModel):
    total_customers: int
    active_campaigns: int
    calls_today: int
    calls_this_week: int
    payment_rate: float
    avg_call_duration: float
    total_committed_today: Decimal
    calls_by_outcome: Dict[str, int]
    recent_sessions: List[Dict[str, Any]]
    hourly_calls: List[Dict[str, Any]]


# ─────────────────────────── Analytics Schemas ───────────────────────────

class OverviewStats(BaseModel):
    total_calls: int
    total_connected: int
    total_committed: int
    total_commitment_amount: Decimal
    connection_rate: float
    commitment_rate: float
    avg_call_duration: float
    total_cost_usd: Decimal


# ─────────────────────────── Pagination Schemas ──────────────────────────

class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    limit: int
    pages: int


# ─────────────────────────── Upload Schemas ──────────────────────────────

class UploadResult(BaseModel):
    success_count: int
    error_count: int
    errors: List[Dict[str, Any]]
    created_ids: List[str]


# Resolve forward references
CallSessionDetail.model_rebuild()
