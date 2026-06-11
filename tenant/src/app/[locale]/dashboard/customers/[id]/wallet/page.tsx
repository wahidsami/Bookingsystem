"use client";

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { TenantLayout } from '@/components/TenantLayout';
import { Currency } from '@/components/Currency';
import { tenantApi } from '@/lib/api';
import {
  ArrowLeftIcon,
  BanknotesIcon,
  GiftIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

interface WalletLedgerEntry {
  id: string;
  type: string;
  direction: 'credit' | 'debit';
  amount: number;
  currency: string;
  balanceBefore: number;
  balanceAfter: number;
  referenceType?: string | null;
  referenceId?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
}

interface GiftCardTransaction {
  id: string;
  packageTitle: string;
  purchaseAmount: number;
  creditAmount: number;
  bonusAmount: number;
  totalCreditAmount: number;
  status: string;
  deliveryChannel: string;
  senderPlatformUserId?: string | null;
  recipientPlatformUserId?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  deliveryMode?: string | null;
  createdAt: string;
  claimedAt?: string | null;
}

interface WalletCustomer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  walletBalance?: number;
  walletSummary?: {
    currentBalance: number;
    walletLedgerCount: number;
    sentGiftCardCount: number;
    receivedGiftCardCount: number;
  };
  walletLedgerEntries?: WalletLedgerEntry[];
  giftCardTransactions?: GiftCardTransaction[];
}

function formatDateTime(value: string, locale: string) {
  return new Date(value).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(amount: number, locale: string) {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
    style: 'currency',
    currency: 'SAR',
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

export default function CustomerWalletPage() {
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const customerId = params.id as string;
  const isRTL = locale === 'ar';

  const [customer, setCustomer] = useState<WalletCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await tenantApi.getCustomerWalletHistory(customerId);
        if (response.success) {
          setCustomer(response.data);
        } else {
          setError(response.message || 'Failed to load wallet history');
        }
      } catch (err: any) {
        console.error('Failed to load wallet history:', err);
        setError(err.message || 'Failed to load wallet history');
      } finally {
        setLoading(false);
      }
    };

    if (customerId) {
      load();
    }
  }, [customerId]);

  if (loading) {
    return (
      <TenantLayout>
        <div className="flex items-center justify-center h-64">
          <div className="h-9 w-9 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </TenantLayout>
    );
  }

  if (error || !customer) {
    return (
      <TenantLayout>
        <div className="flex flex-col items-center justify-center h-64 px-4 text-center">
          <p className="mb-4 text-red-500">{error || 'Wallet history not found'}</p>
          <button
            onClick={() => router.back()}
            className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90"
          >
            {locale === 'ar' ? 'رجوع' : 'Back'}
          </button>
        </div>
      </TenantLayout>
    );
  }

  const walletBalance = Number(customer.walletBalance ?? customer.walletSummary?.currentBalance ?? 0);
  const ledgerEntries = customer.walletLedgerEntries || [];
  const giftCardTransactions = customer.giftCardTransactions || [];

  return (
    <TenantLayout>
      <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <button
              onClick={() => router.push(`/${locale}/dashboard/customers/${customerId}`)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {isRTL ? <ArrowLeftIcon className="h-4 w-4" /> : <ArrowLeftIcon className="h-4 w-4" />}
              {locale === 'ar' ? 'رجوع إلى الملف' : 'Back to profile'}
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {customer.firstName} {customer.lastName}
              </h1>
              <p className="text-sm text-gray-500">
                {locale === 'ar' ? 'سجل المحفظة والهدايا' : 'Wallet and gift card history'}
              </p>
            </div>
          </div>
          <Link
            href={`/${locale}/dashboard/customers/${customerId}`}
            className="text-sm font-medium text-primary hover:text-primary/80"
          >
            {locale === 'ar' ? 'عرض الملف الكامل' : 'View full profile'}
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  {locale === 'ar' ? 'الرصيد الحالي' : 'Current balance'}
                </p>
                <p className="mt-3 text-3xl font-bold text-emerald-700">
                  <Currency amount={walletBalance} />
                </p>
              </div>
              <BanknotesIcon className="h-10 w-10 text-emerald-700/70" />
            </div>
          </div>
          <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              {locale === 'ar' ? 'إجمالي القيود' : 'Ledger entries'}
            </p>
            <p className="mt-3 text-3xl font-bold text-blue-700">{ledgerEntries.length}</p>
          </div>
          <div className="rounded-3xl border border-purple-100 bg-purple-50 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-700">
              {locale === 'ar' ? 'الهدايا المرسلة' : 'Gift cards sent'}
            </p>
            <p className="mt-3 text-3xl font-bold text-purple-700">
              {customer.walletSummary?.sentGiftCardCount ?? 0}
            </p>
          </div>
          <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
              {locale === 'ar' ? 'الهدايا المستلمة' : 'Gift cards received'}
            </p>
            <p className="mt-3 text-3xl font-bold text-amber-700">
              {customer.walletSummary?.receivedGiftCardCount ?? 0}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <ClockIcon className="h-5 w-5 text-gray-500" />
              <h2 className="text-lg font-semibold text-gray-900">
                {locale === 'ar' ? 'سجل المحفظة الكامل' : 'Full wallet ledger'}
              </h2>
            </div>
            <div className="space-y-3">
              {ledgerEntries.length > 0 ? ledgerEntries.map((entry) => (
                <article key={entry.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {entry.type.split('_').join(' ')}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {formatDateTime(entry.createdAt, locale)}
                      </p>
                      <p className="mt-2 text-xs text-gray-500">
                        {locale === 'ar' ? 'قبل' : 'Before'} {formatMoney(entry.balanceBefore, locale)} {' '}
                        {locale === 'ar' ? 'بعد' : 'after'} {formatMoney(entry.balanceAfter, locale)}
                      </p>
                      {(entry.referenceType || entry.referenceId) && (
                        <p className="mt-1 text-xs text-gray-500">
                          {entry.referenceType || '-'}
                          {entry.referenceId ? ` #${entry.referenceId}` : ''}
                        </p>
                      )}
                    </div>
                    <div className={`text-sm font-bold ${entry.direction === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {entry.direction === 'credit' ? '+' : '-'}{formatMoney(entry.amount, locale)}
                    </div>
                  </div>
                </article>
              )) : (
                <p className="text-sm text-gray-500">
                  {locale === 'ar' ? 'لا توجد قيود محفظة حتى الآن.' : 'No wallet ledger entries yet.'}
                </p>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <GiftIcon className="h-5 w-5 text-gray-500" />
              <h2 className="text-lg font-semibold text-gray-900">
                {locale === 'ar' ? 'سجل بطاقات الهدايا الكامل' : 'Full gift card history'}
              </h2>
            </div>
            <div className="space-y-3">
              {giftCardTransactions.length > 0 ? giftCardTransactions.map((tx) => {
                const isSent = tx.senderPlatformUserId === customer.id;
                return (
                  <article key={tx.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{tx.packageTitle}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {isSent ? (locale === 'ar' ? 'مرسلة' : 'Sent') : (locale === 'ar' ? 'مستلمة' : 'Received')}
                          {' • '}
                          {formatDateTime(tx.createdAt, locale)}
                        </p>
                        <p className="mt-2 text-xs text-gray-500">
                          {locale === 'ar' ? 'الحالة' : 'Status'}: {tx.status}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {locale === 'ar' ? 'القناة' : 'Channel'}: {tx.deliveryChannel}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">
                          <Currency amount={tx.totalCreditAmount} />
                        </p>
                        {tx.claimedAt ? (
                          <p className="mt-1 text-xs text-emerald-600">
                            {locale === 'ar' ? 'تم الاستلام' : 'Claimed'}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              }) : (
                <p className="text-sm text-gray-500">
                  {locale === 'ar' ? 'لا توجد بطاقات هدايا حتى الآن.' : 'No gift cards yet.'}
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </TenantLayout>
  );
}
