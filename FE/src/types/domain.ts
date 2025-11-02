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

export type ChecklistMapEntry = Record<string, string | boolean | null>;

export interface ChecklistResponseV2 {
  items: ChecklistMapEntry[];
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
  createdAt: string;
}

export interface Room {
  roomId: string;
  address: string;
  type: string;
  floor: number;
  deposit: number;
  rentMonthly: number;
  feeIncluded: boolean;
  feeMgmt?: number;
  createdAt: string;
  photos: RoomPhoto[];
  checklist?: RoomChecklist;
}

export interface CreateRoomPayload {
  address: string;
  type: string;
  floor: number;
  deposit: number;
  rent_monthly: number;
  fee_included: boolean;
  fee_mgmt?: number;
  checklist: RoomChecklist;
}

export interface RoomChecklist {
  items: ChecklistMapEntry[];
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
  roomId: string;
  reportId?: string;
  userId?: string;
  status: LlmStage;
  summary?: string;
  highlights?: string[];
  recommendations?: string[];
  createdAt: string;
  cautions?: LlmReportItem[];
  positives?: LlmReportItem[];
  glossary?: LlmReportGlossaryItem[];
}

export interface SttBubble {
  id: string;
  speaker: number | null;
  text: string;
  startedAt?: number;
  endedAt?: number;
}

export type LlmReportSeverity = 'high' | 'medium' | 'low' | 'info';

export interface LlmReportItem {
  id?: string;
  title: string;
  description?: string;
  detail?: string;
  severity?: LlmReportSeverity;
}

export interface LlmReportGlossaryItem {
  id?: string;
  term: string;
  description: string;
}
