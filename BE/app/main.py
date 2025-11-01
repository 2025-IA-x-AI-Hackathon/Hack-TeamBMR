from __future__ import annotations

import json
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from starlette.staticfiles import StaticFiles

from app.core.config import get_settings
from app.sessions.manager import SessionManager
from app.sessions.stt_session import STTSession


settings = get_settings()
session_manager = SessionManager(settings=settings)

app = FastAPI(
    title="BMR STT Backend",
    version="0.1.0",
    debug=settings.debug,
    redirect_slashes=False,
)

allowed_origins = {
    "http://127.0.0.1:3000",
    settings.frontend_url,
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(allowed_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount(
    "/recordings",
    StaticFiles(directory=settings.storage_dir, html=False),
    name="recordings",
)


@app.get("/health", tags=["health"])
async def health_check() -> JSONResponse:
    return JSONResponse({"status": "ok"})


async def _ensure_session(session: Optional[STTSession], websocket: WebSocket) -> STTSession:
    if session is None:
        await websocket.send_json(
            {
                "event": "stt.error",
                "data": {
                    "code": "SESSION_NOT_INITIALIZED",
                    "message": "rtc.offer 이벤트 이후에만 사용할 수 있습니다.",
                },
            },
        )
        raise RuntimeError("session not initialized")
    return session


@app.websocket("/v1/stt/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    session: Optional[STTSession] = None
    session_id: Optional[str] = None

    try:
        while True:
            message = await websocket.receive_text()
            try:
                payload = json.loads(message)
            except json.JSONDecodeError:
                await websocket.send_json(
                    {
                        "event": "stt.error",
                        "data": {
                            "code": "INVALID_PAYLOAD",
                            "message": "JSON 포맷의 메시지만 허용됩니다.",
                        },
                    },
                )
                continue

            event = payload.get("event")
            data = payload.get("data") or {}

            if event == "rtc.offer":
                session = await session_manager.create_session(websocket)
                session_id = session.session_id
                try:
                    answer = await session.handle_offer(data)
                except NotImplementedError:
                    await websocket.send_json(
                        {
                            "event": "stt.error",
                            "data": {
                                "code": "NOT_IMPLEMENTED",
                                "message": "WebRTC offer 처리가 아직 구현되지 않았습니다.",
                            },
                        },
                    )
                except ValueError as exc:
                    await websocket.send_json(
                        {
                            "event": "stt.error",
                            "data": {
                                "code": "INVALID_OFFER",
                                "message": str(exc),
                            },
                        },
                    )
                else:
                    await websocket.send_json(
                        {
                            "event": "stt.webrtc.answer",
                            "data": answer,
                        },
                    )
            elif event == "rtc.candidate":
                try:
                    session_ref = await _ensure_session(session, websocket)
                except RuntimeError:
                    continue
                await session_ref.add_ice_candidate(data)
            elif event == "rtc.stop":
                if session_id:
                    await session_manager.remove(session_id)
                    session = None
                    session_id = None
            else:
                await websocket.send_json(
                    {
                        "event": "stt.error",
                        "data": {
                            "code": "UNKNOWN_EVENT",
                            "message": f"지원하지 않는 이벤트입니다: {event}",
                        },
                    },
                )
    except WebSocketDisconnect:
        pass
    finally:
        if session_id:
            await session_manager.remove(session_id)
