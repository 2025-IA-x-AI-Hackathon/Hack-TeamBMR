from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Dict, List, Optional

from app.database.mongodb import get_llm_collection, get_session
from app.models import LLMReportAck, LLMReportDetail, LLMReportTriggerPayload
from app.repositories import LlmRepository
from app.services.ocr_service import get_ocr_service
from app.services.stt_service import get_stt_service
from app.use_cases.llm.llm_usecase import get_llm_usecase
from app.services.room_service import get_room_service


class LlmService:
    def __init__(self, repository: LlmRepository) -> None:
        self._repository = repository

    async def create_report(
        self,
        user_id: str,
        room_id: str,
        payload: Optional[LLMReportTriggerPayload] = None,
    ) -> LLMReportAck:
        report = await self._generate_report(user_id, room_id, payload)
        await self._persist_report(report)
        return LLMReportAck(room_id=room_id, status=report.status, user_id=user_id)

    async def get_report(self, user_id: str, room_id: str) -> LLMReportDetail:
        report = await self._repository.get(user_id, room_id)
        if report:
            return report

        report = await self._generate_report(user_id, room_id, None)
        await self._persist_report(report)
        return report

    async def _persist_report(self, report: LLMReportDetail) -> None:
        async with get_session() as session:
            await self._repository.upsert(report, session=session)

    async def _generate_report(
        self,
        user_id: str,
        room_id: str,
        payload: Optional[LLMReportTriggerPayload],
    ) -> LLMReportDetail:
        llm_usecase = get_llm_usecase()
        ocr_service = get_ocr_service()
        stt_service = get_stt_service()
        room_service = get_room_service()

        stt_details: List[Dict[str, Any]] = await stt_service.list_details([room_id])
        ocr_details: List[Dict[str, Any]] = await ocr_service.list_details(user_id, room_id)
        room_checklist: Optional[List[Dict[str, Any]]] = await room_service.get_room_checklist(user_id, room_id)
        checklist_details: List[Dict[str, Any]] = []
        if room_checklist:
            checklist_details.append({"room_id": room_id, "items": room_checklist})

        # MVP fallback: synthesise a completed report when not found.
        report = LLMReportDetail(
            room_id=room_id,
            user_id=user_id,
            status="done",
            created_at=datetime.now(UTC),
            detail=await llm_usecase.process(stt_details, ocr_details, checklist_details),
        )
        return report


def get_llm_service() -> LlmService:
    repository = LlmRepository(get_llm_collection())
    return LlmService(repository)
