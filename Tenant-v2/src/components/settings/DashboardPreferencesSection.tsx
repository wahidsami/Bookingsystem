import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, RefreshCw, Save, Settings2 } from 'lucide-react';
import { tenantApiAdapter } from '../../lib/tenantApiAdapter';
import {
  DASHBOARD_LANDING_PAGE_OPTIONS,
  DEFAULT_DASHBOARD_LANDING_PAGE,
  DashboardLandingPage,
  dashboardLandingPageLabel,
  normalizeDashboardLandingPage
} from '../../lib/dashboardLandingPage';

interface DashboardPreferencesSectionProps {
  lang: 'ar' | 'en';
  darkMode?: boolean;
}

export default function DashboardPreferencesSection({ lang, darkMode = false }: DashboardPreferencesSectionProps) {
  const isRtl = lang === 'ar';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [landingPage, setLandingPage] = useState<DashboardLandingPage>(DEFAULT_DASHBOARD_LANDING_PAGE);
  const [savedLandingPage, setSavedLandingPage] = useState<DashboardLandingPage>(DEFAULT_DASHBOARD_LANDING_PAGE);

  const options = useMemo(() => DASHBOARD_LANDING_PAGE_OPTIONS, []);

  useEffect(() => {
    let isMounted = true;

    const loadDashboardPreferences = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await tenantApiAdapter.get('/tenant/settings');
        const payload = response?.data || response || {};
        const currentLandingPage = normalizeDashboardLandingPage(
          payload?.settings?.dashboardSettings?.defaultLandingPage
        );

        if (!isMounted) return;
        setLandingPage(currentLandingPage);
        setSavedLandingPage(currentLandingPage);
      } catch (loadError: any) {
        if (!isMounted) return;
        setError(loadError?.message || (isRtl ? 'تعذر تحميل إعدادات لوحة التحكم.' : 'Failed to load dashboard preferences.'));
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadDashboardPreferences();

    return () => {
      isMounted = false;
    };
  }, [isRtl]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await tenantApiAdapter.put('/tenant/settings/dashboard', {
        dashboardSettings: {
          defaultLandingPage: landingPage
        }
      });

      const payload = response?.data || response || {};
      const nextLandingPage = normalizeDashboardLandingPage(
        payload?.dashboardSettings?.defaultLandingPage ||
        payload?.settings?.dashboardSettings?.defaultLandingPage ||
        landingPage
      );

      setLandingPage(nextLandingPage);
      setSavedLandingPage(nextLandingPage);
      setSuccess(isRtl ? 'تم حفظ إعدادات الصفحة الافتتاحية بنجاح.' : 'Landing page preference saved successfully.');
      window.setTimeout(() => setSuccess(null), 3500);
    } catch (saveError: any) {
      setError(saveError?.message || (isRtl ? 'فشل حفظ إعدادات الصفحة الافتتاحية.' : 'Failed to save landing page preference.'));
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = landingPage !== savedLandingPage;

  return (
    <div className={`rounded-2xl border p-5 md:p-6 ${darkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-neutral-100 text-neutral-800'}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-brand-500">
            <Settings2 size={14} />
            <span>{isRtl ? 'تفضيلات لوحة التحكم' : 'Dashboard Preferences'}</span>
          </div>
          <h4 className="text-base md:text-lg font-extrabold">
            {isRtl ? 'الصفحة الافتتاحية بعد تسجيل الدخول' : 'Landing page after sign-in'}
          </h4>
          <p className="text-xs md:text-sm text-neutral-400 max-w-2xl leading-relaxed">
            {isRtl
              ? 'اختر أول مساحة عمل تظهر للمستخدم عند تسجيل الدخول. إذا لم تكن القيمة صالحة فسيتم الرجوع إلى الصفحة الرئيسية تلقائياً.'
              : 'Choose the first workspace opened after login. Invalid values automatically fall back to Home.'}
          </p>
        </div>

        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${darkMode ? 'border-zinc-700 bg-zinc-950 text-zinc-300' : 'border-neutral-200 bg-neutral-50 text-neutral-600'}`}>
          <CheckCircle2 size={13} className="text-emerald-500" />
          <span>{dashboardLandingPageLabel(savedLandingPage, lang)}</span>
        </span>
      </div>

      {loading ? (
        <div className={`mt-5 rounded-xl border px-4 py-5 flex items-center gap-3 ${darkMode ? 'border-zinc-800 bg-zinc-950/40' : 'border-neutral-200 bg-neutral-50'}`}>
          <RefreshCw size={16} className="animate-spin text-brand-500" />
          <span className="text-sm text-neutral-400">{isRtl ? 'جارٍ تحميل التفضيلات...' : 'Loading preferences...'}</span>
        </div>
      ) : (
        <>
          {error && (
            <div className="mt-5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-500">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-500">
              {success}
            </div>
          )}

          <div className="mt-5 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-4 items-end">
            <label className="space-y-2 block">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">
                {isRtl ? 'Landing Page' : 'Landing Page'}
              </span>
              <div className={`relative rounded-xl border ${darkMode ? 'border-zinc-800 bg-zinc-950' : 'border-neutral-200 bg-white'}`}>
                <select
                  value={landingPage}
                  onChange={(event) => setLandingPage(normalizeDashboardLandingPage(event.target.value))}
                  className={`w-full appearance-none rounded-xl px-4 py-3 pr-10 text-sm font-semibold outline-none ${darkMode ? 'bg-zinc-950 text-zinc-100' : 'bg-white text-slate-800'}`}
                >
                  {options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {isRtl ? option.labelAr : option.labelEn}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute inset-y-0 end-3 my-auto text-neutral-400" />
              </div>
            </label>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-neutral-500"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{isRtl ? 'حفظ' : 'Save'}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
