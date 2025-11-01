from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class LLMReportTriggerPayload(BaseModel):
    prompt: Optional[str] = Field(
        default=None,
        description="Optional user-supplied prompt or instruction for the report generation.",
    )

class LLMReportAck(BaseModel):
    report_id: str = Field(..., description="Identifier of the report that was queued.")
    status: str = Field(..., description="Current state, e.g. 'queued' or 'processing'.")

class LLMReportDetail(BaseModel):
    report_id: str
    status: str
    created_at: datetime
    detail: Dict[str, Any] = Field(default_factory=dict)
