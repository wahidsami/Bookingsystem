export function normalizeDuration(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function resolveBookingDuration(stagedDuration, variantDuration, serviceDuration) {
  return normalizeDuration(stagedDuration, normalizeDuration(variantDuration, normalizeDuration(serviceDuration, 30)));
}
