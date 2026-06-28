"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { TenantLayout } from "@/components/TenantLayout";
import { tenantApi } from "@/lib/api";

type ConsultantTabId =
  | "overview"
  | "conversations"
  | "insights"
  | "opportunities"
  | "predictions"
  | "reports"
  | "settings";

type ConsultantConversation = {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
  status: "open" | "paused" | "completed";
  tag: string;
};

type PriorityIssue = {
  id: string;
  title: string;
  severity: "high" | "medium" | "low";
  detail: string;
};

type Opportunity = {
  id: string;
  title: string;
  impact: string;
  description: string;
};

type SuggestedAction = {
  id: string;
  title: string;
  detail: string;
  tone: "neutral" | "positive" | "warning";
};

type ConsultantLanguage = "ar" | "en";
type ConsultantTone = "professional_arabic" | "saudi_executive_style" | "executive_english";
type ConsultantAddressingStyle = "neutral_professional" | "male_formal" | "female_formal" | "no_titles";

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

const tabs: Array<{ id: ConsultantTabId; label: string; description: string }> = [
  { id: "overview", label: "Overview", description: "Daily brief and workspace summary" },
  { id: "conversations", label: "Conversations", description: "History and searchable threads" },
  { id: "insights", label: "Insights", description: "Patterns, signals, and highlights" },
  { id: "opportunities", label: "Opportunities", description: "Growth and optimization ideas" },
  { id: "predictions", label: "Predictions", description: "What may need attention next" },
  { id: "reports", label: "Reports", description: "Structured export-ready views" },
  { id: "settings", label: "Settings", description: "Module preferences and filters" }
];

const conversations: ConsultantConversation[] = [
  {
    id: "conv-1",
    title: "Weekly financial review",
    preview: "Revenue concentration increased in appointments, while refunds stayed stable.",
    updatedAt: "2026-06-28T08:15:00.000Z",
    status: "open",
    tag: "Finance"
  },
  {
    id: "conv-2",
    title: "Customer retention audit",
    preview: "Repeat bookings improved in premium services, but walk-in conversion needs work.",
    updatedAt: "2026-06-27T18:22:00.000Z",
    status: "paused",
    tag: "Customers"
  },
  {
    id: "conv-3",
    title: "Report quality check",
    preview: "Customer identity labels now include badges and identity lines in exports.",
    updatedAt: "2026-06-26T12:40:00.000Z",
    status: "completed",
    tag: "Reports"
  }
];

const priorityIssues: PriorityIssue[] = [
  {
    id: "issue-1",
    title: "Refund spikes in one-day windows",
    severity: "high",
    detail: "Review the refunds list daily and investigate repeated refund patterns."
  },
  {
    id: "issue-2",
    title: "Top-N tables need clear labels",
    severity: "medium",
    detail: "Make sure summary cards always say whether the dataset is complete or truncated."
  },
  {
    id: "issue-3",
    title: "Customer identity fallback consistency",
    severity: "low",
    detail: "Keep badge behavior aligned across preview, exports, and PDFs."
  }
];

const opportunities: Opportunity[] = [
  {
    id: "opp-1",
    title: "Reduce empty report friction",
    impact: "High",
    description: "Add suggested next actions whenever a table has no rows in the selected range."
  },
  {
    id: "opp-2",
    title: "Highlight growth by segment",
    impact: "Medium",
    description: "Surface customer and service segments in a cleaner, Notion-like summary block."
  },
  {
    id: "opp-3",
    title: "Improve drill-down memory",
    impact: "High",
    description: "Persist the last-opened detail tab per workspace to keep exploration fast."
  }
];

const suggestedActions: SuggestedAction[] = [
  {
    id: "action-1",
    title: "Open finance ledger",
    detail: "Review revenue, payments, refunds, and settlement rows.",
    tone: "positive"
  },
  {
    id: "action-2",
    title: "Review customer sales",
    detail: "Check identity quality and top customer changes.",
    tone: "warning"
  },
  {
    id: "action-3",
    title: "Export weekly snapshot",
    detail: "Prepare CSV / Excel / PDF reporting for leadership.",
    tone: "neutral"
  }
];

function statusBadgeClass(status: ConsultantConversation["status"]) {
  switch (status) {
    case "open":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "paused":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "completed":
      return "border-sky-200 bg-sky-50 text-sky-800";
    default:
      return "border-gray-200 bg-gray-50 text-gray-700";
  }
}

function severityBadgeClass(severity: PriorityIssue["severity"]) {
  switch (severity) {
    case "high":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "medium":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "low":
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function toneClass(tone: SuggestedAction["tone"]) {
  switch (tone) {
    case "positive":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-900";
    default:
      return "border-gray-200 bg-white text-gray-900";
  }
}

function SkeletonCard() {
  return <div className="h-24 animate-pulse rounded-3xl border border-gray-200 bg-gray-100" />;
}

const languageLabels: Record<ConsultantLanguage, string> = {
  ar: "Arabic",
  en: "English"
};

const toneLabels: Record<ConsultantTone, string> = {
  professional_arabic: "Professional Arabic",
  saudi_executive_style: "Saudi Executive Style",
  executive_english: "Executive English"
};

const addressingLabels: Record<ConsultantAddressingStyle, string> = {
  neutral_professional: "Neutral Professional",
  male_formal: "Male Formal",
  female_formal: "Female Formal",
  no_titles: "No Titles"
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

function buildSampleConsultantVoice(preferences: ConsultantCommunicationPreferences) {
  if (preferences.language === "ar") {
    const intro =
      preferences.tone === "saudi_executive_style"
        ? "الله يعافيك، عندنا ملاحظة مهمة على الأداء الحالي."
        : "لدينا ملاحظة تشغيلية مهمة على الأداء الحالي.";
    const recommendation =
      preferences.addressingStyle === "no_titles"
        ? "أقترح مراجعة العملاء غير النشطين هذا الأسبوع."
        : "أشوف أنه من المناسب مراجعة العملاء غير النشطين هذا الأسبوع.";

    return {
      summary: intro,
      recommendation,
      action: "افتح قائمة العملاء غير النشطين وابدأ متابعة موجهة للاحتفاظ."
    };
  }

  const intro =
    preferences.tone === "executive_english"
      ? "We have a clear operational signal that merits executive review."
      : "There is a notable performance signal that deserves close review.";
  const recommendation =
    preferences.addressingStyle === "no_titles"
      ? "I recommend reviewing inactive customers and tightening the recovery plan."
      : "I would recommend reviewing inactive customers and tightening the recovery plan.";

  return {
    summary: intro,
    recommendation,
    action: "Open the inactive customer list and launch a targeted retention follow-up."
  };
}

export default function ConsultantPage() {
  const locale = useLocale();
  const isRTL = locale === "ar";
  const [activeTab, setActiveTab] = useState<ConsultantTabId>("overview");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [consultantPreferences, setConsultantPreferences] = useState<ConsultantCommunicationPreferences>({
    language: locale === "ar" ? "ar" : "en",
    tone: locale === "ar" ? "saudi_executive_style" : "executive_english",
    addressingStyle: "neutral_professional"
  });
  const [loadedSettings, setLoadedSettings] = useState<LoadedConsultantSettings | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadConsultantSettings = async () => {
      try {
        const response = await tenantApi.getSettings();
        if (!mounted || !response?.success) return;

        const business = response.data?.business || {};
        const settings = response.data?.settings || {};
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

        setConsultantPreferences({
          language: (preferences.language as ConsultantLanguage) || defaults.language,
          tone: (preferences.tone as ConsultantTone) || defaults.tone,
          addressingStyle: (preferences.addressingStyle as ConsultantAddressingStyle) || defaults.addressingStyle
        });
      } catch (error) {
        console.error("Failed to load consultant settings:", error);
        if (mounted) {
          setLoadedSettings(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadConsultantSettings();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!settingsMessage) return;
    const timer = window.setTimeout(() => setSettingsMessage(null), 3500);
    return () => window.clearTimeout(timer);
  }, [settingsMessage]);

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conversation) =>
      [conversation.title, conversation.preview, conversation.tag]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [search]);

  const dailyBrief = useMemo(() => [
    "Daily brief: revenue is stable and customer identity quality is improved in exports.",
    "Priority watch: refund patterns and top-N summary labeling remain the main operational checks.",
    "Suggested next move: review the new ledger workspace for faster finance exploration."
  ], []);

  const sampleVoice = useMemo(() => buildSampleConsultantVoice(consultantPreferences), [consultantPreferences]);

  const handleSaveConsultantPreferences = async () => {
    try {
      setSettingsSaving(true);
      await tenantApi.updateNotificationSettings({
        consultantWorkflow: {
          ...(loadedSettings?.consultantWorkflow || {}),
          communicationPreferences: consultantPreferences
        }
      });
      setSettingsMessage(locale === "ar" ? "تم حفظ إعدادات المستشار بنجاح." : "Consultant preferences saved successfully.");
    } catch (error: any) {
      setSettingsMessage(error?.message || (locale === "ar" ? "تعذر حفظ الإعدادات." : "Failed to save preferences."));
    } finally {
      setSettingsSaving(false);
    }
  };

  return (
    <TenantLayout>
      <div className="space-y-5" dir={isRTL ? "rtl" : "ltr"}>
        <section className="rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                {locale === "ar" ? "مستشار ذكي" : "AI Consultant"}
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900">
                {locale === "ar" ? "مساحة المستشار الذكي" : "AI Consultant workspace"}
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                {locale === "ar"
                  ? "واجهة حوارية وتحليلية تجمع التاريخ، الرؤى، التوصيات، والتقارير في تخطيط ثلاثي الأعمدة."
                  : "A conversational analytics workspace that blends history, insights, actions, and reports in a crisp three-column layout."
                }
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                {locale === "ar" ? "تصدير" : "Export"}
              </button>
              <button
                type="button"
                className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              >
                {locale === "ar" ? "تحليل جديد" : "New analysis"}
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
          <aside className="rounded-[2rem] border border-gray-200 bg-white p-4 shadow-sm">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  {locale === "ar" ? "بحث" : "Search"}
                </label>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={locale === "ar" ? "ابحث في المحادثات" : "Search conversations"}
                  className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <button
                type="button"
                className="w-full rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
              >
                {locale === "ar" ? "بدء تحليل جديد" : "Start new analysis"}
              </button>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  {locale === "ar" ? "سجل المحادثات" : "Conversation history"}
                </p>
                {loading ? (
                  <div className="space-y-3">
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                  </div>
                ) : filteredConversations.length ? (
                  filteredConversations.map((conversation) => (
                    <article
                      key={conversation.id}
                      className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">{conversation.title}</h3>
                          <p className="mt-1 text-sm text-gray-600">{conversation.preview}</p>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusBadgeClass(conversation.status)}`}>
                          {conversation.status}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-gray-500">
                        <span>{conversation.tag}</span>
                        <span>{new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", { dateStyle: "medium" }).format(new Date(conversation.updatedAt))}</span>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-5 text-sm text-gray-600">
                    {locale === "ar"
                      ? "لا توجد محادثات مطابقة. ابدأ تحليلاً جديداً."
                      : "No matching conversations. Start a new analysis."}
                  </div>
                )}
              </div>
            </div>
          </aside>

          <main className="min-w-0 rounded-[2rem] border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-4">
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => {
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

            <div className="space-y-5 p-5">
              {loading ? (
                <div className="space-y-5">
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </div>
              ) : (
                <>
                  <section className="rounded-[1.75rem] border border-gray-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white shadow-lg">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                          {locale === "ar" ? "الملخص اليومي" : "Daily brief"}
                        </p>
                        <h2 className="mt-2 text-2xl font-black tracking-tight">
                          {locale === "ar" ? "موجز تنفيذي سريع" : "Quick executive brief"}
                        </h2>
                      </div>
                      <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold">
                        {locale === "ar" ? "جاهز للمراجعة" : "Ready for review"}
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      {dailyBrief.map((item) => (
                        <div key={item} className="rounded-3xl border border-white/10 bg-white/8 p-4 text-sm text-white/85 backdrop-blur">
                          {item}
                        </div>
                      ))}
                    </div>
                  </section>

                  {activeTab === "overview" ? (
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{locale === "ar" ? "حالة الجلسة" : "Session state"}</p>
                        <p className="mt-2 text-lg font-bold text-gray-900">{locale === "ar" ? "لا يوجد AI بعد" : "No AI logic yet"}</p>
                        <p className="mt-1 text-sm text-gray-600">{locale === "ar" ? "هذه واجهة UX فقط." : "This is UX-only scaffolding."}</p>
                      </div>
                      <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{locale === "ar" ? "المحادثات" : "Conversations"}</p>
                        <p className="mt-2 text-lg font-bold text-gray-900">{conversations.length}</p>
                        <p className="mt-1 text-sm text-gray-600">{locale === "ar" ? "تاريخ محفوظ للرجوع السريع." : "Saved history for quick context."}</p>
                      </div>
                      <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{locale === "ar" ? "المخرجات" : "Outputs"}</p>
                        <p className="mt-2 text-lg font-bold text-gray-900">{locale === "ar" ? "تقارير وتوصيات" : "Reports and recommendations"}</p>
                        <p className="mt-1 text-sm text-gray-600">{locale === "ar" ? "جاهز لربط الذكاء لاحقاً." : "Ready for AI wiring later."}</p>
                      </div>
                    </div>
                  ) : activeTab === "conversations" ? (
                    <div className="space-y-4">
                      {filteredConversations.map((conversation) => (
                        <div key={conversation.id} className="rounded-3xl border border-gray-200 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="text-base font-bold text-gray-900">{conversation.title}</h3>
                              <p className="mt-1 text-sm text-gray-600">{conversation.preview}</p>
                            </div>
                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusBadgeClass(conversation.status)}`}>
                              {conversation.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : activeTab === "insights" ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                        <h3 className="text-lg font-bold text-gray-900">{locale === "ar" ? "رؤى سريعة" : "Quick insights"}</h3>
                        <p className="mt-2 text-sm text-gray-600">
                          {locale === "ar"
                            ? "مناطق الإيراد والخصومات والهوية تظهر هنا كملخص بصري."
                            : "Revenue, discount, and identity signals will appear here as a visual summary."
                          }
                        </p>
                      </div>
                      <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
                        <h3 className="text-lg font-bold text-gray-900">{locale === "ar" ? "قالب Notion-like" : "Notion-like notes"}</h3>
                        <div className="mt-3 space-y-2 text-sm text-gray-600">
                          <div>• {locale === "ar" ? "ملخص تنفيذي" : "Executive summary"}</div>
                          <div>• {locale === "ar" ? "نقاط المراقبة" : "Watch points"}</div>
                          <div>• {locale === "ar" ? "خلاصة قابلة للتنفيذ" : "Actionable takeaway"}</div>
                        </div>
                      </div>
                    </div>
                  ) : activeTab === "opportunities" ? (
                    <div className="space-y-4">
                      {opportunities.map((opportunity) => (
                        <article key={opportunity.id} className="rounded-3xl border border-gray-200 p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-base font-bold text-gray-900">{opportunity.title}</h3>
                              <p className="mt-1 text-sm text-gray-600">{opportunity.description}</p>
                            </div>
                            <span className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-semibold text-primary">
                              {opportunity.impact}
                            </span>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : activeTab === "predictions" ? (
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
                        <h3 className="text-base font-bold text-gray-900">{locale === "ar" ? "تنبيه" : "Alert"}</h3>
                        <p className="mt-2 text-sm text-gray-600">{locale === "ar" ? "مراقبة كثافة الاسترداد اليومية." : "Monitor daily refund density."}</p>
                      </div>
                      <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
                        <h3 className="text-base font-bold text-gray-900">{locale === "ar" ? "توقع" : "Prediction"}</h3>
                        <p className="mt-2 text-sm text-gray-600">{locale === "ar" ? "الأسابيع القادمة قد تحتاج مراجعة ledger أكثر." : "Upcoming weeks may need closer ledger review."}</p>
                      </div>
                      <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
                        <h3 className="text-base font-bold text-gray-900">{locale === "ar" ? "توصية" : "Recommendation"}</h3>
                        <p className="mt-2 text-sm text-gray-600">{locale === "ar" ? "افتح التقرير الأسبوعي عند الحاجة." : "Open the weekly report when needed."}</p>
                      </div>
                    </div>
                  ) : activeTab === "reports" ? (
                    <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-6">
                      <h3 className="text-lg font-bold text-gray-900">{locale === "ar" ? "التقارير" : "Reports"}</h3>
                      <p className="mt-2 text-sm text-gray-600">
                        {locale === "ar"
                          ? "هذه المنطقة جاهزة لاحقاً لربط التقارير المولدة."
                          : "This area is ready for future generated report integrations."
                        }
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="rounded-[1.75rem] border border-gray-200 bg-gray-50 p-5">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">{locale === "ar" ? "إعدادات أسلوب المستشار" : "Consultant voice settings"}</h3>
                            <p className="mt-1 text-sm text-gray-600">
                              {locale === "ar"
                                ? "هذه الإعدادات تُحفظ لكل tenant وتُحقن تلقائياً في prompt engine."
                                : "These preferences are stored per tenant and injected automatically into the prompt engine."
                              }
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleSaveConsultantPreferences}
                            disabled={settingsSaving}
                            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {settingsSaving ? (locale === "ar" ? "جارٍ الحفظ..." : "Saving...") : (locale === "ar" ? "حفظ الإعدادات" : "Save preferences")}
                          </button>
                        </div>

                        {settingsMessage ? (
                          <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-medium text-primary">
                            {settingsMessage}
                          </div>
                        ) : null}

                        <div className="mt-5 grid gap-4 md:grid-cols-3">
                          <label className="space-y-2">
                            <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                              {locale === "ar" ? "اللغة" : "Language"}
                            </span>
                            <select
                              value={consultantPreferences.language}
                              onChange={(event) => setConsultantPreferences((current) => ({
                                ...current,
                                language: event.target.value as ConsultantLanguage
                              }))}
                              className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                            >
                              <option value="ar">Arabic</option>
                              <option value="en">English</option>
                            </select>
                          </label>

                          <label className="space-y-2">
                            <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                              {locale === "ar" ? "نبرة المستشار" : "Consultant tone"}
                            </span>
                            <select
                              value={consultantPreferences.tone}
                              onChange={(event) => setConsultantPreferences((current) => ({
                                ...current,
                                tone: event.target.value as ConsultantTone
                              }))}
                              className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                            >
                              <option value="professional_arabic">Professional Arabic</option>
                              <option value="saudi_executive_style">Saudi Executive Style</option>
                              <option value="executive_english">Executive English</option>
                            </select>
                          </label>

                          <label className="space-y-2">
                            <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                              {locale === "ar" ? "أسلوب النداء" : "Preferred addressing style"}
                            </span>
                            <select
                              value={consultantPreferences.addressingStyle}
                              onChange={(event) => setConsultantPreferences((current) => ({
                                ...current,
                                addressingStyle: event.target.value as ConsultantAddressingStyle
                              }))}
                              className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                            >
                              <option value="neutral_professional">Neutral Professional</option>
                              <option value="male_formal">Male Formal</option>
                              <option value="female_formal">Female Formal</option>
                              <option value="no_titles">No Titles</option>
                            </select>
                          </label>
                        </div>
                      </div>

                      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                        <div className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-sm">
                          <h3 className="text-lg font-bold text-gray-900">{locale === "ar" ? "نماذج مخرجات" : "Sample outputs"}</h3>
                          <p className="mt-1 text-sm text-gray-600">
                            {locale === "ar"
                              ? "معاينة سريعة للنبرة قبل تفعيل التحليل."
                              : "Quick preview of the configured voice before analysis is triggered."
                            }
                          </p>

                          <div className="mt-4 space-y-4">
                            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                                {locale === "ar" ? "ملخص تنفيذي" : "Executive summary"}
                              </p>
                              <p className="mt-2 text-sm leading-7 text-gray-800">{sampleVoice.summary}</p>
                            </div>
                            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                                {locale === "ar" ? "توصية نموذجية" : "Recommendation sample"}
                              </p>
                              <p className="mt-2 text-sm leading-7 text-gray-800">{sampleVoice.recommendation}</p>
                            </div>
                            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                                {locale === "ar" ? "إجراء مقترح" : "Suggested action"}
                              </p>
                              <p className="mt-2 text-sm leading-7 text-gray-800">{sampleVoice.action}</p>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-[1.75rem] border border-gray-200 bg-slate-950 p-5 text-white shadow-sm">
                          <h3 className="text-lg font-bold text-white">{locale === "ar" ? "مواصفات العرض" : "Voice profile"}</h3>
                          <div className="mt-4 space-y-3 text-sm text-white/80">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">{locale === "ar" ? "اللغة" : "Language"}</div>
                              <div className="mt-1 text-base font-semibold text-white">{languageLabels[consultantPreferences.language]}</div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">{locale === "ar" ? "النبرة" : "Tone"}</div>
                              <div className="mt-1 text-base font-semibold text-white">{toneLabels[consultantPreferences.tone]}</div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">{locale === "ar" ? "أسلوب النداء" : "Addressing style"}</div>
                              <div className="mt-1 text-base font-semibold text-white">{addressingLabels[consultantPreferences.addressingStyle]}</div>
                            </div>
                          </div>
                          <div className="mt-4 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-50">
                            {locale === "ar"
                              ? "هذه الإعدادات تُطبَّق تلقائياً على التحليل اليومي، الأسبوعي، والشهري بدون تغيير في منطق البيانات."
                              : "These settings are applied automatically to daily, weekly, and monthly analyses without changing the underlying data logic."
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </main>

          <aside className="rounded-[2rem] border border-gray-200 bg-white p-4 shadow-sm">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  {locale === "ar" ? "الأولويات" : "Priority issues"}
                </p>
                <div className="mt-3 space-y-3">
                  {loading ? (
                    <>
                      <SkeletonCard />
                      <SkeletonCard />
                      <SkeletonCard />
                    </>
                  ) : (
                    priorityIssues.map((issue) => (
                      <article key={issue.id} className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-gray-900">{issue.title}</h3>
                            <p className="mt-1 text-sm text-gray-600">{issue.detail}</p>
                          </div>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${severityBadgeClass(issue.severity)}`}>
                            {issue.severity}
                          </span>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  {locale === "ar" ? "الفرص" : "Opportunities"}
                </p>
                <div className="mt-3 space-y-3">
                  {opportunities.slice(0, 2).map((opportunity) => (
                    <div key={opportunity.id} className="rounded-3xl border border-gray-200 bg-white p-4">
                      <h3 className="font-semibold text-gray-900">{opportunity.title}</h3>
                      <p className="mt-1 text-sm text-gray-600">{opportunity.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  {locale === "ar" ? "الإجراءات المقترحة" : "Suggested actions"}
                </p>
                <div className="mt-3 space-y-3">
                  {suggestedActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      className={`w-full rounded-3xl border p-4 text-left shadow-sm transition hover:shadow-md ${toneClass(action.tone)}`}
                    >
                      <div className="font-semibold">{action.title}</div>
                      <div className="mt-1 text-sm opacity-80">{action.detail}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                {locale === "ar"
                  ? "لا توجد AI logic حتى الآن. هذه مساحة UX فقط وجاهزة للربط لاحقاً."
                  : "No AI logic yet. This is UX scaffolding ready for later wiring."
                }
              </div>
            </div>
          </aside>
        </section>
      </div>
    </TenantLayout>
  );
}
