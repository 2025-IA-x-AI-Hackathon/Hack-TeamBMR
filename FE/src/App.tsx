import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { RecorderControls } from './components/RecorderControls';
import { TranscriptDisplay } from './components/TranscriptDisplay';
import { QaSummaryPanel } from './components/QaSummaryPanel';
import { RoomsPanel } from './components/RoomsPanel';
import { ChecklistPanel } from './components/ChecklistPanel';
import { OcrPanel } from './components/OcrPanel';
import { LlmReportPanel } from './components/LlmReportPanel';
import { useSttSession } from './realtime/useSttSession';

function App() {
  const {
    state,
    error,
    partial,
    bubbles,
    qaPairs,
    stats,
    start,
    stop,
  } = useSttSession();
  const [toast, setToast] = useState<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }

    if (state === 'recording') {
      setToast('녹음을 시작했습니다.');
    } else if (state === 'idle') {
      setToast('녹음을 종료했습니다.');
    }
  }, [state]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 2_000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <div className="app-shell">
      <header>
        <h1>실시간 음성 회의 도우미</h1>
        <p>STT, 방 관리, 체크리스트, OCR, LLM 리포트를 한곳에서 확인하세요.</p>
      </header>

      {toast ? <div className="global-toast">{toast}</div> : null}

      <main>
        <section className="grid two-columns">
          <div className="column stt-column">
            <RecorderControls
              state={state}
              error={error}
              onStart={start}
              onStop={stop}
            />
            <TranscriptDisplay
              bubbles={bubbles}
              partial={partial}
            />
            <QaSummaryPanel
              pairs={qaPairs}
              visible={state === 'idle'}
            />
            {stats ? (
              <div className="panel stats-panel">
                <h3>세션 통계</h3>
                <div className="stats-grid">
                  <div>
                    <span className="label">전송 바이트</span>
                    <span>{stats.bytes.toLocaleString('ko-KR')}</span>
                  </div>
                  <div>
                    <span className="label">청크 수</span>
                    <span>{stats.chunks}</span>
                  </div>
                  <div>
                    <span className="label">부분 인식</span>
                    <span>{stats.partials}</span>
                  </div>
                  <div>
                    <span className="label">최종 문장</span>
                    <span>{stats.finals}</span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <div className="column">
            <RoomsPanel />
          </div>
        </section>

        <section className="grid three-columns">
          <ChecklistPanel />
          <OcrPanel />
          <LlmReportPanel />
        </section>
      </main>
    </div>
  );
}

export default App;
