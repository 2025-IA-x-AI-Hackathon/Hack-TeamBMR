from __future__ import annotations

from datetime import datetime

from motor.motor_asyncio import AsyncIOMotorCollection

from app.models import STTResult


class STTRepository:
    """Persistence layer for STT session results."""

    def __init__(self, collection: AsyncIOMotorCollection) -> None:
        self._collection = collection

    async def upsert_result(self, result: STTResult) -> None:
        payload = result.model_dump()
        payload["_id"] = result.room_id
        now = datetime.utcnow()
        payload["updated_at"] = now
        payload.setdefault("created_at", now)

        await self._collection.update_one(
            {"_id": result.room_id},
            {
                "$set": {
                    "qa": payload["qa"],
                    "transcript": payload["transcript"],
                    "updated_at": payload["updated_at"],
                },
                "$setOnInsert": {
                    "created_at": payload["created_at"],
                    "room_id": result.room_id,
                },
            },
            upsert=True,
        )
