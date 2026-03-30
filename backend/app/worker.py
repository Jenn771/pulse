import os
import httpx
import statistics
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv
from sqlalchemy.orm import Session

from app.database import SessionLocal, redis_client
from app.models import Monitor, Check, Alert, CheckStatus, AlertType

load_dotenv()

LAMBDA_FUNCTION_URL = os.getenv("LAMBDA_FUNCTION_URL")


# Anomaly detection

def detect_anomaly(recent_response_times: list[float], current: float) -> bool:
    if len(recent_response_times) < 5:
        return False
    avg = statistics.mean(recent_response_times)
    stdev = statistics.stdev(recent_response_times)

    return current > avg + (3 * stdev)


# Lambda trigger

def trigger_lambda_alert(user_email: str, url: str, alert_type: str):
    try:
        response = requests.post(
            LAMBDA_FUNCTION_URL,
            json={
                "email": user_email,
                "url": url,
                "type": alert_type
            },
            timeout=5
        )
        response.raise_for_status()
        print(f"[INFO] Alert sent for {url} — type: {alert_type}")
    except Exception as e:
        print(f"[ERROR] Lambda trigger failed for {url}: {e}")


# Status change detection

def handle_status_change(
    monitor: Monitor,
    new_status: str,
    previous_status: str,
    db: Session,
    response_time_ms: float | None = None,
):
    if new_status in ["DOWN", "SLOW"] and previous_status == "UP":
        # Record the alert in the database
        alert = Alert(
            monitor_id=monitor.id,
            type=AlertType(new_status),
            response_time_ms=response_time_ms,
        )
        db.add(alert)
        db.commit()

        # Get the monitor owner's email for the alert
        user_email = monitor.owner.email
        trigger_lambda_alert(user_email, monitor.url, new_status)

    # When a site comes back UP, resolve any open alerts
    if new_status == "UP" and previous_status in ["DOWN", "SLOW"]:
        open_alert = db.query(Alert).filter(
            Alert.monitor_id == monitor.id,
            Alert.resolved_at == None
        ).first()
        if open_alert:
            open_alert.resolved_at = datetime.now(timezone.utc)
            db.commit()


# Main check function

def check_monitor(monitor_id: int):
    # Each scheduled job call opens its own DB session
    db = SessionLocal()

    try:
        monitor = db.query(Monitor).filter(Monitor.id == monitor_id).first()

        if not monitor or not monitor.is_active:
            return

        previous_status = redis_client.get(f"status:{monitor_id}") or "UNKNOWN"

        # Ping the URL
        try:
            start = datetime.now(timezone.utc)

            response = httpx.get(monitor.url, timeout=10, follow_redirects=True)
            elapsed_ms = (datetime.now(timezone.utc) - start).total_seconds() * 1000


            if response.status_code >= 400:
                new_status = "DOWN"
                elapsed_ms = None
            else:
                # Check for anomaly before deciding UP vs SLOW
                # Pull last 20 response times for this monitor
                recent_checks = db.query(Check).filter(
                    Check.monitor_id == monitor_id,
                    Check.status == CheckStatus.UP,
                    Check.response_time_ms != None
                ).order_by(Check.checked_at.desc()).limit(20).all()

                recent_times = [c.response_time_ms for c in recent_checks]

                if detect_anomaly(recent_times, elapsed_ms):
                    new_status = "SLOW"
                else:
                    new_status = "UP"

        except httpx.TimeoutException:
            new_status = "DOWN"
            elapsed_ms = None
        except httpx.RequestError:
            new_status = "DOWN"
            elapsed_ms = None

        # Save the check result
        check = Check(
            monitor_id=monitor_id,
            status=CheckStatus(new_status),
            response_time_ms=elapsed_ms,
            checked_at=datetime.now(timezone.utc)
        )
        db.add(check)
        db.commit()

        # Update Redis cache
        redis_client.set(f"status:{monitor_id}", new_status)

        # Handle status change alerts
        handle_status_change(
            monitor, new_status, previous_status, db, elapsed_ms
        )

        print(f"[INFO] Checked {monitor.url} — {new_status} ({elapsed_ms}ms)")

    except Exception as e:
        print(f"[ERROR] check_monitor failed for monitor {monitor_id}: {e}")

    finally:
        db.close()


# Job registration

def register_monitor_job(scheduler, monitor_id: int, interval_minutes: int):
    scheduler.add_job(
        check_monitor,
        'interval',
        minutes=interval_minutes,
        args=[monitor_id],
        id=f"monitor_{monitor_id}",
        replace_existing=True
    )


def remove_monitor_job(scheduler, monitor_id: int):
    job_id = f"monitor_{monitor_id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)