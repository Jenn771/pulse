import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler

from app.routes import auth, monitors, checks, ai

load_dotenv()

scheduler = BackgroundScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.start()

    yield  # Server is running, handling requests

    scheduler.shutdown(wait=False)


app = FastAPI(
    title="Pulse",
    description="Uptime monitoring",
    version="0.1.0",
    lifespan=lifespan
)


# CORS configuration
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

origins = (
    ["http://localhost:3000"]
    if ENVIRONMENT == "development"
    else [os.getenv("FRONTEND_URL", "https://your-app.vercel.app")]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(monitors.router, prefix="/monitors", tags=["monitors"])
app.include_router(checks.router, prefix="/checks", tags=["checks"])
app.include_router(ai.router, prefix="/ai", tags=["ai"])


# Root health check endpoint
@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "app": "Pulse"}


# Development only endpoint to simulate network latency and server errors
if ENVIRONMENT == "development":
    import random
    import asyncio
    from fastapi import HTTPException

    @app.get("/test/flaky", tags=["Development"])
    async def flaky():
        roll = random.random()
        if roll < 0.3:
            raise HTTPException(status_code=500, detail="Simulated failure")
        if roll < 0.5:
            await asyncio.sleep(8)
        return {"status": "ok"}