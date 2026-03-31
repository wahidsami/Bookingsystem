const DEFAULT_API_URL = "http://localhost:5000/api/v1";
const DEFAULT_PUBLIC_PAGE_URL = "http://localhost:3004";

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "");

export const API_BASE_URL = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL
);

export const SERVER_URL = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_SERVER_URL || API_BASE_URL.replace(/\/api\/v1$/, "")
);

export const PUBLIC_PAGE_URL = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_PUBLIC_PAGE_URL || DEFAULT_PUBLIC_PAGE_URL
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

export function buildPublicTenantUrl(slug: string, suffix = ""): string {
  const normalizedSuffix = suffix.startsWith("/") || !suffix ? suffix : `/${suffix}`;
  return `${PUBLIC_PAGE_URL}/t/${slug}${normalizedSuffix}`;
}
