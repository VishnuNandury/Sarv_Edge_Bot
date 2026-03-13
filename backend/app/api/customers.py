import io
import math
import uuid
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Customer, CallSession
from app.schemas import (
    CustomerCreate, CustomerUpdate, CustomerRead,
    CustomerListItem, PaginatedResponse, UploadResult
)

router = APIRouter(prefix="/api/customers", tags=["customers"])


# ─────────────────────────── List Customers ──────────────────────────────

@router.get("", response_model=PaginatedResponse)
async def list_customers(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    search: Optional[str] = Query(None),
    dpd_min: Optional[int] = Query(None, ge=0),
    dpd_max: Optional[int] = Query(None, ge=0),
    segment: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    filters = []

    if search:
        search_term = f"%{search}%"
        filters.append(
            or_(
                Customer.name.ilike(search_term),
                Customer.phone.ilike(search_term),
                Customer.loan_id.ilike(search_term),
            )
        )
    if dpd_min is not None:
        filters.append(Customer.dpd >= dpd_min)
    if dpd_max is not None:
        filters.append(Customer.dpd <= dpd_max)
    if segment:
        filters.append(Customer.segment == segment)
    if status:
        filters.append(Customer.status == status)
    else:
        filters.append(Customer.status != "inactive")

    base_query = select(Customer)
    if filters:
        base_query = base_query.where(and_(*filters))

    count_result = await db.execute(
        select(func.count()).select_from(base_query.subquery())
    )
    total = count_result.scalar() or 0

    offset = (page - 1) * limit
    result = await db.execute(
        base_query.order_by(Customer.created_at.desc()).offset(offset).limit(limit)
    )
    customers = result.scalars().all()

    items = [CustomerListItem.model_validate(c) for c in customers]

    return PaginatedResponse(
        items=[item.model_dump() for item in items],
        total=total,
        page=page,
        limit=limit,
        pages=math.ceil(total / limit) if total > 0 else 1,
    )


# ─────────────────────────── Create Customer ─────────────────────────────

@router.post("", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
async def create_customer(
    payload: CustomerCreate,
    db: AsyncSession = Depends(get_db),
):
    # Check phone uniqueness
    existing = await db.execute(
        select(Customer).where(Customer.phone == payload.phone)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Customer with phone {payload.phone} already exists."
        )

    customer = Customer(
        id=str(uuid.uuid4()),
        **payload.model_dump(),
    )
    db.add(customer)
    await db.flush()
    await db.refresh(customer)
    return CustomerRead.model_validate(customer)


# ─────────────────────────── Get Customer ────────────────────────────────

@router.get("/{customer_id}", response_model=Dict[str, Any])
async def get_customer(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Fetch call history
    sessions_result = await db.execute(
        select(CallSession)
        .where(CallSession.customer_id == customer_id)
        .order_by(CallSession.created_at.desc())
        .limit(20)
    )
    sessions = sessions_result.scalars().all()

    call_history = [
        {
            "id": s.id,
            "status": s.status,
            "outcome": s.outcome,
            "agent_type": s.agent_type,
            "flow_id": s.flow_id,
            "duration_seconds": s.duration_seconds,
            "commitment_amount": str(s.commitment_amount) if s.commitment_amount else None,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in sessions
    ]

    data = CustomerRead.model_validate(customer).model_dump()
    data["call_history"] = call_history
    return data


# ─────────────────────────── Update Customer ─────────────────────────────

@router.put("/{customer_id}", response_model=CustomerRead)
async def update_customer(
    customer_id: str,
    payload: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    update_data = payload.model_dump(exclude_unset=True)

    # Check phone uniqueness if being changed
    if "phone" in update_data and update_data["phone"] != customer.phone:
        existing = await db.execute(
            select(Customer).where(
                and_(Customer.phone == update_data["phone"], Customer.id != customer_id)
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Phone {update_data['phone']} already in use."
            )

    for key, value in update_data.items():
        setattr(customer, key, value)

    customer.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(customer)
    return CustomerRead.model_validate(customer)


# ─────────────────────────── Delete Customer ─────────────────────────────

@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    customer.status = "inactive"
    customer.updated_at = datetime.now(timezone.utc)
    await db.flush()


# ─────────────────────────── Upload Customers ────────────────────────────

@router.post("/upload", response_model=UploadResult, status_code=status.HTTP_201_CREATED)
async def upload_customers(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    ALLOWED_TYPES = {
        "text/csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }

    content_type = file.content_type or ""
    filename = file.filename or ""

    if content_type not in ALLOWED_TYPES and not (
        filename.endswith(".csv") or filename.endswith(".xlsx") or filename.endswith(".xls")
    ):
        raise HTTPException(
            status_code=400,
            detail="Only CSV and Excel files are supported."
        )

    contents = await file.read()

    try:
        if filename.endswith(".csv") or content_type == "text/csv":
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {str(e)}")

    REQUIRED_COLUMNS = {"name", "phone"}
    missing = REQUIRED_COLUMNS - set(df.columns.str.lower())
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required columns: {missing}"
        )

    # Normalize column names
    df.columns = df.columns.str.lower().str.strip()

    success_count = 0
    error_count = 0
    errors: List[Dict[str, Any]] = []
    created_ids: List[str] = []

    for idx, row in df.iterrows():
        row_num = int(idx) + 2  # 1-indexed, header is row 1

        try:
            name = str(row.get("name", "")).strip()
            phone = str(row.get("phone", "")).strip()

            if not name or not phone:
                raise ValueError("name and phone are required")

            # Parse optional fields
            def safe_decimal(val, default="0"):
                try:
                    return Decimal(str(val)) if pd.notna(val) else Decimal(default)
                except (InvalidOperation, TypeError):
                    return Decimal(default)

            def safe_int(val, default=0):
                try:
                    return int(val) if pd.notna(val) else default
                except (ValueError, TypeError):
                    return default

            def safe_str(val, default=None):
                if pd.isna(val) if hasattr(val, '__class__') else val is None:
                    return default
                v = str(val).strip()
                return v if v and v.lower() != "nan" else default

            due_date = None
            if "due_date" in row and pd.notna(row["due_date"]):
                try:
                    due_date = pd.to_datetime(row["due_date"]).date()
                except Exception:
                    due_date = None

            segment = safe_str(row.get("segment"), "standard")
            if segment not in {"prime", "standard", "risky"}:
                segment = "standard"

            # Check phone uniqueness
            existing = await db.execute(
                select(Customer).where(Customer.phone == phone)
            )
            if existing.scalar_one_or_none():
                errors.append({"row": row_num, "phone": phone, "error": "Phone already exists"})
                error_count += 1
                continue

            customer = Customer(
                id=str(uuid.uuid4()),
                name=name,
                phone=phone,
                email=safe_str(row.get("email")),
                loan_amount=safe_decimal(row.get("loan_amount"), "0"),
                outstanding_amount=safe_decimal(row.get("outstanding_amount"), "0"),
                dpd=safe_int(row.get("dpd"), 0),
                due_date=due_date,
                loan_id=safe_str(row.get("loan_id")),
                segment=segment,
                preferred_language=safe_str(row.get("preferred_language"), "hindi"),
                status="active",
                tags=[],
                address=safe_str(row.get("address")),
            )
            db.add(customer)
            await db.flush()
            created_ids.append(customer.id)
            success_count += 1

        except Exception as e:
            errors.append({"row": row_num, "error": str(e)})
            error_count += 1
            await db.rollback()

    return UploadResult(
        success_count=success_count,
        error_count=error_count,
        errors=errors,
        created_ids=created_ids,
    )
