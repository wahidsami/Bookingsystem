import { getApiUrl } from '../config/env';

export type HealthResponse = { message?: string; [key: string]: unknown };

export async function fetchApiHealth(): Promise<{ ok: boolean; data?: HealthResponse; error?: string }> {
  const base = getApiUrl();
  try {
    const res = await fetch(`${base.replace(/\/api\/v1$/, '')}/`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const text = await res.text();
    let data: HealthResponse | undefined;
    try {
      data = JSON.parse(text) as HealthResponse;
    } catch {
      data = { message: text.slice(0, 200) };
    }
    return { ok: res.ok, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error';
    return { ok: false, error: msg };
  }
}
