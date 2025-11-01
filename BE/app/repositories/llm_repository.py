from __future__ import annotations

from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClientSession, AsyncIOMotorCollection

from app.models import LLMReportDetail


class LlmRepository:
    def __init__(self, collection: AsyncIOMotorCollection) -> None:
        self._collection = collection

    async def upsert(
        self,
        report: LLMReportDetail,
        *,
        session: Optional[AsyncIOMotorClientSession] = None,
    ) -> None:
        document = report.model_dump()
        document["_id"] = document["report_id"] + ":" + document["user_id"]
        await self._collection.update_one(
            {"_id": document["_id"]},
            {"$set": document},
            upsert=True,
            session=session,
        )

    async def get(self, user_id: str, report_id: str) -> Optional[LLMReportDetail]:
        document = await self._collection.find_one({"_id": f"{report_id}:{user_id}"})
        if not document:
            return None

        data = dict(document)
        data.pop("_id", None)
        return LLMReportDetail.model_validate(data)
