from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from starlette.staticfiles import StaticFiles

from app.api import v1_router
from app.core.config import get_settings
from app.sessions.manager import SessionManager


import logging

logger = logging.getLogger(__name__)

settings = get_settings()

app = FastAPI(
    title="BMR STT Backend",
    version="0.1.0",
    debug=settings.debug,
    redirect_slashes=False,
    docs_url="/docs"
)

allowed_origins = {
    "http://127.0.0.1:3000",
    settings.frontend_url,
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(allowed_origins),
    #allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount(
    "/recordings",
    StaticFiles(directory=settings.storage_dir, html=False),
    name="recordings",
)


@app.get("/health", tags=["health"])
async def health_check() -> JSONResponse:
    return JSONResponse({"status": "ok"})

app.include_router(v1_router)
