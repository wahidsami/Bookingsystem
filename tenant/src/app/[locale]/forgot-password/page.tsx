'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function TenantForgotPasswordPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'ar';
  const isArabic = locale === 'ar';

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
              {isArabic ? 'استعادة كلمة المرور' : 'Reset Password'}
            </h1>
            <p className="text-gray-600">
              {isArabic
                ? 'استعادة كلمة المرور غير مفعلة في مرحلة الاختبار الحالية.'
                : 'Password reset is not enabled in the current testing stage.'}
            </p>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 mb-6">
            <p className="text-amber-900 font-semibold mb-2">
              {isArabic ? 'الإجراء الحالي' : 'Current flow'}
            </p>
            <p className="text-sm text-amber-800 leading-6">
              {isArabic
                ? 'يرجى التواصل مع فريق المنصة لإعادة تعيين كلمة المرور الخاصة بحساب الاختبار، أو العودة إلى صفحة الدخول باستخدام بياناتك الحالية.'
                : 'Please contact the platform team to reset your test account password, or return to the login page and use your current credentials.'}
            </p>
          </div>

          <div className="space-y-3">
            <Link
              href={`/${locale}/login`}
              className="block w-full text-center bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
            >
              {isArabic ? 'العودة لتسجيل الدخول' : 'Back to Login'}
            </Link>
            <Link
              href={`/${locale}/register`}
              className="block w-full text-center border border-purple-600 text-purple-600 py-3 rounded-lg font-semibold hover:bg-purple-50 transition-colors"
            >
              {isArabic ? 'إنشاء حساب جديد' : 'Create New Account'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
