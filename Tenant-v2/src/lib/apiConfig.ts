export const API_BASE_URL =
  ((import.meta as any).env?.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ||
  'http://localhost:5000/api/v1';

export const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
