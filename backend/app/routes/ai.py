import os
import anthropic
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone, timedelta

from app.database import get_db
from app.models import User, Monitor, Check, Analysis, CheckStatus
from app.auth import get_current_user
from app.schemas import AnalysisResponse

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

router = APIRouter()


def build_summary(checks) -> str:
    # Summarizes one monitor's last 7 days into plain text for Claude
    if not checks:
        return "No check data available."
    up = sum(1 for c in checks if c.status == CheckStatus.UP)
    down = sum(1 for c in checks if c.status == CheckStatus.DOWN)
    slow = sum(1 for c in checks if c.status == CheckStatus.SLOW)
    times = [c.response_time_ms for c in checks if c.response_time_ms]
    avg = round(sum(times) / len(times), 1) if times else 0
    return (
        f"Total checks: {len(checks)}. "
        f"UP: {up}, DOWN: {down}, SLOW: {slow}. "
        f"Average response time: {avg}ms."
    )


def build_cross_summary(monitors, db) -> str:
    # Summarizes all the user's other monitors for cross-comparison context
    lines = []
    for m in monitors:
        recent = db.query(Check).filter(
            Check.monitor_id == m.id,
            Check.response_time_ms != None
        ).order_by(Check.checked_at.desc()).limit(20).all()
        if recent:
            avg = round(
                sum(c.response_time_ms for c in recent) / len(recent), 1
            )
            lines.append(f"{m.url}: avg {avg}ms")
    return "\n".join(lines) if lines else "No other monitor data."


@router.get("/{monitor_id}/analyze")
def analyze_monitor(
    monitor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Users can only analyze their own monitors
    monitor = db.query(Monitor).filter(
        Monitor.id == monitor_id,
        Monitor.user_id == current_user.id
    ).first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    # Rate limit: once per monitor per hour
    last = db.query(Analysis).filter(
        Analysis.monitor_id == monitor_id
    ).order_by(Analysis.created_at.desc()).first()

    if last:
        last_created = last.created_at

        if last_created.tzinfo is None:
            last_created = last_created.replace(tzinfo=timezone.utc)
        if last_created > datetime.now(timezone.utc) - timedelta(minutes=1):
            raise HTTPException(
                status_code=429,
                detail="Rate limit: once per hour per monitor"
            )

    # Pull last 7 days of check data for this monitor
    since = datetime.now(timezone.utc) - timedelta(days=7)
    checks = db.query(Check).filter(
        Check.monitor_id == monitor_id,
        Check.checked_at >= since
    ).all()

    # Build context strings for Claude
    summary = build_summary(checks)
    all_monitors = db.query(Monitor).filter(
        Monitor.user_id == current_user.id,
        Monitor.id != monitor_id  # exclude the monitor being analyzed
    ).all()
    cross_summary = build_cross_summary(all_monitors, db)

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=200,
        messages=[{
            "role": "user",
            "content": (
                f"Analyze this uptime data. Compare against the user's other monitors "
                f"and give a 3-sentence plain English summary including patterns:\n"
                f"{summary}\n\nOther monitors:\n{cross_summary}"
            )
        }]
    )

    result_text = response.content[0].text

    analysis = Analysis(monitor_id=monitor_id, summary_text=result_text)
    db.add(analysis)
    db.commit()

    return {"analysis": result_text}


@router.get("/{monitor_id}/analyses", response_model=List[AnalysisResponse])
def get_analyses(
    monitor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Returns analysis history for this monitor
    monitor = db.query(Monitor).filter(
        Monitor.id == monitor_id,
        Monitor.user_id == current_user.id
    ).first()
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    analyses = db.query(Analysis).filter(
        Analysis.monitor_id == monitor_id
    ).order_by(Analysis.created_at.desc()).all()

    return analyses