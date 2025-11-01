import { api } from './http';
import { OcrUploadResponse } from '../types/domain';

export async function uploadOcrImage(file: File): Promise<OcrUploadResponse> {
  const form = new FormData();
  form.append('file', file);

  const response = await api('/v1/ocr/uploads', {
    method: 'POST',
    body: form,
  });
  return response.json() as Promise<OcrUploadResponse>;
}

export function fetchOcrReport(reportId: string): Promise<Response> {
  return api(`/v1/ocr/${encodeURIComponent(reportId)}`);
}
