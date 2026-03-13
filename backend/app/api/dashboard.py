from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, and_, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Customer, Campaign, CallSession, SessionMetrics

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    day_start_24h = now - timedelta(hours=24)

    # Total customers
    total_customers_result = await db.execute(
        select(func.count(Customer.id)).where(Customer.status != "inactive")
    )
    total_customers = total_customers_result.scalar() or 0

    # Active campaigns
    active_campaigns_result = await db.execute(
        select(func.count(Campaign.id)).where(Campaign.status == "active")
    )
    active_campaigns = active_campaigns_result.scalar() or 0

    # Calls today
    calls_today_result = await db.execute(
        select(func.count(CallSession.id)).where(
            CallSession.created_at >= today_start
        )
    )
    calls_today = calls_today_result.scalar() or 0

    # Calls this week
    calls_week_result = await db.execute(
        select(func.count(CallSession.id)).where(
            CallSession.created_at >= week_start
        )
    )
    calls_this_week = calls_week_result.scalar() or 0

    # Payment rate: committed / called (last 30 days)
    month_start = today_start - timedelta(days=30)
    called_result = await db.execute(
        select(func.count(CallSession.id)).where(
            and_(
                CallSession.created_at >= month_start,
                CallSession.status == "completed"
            )
        )
    )
    total_called = called_result.scalar() or 0

    committed_result = await db.execute(
        select(func.count(CallSession.id)).where(
            and_(
                CallSession.created_at >= month_start,
                CallSession.outcome == "commitment"
            )
        )
    )
    total_committed = committed_result.scalar() or 0

    payment_rate = round((total_committed / total_called * 100) if total_called > 0 else 0.0, 2)

    # Avg call duration
    avg_duration_result = await db.execute(
        select(func.avg(CallSession.duration_seconds)).where(
            and_(
                CallSession.created_at >= month_start,
                CallSession.duration_seconds.isnot(None)
            )
        )
    )
    avg_duration = float(avg_duration_result.scalar() or 0)

    # Total committed today (sum of commitment amounts)
    committed_today_result = await db.execute(
        select(func.coalesce(func.sum(CallSession.commitment_amount), 0)).where(
            and_(
                CallSession.created_at >= today_start,
                CallSession.commitment_amount.isnot(None)
            )
        )
    )
    total_committed_today = Decimal(str(committed_today_result.scalar() or 0))

    # Calls by outcome (last 30 days)
    outcome_result = await db.execute(
        select(
            CallSession.outcome,
            func.count(CallSession.id).label("count")
        ).where(
            and_(
                CallSession.created_at >= month_start,
                CallSession.outcome.isnot(None)
            )
        ).group_by(CallSession.outcome)
    )
    calls_by_outcome = {row.outcome: row.count for row in outcome_result.fetchall()}

    # Recent sessions (last 10) with customer name
    recent_result = await db.execute(
        select(
            CallSession.id,
            CallSession.status,
            CallSession.outcome,
            CallSession.duration_seconds,
            CallSession.agent_type,
            CallSession.flow_id,
            CallSession.created_at,
            CallSession.commitment_amount,
            Customer.name.label("customer_name"),
            Customer.phone.label("customer_phone"),
        )
        .join(Customer, CallSession.customer_id == Customer.id)
        .order_by(CallSession.created_at.desc())
        .limit(10)
    )
    recent_rows = recent_result.fetchall()
    recent_sessions = [
        {
            "id": row.id,
            "status": row.status,
            "outcome": row.outcome,
            "duration_seconds": row.duration_seconds,
            "agent_type": row.agent_type,
            "flow_id": row.flow_id,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "commitment_amount": str(row.commitment_amount) if row.commitment_amount else None,
            "customer_name": row.customer_name,
            "customer_phone": row.customer_phone,
        }
        for row in recent_rows
    ]

    # Hourly calls (last 24 hours)
    hourly_result = await db.execute(
        select(
            func.date_trunc("hour", CallSession.created_at).label("hour"),
            func.count(CallSession.id).label("count")
        ).where(
            CallSession.created_at >= day_start_24h
        ).group_by(
            func.date_trunc("hour", CallSession.created_at)
        ).order_by(
            func.date_trunc("hour", CallSession.created_at)
        )
    )
    hourly_rows = hourly_result.fetchall()
    hourly_calls = [
        {
            "hour": row.hour.isoformat() if row.hour else None,
            "count": row.count
        }
        for row in hourly_rows
    ]

    return {
        "total_customers": total_customers,
        "active_campaigns": active_campaigns,
        "calls_today": calls_today,
        "calls_this_week": calls_this_week,
        "payment_rate": payment_rate,
        "avg_call_duration": round(avg_duration, 2),
        "total_committed_today": total_committed_today,
        "calls_by_outcome": calls_by_outcome,
        "recent_sessions": recent_sessions,
        "hourly_calls": hourly_calls,
    }
