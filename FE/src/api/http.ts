import { resolveApiUrl } from '../utils/url';

export interface ApiOptions extends RequestInit {
  skipAuth?: boolean;
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

function extractErrorMessage(defaultMessage: string, response: Response): Promise<string> {
  return response.clone().text()
    .then((text) => {
      if (!text) {
        return defaultMessage;
      }
      try {
        const parsed = JSON.parse(text) as { message?: string; error?: string };
        return parsed.message ?? parsed.error ?? defaultMessage;
      } catch {
        return text;
      }
    })
    .catch(() => defaultMessage);
}

export async function api(path: string, options: ApiOptions = {}): Promise<Response> {
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
    credentials: 'include',
    ...rest,
  };

  const response = await fetch(resolveApiUrl(path), fetchOptions);

  if (!response.ok) {
    const fallbackMessage = response.statusText || '요청 중 오류가 발생했습니다.';
    const message = await extractErrorMessage(fallbackMessage, response);
    throw new Error(message);
  }

  return response;
}
