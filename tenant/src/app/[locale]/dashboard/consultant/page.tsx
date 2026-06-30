"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { TenantLayout } from "@/components/TenantLayout";
import { tenantApi } from "@/lib/api";
import { hasAIConsultantEntitlement } from "@/lib/packageEntitlements";

type ConsultantTabId = "chat" | "reports" | "settings";
type ConsultantLanguage = "ar" | "en";
type ConsultantTone = "professional_arabic" | "saudi_executive_style" | "executive_english";
type ConsultantAddressingStyle = "neutral_professional" | "male_formal" | "female_formal" | "no_titles";
type ConsultantHistoryKind = "analysis" | "briefing";
type ConsultantHistoryStatus = "open" | "paused" | "completed";
type ConsultantSeverity = "low" | "medium" | "high";
type ConsultantTrend = "positive" | "negative" | "neutral";
type ConsultantDirection = "up" | "down" | "flat";
type ConsultantChartType = "line" | "bar" | "pie";

type ConsultantCommunicationPreferences = {
  language: ConsultantLanguage;
  tone: ConsultantTone;
  addressingStyle: ConsultantAddressingStyle;
};

type LoadedConsultantSettings = {
  businessCountry?: string | null;
  defaultLanguage?: string | null;
  consultantWorkflow?: {
    communicationPreferences?: Partial<ConsultantCommunicationPreferences> | null;
  } | null;
};

type ConsultantKpi = {
  type: string;
  label: string;
  value: number;
  unit: string;
  delta: number;
  direction: ConsultantDirection;
  trend: ConsultantTrend;
};

type ConsultantChart = {
  type: ConsultantChartType;
  title: string;
  description: string;
  labels: string[];
  series: Array<{ name: string; data: number[] }>;
};

type ConsultantTable = {
  title: string;
  description: string;
  columns: string[];
  rows: Array<Record<string, any> | any[]>;
  source: string;
};

type ConsultantAlert = {
  severity: ConsultantSeverity;
  title: string;
  detail: string;
  deepLink: string | null;
};

type ConsultantRecommendation = {
  priority: ConsultantSeverity;
  title: string;
  detail: string;
  deepLink: string | null;
};

type ConsultantAction = {
  title: string;
  detail: string;
  module: string;
  deepLink: string | null;
  priority: ConsultantSeverity;
};

type ConsultantResponse = {
  summary: string;
  healthScore: number;
  kpis: ConsultantKpi[];
  charts: ConsultantChart[];
  tables: ConsultantTable[];
  alerts: ConsultantAlert[];
  recommendations: ConsultantRecommendation[];
  actions: ConsultantAction[];
};

type ConsultantHistoryItem = {
  id: string;
  kind: ConsultantHistoryKind;
  title: string;
  preview: string;
  generatedAt: string;
  periodType: string;
  periodLabel: string;
  status: ConsultantHistoryStatus;
  sourceLabel: string;
  reportId: string | null;
  snapshotId: string | null;
  reportData: ConsultantResponse;
};

const defaultHistoryPreview = {
  en: {
    analysis: "Executive analysis ready for review.",
    briefing: "Automated briefing ready for the team."
  },
  ar: {
    analysis: "التحليل التنفيذي جاهز للمراجعة.",
    briefing: "الملخص التلقائي جاهز للفريق."
  }
} as const;

const ui = {
  en: {
    eyebrow: "AI Consultant",
    title: "Executive advisor workspace",
    subtitle: "A focused salon business console for chat, reports, and settings without dashboard clutter.",
    newAnalysis: "New analysis",
    startAnalysis: "Start new analysis",
    refreshHistory: "Refresh history",
    searchLabel: "Search history",
    searchPlaceholder: "Search by title, brief, or module",
    historyTitle: "Conversation history",
    historyEmpty: "No analyses yet. Start a new analysis to generate the first executive briefing.",
    historyEmptyMatch: "No matching items found.",
    historyLoading: "Loading history...",
    tabChat: "Chat",
    tabReports: "Reports",
    tabSettings: "Settings",
    businessHealth: "Business Health",
    healthScore: "Health score",
    generated: "Generated",
    period: "Period",
    executiveBrief: "Daily Executive Brief",
    executiveBriefHelp: "A concise, executive-ready readout of what needs attention now.",
    askPlaceholder: "Ask the consultant for a new executive briefing...",
    askHelper: "This runs the consultant workflow using the latest stored snapshot.",
    runPrompt: "Run analysis",
    suggestedQuestions: "Suggested questions",
    suggestedActions: "Suggested actions",
    analysisOutput: "Structured analysis",
    kpis: "KPI cards",
    charts: "Charts",
    tables: "Tables",
    alerts: "Alerts",
    recommendations: "Recommendations",
    actions: "Actions",
    openModule: "Open module",
    reportArchive: "Analysis archive",
    reportArchiveHelp: "Stored analyses and generated briefings stay here for quick return.",
    reportTypeAnalysis: "Analysis",
    reportTypeBriefing: "Briefing",
    openAnalysis: "Open analysis",
    openBriefing: "Open briefing",
    reportsEmpty: "No stored analyses are available yet.",
    settingsTitle: "Consultant communication",
    settingsHelp: "These preferences are stored per tenant and injected automatically into the prompt engine.",
    language: "Language",
    tone: "Consultant tone",
    addressing: "Preferred addressing style",
    save: "Save preferences",
    saving: "Saving...",
    saved: "Consultant preferences saved successfully.",
    saveFailed: "Failed to save consultant preferences.",
    defaultPolicy: "Saudi tenants default to Arabic, Saudi Executive Style, and Neutral Professional addressing.",
    sampleOutputs: "Sample outputs",
    sampleSummary: "Executive summary",
    sampleRecommendation: "Recommendation",
    sampleAction: "Suggested action",
    voiceProfile: "Voice profile",
    emptyStateTitle: "Ready for the first briefing",
    emptyStateBody: "Run a new analysis to generate the first structured consultant report.",
    loadingDetail: "Loading consultant detail...",
    running: "Preparing executive briefing...",
    retry: "Retry",
    errorPrefix: "We could not load the consultant workspace.",
    openReports: "Open reports",
    openSettings: "Open settings",
    activeHistory: "Current focus",
    premiumTitle: "AI Consultant is not included in your subscription.",
    premiumDescription: "Upgrade your package to unlock AI business advisor insights, daily executive briefings, operational alerts, growth recommendations, and predictive insights.",
    premiumUpgrade: "Upgrade package",
    accessDenied: "AI Consultant is not included in your package.",
    automaticBriefings: "Automatic briefings",
    automaticBriefingsHelp: "This controls automation only. Manual analysis always works when the package includes AI Consultant.",
    automaticBriefingsEnabled: "Automatic briefings are enabled.",
    automaticBriefingsDisabled: "Automatic briefings are disabled in settings."
  },
  ar: {
    eyebrow: "مستشار ذكي",
    title: "مساحة المستشار التنفيذي",
    subtitle: "واجهة مركزة لإدارة الأعمال تجمع المحادثة والتقارير والإعدادات بدون ازدحام لوحات التحكم.",
    newAnalysis: "تحليل جديد",
    startAnalysis: "بدء تحليل جديد",
    refreshHistory: "تحديث السجل",
    searchLabel: "البحث في السجل",
    searchPlaceholder: "ابحث بالعنوان أو الملخص أو الوحدة",
    historyTitle: "سجل المحادثات",
    historyEmpty: "لا توجد تحليلات بعد. ابدأ بتحليل جديد لإنشاء أول موجز تنفيذي.",
    historyEmptyMatch: "لا توجد عناصر مطابقة.",
    historyLoading: "جارٍ تحميل السجل...",
    tabChat: "المحادثة",
    tabReports: "التقارير",
    tabSettings: "الإعدادات",
    businessHealth: "صحة الأعمال",
    healthScore: "درجة الصحة",
    generated: "تم الإنشاء",
    period: "الفترة",
    executiveBrief: "الملخص التنفيذي اليومي",
    executiveBriefHelp: "قراءة مختصرة ومهنية لما يحتاج انتباه الإدارة الآن.",
    askPlaceholder: "اطلب من المستشار إعداد موجز تنفيذي جديد...",
    askHelper: "سيتم تشغيل سير العمل اعتماداً على آخر snapshot محفوظ.",
    runPrompt: "تشغيل التحليل",
    suggestedQuestions: "أسئلة مقترحة",
    suggestedActions: "إجراءات مقترحة",
    analysisOutput: "التحليل المنظم",
    kpis: "بطاقات KPI",
    charts: "الرسوم",
    tables: "الجداول",
    alerts: "التنبيهات",
    recommendations: "التوصيات",
    actions: "الإجراءات",
    openModule: "فتح الوحدة",
    reportArchive: "أرشيف التحليلات",
    reportArchiveHelp: "تُحفظ التحليلات والموجزات التلقائية هنا للرجوع السريع.",
    reportTypeAnalysis: "تحليل",
    reportTypeBriefing: "موجز",
    openAnalysis: "فتح التحليل",
    openBriefing: "فتح الموجز",
    reportsEmpty: "لا توجد تحليلات محفوظة حتى الآن.",
    settingsTitle: "تواصل المستشار",
    settingsHelp: "تُحفظ هذه التفضيلات لكل tenant وتُحقن تلقائياً في محرك الـ prompt.",
    language: "اللغة",
    tone: "نبرة المستشار",
    addressing: "أسلوب النداء المفضل",
    save: "حفظ الإعدادات",
    saving: "جارٍ الحفظ...",
    saved: "تم حفظ إعدادات المستشار بنجاح.",
    saveFailed: "تعذر حفظ إعدادات المستشار.",
    defaultPolicy: "الـ tenant السعودي الافتراضي يستخدم العربية ونبرة Saudi Executive Style مع أسلوب Neutral Professional.",
    sampleOutputs: "نماذج مخرجات",
    sampleSummary: "ملخص تنفيذي",
    sampleRecommendation: "توصية",
    sampleAction: "إجراء مقترح",
    voiceProfile: "ملف النبرة",
    emptyStateTitle: "جاهز لأولى الموجزات",
    emptyStateBody: "ابدأ تحليلاً جديداً لإنشاء أول تقرير مستشار منظم.",
    loadingDetail: "جارٍ تحميل تفاصيل المستشار...",
    running: "جارٍ إعداد الموجز التنفيذي...",
    retry: "إعادة المحاولة",
    errorPrefix: "تعذر تحميل مساحة المستشار.",
    openReports: "فتح التقارير",
    openSettings: "فتح الإعدادات",
    activeHistory: "العنصر الحالي",
    premiumTitle: "مستشار الذكاء الاصطناعي غير مشمول في اشتراكك.",
    premiumDescription: "قم بترقية باقتك لفتح رؤى المستشار التنفيذي، والملخصات اليومية، والتنبيهات التشغيلية، وتوصيات النمو، والرؤى التنبؤية.",
    premiumUpgrade: "ترقية الباقة",
    accessDenied: "مستشار الذكاء الاصطناعي غير مشمول في باقتك.",
    automaticBriefings: "الملخصات التلقائية",
    automaticBriefingsHelp: "هذا الخيار يتحكم في الأتمتة فقط. التحليل اليدوي يعمل دائماً عندما تتضمن الباقة مستشار الذكاء الاصطناعي.",
    automaticBriefingsEnabled: "الملخصات التلقائية مفعلة.",
    automaticBriefingsDisabled: "الملخصات التلقائية معطلة في الإعدادات."
  }
} as const;

const languageLabels: Record<ConsultantLanguage, Record<"en" | "ar", string>> = {
  ar: { en: "Arabic", ar: "العربية" },
  en: { en: "English", ar: "الإنجليزية" }
};

const toneLabels: Record<ConsultantTone, Record<"en" | "ar", string>> = {
  professional_arabic: { en: "Professional Arabic", ar: "عربية مهنية" },
  saudi_executive_style: { en: "Saudi Executive Style", ar: "الأسلوب التنفيذي السعودي" },
  executive_english: { en: "Executive English", ar: "الإنجليزية التنفيذية" }
};

const addressingLabels: Record<ConsultantAddressingStyle, Record<"en" | "ar", string>> = {
  neutral_professional: { en: "Neutral Professional", ar: "مهني محايد" },
  male_formal: { en: "Male Formal", ar: "صيغة رسمية للمذكر" },
  female_formal: { en: "Female Formal", ar: "صيغة رسمية للمؤنث" },
  no_titles: { en: "No Titles", ar: "بدون ألقاب" }
};

function getDefaultConsultantPreferences(settings?: LoadedConsultantSettings | null): ConsultantCommunicationPreferences {
  const country = `${settings?.businessCountry || ""}`.trim().toLowerCase();
  const defaultLanguage = `${settings?.defaultLanguage || ""}`.trim().toLowerCase();
  const isSaudiTenant = country.includes("saudi") || country === "ksa" || country === "sa";

  if (isSaudiTenant || defaultLanguage === "ar") {
    return {
      language: "ar",
      tone: "saudi_executive_style",
      addressingStyle: "neutral_professional"
    };
  }

  return {
    language: "en",
    tone: "executive_english",
    addressingStyle: "neutral_professional"
  };
}

function normalizeList(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function normalizeConsultantResponse(raw: any = {}): ConsultantResponse {
  const summary = `${raw.summary || raw.executiveSummary || ""}`.trim();
  const healthScore = Number.isFinite(Number(raw.healthScore))
    ? Math.max(0, Math.min(100, Math.round(Number(raw.healthScore))))
    : 0;

  return {
    summary,
    healthScore,
    kpis: normalizeList(raw.kpis).map((item: any) => ({
      type: `${item?.type || "revenue"}`.trim(),
      label: `${item?.label || ""}`.trim(),
      value: Number.isFinite(Number(item?.value)) ? Number(item.value) : 0,
      unit: `${item?.unit || ""}`.trim() || "count",
      delta: Number.isFinite(Number(item?.delta)) ? Number(item.delta) : 0,
      direction: ["up", "down", "flat"].includes(item?.direction) ? item.direction : "flat",
      trend: ["positive", "negative", "neutral"].includes(item?.trend) ? item.trend : "neutral"
    })),
    charts: normalizeList(raw.charts).map((chart: any) => ({
      type: ["line", "bar", "pie"].includes(chart?.type) ? chart.type : "line",
      title: `${chart?.title || ""}`.trim(),
      description: `${chart?.description || ""}`.trim(),
      labels: Array.isArray(chart?.labels) ? chart.labels.map((label: any) => `${label ?? ""}`) : [],
      series: Array.isArray(chart?.series)
        ? chart.series.map((serie: any) => ({
            name: `${serie?.name || ""}`.trim(),
            data: Array.isArray(serie?.data) ? serie.data.map((value: any) => (Number.isFinite(Number(value)) ? Number(value) : 0)) : []
          }))
        : []
    })),
    tables: normalizeList(raw.tables).map((table: any) => ({
      title: `${table?.title || ""}`.trim(),
      description: `${table?.description || ""}`.trim(),
      columns: Array.isArray(table?.columns) ? table.columns.map((column: any) => `${column ?? ""}`) : [],
      rows: Array.isArray(table?.rows) ? table.rows : [],
      source: `${table?.source || ""}`.trim()
    })),
    alerts: normalizeList(raw.alerts).map((alert: any) => ({
      severity: ["low", "medium", "high"].includes(alert?.severity) ? alert.severity : "medium",
      title: `${alert?.title || ""}`.trim(),
      detail: `${alert?.detail || ""}`.trim(),
      deepLink: `${alert?.deepLink || ""}`.trim() || null
    })),
    recommendations: normalizeList(raw.recommendations).map((item: any) => ({
      priority: ["low", "medium", "high"].includes(item?.priority) ? item.priority : "medium",
      title: `${item?.title || ""}`.trim(),
      detail: `${item?.detail || ""}`.trim(),
      deepLink: `${item?.deepLink || ""}`.trim() || null
    })),
    actions: normalizeList(raw.actions).map((item: any) => ({
      title: `${item?.title || ""}`.trim(),
      detail: `${item?.detail || ""}`.trim(),
      module: `${item?.module || ""}`.trim() || "consultant",
      deepLink: `${item?.deepLink || ""}`.trim() || null,
      priority: ["low", "medium", "high"].includes(item?.priority) ? item.priority : "medium"
    }))
  };
}

function extractListPayload(response: any): any[] {
  const payload = response?.data?.data ?? response?.data ?? response;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function extractDetailPayload(response: any): any {
  const payload = response?.data?.data ?? response?.data ?? response;
  return payload?.reportData || payload?.data || payload || {};
}

function toLocalDateLabel(value: string, locale: string) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return locale === "ar" ? "غير متوفر" : "Unavailable";
  }

  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function getConsultantAnalyticsRange() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 29);

  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0]
  };
}

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", {
    maximumFractionDigits: 1
  }).format(value || 0);
}

function formatMetricValue(metric: ConsultantKpi, locale: string) {
  const value = metric.value ?? 0;

  if (metric.unit === "percent") return `${formatNumber(value, locale)}%`;
  if (metric.unit === "currency") {
    return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", {
      style: "currency",
      currency: "SAR",
      maximumFractionDigits: 0
    }).format(value);
  }

  return formatNumber(value, locale);
}

function truncateText(value: string, limit = 120) {
  const text = `${value || ""}`.trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1)}…`;
}

function ChartCard({ chart, locale }: { chart: ConsultantChart; locale: string }) {
  const primarySeries = chart.series[0]?.data || [];
  const maxValue = Math.max(...primarySeries, 1);

  return (
    <article className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">
            {chart.type.toUpperCase()}
          </p>
          <h3 className="mt-1 text-lg font-bold text-gray-900">{chart.title}</h3>
          {chart.description ? <p className="mt-1 text-sm text-gray-600">{chart.description}</p> : null}
        </div>
        <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-600">
          {chart.series.length} {locale === "ar" ? "سلسلة" : "series"}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {chart.labels.map((label, index) => {
          const value = primarySeries[index] ?? 0;
          const width = maxValue ? Math.max(6, Math.round((value / maxValue) * 100)) : 6;

          return (
            <div key={`${label}-${index}`} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-xs font-medium text-gray-600">
                <span>{label}</span>
                <span>{formatNumber(value, locale)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full ${chart.type === "pie" ? "bg-amber-400" : "bg-primary"}`}
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {chart.series.length > 1 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {chart.series.map((series, index) => (
            <span key={`${series.name}-${index}`} className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700">
              {series.name}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function TableCard({ table, locale }: { table: ConsultantTable; locale: string }) {
  const rows = Array.isArray(table.rows) ? table.rows : [];
  const columns = table.columns || [];

  const resolveCell = (row: Record<string, any> | any[], column: string, columnIndex: number) => {
    if (Array.isArray(row)) {
      return row[columnIndex] ?? row[`${columnIndex}`] ?? "";
    }

    if (row && typeof row === "object") {
      const direct = row[column];
      if (direct !== undefined && direct !== null) return direct;

      const normalizedKey = column.replace(/\s+/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      const objectMatch = Object.entries(row).find(([key]) => key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() === normalizedKey);
      if (objectMatch) return objectMatch[1];
    }

    return "";
  };

  const renderValue = (value: any) => {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "number") return formatNumber(value, locale);
    if (typeof value === "object") return JSON.stringify(value);
    return `${value}`;
  };

  return (
    <article className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{table.title}</h3>
          {table.description ? <p className="mt-1 text-sm text-gray-600">{table.description}</p> : null}
        </div>
        {table.source ? (
          <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-600">
            {table.source}
          </span>
        ) : null}
      </div>

      <div className="mt-4 max-h-80 overflow-auto rounded-2xl border border-gray-200">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th key={column} className="whitespace-nowrap border-b border-gray-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, rowIndex) => (
                <tr key={`${table.title}-${rowIndex}`} className="border-b border-gray-100 last:border-0">
                  {columns.map((column, columnIndex) => (
                    <td key={`${column}-${rowIndex}`} className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {renderValue(resolveCell(row, column, columnIndex))}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={Math.max(columns.length, 1)} className="px-4 py-8 text-center text-sm text-gray-500">
                  {locale === "ar" ? "لا توجد بيانات لعرضها." : "No rows available."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function AnalysisBlock({
  item,
  locale,
  onAction,
  isNavigating
}: {
  item: ConsultantHistoryItem;
  locale: string;
  onAction: (href: string) => void;
  isNavigating: boolean;
}) {
  const analysis = item.reportData;
  const text = ui[locale as "en" | "ar"];

  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] border border-gray-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">{text.businessHealth}</p>
            <div className="mt-3 flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/15 bg-white/10 text-2xl font-black">
                {analysis.healthScore || 0}
              </div>
              <div className="min-w-0">
                <h3 className="text-2xl font-black tracking-tight">
                  {analysis.summary || text.emptyStateBody}
                </h3>
                <p className="mt-2 text-sm text-white/75">
                  {text.generated}: {toLocalDateLabel(item.generatedAt, locale)} · {text.period}: {item.periodLabel}
                </p>
              </div>
            </div>
          </div>
          <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold">
            {text.healthScore}: {analysis.healthScore || 0}/100
          </span>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{text.executiveBrief}</p>
            <h3 className="mt-1 text-xl font-bold text-gray-900">{item.title}</h3>
            <p className="mt-2 text-sm text-gray-600">{text.executiveBriefHelp}</p>
          </div>
          <div className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-600">
            {item.sourceLabel}
          </div>
        </div>

        <div className="mt-4 rounded-3xl border border-gray-200 bg-gray-50 p-4 text-sm leading-7 text-gray-700">
          {analysis.summary || (locale === "ar" ? "لا يوجد ملخص متاح." : "No executive summary is available yet.")}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{text.suggestedQuestions}</p>
            <h3 className="mt-1 text-lg font-bold text-gray-900">
              {locale === "ar" ? "المقترحات التنفيذية" : "Executive prompts"}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onAction(`/${locale}/dashboard/reports`)}
            className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            {text.openReports}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(locale === "ar"
            ? [
                "ما الذي يحتاج انتباهاً هذا الأسبوع؟",
                "أين تظهر إشارات تراجع الاحتفاظ؟",
                "ما أهم إجراء لتحسين الإيراد اليوم؟"
              ]
            : [
                "What needs attention this week?",
                "Where is retention softening?",
                "What is the fastest revenue fix?"
              ]
          ).map((question) => (
            <button
              key={question}
              type="button"
              className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-primary/30 hover:bg-primary/5"
            >
              {question}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {analysis.kpis.map((metric) => {
            const positive = metric.direction === "up" || metric.trend === "positive";
            const negative = metric.direction === "down" || metric.trend === "negative";
            return (
              <article key={`${metric.type}-${metric.label}`} className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{metric.label}</p>
                <div className="mt-3 flex items-end justify-between gap-4">
                  <div className="text-3xl font-black tracking-tight text-gray-900">
                    {formatMetricValue(metric, locale)}
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      positive
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : negative
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-gray-200 bg-gray-50 text-gray-600"
                    }`}
                  >
                    {metric.delta > 0 ? "+" : ""}
                    {formatNumber(metric.delta, locale)}
                  </span>
                </div>
                <div className="mt-2 text-xs uppercase tracking-[0.16em] text-gray-400">{metric.type}</div>
              </article>
            );
          })}
        </div>

        {analysis.kpis.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600">
            {locale === "ar" ? "لا توجد بطاقات KPI في هذا التحليل." : "No KPI cards were returned for this analysis."}
          </div>
        ) : null}
      </section>

      {analysis.charts.length ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">{text.charts}</h3>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {analysis.charts.map((chart) => (
              <ChartCard key={chart.title} chart={chart} locale={locale} />
            ))}
          </div>
        </section>
      ) : null}

      {analysis.tables.length ? (
        <section className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900">{text.tables}</h3>
          <div className="grid gap-4">
            {analysis.tables.map((table) => (
              <TableCard key={table.title} table={table} locale={locale} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-3">
        <article className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900">{text.alerts}</h3>
          <div className="mt-4 space-y-3">
            {analysis.alerts.length ? (
              analysis.alerts.map((alert) => (
                <div key={`${alert.title}-${alert.detail}`} className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{alert.title}</div>
                      <div className="mt-1 text-sm text-gray-600">{alert.detail}</div>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                      alert.severity === "high"
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : alert.severity === "medium"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                    }`}>
                      {alert.severity}
                    </span>
                  </div>
                  {alert.deepLink ? (
                    <button
                      type="button"
                      onClick={() => onAction(alert.deepLink as string)}
                      disabled={isNavigating}
                      className="mt-3 text-sm font-semibold text-primary hover:underline"
                    >
                      {text.openModule}
                    </button>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                {locale === "ar" ? "لا توجد تنبيهات حالياً." : "No alerts are available right now."}
              </div>
            )}
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900">{text.recommendations}</h3>
          <div className="mt-4 space-y-3">
            {analysis.recommendations.length ? (
              analysis.recommendations.map((recommendation) => (
                <div key={`${recommendation.title}-${recommendation.detail}`} className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{recommendation.title}</div>
                      <div className="mt-1 text-sm text-gray-600">{recommendation.detail}</div>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                      recommendation.priority === "high"
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : recommendation.priority === "medium"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                    }`}>
                      {recommendation.priority}
                    </span>
                  </div>
                  {recommendation.deepLink ? (
                    <button
                      type="button"
                      onClick={() => onAction(recommendation.deepLink as string)}
                      disabled={isNavigating}
                      className="mt-3 text-sm font-semibold text-primary hover:underline"
                    >
                      {text.openModule}
                    </button>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                {locale === "ar" ? "لا توجد توصيات حالياً." : "No recommendations are available right now."}
              </div>
            )}
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900">{text.actions}</h3>
          <div className="mt-4 space-y-3">
            {analysis.actions.length ? (
              analysis.actions.map((action) => (
                <button
                  key={`${action.title}-${action.detail}`}
                  type="button"
                  onClick={() => action.deepLink && onAction(action.deepLink)}
                  disabled={isNavigating}
                  className="w-full rounded-3xl border border-gray-200 bg-gray-50 p-4 text-left transition hover:border-primary/30 hover:bg-primary/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-gray-900">{action.title}</div>
                      <div className="mt-1 text-sm text-gray-600">{action.detail}</div>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                      action.priority === "high"
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : action.priority === "medium"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                    }`}>
                      {action.module}
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                {locale === "ar" ? "لا توجد إجراءات حالياً." : "No actions are available right now."}
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

function ReportsArchive({
  items,
  locale,
  onOpen
}: {
  items: ConsultantHistoryItem[];
  locale: string;
  onOpen: (item: ConsultantHistoryItem) => void;
}) {
  const text = ui[locale as "en" | "ar"];
  return (
    <section className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{text.reportArchive}</p>
          <h3 className="mt-1 text-lg font-bold text-gray-900">{text.reportArchiveHelp}</h3>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-3xl border border-gray-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{locale === "ar" ? "العنوان" : "Title"}</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{locale === "ar" ? "النوع" : "Type"}</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{text.generated}</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{text.healthScore}</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{locale === "ar" ? "إجراء" : "Action"}</th>
            </tr>
          </thead>
          <tbody>
            {items.length ? (
              items.map((item) => (
                <tr key={item.id} className="border-t border-gray-100">
                  <td className="px-4 py-4">
                    <div className="font-semibold text-gray-900">{item.title}</div>
                    <div className="mt-1 text-xs text-gray-500">{truncateText(item.preview, 96)}</div>
                  </td>
                  <td className="px-4 py-4 text-gray-700">
                    {item.kind === "analysis" ? text.reportTypeAnalysis : text.reportTypeBriefing}
                  </td>
                  <td className="px-4 py-4 text-gray-700">{toLocalDateLabel(item.generatedAt, locale)}</td>
                  <td className="px-4 py-4 text-gray-700">{item.reportData.healthScore}</td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => onOpen(item)}
                      className="rounded-full border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      {item.kind === "analysis" ? text.openAnalysis : text.openBriefing}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                  {text.reportsEmpty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function ConsultantPage() {
  const locale = useLocale();
  const isRTL = locale === "ar";
  const router = useRouter();
  const text = ui[locale as "en" | "ar"];

  const [activeTab, setActiveTab] = useState<ConsultantTabId>("chat");
  const [history, setHistory] = useState<ConsultantHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draftPrompt, setDraftPrompt] = useState("");
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [consultantAccess, setConsultantAccess] = useState<boolean | null>(null);
  const [automaticBriefingsEnabled, setAutomaticBriefingsEnabled] = useState(false);
  const [isNavigating, startNavigation] = useTransition();
  const [consultantPreferences, setConsultantPreferences] = useState<ConsultantCommunicationPreferences>({
    language: isRTL ? "ar" : "en",
    tone: isRTL ? "saudi_executive_style" : "executive_english",
    addressingStyle: "neutral_professional"
  });
  const [loadedSettings, setLoadedSettings] = useState<LoadedConsultantSettings | null>(null);
  const [advancedAnalytics, setAdvancedAnalytics] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    const loadWorkspace = async () => {
      try {
        setLoading(true);
        setError(null);

        const limitsResponse = await tenantApi.getSubscriptionLimits().catch((loadError) => {
          console.error("Failed to load consultant subscription limits:", loadError);
          return null;
        });

        if (!mounted) return;

        const consultantEnabled = limitsResponse?.success
          ? hasAIConsultantEntitlement(limitsResponse.limits)
          : true;

        setConsultantAccess(consultantEnabled);

        if (!consultantEnabled) {
          setHistory([]);
          setSelectedHistoryId(null);
          return;
        }

        const settingsResponse = await tenantApi.getSettings().catch((loadError) => {
          console.error("Failed to load consultant settings:", loadError);
          return null;
        });

        if (!mounted) return;

        if (settingsResponse?.success) {
          const business = settingsResponse.data?.business || {};
          const settings = settingsResponse.data?.settings || {};
          const workflow = settings.notificationSettings?.consultantWorkflow || {};
          const preferences = workflow.communicationPreferences || {};
          const defaults = getDefaultConsultantPreferences({
            businessCountry: business.country,
            defaultLanguage: settings.defaultLanguage
          });

          setLoadedSettings({
            businessCountry: business.country,
            defaultLanguage: settings.defaultLanguage,
            consultantWorkflow: workflow
          });
          setAutomaticBriefingsEnabled(Boolean(workflow.automaticBriefingsEnabled));

          setConsultantPreferences({
            language: (preferences.language as ConsultantLanguage) || defaults.language,
            tone: (preferences.tone as ConsultantTone) || defaults.tone,
            addressingStyle: (preferences.addressingStyle as ConsultantAddressingStyle) || defaults.addressingStyle
          });
        }

        const [reportsResponse, briefingsResponse, analyticsResponse] = await Promise.all([
          tenantApi.getConsultantReports({ page: 1, limit: 12 }),
          tenantApi.getConsultantBriefings({ page: 1, limit: 12 }),
          tenantApi.getAdvancedAnalytics(getConsultantAnalyticsRange()).catch(() => null)
        ]);

        const toHistoryItem = (row: any, kind: ConsultantHistoryKind): ConsultantHistoryItem | null => {
          if (!row?.id) return null;
          const analysis = normalizeConsultantResponse(row.reportData || row.report_data || row.data || {});
          const generatedAt = `${row.generatedAt || row.createdAt || row.updatedAt || ""}`.trim();
          const periodType = `${row.periodType || row.period_type || "daily"}`.trim();
          const start = row.periodStart || row.period_start || null;
          const end = row.periodEnd || row.period_end || null;
          const periodLabel = start && end
            ? `${toLocalDateLabel(start, locale)} - ${toLocalDateLabel(end, locale)}`
            : periodType;

          return {
            id: `${row.id}`,
            kind,
            title: `${row.title || (kind === "analysis" ? (locale === "ar" ? "تحليل أعمال" : "Business analysis") : (locale === "ar" ? "موجز تنفيذي" : "Executive briefing"))}`,
            preview: truncateText(
              analysis.summary || `${row.description || ""}`.trim() || defaultHistoryPreview[locale as "en" | "ar"][kind],
              150
            ),
            generatedAt,
            periodType,
            periodLabel,
            status: (row.status || "open") as ConsultantHistoryStatus,
            sourceLabel: kind === "analysis" ? text.reportTypeAnalysis : text.reportTypeBriefing,
            reportId: row.id ? `${row.id}` : null,
            snapshotId: row.snapshotId ? `${row.snapshotId}` : null,
            reportData: analysis
          };
        };

        const analysisItems = extractListPayload(reportsResponse)
          .map((row) => toHistoryItem(row, "analysis"))
          .filter(Boolean) as ConsultantHistoryItem[];
        const briefingItems = extractListPayload(briefingsResponse)
          .map((row) => toHistoryItem(row, "briefing"))
          .filter(Boolean) as ConsultantHistoryItem[];

        const merged = [...analysisItems, ...briefingItems].sort((left, right) => {
          const leftTime = new Date(left.generatedAt || 0).getTime();
          const rightTime = new Date(right.generatedAt || 0).getTime();
          return rightTime - leftTime;
        });

        setHistory(merged);
        setSelectedHistoryId((current) => (current && merged.some((item) => item.id === current) ? current : merged[0]?.id || null));
        setAdvancedAnalytics(analyticsResponse?.success ? analyticsResponse.data || null : null);
      } catch (loadError: any) {
        console.error("Failed to load consultant workspace:", loadError);
        setError(loadError?.message || (locale === "ar" ? "تعذر تحميل السجل." : "Failed to load consultant workspace."));
        setAdvancedAnalytics(null);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadWorkspace();

    return () => {
      mounted = false;
    };
  }, [locale, text.reportTypeAnalysis, text.reportTypeBriefing]);

  useEffect(() => {
    if (!settingsMessage) return;
    const timer = window.setTimeout(() => setSettingsMessage(null), 3500);
    return () => window.clearTimeout(timer);
  }, [settingsMessage]);

  const filteredHistory = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return history;
    return history.filter((item) =>
      [item.title, item.preview, item.periodType, item.sourceLabel, item.reportData.summary]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [history, search]);

  const selectedHistoryItem = useMemo(
    () => history.find((item) => item.id === selectedHistoryId) || history[0] || null,
    [history, selectedHistoryId]
  );

  useEffect(() => {
    if (!history.length) {
      setSelectedHistoryId(null);
      return;
    }

    if (!selectedHistoryId || !history.some((item) => item.id === selectedHistoryId)) {
      setSelectedHistoryId(history[0].id);
    }
  }, [history, selectedHistoryId]);

  const openModule = (href: string) => {
    const normalizedHref = href.startsWith(`/${locale}/`)
      ? href
      : href.startsWith("/")
        ? `/${locale}${href}`
        : `/${locale}/${href}`;

    startNavigation(() => {
      router.push(normalizedHref);
    });
  };

  const openHistoryItem = async (item: ConsultantHistoryItem) => {
    try {
      setLoadingDetail(true);
      setError(null);
      setSelectedHistoryId(item.id);
      setActiveTab("chat");

      const detailResponse =
        item.kind === "analysis"
          ? await tenantApi.getConsultantReport(item.reportId || item.id)
          : await tenantApi.getConsultantBriefing(item.reportId || item.id);

      const detailPayload = extractDetailPayload(detailResponse);
      const normalized = normalizeConsultantResponse(detailPayload.reportData || detailPayload);
      setHistory((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                title: `${detailPayload.title || entry.title}`,
                preview: truncateText(
                  normalized.summary || `${detailPayload.description || ""}`.trim() || entry.preview,
                  150
                ),
                reportData: normalized,
                sourceLabel: detailPayload.reportType === "consultant_briefing" ? text.reportTypeBriefing : text.reportTypeAnalysis
              }
            : entry
        )
      );
    } catch (detailError: any) {
      console.error("Failed to open consultant item:", detailError);
      setError(detailError?.message || (locale === "ar" ? "تعذر فتح العنصر المحدد." : "Failed to open the selected item."));
    } finally {
      setLoadingDetail(false);
    }
  };

  const runAnalysis = async () => {
    if (consultantAccess === false) {
      setError(text.accessDenied);
      setActiveTab("settings");
      return;
    }

    try {
      setRunningAnalysis(true);
      setError(null);
      const workflowResponse = await tenantApi.runConsultantWorkflow({ force: true });
      const workflowResult = workflowResponse?.data?.data ?? workflowResponse?.data ?? workflowResponse;

      if (workflowResult?.allowed === false && workflowResult?.reason === "subscription_required") {
        setConsultantAccess(false);
        setError(workflowResponse?.message || text.accessDenied);
        return;
      }

      if (workflowResult?.skipped && workflowResult?.reason === "workflow_disabled") {
        setSettingsMessage(text.automaticBriefingsDisabled);
        return;
      }

      const [reportsResponse, briefingsResponse] = await Promise.all([
        tenantApi.getConsultantReports({ page: 1, limit: 12 }),
        tenantApi.getConsultantBriefings({ page: 1, limit: 12 })
      ]);

      const toHistoryItem = (row: any, kind: ConsultantHistoryKind): ConsultantHistoryItem | null => {
        if (!row?.id) return null;
        const analysis = normalizeConsultantResponse(row.reportData || row.data || {});
        const generatedAt = `${row.generatedAt || row.createdAt || row.updatedAt || ""}`.trim();
        const periodType = `${row.periodType || "daily"}`.trim();
        const start = row.periodStart || null;
        const end = row.periodEnd || null;
        const periodLabel = start && end
          ? `${toLocalDateLabel(start, locale)} - ${toLocalDateLabel(end, locale)}`
          : periodType;

        return {
          id: `${row.id}`,
          kind,
          title: `${row.title || (kind === "analysis" ? (locale === "ar" ? "تحليل أعمال" : "Business analysis") : (locale === "ar" ? "موجز تنفيذي" : "Executive briefing"))}`,
          preview: truncateText(analysis.summary || `${row.description || ""}`.trim(), 150),
          generatedAt,
          periodType,
          periodLabel,
          status: (row.status || "open") as ConsultantHistoryStatus,
          sourceLabel: kind === "analysis" ? text.reportTypeAnalysis : text.reportTypeBriefing,
          reportId: row.id ? `${row.id}` : null,
          snapshotId: row.snapshotId ? `${row.snapshotId}` : null,
          reportData: analysis
        };
      };

      const nextItems = [
        ...extractListPayload(reportsResponse).map((row) => toHistoryItem(row, "analysis")).filter(Boolean),
        ...extractListPayload(briefingsResponse).map((row) => toHistoryItem(row, "briefing")).filter(Boolean)
      ] as ConsultantHistoryItem[];

      nextItems.sort((left, right) => new Date(right.generatedAt || 0).getTime() - new Date(left.generatedAt || 0).getTime());
      setHistory(nextItems);
      setSelectedHistoryId(nextItems[0]?.id || null);
      setActiveTab("chat");
    } catch (runError: any) {
      console.error("Failed to run consultant workflow:", runError);
      setError(runError?.message || (locale === "ar" ? "تعذر تشغيل التحليل الجديد." : "Failed to run a new analysis."));
    } finally {
      setRunningAnalysis(false);
    }
  };

  const handleSaveConsultantPreferences = async () => {
    try {
      setSettingsSaving(true);
      await tenantApi.updateNotificationSettings({
        consultantWorkflow: {
          ...(loadedSettings?.consultantWorkflow || {}),
          automaticBriefingsEnabled,
          communicationPreferences: consultantPreferences
        }
      });
      setSettingsMessage(text.saved);
    } catch (saveError: any) {
      setSettingsMessage(saveError?.message || text.saveFailed);
    } finally {
      setSettingsSaving(false);
    }
  };

  const suggestedQuestions = useMemo(() => {
    if (locale === "ar") {
      return [
        "ما الذي يحتاج انتباهاً هذا الأسبوع؟",
        "أين تظهر إشارات تراجع الاحتفاظ؟",
        "ما أهم إجراء لتحسين الإيراد اليوم؟"
      ];
    }

    return [
      "What needs attention this week?",
      "Where is retention softening?",
      "What is the fastest revenue fix?"
    ];
  }, [locale]);

  return (
    <TenantLayout>
      <div className="space-y-5" dir={isRTL ? "rtl" : "ltr"}>
        <section className="rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{text.eyebrow}</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900">{text.title}</h1>
              <p className="mt-2 text-sm leading-7 text-gray-600">{text.subtitle}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {consultantAccess === false ? (
                <button
                  type="button"
                  onClick={() => router.push(`/${locale}/dashboard/subscription`)}
                  className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                >
                  {text.premiumUpgrade}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={runAnalysis}
                    disabled={runningAnalysis}
                    className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {runningAnalysis ? text.running : text.newAnalysis}
                  </button>
                  <button
                    type="button"
                    onClick={() => void runAnalysis()}
                    className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    {text.refreshHistory}
                  </button>
                </>
              )}
            </div>
          </div>
        </section>

        {consultantAccess === false ? (
          <section className="rounded-[2rem] border border-gray-200 bg-white p-8 shadow-sm">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-8 text-white shadow-lg">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">{text.eyebrow}</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight">{text.premiumTitle}</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">{text.premiumDescription}</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => router.push(`/${locale}/dashboard/subscription`)}
                    className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-gray-100"
                  >
                    {text.premiumUpgrade}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/${locale}/dashboard/subscription`)}
                    className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    {locale === "ar" ? "عرض الاشتراك" : "View subscription"}
                  </button>
                </div>
              </div>

              <div className="space-y-4 rounded-[2rem] border border-gray-200 bg-gray-50 p-6">
                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900">
                  {text.accessDenied}
                </div>
                <div className="rounded-3xl border border-gray-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{text.suggestedQuestions}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {suggestedQuestions.map((question) => (
                      <button
                        key={question}
                        type="button"
                        onClick={() => router.push(`/${locale}/dashboard/subscription`)}
                        className="rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
        <section className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4 rounded-[2rem] border border-gray-200 bg-white p-4 shadow-sm lg:sticky lg:top-6 lg:h-fit">
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{text.searchLabel}</label>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={text.searchPlaceholder}
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <button
              type="button"
              onClick={runAnalysis}
              disabled={runningAnalysis}
              className="w-full rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {text.startAnalysis}
            </button>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{text.historyTitle}</p>
                <span className="text-xs font-medium text-gray-500">{filteredHistory.length}</span>
              </div>

              {loading ? (
                <div className="space-y-3">
                  <div className="h-24 animate-pulse rounded-3xl border border-gray-200 bg-gray-100" />
                  <div className="h-24 animate-pulse rounded-3xl border border-gray-200 bg-gray-100" />
                  <div className="h-24 animate-pulse rounded-3xl border border-gray-200 bg-gray-100" />
                </div>
              ) : filteredHistory.length ? (
                filteredHistory.map((item) => {
                  const active = item.id === selectedHistoryId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void openHistoryItem(item)}
                      className={`w-full rounded-3xl border p-4 text-left transition ${
                        active
                          ? "border-primary/30 bg-primary/5 shadow-md"
                          : "border-gray-200 bg-white hover:border-primary/20 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">{item.title}</span>
                            <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
                              {item.sourceLabel}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-gray-600">{item.preview}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
                            {item.kind === "analysis" ? text.reportTypeAnalysis : text.reportTypeBriefing}
                          </div>
                          <div className="mt-2 text-[11px] text-gray-500">{toLocalDateLabel(item.generatedAt, locale)}</div>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-5 text-sm leading-7 text-gray-600">
                  {search.trim() ? text.historyEmptyMatch : text.historyEmpty}
                </div>
              )}
            </div>
          </aside>

          <main className="min-w-0 rounded-[2rem] border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-4">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "chat" as const, label: text.tabChat },
                  { id: "reports" as const, label: text.tabReports },
                  { id: "settings" as const, label: text.tabSettings }
                ].map((tab) => {
                  const active = tab.id === activeTab;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        active
                          ? "bg-primary text-white shadow-sm"
                          : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {error ? (
              <div className="mx-5 mt-5 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <span>
                    {text.errorPrefix} {error}
                  </span>
                  <button
                    type="button"
                    onClick={() => void runAnalysis()}
                    className="rounded-full border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700"
                  >
                    {text.retry}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="space-y-5 p-5">
              {loading ? (
                <div className="space-y-4">
                  <div className="h-40 animate-pulse rounded-[1.75rem] border border-gray-200 bg-gray-100" />
                  <div className="h-32 animate-pulse rounded-[1.75rem] border border-gray-200 bg-gray-100" />
                  <div className="h-32 animate-pulse rounded-[1.75rem] border border-gray-200 bg-gray-100" />
                </div>
              ) : activeTab === "chat" ? (
                <div className="space-y-5">
                  {runningAnalysis ? (
                    <div className="rounded-[1.75rem] border border-primary/20 bg-primary/5 p-4 text-sm font-medium text-primary">
                      {text.running}
                    </div>
                  ) : null}

                  {loadingDetail ? (
                    <div className="rounded-[1.75rem] border border-gray-200 bg-gray-50 p-5">
                      <div className="h-28 animate-pulse rounded-3xl border border-gray-200 bg-white" />
                    </div>
                  ) : selectedHistoryItem ? (
                    <AnalysisBlock item={selectedHistoryItem} locale={locale} onAction={openModule} isNavigating={isNavigating} />
                  ) : (
                    <div className="space-y-4">
                      <section className="rounded-[2rem] border border-gray-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-lg">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">{text.businessHealth}</p>
                        <h2 className="mt-3 text-3xl font-black tracking-tight">{text.emptyStateTitle}</h2>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">{text.emptyStateBody}</p>
                      </section>

                      <div className="rounded-[1.75rem] border border-dashed border-gray-300 bg-gray-50 p-5">
                        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                          <div className="min-w-0">
                            <h3 className="text-lg font-bold text-gray-900">{locale === "ar" ? "سؤال تنفيذي سريع" : "Quick executive request"}</h3>
                            <p className="mt-1 text-sm text-gray-600">{text.askHelper}</p>
                          </div>
                          <button
                            type="button"
                            onClick={runAnalysis}
                            disabled={runningAnalysis}
                            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {text.runPrompt}
                          </button>
                        </div>
                        <textarea
                          value={draftPrompt}
                          onChange={(event) => setDraftPrompt(event.target.value)}
                          placeholder={text.askPlaceholder}
                          className="mt-4 min-h-28 w-full rounded-3xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                        <div className="mt-3 flex flex-wrap gap-2">
                          {suggestedQuestions.map((question) => (
                            <button
                              key={question}
                              type="button"
                              onClick={() => setDraftPrompt(question)}
                              className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                            >
                              {question}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : activeTab === "reports" ? (
                <div className="space-y-5">
                  <section className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{text.reportArchive}</p>
                        <h2 className="mt-1 text-2xl font-black tracking-tight text-gray-900">
                          {locale === "ar" ? "محفوظات التحليل" : "Stored analyses"}
                        </h2>
                        <p className="mt-2 text-sm text-gray-600">{text.reportArchiveHelp}</p>
                      </div>
                      <button
                        type="button"
                        onClick={runAnalysis}
                        className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                      >
                        {text.newAnalysis}
                      </button>
                    </div>
                  </section>

                  <ReportsArchive items={history} locale={locale} onOpen={openHistoryItem} />

                  {Array.isArray(advancedAnalytics?.operationalAlerts?.alerts) && advancedAnalytics.operationalAlerts.alerts.length ? (
                    <section className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                            {locale === "ar" ? "تنبيهات تشغيلية" : "Operational alerts"}
                          </p>
                          <h3 className="mt-1 text-lg font-bold text-gray-900">
                            {locale === "ar" ? "إشارات من التحليلات المتقدمة" : "Signals from advanced analytics"}
                          </h3>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {advancedAnalytics.operationalAlerts.alerts.slice(0, 6).map((alert: any, index: number) => (
                          <div
                            key={`${alert.id || alert.title || index}`}
                            className={`rounded-3xl border p-4 ${
                              alert.severity === "high"
                                ? "border-rose-200 bg-rose-50"
                                : alert.severity === "medium"
                                  ? "border-amber-200 bg-amber-50"
                                  : "border-slate-200 bg-slate-50"
                            }`}
                          >
                            <div className="text-sm font-semibold text-gray-900">{alert.title || alert.name}</div>
                            <div className="mt-1 text-sm text-gray-600">{alert.description || alert.detail}</div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>
              ) : (
                <section className="space-y-5">
                  <div className="rounded-[1.75rem] border border-gray-200 bg-gray-50 p-5">
                    <h2 className="text-2xl font-black tracking-tight text-gray-900">{text.settingsTitle}</h2>
                    <p className="mt-2 text-sm text-gray-600">{text.settingsHelp}</p>
                    <p className="mt-2 text-sm text-gray-500">{text.defaultPolicy}</p>
                  </div>

                  {settingsMessage ? (
                    <div className="rounded-3xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-medium text-primary">
                      {settingsMessage}
                    </div>
                  ) : null}

                  <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-sm">
                      <h3 className="text-lg font-bold text-gray-900">
                        {locale === "ar" ? "تفضيلات التواصل" : "Communication preferences"}
                      </h3>
                      <div className="mt-4 rounded-3xl border border-gray-200 bg-gray-50 p-4">
                        <label className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={automaticBriefingsEnabled}
                            onChange={(event) => setAutomaticBriefingsEnabled(event.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <span className="space-y-1">
                            <span className="block text-sm font-semibold text-gray-900">{text.automaticBriefings}</span>
                            <span className="block text-sm leading-6 text-gray-600">{text.automaticBriefingsHelp}</span>
                          </span>
                        </label>
                      </div>
                      <div className="mt-5 grid gap-4 md:grid-cols-3">
                        <label className="space-y-2">
                          <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{text.language}</span>
                          <select
                            value={consultantPreferences.language}
                            onChange={(event) =>
                              setConsultantPreferences((current) => ({
                                ...current,
                                language: event.target.value as ConsultantLanguage
                              }))
                            }
                            className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                          >
                            <option value="ar">{languageLabels.ar[locale as "en" | "ar"]}</option>
                            <option value="en">{languageLabels.en[locale as "en" | "ar"]}</option>
                          </select>
                        </label>

                        <label className="space-y-2">
                          <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{text.tone}</span>
                          <select
                            value={consultantPreferences.tone}
                            onChange={(event) =>
                              setConsultantPreferences((current) => ({
                                ...current,
                                tone: event.target.value as ConsultantTone
                              }))
                            }
                            className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                          >
                            <option value="professional_arabic">{toneLabels.professional_arabic[locale as "en" | "ar"]}</option>
                            <option value="saudi_executive_style">{toneLabels.saudi_executive_style[locale as "en" | "ar"]}</option>
                            <option value="executive_english">{toneLabels.executive_english[locale as "en" | "ar"]}</option>
                          </select>
                        </label>

                        <label className="space-y-2">
                          <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{text.addressing}</span>
                          <select
                            value={consultantPreferences.addressingStyle}
                            onChange={(event) =>
                              setConsultantPreferences((current) => ({
                                ...current,
                                addressingStyle: event.target.value as ConsultantAddressingStyle
                              }))
                            }
                            className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                          >
                            <option value="neutral_professional">{addressingLabels.neutral_professional[locale as "en" | "ar"]}</option>
                            <option value="male_formal">{addressingLabels.male_formal[locale as "en" | "ar"]}</option>
                            <option value="female_formal">{addressingLabels.female_formal[locale as "en" | "ar"]}</option>
                            <option value="no_titles">{addressingLabels.no_titles[locale as "en" | "ar"]}</option>
                          </select>
                        </label>
                      </div>

                      <div className="mt-5 flex justify-end">
                        <button
                          type="button"
                          onClick={handleSaveConsultantPreferences}
                          disabled={settingsSaving}
                          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {settingsSaving ? text.saving : text.save}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-[1.75rem] border border-gray-200 bg-slate-950 p-5 text-white shadow-sm">
                      <h3 className="text-lg font-bold text-white">{text.voiceProfile}</h3>
                      <div className="mt-4 space-y-3 text-sm text-white/80">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">{text.language}</div>
                          <div className="mt-1 text-base font-semibold text-white">
                            {languageLabels[consultantPreferences.language][locale as "en" | "ar"]}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">{text.tone}</div>
                          <div className="mt-1 text-base font-semibold text-white">
                            {toneLabels[consultantPreferences.tone][locale as "en" | "ar"]}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">{text.addressing}</div>
                          <div className="mt-1 text-base font-semibold text-white">
                            {addressingLabels[consultantPreferences.addressingStyle][locale as "en" | "ar"]}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm leading-7 text-emerald-50">
                        {locale === "ar"
                          ? "هذه الإعدادات تُطبَّق تلقائياً على التحليل اليومي والأسبوعي والشهري بدون تغيير في منطق البيانات."
                          : "These settings are applied automatically to daily, weekly, and monthly analyses without changing the underlying data logic."}
                      </div>
                    </div>
                  </div>

                  <section className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900">{text.sampleOutputs}</h3>
                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{text.sampleSummary}</p>
                        <p className="mt-2 text-sm leading-7 text-gray-700">
                          {consultantPreferences.language === "ar"
                            ? "الله يعافيك، عندنا ملاحظة مهمة على الأداء الحالي وتحتاج متابعة تنفيذية هادئة وواضحة."
                            : "We have a meaningful performance signal that deserves a calm, executive-level review."}
                        </p>
                      </div>
                      <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{text.sampleRecommendation}</p>
                        <p className="mt-2 text-sm leading-7 text-gray-700">
                          {consultantPreferences.language === "ar"
                            ? "أشوف أن مراجعة العملاء غير النشطين قد تساعد في رفع الإيراد خلال الفترة القادمة."
                            : "Reviewing inactive customers should help improve revenue in the coming period."}
                        </p>
                      </div>
                      <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{text.sampleAction}</p>
                        <p className="mt-2 text-sm leading-7 text-gray-700">
                          {consultantPreferences.language === "ar"
                            ? "افتح قائمة العملاء غير النشطين وابدأ متابعة موجهة للاحتفاظ."
                            : "Open inactive customers and launch a targeted retention follow-up."}
                        </p>
                      </div>
                    </div>
                  </section>
                </section>
              )}
            </div>
          </main>
        </section>
        )}
      </div>
    </TenantLayout>
  );
}
