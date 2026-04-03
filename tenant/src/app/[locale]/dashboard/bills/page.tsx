'use client';

import { useState, useEffect } from 'react';
import { TenantLayout } from '@/components/TenantLayout';
import { tenantApi } from '@/lib/api';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Bill {
  id: string;
  billNumber: string;
  amount: number;
  subtotalAmount?: number | string | null;
  vatAmount?: number | string | null;
  totalAmount?: number | string | null;
  currency: string;
  invoiceIssuedAt?: string | null;
  dueDate: string;
  status: string;
  paidAt?: string;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  planSnapshot?: {
    packageName?: string;
    packageNameAr?: string;
    billingCycle?: string;
  };
  lineItemsSnapshot?: Array<{
    labelAr?: string;
    labelEn?: string;
    quantity?: number;
    total?: number;
  }>;
  buyerSnapshot?: {
    businessName?: string;
    businessNameAr?: string;
    email?: string;
    phone?: string;
    address?: string;
  } | null;
  sellerSnapshot?: {
    nameAr?: string;
    nameEn?: string;
    vatNumber?: string;
    crNumber?: string;
    addressAr?: string;
    addressEn?: string;
  } | null;
  type: string;
  paymentToken?: string;
}

const BILL_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  initial: { ar: 'فاتورة تفعيل الاشتراك', en: 'Initial subscription invoice' },
  renewal: { ar: 'فاتورة تجديد الاشتراك', en: 'Subscription renewal invoice' },
  upgrade: { ar: 'فاتورة ترقية الباقة', en: 'Package upgrade invoice' },
  subscription: { ar: 'فاتورة اشتراك', en: 'Subscription invoice' }
};

const BILLING_CYCLE_LABELS: Record<string, { ar: string; en: string }> = {
  monthly: { ar: 'شهري', en: 'Monthly' },
  sixMonth: { ar: 'كل 6 أشهر', en: '6 months' },
  annual: { ar: 'سنوي', en: 'Annual' }
};

export default function BillsPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'ar';
  const isArabic = locale === 'ar';
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [documentLoading, setDocumentLoading] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    tenantApi
      .getBills()
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.bills) setBills(res.bills);
        else setError(isArabic ? 'فشل تحميل الفواتير' : 'Failed to load bills');
      })
      .catch(() => {
        if (!isMounted) return;
        setError(isArabic ? 'فشل تحميل الفواتير' : 'Failed to load bills');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isArabic]);

  const statusLabel = (status: string) => {
    if (isArabic) {
      if (status === 'DRAFT') return 'مسودة';
      if (status === 'UNPAID') return 'غير مدفوعة';
      if (status === 'FAILED') return 'فشل الدفع';
      if (status === 'PAID') return 'مدفوعة';
      if (status === 'EXPIRED') return 'منتهية';
      if (status === 'VOID') return 'ملغاة';
    }
    if (status === 'DRAFT') return 'Draft';
    if (status === 'UNPAID') return 'Unpaid';
    if (status === 'FAILED') return 'Payment failed';
    if (status === 'PAID') return 'Paid';
    if (status === 'EXPIRED') return 'Expired';
    if (status === 'VOID') return 'Void';
    return status;
  };

  const statusColor = (status: string) => {
    if (status === 'PAID') return 'bg-green-100 text-green-800';
    if (status === 'FAILED') return 'bg-rose-100 text-rose-800';
    if (status === 'EXPIRED' || status === 'VOID') return 'bg-red-100 text-red-800';
    if (status === 'DRAFT') return 'bg-slate-100 text-slate-700';
    return 'bg-amber-100 text-amber-800';
  };

  const billTypeLabel = (type: string) => BILL_TYPE_LABELS[type]?.[isArabic ? 'ar' : 'en'] || type;

  const billingCycleLabel = (cycle?: string) =>
    cycle ? BILLING_CYCLE_LABELS[cycle]?.[isArabic ? 'ar' : 'en'] || cycle : '—';

  const formatDate = (dateValue?: string | null) =>
    dateValue ? new Date(dateValue).toLocaleDateString(isArabic ? 'ar-SA' : 'en-GB') : '—';

  const formatMoney = (amount?: number | string | null, currency = 'SAR') => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount)) return '—';

    return new Intl.NumberFormat(isArabic ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2
    }).format(numericAmount);
  };

  const getPackageName = (bill: Bill) => (
    isArabic
      ? bill.planSnapshot?.packageNameAr || bill.planSnapshot?.packageName || '—'
      : bill.planSnapshot?.packageName || bill.planSnapshot?.packageNameAr || '—'
  );

  const downloadDocument = async (bill: Bill, kind: 'invoice' | 'receipt') => {
    setDocumentLoading(`${bill.id}-${kind}`);
    try {
      const response = kind === 'invoice'
        ? await tenantApi.downloadBillInvoicePdf(bill.id)
        : await tenantApi.downloadBillReceiptPdf(bill.id);
      const fileUrl = URL.createObjectURL(response.blob);
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(fileUrl), 30000);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : isArabic ? 'تعذر فتح ملف الفاتورة' : 'Could not open the bill document'
      );
    } finally {
      setDocumentLoading(null);
    }
  };

  const paidBillsCount = bills.filter((bill) => bill.status === 'PAID').length;
  const unpaidBillsCount = bills.filter((bill) => bill.status === 'UNPAID' || bill.status === 'FAILED').length;
  const paidTotal = bills
    .filter((bill) => bill.status === 'PAID')
    .reduce((sum, bill) => sum + Number(bill.totalAmount ?? bill.amount ?? 0), 0);
  const outstandingTotal = bills
    .filter((bill) => bill.status === 'UNPAID' || bill.status === 'FAILED')
    .reduce((sum, bill) => sum + Number(bill.totalAmount ?? bill.amount ?? 0), 0);

  return (
    <TenantLayout>
      <div className="p-6">
        <div className="mb-6">
          <p className="text-sm font-semibold text-primary mb-2">
            {isArabic ? 'الفواتير والسداد' : 'Invoices and payments'}
          </p>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {isArabic ? 'فواتيري' : 'My Bills'}
          </h1>
          <p className="text-gray-600">
            {isArabic
              ? 'راجع تفاصيل فواتير الاشتراك، افتح ملف الفاتورة الرسمية، وحمّل إيصال الفاتورة المدفوعة بعد السداد.'
              : 'Review subscription bill details, open the official invoice PDF, and download the paid receipt after payment.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">{isArabic ? 'عدد الفواتير' : 'Total bills'}</p>
            <p className="text-2xl font-bold text-gray-900">{bills.length}</p>
          </div>
          <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm">
            <p className="text-sm text-amber-700 mb-1">
              {isArabic ? 'قابلة للدفع / فشل الدفع' : 'Open / failed'}
            </p>
            <p className="text-2xl font-bold text-amber-900">
              {unpaidBillsCount}
              <span className="ms-2 text-sm font-semibold text-amber-700">
                {formatMoney(outstandingTotal, bills[0]?.currency || 'SAR')}
              </span>
            </p>
          </div>
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm">
            <p className="text-sm text-emerald-700 mb-1">{isArabic ? 'مدفوعة' : 'Paid'}</p>
            <p className="text-2xl font-bold text-emerald-900">
              {paidBillsCount}
              <span className="ms-2 text-sm font-semibold text-emerald-700">
                {formatMoney(paidTotal, bills[0]?.currency || 'SAR')}
              </span>
            </p>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {!loading && !error && bills.length === 0 && (
          <div className="rounded-[28px] border border-gray-200 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 text-2xl">
              🧾
            </div>
            <p className="text-lg font-bold text-gray-900 mb-2">
              {isArabic ? 'لا توجد فواتير حتى الآن' : 'No bills yet'}
            </p>
            <p className="text-sm text-gray-500">
              {isArabic
                ? 'ستظهر هنا فواتير الاشتراك عند إنشاء فاتورة تفعيل أو ترقية أو تجديد.'
                : 'Your subscription activation, upgrade, and renewal invoices will appear here.'}
            </p>
          </div>
        )}

        {!loading && !error && bills.length > 0 && (
          <div className="space-y-4">
            {bills.map((bill) => {
              const totalAmount = bill.totalAmount ?? bill.amount;
              const canDownloadReceipt = bill.status === 'PAID';
              const canPayNow = (bill.status === 'UNPAID' || bill.status === 'FAILED') && Boolean(bill.paymentToken);
              const invoiceLoading = documentLoading === `${bill.id}-invoice`;
              const receiptLoading = documentLoading === `${bill.id}-receipt`;

              return (
                <article
                  key={bill.id}
                  className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-bold text-gray-900">{bill.billNumber}</h2>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusColor(
                            bill.status
                          )}`}
                        >
                          {statusLabel(bill.status)}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-primary mb-1">
                        {billTypeLabel(bill.type)}
                      </p>
                      <p className="text-base font-semibold text-gray-900">
                        {getPackageName(bill)}
                        {bill.planSnapshot?.billingCycle
                          ? ` · ${billingCycleLabel(bill.planSnapshot.billingCycle)}`
                          : ''}
                      </p>
                      {bill.paymentMethod || bill.paymentReference ? (
                        <p className="mt-2 text-sm text-gray-600">
                          {isArabic ? 'بيانات الدفع' : 'Payment'}:{' '}
                          <span className="font-semibold text-gray-800">
                            {[bill.paymentMethod, bill.paymentReference].filter(Boolean).join(' · ')}
                          </span>
                        </p>
                      ) : null}
                    </div>

                    <div className="text-start lg:text-end">
                      <p className="text-sm text-gray-500 mb-1">
                        {isArabic ? 'الإجمالي شامل الضريبة' : 'Total incl. VAT'}
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatMoney(totalAmount, bill.currency)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {isArabic ? 'الأساس' : 'Subtotal'}{' '}
                        <span className="font-semibold text-gray-700">
                          {formatMoney(bill.subtotalAmount, bill.currency)}
                        </span>
                        {' · '}
                        {isArabic ? 'الضريبة' : 'VAT'}{' '}
                        <span className="font-semibold text-gray-700">
                          {formatMoney(bill.vatAmount, bill.currency)}
                        </span>
                      </p>
                    </div>
                  </div>

                  <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-gray-50 p-4">
                      <dt className="text-xs text-gray-500">{isArabic ? 'تاريخ الإصدار' : 'Issue date'}</dt>
                      <dd className="mt-1 text-sm font-semibold text-gray-900">
                        {formatDate(bill.invoiceIssuedAt)}
                      </dd>
                    </div>
                    <div className="rounded-2xl bg-gray-50 p-4">
                      <dt className="text-xs text-gray-500">{isArabic ? 'تاريخ الاستحقاق' : 'Due date'}</dt>
                      <dd className="mt-1 text-sm font-semibold text-gray-900">
                        {formatDate(bill.dueDate)}
                      </dd>
                    </div>
                    <div className="rounded-2xl bg-gray-50 p-4">
                      <dt className="text-xs text-gray-500">{isArabic ? 'تاريخ السداد' : 'Paid date'}</dt>
                      <dd className="mt-1 text-sm font-semibold text-gray-900">
                        {formatDate(bill.paidAt)}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedBill(bill)}
                      className="inline-flex items-center rounded-2xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      {isArabic ? 'عرض التفاصيل' : 'View details'}
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadDocument(bill, 'invoice')}
                      disabled={invoiceLoading}
                      className="inline-flex items-center rounded-2xl border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-60"
                    >
                      {invoiceLoading
                        ? isArabic ? 'جاري فتح الفاتورة...' : 'Opening invoice...'
                        : isArabic ? 'فتح الفاتورة PDF' : 'Open invoice PDF'}
                    </button>
                    {canDownloadReceipt && (
                      <button
                        type="button"
                        onClick={() => downloadDocument(bill, 'receipt')}
                        disabled={receiptLoading}
                        className="inline-flex items-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                      >
                        {receiptLoading
                          ? isArabic ? 'جاري فتح الإيصال...' : 'Opening receipt...'
                          : isArabic ? 'إيصال مدفوع PDF' : 'Paid receipt PDF'}
                      </button>
                    )}
                    {canPayNow && (
                      <Link
                        href={`/${locale}/payment?token=${bill.paymentToken}`}
                        className="inline-flex items-center rounded-2xl bg-purple-600 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-700"
                      >
                        {isArabic ? 'ادفع الآن' : 'Pay now'}
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {selectedBill && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[32px] bg-white p-6 shadow-2xl">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-primary mb-1">
                    {isArabic ? 'تفاصيل الفاتورة' : 'Invoice details'}
                  </p>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedBill.billNumber}</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {billTypeLabel(selectedBill.type)} · {getPackageName(selectedBill)} ·{' '}
                    {billingCycleLabel(selectedBill.planSnapshot?.billingCycle)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBill(null)}
                  className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                >
                  {isArabic ? 'إغلاق' : 'Close'}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-3xl border border-gray-100 bg-gray-50 p-5">
                  <p className="text-sm font-bold text-gray-900 mb-3">
                    {isArabic ? 'العميل' : 'Bill to'}
                  </p>
                  <div className="space-y-2 text-sm text-gray-700">
                    <p className="font-semibold text-gray-900">
                      {isArabic
                        ? selectedBill.buyerSnapshot?.businessNameAr || selectedBill.buyerSnapshot?.businessName || '—'
                        : selectedBill.buyerSnapshot?.businessName || selectedBill.buyerSnapshot?.businessNameAr || '—'}
                    </p>
                    <p>{selectedBill.buyerSnapshot?.email || '—'}</p>
                    <p>{selectedBill.buyerSnapshot?.phone || '—'}</p>
                    <p>{selectedBill.buyerSnapshot?.address || '—'}</p>
                  </div>
                </div>

                <div className="rounded-3xl border border-gray-100 bg-gray-50 p-5">
                  <p className="text-sm font-bold text-gray-900 mb-3">
                    {isArabic ? 'بيانات رفاه' : 'Refah issuer'}
                  </p>
                  <div className="space-y-2 text-sm text-gray-700">
                    <p className="font-semibold text-gray-900">
                      {isArabic
                        ? selectedBill.sellerSnapshot?.nameAr || selectedBill.sellerSnapshot?.nameEn || 'Refah'
                        : selectedBill.sellerSnapshot?.nameEn || selectedBill.sellerSnapshot?.nameAr || 'Refah'}
                    </p>
                    <p>
                      {isArabic ? 'الرقم الضريبي' : 'VAT number'}:{' '}
                      {selectedBill.sellerSnapshot?.vatNumber || '—'}
                    </p>
                    <p>
                      {isArabic ? 'السجل التجاري' : 'CR number'}:{' '}
                      {selectedBill.sellerSnapshot?.crNumber || '—'}
                    </p>
                    <p>
                      {isArabic
                        ? selectedBill.sellerSnapshot?.addressAr || selectedBill.sellerSnapshot?.addressEn || '—'
                        : selectedBill.sellerSnapshot?.addressEn || selectedBill.sellerSnapshot?.addressAr || '—'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-3xl border border-gray-100 overflow-hidden">
                <div className="bg-gray-50 px-5 py-4">
                  <p className="text-sm font-bold text-gray-900">
                    {isArabic ? 'بنود الفاتورة' : 'Invoice line items'}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-gray-100">
                      <tr>
                        <th className="px-5 py-3 text-start text-xs font-semibold text-gray-500">
                          {isArabic ? 'البند' : 'Item'}
                        </th>
                        <th className="px-5 py-3 text-start text-xs font-semibold text-gray-500">
                          {isArabic ? 'الكمية' : 'Qty'}
                        </th>
                        <th className="px-5 py-3 text-start text-xs font-semibold text-gray-500">
                          {isArabic ? 'الإجمالي' : 'Total'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedBill.lineItemsSnapshot || []).length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-5 py-5 text-center text-sm text-gray-500">
                            {isArabic ? 'لا توجد بنود محفوظة لهذه الفاتورة.' : 'No saved line items for this invoice.'}
                          </td>
                        </tr>
                      ) : (
                        selectedBill.lineItemsSnapshot?.map((item, index) => (
                          <tr
                            key={`${selectedBill.id}-${index}`}
                            className="border-b border-gray-100 last:border-b-0"
                          >
                            <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                              {isArabic
                                ? item.labelAr || item.labelEn || '—'
                                : item.labelEn || item.labelAr || '—'}
                            </td>
                            <td className="px-5 py-4 text-sm text-gray-700">
                              {item.quantity ?? 1}
                            </td>
                            <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                              {formatMoney(item.total, selectedBill.currency)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
                <div className="rounded-3xl border border-gray-100 bg-gray-50 p-5">
                  <p className="text-sm font-bold text-gray-900 mb-3">
                    {isArabic ? 'حالة الدفع' : 'Payment status'}
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">{isArabic ? 'الحالة' : 'Status'}</p>
                      <p className="mt-1 font-semibold text-gray-900">
                        {statusLabel(selectedBill.status)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{isArabic ? 'تاريخ السداد' : 'Paid date'}</p>
                      <p className="mt-1 font-semibold text-gray-900">
                        {formatDate(selectedBill.paidAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{isArabic ? 'طريقة الدفع' : 'Payment method'}</p>
                      <p className="mt-1 font-semibold text-gray-900">
                        {selectedBill.paymentMethod || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{isArabic ? 'مرجع الدفع' : 'Payment reference'}</p>
                      <p className="mt-1 font-semibold text-gray-900 break-all">
                        {selectedBill.paymentReference || '—'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-gray-100 bg-gray-50 p-5">
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">{isArabic ? 'المجموع الفرعي' : 'Subtotal'}</span>
                      <span className="font-semibold text-gray-900">
                        {formatMoney(selectedBill.subtotalAmount, selectedBill.currency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">{isArabic ? 'ضريبة القيمة المضافة' : 'VAT'}</span>
                      <span className="font-semibold text-gray-900">
                        {formatMoney(selectedBill.vatAmount, selectedBill.currency)}
                      </span>
                    </div>
                    <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
                      <span className="text-gray-900 font-bold">
                        {isArabic ? 'الإجمالي النهائي' : 'Grand total'}
                      </span>
                      <span className="text-lg font-bold text-gray-900">
                        {formatMoney(
                          selectedBill.totalAmount ?? selectedBill.amount,
                          selectedBill.currency
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => downloadDocument(selectedBill, 'invoice')}
                  disabled={documentLoading === `${selectedBill.id}-invoice`}
                  className="inline-flex items-center rounded-2xl border border-purple-200 bg-purple-50 px-5 py-2.5 text-sm font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-60"
                >
                  {documentLoading === `${selectedBill.id}-invoice`
                    ? isArabic ? 'جاري فتح الفاتورة...' : 'Opening invoice...'
                    : isArabic ? 'فتح الفاتورة PDF' : 'Open invoice PDF'}
                </button>

                {selectedBill.status === 'PAID' && (
                  <button
                    type="button"
                    onClick={() => downloadDocument(selectedBill, 'receipt')}
                    disabled={documentLoading === `${selectedBill.id}-receipt`}
                    className="inline-flex items-center rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                  >
                    {documentLoading === `${selectedBill.id}-receipt`
                      ? isArabic ? 'جاري فتح الإيصال...' : 'Opening receipt...'
                      : isArabic ? 'فتح إيصال السداد' : 'Open paid receipt'}
                  </button>
                )}

                {(selectedBill.status === 'UNPAID' || selectedBill.status === 'FAILED') && selectedBill.paymentToken && (
                  <Link
                    href={`/${locale}/payment?token=${selectedBill.paymentToken}`}
                    className="inline-flex items-center rounded-2xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-700"
                  >
                    {isArabic ? 'ادفع الآن' : 'Pay now'}
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </TenantLayout>
  );
}
