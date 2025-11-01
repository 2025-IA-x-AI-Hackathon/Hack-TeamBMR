import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPeerConnection } from './rtc';
import { getRealtimeClient } from './ws';
import {
  type GenericErrorPayload,
  type RtcAnswerPayload,
  type RtcCandidatePayload,
  type SessionReadyPayload,
  type SttErrorPayload,
  type SttFinalSegmentsPayload,
  type SttPartialPayload,
  type SttStatsPayload,
} from './stt.types';
import {
  requestMicrophoneStream,
  stopStream,
} from '../utils/media';
import type { SttBubble } from '../types/domain';

export type SttSessionState = 'idle' | 'connecting' | 'ready' | 'recording' | 'error';

export interface UseSttSessionResult {
  state: SttSessionState;
  error: string | null;
  partial: string;
  bubbles: SttBubble[];
  stats: SttStatsPayload | null;
  start: () => Promise<void>;
  stop: () => void;
}

function buildBubbleId(counterRef: MutableRefObject<number>): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  counterRef.current += 1;
  return `stt-bubble-${Date.now()}-${counterRef.current}`;
}

export function useSttSession(): UseSttSessionResult {
  const client = useMemo(() => getRealtimeClient(), []);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioSenderRef = useRef<RTCRtpSender | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const micCleanupRef = useRef<(() => void) | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const isActiveRef = useRef(false);
  const bubbleCounterRef = useRef(0);

  const [state, setState] = useState<SttSessionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState('');
  const [bubbles, setBubbles] = useState<SttBubble[]>([]);
  const [stats, setStats] = useState<SttStatsPayload | null>(null);

  const cleanupResources = useCallback(() => {
    dataChannelRef.current?.close();
    dataChannelRef.current = null;

    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.ondatachannel = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    if (audioSenderRef.current) {
      audioSenderRef.current.replaceTrack(null).catch(() => {
        // Ignore replace errors during teardown
      });
      audioSenderRef.current = null;
    }

    stopStream(streamRef.current);
    streamRef.current = null;

    micCleanupRef.current?.();
    micCleanupRef.current = null;
  }, []);

  const stop = useCallback(() => {
    if (!isActiveRef.current) {
      return;
    }

    isActiveRef.current = false;
    client.send({ event: 'rtc.stop', data: {} });

    if (sessionIdRef.current) {
      client.send({
        event: 'session.close',
        data: {
          reason: 'user disconnected',
        },
      });
    }

    cleanupResources();
    setPartial('');
    setStats(null);
    sessionIdRef.current = null;
    setState('idle');
  }, [cleanupResources, client]);

  const handleSessionReady = useCallback(async (payload: SessionReadyPayload) => {
    if (!pcRef.current || !isActiveRef.current) {
      return;
    }

    try {
      sessionIdRef.current = payload.session_id;
      const pc = pcRef.current;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      client.send({
        event: 'rtc.offer',
        data: {
          sdp: offer.sdp ?? '',
          type: offer.type,
        },
      });
      client.send({ event: 'rtc.start', data: { track: 'audio' } });
      setState('ready');
    } catch (rtcError) {
      setError('RTC 세션을 구성하는 중 오류가 발생했습니다.');
      setState('error');
      stop();
      // eslint-disable-next-line no-console
      console.warn('Failed to handle session.ready', rtcError);
    }
  }, [client, stop]);

  const handleRtcAnswer = useCallback(async (payload: RtcAnswerPayload) => {
    if (!pcRef.current || !isActiveRef.current) {
      return;
    }

    try {
      await pcRef.current.setRemoteDescription(new RTCSessionDescription({
        type: payload.type,
        sdp: payload.sdp,
      }));
      setState('recording');
    } catch (rtcError) {
      setError('상대 SDP를 적용하는 중 오류가 발생했습니다.');
      setState('error');
      stop();
      // eslint-disable-next-line no-console
      console.warn('Failed to apply rtc.answer', rtcError);
    }
  }, [stop]);

  const handleRtcCandidate = useCallback(async (payload: RtcCandidatePayload) => {
    if (!pcRef.current || !isActiveRef.current) {
      return;
    }

    try {
      if (!payload.candidate) {
        await pcRef.current.addIceCandidate(null);
        return;
      }

      const candidate: RTCIceCandidateInit = {
        candidate: payload.candidate,
        sdpMid: payload.sdpMid ?? undefined,
        sdpMLineIndex: payload.sdpMLineIndex ?? undefined,
      };
      await pcRef.current.addIceCandidate(candidate);
    } catch (rtcError) {
      // eslint-disable-next-line no-console
      console.warn('Failed to apply remote ICE candidate', rtcError);
    }
  }, []);

  const handlePartial = useCallback((payload: SttPartialPayload) => {
    setPartial(payload.text);
  }, []);

  const handleFinalSegments = useCallback((payload: SttFinalSegmentsPayload) => {
    if (!payload.segments?.length) {
      return;
    }

    setPartial('');
    setBubbles((prev) => [
      ...prev,
      ...payload.segments.map((segment) => ({
        id: buildBubbleId(bubbleCounterRef),
        speaker: segment.speaker,
        text: segment.text,
        startedAt: segment.start,
        endedAt: segment.end,
      })),
    ]);
  }, []);

  const handleSessionClose = useCallback(() => {
    stop();
  }, [stop]);

  const handleSttError = useCallback((payload: SttErrorPayload | GenericErrorPayload) => {
    setError(payload.message);
    setState('error');
    stop();
  }, [stop]);

  const handleStats = useCallback((payload: SttStatsPayload) => {
    setStats(payload);
  }, []);

  const handleDataChannelMessage = useCallback((payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return;
    }

    const typedPayload = payload as { event?: string; data?: unknown };
    if (typedPayload.event === 'stt.stats' && typedPayload.data && typeof typedPayload.data === 'object') {
      handleStats(typedPayload.data as SttStatsPayload);
    }
  }, [handleStats]);

  const start = useCallback(async () => {
    if (isActiveRef.current) {
      return;
    }

    isActiveRef.current = true;
    setError(null);
    setPartial('');
    setBubbles([]);
    setStats(null);
    setState('connecting');
    client.connect();

    try {
      const micResult = await requestMicrophoneStream();
      streamRef.current = micResult.stream;
      micCleanupRef.current = micResult.cleanup;

      const { pc, dataChannel } = createPeerConnection(client, {
        onDataMessage: handleDataChannelMessage,
        onConnectionStateChange: (connectionState) => {
          if (connectionState === 'failed') {
            setError('네트워크 상태가 불안정합니다. 다시 시도해주세요.');
            setState('error');
            stop();
          }
        },
      });

      pcRef.current = pc;
      dataChannelRef.current = dataChannel;

      const [audioTrack] = micResult.stream.getAudioTracks();
      if (!audioTrack) {
        throw new Error('사용 가능한 오디오 트랙을 찾지 못했습니다.');
      }

      audioTrack.enabled = true;
      const sender = pc.addTrack(audioTrack, micResult.stream);
      audioSenderRef.current = sender;

      client.send({
        event: 'session.init',
        data: {
          locale: 'ko-KR',
          diarization: true,
          minSpeakers: 2,
          maxSpeakers: 4,
        },
      });
    } catch (startError) {
      isActiveRef.current = false;
      cleanupResources();
      setError(startError instanceof Error ? startError.message : '세션 시작 중 오류가 발생했습니다.');
      setState('error');
    }
  }, [client, cleanupResources, handleDataChannelMessage, stop]);

  useEffect(() => {
    const unsubscribes = [
      client.subscribe('session.ready', (payload) => handleSessionReady(payload as SessionReadyPayload)),
      client.subscribe('session.close', () => handleSessionClose()),
      client.subscribe('rtc.answer', (payload) => handleRtcAnswer(payload as RtcAnswerPayload)),
      client.subscribe('rtc.candidate', (payload) => handleRtcCandidate(payload as RtcCandidatePayload)),
      client.subscribe('stt.webrtc.ice', (payload) => handleRtcCandidate(payload as RtcCandidatePayload)),
      client.subscribe('stt.partial', (payload) => handlePartial(payload as SttPartialPayload)),
      client.subscribe('stt.final_segments', (payload) => handleFinalSegments(payload as SttFinalSegmentsPayload)),
      client.subscribe('stt.error', (payload) => handleSttError(payload as SttErrorPayload)),
      client.subscribe('stt.stats', (payload) => handleStats(payload as SttStatsPayload)),
      client.subscribe('error', (payload) => handleSttError(payload as GenericErrorPayload)),
    ];

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [
    client,
    handleFinalSegments,
    handlePartial,
    handleRtcAnswer,
    handleRtcCandidate,
    handleSessionClose,
    handleSessionReady,
    handleStats,
    handleSttError,
  ]);

  return {
    state,
    error,
    partial,
    bubbles,
    stats,
    start,
    stop,
  };
}
