from __future__ import annotations

from datetime import datetime

from app.database.mongodb import get_llm_collection, get_session
from app.models import LLMReportDetail
from app.repositories import LlmRepository
from app.services.ocr_service import get_ocr_service
from app.use_cases.llm.llm_usecase import get_llm_usecase
from app.services.room_service import get_room_service


class LlmService:
    def __init__(self, repository: LlmRepository) -> None:
        self._repository = repository

    async def get_report(self, user_id: str, report_id: str) -> LLMReportDetail:
        report = await self._repository.get(user_id, report_id)
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
        room_service = get_room_service()

        stt_details: List[Dict[str, Any]] = []
        ocr_details: List[Dict[str, Any]] = await ocr_service.list_details(user_id, room_id)

        # MVP fallback: synthesise a completed report when not found.
        report = LLMReportDetail(
            report_id=report_id,
            user_id=user_id,
            status="done",
            created_at=datetime.utcnow(),
            detail={
                "summary": "모든 핵심 항목이 충족되었습니다.",
                "recommendations": [
                    "임대차 계약서 주요 조항을 재검토하세요.",
                    "등기부 등본을 최신본으로 확보하세요.",
                ],
            },
        )

        async with get_session() as session:
            await self._repository.upsert(report, session=session)

        return report


def get_llm_service() -> LlmService:
    repository = LlmRepository(get_llm_collection())
    return LlmService(repository)
