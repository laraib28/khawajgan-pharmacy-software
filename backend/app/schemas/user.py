from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    email: str
    full_name: str
    role: str
    auth_provider: str
    profile_picture_url: Optional[str] = None
    is_active: bool
    created_at: datetime


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=1, max_length=255)
    role: str = Field(default="cashier", pattern="^(owner|manager|cashier)$")


class LoginIn(BaseModel):
    email: EmailStr
    password: str
