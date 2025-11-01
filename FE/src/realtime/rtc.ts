import type { RealtimeClient } from './ws';
import type { RtcCandidatePayload } from './stt.types';

export interface PeerConnectionOptions {
  onDataMessage?: (payload: unknown) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
}

function sendIceCandidate(client: RealtimeClient, candidate: RTCIceCandidate): void {
  const payload: RtcCandidatePayload = {
    candidate: candidate.candidate,
    sdpMid: candidate.sdpMid ?? undefined,
    sdpMLineIndex: candidate.sdpMLineIndex ?? undefined,
  };
  client.send({ event: 'rtc.candidate', data: payload });
}

function attachDataChannel(
  channel: RTCDataChannel,
  onDataMessage?: (payload: unknown) => void,
): void {
  channel.onmessage = (event) => {
    if (typeof event.data !== 'string') {
      return;
    }

    try {
      const parsed = JSON.parse(event.data);
      onDataMessage?.(parsed);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('RTC data channel 메시지 파싱 실패', error);
    }
  };
}

export function createPeerConnection(
  client: RealtimeClient,
  options: PeerConnectionOptions = {},
): { pc: RTCPeerConnection; dataChannel: RTCDataChannel } {
  const pc = new RTCPeerConnection({
    iceServers: [
      {
        urls: 'stun:stun.l.google.com:19302',
      },
    ],
  });

  pc.onicecandidate = (event) => {
    const candidate = event.candidate;
    if (candidate) {
      sendIceCandidate(client, candidate);
    }
  };

  pc.onconnectionstatechange = () => {
    options.onConnectionStateChange?.(pc.connectionState);
  };

  pc.ondatachannel = (event) => {
    attachDataChannel(event.channel, options.onDataMessage);
  };

  const dataChannel = pc.createDataChannel('client-events');
  attachDataChannel(dataChannel, options.onDataMessage);

  return { pc, dataChannel };
}
