from __future__ import annotations

import asyncio
from typing import Dict, Optional, Tuple
from uuid import uuid4

from fastapi import WebSocket

from app.config import Settings
from app.sessions.stt_session import STTSession


class SessionManager:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._sessions: Dict[str, STTSession] = {}
        self._lock = asyncio.Lock()

    async def create_session(self, websocket: WebSocket) -> STTSession:
        session_id = uuid4().hex
        session = STTSession(session_id=session_id, websocket=websocket, settings=self._settings)

        async with self._lock:
            self._sessions[session_id] = session

        return session

    async def get(self, session_id: str) -> Optional[STTSession]:
        async with self._lock:
            return self._sessions.get(session_id)

    async def remove(self, session_id: str) -> None:
        async with self._lock:
            session = self._sessions.pop(session_id, None)

        if session:
            await session.stop()

    async def stop_all(self) -> None:
        async with self._lock:
            sessions = list(self._sessions.values())
            self._sessions.clear()

        await asyncio.gather(*(session.stop() for session in sessions), return_exceptions=True)
