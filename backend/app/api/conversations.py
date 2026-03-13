import math
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import CallSession, Customer, Transcript, SessionMetrics
from app.schemas import (
    CallSessionRead, TranscriptRead, SessionMetricsRead,
    PaginatedResponse, CallSessionDetail
)

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


# ─────────────────────────── List Conversations ──────────────────────────

@router.get("", response_model=PaginatedResponse)
async def list_conversations(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    customer_id: Optional[str] = Query(None),
    campaign_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    agent_type: Optional[str] = Query(None),
    outcome: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    filters = []

    if customer_id:
        filters.append(CallSession.customer_id == customer_id)
    if campaign_id:
        filters.append(CallSession.campaign_id == campaign_id)
    if status:
        filters.append(CallSession.status == status)
    if agent_type:
        filters.append(CallSession.agent_type == agent_type)
    if outcome:
        filters.append(CallSession.outcome == outcome)
    if date_from:
        filters.append(CallSession.created_at >= date_from)
    if date_to:
        filters.append(CallSession.created_at <= date_to)

    base_query = (
        select(
            CallSession,
            Customer.name.label("customer_name"),
        )
        .join(Customer, CallSession.customer_id == Customer.id)
    )
    if filters:
        base_query = base_query.where(and_(*filters))

    count_query = select(func.count()).select_from(
        select(CallSession.id).join(Customer, CallSession.customer_id == Customer.id)
        .where(and_(*filters) if filters else True)
        .subquery()
    )
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    offset = (page - 1) * limit
    result = await db.execute(
        base_query.order_by(CallSession.created_at.desc()).offset(offset).limit(limit)
    )
    rows = result.all()

    items = []
    for row in rows:
        session = row[0]
        customer_name = row[1]
        data = {
            "id": session.id,
            "customer_id": session.customer_id,
            "campaign_id": session.campaign_id,
            "agent_type": session.agent_type,
            "flow_id": session.flow_id,
            "tier": session.tier,
            "status": session.status,
            "start_time": session.start_time.isoformat() if session.start_time else None,
            "end_time": session.end_time.isoformat() if session.end_time else None,
            "duration_seconds": session.duration_seconds,
            "outcome": session.outcome,
            "commitment_amount": str(session.commitment_amount) if session.commitment_amount else None,
            "commitment_date": session.commitment_date.isoformat() if session.commitment_date else None,
            "payment_made": session.payment_made,
            "payment_amount": str(session.payment_amount) if session.payment_amount else None,
            "receipt_confirmed": session.receipt_confirmed,
            "notes": session.notes,
            "created_at": session.created_at.isoformat() if session.created_at else None,
            "customer_name": customer_name,
        }
        items.append(data)

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        pages=math.ceil(total / limit) if total > 0 else 1,
    )


# ─────────────────────────── Get Conversation Detail ─────────────────────

@router.get("/{session_id}", response_model=Dict[str, Any])
async def get_conversation(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CallSession, Customer.name.label("customer_name"), Customer.phone.label("customer_phone"))
        .join(Customer, CallSession.customer_id == Customer.id)
        .where(CallSession.id == session_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Conversation not found")

    session = row[0]
    customer_name = row[1]
    customer_phone = row[2]

    # Transcripts
    transcripts_result = await db.execute(
        select(Transcript)
        .where(Transcript.session_id == session_id)
        .order_by(Transcript.turn_index.asc(), Transcript.timestamp.asc())
    )
    transcripts = transcripts_result.scalars().all()

    # Metrics
    metrics_result = await db.execute(
        select(SessionMetrics).where(SessionMetrics.session_id == session_id)
    )
    metrics = metrics_result.scalar_one_or_none()

    return {
        "id": session.id,
        "customer_id": session.customer_id,
        "customer_name": customer_name,
        "customer_phone": customer_phone,
        "campaign_id": session.campaign_id,
        "agent_type": session.agent_type,
        "flow_id": session.flow_id,
        "tier": session.tier,
        "status": session.status,
        "start_time": session.start_time.isoformat() if session.start_time else None,
        "end_time": session.end_time.isoformat() if session.end_time else None,
        "duration_seconds": session.duration_seconds,
        "outcome": session.outcome,
        "commitment_amount": str(session.commitment_amount) if session.commitment_amount else None,
        "commitment_date": session.commitment_date.isoformat() if session.commitment_date else None,
        "payment_made": session.payment_made,
        "payment_amount": str(session.payment_amount) if session.payment_amount else None,
        "receipt_confirmed": session.receipt_confirmed,
        "notes": session.notes,
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "transcripts": [
            {
                "id": t.id,
                "speaker": t.speaker,
                "text": t.text,
                "timestamp": t.timestamp.isoformat() if t.timestamp else None,
                "confidence": t.confidence,
                "language": t.language,
                "turn_index": t.turn_index,
            }
            for t in transcripts
        ],
        "metrics": {
            "stt_latency_ms": metrics.stt_latency_ms,
            "llm_latency_ms": metrics.llm_latency_ms,
            "tts_latency_ms": metrics.tts_latency_ms,
            "total_latency_ms": metrics.total_latency_ms,
            "tokens_input": metrics.tokens_input,
            "tokens_output": metrics.tokens_output,
            "cost_usd": str(metrics.cost_usd) if metrics.cost_usd else None,
            "ttfb_ms": metrics.ttfb_ms,
            "audio_duration_ms": metrics.audio_duration_ms,
        } if metrics else None,
    }


# ─────────────────────────── Get Transcript ──────────────────────────────

@router.get("/{session_id}/transcript", response_model=List[Dict[str, Any]])
async def get_transcript(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    # Verify session exists
    session_result = await db.execute(
        select(CallSession.id).where(CallSession.id == session_id)
    )
    if not session_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session not found")

    result = await db.execute(
        select(Transcript)
        .where(Transcript.session_id == session_id)
        .order_by(Transcript.turn_index.asc(), Transcript.timestamp.asc())
    )
    transcripts = result.scalars().all()

    return [
        {
            "id": t.id,
            "session_id": t.session_id,
            "speaker": t.speaker,
            "text": t.text,
            "timestamp": t.timestamp.isoformat() if t.timestamp else None,
            "confidence": t.confidence,
            "language": t.language,
            "turn_index": t.turn_index,
        }
        for t in transcripts
    ]


# ─────────────────────────── Get Metrics ─────────────────────────────────

@router.get("/{session_id}/metrics", response_model=Dict[str, Any])
async def get_session_metrics(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    # Verify session exists
    session_result = await db.execute(
        select(CallSession.id).where(CallSession.id == session_id)
    )
    if not session_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session not found")

    result = await db.execute(
        select(SessionMetrics).where(SessionMetrics.session_id == session_id)
    )
    metrics = result.scalar_one_or_none()

    if not metrics:
        raise HTTPException(status_code=404, detail="Metrics not found for this session")

    return {
        "id": metrics.id,
        "session_id": metrics.session_id,
        "stt_latency_ms": metrics.stt_latency_ms,
        "llm_latency_ms": metrics.llm_latency_ms,
        "tts_latency_ms": metrics.tts_latency_ms,
        "total_latency_ms": metrics.total_latency_ms,
        "tokens_input": metrics.tokens_input,
        "tokens_output": metrics.tokens_output,
        "cost_usd": str(metrics.cost_usd) if metrics.cost_usd else None,
        "ttfb_ms": metrics.ttfb_ms,
        "audio_duration_ms": metrics.audio_duration_ms,
        "created_at": metrics.created_at.isoformat() if metrics.created_at else None,
    }


# ─────────────────────────── Delete Conversation ─────────────────────────

@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CallSession).where(CallSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    await db.delete(session)
    await db.flush()
