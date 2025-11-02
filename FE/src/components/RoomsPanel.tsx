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
import { fetchRoomChecklist } from '../api/checklists';
import { fetchAuthToken } from '../api/auth';
import type { ChecklistMapEntry, CreateRoomPayload, Room, RoomPhoto } from '../types/domain';
import { resolveApiUrl } from '../utils/url';

interface RoomsPanelProps {
  onSelectionChange?: (roomId: string | null) => void;
}

interface RoomFormState {
  address: string;
  type: string;
  floor: string;
  deposit: string;
  rentMonthly: string;
  feeIncluded: boolean;
  feeMgmt: string;
  checklistSources: ChecklistMapEntry[];
  checklist: Record<string, boolean>;
}

const initialForm: RoomFormState = {
  address: '',
  type: 'lease',
  floor: '0',
  deposit: '0',
  rentMonthly: '0',
  feeIncluded: true,
  feeMgmt: '0',
  checklistSources: [],
  checklist: {},
};

function buildChecklistState(entries: ChecklistMapEntry[]): Record<string, boolean> {
  const state: Record<string, boolean> = {};
  entries.forEach((entry) => {
    Object.entries(entry).forEach(([key, value]) => {
      if (key.startsWith('a')) {
        state[key] = typeof value === 'boolean' ? value : false;
      }
    });
  });
  return state;
}

function describeChecklistEntry(entry: ChecklistMapEntry, index: number): { question: string; answerKey: string } {
  let question = `항목 ${index + 1}`;
  let answerKey = `a${index + 1}`;
  Object.entries(entry).forEach(([key, value]) => {
    if (key.startsWith('q') && typeof value === 'string') {
      question = value;
    }
    if (key.startsWith('a')) {
      answerKey = key;
    }
  });
  return { question, answerKey };
}

function toAbsoluteUrl(url: string): string {
  if (!url) {
    return url;
  }
  if (/^https?:\/\//.test(url)) {
    return url;
  }
  return resolveApiUrl(url);
}

export function RoomsPanel({ onSelectionChange }: RoomsPanelProps = {}) {
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

useEffect(() => {
  const initialiseChecklist = async () => {
    try {
      if (typeof window !== 'undefined' && !window.localStorage.getItem('token')) {
        await fetchAuthToken();
      }
      const entries = await fetchRoomChecklist();
      setForm((prev) => ({
        ...prev,
        checklistSources: entries,
        checklist: buildChecklistState(entries),
      }));
    } catch (initError) {
      // eslint-disable-next-line no-console
      console.warn('Failed to load checklist templates for room creation', initError);
    }
  };
  initialiseChecklist();
}, []);

  const loadRooms = useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      if (typeof window !== 'undefined' && !window.localStorage.getItem('token')) {
        await fetchAuthToken();
      }
      const items = await fetchRooms({ page: 0, size: 20 });
      setRooms(items);
      if (!selectedRoomId && items.length) {
        setSelectedRoomId(items[0].roomId);
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
      if (typeof window !== 'undefined' && !window.localStorage.getItem('token')) {
        await fetchAuthToken();
      }
      const detail = await fetchRoom(roomId);
      setSelectedRoom(detail);
      setRooms((prev) => prev.map((room) => (room.roomId === roomId ? detail : room)));
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
    onSelectionChange?.(selectedRoomId);
  }, [selectedRoomId, onSelectionChange]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => {
      setToast(null);
    }, 3_000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleInputChange = useCallback(<K extends keyof RoomFormState>(field: K, value: RoomFormState[K]) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handleChecklistToggle = useCallback((answerKey: string) => {
    if (!answerKey) {
      return;
    }
    setForm((prev) => ({
      ...prev,
      checklist: {
        ...prev.checklist,
        [answerKey]: !prev.checklist[answerKey],
      },
    }));
  }, []);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (typeof window !== 'undefined' && !window.localStorage.getItem('token')) {
        await fetchAuthToken();
      }
      const floorValue = Number(form.floor);
      const depositValue = Number(form.deposit);
      const rentValue = Number(form.rentMonthly);
      const feeMgmtValue = form.feeMgmt ? Number(form.feeMgmt) : 0;

      if ([floorValue, depositValue, rentValue].some(Number.isNaN)) {
        throw new Error('층, 보증금, 월세는 숫자여야 합니다.');
      }

      if (Number.isNaN(feeMgmtValue)) {
        throw new Error('관리비는 숫자여야 합니다.');
      }

      const checklistItems = form.checklistSources.map((entry) => {
        const updated: ChecklistMapEntry = { ...entry };
        Object.keys(updated).forEach((key) => {
          if (key.startsWith('a')) {
            updated[key] = form.checklist[key] ?? false;
          }
        });
        return updated;
      });

      const payload: CreateRoomPayload = {
        address: form.address.trim(),
        type: form.type.trim(),
        floor: floorValue,
        deposit: depositValue,
        rent_monthly: rentValue,
        fee_included: form.feeIncluded,
        fee_mgmt: feeMgmtValue,
        checklist: {
          items: checklistItems,
        },
      };

      const room = await createRoom(payload);
      setRooms((prev) => [room, ...prev.filter((existing) => existing.roomId !== room.roomId)]);
      setForm((prev) => ({
        ...initialForm,
        checklistSources: prev.checklistSources,
        checklist: buildChecklistState(prev.checklistSources),
      }));
      setToast('방이 생성되었습니다.');
      setSelectedRoomId(room.roomId);
      setSelectedRoom(room);
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
      if (typeof window !== 'undefined' && !window.localStorage.getItem('token')) {
        await fetchAuthToken();
      }
      await deleteRoom(roomId);
      setRooms((prev) => prev.filter((room) => room.roomId !== roomId));
      if (selectedRoomId === roomId) {
        setSelectedRoomId(null);
        setSelectedRoom(null);
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
      if (typeof window !== 'undefined' && !window.localStorage.getItem('token')) {
        await fetchAuthToken();
      }
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
        setRooms((roomsState) => roomsState.map((room) => (
          room.roomId === selectedRoomId ? { ...room, photos } : room
        )));
        return { ...prev, photos };
      });
      setToast('사진이 업로드되었습니다.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '사진 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  }, [selectedRoomId]);

  const sortedRooms = useMemo(
    () => rooms.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [rooms],
  );

  return (
    <div className="panel">
      <h2>방 관리</h2>

      <form
        className="room-form"
        onSubmit={handleSubmit}
      >
        <div className="field-group">
          <label htmlFor="room-address">주소</label>
          <input
            id="room-address"
            type="text"
            value={form.address}
            onChange={(event) => handleInputChange('address', event.target.value)}
            required
          />
        </div>
        <div className="field-row">
          <div className="field-group">
            <label htmlFor="room-type">주거 유형</label>
            <input
              id="room-type"
              type="text"
              value={form.type}
              onChange={(event) => handleInputChange('type', event.target.value)}
              required
            />
          </div>
          <div className="field-group">
            <label htmlFor="room-floor">층수</label>
            <input
              id="room-floor"
              type="number"
              min="0"
              value={form.floor}
              onChange={(event) => handleInputChange('floor', event.target.value)}
              required
            />
          </div>
        </div>
        <div className="field-row">
          <div className="field-group">
            <label htmlFor="room-deposit">보증금(만원)</label>
            <input
              id="room-deposit"
              type="number"
              min="0"
              value={form.deposit}
              onChange={(event) => handleInputChange('deposit', event.target.value)}
              required
            />
          </div>
          <div className="field-group">
            <label htmlFor="room-rent">월세(만원)</label>
            <input
              id="room-rent"
              type="number"
              min="0"
              value={form.rentMonthly}
              onChange={(event) => handleInputChange('rentMonthly', event.target.value)}
              required
            />
          </div>
        </div>
        <div className="field-row">
          <div className="field-group checkbox">
            <label htmlFor="room-fee-included">
              <input
                id="room-fee-included"
                type="checkbox"
                checked={form.feeIncluded}
                onChange={(event) => handleInputChange('feeIncluded', event.target.checked)}
              />
              관리비 포함
            </label>
          </div>
          <div className="field-group">
            <label htmlFor="room-fee-mgmt">관리비(만원)</label>
              <input
                id="room-fee-mgmt"
                type="number"
                min="0"
                value={form.feeMgmt}
                onChange={(event) => handleInputChange('feeMgmt', event.target.value)}
              />
          </div>
        </div>
        <fieldset className="checklist-fieldset">
          <legend>체크리스트</legend>
          {form.checklistSources.length ? (
            <ul className="checklist-options">
              {form.checklistSources.map((entry, index) => {
                const { question, answerKey } = describeChecklistEntry(entry, index);
                if (!answerKey) {
                  return null;
                }
                const checked = form.checklist[answerKey] ?? false;
                return (
                  <li key={answerKey}>
                    <label>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleChecklistToggle(answerKey)}
                      />
                      <span>{question}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted-text">체크리스트 항목을 불러오는 중입니다.</p>
          )}
        </fieldset>
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
                key={room.roomId}
                className={room.roomId === selectedRoomId ? 'selected' : ''}
              >
                <button
                  type="button"
                  onClick={() => handleSelectRoom(room.roomId)}
                >
                  {room.address || room.roomId}
                </button>
                <span className="room-price">
                  보증금 {room.deposit.toLocaleString('ko-KR')} / 월세 {room.rentMonthly.toLocaleString('ko-KR')}
                </span>
                <button
                  type="button"
                  className="link danger"
                  onClick={() => handleDeleteRoom(room.roomId)}
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
                <strong>주소: </strong>
                {selectedRoom.address}
              </p>
              <p>
                <strong>유형: </strong>
                {selectedRoom.type}
              </p>
              <p>
                <strong>층수: </strong>
                {selectedRoom.floor}층
              </p>
              <p>
                <strong>보증금 / 월세: </strong>
                {selectedRoom.deposit.toLocaleString('ko-KR')} / {selectedRoom.rentMonthly.toLocaleString('ko-KR')} 만원
              </p>
              <p>
                <strong>관리비 포함: </strong>
                {selectedRoom.feeIncluded ? '예' : '아니오'}
                {selectedRoom.feeMgmt !== undefined ? ` (관리비 ${selectedRoom.feeMgmt.toLocaleString('ko-KR')} 만원)` : ''}
              </p>
              <p>
                <strong>생성일: </strong>
                {new Date(selectedRoom.createdAt).toLocaleString('ko-KR')}
              </p>
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
                {selectedRoom.photos.map((photo) => (
                  <img
                    key={photo.photoId}
                    src={toAbsoluteUrl(photo.objectUrl)}
                    alt={`Room ${selectedRoom.address}`}
                  />
                ))}
              </div>

              <div className="room-checklist-summary">
                <h4>체크리스트</h4>
                {selectedRoom.checklist?.items?.length ? (
                  <ul>
                    {selectedRoom.checklist.items.map((entry, index) => {
                      const { question, answerKey } = describeChecklistEntry(entry, index);
                      const value = entry[answerKey];
                      let badge = '미확인';
                      if (value === true) badge = '✅';
                      if (value === false) badge = '❌';
                      return (
                        <li key={answerKey || question}>
                          <span>{question}</span>
                          <span className="badge">{badge}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="muted-text">체크리스트 정보가 없습니다.</p>
                )}
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
