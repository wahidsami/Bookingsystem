"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { tenantApi } from "@/lib/api";

type BillDetails = {
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

export default function BillPaymentPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = (params?.locale as string) || "ar";
  const token = searchParams?.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [bill, setBill] = useState<BillDetails | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!token) {
        setError(locale === "ar" ? "رابط الدفع غير صالح" : "Invalid payment link");
        setLoading(false);
        return;
      }

      try {
        const response = await tenantApi.getBillPaymentDetails(token);
        if (!mounted) return;
        setBill((response?.bill || null) as BillDetails | null);
        setAlreadyPaid(Boolean(response?.alreadyPaid));
      } catch (err: any) {
        if (!mounted) return;
        setError(err.message || (locale === "ar" ? "تعذر تحميل الفاتورة" : "Failed to load bill"));
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [token, locale]);

  const handlePay = async () => {
    try {
      setPaying(true);
      await tenantApi.payBillByToken(token);
      router.push(`/${locale}/dashboard/subscription`);
    } catch (err: any) {
      setError(err.message || (locale === "ar" ? "فشل الدفع" : "Payment failed"));
    } finally {
      setPaying(false);
    }
  };

  const packageName = locale === "ar"
    ? bill?.planSnapshot?.packageNameAr || bill?.planSnapshot?.packageName || "-"
    : bill?.planSnapshot?.packageName || bill?.planSnapshot?.packageNameAr || "-";

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

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <Image src="/refahlogo.svg" alt="Rifah" width={64} height={64} className="mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900">
            {locale === "ar" ? "دفع فاتورة الاشتراك" : "Subscription Invoice Payment"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {locale === "ar" ? "بوابة اختبار للدفع المباشر للفواتير" : "Test gateway for direct invoice payment"}
          </p>
        </div>

        {(error || !bill) ? (
          <div className="text-center">
            <p className="text-red-600 mb-4">{error || (locale === "ar" ? "تعذر فتح الفاتورة" : "Unable to open invoice")}</p>
            <Link href={`/${locale}/dashboard/subscription`} className="inline-block px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
              {locale === "ar" ? "العودة للاشتراك" : "Back to subscription"}
            </Link>
          </div>
        ) : (
          <>
            <div className="border border-gray-200 rounded-xl p-4 mb-6">
              <p className="text-gray-600 text-sm">{locale === "ar" ? "رقم الفاتورة" : "Invoice #"}</p>
              <p className="font-semibold text-gray-900">{bill.billNumber}</p>

              <p className="text-gray-600 text-sm mt-4">{locale === "ar" ? "الباقة" : "Package"}</p>
              <p className="font-semibold text-gray-900">{packageName}</p>

              <p className="text-2xl font-bold text-purple-600 mt-4">
                {bill.amount} {bill.currency}
              </p>

              {bill.dueDate && (
                <p className="text-xs text-gray-500 mt-2">
                  {locale === "ar" ? "تاريخ الاستحقاق" : "Due date"}:{" "}
                  {new Date(bill.dueDate).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-GB")}
                </p>
              )}
            </div>

            {alreadyPaid ? (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
                <p className="text-green-700 font-semibold">
                  {locale === "ar" ? "هذه الفاتورة مدفوعة بالفعل" : "This invoice has already been paid"}
                </p>
                <Link href={`/${locale}/dashboard/subscription`} className="inline-block mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                  {locale === "ar" ? "العودة للاشتراك" : "Back to subscription"}
                </Link>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-4 text-center">
                  {locale === "ar"
                    ? "هذه بوابة اختبار. الضغط على الزر سيكمل الدفع مباشرة."
                    : "This is a test gateway. Pressing the button will complete the payment immediately."}
                </p>

                <button
                  onClick={handlePay}
                  disabled={paying}
                  className="w-full py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50"
                >
                  {paying
                    ? (locale === "ar" ? "جاري المعالجة..." : "Processing...")
                    : (locale === "ar" ? "ادفع الآن" : "Pay now")}
                </button>

                <p className="text-center mt-6 text-sm text-gray-500">
                  <Link href={`/${locale}/dashboard/bills`} className="text-purple-600 hover:underline">
                    {locale === "ar" ? "العودة للفواتير" : "Back to bills"}
                  </Link>
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
