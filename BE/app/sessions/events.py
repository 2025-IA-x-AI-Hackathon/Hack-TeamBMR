from __future__ import annotations

from typing import Any, Dict, Iterable, Mapping

from fastapi import WebSocket


async def emit(websocket: WebSocket, event: str, payload: Mapping[str, Any] | None = None) -> None:
    await websocket.send_json(
        {
            "event": event,
            "data": payload or {},
        },
    )


async def emit_partial(websocket: WebSocket, text: str) -> None:
    await emit(websocket, "stt.partial", {"text": text})


async def emit_final_segments(websocket: WebSocket, segments: Iterable[Mapping[str, Any]]) -> None:
    await emit(websocket, "stt.final_segments", {"segments": list(segments)})


async def emit_qa(websocket: WebSocket, qa_list: Iterable[Mapping[str, Any]]) -> None:
    await emit(websocket, "stt.qa", {"pairs": list(qa_list)})


async def emit_error(websocket: WebSocket, code: str, message: str) -> None:
    await emit(websocket, "stt.error", {"code": code, "message": message})


async def emit_done(websocket: WebSocket, final_count: int, duration_sec: float) -> None:
    await emit(
        websocket,
        "stt.done",
        {
            "final_count": final_count,
            "duration_sec": duration_sec,
        },
    )


async def emit_recording_url(websocket: WebSocket, url: str) -> None:
    await emit(websocket, "stt.recording_url", {"url": url})


async def emit_rtc_candidate(websocket: WebSocket, payload: Mapping[str, Any]) -> None:
    await emit(websocket, "rtc.candidate", payload)


async def emit_session_close(websocket: WebSocket, reason: str) -> None:
    await emit(websocket, "session.close", {"reason": reason})


async def emit_stats(websocket: WebSocket, stats: Mapping[str, Any]) -> None:
    await emit(websocket, "stt.stats", stats)
