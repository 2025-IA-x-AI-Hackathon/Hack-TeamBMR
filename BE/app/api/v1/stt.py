from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any, Dict
from uuid import uuid4

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(prefix="/stt")

@router.websocket("/ws")
async def stt_websocket(websocket: WebSocket) -> None:
    pass
