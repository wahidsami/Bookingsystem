export type GroupGuestMeta = {
  fullName: string;
  phone?: string | null;
  serviceId?: string | null;
  serviceName?: string | null;
  isFree?: boolean | null;
};

export type AppointmentGuestCard = {
  id: string;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  serviceName?: string | null;
  servicePrice?: number | null;
  isFree?: boolean | null;
  staffName?: string | null;
  source: "session" | "notes";
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
            serviceName: parsed.serviceName ? `${parsed.serviceName}`.trim() : null,
            isFree: parsed.isFree === true || `${parsed.isFree || ''}`.trim().toLowerCase() === 'true'
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

export function extractAppointmentGuestCards(appointment?: {
  notes?: string | null;
  user?: {
    id?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  bookingSession?: {
    appointments?: Array<{
      id?: string | null;
      bookingItemIndex?: number | null;
      price?: number | null;
      status?: string | null;
      paymentStatus?: string | null;
      notes?: string | null;
      service?: {
        id?: string | null;
        name_en?: string | null;
        name_ar?: string | null;
      } | null;
      staff?: {
        name?: string | null;
      } | null;
      user?: {
        id?: string | null;
        firstName?: string | null;
        lastName?: string | null;
        email?: string | null;
        phone?: string | null;
      } | null;
    }> | null;
  } | null;
}): AppointmentGuestCard[] {
  const primaryUserId = `${appointment?.user?.id || ""}`.trim();
  const sessionAppointments = Array.isArray(appointment?.bookingSession?.appointments)
    ? appointment.bookingSession?.appointments || []
    : [];
  const guestCards: AppointmentGuestCard[] = [];

  sessionAppointments.forEach((sessionAppointment, index) => {
    const sessionUser = sessionAppointment.user || null;
    const sessionUserId = `${sessionUser?.id || ""}`.trim();
    const isGuestSession =
      (primaryUserId && sessionUserId && sessionUserId !== primaryUserId) ||
      (!primaryUserId && sessionAppointments.length > 1 && index > 0);

    if (!isGuestSession) {
      return;
    }

    const fullName = `${sessionUser?.firstName || ""} ${sessionUser?.lastName || ""}`.trim();
    const notesGuest = parseGroupGuestFromNotes(sessionAppointment.notes || appointment?.notes || "");
    const serviceName = `${sessionAppointment.service?.name_en || sessionAppointment.service?.name_ar || notesGuest?.serviceName || ""}`.trim();
    const safeName = fullName || notesGuest?.fullName || serviceName || (index > 0 ? `Guest ${index}` : "Guest");
    const resolvedPrice = Number(sessionAppointment.price || 0);

    guestCards.push({
      id: `${sessionAppointment.id || `session-guest-${index}`}`,
      fullName: safeName,
      phone: sessionUser?.phone || notesGuest?.phone || null,
      email: sessionUser?.email || null,
      serviceName: serviceName || notesGuest?.serviceName || null,
      servicePrice: Number.isFinite(resolvedPrice) ? resolvedPrice : null,
      isFree: notesGuest?.isFree === true || resolvedPrice <= 0,
      staffName: sessionAppointment.staff?.name || null,
      source: "session"
    });
  });

  if (guestCards.length > 0) {
    return guestCards;
  }

  const parsedGuest = parseGroupGuestFromNotes(appointment?.notes);
  if (!parsedGuest) {
    return [];
  }

  return [
    {
      id: "notes-guest",
      fullName: parsedGuest.fullName,
      phone: parsedGuest.phone || null,
      email: null,
      serviceName: parsedGuest.serviceName || null,
      servicePrice: null,
      isFree: parsedGuest.isFree || false,
      staffName: null,
      source: "notes"
    }
  ];
}
