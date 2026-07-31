import { useMemo, useState, type ReactNode, type FormEvent } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Globe,
  Mail,
  ShieldCheck,
  Sparkles,
  Unlock,
  ChevronLeft,
  KeyRound,
  CheckCircle2
  ,
  LoaderCircle
} from 'lucide-react';
import type { Language } from '../types';
import TenantLoginScreen from './TenantLoginScreen';
import { PublicLandingFramework } from './public/LandingFramework';
import PublicRegistrationWizard from './public/PublicRegistrationWizard';
import { tenantApiAdapter } from '../lib/tenantApiAdapter';

type PublicRoute = 'landing' | 'login' | 'register' | 'forgot-password' | 'reset-password' | 'register-success';

interface PublicExperienceProps {
  path: string;
  search: string;
  lang: Language;
  onToggleLang: () => void;
  onNavigate: (path: string, options?: { replace?: boolean }) => void;
  onLogin: (email: string, password: string) => Promise<void>;
  loginLoading: boolean;
  loginError: string | null;
}

function resolvePublicRoute(path: string): PublicRoute {
  if (path.startsWith('/login')) return 'login';
  if (path.startsWith('/register/success') || path.startsWith('/registration-success')) return 'register-success';
  if (path.startsWith('/register')) return 'register';
  if (path.startsWith('/forgot-password')) return 'forgot-password';
  if (path.startsWith('/reset-password')) return 'reset-password';
  return 'landing';
}

function PublicPageFrame({
  lang,
  onToggleLang,
  title,
  subtitle,
  children
}: {
  lang: Language;
  onToggleLang: () => void;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const isRtl = lang === 'ar';

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen relative overflow-hidden bg-zinc-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.2),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(244,114,182,0.16),_transparent_24%),linear-gradient(135deg,_rgba(9,9,11,0.98),_rgba(24,24,27,0.92))]" />
      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="px-4 md:px-8 py-5">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-xl shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-3 text-amber-200">
                <Sparkles size={18} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-amber-200/80">Refah</p>
                <h1 className="text-lg font-black text-white">{isRtl ? 'تجربة عامة قابلة للتوسعة' : 'Extensible public experience'}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleLang}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <Globe size={16} />
                <span>{lang === 'ar' ? 'English' : 'العربية'}</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pb-8 md:px-8 md:pb-10">
          <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[1.02fr_0.98fr]">
            <section className="space-y-6">
              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 md:p-8 backdrop-blur-2xl shadow-2xl">
                <p className="text-xs uppercase tracking-[0.26em] text-amber-200/70">{isRtl ? 'تجربة الزوار' : 'Public visitor experience'}</p>
                <h2 className="mt-3 text-3xl md:text-4xl font-black leading-tight">{title}</h2>
                <p className="mt-4 max-w-2xl text-sm md:text-base leading-7 text-zinc-300">{subtitle}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  [ShieldCheck, isRtl ? 'اتصال حي' : 'Live only'],
                  [KeyRound, isRtl ? 'مصادقة حقيقية' : 'Canonical auth'],
                  [CheckCircle2, isRtl ? 'قابل للتوسعة' : 'Framework first']
                ].map(([Icon, label]) => (
                  <div key={label as string} className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                    <Icon size={18} className="text-amber-300" />
                    <p className="mt-3 text-sm font-semibold text-white">{label as string}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-[1.75rem] border border-white/10 bg-black/25 p-6 backdrop-blur-xl">
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    isRtl ? 'إطار عام مفصول عن اللوحة' : 'Separate public shell from dashboard',
                    isRtl ? 'سهولة إضافة أقسام جديدة لاحقاً' : 'Easy to add sections later',
                    isRtl ? 'روابط تسجيل ودخول وخدمات الاسترداد' : 'Login, register and recovery flows',
                    isRtl ? 'متوافق مع V2 من حيث الهوية' : 'Aligned with V2 visual identity'
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="space-y-6">{children}</section>
          </div>
        </main>
      </div>
    </div>
  );
}

function PublicAuthShell({
  lang,
  onToggleLang,
  title,
  subtitle,
  children
}: {
  lang: Language;
  onToggleLang: () => void;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const isRtl = lang === 'ar';
  return (
    <PublicPageFrame lang={lang} onToggleLang={onToggleLang} title={title} subtitle={subtitle}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className={`rounded-[1.75rem] border border-white/10 bg-zinc-950/80 p-5 md:p-6 shadow-2xl backdrop-blur-xl ${isRtl ? 'text-right' : 'text-left'}`}
      >
        {children}
      </motion.div>
    </PublicPageFrame>
  );
}

function ForgotPasswordScreen({
  lang,
  onToggleLang,
  onNavigate
}: {
  lang: Language;
  onToggleLang: () => void;
  onNavigate: (path: string, options?: { replace?: boolean }) => void;
}) {
  const isRtl = lang === 'ar';
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await tenantApiAdapter.requestTenantForgotPassword(email.trim(), lang);
      if (!response?.success) {
        throw new Error(response?.message || (isRtl ? 'فشل إرسال طلب الاستعادة' : 'Unable to send reset email'));
      }
      setMessage(response?.message || (isRtl ? 'تم إرسال رابط الاستعادة بنجاح.' : 'Reset link sent successfully.'));
    } catch (submitError: any) {
      setError(submitError?.message || (isRtl ? 'تعذّر إرسال البريد.' : 'Failed to send email.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicAuthShell
      lang={lang}
      onToggleLang={onToggleLang}
      title={isRtl ? 'استعادة كلمة المرور' : 'Password recovery'}
      subtitle={isRtl ? 'أدخل البريد المسجل لإرسال رابط إعادة التعيين.' : 'Enter the registered email to receive a reset link.'}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <button
          type="button"
          onClick={() => onNavigate('/login')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-400 hover:text-white transition-colors"
        >
          <ChevronLeft size={16} />
          <span>{isRtl ? 'العودة لتسجيل الدخول' : 'Back to sign in'}</span>
        </button>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-300">{isRtl ? 'البريد الإلكتروني' : 'Email'}</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none ring-0 placeholder:text-zinc-600"
            placeholder="admin@example.com"
          />
        </label>

        {message ? <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</div> : null}
        {error ? <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <LoaderCircle size={16} className="animate-spin" /> : <Mail size={16} />}
          <span>{isRtl ? 'إرسال رابط الاستعادة' : 'Send reset link'}</span>
        </button>
      </form>
    </PublicAuthShell>
  );
}

function ResetPasswordScreen({
  lang,
  onToggleLang,
  onNavigate,
  search
}: {
  lang: Language;
  onToggleLang: () => void;
  onNavigate: (path: string, options?: { replace?: boolean }) => void;
  search: string;
}) {
  const isRtl = lang === 'ar';
  const token = useMemo(() => new URLSearchParams(search).get('token') || '', [search]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await tenantApiAdapter.resetTenantPassword(token, password, confirmPassword);
      if (!response?.success) {
        throw new Error(response?.message || (isRtl ? 'فشل إعادة تعيين كلمة المرور' : 'Unable to reset password'));
      }
      setMessage(response?.message || (isRtl ? 'تم تحديث كلمة المرور بنجاح.' : 'Password updated successfully.'));
    } catch (submitError: any) {
      setError(submitError?.message || (isRtl ? 'تعذرت إعادة التعيين.' : 'Password reset failed.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicAuthShell
      lang={lang}
      onToggleLang={onToggleLang}
      title={isRtl ? 'إعادة تعيين كلمة المرور' : 'Reset password'}
      subtitle={isRtl ? 'استخدم الرمز الموجود في البريد وأدخل كلمة مرور جديدة.' : 'Use the emailed token and create a new password.'}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <button
          type="button"
          onClick={() => onNavigate('/login')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-400 hover:text-white transition-colors"
        >
          <ChevronLeft size={16} />
          <span>{isRtl ? 'العودة لتسجيل الدخول' : 'Back to sign in'}</span>
        </button>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-300">{isRtl ? 'رمز الاستعادة' : 'Reset token'}</span>
          <input
            value={token}
            readOnly
            className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none ring-0"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-300">{isRtl ? 'كلمة المرور الجديدة' : 'New password'}</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none ring-0"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-300">{isRtl ? 'تأكيد كلمة المرور' : 'Confirm password'}</span>
          <input
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none ring-0"
          />
        </label>

        {message ? <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</div> : null}
        {error ? <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

        <button
          type="submit"
          disabled={loading || !token}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <LoaderCircle size={16} className="animate-spin" /> : <Unlock size={16} />}
          <span>{isRtl ? 'حفظ كلمة المرور' : 'Save password'}</span>
        </button>
      </form>
    </PublicAuthShell>
  );
}

function RegistrationSuccessScreen({
  lang,
  onToggleLang,
  onNavigate
}: {
  lang: Language;
  onToggleLang: () => void;
  onNavigate: (path: string, options?: { replace?: boolean }) => void;
}) {
  const isRtl = lang === 'ar';
  return (
    <PublicAuthShell
      lang={lang}
      onToggleLang={onToggleLang}
      title={isRtl ? 'تم إرسال الطلب بنجاح' : 'Registration submitted'}
      subtitle={isRtl ? 'تم إنشاء طلب الانضمام. يمكن للمنشأة الآن متابعة المراجعة والتفعيل.' : 'The onboarding request has been created and is ready for review.'}
    >
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
          <CheckCircle2 size={28} />
        </div>
        <p className="text-sm leading-7 text-zinc-300">
          {isRtl
            ? 'ستستقبل المنشأة رسالة تأكيد بعد اكتمال المراجعة أو التفعيل من النظام.'
            : 'The tenant will receive the next notification once the review or activation step completes.'}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => onNavigate('/login')}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300"
          >
            {isRtl ? 'تسجيل الدخول' : 'Sign in'}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            {isRtl ? 'العودة للرئيسية' : 'Back to home'}
          </button>
        </div>
      </div>
    </PublicAuthShell>
  );
}

export default function PublicExperience({
  path,
  search,
  lang,
  onToggleLang,
  onNavigate,
  onLogin,
  loginLoading,
  loginError
}: PublicExperienceProps) {
  const route = resolvePublicRoute(path);

  if (route === 'login') {
    return (
      <TenantLoginScreen
        lang={lang}
        onToggleLang={onToggleLang}
        onLogin={onLogin}
        onForgotPassword={() => onNavigate('/forgot-password')}
        onRegister={() => onNavigate('/register')}
        onHome={() => onNavigate('/')}
        loading={loginLoading}
        error={loginError}
      />
    );
  }

  if (route === 'register') {
    return <PublicRegistrationWizard lang={lang} onNavigate={onNavigate} />;
  }

  if (route === 'forgot-password') {
    return <ForgotPasswordScreen lang={lang} onToggleLang={onToggleLang} onNavigate={onNavigate} />;
  }

  if (route === 'reset-password') {
    return <ResetPasswordScreen lang={lang} onToggleLang={onToggleLang} onNavigate={onNavigate} search={search} />;
  }

  if (route === 'register-success') {
    return <RegistrationSuccessScreen lang={lang} onToggleLang={onToggleLang} onNavigate={onNavigate} />;
  }

  return (
    <div className="px-4 pb-8 pt-4 md:px-8 md:pb-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-3 text-amber-200">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-amber-200/80">Refah</p>
              <h1 className="text-lg font-black text-white">
                {lang === 'ar' ? 'تجربة عامة قابلة للتوسعة' : 'Extensible public experience'}
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleLang}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            <Globe size={16} />
            <span>{lang === 'ar' ? 'English' : 'العربية'}</span>
          </button>
        </div>
        <PublicLandingFramework lang={lang} onNavigate={onNavigate} />
        <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-[1.5rem] border border-white/10 bg-white/5 px-6 py-5 text-center backdrop-blur-xl sm:flex-row sm:text-start">
          <p className="max-w-3xl text-sm leading-7 text-zinc-300">
            {lang === 'ar'
              ? 'هل تريد متابعة رحلة الزيارة؟ يمكنك التسجيل أو تسجيل الدخول ثم الانتقال مباشرة إلى الواجهة الحية.'
              : 'Ready to continue the visit journey? Register or sign in to move directly into the live workspace.'}
          </p>
          <button
            type="button"
            onClick={() => onNavigate('/register')}
            className="inline-flex items-center gap-2 rounded-2xl bg-amber-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300"
          >
            {lang === 'ar' ? 'ابدأ التسجيل' : 'Start registration'}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
