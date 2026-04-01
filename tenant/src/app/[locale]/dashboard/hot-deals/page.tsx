'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { TenantLayout } from '@/components/TenantLayout';
import { tenantApi, getImageUrl } from '@/lib/api';
import { useTranslations } from 'next-intl';

export default function HotDealsPage() {
    const router = useRouter();
    const params = useParams();
    const locale = (params?.locale as string) || 'ar';
    const t = useTranslations('hotDeals');
    const isRTL = locale === 'ar';

    const [loading, setLoading] = useState(true);
    const [deals, setDeals] = useState<any[]>([]);
    const [canCreate, setCanCreate] = useState(false);
    const [packageLimits, setPackageLimits] = useState<any>(null);

    useEffect(() => {
        fetchDeals();
        checkLimits();
    }, []);

    const fetchDeals = async () => {
        try {
            const response = await tenantApi.getMyHotDeals();
            setDeals(response.deals || []);
        } catch (error: any) {
            console.error('Error fetching deals:', error);
        } finally {
            setLoading(false);
        }
    };

    const checkLimits = async () => {
        try {
            const response = await tenantApi.checkHotDealsLimits();
            const data = response.data || response;
            setCanCreate(data.canCreate ?? false);
            setPackageLimits(data.limits || null);
        } catch (error: any) {
            console.error('Error checking limits:', error);
            setCanCreate(true);
            setPackageLimits(null);
        }
    };

    const getStatusBadge = (status: string) => {
        const badges: Record<string, string> = {
            pending: 'bg-yellow-500/10 text-yellow-500',
            active: 'bg-green-500/10 text-green-500',
            rejected: 'bg-red-500/10 text-red-500',
            expired: 'bg-gray-500/10 text-gray-500'
        };
        return badges[status] || badges.pending;
    };

    return (
        <TenantLayout>
            <div className={`p-6 animate-fade-in ${isRTL ? 'text-right' : 'text-left'}`}>
                {/* Header */}
                <div className={`flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4 ${isRTL ? 'md:flex-row-reverse' : ''}`}>
                    <div>
                        <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
                        <p className="text-dark-300 mt-1">{t('subtitle')}</p>
                    </div>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            router.push(`/${locale}/dashboard/hot-deals/new`);
                        }}
                        disabled={!canCreate && packageLimits !== null}
                        className="px-6 py-2.5 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-purple-900/20 whitespace-nowrap"
                    >
                        + {t('createDeal')}
                    </button>
                </div>

                {/* Package Limits Info */}
                {packageLimits && (
                    <div className="bg-dark-800 rounded-lg shadow-md p-5 border border-dark-700 mb-6 hover:border-dark-600 transition-colors">
                        <div className={`flex flex-wrap items-center gap-6 md:gap-12 ${isRTL ? 'flex-row-reverse' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
                            <div>
                                <p className="text-sm font-medium text-dark-400 mb-1">{t('package')}</p>
                                <p className="text-white font-semibold flex items-center gap-2">
                                    <span className="text-purple-400">❖</span>
                                    {packageLimits.packageName}
                                </p>
                            </div>
                            <div className="h-10 w-px bg-dark-700 hidden md:block"></div>
                            <div>
                                <p className="text-sm font-medium text-dark-400 mb-1">{t('dealsLimit')}</p>
                                <p className="text-white font-semibold">
                                    <span className="text-purple-400">{deals.length}</span> / {packageLimits.maxHotDeals === -1 ? t('unlimited') : packageLimits.maxHotDeals}
                                </p>
                            </div>
                            {packageLimits.autoApprove && (
                                <>
                                    <div className="h-10 w-px bg-dark-700 hidden md:block"></div>
                                    <div className="px-3 py-1.5 bg-green-500/10 border border-green-500/20 text-green-400 rounded-md text-sm font-medium flex items-center gap-2">
                                        ⚡ {t('autoApproved')}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500"></div>
                    </div>
                )}

                {/* Empty State */}
                {!loading && deals.length === 0 && (
                    <div className="bg-dark-800 rounded-lg shadow-md p-16 border border-dark-700 text-center flex flex-col items-center">
                        <div className="w-20 h-20 bg-dark-900 rounded-full flex items-center justify-center mb-6 border-4 border-dark-800 shadow-xl">
                            <span className="text-4xl text-purple-400">🔥</span>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">{t('noDealsYet')}</h3>
                        <p className="text-dark-300 mb-8 max-w-sm">{t('noDealsDesc')}</p>
                        {(canCreate || packageLimits === null) && (
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    router.push(`/${locale}/dashboard/hot-deals/new`);
                                }}
                                className="px-8 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-500 transition-colors shadow-lg shadow-purple-900/20"
                            >
                                {t('createNewDeal')}
                            </button>
                        )}
                    </div>
                )}

                {/* Deals List */}
                {!loading && deals.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" dir={isRTL ? 'rtl' : 'ltr'}>
                        {deals.map((deal) => {
                            const title = isRTL ? deal.title_ar : deal.title_en;
                            const serviceName = deal.service ? (isRTL ? deal.service.name_ar : deal.service.name_en) : '';
                            const statusKey = deal.status as any;

                            return (
                                <div key={deal.id} className="bg-dark-800 rounded-xl shadow-lg border border-dark-700 hover:border-purple-500/50 transition-all duration-300 overflow-hidden group flex flex-col">

                                    {/* Thumbnail Image Header */}
                                    <div className="h-40 w-full bg-dark-900 relative">
                                        {deal.image ? (
                                            <img
                                                src={getImageUrl(deal.image)}
                                                alt={title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/40 to-dark-900">
                                                <span className="text-4xl opacity-20">🔥</span>
                                            </div>
                                        )}

                                        {/* Overlay Badges */}
                                        <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
                                            <span className={`px-2.5 py-1 text-[11px] font-bold tracking-wider rounded border border-white/10 shadow-sm backdrop-blur-sm ${getStatusBadge(deal.status)}`}>
                                                {t(`status.${statusKey}`)}
                                            </span>

                                            <div className="px-2.5 py-1 bg-red-500/90 backdrop-blur-sm text-white text-xs font-bold rounded shadow-sm border border-red-400/30">
                                                {deal.discountType === 'percentage' ? `-${deal.discountValue}%` : `-${deal.discountValue} SAR`}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-5 flex-1 flex flex-col">
                                        {/* Deal Info */}
                                        <h3 className="text-lg font-bold text-white mb-1 line-clamp-1">{title}</h3>
                                        <p className="text-sm font-medium text-purple-400 mb-4 line-clamp-1">{serviceName}</p>

                                        {/* Pricing */}
                                        <div className="flex items-baseline gap-3 mb-4">
                                            <span className="text-2xl font-black text-white">{deal.discountedPrice} <span className="text-sm text-dark-400 font-medium">SAR</span></span>
                                            <span className="text-sm text-dark-500 font-medium line-through">{deal.originalPrice} SAR</span>
                                        </div>

                                        {/* Limits & Validity */}
                                        <div className="space-y-2 mb-6 flex-1">
                                            {deal.status === 'active' && (
                                                <div className="flex items-center gap-2 text-xs font-medium text-dark-300 bg-dark-900/50 p-2 rounded">
                                                    <span className="text-purple-400">⚡</span>
                                                    {deal.redemptionCount || 0} / {deal.maxRedemptions === -1 ? t('unlimited') : deal.maxRedemptions} {t('used')}
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2 text-xs font-medium text-dark-300 bg-dark-900/50 p-2 rounded">
                                                <span className="text-dark-400">📅</span>
                                                {t('valid')}: {new Date(deal.validFrom).toLocaleDateString(locale)} - {new Date(deal.validUntil).toLocaleDateString(locale)}
                                            </div>
                                        </div>

                                        {/* Rejection Reason */}
                                        {deal.status === 'rejected' && deal.rejectionReason && (
                                            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                                <p className="text-xs font-medium text-red-400">
                                                    <strong>{t('rejectedReason')}:</strong> {deal.rejectionReason}
                                                </p>
                                            </div>
                                        )}

                                        {/* Actions */}
                                        <div className="flex gap-3 justify-end pt-4 border-t border-dark-700">
                                            {deal.status === 'pending' && (
                                                <button className="flex-1 px-4 py-2 bg-dark-700/50 text-yellow-500/70 font-medium rounded-lg text-sm border border-yellow-500/10 cursor-not-allowed">
                                                    {t('pendingReview')}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => router.push(`/${locale}/dashboard/hot-deals/${deal.id}`)}
                                                className={`px-6 py-2 bg-dark-700 text-white font-medium rounded-lg hover:bg-dark-600 transition-colors text-sm ${deal.status !== 'pending' ? 'flex-1' : ''}`}
                                            >
                                                {t('viewDetails')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </TenantLayout>
    );
}
