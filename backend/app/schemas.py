from pydantic import BaseModel, HttpUrl, field_validator
from datetime import datetime
from typing import Optional
from app.models import UserRole, CheckStatus, AlertType


# User schemas

class UserCreate(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    role: UserRole
    created_at: datetime

    model_config = {"from_attributes": True}


# Auth schemas

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshRequest(BaseModel):
    refresh_token: str


# Monitor schemas

class MonitorCreate(BaseModel):
    url: HttpUrl
    interval_minutes: int = 5

    @field_validator("interval_minutes")
    @classmethod
    def validate_interval(cls, v):
        if v not in [1, 5, 10]:
            raise ValueError("interval_minutes must be 1, 5, or 10")
        return v

class MonitorUpdate(BaseModel):
    is_active: Optional[bool] = None
    interval_minutes: Optional[int] = None

    @field_validator("interval_minutes")
    @classmethod
    def validate_interval(cls, v):
        if v is not None and v not in [1, 5, 10]:
            raise ValueError("interval_minutes must be 1, 5, or 10")
        return v

class MonitorResponse(BaseModel):
    id: int
    user_id: int
    url: str
    interval_minutes: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# Check schemas

class CheckResponse(BaseModel):
    id: int
    monitor_id: int
    checked_at: datetime
    status: CheckStatus
    response_time_ms: Optional[float] = None

    model_config = {"from_attributes": True}


# Alert schemas

class AlertResponse(BaseModel):
    id: int
    monitor_id: int
    triggered_at: datetime
    resolved_at: Optional[datetime] = None
    type: AlertType

    model_config = {"from_attributes": True}


# Analysis schemas

class AnalysisResponse(BaseModel):
    id: int
    monitor_id: int
    created_at: datetime
    summary_text: str

    model_config = {"from_attributes": True}
