export type BookingDialogCopy = {
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
};

export type BookingErrorMeta = {
  status?: number;
  message: string;
  rawMessage: string;
  payload: any;
  diagnostics: any[];
};

const extractText = (value: any): string => {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return `${value}`;
  }

  return '';
};

const firstText = (...values: any[]): string => {
  for (const value of values) {
    const text = extractText(value);
    if (text) {
      return text;
    }
  }
  return '';
};

const extractDiagnostics = (payload: any, error: any): any[] => {
  const candidates = [
    payload?.diagnostics,
    payload?.data?.diagnostics,
    payload?.conflictDiagnostics,
    payload?.data?.conflictDiagnostics,
    error?.diagnostics,
    error?.response?.data?.diagnostics
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
};

export const extractBookingErrorMeta = (error: unknown): BookingErrorMeta => {
  const err = error as any;
  const payload = err?.response?.data ?? err?.payload ?? err?.data ?? err?.body ?? null;
  const message = firstText(
    payload?.message,
    payload?.error,
    payload?.details?.message,
    payload?.details?.error,
    err?.message,
    err
  );
  const statusValue = Number(err?.status ?? err?.response?.status ?? payload?.status ?? payload?.code ?? NaN);

  return {
    status: Number.isFinite(statusValue) ? statusValue : undefined,
    message,
    rawMessage: message.toLowerCase(),
    payload,
    diagnostics: extractDiagnostics(payload, err)
  };
};

const TOO_SOON_PATTERNS = [
  /15\s*minutes?\s*in\s*advance/i,
  /at least\s*15\s*minutes?/i,
  /less than\s*15\s*minutes?/i,
  /too soon/i,
  /15\s*دقيقة/i,
  /قبل\s*موعد\s*الحجز/i
];

const CONFLICT_PATTERNS = [
  /conflict/i,
  /overlap/i,
  /not available/i,
  /unavailable/i,
  /outside\s*working\s*hours/i,
  /time\s*slot/i,
  /existing\s*booking/i,
  /blocked\s*time/i,
  /staff\s*break/i,
  /time\s*off/i
];

export const hasStructuredBookingDiagnostics = (error: unknown): boolean => {
  const meta = typeof error === 'object' && error !== null && 'diagnostics' in (error as any)
    ? (error as BookingErrorMeta)
    : extractBookingErrorMeta(error);
  return Array.isArray(meta.diagnostics) && meta.diagnostics.length > 0;
};

export const isBookingTooSoonError = (error: unknown): boolean => {
  const meta = typeof error === 'object' && error !== null && 'rawMessage' in (error as any)
    ? (error as BookingErrorMeta)
    : extractBookingErrorMeta(error);

  return TOO_SOON_PATTERNS.some((pattern) => pattern.test(meta.rawMessage)) || meta.status === 400 && TOO_SOON_PATTERNS.some((pattern) => pattern.test(meta.rawMessage));
};

export const isBookingConflictError = (error: unknown): boolean => {
  const meta = typeof error === 'object' && error !== null && 'rawMessage' in (error as any)
    ? (error as BookingErrorMeta)
    : extractBookingErrorMeta(error);

  if (meta.status === 409) {
    return true;
  }

  return CONFLICT_PATTERNS.some((pattern) => pattern.test(meta.rawMessage));
};

export const buildAdvanceBookingDialog = ({
  currentLabel,
  slotLabel
}: {
  isRtl: boolean;
  currentLabel: string;
  slotLabel?: string;
}): BookingDialogCopy => ({
  titleAr: 'لا يمكن إتمام الحجز الآن',
  titleEn: 'Booking cannot be completed yet',
  bodyAr: `يجب أن يكون الحجز قبل 15 دقيقة على الأقل. الوقت الحالي في الرياض هو ${currentLabel}${slotLabel ? `، والوقت المحدد هو ${slotLabel}` : ''}. يرجى اختيار وقت لاحق.`,
  bodyEn: `Booking must be at least 15 minutes in advance. Riyadh time is currently ${currentLabel}${slotLabel ? `. The selected time is ${slotLabel}` : ''}. Please choose a later time.`
});

export const buildGenericBookingErrorDialog = (): BookingDialogCopy => ({
  titleAr: 'تعذر إكمال الحجز',
  titleEn: 'Unable to complete booking',
  bodyAr: 'تعذر إكمال الحجز الآن. يرجى المحاولة مرة أخرى.',
  bodyEn: 'We could not complete the booking right now. Please try again.'
});

export const buildExtendedHoursBookingDialog = ({
  extensionMinutes
}: {
  isRtl: boolean;
  extensionMinutes: number;
}): BookingDialogCopy => ({
  titleAr: 'الحجز يتجاوز ساعات خدمة المركز',
  titleEn: 'Booking exceeds center service hours',
  bodyAr: `سينتهي هذا الحجز بعد ${extensionMinutes} دقيقة من وقت الإغلاق المعتاد. هل تريد تمديد ساعات الخدمة؟`,
  bodyEn: `This booking will end ${extensionMinutes} minutes after the normal closing time. Would you like to extend the service hours?`
});
