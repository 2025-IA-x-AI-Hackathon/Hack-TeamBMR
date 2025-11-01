from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, Path, UploadFile, status

from app.api.dependencies import get_authenticated_user_id
from app.models import RoomCreateRequest, RoomDetailResponse, RoomPhoto
from app.services import RoomService, get_room_service

router = APIRouter()


@router.post(
    "/rooms",
    status_code=status.HTTP_201_CREATED,
    response_model=RoomDetailResponse,
)
async def create_room(
    payload: RoomCreateRequest,
    user_id: str = Depends(get_authenticated_user_id),
    service: RoomService = Depends(get_room_service),
) -> RoomDetailResponse:
    return await service.create_room(user_id, payload)


@router.get(
    "/rooms",
    response_model=List[RoomDetailResponse],
)
async def list_rooms(
    user_id: str = Depends(get_authenticated_user_id),
    service: RoomService = Depends(get_room_service),
) -> List[RoomDetailResponse]:
    return await service.list_rooms(user_id)


@router.get(
    "/rooms/{room_id}",
    response_model=RoomDetailResponse,
)
async def get_room(
    room_id: str = Path(..., description="Unique room identifier."),
    user_id: str = Depends(get_authenticated_user_id),
    service: RoomService = Depends(get_room_service),
) -> RoomDetailResponse:
    room = await service.get_room(user_id, room_id)
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found.")
    return room


@router.delete(
    "/rooms/{room_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_room(
    room_id: str = Path(..., description="Unique room identifier."),
    user_id: str = Depends(get_authenticated_user_id),
    service: RoomService = Depends(get_room_service),
) -> None:
    deleted = await service.delete_room(user_id, room_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found.")


@router.post(
    "/rooms/{room_id}/photos",
    status_code=status.HTTP_201_CREATED,
    response_model=RoomPhoto,
)
async def upload_room_photo(
    room_id: str = Path(..., description="Unique room identifier."),
    file: UploadFile = File(...),
    user_id: str = Depends(get_authenticated_user_id),
    service: RoomService = Depends(get_room_service),
) -> RoomPhoto:
    filename = file.filename or "photo.jpg"
    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file upload.")

    photo = await service.attach_photo(
        user_id,
        room_id,
        filename,
        content,
        file.content_type,
    )
    if not photo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found.")
    return photo
