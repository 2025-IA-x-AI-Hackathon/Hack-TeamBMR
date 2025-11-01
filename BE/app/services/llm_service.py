from __future__ import annotations

from datetime import datetime

from typing import Dict, List, Any
from app.database.mongodb import get_llm_collection, get_session
from app.models import LLMReportDetail
from app.repositories import LlmRepository
from app.services.ocr_service import get_ocr_service
from app.use_cases.llm.llm_usecase import get_llm_usecase

class LlmService:
    def __init__(self, repository: LlmRepository) -> None:
        self._repository = repository

    async def get_report(self, user_id: str, report_id: str) -> LLMReportDetail:
        report = await self._repository.get(user_id, report_id)
        if report:
            return report

        llm_usecase = get_llm_usecase()
        ocr_service = get_ocr_service()

        stt_details: List[Dict[str, Any]] = []
        ocr_details: List[Dict[str, Any]] = await ocr_service.list_details(user_id, report_id)
        
        # MVP fallback: synthesise a completed report when not found.
        report = LLMReportDetail(
            report_id=report_id,
            user_id=user_id,
            status="done",
            created_at=datetime.utcnow(),
            detail=await llm_usecase.process(stt_details, ocr_details)
        )

        async with get_session() as session:
            await self._repository.upsert(report, session=session)

        return report


def get_llm_service() -> LlmService:
    repository = LlmRepository(get_llm_collection())
    return LlmService(repository)
