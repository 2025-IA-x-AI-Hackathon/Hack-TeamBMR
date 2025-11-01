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
from aiortc.rtcicetransport import Candidate
from fastapi import WebSocket

from app.core.config import Settings
from app.sessions.audio_pipeline import AudioPipeline
from app.sessions import events
from app.sessions.transcriber import Transcriber


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
        self._audio_queue: asyncio.Queue[Optional[bytes]] = asyncio.Queue(maxsize=64)
        self._audio_pipeline = AudioPipeline(
            session_id=session_id,
            settings=settings,
            output_queue=self._audio_queue,
        )
        self._transcriber = Transcriber(
            session_id=session_id,
            settings=settings,
            websocket=websocket,
            audio_queue=self._audio_queue,
            audio_pipeline=self._audio_pipeline,
        )
        self._transcriber_started = False

        ice_servers: list[RTCIceServer] = []
        for entry in settings.ice_servers:
            try:
                if isinstance(entry, str):
                    ice_servers.append(RTCIceServer(entry))
                elif isinstance(entry, dict):
                    ice_servers.append(RTCIceServer(**entry))
                else:
                    logger.warning("Ignoring unsupported ICE server entry: %s", entry)
            except Exception as exc:  # pragma: no cover - validation guard
                logger.warning("Failed to parse ICE server entry %s: %s", entry, exc)

        if not ice_servers:
            ice_servers = [RTCIceServer("stun:stun.l.google.com:19302")]

        configuration = RTCConfiguration(iceServers=ice_servers)
        self._pc = RTCPeerConnection(configuration=configuration)
        self._pc.addTransceiver("audio", direction="recvonly")
        self._pc.on("connectionstatechange")(self._on_connection_state_change)
        self._pc.on("track")(self._on_track)
        self._pc.on("icecandidate")(self._on_icecandidate)

    async def handle_offer(self, offer: Dict[str, Any]) -> Dict[str, Any]:
        logger.debug("Session %s handling offer", self.session_id)
        if "sdp" not in offer or "type" not in offer:
            raise ValueError("Invalid offer payload")

        remote_description = RTCSessionDescription(sdp=offer["sdp"], type=offer["type"])
        await self._pc.setRemoteDescription(remote_description)

        answer = await self._pc.createAnswer()
        await self._pc.setLocalDescription(answer)

        local = self._pc.localDescription
        return {
            "sdp": local.sdp,
            "type": local.type,
        }

    async def add_ice_candidate(self, payload: Dict[str, Any]) -> None:
        if not payload:
            await self._pc.addIceCandidate(None)
            return
        
        candidate_sdp = payload.get("candidate")
        if not candidate_sdp:
            await self._pc.addIceCandidate(None)
            return
        
        parsed_candidate = Candidate.from_sdp(candidate_sdp)
        rtc_candidate = RTCIceCandidate(
            component=parsed_candidate.component,
            foundation=parsed_candidate.foundation,
            ip=parsed_candidate.host,
            port=parsed_candidate.port,
            priority=parsed_candidate.priority,
            protocol=parsed_candidate.transport,
            type=parsed_candidate.type,
            relatedAddress=parsed_candidate.related_address,
            relatedPort=parsed_candidate.related_port,
            tcpType=parsed_candidate.tcptype,
            sdpMid=payload.get("sdpMid"),
            sdpMLineIndex=payload.get("sdpMLineIndex"),
        )
        logger.debug(
            "Session %s applying remote ICE candidate (mid=%s mline=%s): %s",
            self.session_id,
            rtc_candidate.sdpMid,
            rtc_candidate.sdpMLineIndex,
            candidate_sdp,
        )
        try:
            await self._pc.addIceCandidate(rtc_candidate)
        except Exception as exc:  # pragma: no cover - diagnostics
            logger.warning("Session %s failed to add ICE candidate: %s", self.session_id, exc)
            raise

    async def stop(self) -> None:
        if self._closed.is_set():
            logger.debug("Session %s stop() called but already closed", self.session_id)
            return

        self._closed.set()
        logger.info("Stopping STT session %s", self.session_id)

        for task in list(self._tasks):
            task.cancel()

        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)

        try:
            await self._transcriber.stop()
        except Exception as exc:  # pragma: no cover - diagnostics
            logger.exception("Session %s transcriber stop failed: %s", self.session_id, exc)

        try:
            self._audio_pipeline.close()
        except Exception as exc:  # pragma: no cover - diagnostics
            logger.exception("Session %s audio pipeline close failed: %s", self.session_id, exc)

        try:
            await self._pc.close()
        except Exception as exc:  # pragma: no cover - diagnostics
            logger.exception("Session %s peer connection close failed: %s", self.session_id, exc)

        # Drain audio queue to unblock consumer
        while not self._audio_queue.empty():
            try:
                self._audio_queue.get_nowait()
            except asyncio.QueueEmpty:
                break

        await events.emit_session_close(self.websocket, "session stopped")

    def get_audio_queue(self) -> asyncio.Queue[Optional[bytes]]:
        return self._audio_queue

    def _on_connection_state_change(self) -> None:
        logger.debug("Session %s connection state: %s", self.session_id, self._pc.connectionState)
        if self._pc.connectionState in {"failed", "closed"}:
            asyncio.create_task(self.stop())
        if self._pc.connectionState == "failed":
            logger.error("Session %s peer connection failed", self.session_id)

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
                await self._ensure_transcriber_started()
                await self._audio_pipeline.handle_frame(frame)
        except asyncio.CancelledError:
            pass
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Audio consumption failed for session %s: %s", self.session_id, exc)
        finally:
            try:
                self._audio_queue.put_nowait(None)
            except asyncio.QueueFull:
                pass

    async def _ensure_transcriber_started(self) -> None:
        if not self._transcriber_started:
            await self._transcriber.start()
            self._transcriber_started = True

    async def _on_icecandidate(self, candidate: Optional[RTCIceCandidate]) -> None:
        if candidate is None:
            payload: Dict[str, Any] = {"candidate": None}
        else:
            payload = {
                "candidate": candidate.to_sdp(),
                "sdpMid": candidate.sdpMid,
                "sdpMLineIndex": candidate.sdpMLineIndex,
            }

        logger.debug("Session %s emitting local ICE candidate", self.session_id)
        await events.emit_rtc_candidate(self.websocket, payload)
