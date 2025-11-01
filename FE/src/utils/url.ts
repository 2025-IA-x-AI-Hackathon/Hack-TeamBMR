const baseUrl = (import.meta.env.VITE_BACKEND_HTTP_URL ?? '').replace(/\/+$/, '');

if (!baseUrl) {
  // eslint-disable-next-line no-console
  console.warn('VITE_BACKEND_HTTP_URL is not defined. API requests may fail.');
}

export function resolveApiUrl(path: string): string {
  if (!path) {
    throw new Error('API path is required');
  }

  if (/^https?:\/\//.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

export function getBackendBaseUrl(): string {
  return baseUrl;
}
