import { api } from './http';
import {
  ChecklistMapEntry,
  CreateRoomPayload,
  Room,
  RoomPhoto,
} from '../types/domain';

interface RawRoomPhoto {
  photo_id?: string;
  object_url?: string;
  created_at?: string;
  updated_at?: string;
}

interface RawRoom {
  room_id?: string;
  address?: string;
  type?: string;
  floor?: number;
  deposit?: number;
  rent_monthly?: number;
  fee_included?: boolean;
  fee_mgmt?: number | null;
  report_id?: string | null;
  created_at?: string;
  updated_at?: string;
  checklist?: { items: ChecklistMapEntry[] };
  photo?: RawRoomPhoto | null;
}

function normalizePhoto(raw?: RawRoomPhoto | null): RoomPhoto[] {
  if (!raw) {
    return [];
  }
  const photoId = raw.photo_id;
  const objectUrl = raw.object_url;
  if (!photoId || !objectUrl) {
    return [];
  }
  return [
    {
      photoId,
      objectUrl,
      createdAt: raw.created_at ?? new Date().toISOString(),
    },
  ];
}

function normalizeRoom(raw: RawRoom): Room {
  return {
    roomId: raw.room_id ?? '',
    address: raw.address ?? '',
    type: raw.type ?? '',
    floor: raw.floor ?? 0,
    deposit: raw.deposit ?? 0,
    rentMonthly: raw.rent_monthly ?? 0,
    feeIncluded: raw.fee_included ?? false,
    feeMgmt: raw.fee_mgmt ?? undefined,
    createdAt: raw.created_at ?? new Date().toISOString(),
    photos: normalizePhoto(raw.photo),
    checklist: raw.checklist,
  };
}

export async function createRoom(payload: CreateRoomPayload): Promise<Room> {
  const response = await api('/v1/rooms', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = await response.json() as RawRoom;
  return normalizeRoom(data);
}

export interface RoomsQueryParams {
  page?: number;
  size?: number;
}

export async function fetchRooms(params: RoomsQueryParams = {}): Promise<Room[]> {
  const searchParams = new URLSearchParams();
  if (params.page !== undefined) {
    searchParams.set('page', String(params.page));
  }

  if (params.size !== undefined) {
    searchParams.set('size', String(params.size));
  }

  const query = searchParams.toString();
  const endpoint = query ? `/v1/rooms?${query}` : '/v1/rooms';
  const response = await api(endpoint);
  const payload = await response.json() as { items?: RawRoom[] } | RawRoom[];
  const entries = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items) ? payload.items : [];
  return entries.map(normalizeRoom);
}

export async function fetchRoom(room_id: string): Promise<Room> {
  const response = await api(`/v1/rooms/${encodeURIComponent(room_id)}`);
  const data = await response.json() as RawRoom;
  return normalizeRoom(data);
}

export async function deleteRoom(room_id: string): Promise<void> {
  await api(`/v1/rooms/${encodeURIComponent(room_id)}`, {
    method: 'DELETE',
  });
}

export interface RoomPhotoUploadResponse {
  photo_id: string;
  object_url: string;
  uploaded_at?: string;
}

export async function uploadRoomPhoto(
  room_id: string,
  file: File,
): Promise<RoomPhoto> {
  const form = new FormData();
  form.append('file', file);

  const response = await api(`/v1/rooms/${encodeURIComponent(room_id)}/photos`, {
    method: 'POST',
    body: form,
  });

  const data = await response.json() as RoomPhotoUploadResponse & {
    photo_id?: string;
    object_url?: string;
    uploaded_at?: string;
  };

  return {
    photoId: data.photo_id ?? '',
    objectUrl: data.object_url ?? '',
    createdAt: data.uploaded_at ?? new Date().toISOString(),
  };
}
