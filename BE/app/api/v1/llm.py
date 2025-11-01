from __future__ import annotations

from datetime import datetime
from typing import Dict

from fastapi import APIRouter, HTTPException, Path, status

from app.models import LLMReportAck, LLMReportDetail, LLMReportTriggerPayload

router = APIRouter(prefix="/llm")


@router.get(
    "/reports/{report_id}",
    response_model=LLMReportDetail,
)
async def get_llm_report(
    report_id: str = Path(..., description="Identifier of the report to retrieve."),
) -> LLMReportDetail:
    """Return the generated LLM report."""
    pass
