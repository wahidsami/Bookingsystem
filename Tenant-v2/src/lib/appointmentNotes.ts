/**
 * Appointment Notes Utilities for Tenant V2
 *
 * Sanitizes internal system markers from human-facing notes displayed to staff/admin.
 * Ported from and compatible with tenant/src/lib/appointmentNotes.ts.
 */

export const RESCHEDULE_AUDIT_MARKER = '[RESCHEDULE_AUDIT]';
export const CANCELLATION_AUDIT_MARKER = '[CANCELLATION_AUDIT]';
export const GROUP_GUEST_MARKER = '[GROUP_GUEST]';
export const CANCELLATION_REASON_MARKER = '[Cancellation Reason]';

export const SYSTEM_MARKERS = [
  RESCHEDULE_AUDIT_MARKER,
  CANCELLATION_AUDIT_MARKER,
  GROUP_GUEST_MARKER,
  CANCELLATION_REASON_MARKER
];

/**
 * Strips only [RESCHEDULE_AUDIT] markers from notes.
 */
export function stripRescheduleAuditMarkers(notes?: string | null): string {
  const text = `${notes || ''}`;
  if (!text) return '';
  return text
    .split('\n')
    .filter((line) => !line.includes(RESCHEDULE_AUDIT_MARKER))
    .join('\n')
    .trim();
}

/**
 * Sanitizes appointment notes by removing all internal audit and system markers,
 * returning only the human-entered note.
 */
export function sanitizeAppointmentNotes(notes?: string | null): string {
  const text = `${notes || ''}`;
  if (!text) return '';
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed.length === 0) return false;
      const lower = line.toLowerCase();
      return !SYSTEM_MARKERS.some((marker) => lower.includes(marker.toLowerCase()));
    })
    .join('\n')
    .trim();
}
