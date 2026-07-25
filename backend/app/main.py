import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from sqlalchemy import text

from app.database import AsyncSessionLocal
from app.utils.logger import get_logger
from app.routers import medicines, sales, upload, dashboard, receiving, reports, chart_of_accounts

load_dotenv()
logger = get_logger(__name__)

app = FastAPI(title="Pharmacy Management API", version="1.0.0")

# Parse ALLOWED_ORIGINS from env (comma-separated).
# Dev localhost origins are always included so local development never breaks.
_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
_env_origins = [o.strip().rstrip("/") for o in _raw_origins.split(",") if o.strip()]
_dev_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
# dict.fromkeys preserves order and deduplicates
allowed_origins = list(dict.fromkeys(_env_origins + _dev_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(medicines.router)
app.include_router(sales.router)
app.include_router(upload.router)
app.include_router(dashboard.router)
app.include_router(receiving.router)
app.include_router(reports.router)
app.include_router(chart_of_accounts.router)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/ready")
async def ready():
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return {"status": "ok", "database": "ok"}
    except Exception as exc:
        logger.error("Readiness check failed: %s", exc)
        return JSONResponse(status_code=503, content={"status": "degraded", "database": "unavailable"})


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
