import { api } from './http';
import {
  CreateRoomPayload,
  Room,
  RoomPhoto,
  RoomsListResponse,
} from '../types/domain';

export async function createRoom(payload: CreateRoomPayload): Promise<Room> {
  const { data } = await api<Room>('/v1/rooms', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data;
}

export interface RoomsQueryParams {
  page?: number;
  size?: number;
}

export async function fetchRooms(params: RoomsQueryParams = {}): Promise<RoomsListResponse> {
  const searchParams = new URLSearchParams();
  if (params.page !== undefined) {
    searchParams.set('page', String(params.page));
  }

  if (params.size !== undefined) {
    searchParams.set('size', String(params.size));
  }

  const query = searchParams.toString();
  const endpoint = query ? `/v1/rooms?${query}` : '/v1/rooms';
  const { data } = await api<RoomsListResponse>(endpoint);
  return data;
}

export async function fetchRoom(roomId: string): Promise<Room> {
  const { data } = await api<Room>(`/v1/rooms/${encodeURIComponent(roomId)}`);
  return data;
}

export async function deleteRoom(roomId: string): Promise<void> {
  await api(`/v1/rooms/${encodeURIComponent(roomId)}`, {
    method: 'DELETE',
  });
}

export interface RoomPhotoUploadResponse {
  photoId: string;
  objectUrl: string;
}

export async function uploadRoomPhoto(
  roomId: string,
  file: File,
): Promise<RoomPhoto> {
  const form = new FormData();
  form.append('file', file);

  const { data } = await api<RoomPhotoUploadResponse & {
    photo_id?: string;
    object_url?: string;
    uploaded_at?: string;
  }>(`/v1/rooms/${encodeURIComponent(roomId)}/photos`, {
    method: 'POST',
    body: form,
  });

  const photo: RoomPhoto = {
    photoId: data.photoId ?? data.photo_id ?? '',
    objectUrl: data.objectUrl ?? data.object_url ?? '',
    uploadedAt: data.uploadedAt ?? data.uploaded_at ?? new Date().toISOString(),
  };

  return photo;
}
