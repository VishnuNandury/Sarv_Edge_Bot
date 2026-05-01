"""Auth API: login, signup, current user."""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
_oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)
_ALGORITHM = "HS256"
_EXPIRE_DAYS = 7


def make_token(user_id: str, username: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=_EXPIRE_DAYS)
    return jwt.encode(
        {"sub": user_id, "username": username, "exp": exp},
        settings.SECRET_KEY,
        algorithm=_ALGORITHM,
    )


def _user_dict(user: User) -> Dict[str, Any]:
    return {"id": user.id, "username": user.username, "email": user.email, "phone": user.phone}


class LoginIn(BaseModel):
    username: str
    password: str


class SignupIn(BaseModel):
    username: str
    email: str
    phone: Optional[str] = None
    password: str
    confirm_password: str


@router.post("/login")
async def login(payload: LoginIn, db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    result = await db.execute(select(User).where(User.username == payload.username))
    user = result.scalar_one_or_none()
    if not user or not _pwd.verify(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {
        "access_token": make_token(user.id, user.username),
        "token_type": "bearer",
        "user": _user_dict(user),
    }


@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(payload: SignupIn, db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    dup = await db.execute(select(User).where(User.username == payload.username))
    if dup.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already taken")

    dup_email = await db.execute(select(User).where(User.email == payload.email))
    if dup_email.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        id=str(uuid.uuid4()),
        username=payload.username,
        email=payload.email,
        phone=payload.phone,
        password_hash=_pwd.hash(payload.password),
    )
    db.add(user)
    await db.flush()

    return {
        "access_token": make_token(user.id, user.username),
        "token_type": "bearer",
        "user": _user_dict(user),
    }


@router.get("/me")
async def me(token: str = Depends(_oauth2), db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[_ALGORITHM])
        user_id: str = payload.get("sub", "")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return _user_dict(user)
