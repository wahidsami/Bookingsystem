export function humanizeValue(value: unknown, fallback = "-"): string {
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => humanizeValue(item, ""))
      .filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : fallback;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed.replace(/_/g, " ") : fallback;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value && typeof value === "object") {
    if ("name" in (value as Record<string, unknown>)) {
      return humanizeValue((value as Record<string, unknown>).name, fallback);
    }
    if ("label" in (value as Record<string, unknown>)) {
      return humanizeValue((value as Record<string, unknown>).label, fallback);
    }
  }

  return fallback;
}
