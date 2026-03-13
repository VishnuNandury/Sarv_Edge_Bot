from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import CallSession, SessionMetrics, Customer

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _since(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


# ─────────────────────────── Overview KPIs ───────────────────────────────

@router.get("/overview")
async def analytics_overview(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    since = _since(days)

    result = await db.execute(
        select(
            func.count(CallSession.id).label("total_calls"),
            func.sum(
                case((CallSession.status == "completed", 1), else_=0)
            ).label("total_connected"),
            func.sum(
                case((CallSession.outcome == "commitment", 1), else_=0)
            ).label("total_committed"),
            func.coalesce(func.sum(CallSession.commitment_amount), 0).label("total_commitment_amount"),
            func.avg(CallSession.duration_seconds).label("avg_duration"),
        ).where(CallSession.created_at >= since)
    )
    row = result.fetchone()

    total_calls = row.total_calls or 0
    total_connected = row.total_connected or 0
    total_committed = row.total_committed or 0
    total_commitment_amount = Decimal(str(row.total_commitment_amount or 0))
    avg_duration = float(row.avg_duration or 0)

    connection_rate = round((total_connected / total_calls * 100) if total_calls > 0 else 0.0, 2)
    commitment_rate = round((total_committed / total_connected * 100) if total_connected > 0 else 0.0, 2)

    # Cost summary
    cost_result = await db.execute(
        select(func.coalesce(func.sum(SessionMetrics.cost_usd), 0)).join(
            CallSession, SessionMetrics.session_id == CallSession.id
        ).where(CallSession.created_at >= since)
    )
    total_cost = Decimal(str(cost_result.scalar() or 0))

    # By agent type breakdown
    agent_result = await db.execute(
        select(
            CallSession.agent_type,
            func.count(CallSession.id).label("count"),
            func.sum(case((CallSession.outcome == "commitment", 1), else_=0)).label("committed"),
            func.avg(CallSession.duration_seconds).label("avg_duration"),
        ).where(CallSession.created_at >= since)
        .group_by(CallSession.agent_type)
    )
    agent_rows = agent_result.fetchall()
    by_agent = {
        row.agent_type: {
            "count": row.count,
            "committed": row.committed or 0,
            "avg_duration": float(row.avg_duration or 0),
        }
        for row in agent_rows
    }

    return {
        "period_days": days,
        "total_calls": total_calls,
        "total_connected": total_connected,
        "total_committed": total_committed,
        "total_commitment_amount": str(total_commitment_amount),
        "connection_rate": connection_rate,
        "commitment_rate": commitment_rate,
        "avg_call_duration": round(avg_duration, 2),
        "total_cost_usd": str(total_cost),
        "by_agent": by_agent,
    }


# ─────────────────────────── Calls Over Time ─────────────────────────────

@router.get("/calls")
async def analytics_calls(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    since = _since(days)

    # Daily breakdown
    daily_result = await db.execute(
        select(
            func.date_trunc("day", CallSession.created_at).label("day"),
            func.count(CallSession.id).label("total"),
            func.sum(case((CallSession.status == "completed", 1), else_=0)).label("connected"),
            func.sum(case((CallSession.outcome == "commitment", 1), else_=0)).label("committed"),
        ).where(CallSession.created_at >= since)
        .group_by(func.date_trunc("day", CallSession.created_at))
        .order_by(func.date_trunc("day", CallSession.created_at))
    )
    daily_rows = daily_result.fetchall()
    by_day = [
        {
            "date": row.day.strftime("%Y-%m-%d") if row.day else None,
            "total": row.total,
            "connected": row.connected or 0,
            "committed": row.committed or 0,
        }
        for row in daily_rows
    ]

    # Hourly breakdown (last 7 days)
    since_7d = _since(min(days, 7))
    hourly_result = await db.execute(
        select(
            func.extract("hour", CallSession.created_at).label("hour"),
            func.count(CallSession.id).label("count"),
        ).where(CallSession.created_at >= since_7d)
        .group_by(func.extract("hour", CallSession.created_at))
        .order_by(func.extract("hour", CallSession.created_at))
    )
    hourly_rows = hourly_result.fetchall()
    by_hour = [{"hour": int(row.hour), "count": row.count} for row in hourly_rows]

    return {
        "period_days": days,
        "by_day": by_day,
        "by_hour": by_hour,
    }


# ─────────────────────────── Outcome Breakdown ───────────────────────────

@router.get("/outcomes")
async def analytics_outcomes(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    since = _since(days)

    result = await db.execute(
        select(
            CallSession.outcome,
            func.count(CallSession.id).label("count"),
            func.coalesce(func.sum(CallSession.commitment_amount), 0).label("total_amount"),
        ).where(
            and_(CallSession.created_at >= since, CallSession.outcome.isnot(None))
        ).group_by(CallSession.outcome)
        .order_by(func.count(CallSession.id).desc())
    )
    rows = result.fetchall()

    outcomes = [
        {
            "outcome": row.outcome,
            "count": row.count,
            "total_commitment_amount": str(Decimal(str(row.total_amount))),
        }
        for row in rows
    ]

    # No-outcome calls
    no_outcome_result = await db.execute(
        select(func.count(CallSession.id)).where(
            and_(CallSession.created_at >= since, CallSession.outcome.is_(None))
        )
    )
    no_outcome = no_outcome_result.scalar() or 0

    return {
        "period_days": days,
        "outcomes": outcomes,
        "no_outcome_count": no_outcome,
    }


# ─────────────────────────── Agent Comparison ────────────────────────────

@router.get("/agents")
async def analytics_agents(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    since = _since(days)

    result = await db.execute(
        select(
            CallSession.agent_type,
            func.count(CallSession.id).label("total_calls"),
            func.sum(case((CallSession.status == "completed", 1), else_=0)).label("connected"),
            func.sum(case((CallSession.outcome == "commitment", 1), else_=0)).label("committed"),
            func.avg(CallSession.duration_seconds).label("avg_duration"),
            func.coalesce(func.sum(CallSession.commitment_amount), 0).label("total_committed_amount"),
        ).where(CallSession.created_at >= since)
        .group_by(CallSession.agent_type)
    )
    rows = result.fetchall()

    agents = {}
    for row in rows:
        total = row.total_calls or 0
        connected = row.connected or 0
        committed = row.committed or 0
        agents[row.agent_type] = {
            "total_calls": total,
            "connected": connected,
            "committed": committed,
            "avg_duration_seconds": float(row.avg_duration or 0),
            "total_committed_amount": str(Decimal(str(row.total_committed_amount))),
            "connection_rate": round((connected / total * 100) if total > 0 else 0, 2),
            "commitment_rate": round((committed / connected * 100) if connected > 0 else 0, 2),
        }

    # Latency comparison
    latency_result = await db.execute(
        select(
            CallSession.agent_type,
            func.avg(SessionMetrics.stt_latency_ms).label("avg_stt"),
            func.avg(SessionMetrics.llm_latency_ms).label("avg_llm"),
            func.avg(SessionMetrics.tts_latency_ms).label("avg_tts"),
            func.avg(SessionMetrics.total_latency_ms).label("avg_total"),
        ).join(SessionMetrics, SessionMetrics.session_id == CallSession.id)
        .where(CallSession.created_at >= since)
        .group_by(CallSession.agent_type)
    )
    latency_rows = latency_result.fetchall()

    for row in latency_rows:
        if row.agent_type in agents:
            agents[row.agent_type]["avg_latency"] = {
                "stt_ms": round(float(row.avg_stt or 0), 2),
                "llm_ms": round(float(row.avg_llm or 0), 2),
                "tts_ms": round(float(row.avg_tts or 0), 2),
                "total_ms": round(float(row.avg_total or 0), 2),
            }

    return {
        "period_days": days,
        "agents": agents,
    }


# ─────────────────────────── Flow Performance ────────────────────────────

@router.get("/flows")
async def analytics_flows(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    since = _since(days)

    result = await db.execute(
        select(
            CallSession.flow_id,
            func.count(CallSession.id).label("total_calls"),
            func.sum(case((CallSession.outcome == "commitment", 1), else_=0)).label("committed"),
            func.avg(CallSession.duration_seconds).label("avg_duration"),
            func.coalesce(func.sum(CallSession.commitment_amount), 0).label("total_committed_amount"),
        ).where(CallSession.created_at >= since)
        .group_by(CallSession.flow_id)
    )
    rows = result.fetchall()

    flows = {}
    for row in rows:
        total = row.total_calls or 0
        committed = row.committed or 0
        flows[row.flow_id] = {
            "total_calls": total,
            "committed": committed,
            "avg_duration_seconds": float(row.avg_duration or 0),
            "total_committed_amount": str(Decimal(str(row.total_committed_amount))),
            "commitment_rate": round((committed / total * 100) if total > 0 else 0, 2),
        }

    return {
        "period_days": days,
        "flows": flows,
    }


# ─────────────────────────── Latency Trends ──────────────────────────────

@router.get("/latency")
async def analytics_latency(
    days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    since = _since(days)

    # Daily averages
    result = await db.execute(
        select(
            func.date_trunc("day", CallSession.created_at).label("day"),
            CallSession.agent_type,
            func.avg(SessionMetrics.stt_latency_ms).label("avg_stt"),
            func.avg(SessionMetrics.llm_latency_ms).label("avg_llm"),
            func.avg(SessionMetrics.tts_latency_ms).label("avg_tts"),
            func.avg(SessionMetrics.total_latency_ms).label("avg_total"),
            func.avg(SessionMetrics.ttfb_ms).label("avg_ttfb"),
            func.count(SessionMetrics.id).label("sample_count"),
        ).join(CallSession, SessionMetrics.session_id == CallSession.id)
        .where(CallSession.created_at >= since)
        .group_by(
            func.date_trunc("day", CallSession.created_at),
            CallSession.agent_type
        )
        .order_by(func.date_trunc("day", CallSession.created_at))
    )
    rows = result.fetchall()

    by_day = [
        {
            "date": row.day.strftime("%Y-%m-%d") if row.day else None,
            "agent_type": row.agent_type,
            "avg_stt_ms": round(float(row.avg_stt or 0), 2),
            "avg_llm_ms": round(float(row.avg_llm or 0), 2),
            "avg_tts_ms": round(float(row.avg_tts or 0), 2),
            "avg_total_ms": round(float(row.avg_total or 0), 2),
            "avg_ttfb_ms": round(float(row.avg_ttfb or 0), 2),
            "sample_count": row.sample_count,
        }
        for row in rows
    ]

    # Overall stats
    overall_result = await db.execute(
        select(
            func.avg(SessionMetrics.stt_latency_ms).label("avg_stt"),
            func.avg(SessionMetrics.llm_latency_ms).label("avg_llm"),
            func.avg(SessionMetrics.tts_latency_ms).label("avg_tts"),
            func.avg(SessionMetrics.total_latency_ms).label("avg_total"),
            func.min(SessionMetrics.total_latency_ms).label("min_total"),
            func.max(SessionMetrics.total_latency_ms).label("max_total"),
            func.percentile_cont(0.95).within_group(SessionMetrics.total_latency_ms).label("p95_total"),
        ).join(CallSession, SessionMetrics.session_id == CallSession.id)
        .where(CallSession.created_at >= since)
    )
    overall = overall_result.fetchone()

    return {
        "period_days": days,
        "by_day": by_day,
        "overall": {
            "avg_stt_ms": round(float(overall.avg_stt or 0), 2),
            "avg_llm_ms": round(float(overall.avg_llm or 0), 2),
            "avg_tts_ms": round(float(overall.avg_tts or 0), 2),
            "avg_total_ms": round(float(overall.avg_total or 0), 2),
            "min_total_ms": round(float(overall.min_total or 0), 2),
            "max_total_ms": round(float(overall.max_total or 0), 2),
            "p95_total_ms": round(float(overall.p95_total or 0), 2),
        },
    }
