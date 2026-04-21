export const SERVICE_PAYMENT_METHODS = ['at-center', 'online-full', 'booking-fee'] as const;

export type ServicePaymentMethod = (typeof SERVICE_PAYMENT_METHODS)[number];

export const normalizeServicePaymentOptions = (paymentOptions: unknown): ServicePaymentMethod[] => {
  const parsed = Array.isArray(paymentOptions)
    ? paymentOptions
    : typeof paymentOptions === 'string'
      ? (() => {
          try {
            const value = JSON.parse(paymentOptions);
            return Array.isArray(value) ? value : [];
          } catch {
            return [];
          }
        })()
      : [];

  const normalized = parsed
    .map((value) => `${value ?? ''}`.trim().toLowerCase())
    .filter((value): value is ServicePaymentMethod => SERVICE_PAYMENT_METHODS.includes(value as ServicePaymentMethod));

  return normalized.length > 0 ? Array.from(new Set(normalized)) : [...SERVICE_PAYMENT_METHODS];
};
