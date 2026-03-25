from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db, redis_client
from app.models import Monitor, Check
from app.auth import get_current_user
from app.schemas import MonitorCreate, MonitorUpdate, MonitorResponse
from app.models import User
from app.scheduler import scheduler
from app.worker import register_monitor_job, remove_monitor_job

router = APIRouter()


@router.post("/", response_model=MonitorResponse, status_code=status.HTTP_201_CREATED)
def create_monitor(
    monitor_data: MonitorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_monitor = Monitor(
        user_id=current_user.id,
        url=str(monitor_data.url),
        interval_minutes=monitor_data.interval_minutes
    )
    db.add(new_monitor)
    db.commit()
    db.refresh(new_monitor)

    register_monitor_job(scheduler, new_monitor.id, new_monitor.interval_minutes)

    # Cache initial status in Redis
    redis_client.set(f"status:{new_monitor.id}", "UNKNOWN")

    return new_monitor


@router.get("/", response_model=List[MonitorResponse])
def get_monitors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Filter by user_id
    monitors = db.query(Monitor).filter(
        Monitor.user_id == current_user.id
    ).all()

    return monitors


@router.get("/{monitor_id}", response_model=MonitorResponse)
def get_monitor(
    monitor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    monitor = db.query(Monitor).filter(
        Monitor.id == monitor_id,
        Monitor.user_id == current_user.id
    ).first()

    if not monitor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Monitor not found"
        )
    return monitor


@router.patch("/{monitor_id}", response_model=MonitorResponse)
def update_monitor(
    monitor_id: int,
    update_data: MonitorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    monitor = db.query(Monitor).filter(
        Monitor.id == monitor_id,
        Monitor.user_id == current_user.id
    ).first()

    if not monitor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Monitor not found"
        )

    # Only update fields that were actually provided in the request
    update_fields = update_data.model_dump(exclude_unset=True)
    for field, value in update_fields.items():
        setattr(monitor, field, value)

    db.commit()
    db.refresh(monitor)
    return monitor


@router.delete("/{monitor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_monitor(
    monitor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    monitor = db.query(Monitor).filter(
        Monitor.id == monitor_id,
        Monitor.user_id == current_user.id
    ).first()

    if not monitor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Monitor not found"
        )

    # Delete the Redis cache entry for this monitor
    redis_client.delete(f"status:{monitor_id}")

    remove_monitor_job(scheduler, monitor_id)

    db.delete(monitor)
    db.commit()


@router.post("/{monitor_id}/pause", response_model=MonitorResponse)
def pause_monitor(
    monitor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    monitor = db.query(Monitor).filter(
        Monitor.id == monitor_id,
        Monitor.user_id == current_user.id
    ).first()

    if not monitor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Monitor not found"
        )

    # Toggle: if active pause it, if paused resume it
    monitor.is_active = not monitor.is_active
    db.commit()
    db.refresh(monitor)

    # Register or remove the scheduled job based on new state
    if monitor.is_active:
        register_monitor_job(scheduler, monitor_id, monitor.interval_minutes)
    else:
        remove_monitor_job(scheduler, monitor_id)


    # Update Redis cache to reflect paused state
    status_value = "PAUSED" if not monitor.is_active else "UNKNOWN"
    redis_client.set(f"status:{monitor_id}", status_value)

    return monitor


@router.get("/{monitor_id}/status")
def get_monitor_status(
    monitor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify ownership first
    monitor = db.query(Monitor).filter(
        Monitor.id == monitor_id,
        Monitor.user_id == current_user.id
    ).first()

    if not monitor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Monitor not found"
        )

    # Read from Redis cache
    cached_status = redis_client.get(f"status:{monitor_id}")

    # Fall back to database if cache is empty for any reason
    if not cached_status:
        latest_check = db.query(Check).filter(
            Check.monitor_id == monitor_id
        ).order_by(Check.checked_at.desc()).first()
        cached_status = latest_check.status if latest_check else "UNKNOWN"

        redis_client.set(f"status:{monitor_id}", cached_status)

    return {"monitor_id": monitor_id, "status": cached_status}