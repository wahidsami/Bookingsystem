import { useState } from 'react';
import type { FormEvent } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, LoaderCircle, Sparkles, Globe, House, Lock, Mail } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../data/translations';
import barspaLogo from '../assets/barspa_logo.png';

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
    <div dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen bg-[#FAF7FD] text-[#1D035F] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden selection:bg-[#E7DDFC] selection:text-[#1D035F]">
      {/* Soft lavender background lighting */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,_rgba(231,221,252,0.8),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(163,121,226,0.12),_transparent_35%)]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md rounded-3xl border border-[#E7DDFC] bg-white shadow-2xl shadow-[#6537C0]/10 overflow-hidden"
      >
        {/* Card Header with BarSpa logo and navigation */}
        <div className="p-6 sm:p-8 border-b border-[#E7DDFC] bg-gradient-to-b from-white to-[#FAF7FD]">
          <div className="flex items-center justify-between gap-4 mb-6">
            <img src={barspaLogo} alt="BarSpa" className="h-9 w-auto object-contain" />
            
            <div className="flex items-center gap-2">
              {onHome && (
                <button
                  type="button"
                  onClick={onHome}
                  className="p-2 rounded-xl border border-[#E7DDFC] bg-white hover:bg-[#FAF7FD] text-slate-500 hover:text-[#1D035F] transition-colors cursor-pointer"
                  title={isRtl ? 'الرئيسية' : 'Home'}
                >
                  <House size={16} />
                </button>
              )}
              <button
                type="button"
                onClick={onToggleLang}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E7DDFC] bg-white hover:bg-[#FAF7FD] text-xs font-bold text-[#1D035F] transition-colors cursor-pointer"
                aria-label={isRtl ? 'تبديل اللغة' : 'Toggle language'}
              >
                <Globe size={14} />
                <span>{isRtl ? 'EN' : 'العربية'}</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6537C0]/10 text-[#6537C0] text-xs font-bold font-sans">
              <Sparkles size={13} />
              <span>{isRtl ? 'بوابة إدارة المنشآت' : 'Tenant Portal'}</span>
            </div>
            <h1 className="text-2xl font-black text-[#1D035F] tracking-tight">
              {isRtl ? 'تسجيل الدخول للصالون' : 'Sign in to your salon'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              {isRtl
                ? 'أدخل بيانات حسابك المعتمد للوصول المباشر إلى لوحة إدارة الصالون.'
                : 'Enter your credentials to access your live salon workspace.'}
            </p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-[#1D035F] uppercase tracking-wider">
              {isRtl ? 'البريد الإلكتروني' : 'Email Address'}
            </span>
            <div className="relative">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                className="w-full rounded-2xl border border-[#E7DDFC] bg-[#FAF7FD] px-4 py-3 text-sm text-[#1D035F] placeholder:text-slate-400 outline-none transition focus:border-[#6537C0] focus:bg-white focus:ring-2 focus:ring-[#6537C0]/20"
                placeholder="salon.manager@example.com"
              />
            </div>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-[#1D035F] uppercase tracking-wider">
              {isRtl ? 'كلمة المرور' : 'Password'}
            </span>
            <div className="relative">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                className="w-full rounded-2xl border border-[#E7DDFC] bg-[#FAF7FD] px-4 py-3 text-sm text-[#1D035F] placeholder:text-slate-400 outline-none transition focus:border-[#6537C0] focus:bg-white focus:ring-2 focus:ring-[#6537C0]/20"
                placeholder="••••••••"
              />
            </div>
          </label>

          <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-[#E7DDFC] text-[#6537C0] accent-[#6537C0] focus:ring-[#6537C0]"
              />
              <span>{isRtl ? 'تذكرني على هذا الجهاز' : 'Remember me'}</span>
            </label>

            {onForgotPassword && (
              <button
                type="button"
                onClick={onForgotPassword}
                className="font-semibold text-[#6537C0] hover:text-[#1D035F] transition-colors cursor-pointer"
              >
                {isRtl ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
              </button>
            )}
          </div>

          {(localError || error) && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs sm:text-sm text-rose-800 font-medium">
              {localError || error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-[#6537C0] hover:bg-[#1D035F] text-white font-bold px-5 py-3.5 shadow-md shadow-[#6537C0]/25 transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {busy ? <LoaderCircle size={18} className="animate-spin" /> : <ArrowRight size={18} className={isRtl ? 'rotate-180' : ''} />}
            <span>{isRtl ? 'تسجيل الدخول' : 'Sign in to Portal'}</span>
          </button>

          {onRegister && (
            <div className="text-center pt-2 border-t border-[#E7DDFC]/60 mt-4">
              <p className="text-xs text-slate-500">
                {isRtl ? 'ليس لديك حساب منشأة بعد؟' : "Don't have an account yet?"}{' '}
                <button
                  type="button"
                  onClick={onRegister}
                  className="font-bold text-[#6537C0] hover:text-[#1D035F] transition-colors cursor-pointer"
                >
                  {isRtl ? 'سجّل صالونك الآن' : 'Register your salon'}
                </button>
              </p>
            </div>
          )}
        </form>

        <div className="px-6 pb-6 text-center text-[11px] text-slate-400">
          <span>{isRtl ? 'منصة بارسبا لإدارة صالونات وسبا النخبة' : 'BarSpa Luxury Salon & Spa Management'}</span>
        </div>
      </motion.div>
    </div>
  );
}
