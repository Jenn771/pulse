from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum

from app.database import Base

class UserRole(str, enum.Enum):
    user = "user"
    admin = "admin"

class CheckStatus(str, enum.Enum):
    UP = "UP"
    DOWN = "DOWN"
    SLOW = "SLOW"

class AlertType(str, enum.Enum):
    DOWN = "DOWN"
    SLOW = "SLOW"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.user, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    monitors = relationship("Monitor", back_populates="owner", cascade="all, delete")
    refresh_tokens = relationship("RefreshToken", back_populates="owner", cascade="all, delete")


class Monitor(Base):
    __tablename__ = "monitors"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=True)
    url = Column(String, nullable=False)
    interval_minutes = Column(Integer, default=5, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="monitors")
    checks = relationship("Check", back_populates="monitor", cascade="all, delete")
    alerts = relationship("Alert", back_populates="monitor", cascade="all, delete")
    analyses = relationship("Analysis", back_populates="monitor", cascade="all, delete")


class Check(Base):
    __tablename__ = "checks"

    id = Column(Integer, primary_key=True, index=True)
    monitor_id = Column(Integer, ForeignKey("monitors.id"), nullable=False)
    checked_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    status = Column(Enum(CheckStatus), nullable=False)
    # Nullable because a DOWN check has no response time
    response_time_ms = Column(Float, nullable=True)

    monitor = relationship("Monitor", back_populates="checks")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    monitor_id = Column(Integer, ForeignKey("monitors.id"), nullable=False)
    triggered_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    # resolved_at is null until the site comes back up
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    type = Column(Enum(AlertType), nullable=False)
    response_time_ms = Column(Float, nullable=True)

    monitor = relationship("Monitor", back_populates="alerts")


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)
    monitor_id = Column(Integer, ForeignKey("monitors.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    summary_text = Column(String, nullable=False)

    monitor = relationship("Monitor", back_populates="analyses")

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="refresh_tokens")