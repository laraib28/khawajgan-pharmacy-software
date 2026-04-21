import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

from app.utils.logger import get_logger
from app.routers import medicines, sales, upload, dashboard, receiving

load_dotenv()
logger = get_logger(__name__)

app = FastAPI(title="Pharmacy Management API", version="1.0.0")

# CORS — allow frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(medicines.router)
app.include_router(sales.router)
app.include_router(upload.router)
app.include_router(dashboard.router)
app.include_router(receiving.router)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
