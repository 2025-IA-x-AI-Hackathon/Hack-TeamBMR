from __future__ import annotations

from typing import List, Optional
from uuid import uuid4

from app.database.mongodb import get_rooms_collection, get_session
from app.models import RoomBase, RoomDetailResponse, RoomPhoto
from app.repositories import RoomRepository
from app.services.storage_service import StorageService, get_storage_service


class RoomService:
    """Business logic for room operations."""

    def __init__(self, repository: RoomRepository, storage: StorageService) -> None:
        self._repository = repository
        self._storage = storage

    async def create_room(self, user_id: str, payload: RoomBase) -> RoomDetailResponse:
        room = self._materialize_room(user_id, payload)
        async with get_session() as session:
            await self._repository.insert_room(room, session=session)
        return await self._to_response(room)

    async def list_rooms(self, user_id: str) -> List[RoomDetailResponse]:
        rooms = await self._repository.list_rooms(user_id=user_id)
        responses: List[RoomDetailResponse] = []
        for room in rooms:
            responses.append(await self._to_response(room))
        return responses

    async def get_room(self, user_id: str, room_id: str) -> Optional[RoomDetailResponse]:
        room = await self._repository.get_room(user_id, room_id)
        if not room:
            return None
        return await self._to_response(room)

    async def delete_room(self, user_id: str, room_id: str) -> bool:
        room = await self._repository.get_room(user_id, room_id)
        if not room:
            return False

        async with get_session() as session:
            deleted = await self._repository.delete_room(user_id, room_id, session=session)

        if deleted and room.photo_key:
            await self._storage.delete_object(room.photo_key)

        return deleted

    async def attach_photo(
        self,
        user_id: str,
        room_id: str,
        filename: str,
        content: bytes,
        content_type: Optional[str],
    ) -> Optional[RoomPhoto]:
        room = await self._repository.get_room(user_id, room_id)
        if not room:
            return None

        photo_id = f"ph_{uuid4().hex[:12]}"
        object_key = f"rooms/{user_id}/{room_id}/{photo_id}/{filename}"

        await self._storage.upload_bytes(
            object_key,
            content,
            content_type=content_type or "application/octet-stream",
        )

        async with get_session() as session:
            updated = await self._repository.update_photo(
                user_id,
                room_id,
                photo_id,
                object_key,
                session=session,
            )

        if not updated:
            # Roll back uploaded object when DB update fails.
            await self._storage.delete_object(object_key)
            return None

        url = await self._storage.generate_presigned_url(object_key)
        return RoomPhoto(photo_id=photo_id, object_url=url)

    def _materialize_room(self, user_id: str, payload: RoomBase) -> RoomBase:
        room_id = payload.room_id or f"rm_{uuid4().hex[:10]}"
        data = payload.model_dump(exclude={"room_id", "user_id", "created_at"})
        return RoomBase(**data, room_id=room_id, user_id=user_id)

    async def _to_response(
        self,
        room: RoomBase,
    ) -> RoomDetailResponse:
        photo = await self._build_photo(room)

        return RoomDetailResponse(
            room_id=room.room_id or "",
            user_id=room.user_id,
            address=room.address,
            type=room.type,
            floor=room.floor,
            deposit=room.deposit,
            rent_monthly=room.rent_monthly,
            fee_included=room.fee_included,
            fee_mgmt=room.fee_mgmt,
            report_id=room.report_id,
            checklist=room.checklist,
            photo=photo,
            created_at=room.created_at,
        )

    async def _build_photo(self, room: RoomBase) -> Optional[RoomPhoto]:
        if room.photo_id and room.photo_key:
            url = await self._storage.generate_presigned_url(room.photo_key)
            return RoomPhoto(
                photo_id=room.photo_id,
                object_url=url,
            )
        return None


def get_room_service() -> RoomService:
    repository = RoomRepository(get_rooms_collection())
    storage = get_storage_service()
    return RoomService(repository, storage)
