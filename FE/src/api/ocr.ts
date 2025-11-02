import { api } from './http';
import { OcrUploadResponse } from '../types/domain';

export async function uploadOcrImage(file: File): Promise<OcrUploadResponse> {
  const form = new FormData();
  form.append('file', file);

  const response = await api('/v1/ocr/uploads', {
    method: 'POST',
    body: form,
  });
  const data = await response.json() as { ocr_id?: string; object_url?: string };
  return {
    ocrId: data.ocr_id ?? '',
    objectUrl: data.object_url ?? '',
  };
}

export function fetchOcrReport(reportId: string): Promise<Response> {
  return api(`/v1/ocr/${encodeURIComponent(reportId)}`);
}
