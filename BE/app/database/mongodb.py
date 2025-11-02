from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from motor.motor_asyncio import (
    AsyncIOMotorClient,
    AsyncIOMotorClientSession,
    AsyncIOMotorCollection,
    AsyncIOMotorDatabase,
)

from app.core.config import settings

_client = AsyncIOMotorClient(settings.MONGODB_URI)
_database: AsyncIOMotorDatabase = _client[settings.MONGODB_DB_NAME]


def get_database() -> AsyncIOMotorDatabase:
    """Return the primary application database handle."""
    return _database


def get_collection(name: str) -> AsyncIOMotorCollection:
    """Return a collection handle from the primary database."""
    return _database[name]


def get_rooms_collection() -> AsyncIOMotorCollection:
    """Convenience accessor for the rooms collection."""
    return get_collection("rooms")


def get_ocr_collection() -> AsyncIOMotorCollection:
    """Convenience accessor for the OCR jobs collection."""
    return get_collection("ocr_jobs")


def get_llm_collection() -> AsyncIOMotorCollection:
    """Convenience accessor for the LLM reports collection."""
    return get_collection("llm_reports")


@asynccontextmanager
async def get_session() -> AsyncGenerator[AsyncIOMotorClientSession, None]:
    """Yield an async MongoDB client session suitable for transactional work."""
    session = await _client.start_session()
    try:
        yield session
    finally:
        await session.end_session()
