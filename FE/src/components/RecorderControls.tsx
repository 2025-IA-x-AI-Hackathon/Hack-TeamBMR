import type { SttSessionState } from '../realtime/useSttSession';

interface RecorderControlsProps {
  state: SttSessionState;
  error: string | null;
  onStart: () => void | Promise<void>;
  onStop: () => void;
}

function formatStateLabel(state: SttSessionState): string {
  switch (state) {
    case 'idle':
      return '대기 중';
    case 'connecting':
      return '연결 중...';
    case 'ready':
      return '준비 완료';
    case 'recording':
      return '녹음 중';
    case 'error':
      return '오류';
    default:
      return state;
  }
}

export function RecorderControls({
  state,
  error,
  onStart,
  onStop,
}: RecorderControlsProps) {
  const isStarting = state === 'connecting';
  const isRecording = state === 'recording';
  const canStart = state === 'idle' || state === 'error';
  const canStop = isRecording || state === 'ready';

  return (
    <div className="panel">
      <h2>실시간 STT</h2>
      <div className="controls">
        <button
          type="button"
          className="primary"
          onClick={onStart}
          disabled={!canStart || isStarting}
        >
          {isStarting ? '시작 중...' : '시작'}
        </button>
        <button
          type="button"
          onClick={onStop}
          disabled={!canStop}
        >
          정지
        </button>
      </div>
      <p className="status-text">
        상태: {formatStateLabel(state)}
      </p>
      {error ? (
        <p className="error-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
