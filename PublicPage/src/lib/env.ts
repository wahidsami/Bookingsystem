const DEFAULT_API_URL = "http://localhost:5000/api/v1";
const DEFAULT_CLIENT_APP_URL = "http://localhost:3000";

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "");

export const API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_URL || DEFAULT_API_URL
);

export const PUBLIC_API_BASE_URL = `${API_BASE_URL}/public`;

export const SERVER_URL = normalizeBaseUrl(
  import.meta.env.VITE_SERVER_URL || API_BASE_URL.replace(/\/api\/v1$/, "")
);

export const CLIENT_APP_URL = normalizeBaseUrl(
  import.meta.env.VITE_CLIENT_APP_URL || DEFAULT_CLIENT_APP_URL
);

export function toAbsoluteMediaUrl(path?: string | null): string | null {
  if (!path) {
    return null;
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (path.startsWith("/")) {
    return `${SERVER_URL}${path}`;
  }

  return `${SERVER_URL}/uploads/${path}`;
}

export function buildClientAppUrl(path = ""): string {
  const normalizedPath = path.startsWith("/") || !path ? path : `/${path}`;
  return `${CLIENT_APP_URL}${normalizedPath}`;
}
