from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, Optional, Set

from aiortc import (
    RTCConfiguration,
    RTCPeerConnection,
    RTCSessionDescription,
    RTCIceCandidate,
    RTCIceServer,
)
from aiortc.contrib.media import MediaRelay
from aiortc.mediastreams import MediaStreamTrack
from fastapi import WebSocket

from app.config import Settings
from app.sessions.audio_pipeline import AudioPipeline


logger = logging.getLogger(__name__)


class STTSession:
    _relay = MediaRelay()

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
        self._tasks: Set[asyncio.Task[None]] = set()
        self._audio_queue: asyncio.Queue[bytes] = asyncio.Queue(maxsize=64)
        self._audio_pipeline = AudioPipeline(
            session_id=session_id,
            settings=settings,
            output_queue=self._audio_queue,
        )

        configuration = RTCConfiguration(iceServers=[RTCIceServer("stun:stun.l.google.com:19302")])
        self._pc = RTCPeerConnection(configuration=configuration)
        self._pc.on("connectionstatechange")(self._on_connection_state_change)
        self._pc.on("track")(self._on_track)

    async def handle_offer(self, offer: Dict[str, Any]) -> Dict[str, Any]:
        if "sdp" not in offer or "type" not in offer:
            raise ValueError("Invalid offer payload")

        remote_description = RTCSessionDescription(sdp=offer["sdp"], type=offer["type"])
        await self._pc.setRemoteDescription(remote_description)

        answer = await self._pc.createAnswer()
        await self._pc.setLocalDescription(answer)

        local = self._pc.localDescription
        return {
            "session_id": self.session_id,
            "sdp": local.sdp,
            "type": local.type,
        }

    async def add_ice_candidate(self, candidate: Dict[str, Any]) -> None:
        if not candidate or candidate.get("candidate") in (None, ""):
            await self._pc.addIceCandidate(None)
            return

        ice_candidate = RTCIceCandidate(
            sdpMid=candidate.get("sdpMid"),
            sdpMLineIndex=candidate.get("sdpMLineIndex"),
            candidate=candidate.get("candidate"),
        )
        await self._pc.addIceCandidate(ice_candidate)

    async def stop(self) -> None:
        if self._closed.is_set():
            return

        self._closed.set()

        for task in list(self._tasks):
            task.cancel()

        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)

        self._audio_pipeline.close()
        await self._pc.close()

        # Drain audio queue to unblock consumer
        while not self._audio_queue.empty():
            try:
                self._audio_queue.get_nowait()
            except asyncio.QueueEmpty:
                break

    def get_audio_queue(self) -> asyncio.Queue[bytes]:
        return self._audio_queue

    def _on_connection_state_change(self) -> None:
        logger.debug("Session %s connection state: %s", self.session_id, self._pc.connectionState)

    def _on_track(self, track: MediaStreamTrack) -> None:
        if track.kind != "audio":
            logger.debug("Ignoring non-audio track: %s", track.kind)
            return

        logger.info("Audio track received for session %s", self.session_id)
        relayed = self._relay.subscribe(track)
        task = asyncio.create_task(self._consume_audio(relayed))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def _consume_audio(self, track: MediaStreamTrack) -> None:
        try:
            while not self._closed.is_set():
                frame = await track.recv()
                await self._audio_pipeline.handle_frame(frame)
        except asyncio.CancelledError:
            pass
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Audio consumption failed for session %s: %s", self.session_id, exc)
