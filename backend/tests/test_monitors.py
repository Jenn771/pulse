def test_add_monitor_authenticated(authenticated_client):
    response = authenticated_client.post("/monitors/", json={
        "url": "https://example.com",
        "interval_minutes": 5
    })
    assert response.status_code == 201
    data = response.json()
    assert data["url"] == "https://example.com/"
    assert data["interval_minutes"] == 5
    assert data["is_active"] == True


def test_add_monitor_unauthenticated(client):
    response = client.post("/monitors/", json={
        "url": "https://example.com",
        "interval_minutes": 5
    })
    # FastAPI returns 401 when no credentials provided
    assert response.status_code == 401


def test_add_monitor_invalid_url(authenticated_client):
    response = authenticated_client.post("/monitors/", json={
        "url": "not-a-valid-url",
        "interval_minutes": 5
    })

    assert response.status_code == 422


def test_user_cannot_see_others_monitors(client):
    from app.auth import create_access_token

    # Create user 1
    r1 = client.post("/auth/signup", json={
        "email": "user1@example.com",
        "password": "password123"
    })
    user1_id = r1.json()["id"]

    # Create user 2
    r2 = client.post("/auth/signup", json={
        "email": "user2@example.com",
        "password": "password123"
    })
    user2_id = r2.json()["id"]

    # User 1 creates a monitor
    token1 = create_access_token(user_id=user1_id, role="user")
    client.headers.update({"Authorization": f"Bearer {token1}"})
    create_response = client.post("/monitors/", json={
        "url": "https://user1site.com",
        "interval_minutes": 5
    })
    monitor_id = create_response.json()["id"]

    # User 2 tries to access user 1's monitor, should get 404
    token2 = create_access_token(user_id=user2_id, role="user")
    client.headers.update({"Authorization": f"Bearer {token2}"})
    response = client.get(f"/monitors/{monitor_id}")
    assert response.status_code == 404


def test_delete_monitor_removes_checks(authenticated_client):
    # Create a monitor
    create = authenticated_client.post("/monitors/", json={
        "url": "https://todelete.com",
        "interval_minutes": 5
    })
    monitor_id = create.json()["id"]

    # Delete it
    response = authenticated_client.delete(f"/monitors/{monitor_id}")
    assert response.status_code == 204

    # Confirm it's gone
    get = authenticated_client.get(f"/monitors/{monitor_id}")
    assert get.status_code == 404