import { resolveApiUrl } from '../utils/url';

export interface ApiOptions extends RequestInit {
  skipAuth?: boolean;
}

export interface ApiResponse<T> {
  status: number;
  data: T;
}

function normalizeHeaders(headers?: HeadersInit): Headers {
  if (headers instanceof Headers) {
    return headers;
  }

  const normalized = new Headers();

  if (Array.isArray(headers)) {
    headers.forEach(([key, value]) => normalized.append(key, value));
    return normalized;
  }

  if (headers) {
    Object.entries(headers).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((entry) => normalized.append(key, entry));
      } else if (value !== undefined) {
        normalized.append(key, value);
      }
    });
  }

  return normalized;
}

function shouldAttachJsonHeader(body?: BodyInit | null): boolean {
  if (!body) {
    return true;
  }

  if (typeof body === 'string') {
    return true;
  }

  if (body instanceof URLSearchParams) {
    return true;
  }

  if (body instanceof Blob && body.type) {
    return body.type.includes('json');
  }

  return false;
}

async function parseJsonSafely<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.toLowerCase().includes('application/json')) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to parse JSON response', error);
    throw new Error('서버 응답을 처리하는 중 오류가 발생했습니다.');
  }
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<ApiResponse<T>> {
  const { skipAuth, headers: rawHeaders, body, method, ...rest } = options;
  const headers = normalizeHeaders(rawHeaders);

  const shouldAttachAuth = !skipAuth;
  if (shouldAttachAuth) {
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  headers.set('Accept', 'application/json');

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (!isFormData && !headers.has('Content-Type') && shouldAttachJsonHeader(body ?? null)) {
    headers.set('Content-Type', 'application/json');
  }

  const fetchOptions: RequestInit = {
    method: method ?? (body ? 'POST' : 'GET'),
    headers,
    body,
    ...rest,
  };

  const response = await fetch(resolveApiUrl(path), fetchOptions);

  if (response.status === 204) {
    return { status: response.status, data: undefined as T };
  }

  if (!response.ok) {
    let message = response.statusText || '요청 중 오류가 발생했습니다.';
    try {
      const errorJson = await parseJsonSafely<{ message?: string; error?: string }>(response);
      if (errorJson?.message) {
        message = errorJson.message;
      } else if (errorJson?.error) {
        message = errorJson.error;
      }
    } catch {
      // Already handled in parseJsonSafely
    }
    throw new Error(message);
  }

  const data = await parseJsonSafely<T>(response);
  return { status: response.status, data };
}
