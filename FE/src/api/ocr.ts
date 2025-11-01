import { api, ApiResponse } from './http';
import { OcrReport, OcrUploadResponse } from '../types/domain';

export async function uploadOcrImage(file: File): Promise<OcrUploadResponse> {
  const form = new FormData();
  form.append('file', file);

  const { data } = await api<OcrUploadResponse>('/v1/ocr/uploads', {
    method: 'POST',
    body: form,
  });
  return data;
}

export async function fetchOcrReport(reportId: string): Promise<ApiResponse<OcrReport>> {
  return api<OcrReport>(`/v1/ocr/${encodeURIComponent(reportId)}`);
}
