"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useTenantAuth } from "@/contexts/TenantAuthContext";
import { tenantApi } from "@/lib/api";

export default function MoreInfoPage() {
  const params = useParams();
  const router = useRouter();
  const { user, refreshUser } = useTenantAuth();
  const locale = (params?.locale as string) || "ar";
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const message = (user as any)?.moreInfoMessage || "";

  const handleResubmit = async () => {
    setError("");
    setSubmitting(true);
    try {
      await tenantApi.resubmitRequest();
      await refreshUser();
      setDone(true);
      setTimeout(() => router.push(`/${locale}/dashboard`), 2000);
    } catch (e: any) {
      setError(e.message || "Failed to resubmit.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">{locale === "ar" ? "جاري التحميل..." : "Loading..."}</p>
          <Link href={`/${locale}/login`} className="text-purple-600 hover:underline">
            {locale === "ar" ? "تسجيل الدخول" : "Login"}
          </Link>
        </div>
      </div>
    );
  }

  if (user.status !== "more_info_required") {
    router.push(`/${locale}/dashboard`);
    return null;
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <p className="text-green-600 font-semibold mb-2">
            {locale === "ar" ? "تم إعادة التقديم بنجاح." : "Resubmitted successfully."}
          </p>
          <p className="text-gray-600 text-sm">
            {locale === "ar" ? "جاري تحويلك للوحة التحكم..." : "Redirecting to dashboard..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <Image src="/refahlogo.svg" alt="Rifah" width={64} height={64} className="mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900">
            {locale === "ar" ? "معلومات إضافية مطلوبة" : "More Information Required"}
          </h1>
        </div>

        {message && (
          <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 mb-6">
            <p className="text-sm font-medium text-amber-800 mb-1">
              {locale === "ar" ? "رسالة من الإدارة:" : "Message from admin:"}
            </p>
            <p className="text-gray-700 text-sm whitespace-pre-wrap">{message}</p>
          </div>
        )}

        <p className="text-gray-600 text-sm mb-6">
          {locale === "ar"
            ? "يرجى تقديم المعلومات أو المستندات المطلوبة ثم النقر على إعادة التقديم لإرسال طلبك للمراجعة مرة أخرى."
            : "Please provide the requested information or documents, then click Resubmit to send your application for review again."}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleResubmit}
          disabled={submitting}
          className="w-full py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50"
        >
          {submitting ? (locale === "ar" ? "جاري الإرسال..." : "Submitting...") : (locale === "ar" ? "إعادة التقديم" : "Resubmit")}
        </button>

        <p className="text-center mt-6 text-sm text-gray-500">
          <Link href={`/${locale}/dashboard`} className="text-purple-600 hover:underline">
            {locale === "ar" ? "العودة للوحة التحكم" : "Back to dashboard"}
          </Link>
        </p>
      </div>
    </div>
  );
}
