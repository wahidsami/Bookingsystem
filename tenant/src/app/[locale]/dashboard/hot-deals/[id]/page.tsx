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

    useEffect(() => {
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
        rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
        expired: 'bg-gray-500/10 text-gray-300 border-gray-500/20'
    };

    return (
        <TenantLayout>
            <div className={`p-6 max-w-5xl animate-fade-in ${isRTL ? 'text-right' : 'text-left'}`}>
                <button
                    onClick={() => router.push(`/${locale}/dashboard/hot-deals`)}
                    className="text-dark-400 hover:text-white mb-4 flex items-center gap-2 transition-colors"
                    style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                >
                    <span>{isRTL ? '→' : '←'}</span>
                    <span>{t('backToList')}</span>
                </button>

                {loading && (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500"></div>
                    </div>
                )}

                {!loading && error && (
                    <div className="bg-dark-800 border border-red-500/20 text-red-300 rounded-xl p-6 shadow-lg">
                        <h1 className="text-xl font-bold text-white mb-2">
                            {isRTL ? 'تعذر فتح العرض' : 'Unable to open hot deal'}
                        </h1>
                        <p>{error}</p>
                    </div>
                )}

                {!loading && !error && deal && (
                    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
                        <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden shadow-lg">
                            <div className="h-72 bg-dark-900 relative">
                                {deal.image ? (
                                    <img
                                        src={getImageUrl(deal.image)}
                                        alt={title || 'Hot deal'}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/40 to-dark-950">
                                        <span className="text-6xl opacity-20">🔥</span>
                                    </div>
                                )}

                                <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-dark-950 via-dark-950/60 to-transparent">
                                    <div className={`flex flex-wrap items-center gap-3 ${isRTL ? 'justify-end' : 'justify-start'}`}>
                                        <span className={`px-3 py-1 text-sm font-semibold rounded-full border ${statusBadgeClasses[deal.status || 'pending'] || statusBadgeClasses.pending}`}>
                                            {t(`status.${deal.status || 'pending'}`)}
                                        </span>
                                        <span className="px-3 py-1 rounded-full bg-red-500/85 text-white text-sm font-bold">
                                            {deal.discountType === 'percentage'
                                                ? `-${discountValue}%`
                                                : `-${discountValue} SAR`}
                                        </span>
                                    </div>
                                    <h1 className="text-3xl font-bold text-white mt-4">{title || (isRTL ? 'عرض خاص' : 'Hot deal')}</h1>
                                    <p className="text-purple-300 mt-2">
                                        {serviceName || (isRTL ? 'الخدمة غير متوفرة' : 'Service unavailable')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                            <div className="xl:col-span-2 space-y-6">
                                <div className="bg-dark-800 rounded-xl border border-dark-700 p-6 shadow-lg">
                                    <h2 className="text-lg font-semibold text-white mb-4">
                                        {isRTL ? 'تفاصيل العرض' : 'Deal Details'}
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-dark-900/70 rounded-lg p-4">
                                            <p className="text-sm text-dark-400 mb-1">{isRTL ? 'السعر الأصلي' : 'Original Price'}</p>
                                            <p className="text-xl font-bold text-white">{originalPrice.toFixed(2)} SAR</p>
                                        </div>
                                        <div className="bg-dark-900/70 rounded-lg p-4">
                                            <p className="text-sm text-dark-400 mb-1">{isRTL ? 'السعر بعد الخصم' : 'Discounted Price'}</p>
                                            <p className="text-xl font-bold text-green-400">{discountedPrice.toFixed(2)} SAR</p>
                                        </div>
                                        <div className="bg-dark-900/70 rounded-lg p-4">
                                            <p className="text-sm text-dark-400 mb-1">{isRTL ? 'فترة الصلاحية' : 'Validity Period'}</p>
                                            <p className="text-white font-medium">
                                                {deal.validFrom ? new Date(deal.validFrom).toLocaleDateString(locale) : '—'}
                                                {' - '}
                                                {deal.validUntil ? new Date(deal.validUntil).toLocaleDateString(locale) : '—'}
                                            </p>
                                        </div>
                                        <div className="bg-dark-900/70 rounded-lg p-4">
                                            <p className="text-sm text-dark-400 mb-1">{isRTL ? 'عدد الاستخدام' : 'Redemptions'}</p>
                                            <p className="text-white font-medium">
                                                {deal.redemptionCount || 0} / {maxRedemptions === -1 ? t('unlimited') : maxRedemptions || 0}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-dark-800 rounded-xl border border-dark-700 p-6 shadow-lg">
                                    <h2 className="text-lg font-semibold text-white mb-4">
                                        {isRTL ? 'الوصف' : 'Description'}
                                    </h2>
                                    <p className="text-dark-200 leading-7 whitespace-pre-wrap">
                                        {description || (isRTL ? 'لا يوجد وصف لهذا العرض.' : 'No description was provided for this deal.')}
                                    </p>
                                </div>

                                {deal.status === 'rejected' && deal.rejectionReason && (
                                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 shadow-lg">
                                        <h2 className="text-lg font-semibold text-red-300 mb-3">
                                            {t('rejectedReason')}
                                        </h2>
                                        <p className="text-red-200">{deal.rejectionReason}</p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-6">
                                <div className="bg-dark-800 rounded-xl border border-dark-700 p-6 shadow-lg">
                                    <h2 className="text-lg font-semibold text-white mb-4">
                                        {isRTL ? 'ملخص سريع' : 'Quick Summary'}
                                    </h2>
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-sm text-dark-400 mb-1">{isRTL ? 'الحالة' : 'Status'}</p>
                                            <p className="text-white font-medium">{t(`status.${deal.status || 'pending'}`)}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-dark-400 mb-1">{isRTL ? 'الخدمة' : 'Service'}</p>
                                            <p className="text-white font-medium">{serviceName || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-dark-400 mb-1">{isRTL ? 'نوع الخصم' : 'Discount Type'}</p>
                                            <p className="text-white font-medium">
                                                {deal.discountType === 'percentage'
                                                    ? (isRTL ? 'نسبة مئوية' : 'Percentage')
                                                    : (isRTL ? 'مبلغ ثابت' : 'Fixed amount')}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-dark-400 mb-1">{isRTL ? 'قيمة الخصم' : 'Discount Value'}</p>
                                            <p className="text-white font-medium">
                                                {deal.discountType === 'percentage'
                                                    ? `${discountValue}%`
                                                    : `${discountValue.toFixed(2)} SAR`}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-dark-400 mb-1">{isRTL ? 'تاريخ الإنشاء' : 'Created On'}</p>
                                            <p className="text-white font-medium">
                                                {deal.createdAt ? new Date(deal.createdAt).toLocaleDateString(locale) : '—'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </TenantLayout>
    );
}
