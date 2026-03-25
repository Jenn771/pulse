import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import MagicMock

from app.main import app
from app.database import Base, get_db
from app.scheduler import scheduler


SQLITE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLITE_URL,
    connect_args={"check_same_thread": False}
)

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


def override_get_db():
    # test database session
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


# Mock the Redis client so tests don't need Upstash
mock_redis = MagicMock()
mock_redis.get.return_value = None
mock_redis.set.return_value = True
mock_redis.delete.return_value = True


@pytest.fixture(scope="function")
def client():
    # Create all tables fresh for each test
    Base.metadata.create_all(bind=engine)

    # Replace real database and Redis with test versions
    app.dependency_overrides[get_db] = override_get_db

    import app.database as db_module
    import app.routes.monitors as monitors_module
    db_module.redis_client = mock_redis
    monitors_module.redis_client = mock_redis

    if not scheduler.running:
        pass

    test_client = TestClient(app)
    yield test_client

    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def authenticated_client(client):
    from app.auth import create_access_token
    signup = client.post("/auth/signup", json={
        "email": "test@example.com",
        "password": "testpassword123"
    })
    user_id = signup.json()["id"]
    token = create_access_token(user_id=user_id, role="user")
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client


@pytest.fixture(scope="function")
def second_user_client(client):
    from app.auth import create_access_token
    
    signup = client.post("/auth/signup", json={
        "email": "other@example.com",
        "password": "otherpassword123"
    })
    user_id = signup.json()["id"]
    token = create_access_token(user_id=user_id, role="user")
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client