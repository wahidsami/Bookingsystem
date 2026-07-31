import { useState } from 'react';
import type { FormEvent } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, LoaderCircle, Sparkles, Globe } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../data/translations';

interface TenantLoginScreenProps {
  lang: Language;
  onToggleLang: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onForgotPassword?: () => void;
  onRegister?: () => void;
  onHome?: () => void;
  loading?: boolean;
  error?: string | null;
}

export default function TenantLoginScreen({
  lang,
  onToggleLang,
  onLogin,
  onForgotPassword,
  onRegister,
  onHome,
  loading = false,
  error = null
}: TenantLoginScreenProps) {
  const t = translations[lang];
  const isRtl = lang === 'ar';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email.trim() || !password.trim()) {
      setLocalError(isRtl ? 'يرجى إدخال البريد الإلكتروني وكلمة المرور.' : 'Please enter both email and password.');
      return;
    }

    try {
      setSubmitting(true);
      await onLogin(email.trim(), password);
    } catch (err: any) {
      setLocalError(err?.message || (isRtl ? 'فشل تسجيل الدخول.' : 'Login failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  const busy = loading || submitting;

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(217,119,6,0.22),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(9,9,11,0.1),_transparent_28%)]" />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/90 backdrop-blur-xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-zinc-800 flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-300 text-xs font-semibold border border-amber-500/20">
              <Sparkles size={14} />
              <span>{isRtl ? 'اتصال مباشر للوحة رفاه' : 'Live Tenant Bridge'}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{t.appName}</h1>
            <p className="text-sm text-zinc-400">
              {isRtl
                ? 'سجّل الدخول للوصول إلى لوحة التحكم عبر جلسة المستأجر الحقيقية.'
                : 'Sign in to connect this V2 shell to the live tenant session.'}
            </p>
          </div>

          <div className="flex flex-col gap-2 items-end">
            {onHome && (
              <button
                type="button"
                onClick={onHome}
                className="text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
              >
                {isRtl ? 'الرئيسية' : 'Home'}
              </button>
            )}
            <button
              type="button"
              onClick={onToggleLang}
              className="shrink-0 p-2 rounded-xl border border-zinc-800 bg-zinc-950 hover:bg-zinc-800 transition-colors text-zinc-300"
              aria-label={isRtl ? 'تبديل اللغة' : 'Toggle language'}
            >
              <Globe size={16} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-300">{isRtl ? 'البريد الإلكتروني' : 'Email'}</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              placeholder={isRtl ? 'admin@example.com' : 'admin@example.com'}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-300">{isRtl ? 'كلمة المرور' : 'Password'}</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              placeholder="••••••••"
            />
          </label>

          <label className="flex items-center gap-3 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-amber-500 focus:ring-amber-500/50"
            />
            <span>{isRtl ? 'تذكرني على هذا الجهاز' : 'Remember me on this device'}</span>
          </label>

          {(localError || error) && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {localError || error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-amber-500 text-zinc-950 font-semibold px-4 py-3 transition-colors hover:bg-amber-400 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {busy ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            <span>{isRtl ? 'تسجيل الدخول' : 'Sign in'}</span>
          </button>

          <div className="flex items-center justify-between gap-3 text-xs text-zinc-500 pt-1">
            <button
              type="button"
              onClick={onForgotPassword}
              className="hover:text-zinc-200 transition-colors"
            >
              {isRtl ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
            </button>
            <button
              type="button"
              onClick={onRegister}
              className="hover:text-zinc-200 transition-colors"
            >
              {isRtl ? 'إنشاء منشأة جديدة' : 'Create a new tenant'}
            </button>
          </div>
        </form>

        <div className="px-6 pb-6 text-xs text-zinc-500 leading-6">
          {isRtl
            ? 'يستخدم هذا السطح بيانات الاعتماد الحية والرموز المميزة من backend الإنتاج دون تغيير أي endpoints.'
            : 'This surface uses live production credentials and tokens without changing backend endpoints.'}
        </div>
      </motion.div>
    </div>
  );
}
