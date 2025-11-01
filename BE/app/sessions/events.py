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


async def emit_qa_pairs(websocket: WebSocket, pairs: Iterable[Mapping[str, Any]], final: bool = False) -> None:
    await emit(
        websocket,
        "stt.qa_pairs",
        {
            "pairs": list(pairs),
            "final": final,
        },
    )


async def emit_error(websocket: WebSocket, code: str, message: str) -> None:
    await emit(websocket, "stt.error", {"code": code, "message": message})


async def emit_rtc_candidate(websocket: WebSocket, payload: Mapping[str, Any]) -> None:
    await emit(websocket, "rtc.candidate", payload)


async def emit_session_close(websocket: WebSocket, reason: str) -> None:
    await emit(websocket, "session.close", {"reason": reason})


async def emit_stats(websocket: WebSocket, stats: Mapping[str, Any]) -> None:
    await emit(websocket, "stt.stats", stats)
