"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TenantLayout } from "@/components/TenantLayout";
import { Currency } from "@/components/Currency";
import { tenantApi } from "@/lib/api";

interface BillItem {
  id: string;
  billNumber: string;
  amount: number;
  currency: string;
  dueDate: string;
  status: "UNPAID" | "PAID" | "EXPIRED";
  paidAt?: string | null;
  createdAt: string;
  type: "initial" | "renewal" | "upgrade";
  planSnapshot?: {
    packageName?: string;
    packageNameAr?: string;
    billingCycle?: string;
  };
  paymentToken?: string;
}

const statusStyles: Record<string, string> = {
  UNPAID: "bg-amber-100 text-amber-800",
  PAID: "bg-green-100 text-green-800",
  EXPIRED: "bg-gray-200 text-gray-700",
};

export default function BillsPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "ar";
  const isRTL = locale === "ar";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bills, setBills] = useState<BillItem[]>([]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const response = await tenantApi.getBills();
        if (!mounted) return;
        setBills((response?.bills || []) as BillItem[]);
      } catch (err: any) {
        if (!mounted) return;
        setError(err.message || (locale === "ar" ? "تعذر تحميل الفواتير" : "Failed to load bills"));
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [locale]);

  return (
    <TenantLayout>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900" style={{ textAlign: isRTL ? "right" : "left" }}>
          {locale === "ar" ? "فواتيري" : "My Bills"}
        </h2>
        <p className="mt-2 text-gray-600" style={{ textAlign: isRTL ? "right" : "left" }}>
          {locale === "ar"
            ? "راجع فواتير الاشتراك وادفع الفواتير المستحقة عند التجديد أو الترقية."
            : "Review subscription invoices and pay any renewal or upgrade bill from here."}
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="card flex min-h-[260px] items-center justify-center">
          <div className="spinner" />
        </div>
      ) : bills.length === 0 ? (
        <div className="card py-16 text-center">
          <h3 className="text-xl font-semibold text-gray-900">
            {locale === "ar" ? "لا توجد فواتير حالياً" : "No bills yet"}
          </h3>
          <p className="mt-2 text-gray-600">
            {locale === "ar"
              ? "عند طلب ترقية أو تجديد ستظهر الفاتورة هنا."
              : "When you request an upgrade or renewal, the invoice will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {bills.map((bill) => {
            const packageName =
              locale === "ar"
                ? bill.planSnapshot?.packageNameAr || bill.planSnapshot?.packageName || "-"
                : bill.planSnapshot?.packageName || bill.planSnapshot?.packageNameAr || "-";

            return (
              <div key={bill.id} className="card">
                <div className={`flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between ${isRTL ? "lg:flex-row-reverse" : ""}`}>
                  <div style={{ textAlign: isRTL ? "right" : "left" }}>
                    <div className={`flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                      <h3 className="text-xl font-bold text-gray-900">{bill.billNumber}</h3>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[bill.status] || statusStyles.EXPIRED}`}>
                        {bill.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      {locale === "ar" ? "الباقة" : "Package"}: {packageName}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {locale === "ar" ? "نوع الفاتورة" : "Bill type"}: {bill.type}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {locale === "ar" ? "تاريخ الاستحقاق" : "Due date"}:{" "}
                      {new Date(bill.dueDate).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-GB")}
                    </p>
                    {bill.paidAt && (
                      <p className="mt-1 text-sm text-gray-500">
                        {locale === "ar" ? "تاريخ السداد" : "Paid at"}:{" "}
                        {new Date(bill.paidAt).toLocaleString(locale === "ar" ? "ar-SA" : "en-GB")}
                      </p>
                    )}
                  </div>

                  <div className={`flex flex-col gap-3 ${isRTL ? "items-end" : "items-start lg:items-end"}`}>
                    <div className="text-2xl font-bold text-gray-900">
                      <Currency amount={bill.amount} locale={locale === "ar" ? "ar-SA" : "en-SA"} />
                    </div>
                    {bill.status === "UNPAID" && bill.paymentToken ? (
                      <Link
                        href={`/${locale}/payment?token=${encodeURIComponent(bill.paymentToken)}`}
                        className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary/90"
                      >
                        {locale === "ar" ? "ادفع الآن" : "Pay now"}
                      </Link>
                    ) : (
                      <span className="text-sm text-gray-500">
                        {bill.status === "PAID"
                          ? (locale === "ar" ? "تم السداد" : "Paid")
                          : (locale === "ar" ? "منتهية" : "Expired")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </TenantLayout>
  );
}
