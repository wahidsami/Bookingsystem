import * as SecureStore from 'expo-secure-store';
import { getApiUrl } from '../config/env';

const STAFF_SESSION_KEY = 'rifah_staff_session';

export type HealthResponse = { message?: string; [key: string]: unknown };

export interface StaffProfile {
  id: string;
  tenantId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  nationality?: string | null;
  bio?: string | null;
  experience?: string | null;
  skills: string[];
  photo?: string | null;
  rating?: number | string | null;
  totalBookings?: number | null;
  salary?: number | string | null;
  commissionRate?: number | string | null;
  isActive: boolean;
  tenant?: {
    id: string;
    businessName?: string | null;
    businessType?: string | null;
    city?: string | null;
    logo?: string | null;
  } | null;
}

export type StaffAppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'in_service'
  | 'completed'
  | 'no_show'
  | 'cancelled';

export interface StaffAppointment {
  id: string;
  status: StaffAppointmentStatus;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  bookingSessionId?: string | null;
  bookingReference?: string | null;
  bookingItemIndex?: number | null;
  startTime: string;
  endTime: string;
  price?: number | string | null;
  notes?: string | null;
  service?: {
    id: string;
    name_en?: string | null;
    name_ar?: string | null;
    duration?: number | null;
    finalPrice?: number | string | null;
    rawPrice?: number | string | null;
  } | null;
  user?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
}

export interface StaffScheduleItem {
  id: string;
  startTime: string;
  endTime: string;
  label?: string | null;
  type?: string | null;
  reason?: string | null;
}

export interface StaffTimeOffItem {
  id: string;
  startDate: string;
  endDate: string;
  type?: string | null;
  reason?: string | null;
}

export interface StaffSchedule {
  date: string;
  shifts: StaffScheduleItem[];
  breaks: StaffScheduleItem[];
  timeOff: StaffTimeOffItem[];
  hasTimeOff: boolean;
  workingWindow: StaffScheduleItem[];
}

export interface StaffSession {
  accessToken: string;
  refreshToken: string;
  staff: StaffProfile;
}

type JsonRecord = Record<string, unknown>;

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return { message: text } as T;
  }
}

async function request<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
  const base = getApiUrl();
  const response = await fetch(`${base}${endpoint}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const data = await parseResponse<JsonRecord>(response);

  if (!response.ok) {
    throw new Error(String(data.message || data.error || 'Request failed'));
  }

  return data as T;
}

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

export async function readStoredSession(): Promise<StaffSession | null> {
  const raw = await SecureStore.getItemAsync(STAFF_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StaffSession;
  } catch {
    await SecureStore.deleteItemAsync(STAFF_SESSION_KEY);
    return null;
  }
}

export async function writeStoredSession(session: StaffSession): Promise<void> {
  await SecureStore.setItemAsync(STAFF_SESSION_KEY, JSON.stringify(session));
}

export async function clearStoredSession(): Promise<void> {
  await SecureStore.deleteItemAsync(STAFF_SESSION_KEY);
}

export async function loginStaff(email: string, password: string): Promise<StaffSession> {
  const data = await request<{
    accessToken: string;
    refreshToken: string;
    staff: StaffProfile;
  }>('/staff/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    staff: data.staff,
  };
}

export async function refreshStaffSession(refreshToken: string): Promise<Pick<StaffSession, 'accessToken' | 'refreshToken'>> {
  return request<Pick<StaffSession, 'accessToken' | 'refreshToken'>>('/staff/auth/refresh-token', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

async function authorizedRequest<T>(endpoint: string, session: StaffSession, init: RequestInit = {}): Promise<T> {
  const attempt = async (accessToken: string) =>
    fetch(`${getApiUrl()}${endpoint}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(init.headers || {}),
      },
    });

  let response = await attempt(session.accessToken);

  if (response.status === 401 && session.refreshToken) {
    const refreshed = await refreshStaffSession(session.refreshToken);
    const nextSession: StaffSession = {
      ...session,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
    };
    await writeStoredSession(nextSession);
    response = await attempt(nextSession.accessToken);
  }

  const data = await parseResponse<JsonRecord>(response);
  if (!response.ok) {
    throw new Error(String(data.message || data.error || 'Request failed'));
  }

  return data as T;
}

export async function fetchStaffMe(session: StaffSession): Promise<StaffProfile> {
  const data = await authorizedRequest<{ staff: StaffProfile }>('/staff/me', session);
  return data.staff;
}

export async function fetchStaffAppointments(session: StaffSession, date: string): Promise<StaffAppointment[]> {
  const data = await authorizedRequest<{ appointments: StaffAppointment[] }>(
    `/staff/appointments?date=${encodeURIComponent(date)}`,
    session
  );
  return data.appointments || [];
}

export async function fetchStaffSchedule(session: StaffSession, date: string): Promise<StaffSchedule> {
  const data = await authorizedRequest<{ schedule: StaffSchedule }>(
    `/staff/schedule?date=${encodeURIComponent(date)}`,
    session
  );
  return data.schedule;
}

export async function updateStaffAppointmentStatus(
  session: StaffSession,
  appointmentId: string,
  payload: { status: StaffAppointmentStatus; notes?: string }
): Promise<StaffAppointment> {
  const data = await authorizedRequest<{ appointment: StaffAppointment }>(
    `/staff/appointments/${encodeURIComponent(appointmentId)}/status`,
    session,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }
  );

  return data.appointment;
}

export async function changeStaffPassword(
  session: StaffSession,
  payload: { currentPassword: string; newPassword: string }
): Promise<{ success: boolean; message: string }> {
  return authorizedRequest<{ success: boolean; message: string }>(
    '/staff/me/password',
    session,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }
  );
}

export async function registerStaffPushToken(
  session: StaffSession,
  payload: { token: string; platform: string; appVersion?: string; deviceName?: string }
): Promise<{ success: boolean; message: string }> {
  return authorizedRequest<{ success: boolean; message: string }>(
    '/staff/me/push-token',
    session,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function unregisterStaffPushToken(
  session: StaffSession,
  token: string
): Promise<{ success: boolean; message: string }> {
  return authorizedRequest<{ success: boolean; message: string }>(
    '/staff/me/push-token',
    session,
    {
      method: 'DELETE',
      body: JSON.stringify({ token }),
    }
  );
}

export async function logoutStaff(session: StaffSession | null): Promise<void> {
  if (session) {
    try {
      await authorizedRequest('/staff/auth/logout', session, { method: 'POST' });
    } catch {
      // Ignore logout network failures; local session must still be cleared.
    }
  }

  await clearStoredSession();
}
