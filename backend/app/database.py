import os
import redis as redis_lib
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

# PostgreSQL Setup
DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Redis Setup
REDIS_URL = os.getenv("REDIS_URL")

redis_client = redis_lib.from_url(
    REDIS_URL, 
    ssl_cert_reqs=None, 
    decode_responses=True
)