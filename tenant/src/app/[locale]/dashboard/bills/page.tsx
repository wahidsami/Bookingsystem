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
  currency: string;
  dueDate: string;
  status: string;
  paidAt?: string;
  planSnapshot?: { packageName?: string; billingCycle?: string };
  type: string;
  paymentToken?: string;
}

export default function BillsPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'ar';
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    tenantApi
      .getBills()
      .then((res) => {
        if (res.success && res.bills) setBills(res.bills);
        else setError('Failed to load bills');
      })
      .catch(() => setError('Failed to load bills'))
      .finally(() => setLoading(false));
  }, []);

  const statusLabel = (status: string) => {
    if (locale === 'ar') {
      if (status === 'UNPAID') return 'غير مدفوعة';
      if (status === 'PAID') return 'مدفوعة';
      if (status === 'EXPIRED') return 'منتهية';
    }
    return status;
  };

  const statusColor = (status: string) => {
    if (status === 'PAID') return 'bg-green-100 text-green-800';
    if (status === 'EXPIRED') return 'bg-red-100 text-red-800';
    return 'bg-amber-100 text-amber-800';
  };

  return (
    <TenantLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {locale === 'ar' ? 'فواتيري' : 'My Bills'}
        </h1>
        <p className="text-gray-600 mb-6">
          {locale === 'ar'
            ? 'عرض الفواتير ودفعها من هنا.'
            : 'View and pay your bills here.'}
        </p>

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

        {!loading && !error && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {bills.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                {locale === 'ar' ? 'لا توجد فواتير.' : 'No bills yet.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                        {locale === 'ar' ? 'رقم الفاتورة' : 'Bill number'}
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                        {locale === 'ar' ? 'الخطة' : 'Plan'}
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                        {locale === 'ar' ? 'المبلغ' : 'Amount'}
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                        {locale === 'ar' ? 'الموعد النهائي' : 'Due date'}
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                        {locale === 'ar' ? 'الحالة' : 'Status'}
                      </th>
                      <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">
                        {locale === 'ar' ? 'إجراء' : 'Action'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map((bill) => (
                      <tr key={bill.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{bill.billNumber}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {bill.planSnapshot?.packageName || '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-900">
                          {bill.amount} {bill.currency}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{bill.dueDate}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusColor(
                              bill.status
                            )}`}
                          >
                            {statusLabel(bill.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {bill.status === 'UNPAID' && bill.paymentToken && (
                            <Link
                              href={`/${locale}/payment?token=${bill.paymentToken}`}
                              className="inline-flex items-center px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700"
                            >
                              {locale === 'ar' ? 'ادفع الآن' : 'Pay now'}
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </TenantLayout>
  );
}
