import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  createRoom,
  deleteRoom,
  fetchRoom,
  fetchRooms,
  uploadRoomPhoto,
} from '../api/rooms';
import type { Room, RoomPhoto } from '../types/domain';
import { resolveApiUrl } from '../utils/url';
import { AudioPlayer } from './AudioPlayer';

interface RoomFormState {
  title: string;
  category: string;
  price: string;
  address: string;
  description: string;
}

const initialForm: RoomFormState = {
  title: '',
  category: 'lease',
  price: '',
  address: '',
  description: '',
};

function toAbsoluteUrl(url: string): string {
  if (!url) {
    return url;
  }
  if (/^https?:\/\//.test(url)) {
    return url;
  }
  return resolveApiUrl(url);
}

export function RoomsPanel() {
  const [form, setForm] = useState<RoomFormState>(initialForm);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      const { items } = await fetchRooms({ page: 0, size: 20 });
      setRooms(items);
      if (!selectedRoomId && items.length) {
        setSelectedRoomId(items[0].id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '방 목록을 불러오지 못했습니다.');
    } finally {
      setListLoading(false);
    }
  }, [selectedRoomId]);

  const loadRoomDetail = useCallback(async (roomId: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      const detail = await fetchRoom(roomId);
      setSelectedRoom(detail);
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : '방 정보를 불러오지 못했습니다.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    if (selectedRoomId) {
      loadRoomDetail(selectedRoomId);
    } else {
      setSelectedRoom(null);
    }
  }, [selectedRoomId, loadRoomDetail]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => {
      setToast(null);
    }, 3_000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleInputChange = useCallback((field: keyof RoomFormState, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const priceValue = Number(form.price);
      if (Number.isNaN(priceValue)) {
        throw new Error('가격은 숫자여야 합니다.');
      }

      const payload = {
        title: form.title,
        category: form.category,
        price: priceValue,
        address: form.address || undefined,
        description: form.description || undefined,
      };

      const room = await createRoom(payload);
      setRooms((prev) => [room, ...prev]);
      setForm(initialForm);
      setToast('방이 생성되었습니다.');
      setSelectedRoomId(room.id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '방 생성 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }, [form]);

  const handleSelectRoom = useCallback((roomId: string) => {
    setSelectedRoomId(roomId);
  }, []);

  const handleDeleteRoom = useCallback(async (roomId: string) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) {
      return;
    }

    setError(null);
    try {
      await deleteRoom(roomId);
      setRooms((prev) => prev.filter((room) => room.id !== roomId));
      if (selectedRoomId === roomId) {
        setSelectedRoomId(null);
      }
      setToast('방이 삭제되었습니다.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '방 삭제 중 오류가 발생했습니다.');
    }
  }, [selectedRoomId]);

  const handlePhotoUpload = useCallback(async (files: FileList | null) => {
    if (!files?.length || !selectedRoomId) {
      return;
    }

    const file = files[0];
    setUploading(true);
    setError(null);
    try {
      const photo = await uploadRoomPhoto(selectedRoomId, file);
      const normalizedPhoto: RoomPhoto = {
        ...photo,
        objectUrl: toAbsoluteUrl(photo.objectUrl),
      };

      setSelectedRoom((prev) => {
        if (!prev) {
          return prev;
        }
        const photos = [...(prev.photos ?? []), normalizedPhoto];
        return { ...prev, photos };
      });
      setToast('사진이 업로드되었습니다.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '사진 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  }, [selectedRoomId]);

  const sortedRooms = useMemo(() => rooms.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), [rooms]);

  return (
    <div className="panel">
      <h2>방 관리</h2>

      <form
        className="room-form"
        onSubmit={handleSubmit}
      >
        <div className="field-group">
          <label htmlFor="room-title">방 이름</label>
          <input
            id="room-title"
            type="text"
            value={form.title}
            onChange={(event) => handleInputChange('title', event.target.value)}
            required
          />
        </div>
        <div className="field-row">
          <div className="field-group">
            <label htmlFor="room-category">카테고리</label>
            <input
              id="room-category"
              type="text"
              value={form.category}
              onChange={(event) => handleInputChange('category', event.target.value)}
              required
            />
          </div>
          <div className="field-group">
            <label htmlFor="room-price">가격(만원)</label>
            <input
              id="room-price"
              type="number"
              min="0"
              value={form.price}
              onChange={(event) => handleInputChange('price', event.target.value)}
              required
            />
          </div>
        </div>
        <div className="field-group">
          <label htmlFor="room-address">주소</label>
          <input
            id="room-address"
            type="text"
            value={form.address}
            onChange={(event) => handleInputChange('address', event.target.value)}
          />
        </div>
        <div className="field-group">
          <label htmlFor="room-description">설명</label>
          <textarea
            id="room-description"
            value={form.description}
            onChange={(event) => handleInputChange('description', event.target.value)}
            rows={3}
          />
        </div>
        <button
          type="submit"
          className="primary"
          disabled={saving}
        >
          {saving ? '저장 중...' : '방 생성'}
        </button>
      </form>

      {toast ? (
        <div className="toast">
          {toast}
        </div>
      ) : null}

      {error ? (
        <div className="error-text">
          {error}
        </div>
      ) : null}

      <div className="room-layout">
        <div className="room-list">
          <h3>방 목록</h3>
          {listLoading ? <div className="spinner">불러오는 중...</div> : null}
          <ul>
            {sortedRooms.map((room) => (
              <li
                key={room.id}
                className={room.id === selectedRoomId ? 'selected' : ''}
              >
                <button
                  type="button"
                  onClick={() => handleSelectRoom(room.id)}
                >
                  {room.title}
                </button>
                <span className="room-price">
                  {room.price.toLocaleString('ko-KR')} 만원
                </span>
                <button
                  type="button"
                  className="link danger"
                  onClick={() => handleDeleteRoom(room.id)}
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="room-detail">
          <h3>상세 정보</h3>
          {detailLoading ? <div className="spinner">로딩 중...</div> : null}
          {selectedRoom ? (
            <>
              <p>
                <strong>카테고리: </strong>
                {selectedRoom.category}
              </p>
              <p>
                <strong>주소: </strong>
                {selectedRoom.address ?? '미입력'}
              </p>
              <p>
                <strong>설명: </strong>
                {selectedRoom.description ?? '없음'}
              </p>
              <p>
                <strong>생성일: </strong>
                {new Date(selectedRoom.createdAt).toLocaleString('ko-KR')}
              </p>

              <AudioPlayer
                src={selectedRoom.audioUrl ? toAbsoluteUrl(selectedRoom.audioUrl) : undefined}
              />

              <div className="field-group">
                <label htmlFor="room-photo-upload">사진 업로드</label>
                <input
                  id="room-photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={(event) => handlePhotoUpload(event.target.files)}
                  disabled={uploading}
                />
                {uploading ? <span className="status-text">업로드 중...</span> : null}
              </div>

              <div className="photos-grid">
                {(selectedRoom.photos ?? []).map((photo) => (
                  <img
                    key={photo.photoId}
                    src={toAbsoluteUrl(photo.objectUrl)}
                    alt={`Room ${selectedRoom.title}`}
                  />
                ))}
              </div>
            </>
          ) : (
            <p>선택된 방이 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
