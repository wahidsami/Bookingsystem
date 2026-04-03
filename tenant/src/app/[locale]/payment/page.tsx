"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { tenantApi } from "@/lib/api";

type PaymentMode = "registration" | "bill";

type RegistrationSession = {
  packageName: string;
  amount: number;
  currency: string;
  paymentDueAt?: string;
};

type BillSession = {
  billNumber: string;
  amount: number;
  currency: string;
  dueDate?: string;
  paidAt?: string;
  type?: string;
  tenantName?: string;
  planSnapshot?: {
    packageName?: string;
    packageNameAr?: string;
    billingCycle?: string;
  };
};

export default function UnifiedPaymentPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = (params?.locale as string) || "ar";
  const token = searchParams?.get("token") || "";
  const isJwtToken = Boolean(token && token.includes("."));
  const isPublicBillLink = Boolean(token && !isJwtToken);

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [mode, setMode] = useState<PaymentMode | null>(null);
  const [registrationSession, setRegistrationSession] = useState<RegistrationSession | null>(null);
  const [billSession, setBillSession] = useState<BillSession | null>(null);
  const [error, setError] = useState("");
  const [payError, setPayError] = useState("");
  const [paySuccess, setPaySuccess] = useState("");

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setError("");
        setPayError("");
        setPaySuccess("");

        if (!token) {
          try {
            const response = await tenantApi.getCurrentUnpaidBill();
            if (!mounted) return;

            if (response?.success && response?.bill) {
              setMode("bill");
              setAlreadyPaid(false);
              setBillSession(response.bill as BillSession);
              return;
            }
          } catch {
            // Fallback to legacy registration payment flow for older pending tenants.
          }
        }

        if (token && isJwtToken) {
          const response = await tenantApi.getSubscriptionPaymentSession(token || undefined);
          if (!mounted) return;

          if (response?.success) {
            setMode("registration");
            setRegistrationSession({
              packageName: response.packageName,
              amount: response.amount,
              currency: response.currency || "SAR",
              paymentDueAt: response.paymentDueAt,
            });
            return;
          }
        } else if (token) {
          const response = await tenantApi.getBillPaymentDetails(token);
          if (!mounted) return;

          setMode("bill");
          setAlreadyPaid(Boolean(response?.alreadyPaid));
          setBillSession((response?.bill || null) as BillSession | null);
          return;
        } else {
          const response = await tenantApi.getSubscriptionPaymentSession();
          if (!mounted) return;

          if (response?.success) {
            setMode("registration");
            setRegistrationSession({
              packageName: response.packageName,
              amount: response.amount,
              currency: response.currency || "SAR",
              paymentDueAt: response.paymentDueAt,
            });
            return;
          }
        }

        if (mounted) {
          setError(locale === "ar" ? "رابط الدفع غير صالح" : "Invalid payment link");
        }
      } catch (err: any) {
        if (!mounted) return;
        setError(err.message || (locale === "ar" ? "تعذر تحميل بيانات الدفع" : "Failed to load payment details"));
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [token, locale, isJwtToken]);

  const handlePay = async (success: boolean) => {
    setPayError("");
    setPaySuccess("");
    setPaying(true);

    try {
      if (mode === "bill") {
        await tenantApi.payBillByToken(token, {
          success,
          paymentProvider: "refah_test_gateway",
          paymentMethod: "test_card",
          paymentReference: billSession?.billNumber
            ? `${billSession.billNumber}-${success ? "TEST-SUCCESS" : `TEST-FAILED-${Date.now()}`}`
            : undefined,
          gatewayStatus: success ? "authorized" : "declined",
          paymentFailureReason: success
            ? undefined
            : "Simulated test payment failure from the Refah test gateway",
          idempotencyKey: success
            ? `public_payment_link:${token}:success`
            : `public_payment_link:${token}:failed:${Date.now()}`
        });

        if (!success) {
          setPayError(locale === "ar" ? "فشل الدفع التجريبي. يمكنك المحاولة مرة أخرى." : "Test payment failed. You can try again.");
          return;
        }

        setPaySuccess(
          locale === "ar"
            ? "تم الدفع بنجاح. يتم تحويلك الآن..."
            : "Payment completed successfully. Redirecting..."
        );

        const hasActiveTenantSession = typeof window !== "undefined"
          && Boolean(sessionStorage.getItem("rifah_tenant_access_token"));

        setTimeout(() => {
          router.push(hasActiveTenantSession
            ? `/${locale}/dashboard/subscription`
            : `/${locale}/login`);
        }, 1200);
        return;
      }

      const data = await tenantApi.submitSubscriptionPayment(success, token || undefined);
      if (data.success && data.status === "active") {
        setPaySuccess(
          locale === "ar"
            ? "تم الدفع وتفعيل الحساب بنجاح. يتم تحويلك إلى لوحة التحكم..."
            : "Payment successful and account activated. Redirecting to dashboard..."
        );
        setTimeout(() => {
          router.push(`/${locale}/dashboard`);
        }, 1200);
        return;
      }

      if (!success) {
        setPayError(locale === "ar" ? "فشل الدفع. يمكنك المحاولة مرة أخرى." : "Payment failed. You can try again.");
      }
    } catch (err: any) {
      setPayError(err.message || (locale === "ar" ? "فشل الدفع" : "Payment failed"));
    } finally {
      setPaying(false);
    }
  };

  const packageName = mode === "bill"
    ? (
        locale === "ar"
          ? billSession?.planSnapshot?.packageNameAr || billSession?.planSnapshot?.packageName || "-"
          : billSession?.planSnapshot?.packageName || billSession?.planSnapshot?.packageNameAr || "-"
      )
    : registrationSession?.packageName || "-";

  const amount = mode === "bill" ? billSession?.amount : registrationSession?.amount;
  const currency = mode === "bill" ? billSession?.currency : registrationSession?.currency;
  const dueDate = mode === "bill" ? billSession?.dueDate : registrationSession?.paymentDueAt;
  const backHref = mode === "bill"
    ? (isPublicBillLink ? `/${locale}/login` : `/${locale}/dashboard/bills`)
    : (token ? `/${locale}/login` : `/${locale}`);

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

  if (error || (!registrationSession && !billSession)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <p className="text-red-600 mb-4">{error || (locale === "ar" ? "رابط الدفع غير صالح" : "Invalid payment link")}</p>
          <Link href={backHref} className="inline-block px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            {locale === "ar" ? "العودة" : "Back"}
          </Link>
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
            {locale === "ar" ? "إكمال الدفع" : "Complete Payment"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {mode === "registration"
              ? (locale === "ar" ? "الدفع خلال 48 ساعة لتفعيل حسابك" : "Pay within 48 hours to activate your account")
              : (locale === "ar" ? "بوابة اختبار لفواتير الاشتراك" : "Test gateway for subscription invoices")}
          </p>
        </div>

        <div className="border border-gray-200 rounded-xl p-4 mb-6">
          {mode === "bill" && billSession?.billNumber && (
            <>
              <p className="text-gray-600 text-sm">{locale === "ar" ? "رقم الفاتورة" : "Invoice #"}</p>
              <p className="font-semibold text-gray-900">{billSession.billNumber}</p>
            </>
          )}

          <p className="text-gray-600 text-sm mt-4">{locale === "ar" ? "الباقة" : "Package"}</p>
          <p className="font-semibold text-gray-900">{packageName}</p>

          <p className="text-2xl font-bold text-purple-600 mt-4">
            {amount} {currency}
          </p>

          {dueDate && (
            <p className="text-xs text-gray-500 mt-2">
              {locale === "ar" ? "آخر موعد" : "Due by"}:{" "}
              {new Date(dueDate).toLocaleString(locale === "ar" ? "ar-SA" : "en-GB", {
                dateStyle: "short",
                timeStyle: mode === "registration" ? "short" : undefined,
              })}
            </p>
          )}
        </div>

        {payError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {payError}
          </div>
        )}

        {paySuccess && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {paySuccess}
          </div>
        )}

        {alreadyPaid ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
            <p className="text-green-700 font-semibold">
              {locale === "ar" ? "هذه الفاتورة مدفوعة بالفعل" : "This invoice has already been paid"}
            </p>
            <Link
              href={isPublicBillLink ? `/${locale}/login` : `/${locale}/dashboard/subscription`}
              className="inline-block mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              {isPublicBillLink
                ? (locale === "ar" ? "الذهاب لتسجيل الدخول" : "Go to login")
                : (locale === "ar" ? "العودة للاشتراك" : "Back to subscription")}
            </Link>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-4 text-center">
              {locale === "ar"
                ? "بوابة اختبار: اختر نجاح أو فشل للتجربة."
                : "Test gateway: choose success or fail to simulate."}
            </p>

            <div className="space-y-3">
              <button
                onClick={() => handlePay(true)}
                disabled={paying}
                className="w-full py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50"
              >
                {paying
                  ? (locale === "ar" ? "جاري المعالجة..." : "Processing...")
                  : (locale === "ar" ? "دفع الآن (اختبار نجاح)" : "Pay now (test success)")}
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
              {mode === "bill" && isPublicBillLink ? (
                <span className="text-gray-500">
                  {locale === "ar"
                    ? "تم فتح هذه الصفحة من رابط الدفع المرسل بالبريد الإلكتروني."
                    : "This page was opened from the payment link sent by email."}
                </span>
              ) : (
                <Link href={backHref} className="text-purple-600 hover:underline">
                  {mode === "bill"
                    ? (locale === "ar" ? "العودة للفواتير" : "Back to bills")
                    : (locale === "ar" ? "العودة" : "Back")}
                </Link>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
