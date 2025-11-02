import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './RoomDetailScreen.css';
import { fetchRoom } from '../api/rooms';
import { fetchAuthToken } from '../api/auth';
import { resolveApiUrl } from '../utils/url';
import type { Room } from '../types/domain';

type LlmReportStatus = 'loading' | 'done' | 'pending' | 'error';

export function RoomDetailScreen() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportStatus, setReportStatus] = useState<LlmReportStatus>('loading');

  const ensureToken = useCallback(async () => {
    if (typeof window === 'undefined') {
      return;
    }
    const token = window.localStorage.getItem('token');
    if (!token) {
      await fetchAuthToken();
    }
  }, []);

  useEffect(() => {
    const loadRoom = async () => {
      if (!roomId) {
        navigate('/home', { replace: true });
        return;
      }
      setLoading(true);
      setError(null);
      try {
        await ensureToken();
        const data = await fetchRoom(roomId);
        setRoom(data);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : '방 정보를 불러오지 못했습니다.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    loadRoom();
  }, [ensureToken, navigate, roomId]);

  useEffect(() => {
    const loadReportStatus = async () => {
      if (!roomId) {
        return;
      }
      try {
        await ensureToken();
        setReportStatus('loading');
        const response = await fetch(resolveApiUrl(`/v1/llm/reports/${encodeURIComponent(roomId)}`), {
          headers: (() => {
            const headers = new Headers({ Accept: 'application/json' });
            if (typeof window !== 'undefined') {
              const token = window.localStorage.getItem('token');
              if (token) {
                headers.set('Authorization', `Bearer ${token}`);
              }
            }
            return headers;
          })(),
        });
        if (response.status === 404 || response.status === 202) {
          setReportStatus('pending');
          return;
        }
        if (!response.ok) {
          setReportStatus('error');
          return;
        }
        const data = await response.json() as { status?: string; room_id?: string; roomId?: string };
        const targetRoomId = data.room_id ?? data.roomId ?? null;
        if (roomId && targetRoomId && targetRoomId !== roomId) {
          setReportStatus('pending');
          return;
        }
        if (data.status === 'done') {
          setReportStatus('done');
        } else if (data.status === 'failed') {
          setReportStatus('error');
        } else {
          setReportStatus('pending');
        }
      } catch (loadError) {
        console.error(loadError);
        setReportStatus('error');
      }
    };
    loadReportStatus();
  }, [ensureToken, roomId]);

  const checklistGroups = useMemo(() => {
    const map = new Map<string, string[]>();
    room?.checklist?.items.forEach((entry) => {
      let category = '기타';
      let question = '';
      let answer = false;
      Object.entries(entry).forEach(([key, value]) => {
        if (key.startsWith('q') && typeof value === 'string') {
          const [rawCategory, rawQuestion] = value.split(' - ');
          category = (rawCategory ?? '기타').trim();
          question = (rawQuestion ?? value).trim();
        }
        if (key.startsWith('a')) {
          answer = Boolean(value);
        }
      });
      const list = map.get(category) ?? [];
      list.push(`${answer ? '✅' : '⬜️'} ${question}`);
      map.set(category, list);
    });
    return Array.from(map.entries());
  }, [room]);

  if (loading) {
    return (
      <div className="room-detail-root">
        <div className="room-detail-device">
          <div className="room-detail-loading">불러오는 중...</div>
        </div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="room-detail-root">
        <div className="room-detail-device">
          <div className="room-detail-error">{error ?? '방 정보를 찾을 수 없습니다.'}</div>
        </div>
      </div>
    );
  }

  const imageSrc = room.photos?.[0]?.objectUrl ? resolveApiUrl(room.photos[0].objectUrl) : '/room_img1.png';
  const depositRent = `${room.deposit.toLocaleString('ko-KR')}/${room.rentMonthly.toLocaleString('ko-KR')}`;
  const meta = `${room.type || '주거 형태 미지정'}, ${room.floor}층, ${room.feeIncluded ? '관리비 포함' : room.feeMgmt ? `관리비 ${room.feeMgmt.toLocaleString('ko-KR')}만` : '관리비 없음'}`;

  const primaryHref = reportStatus === 'done'
    ? `/rooms/${room.roomId}/report`
    : `/rooms/${room.roomId}/record`;

  const primaryLabel = reportStatus === 'done' ? 'AI 종합 리포트 보러가기' : '계약 대화 모니터링';

  return (
    <div className="room-detail-root">
      <div className="room-detail-device">
        <div className="room-detail-status-bar">
          <div className="status-time">9:41</div>
          <div className="status-levels">
            <div className="status-icon cellular">
              <span />
              <span />
              <span />
              <span />
            </div>
            <svg
              className="status-icon wifi"
              width="20"
              height="16"
              viewBox="0 0 20 16"
              aria-hidden
            >
              <path
                d="M10 15.5c.8 0 1.45-.65 1.45-1.45S10.8 12.6 10 12.6s-1.45.65-1.45 1.45S9.2 15.5 10 15.5z"
                fill="currentColor"
              />
              <path
                d="M10 10.2c1.84 0 3.58.72 4.88 2.02l1.35-1.35C14.6 9.24 12.38 8.3 10 8.3s-4.6.94-6.23 2.58l1.35 1.35A6.88 6.88 0 0110 10.2z"
                fill="currentColor"
                opacity=".75"
              />
              <path
                d="M10 5.8c3.34 0 6.41 1.36 8.63 3.58L20 8 19.77 7.7C17.22 5.16 13.73 3.7 10 3.7S2.78 5.16.23 7.7L0 8l1.37 1.38A12.18 12.18 0 0110 5.8z"
                fill="currentColor"
                opacity=".45"
              />
            </svg>
            <div className="status-icon battery" aria-hidden>
              <div className="battery-body">
                <div className="battery-charge" />
              </div>
              <div className="battery-cap" />
            </div>
          </div>
        </div>

        <header className="room-detail-header">
          <button
            type="button"
            className="back-button"
            onClick={() => navigate(-1)}
            aria-label="이전으로"
          />
          <h1>방 정보 확인</h1>
        </header>

        <main className="room-detail-content">
          <section className="room-section">
            <h2>방 정보</h2>
            <div className="room-card">
              <div className="room-photo">
                <img src={imageSrc} alt={room.address} />
              </div>
              <div className="room-card-info">
                <p className="room-address">{room.address}</p>
                <p className="room-meta">{meta}</p>
              </div>
              <div className="room-card-summary">
                <span>{depositRent}</span>
                <span>⭐ 4.5 / 5.0</span>
              </div>
            </div>
          </section>

          <section className="room-section">
            <h2>체크리스트</h2>
            <div className="checklist">
              {checklistGroups.map(([category, items]) => (
                <div key={category} className="checklist-group">
                  <h3>{category}</h3>
                  <ul>
                    {items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </main>

        <div className="room-detail-actions">
          <button
            type="button"
            className="detail-primary"
            onClick={() => navigate(primaryHref)}
          >
            {primaryLabel}
          </button>
        </div>

        <div className="detail-home-indicator">
          <span className="home-bar" />
        </div>
      </div>
    </div>
  );
}
