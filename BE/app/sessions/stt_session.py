from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional

from fastapi import WebSocket

from app.config import Settings


class STTSession:
    """Placeholder session object. Full media/STT pipeline is implemented in later stages."""

    def __init__(
        self,
        session_id: str,
        websocket: WebSocket,
        settings: Settings,
    ) -> None:
        self.session_id = session_id
        self.websocket = websocket
        self.settings = settings
        self._closed = asyncio.Event()

    async def handle_offer(self, offer: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError

    async def add_ice_candidate(self, candidate: Dict[str, Any]) -> None:
        # Will be implemented when RTCPeerConnection is wired.
        return

    async def stop(self) -> None:
        if not self._closed.is_set():
            self._closed.set()
