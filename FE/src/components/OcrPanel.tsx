import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { uploadOcrImage, fetchOcrReport } from '../api/ocr';
import type { OcrReport } from '../types/domain';
import { getRealtimeClient } from '../realtime/ws';
import type { OcrProgressPayload } from '../realtime/stt.types';

type OcrStatus = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

function normalizeOcrReport(raw: Partial<OcrReport> & {
  ocr_id?: string;
  status?: string;
  text?: string;
  fields?: { key: string; value: string; confidence?: number }[];
}): OcrReport {
  return {
    ocrId: raw.ocrId ?? raw.ocr_id ?? '',
    status: (raw.status as OcrReport['status']) ?? 'done',
    text: raw.text ?? '',
    fields: raw.fields ?? [],
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

export function OcrPanel() {
  const client = useMemo(() => getRealtimeClient(), []);
  const [status, setStatus] = useState<OcrStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progressStage, setProgressStage] = useState<string | null>(null);
  const [report, setReport] = useState<OcrReport | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const reportIdRef = useRef<string | null>(null);

  useEffect(() => {
    client.connect();
  }, [client]);

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) {
      return;
    }

    const file = files[0];
    setStatus('uploading');
    setError(null);
    setProgressStage(null);
    setReport(null);

    try {
      const { ocrId } = await uploadOcrImage(file);
      reportIdRef.current = ocrId;
      setReportId(ocrId);
      setStatus('processing');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'OCR 업로드 중 오류가 발생했습니다.');
      setStatus('error');
    } finally {
      event.target.value = '';
    }
  }, []);

  useEffect(() => {
    if (!reportId || status !== 'processing') {
      return undefined;
    }

    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const response = await fetchOcrReport(reportId);
        if (cancelled) {
          return;
        }

        if (response.status === 200) {
          const payload = await response.json() as OcrReport;
          const normalized = normalizeOcrReport(payload);
          setReport(normalized);
          setStatus('done');
          setProgressStage('완료');
          return;
        }

        if (response.status === 202) {
          timer = window.setTimeout(poll, 2_000);
        }
      } catch (pollError) {
        if (!cancelled) {
          setError(pollError instanceof Error ? pollError.message : 'OCR 결과 조회 중 오류가 발생했습니다.');
          setStatus('error');
        }
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [reportId, status]);

  useEffect(() => {
    const unsubscribeProgress = client.subscribe('ocr.progress', (payload) => {
      const progress = payload as OcrProgressPayload;
      if (reportIdRef.current && progress.ocr_id !== reportIdRef.current) {
        return;
      }
      setStatus('processing');
      setProgressStage(progress.stage);
    });

    const unsubscribeDone = client.subscribe('ocr.done', (payload) => {
      const normalized = normalizeOcrReport(payload as OcrReport);
      reportIdRef.current = normalized.ocrId;
      setReportId(normalized.ocrId);
      setReport(normalized);
      setStatus('done');
      setProgressStage('완료');
    });

    return () => {
      unsubscribeProgress();
      unsubscribeDone();
    };
  }, [client]);

  return (
    <div className="panel">
      <h2>OCR 리포트</h2>
      <div className="field-group">
        <label htmlFor="ocr-upload">이미지 업로드</label>
        <input
          id="ocr-upload"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={status === 'uploading' || status === 'processing'}
        />
      </div>

      {status === 'uploading' ? <div className="spinner">업로드 중...</div> : null}
      {status === 'processing' ? (
        <div className="status-text">
          처리 중... {progressStage ? `(${progressStage})` : null}
        </div>
      ) : null}

      {error ? <div className="error-text">{error}</div> : null}

      {report ? (
        <div className="ocr-report">
          <h3>추출 결과</h3>
          <pre>{report.text}</pre>
          {report.fields?.length ? (
            <table>
              <thead>
                <tr>
                  <th>항목</th>
                  <th>값</th>
                  <th>정확도</th>
                </tr>
              </thead>
              <tbody>
                {report.fields.map((field) => (
                  <tr key={field.key}>
                    <td>{field.key}</td>
                    <td>{field.value}</td>
                    <td>{field.confidence ? `${Math.round(field.confidence * 100)}%` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
