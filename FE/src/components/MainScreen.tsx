import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import './MainScreen.css';
import { fetchRooms } from '../api/rooms';
import { fetchAuthToken } from '../api/auth';
import type { Room } from '../types/domain';
import { resolveApiUrl } from '../utils/url';

const FALLBACK_IMAGES = ['/room_img1.png', '/room_img2.png'];

function formatDepositRent(room: Room): string {
  const deposit = room.deposit.toLocaleString('ko-KR');
  const rent = room.rentMonthly.toLocaleString('ko-KR');
  return `${deposit}/${rent}`;
}

function formatMeta(room: Room): string {
  const type = room.type || '주거 형태 미지정';
  const floor = `${room.floor}층`;
  const fee = room.feeIncluded
    ? '관리비 포함'
    : room.feeMgmt
      ? `관리비 ${room.feeMgmt.toLocaleString('ko-KR')}만`
      : '관리비 없음';
  return `${type}, ${floor}, ${fee}`;
}

function pickPhoto(room: Room, index: number): string {
  const photo = room.photos?.[0];
  if (photo?.objectUrl) {
    return resolveApiUrl(photo.objectUrl);
  }
  return FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];
}

export function MainScreen() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureToken = useCallback(async () => {
    if (typeof window === 'undefined') {
      return;
    }
    const token = window.localStorage.getItem('token');
    if (!token) {
      await fetchAuthToken();
    }
  }, []);

  const loadRooms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await ensureToken();
      const data = await fetchRooms({ page: 0, size: 20 });
      setRooms(data);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : '방 목록을 불러오지 못했습니다.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [ensureToken]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const sortedRooms = useMemo(
    () => rooms.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [rooms],
  );

  const handleAddRoom = useCallback(() => {
    navigate('/add-room');
  }, [navigate]);

  const handleRefresh = useCallback(() => {
    loadRooms();
  }, [loadRooms]);

  return (
    <div className="home-root">
      <div className="home-device">
        <div className="home-status-bar">
          <div className="home-time">9:41</div>
          <div className="home-levels">
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

        <header className="home-header">
          <h1>
            처음이라 막막하죠?
            <br />
            제가 방 보러 같이 가드릴게요.
          </h1>
        </header>

        <main className="home-content">
          {error ? <div className="home-error">{error}</div> : null}
          {!error && sortedRooms.length === 0 && !loading ? (
            <div className="home-empty">
              <p>첫 방을 보러 가볼까요?</p>
              <p>새로운 방을 추가하면 목록이 여기에 표시됩니다.</p>
            </div>
          ) : null}

          {!error && sortedRooms.length > 0 ? (
            <ul className="home-room-list">
              {sortedRooms.map((room, index) => (
                <li
                  key={room.roomId}
                  className="home-room-card"
                  onClick={() => navigate(`/rooms/${room.roomId}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/rooms/${room.roomId}`);
                    }
                  }}
                >
                  <div className="room-image-wrapper">
                    <img src={pickPhoto(room, index)} alt={room.address} />
                  </div>
                  <div className="room-info">
                    <div>
                      <p className="room-address">{room.address}</p>
                      <p className="room-meta">{formatMeta(room)}</p>
                    </div>
                    <div className="room-summary">
                      <span className="room-price">{formatDepositRent(room)}</span>
                      <span className="room-rating">⭐ 4.5 / 5.0</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </main>

        <div className="home-cta">
          <button
            type="button"
            className="home-add-button"
            onClick={handleAddRoom}
            disabled={loading}
          >
            방 추가하기
          </button>
        </div>

        <div className="home-indicator">
          <span className="home-bar" />
        </div>
      </div>
    </div>
  );
}
