import { api } from './http';

export interface AuthResponse {
  token: string;
}

export async function fetchAuthToken(): Promise<string | null> {
  try {
    const response = await api('/v1/auth', {
      method: 'POST',
      skipAuth: true,
    });
    const data = (await response.json()) as AuthResponse | { token?: string };
    const token = data?.token ?? null;
    if (token && typeof window !== 'undefined') {
      window.localStorage.setItem('token', token);
    }
    return token;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to fetch auth token', error);
    return null;
  }
}
