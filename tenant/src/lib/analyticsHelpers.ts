export function parseDateInput(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getPreviousDateRange(startDate: string, endDate: string) {
  const start = parseDateInput(startDate);
  const end = parseDateInput(endDate);
  if (!start || !end) {
    return { startDate, endDate };
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const rangeLength = Math.max(Math.round((end.getTime() - start.getTime()) / dayMs), 0) + 1;
  const previousEnd = new Date(start.getTime() - dayMs);
  const previousStart = new Date(previousEnd.getTime() - (rangeLength - 1) * dayMs);

  return {
    startDate: previousStart.toISOString().split("T")[0],
    endDate: previousEnd.toISOString().split("T")[0]
  };
}

export function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function percentChange(current: unknown, previous: unknown) {
  const currentValue = safeNumber(current);
  const previousValue = safeNumber(previous);
  if (previousValue === 0) {
    return currentValue === 0 ? 0 : 100;
  }
  return ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
}

export function formatTrendLabel(delta: number, locale: string) {
  const value = Math.abs(delta).toFixed(1);
  const arrow = delta >= 0 ? "↑" : "↓";
  return locale === "ar" ? `${arrow} ${value}%` : `${arrow} ${value}%`;
}

export function buildRuleBasedAlerts(params: {
  currentRevenue: unknown;
  previousRevenue: unknown;
  currentCompletionRate: unknown;
  previousCompletionRate: unknown;
  currentCancellationRate: unknown;
  currentNoShowRate: unknown;
  currentRetentionRate: unknown;
  previousRetentionRate: unknown;
  locale: string;
}) {
  const {
    currentRevenue,
    previousRevenue,
    currentCompletionRate,
    previousCompletionRate,
    currentCancellationRate,
    currentNoShowRate,
    currentRetentionRate,
    previousRetentionRate,
    locale
  } = params;

  const alerts: Array<{
    id: string;
    tone: "rose" | "amber" | "blue";
    title: string;
    description: string;
  }> = [];

  const revenueChange = percentChange(currentRevenue, previousRevenue);
  if (safeNumber(previousRevenue) > 0 && revenueChange <= -15) {
    alerts.push({
      id: "revenue-decline",
      tone: "rose",
      title: locale === "ar" ? "انخفاض الإيراد" : "Revenue decline",
      description: locale === "ar"
        ? `الإيراد انخفض بنسبة ${Math.abs(revenueChange).toFixed(1)}% مقارنة بالفترة السابقة.`
        : `Revenue declined by ${Math.abs(revenueChange).toFixed(1)}% versus the previous period.`
    });
  }

  if (safeNumber(currentCompletionRate) > 0 && safeNumber(currentCompletionRate) < 80) {
    alerts.push({
      id: "low-completion",
      tone: "amber",
      title: locale === "ar" ? "معدل إكمال منخفض" : "Low completion rate",
      description: locale === "ar"
        ? `معدل الإكمال الحالي ${safeNumber(currentCompletionRate).toFixed(1)}%.`
        : `Current completion rate is ${safeNumber(currentCompletionRate).toFixed(1)}%.`
    });
  }

  if (safeNumber(currentCancellationRate) >= 20) {
    alerts.push({
      id: "high-cancellation",
      tone: "amber",
      title: locale === "ar" ? "إلغاء مرتفع" : "High cancellation rate",
      description: locale === "ar"
        ? `معدل الإلغاء الحالي ${safeNumber(currentCancellationRate).toFixed(1)}%.`
        : `Current cancellation rate is ${safeNumber(currentCancellationRate).toFixed(1)}%.`
    });
  }

  if (safeNumber(currentNoShowRate) >= 15) {
    alerts.push({
      id: "high-no-show",
      tone: "amber",
      title: locale === "ar" ? "عدم حضور مرتفع" : "High no-show rate",
      description: locale === "ar"
        ? `معدل عدم الحضور الحالي ${safeNumber(currentNoShowRate).toFixed(1)}%.`
        : `Current no-show rate is ${safeNumber(currentNoShowRate).toFixed(1)}%.`
    });
  }

  const retentionChange = percentChange(currentRetentionRate, previousRetentionRate);
  if (safeNumber(previousRetentionRate) > 0 && retentionChange <= -10) {
    alerts.push({
      id: "retention-drop",
      tone: "blue",
      title: locale === "ar" ? "تراجع الاحتفاظ" : "Retention decline",
      description: locale === "ar"
        ? `الاحتفاظ انخفض بنسبة ${Math.abs(retentionChange).toFixed(1)}% مقارنة بالفترة السابقة.`
        : `Retention declined by ${Math.abs(retentionChange).toFixed(1)}% versus the previous period.`
    });
  }

  return alerts;
}
