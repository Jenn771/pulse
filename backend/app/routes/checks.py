from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone, timedelta

from app.database import get_db
from app.models import Monitor, Check, Alert
from app.auth import get_current_user
from app.schemas import CheckResponse, AlertResponse
from app.models import User

router = APIRouter()


@router.get("/{monitor_id}/checks", response_model=List[CheckResponse])
def get_checks(
    monitor_id: int,
    hours: int = Query(default=24, ge=1, le=720),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Ownership check
    monitor = db.query(Monitor).filter(
        Monitor.id == monitor_id,
        Monitor.user_id == current_user.id
    ).first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    checks = db.query(Check).filter(
        Check.monitor_id == monitor_id,
        Check.checked_at >= since
    ).order_by(Check.checked_at.desc()).all()

    return checks


@router.get("/{monitor_id}/uptime")
def get_uptime(
    monitor_id: int,
    days: int = Query(default=30, ge=1, le=90),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    monitor = db.query(Monitor).filter(
        Monitor.id == monitor_id,
        Monitor.user_id == current_user.id
    ).first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    since = datetime.now(timezone.utc) - timedelta(days=days)
    checks = db.query(Check).filter(
        Check.monitor_id == monitor_id,
        Check.checked_at >= since
    ).all()

    if not checks:
        return {"monitor_id": monitor_id, "uptime_percent": None, "total_checks": 0}

    # UP and SLOW both count as "up" for uptime calculation
    # Only DOWN counts as an outage
    up_count = sum(1 for c in checks if c.status in ["UP", "SLOW"])
    uptime_percent = round((up_count / len(checks)) * 100, 2)

    return {
        "monitor_id": monitor_id,
        "uptime_percent": uptime_percent,
        "total_checks": len(checks),
        "days": days
    }


@router.get("/{monitor_id}/alerts", response_model=List[AlertResponse])
def get_alerts(
    monitor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    monitor = db.query(Monitor).filter(
        Monitor.id == monitor_id,
        Monitor.user_id == current_user.id
    ).first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    alerts = db.query(Alert).filter(
        Alert.monitor_id == monitor_id
    ).order_by(Alert.triggered_at.desc()).all()

    return alerts