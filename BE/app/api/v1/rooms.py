from __future__ import annotations

from datetime import datetime
from typing import Dict, List
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, Path, Query, UploadFile, status

from app.models import RoomBase, RoomChecklist, RoomDetailResponse, RoomPhoto

router = APIRouter()


@router.post(
    "/rooms",
    status_code=status.HTTP_201_CREATED,
    response_model=RoomDetailResponse,
)
async def create_room(payload: RoomBase) -> RoomDetailResponse:
    pass

@router.get("/rooms", response_model=List[RoomDetailResponse])
async def list_rooms(
) -> List[RoomDetailResponse]:
    pass


@router.get(
    "/rooms/{room_id}",
    response_model=RoomDetailResponse,
)
async def get_room(room_id: str = Path(..., description="Unique room identifier.")) -> RoomDetailResponse:
    pass


@router.delete(
    "/rooms/{room_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_room(room_id: str = Path(..., description="Unique room identifier.")) -> None:
    pass


@router.post(
    "/rooms/{room_id}/photos",
    status_code=status.HTTP_201_CREATED,
    response_model=RoomPhoto,
)
async def upload_room_photo(
    room_id: str = Path(..., description="Unique room identifier."),
    file: UploadFile = File(...),
) -> RoomPhoto:
    pass
