from __future__ import annotations

from datetime import datetime
from typing import List
from motor.motor_asyncio import AsyncIOMotorCollection

from app.models import STTResult, TranscriptSegment


class STTRepository:
    """Persistence layer for STT session results."""

    def __init__(self, collection: AsyncIOMotorCollection) -> None:
        self._collection = collection

    async def get_transcript_segments(self, room_id: str) -> List[TranscriptSegment]:
        document = await self._collection.find_one({"_id": room_id}, {"transcript": 1})
        if not document:
            return []
        transcript = document.get("transcript") or []

        if isinstance(transcript, dict):
            raw_segments = transcript.get("segments") or transcript.get("conversation_segments") or []
        else:
            raw_segments = transcript

        if not isinstance(raw_segments, list):
            return []

        return [TranscriptSegment(**segment) for segment in raw_segments if isinstance(segment, dict)]


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
