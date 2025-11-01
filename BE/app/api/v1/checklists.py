from fastapi import APIRouter

from app.models import ChecklistResponse, build_default_checklist_items

router = APIRouter()


@router.get("/checklists", response_model=ChecklistResponse)
async def list_checklists() -> ChecklistResponse:
    return ChecklistResponse(items=build_default_checklist_items())
