from typing import Optional

from fastapi import APIRouter, Query

from app.models import ChecklistListResponse

router = APIRouter()


@router.get("/checklists", response_model=ChecklistListResponse)
async def list_checklists(
) -> ChecklistListResponse:
    pass
