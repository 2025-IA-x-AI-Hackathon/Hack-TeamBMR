from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from motor.motor_asyncio import AsyncIOMotorClientSession, AsyncIOMotorCollection

from app.models import RoomBase, RoomChecklist
from pydantic import ValidationError


class RoomRepository:
    """Persistence layer for room records."""

    def __init__(self, collection: AsyncIOMotorCollection) -> None:
        self._collection = collection

    async def insert_room(
        self,
        room: RoomBase,
        *,
        session: Optional[AsyncIOMotorClientSession] = None,
    ) -> None:
        document = room.model_dump(exclude_none=True)
        document["_id"] = document["room_id"]
        await self._collection.insert_one(document, session=session)

    async def get_room(self, user_id: str, room_id: str) -> Optional[RoomBase]:
        document = await self._collection.find_one({"_id": room_id, "user_id": user_id})
        return self._deserialize(document)

    async def get_room_checklist(
        self,
        user_id: str,
        room_id: str,
    ) -> Optional[List[Dict[str, Any]]]:
        document = await self._collection.find_one(
            {"_id": room_id, "user_id": user_id},
            {"checklist": 1},
        )
        if not document:
            return None

        raw_checklist = document.get("checklist")
        if isinstance(raw_checklist, RoomChecklist):
            return raw_checklist.items

        try:
            checklist = RoomChecklist.model_validate(raw_checklist or {})
        except ValidationError:
            checklist = RoomChecklist()

        return checklist.items

    async def list_rooms(self, user_id: str) -> List[RoomBase]:
        cursor = self._collection.find({"user_id": user_id}).sort("created_at", -1)
        rooms: List[RoomBase] = []
        async for document in cursor:
            room = self._deserialize(document)
            if room:
                rooms.append(room)
        return rooms

    async def delete_room(
        self,
        user_id: str,
        room_id: str,
        *,
        session: Optional[AsyncIOMotorClientSession] = None,
    ) -> bool:
        result = await self._collection.delete_one({"_id": room_id, "user_id": user_id}, session=session)
        return result.deleted_count == 1

    async def update_photo(
        self,
        user_id: str,
        room_id: str,
        photo_id: str,
        object_key: str,
        *,
        session: Optional[AsyncIOMotorClientSession] = None,
    ) -> bool:
        result = await self._collection.update_one(
            {"_id": room_id, "user_id": user_id},
            {
                "$set": {
                    "photo_id": photo_id,
                    "photo_key": object_key,
                }
            },
            session=session,
        )
        return result.modified_count == 1

    def _deserialize(self, document: Optional[dict]) -> Optional[RoomBase]:
        if not document:
            return None

        data = dict(document)
        data.setdefault("room_id", data.pop("_id", None))
        data.setdefault("user_id", data.get("user_id"))
        data.setdefault("photo_id", data.get("photo_id"))
        if "photo_key" not in data:
            data["photo_key"] = None
        if "created_at" not in data:
            data["created_at"] = datetime.utcnow()

        # Ensure nested checklist structure always materialises as expected by RoomBase.
        if "checklist" not in data or not data["checklist"]:
            data["checklist"] = RoomChecklist()

        return RoomBase.model_validate(data)
