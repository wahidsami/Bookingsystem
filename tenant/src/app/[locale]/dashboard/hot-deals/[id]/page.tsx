'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TenantLayout } from '@/components/TenantLayout';
import { getImageUrl, tenantApi } from '@/lib/api';
import { useTranslations } from 'next-intl';

type HotDeal = {
    id: string;
    title_en?: string;
    title_ar?: string;
    description_en?: string;
    description_ar?: string;
    status?: string;
    image?: string | null;
    validFrom?: string;
    validUntil?: string;
    originalPrice?: number | string | null;
    discountedPrice?: number | string | null;
    discountType?: string;
    discountValue?: number | string | null;
    redemptionCount?: number | null;
    maxRedemptions?: number | null;
    rejectionReason?: string | null;
    createdAt?: string;
    service?: {
        id: string;
        name_en?: string;
        name_ar?: string;
        duration?: number | null;
    } | null;
};

const toNumber = (value: number | string | null | undefined) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export default function HotDealDetailsPage() {
    const router = useRouter();
    const params = useParams();
    const locale = (params?.locale as string) || 'ar';
    const dealId = (params?.id as string) || '';
    const t = useTranslations('hotDeals');
    const isRTL = locale === 'ar';

    const [loading, setLoading] = useState(true);
    const [deal, setDeal] = useState<HotDeal | null>(null);
    const [error, setError] = useState('');
    const [actionLoading, setActionLoading] = useState<'pause' | 'publish' | null>(null);

    const fetchDeal = async () => {
        if (!dealId) {
            setError(isRTL ? 'لم يتم العثور على العرض.' : 'Hot deal not found.');
            setLoading(false);
            return;
        }

        try {
            const response = await tenantApi.getHotDeal(dealId);
            setDeal(response.deal || null);
            if (!response.deal) {
                setError(isRTL ? 'لم يتم العثور على العرض.' : 'Hot deal not found.');
            }
        } catch (fetchError: any) {
            console.error('Error fetching hot deal details:', fetchError);
            setError(fetchError?.message || (isRTL ? 'تعذر تحميل تفاصيل العرض.' : 'Failed to load hot deal details.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDeal();
    }, [dealId, isRTL]);

    const title = isRTL ? deal?.title_ar : deal?.title_en;
    const description = isRTL ? deal?.description_ar : deal?.description_en;
    const serviceName = deal?.service ? (isRTL ? deal.service.name_ar : deal.service.name_en) : '';
    const originalPrice = toNumber(deal?.originalPrice);
    const discountedPrice = toNumber(deal?.discountedPrice);
    const discountValue = toNumber(deal?.discountValue);
    const maxRedemptions = typeof deal?.maxRedemptions === 'number'
        ? deal.maxRedemptions
        : Number(deal?.maxRedemptions ?? 0);

    const statusBadgeClasses: Record<string, string> = {
        pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
        active: 'bg-green-500/10 text-green-400 border-green-500/20',
        paused: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
        rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
        expired: 'bg-gray-500/10 text-gray-300 border-gray-500/20'
    };

    const handleLifecycleAction = async (action: 'pause' | 'publish') => {
        if (!deal?.id) return;

        try {
            setActionLoading(action);
            const response = action === 'pause'
                ? await tenantApi.pauseHotDeal(deal.id)
                : await tenantApi.resumeHotDeal(deal.id);

            if (response?.deal) {
                setDeal(response.deal);
            } else {
                await fetchDeal();
            }
        } catch (actionError: any) {
            console.error(`Failed to ${action} hot deal:`, actionError);
            setError(actionError?.message || (isRTL ? 'تعذر تنفيذ الإجراء.' : 'Failed to perform this action.'));
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <TenantLayout>
            <div className="space-y-6 bg-slate-950 text-slate-100" dir={isRTL ? 'rtl' : 'ltr'}>
                <button
                    onClick={() => router.push(`/${locale}/dashboard/hot-deals`)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                    <span>{isRTL ? '→' : '←'}</span>
                    <span>{t('backToList')}</span>
                </button>

                {loading && (
                    <div className="flex justify-center rounded-[28px] border border-white/10 bg-slate-900 py-20">
                        <div className="h-11 w-11 animate-spin rounded-full border-2 border-fuchsia-400/20 border-t-fuchsia-400" />
                    </div>
                )}

                {!loading && error && (
                    <div className="rounded-[28px] border border-rose-400/20 bg-rose-500/10 p-6">
                        <h1 className="text-xl font-bold text-white mb-2">
                            {isRTL ? 'تعذر فتح العرض' : 'Unable to open hot deal'}
                        </h1>
                        <p className="text-rose-100">{error}</p>
                    </div>
                )}

                {!loading && !error && deal && (
                    <div className="space-y-6">
                        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900 shadow-[0_20px_80px_rgba(2,6,23,0.35)]">
                            <div className="relative h-80 bg-slate-950">
                                {deal.image ? (
                                    <img
                                        src={getImageUrl(deal.image)}
                                        alt={title || 'Hot deal'}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-fuchsia-900/40 to-slate-950">
                                        <span className="text-7xl opacity-20">🔥</span>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                                <div className="absolute inset-x-0 bottom-0 p-6 lg:p-8">
                                    <div className={`flex flex-wrap items-center gap-3 ${isRTL ? 'justify-end' : 'justify-start'}`}>
                                        <span className={`rounded-full border border-white/10 px-3 py-1 text-sm font-semibold ${statusBadgeClasses[deal.status || 'pending'] || statusBadgeClasses.pending}`}>
                                            {t(`status.${deal.status || 'pending'}`)}
                                        </span>
                                        <span className="rounded-full border border-rose-400/20 bg-rose-500/85 px-3 py-1 text-sm font-bold text-white">
                                            {deal.discountType === 'percentage' ? `-${discountValue}%` : `-${discountValue} SAR`}
                                        </span>
                                    </div>
                                    <h1 className="mt-4 text-3xl font-black text-white lg:text-5xl">{title || (isRTL ? 'عرض خاص' : 'Hot deal')}</h1>
                                    <p className="mt-2 text-sm text-fuchsia-200/90 lg:text-base">
                                        {serviceName || (isRTL ? 'الخدمة غير متوفرة' : 'Service unavailable')}
                                    </p>
                                </div>
                            </div>
                        </section>

                        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                            <div className="space-y-6 xl:col-span-2">
                                <section className="rounded-[28px] border border-white/10 bg-slate-900 p-6 shadow-[0_20px_80px_rgba(2,6,23,0.35)]">
                                    <h2 className="mb-5 text-xl font-bold text-white">
                                        {isRTL ? 'تفاصيل العرض' : 'Deal Details'}
                                    </h2>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                                            <p className="text-sm text-slate-400">{isRTL ? 'السعر الأصلي' : 'Original Price'}</p>
                                            <p className="mt-2 text-2xl font-black text-white">{originalPrice.toFixed(2)} SAR</p>
                                        </div>
                                        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                                            <p className="text-sm text-slate-400">{isRTL ? 'السعر بعد الخصم' : 'Discounted Price'}</p>
                                            <p className="mt-2 text-2xl font-black text-emerald-300">{discountedPrice.toFixed(2)} SAR</p>
                                        </div>
                                        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                                            <p className="text-sm text-slate-400">{isRTL ? 'فترة الصلاحية' : 'Validity Period'}</p>
                                            <p className="mt-2 font-medium text-white">
                                                {deal.validFrom ? new Date(deal.validFrom).toLocaleDateString(locale) : '—'} {' - '}
                                                {deal.validUntil ? new Date(deal.validUntil).toLocaleDateString(locale) : '—'}
                                            </p>
                                        </div>
                                        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                                            <p className="text-sm text-slate-400">{isRTL ? 'عدد الاستخدام' : 'Redemptions'}</p>
                                            <p className="mt-2 font-medium text-white">
                                                {deal.redemptionCount || 0} / {maxRedemptions === -1 ? t('unlimited') : maxRedemptions || 0}
                                            </p>
                                        </div>
                                    </div>
                                </section>

                                <section className="rounded-[28px] border border-white/10 bg-slate-900 p-6 shadow-[0_20px_80px_rgba(2,6,23,0.35)]">
                                    <h2 className="mb-5 text-xl font-bold text-white">
                                        {isRTL ? 'الوصف' : 'Description'}
                                    </h2>
                                    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
                                        {description || (isRTL ? 'لا يوجد وصف لهذا العرض.' : 'No description was provided for this deal.')}
                                    </p>
                                </section>

                                {deal.status === 'rejected' && deal.rejectionReason && (
                                    <section className="rounded-[28px] border border-rose-400/20 bg-rose-500/10 p-6">
                                        <h2 className="mb-3 text-lg font-semibold text-rose-200">
                                            {t('rejectedReason')}
                                        </h2>
                                        <p className="text-rose-100">{deal.rejectionReason}</p>
                                    </section>
                                )}
                            </div>

                            <aside className="space-y-6">
                                <section className="rounded-[28px] border border-white/10 bg-slate-900 p-6 shadow-[0_20px_80px_rgba(2,6,23,0.35)]">
                                    <h2 className="mb-5 text-xl font-bold text-white">
                                        {isRTL ? 'ملخص سريع' : 'Quick Summary'}
                                    </h2>
                                    <div className="space-y-4">
                                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{isRTL ? 'الحالة' : 'Status'}</p>
                                            <p className="mt-2 font-medium text-white">{t(`status.${deal.status || 'pending'}`)}</p>
                                        </div>
                                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{isRTL ? 'الخدمة' : 'Service'}</p>
                                            <p className="mt-2 font-medium text-white">{serviceName || '—'}</p>
                                        </div>
                                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{isRTL ? 'نوع الخصم' : 'Discount Type'}</p>
                                            <p className="mt-2 font-medium text-white">
                                                {deal.discountType === 'percentage'
                                                    ? (isRTL ? 'نسبة مئوية' : 'Percentage')
                                                    : (isRTL ? 'مبلغ ثابت' : 'Fixed amount')}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{isRTL ? 'قيمة الخصم' : 'Discount Value'}</p>
                                            <p className="mt-2 font-medium text-white">
                                                {deal.discountType === 'percentage'
                                                    ? `${discountValue}%`
                                                    : `${discountValue.toFixed(2)} SAR`}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{isRTL ? 'تاريخ الإنشاء' : 'Created On'}</p>
                                            <p className="mt-2 font-medium text-white">
                                                {deal.createdAt ? new Date(deal.createdAt).toLocaleDateString(locale) : '—'}
                                            </p>
                                        </div>
                                    </div>
                                </section>

                                <section className="rounded-[28px] border border-white/10 bg-slate-900 p-6 shadow-[0_20px_80px_rgba(2,6,23,0.35)]">
                                    <h2 className="mb-5 text-xl font-bold text-white">
                                        {isRTL ? 'إجراءات العرض' : 'Deal Actions'}
                                    </h2>
                                    <div className="space-y-3">
                                        {deal.status === 'active' && (
                                            <button
                                                onClick={() => handleLifecycleAction('pause')}
                                                disabled={actionLoading !== null}
                                                className="w-full rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {actionLoading === 'pause' ? (isRTL ? 'جاري الإيقاف...' : 'Pausing...') : (isRTL ? 'إيقاف العرض' : 'Pause deal')}
                                            </button>
                                        )}
                                        {deal.status === 'paused' && (
                                            <button
                                                onClick={() => handleLifecycleAction('publish')}
                                                disabled={actionLoading !== null}
                                                className="w-full rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {actionLoading === 'publish' ? (isRTL ? 'جاري النشر...' : 'Publishing...') : (isRTL ? 'نشر العرض' : 'Publish deal')}
                                            </button>
                                        )}
                                        {deal.status === 'paused' && (
                                            <button
                                                onClick={() => router.push(`/${locale}/dashboard/hot-deals/new?dealId=${deal.id}`)}
                                                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                                            >
                                                {isRTL ? 'تعديل العرض' : 'Edit deal'}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => router.push(`/${locale}/dashboard/hot-deals`)}
                                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                                        >
                                            {isRTL ? 'العودة للقائمة' : 'Back to list'}
                                        </button>
                                    </div>
                                </section>
                            </aside>
                        </div>
                    </div>
                )}
            </div>
        </TenantLayout>
    );
}
