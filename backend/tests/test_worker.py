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
    # Normal response times around 200ms
    recent = [200.0, 195.0, 205.0, 198.0, 202.0,
              199.0, 201.0, 197.0, 203.0, 200.0]
    # Spike to 900ms — well over 3 standard deviations
    assert detect_anomaly(recent, 900.0) == True


def test_anomaly_detection_needs_minimum_samples():
    # Fewer than 5 samples — should never flag as anomaly
    # because stdev is unreliable with small samples
    recent = [200.0, 195.0, 205.0]
    assert detect_anomaly(recent, 900.0) == False


def test_analyze_endpoint_returns_text(authenticated_client):
    # Create a monitor first
    create = authenticated_client.post("/monitors/", json={
        "url": "https://example.com",
        "interval_minutes": 5
    })
    monitor_id = create.json()["id"]

    # Mock the Claude API call so tests don't hit the real API
    mock_message = MagicMock()
    mock_message.content = [MagicMock(text="This monitor has been reliable.")]

    with patch("app.routes.ai.anthropic") as mock_anthropic:
        mock_anthropic.messages.create.return_value = mock_message
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

    with patch("app.routes.ai.anthropic") as mock_anthropic:
        mock_anthropic.messages.create.return_value = mock_message
        authenticated_client.get(f"/ai/{monitor_id}/analyze")
        # Call again — should be rate limited
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

    # Redis should have been set to UNKNOWN on monitor creation
    # Our mock captures the call — verify set was called with the right key
    redis_client.set.assert_called_with(
        f"status:{monitor_id}", "UNKNOWN"
    )