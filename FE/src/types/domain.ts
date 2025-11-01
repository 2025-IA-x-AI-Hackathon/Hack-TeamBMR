export interface ChecklistItem {
  id: string;
  label: string;
  required: boolean;
  description?: string;
}

export interface ChecklistTemplate {
  id: string;
  locale: string;
  category: string;
  title: string;
  items: ChecklistItem[];
}

export interface ChecklistTemplatesResponse {
  templates: ChecklistTemplate[];
}

export interface ChecklistCheck {
  itemId: string;
  checked: boolean;
  memo?: string;
}

export interface SaveChecklistPayload {
  checks: ChecklistCheck[];
}

export interface RoomPhoto {
  photoId: string;
  objectUrl: string;
  uploadedAt: string;
}

export interface Room {
  id: string;
  title: string;
  category: string;
  price: number; // 금액 단위: 만원
  description?: string;
  address?: string;
  createdAt: string;
  updatedAt?: string;
  audioUrl?: string;
  photos?: RoomPhoto[];
}

export interface CreateRoomPayload {
  title: string;
  category: string;
  price: number;
  description?: string;
  address?: string;
}

export interface RoomsListResponse {
  items: Room[];
  nextPageToken?: string;
}

export interface OcrUploadResponse {
  ocrId: string;
  objectUrl: string;
}

export type OcrStage = 'queued' | 'processing' | 'done' | 'failed';

export interface OcrField {
  key: string;
  value: string;
  confidence?: number;
}

export interface OcrReport {
  ocrId: string;
  status: OcrStage;
  text: string;
  fields?: OcrField[];
  createdAt: string;
}

export type LlmStage = 'queued' | 'processing' | 'done' | 'failed';

export interface LlmReport {
  reportId: string;
  status: LlmStage;
  summary?: string;
  highlights?: string[];
  recommendations?: string[];
  createdAt: string;
}

export interface SttBubble {
  id: string;
  speaker: number | null;
  text: string;
  startedAt?: number;
  endedAt?: number;
}
