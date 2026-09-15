export const DEFAULT_TENANT_TIMEZONE = 'Asia/Riyadh';

function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function resolveTenantTimezone(...candidates: Array<string | null | undefined>) {
  for (const candidate of candidates) {
    const timeZone = `${candidate || ''}`.trim();
    if (timeZone && isValidTimeZone(timeZone)) {
      return timeZone;
    }
  }

  return DEFAULT_TENANT_TIMEZONE;
}

export function getDatePartsInTimeZone(date: Date, timeZone = DEFAULT_TENANT_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  parts.forEach((part) => {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  });

  return {
    dateKey: `${map.year}-${map.month}-${map.day}`,
    timeKey: `${map.hour}:${map.minute}`,
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour,
    minute: map.minute,
    second: map.second
  };
}

export function getDateKeyInTimeZone(date: Date, timeZone = DEFAULT_TENANT_TIMEZONE) {
  return getDatePartsInTimeZone(date, timeZone).dateKey;
}

function getTimeZoneOffset(date: Date, timeZone = DEFAULT_TENANT_TIMEZONE) {
  const parts = getDatePartsInTimeZone(date, timeZone);
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second || 0)
  );
  return asUTC - date.getTime();
}

function combineDateAndTime(dateKey: string, time: string, timeZone = DEFAULT_TENANT_TIMEZONE) {
  const [year, month, day] = `${dateKey || ''}`.split('-').map((value) => Number(value));
  const [hour, minute] = `${time || ''}`.split(':').map((value) => Number(value));
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  const offset = getTimeZoneOffset(utcGuess, timeZone);
  const result = new Date(utcGuess.getTime() - offset);

  if (Number.isNaN(result.getTime())) {
    throw new Error(`Invalid date/time combination: ${dateKey}T${time}:00`);
  }

  return result;
}

export function buildTenantIsoFromMinutes(
  dateKey: string,
  minutesFromStartOfDay: number,
  timeZone = DEFAULT_TENANT_TIMEZONE,
  boardStartHour = 9
) {
  const safeMinutes = Math.max(0, Math.round(minutesFromStartOfDay));
  const totalMinutes = (boardStartHour * 60) + safeMinutes;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return combineDateAndTime(
    `${dateKey || ''}`.split('T')[0],
    `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    timeZone
  ).toISOString();
}

export function getBoardMinutesFromTimestamp(
  value: string | Date | null | undefined,
  timeZone = DEFAULT_TENANT_TIMEZONE,
  boardStartHour = 9
) {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const parts = getDatePartsInTimeZone(parsed, timeZone);
  const hours = Number(parts.hour || '0');
  const minutes = Number(parts.minute || '0');
  const totalMinutes = (hours * 60) + minutes;
  return Math.max(0, totalMinutes - (boardStartHour * 60));
}
