"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { tenantApi } from "@/lib/api";

export default function SubscriptionPayPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = (params?.locale as string) || "ar";
  const token = searchParams?.get("token") || undefined;

  const [session, setSession] = useState<{
    packageName: string;
    amount: number;
    currency: string;
    paymentDueAt: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [payError, setPayError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await tenantApi.getSubscriptionPaymentSession(token);
        if (!cancelled && data.success) {
          setSession({
            packageName: data.packageName,
            amount: data.amount,
            currency: data.currency || "SAR",
            paymentDueAt: data.paymentDueAt,
          });
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || "Failed to load payment details.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handlePay = async (success: boolean) => {
    setPayError("");
    setPaying(true);
    try {
      const data = await tenantApi.submitSubscriptionPayment(success, token);
      if (data.success && data.status === "active") {
        router.push(`/${locale}/dashboard`);
        return;
      }
      if (!success) {
        setPayError(locale === "ar" ? "فشل الدفع. يمكنك المحاولة مرة أخرى." : "Payment failed. You can try again.");
      }
    } catch (e: any) {
      setPayError(e.message || "Payment failed.");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-2 border-purple-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">{locale === "ar" ? "جاري التحميل..." : "Loading..."}</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <p className="text-red-600 mb-4">{error || "Invalid or expired payment link."}</p>
          <Link
            href={token ? `/${locale}/login` : `/${locale}`}
            className="inline-block px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            {locale === "ar" ? "العودة لتسجيل الدخول" : "Back to login"}
          </Link>
        </div>
      </div>
    );
  }

  const dueDate = session.paymentDueAt
    ? new Date(session.paymentDueAt).toLocaleString(locale === "ar" ? "ar-SA" : "en-GB", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <Image src="/refahlogo.svg" alt="Rifah" width={64} height={64} className="mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900">
            {locale === "ar" ? "إكمال الدفع" : "Complete Payment"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {locale === "ar" ? "الدفع خلال 48 ساعة لتفعيل حسابك" : "Pay within 48 hours to activate your account"}
          </p>
        </div>

        <div className="border border-gray-200 rounded-xl p-4 mb-6">
          <p className="text-gray-600 text-sm">{locale === "ar" ? "الباقة" : "Package"}</p>
          <p className="font-semibold text-gray-900">{session.packageName}</p>
          <p className="text-2xl font-bold text-purple-600 mt-2">
            {session.amount} {session.currency}
          </p>
          {dueDate && (
            <p className="text-xs text-gray-500 mt-2">
              {locale === "ar" ? `آخر موعد: ${dueDate}` : `Due by: ${dueDate}`}
            </p>
          )}
        </div>

        {payError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {payError}
          </div>
        )}

        <p className="text-xs text-gray-500 mb-4 text-center">
          {locale === "ar" ? "بوابة اختبار: اختر نجاح أو فشل للتجربة." : "Test gateway: choose success or fail to simulate."}
        </p>

        <div className="space-y-3">
          <button
            onClick={() => handlePay(true)}
            disabled={paying}
            className="w-full py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50"
          >
            {paying ? (locale === "ar" ? "جاري المعالجة..." : "Processing...") : (locale === "ar" ? "دفع الآن (اختبار نجاح)" : "Pay now (test success)")}
          </button>
          <button
            onClick={() => handlePay(false)}
            disabled={paying}
            className="w-full py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
          >
            {locale === "ar" ? "محاكاة فشل الدفع" : "Simulate payment failure"}
          </button>
        </div>

        <p className="text-center mt-6 text-sm text-gray-500">
          <Link href={`/${locale}/login`} className="text-purple-600 hover:underline">
            {locale === "ar" ? "تسجيل الدخول" : "Login"}
          </Link>
        </p>
      </div>
    </div>
  );
}
