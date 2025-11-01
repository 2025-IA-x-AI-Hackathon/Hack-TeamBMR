from __future__ import annotations

from fastapi import APIRouter, Depends, Path

from app.api.dependencies import get_authenticated_user_id
from app.models import LLMReportDetail
from app.services import LlmService, get_llm_service

router = APIRouter(prefix="/llm")


@router.get(
    "/reports/{report_id}",
    response_model=LLMReportDetail,
)
async def get_llm_report(
    report_id: str = Path(..., description="Identifier of the report to retrieve."),
    user_id: str = Depends(get_authenticated_user_id),
    service: LlmService = Depends(get_llm_service),
) -> LLMReportDetail:
    """Return the generated LLM report."""
    return await service.get_report(user_id, report_id)
