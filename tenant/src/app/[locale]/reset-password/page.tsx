'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { tenantApi } from '@/lib/api';

export default function TenantResetPasswordPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || 'ar';
  const isArabic = locale === 'ar';
  const token = searchParams?.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!token) {
      setError(isArabic ? 'رابط إعادة التعيين غير صالح' : 'Invalid reset link');
      return;
    }

    setLoading(true);
    try {
      const response = await tenantApi.resetForgottenPassword(token, password, confirmPassword);
      setSuccess(response?.message || (isArabic ? 'تم تغيير كلمة المرور بنجاح' : 'Password reset successfully'));
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err?.message || (isArabic ? 'تعذر إعادة تعيين كلمة المرور' : 'Failed to reset password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: 'url(/regbg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      />

      <div className="relative z-10 w-full max-w-xl">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/20">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-purple-900 mb-3 font-cairo">
              {isArabic ? 'تعيين كلمة مرور جديدة' : 'Set New Password'}
            </h1>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-4 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 mb-4 text-sm text-emerald-700">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isArabic ? 'كلمة المرور الجديدة' : 'New password'}
              </label>
              <input
                type="password"
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                placeholder="********"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isArabic ? 'تأكيد كلمة المرور' : 'Confirm password'}
              </label>
              <input
                type="password"
                minLength={8}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                placeholder="********"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-60"
            >
              {loading
                ? (isArabic ? 'جارٍ الحفظ...' : 'Saving...')
                : (isArabic ? 'تحديث كلمة المرور' : 'Update Password')}
            </button>
          </form>

          <Link
            href={`/${locale}/login`}
            className="block w-full text-center border border-purple-600 text-purple-600 py-3 rounded-lg font-semibold hover:bg-purple-50 transition-colors"
          >
            {isArabic ? 'العودة لتسجيل الدخول' : 'Back to Login'}
          </Link>
        </div>
      </div>
    </div>
  );
}
