import math
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Campaign, CampaignCustomer, CallSession, Customer
from app.schemas import CampaignCreate, CampaignUpdate, CampaignRead, PaginatedResponse

router = APIRouter(prefix="/api/campaigns", tags=["campaigns"])


# ─────────────────────────── List Campaigns ──────────────────────────────

@router.get("", response_model=List[CampaignRead])
async def list_campaigns(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(Campaign)
    if status:
        query = query.where(Campaign.status == status)
    query = query.order_by(Campaign.created_at.desc())

    result = await db.execute(query)
    campaigns = result.scalars().all()
    return [CampaignRead.model_validate(c) for c in campaigns]


# ─────────────────────────── Create Campaign ─────────────────────────────

@router.post("", response_model=CampaignRead, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    payload: CampaignCreate,
    db: AsyncSession = Depends(get_db),
):
    customer_ids = payload.customer_ids or []
    campaign_data = payload.model_dump(exclude={"customer_ids"})

    campaign = Campaign(
        id=str(uuid.uuid4()),
        **campaign_data,
        total_customers=len(customer_ids),
    )
    db.add(campaign)
    await db.flush()

    # Add customer associations
    for cid in customer_ids:
        customer_exists = await db.execute(select(Customer.id).where(Customer.id == cid))
        if customer_exists.scalar_one_or_none():
            assoc = CampaignCustomer(
                campaign_id=campaign.id,
                customer_id=cid,
                status="pending",
            )
            db.add(assoc)

    await db.flush()
    await db.refresh(campaign)
    return CampaignRead.model_validate(campaign)


# ─────────────────────────── Get Campaign Detail ─────────────────────────

@router.get("/{campaign_id}", response_model=Dict[str, Any])
async def get_campaign(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Customer associations with customer details
    assoc_result = await db.execute(
        select(CampaignCustomer, Customer.name, Customer.phone, Customer.dpd, Customer.outstanding_amount)
        .join(Customer, CampaignCustomer.customer_id == Customer.id)
        .where(CampaignCustomer.campaign_id == campaign_id)
        .limit(100)
    )
    assoc_rows = assoc_result.all()

    customers = [
        {
            "customer_id": row[0].customer_id,
            "name": row[1],
            "phone": row[2],
            "dpd": row[3],
            "outstanding_amount": str(row[4]) if row[4] else None,
            "status": row[0].status,
            "session_id": row[0].session_id,
            "scheduled_at": row[0].scheduled_at.isoformat() if row[0].scheduled_at else None,
        }
        for row in assoc_rows
    ]

    data = CampaignRead.model_validate(campaign).model_dump()
    data["customers"] = customers
    return data


# ─────────────────────────── Update Campaign ─────────────────────────────

@router.put("/{campaign_id}", response_model=CampaignRead)
async def update_campaign(
    campaign_id: str,
    payload: CampaignUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(campaign, key, value)

    campaign.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(campaign)
    return CampaignRead.model_validate(campaign)


# ─────────────────────────── Campaign State Actions ──────────────────────

@router.post("/{campaign_id}/start", response_model=CampaignRead)
async def start_campaign(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.status not in {"draft", "paused"}:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot start campaign in status '{campaign.status}'"
        )

    campaign.status = "active"
    campaign.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(campaign)
    return CampaignRead.model_validate(campaign)


@router.post("/{campaign_id}/pause", response_model=CampaignRead)
async def pause_campaign(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.status != "active":
        raise HTTPException(status_code=400, detail="Only active campaigns can be paused")

    campaign.status = "paused"
    campaign.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(campaign)
    return CampaignRead.model_validate(campaign)


@router.post("/{campaign_id}/resume", response_model=CampaignRead)
async def resume_campaign(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.status != "paused":
        raise HTTPException(status_code=400, detail="Only paused campaigns can be resumed")

    campaign.status = "active"
    campaign.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(campaign)
    return CampaignRead.model_validate(campaign)


@router.post("/{campaign_id}/complete", response_model=CampaignRead)
async def complete_campaign(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    campaign.status = "completed"
    campaign.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(campaign)
    return CampaignRead.model_validate(campaign)


# ─────────────────────────── Delete Campaign ─────────────────────────────

@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    await db.delete(campaign)
    await db.flush()


# ─────────────────────────── Campaign Call History ───────────────────────

@router.get("/{campaign_id}/calls", response_model=PaginatedResponse)
async def get_campaign_calls(
    campaign_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    # Verify campaign exists
    campaign_result = await db.execute(
        select(Campaign.id).where(Campaign.id == campaign_id)
    )
    if not campaign_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Campaign not found")

    count_result = await db.execute(
        select(func.count(CallSession.id)).where(CallSession.campaign_id == campaign_id)
    )
    total = count_result.scalar() or 0

    offset = (page - 1) * limit
    result = await db.execute(
        select(CallSession, Customer.name.label("customer_name"), Customer.phone.label("customer_phone"))
        .join(Customer, CallSession.customer_id == Customer.id)
        .where(CallSession.campaign_id == campaign_id)
        .order_by(CallSession.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = result.all()

    items = [
        {
            "id": row[0].id,
            "customer_id": row[0].customer_id,
            "customer_name": row[1],
            "customer_phone": row[2],
            "status": row[0].status,
            "outcome": row[0].outcome,
            "agent_type": row[0].agent_type,
            "duration_seconds": row[0].duration_seconds,
            "commitment_amount": str(row[0].commitment_amount) if row[0].commitment_amount else None,
            "created_at": row[0].created_at.isoformat() if row[0].created_at else None,
        }
        for row in rows
    ]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        pages=math.ceil(total / limit) if total > 0 else 1,
    )
