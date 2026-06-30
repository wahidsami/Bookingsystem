"use client";

export type ReportDatePresetKey =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "last_90_days"
  | "last_week"
  | "last_month"
  | "last_3_months"
  | "last_6_months"
  | "custom";

export type ReportDateRange = {
  startDate: string;
  endDate: string;
};

export type ReportDatePresetDefinition = {
  id: ReportDatePresetKey;
  labelEn: string;
  labelAr: string;
  descriptionEn?: string;
  descriptionAr?: string;
};

export const REPORT_DATE_PRESETS: ReportDatePresetDefinition[] = [
  { id: "today", labelEn: "Today", labelAr: "اليوم" },
  { id: "yesterday", labelEn: "Yesterday", labelAr: "أمس" },
  { id: "last_7_days", labelEn: "Last 7 Days", labelAr: "آخر 7 أيام" },
  { id: "last_30_days", labelEn: "Last 30 Days", labelAr: "آخر 30 يومًا" },
  { id: "last_90_days", labelEn: "Last 90 Days", labelAr: "آخر 90 يومًا" },
  { id: "last_week", labelEn: "Last Week", labelAr: "الأسبوع الماضي" },
  { id: "last_month", labelEn: "Last Month", labelAr: "الشهر الماضي" },
  { id: "last_3_months", labelEn: "Last 3 Months", labelAr: "آخر 3 أشهر" },
  { id: "last_6_months", labelEn: "Last 6 Months", labelAr: "آخر 6 أشهر" },
  { id: "custom", labelEn: "Custom Range", labelAr: "نطاق مخصص" }
];

function cloneDate(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function formatLocalDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(value: Date, amount: number) {
  const next = cloneDate(value);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfCurrentWeek(value: Date) {
  const dayIndex = (value.getDay() + 6) % 7;
  return addDays(cloneDate(value), -dayIndex);
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function endOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0);
}

function startOfMonthOffset(value: Date, offsetMonths: number) {
  return new Date(value.getFullYear(), value.getMonth() + offsetMonths, 1);
}

function normalizeRange(startDate: Date, endDate: Date): ReportDateRange {
  return {
    startDate: formatLocalDate(startDate),
    endDate: formatLocalDate(endDate)
  };
}

export function getReportDateRangeForPreset(
  preset: ReportDatePresetKey,
  referenceDate: Date = new Date()
): ReportDateRange | null {
  const today = cloneDate(referenceDate);

  switch (preset) {
    case "today":
      return normalizeRange(today, today);
    case "yesterday": {
      const day = addDays(today, -1);
      return normalizeRange(day, day);
    }
    case "last_7_days":
      return normalizeRange(addDays(today, -6), today);
    case "last_30_days":
      return normalizeRange(addDays(today, -29), today);
    case "last_90_days":
      return normalizeRange(addDays(today, -89), today);
    case "last_week": {
      const startOfThisWeek = startOfCurrentWeek(today);
      const start = addDays(startOfThisWeek, -7);
      const end = addDays(startOfThisWeek, -1);
      return normalizeRange(start, end);
    }
    case "last_month": {
      const previousMonth = startOfMonthOffset(today, -1);
      return normalizeRange(startOfMonth(previousMonth), endOfMonth(previousMonth));
    }
    case "last_3_months": {
      const end = endOfMonth(startOfMonthOffset(today, -1));
      const start = startOfMonthOffset(today, -3);
      return normalizeRange(start, end);
    }
    case "last_6_months": {
      const end = endOfMonth(startOfMonthOffset(today, -1));
      const start = startOfMonthOffset(today, -6);
      return normalizeRange(start, end);
    }
    case "custom":
      return null;
    default:
      return null;
  }
}

export function isCustomDatePreset(preset: ReportDatePresetKey) {
  return preset === "custom";
}
