"""
UnbiasedAI FastAPI entrypoint — fairness auditing API.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import get_settings
from core.store import load_demo_audits
from routers import audits, auth, datasets, reports

settings = get_settings()

app = FastAPI(title=settings.app_name, version="0.1.0")

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(datasets.router)
app.include_router(audits.router)
app.include_router(reports.router)
app.include_router(auth.router)


@app.on_event("startup")
async def startup_event() -> None:
    """Load demo datasets/audits when ``DEMO_MODE`` is enabled."""

    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    if settings.demo_mode:
        demo_path = Path(__file__).resolve().parent.parent / "sample_data" / "demo_seed.json"
        load_demo_audits(demo_path)


@app.get("/health")
async def health() -> dict[str, str]:
    """Service liveness probe."""

    return {"status": "ok", "service": "unbiasedai-api"}
