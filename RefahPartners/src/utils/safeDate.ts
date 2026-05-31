import { format, formatDistanceToNow } from 'date-fns';

export const toValidDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDateSafe = (value: unknown, pattern: string, fallback = '-'): string => {
  const date = toValidDate(value);
  if (!date) return fallback;

  try {
    return format(date, pattern);
  } catch {
    return fallback;
  }
};

export const formatDistanceToNowSafe = (
  value: unknown,
  fallback = 'just now'
): string => {
  const date = toValidDate(value);
  if (!date) return fallback;

  try {
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return fallback;
  }
};

export const getTimeMsSafe = (value: unknown, fallback = 0): number => {
  const date = toValidDate(value);
  return date ? date.getTime() : fallback;
};
