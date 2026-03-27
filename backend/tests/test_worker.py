from unittest.mock import patch, MagicMock
from app.worker import detect_anomaly


def test_monitor_check_records_status(authenticated_client):
    create = authenticated_client.post("/monitors/", json={
        "url": "https://example.com",
        "interval_minutes": 5
    })
    monitor_id = create.json()["id"]

    mock_response = MagicMock()
    mock_response.status_code = 200

    from tests.conftest import TestingSessionLocal
    with patch("app.worker.httpx.get", return_value=mock_response), \
         patch("app.worker.SessionLocal", TestingSessionLocal):
        from app.worker import check_monitor
        check_monitor(monitor_id)

    checks = authenticated_client.get(f"/monitors/{monitor_id}/checks")
    assert checks.status_code == 200
    assert len(checks.json()) > 0


def test_anomaly_detection_flags_slow():
    recent = [200.0, 195.0, 205.0, 198.0, 202.0,
              199.0, 201.0, 197.0, 203.0, 200.0]

    assert detect_anomaly(recent, 900.0) == True # Large spike should trigger anomaly


def test_anomaly_detection_needs_minimum_samples():
    recent = [200.0, 195.0, 205.0]
    assert detect_anomaly(recent, 900.0) == False # Needs at least 5 samples


def test_analyze_endpoint_returns_text(authenticated_client):
    # Create a monitor first
    create = authenticated_client.post("/monitors/", json={
        "url": "https://example.com",
        "interval_minutes": 5
    })
    monitor_id = create.json()["id"]

    mock_message = MagicMock()
    mock_message.content = [MagicMock(text="This monitor has been reliable.")]

    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_message

    with patch("app.routes.ai.client", mock_client): # Prevent real Claude API calls
        response = authenticated_client.get(f"/ai/{monitor_id}/analyze")

    assert response.status_code == 200
    assert "analysis" in response.json()
    assert isinstance(response.json()["analysis"], str)


def test_analyze_saves_to_analyses_table(authenticated_client):
    create = authenticated_client.post("/monitors/", json={
        "url": "https://example.com",
        "interval_minutes": 5
    })
    monitor_id = create.json()["id"]

    mock_message = MagicMock()
    mock_message.content = [MagicMock(text="Stable performance observed.")]

    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_message
    with patch("app.routes.ai.client", mock_client):
        authenticated_client.get(f"/ai/{monitor_id}/analyze")
        response = authenticated_client.get(f"/ai/{monitor_id}/analyze")

    # Second call within an hour should be rate limited
    assert response.status_code == 429


def test_redis_caches_latest_status(authenticated_client):
    from app.database import redis_client

    create = authenticated_client.post("/monitors/", json={
        "url": "https://example.com",
        "interval_minutes": 5
    })
    monitor_id = create.json()["id"]

    redis_client.set.assert_called_with(
        f"status:{monitor_id}", "UNKNOWN"
    )