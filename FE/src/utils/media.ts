export interface MicStreamResult {
  stream: MediaStream;
  cleanup: () => void;
}

const defaultConstraints: MediaStreamConstraints = {
  audio: {
    channelCount: 1,
    sampleRate: 48000,
    sampleSize: 16,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
};

export async function ensureMicrophonePermission(): Promise<PermissionState> {
  if (typeof navigator === 'undefined' || !navigator.permissions) {
    return 'prompt';
  }

  try {
    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return result.state;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Microphone permission query failed', error);
    return 'prompt';
  }
}

export async function requestMicrophoneStream(
  constraints: MediaStreamConstraints = defaultConstraints,
): Promise<MicStreamResult> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('이 브라우저에서는 오디오 녹음이 지원되지 않습니다.');
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const cleanup = () => stopStream(stream);
    return { stream, cleanup };
  } catch (error) {
    throw new Error('마이크 접근이 거부되었습니다. 브라우저 권한을 확인해주세요.');
  }
}

export function stopStream(stream?: MediaStream | null): void {
  if (!stream) {
    return;
  }

  stream.getTracks().forEach((track) => {
    if (track.readyState !== 'ended') {
      track.stop();
    }
  });
}
