export type GroupGuestMeta = {
  fullName: string;
  phone?: string | null;
  serviceId?: string | null;
  serviceName?: string | null;
};

const GROUP_GUEST_MARKER = "[GROUP_GUEST]";
const RESCHEDULE_AUDIT_MARKER = "[RESCHEDULE_AUDIT]";
const CANCELLATION_AUDIT_MARKER = "[CANCELLATION_AUDIT]";

const SYSTEM_MARKERS = [
  GROUP_GUEST_MARKER,
  RESCHEDULE_AUDIT_MARKER,
  CANCELLATION_AUDIT_MARKER
];

export function parseGroupGuestFromNotes(notes?: string | null): GroupGuestMeta | null {
  const text = `${notes || ""}`;
  if (!text.includes(GROUP_GUEST_MARKER)) return null;
  const regex = /\[GROUP_GUEST\]\s*(\{.*\})/g;
  let match: RegExpExecArray | null;
  let last: GroupGuestMeta | null = null;

  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && typeof parsed === "object") {
        const fullName = `${parsed.fullName || ""}`.trim();
        if (fullName) {
          last = {
            fullName,
            phone: parsed.phone ? `${parsed.phone}`.trim() : null,
            serviceId: parsed.serviceId ? `${parsed.serviceId}`.trim() : null,
            serviceName: parsed.serviceName ? `${parsed.serviceName}`.trim() : null
          };
        }
      }
    } catch {
      // ignore malformed payload
    }
  }

  return last;
}

export function sanitizeAppointmentNotes(notes?: string | null): string {
  const text = `${notes || ""}`;
  if (!text) return "";
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0 && !SYSTEM_MARKERS.some((marker) => line.includes(marker)))
    .join("\n")
    .trim();
}
