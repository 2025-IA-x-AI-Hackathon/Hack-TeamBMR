from __future__ import annotations

from typing import List, Optional

from motor.motor_asyncio import AsyncIOMotorClientSession, AsyncIOMotorCollection

from app.models import OcrBase


class OcrRepository:
    def __init__(self, collection: AsyncIOMotorCollection) -> None:
        self._collection = collection

    async def insert(self, record: OcrBase, *, session: Optional[AsyncIOMotorClientSession] = None) -> None:
        document = record.model_dump(exclude_none=True)
        document["_id"] = document["ocr_id"]
        await self._collection.insert_one(document, session=session)

    async def get(self, user_id: str, ocr_id: str) -> Optional[OcrBase]:
        document = await self._collection.find_one({"_id": ocr_id, "user_id": user_id})
        return self._deserialize(document)

    async def list_by_report(self, user_id: str, report_id: str) -> List[OcrBase]:
        cursor = self._collection.find({"user_id": user_id, "report_id": report_id}).sort("created_at", -1)
        records: List[OcrBase] = []
        async for document in cursor:
            record = self._deserialize(document)
            if record:
                records.append(record)
        return records

    async def update(self, user_id: str, ocr_id: str, updates: dict, *, session: Optional[AsyncIOMotorClientSession] = None) -> bool:
        result = await self._collection.update_one(
            {"_id": ocr_id, "user_id": user_id},
            {"$set": updates},
            session=session,
        )
        return result.modified_count == 1

    def _deserialize(self, document: Optional[dict]) -> Optional[OcrBase]:
        if not document:
            return None

        data = dict(document)
        data["ocr_id"] = data.pop("_id")
        return OcrBase.model_validate(data)
