def test_signup_success(client):
    response = client.post("/auth/signup", json={
        "email": "newuser@example.com",
        "password": "securepassword123"
    })
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "newuser@example.com"
    assert data["role"] == "user"

    assert "password" not in data
    assert "hashed_password" not in data


def test_signup_duplicate_email(client):
    client.post("/auth/signup", json={
        "email": "dupe@example.com",
        "password": "password123"
    })
    # Second signup with same email should fail
    response = client.post("/auth/signup", json={
        "email": "dupe@example.com",
        "password": "differentpassword"
    })
    assert response.status_code == 400
    assert "already registered" in response.json()["detail"]


def test_login_returns_jwt(client):
    client.post("/auth/signup", json={
        "email": "logintest@example.com",
        "password": "mypassword123"
    })
    response = client.post("/auth/login", json={
        "email": "logintest@example.com",
        "password": "mypassword123"
    })
    assert response.status_code == 200
    data = response.json()
    # Both tokens must be present
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client):
    client.post("/auth/signup", json={
        "email": "wrongpass@example.com",
        "password": "correctpassword"
    })
    response = client.post("/auth/login", json={
        "email": "wrongpass@example.com",
        "password": "wrongpassword"
    })
    assert response.status_code == 401
    assert "Invalid" in response.json()["detail"]