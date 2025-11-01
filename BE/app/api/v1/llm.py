from __future__ import annotations

from fastapi import APIRouter, Body, Depends, Path

from app.api.dependencies import get_authenticated_user_id
from app.models import LLMReportAck, LLMReportDetail, LLMReportTriggerPayload
from app.services import LlmService, get_llm_service

router = APIRouter(prefix="/llm")


@router.post(
    "/reports/{room_id}",
    response_model=LLMReportAck,
)
async def create_llm_report(
    room_id: str = Path(..., description="room_id url 파라미터로 받음"),
    payload: LLMReportTriggerPayload = Body(default_factory=LLMReportTriggerPayload),
    user_id: str = Depends(get_authenticated_user_id),
    service: LlmService = Depends(get_llm_service),
) -> LLMReportAck:
    """Trigger generation of an LLM report and return its acknowledgement."""
    return await service.create_report(user_id, room_id, payload)


@router.get(
    "/reports/{room_id}",
    response_model=LLMReportDetail,
)
async def get_llm_report(
    room_id: str = Path(..., description="room_id에 해당하는 report조회"),
    user_id: str = Depends(get_authenticated_user_id),
    service: LlmService = Depends(get_llm_service),
) -> LLMReportDetail:
    """Return the generated LLM report."""
    return await service.get_report(user_id, room_id)
