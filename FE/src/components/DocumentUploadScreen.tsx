import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './DocumentUploadScreen.css';
import { fetchAuthToken } from '../api/auth';
import { api } from '../api/http';
import { getRealtimeClient } from '../realtime/ws';

type UploadType = '주택임대차표준계약서' | '등기사항전부증명서' | '중개대상물확인설명서';

export function DocumentUploadScreen() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [uploadingType, setUploadingType] = useState<UploadType | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!roomId) {
      navigate('/home', { replace: true });
    }
  }, [navigate, roomId]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 4_000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleFileChange = useCallback((type: UploadType) => async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !roomId) {
      return;
    }

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('PDF 파일만 업로드할 수 있습니다.');
      event.target.value = '';
      return;
    }

    setUploadingType(type);
    setError(null);
    try {
      await fetchAuthToken();
      const form = new FormData();
      form.append('file', file);

      await api(`/v1/ocr/uploads/${encodeURIComponent(roomId)}?file_type=${encodeURIComponent(type)}`, {
        method: 'POST',
        body: form,
      });
      if (type === '주택임대차표준계약서') {
        setToast('임대차계약서를 업로드했습니다.');
      } else if (type === '등기사항전부증명서') {
        setToast('등기부등본을 업로드했습니다.');
      } else {
        setToast('중개대상물확인설명서를 업로드했습니다.');
      }
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : '업로드에 실패했습니다.';
      setError(message);
    } finally {
      setUploadingType(null);
      event.target.value = '';
    }
  }, [roomId]);

  const handleGenerateReport = useCallback(async () => {
    if (!roomId) {
      return;
    }

    try {
      setGenerating(true);
      setError(null);
      await fetchAuthToken();
      await api(`/v1/llm/reports/${encodeURIComponent(roomId)}`, { method: 'POST' });
      setToast('AI 종합 리포트를 생성 중입니다. 잠시만 기다려 주세요!');
    } catch (generateError) {
      const message = generateError instanceof Error ? generateError.message : '리포트를 생성할 수 없습니다.';
      setError(message);
    } finally {
      setGenerating(false);
    }
  }, [roomId]);

  useEffect(() => {
    const client = getRealtimeClient();
    client.connect();

    const extractRoomId = (value: unknown): string | null => {
      if (!value || typeof value !== 'object') {
        return null;
      }
      const record = value as Record<string, unknown>;
      const candidate = record.roomId ?? record.room_id ?? record.report_id;
      return typeof candidate === 'string' ? candidate : null;
    };

    const unsubscribeLlm = client.subscribe('llm.done', (payload) => {
      const targetRoomId = extractRoomId(payload);
      if (roomId && targetRoomId && targetRoomId !== roomId) {
        return;
      }
      setGenerating(false);
      setToast('AI 종합 리포트가 생성되었습니다!');
    });

    const unsubscribeOcr = client.subscribe('ocr.done', () => {
      setToast('서류 분석이 완료되었습니다! 결과를 확인해 주세요.');
    });

    return () => {
      unsubscribeLlm();
      unsubscribeOcr();
    };
  }, [roomId]);

  return (
    <div className="doc-root">
      <div className="doc-device">
        <div className="doc-status-bar">
          <div className="doc-time">9:41</div>
          <div className="doc-levels">
            <div className="status-icon cellular">
              <span /><span /><span /><span />
            </div>
            <svg className="status-icon wifi" width="20" height="16" viewBox="0 0 20 16" aria-hidden>
              <path d="M10 15.5c.8 0 1.45-.65 1.45-1.45S10.8 12.6 10 12.6s-1.45.65-1.45 1.45S9.2 15.5 10 15.5z" fill="currentColor" />
              <path d="M10 10.2c1.84 0 3.58.72 4.88 2.02l1.35-1.35C14.6 9.24 12.38 8.3 10 8.3s-4.6.94-6.23 2.58l1.35 1.35A6.88 6.88 0 0 1 10 10.2z" fill="currentColor" opacity=".75" />
              <path d="M10 5.8c3.34 0 6.41 1.36 8.63 3.58L20 8l-.23-.3C17.22 5.16 13.73 3.7 10 3.7S2.78 5.16.23 7.7L0 8l1.37 1.38A12.18 12.18 0 0 1 10 5.8z" fill="currentColor" opacity=".45" />
            </svg>
            <div className="status-icon battery" aria-hidden>
              <div className="battery-body">
                <div className="battery-charge" />
              </div>
              <div className="battery-cap" />
            </div>
          </div>
        </div>

        <header className="doc-header">
          <button
            type="button"
            className="back-button"
            onClick={() => navigate(-1)}
            aria-label="이전으로"
          />
          <h1>서류 업로드</h1>
        </header>

        <main className="doc-content">
          <section className="doc-upload-group">
            <h2>임대차계약서 업로드</h2>
            <label className={`doc-upload-box${uploadingType === '주택임대차표준계약서' ? ' uploading' : ''}`}>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange('주택임대차표준계약서')}
                disabled={uploadingType !== null}
              />
              <span className="doc-upload-icon" aria-hidden>
                <svg width="26" height="24" viewBox="0 0 26 24" fill="none">
                  <path d="M13 1v15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M6 8l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 15v6h18v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <span className="doc-upload-text">파일 업로드 (pdf)</span>
            </label>
          </section>

          <section className="doc-upload-group">
            <h2>등기부등본 업로드</h2>
            <label className={`doc-upload-box${uploadingType === '등기사항전부증명서' ? ' uploading' : ''}`}>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange('등기사항전부증명서')}
                disabled={uploadingType !== null}
              />
              <span className="doc-upload-icon" aria-hidden>
                <svg width="26" height="24" viewBox="0 0 26 24" fill="none">
                  <path d="M13 1v15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M6 8l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 15v6h18v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <span className="doc-upload-text">파일 업로드 (pdf)</span>
            </label>
          </section>

          <section className="doc-upload-group">
            <h2>중개대상물 확인설명서 업로드</h2>
            <label className={`doc-upload-box${uploadingType === '중개대상물확인설명서' ? ' uploading' : ''}`}>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange('중개대상물확인설명서')}
                disabled={uploadingType !== null}
              />
              <span className="doc-upload-icon" aria-hidden>
                <svg width="26" height="24" viewBox="0 0 26 24" fill="none">
                  <path d="M13 1v15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M6 8l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 15v6h18v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <span className="doc-upload-text">파일 업로드 (pdf)</span>
            </label>
          </section>

          <p className="doc-note">*서류 업로드는 pdf 파일만 지원합니다</p>
          <p className="doc-note">*이후 이미지 파일 및 촬영 기능 추가 예정</p>

          {error ? <div className="doc-error">{error}</div> : null}
        </main>

        <div className="doc-actions">
          <button
            type="button"
            className="generate-button"
            onClick={handleGenerateReport}
            disabled={generating || !roomId}
          >
            {generating ? '리포트 생성 중...' : 'AI 종합 리포트 만들기'}
          </button>
        </div>

        {toast ? <div className="doc-toast">{toast}</div> : null}

        <div className="doc-home-indicator">
          <span className="home-bar" />
        </div>
      </div>
    </div>
  );
}
