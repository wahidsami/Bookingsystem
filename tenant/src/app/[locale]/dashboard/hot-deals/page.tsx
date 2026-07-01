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
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

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

    const refreshData = async () => {
        await Promise.all([fetchDeals(), checkLimits()]);
    };

    const handleDealAction = async (dealId: string, action: 'pause' | 'publish') => {
        try {
            setActionLoadingId(dealId);
            if (action === 'pause') {
                await tenantApi.pauseHotDeal(dealId);
            } else {
                await tenantApi.resumeHotDeal(dealId);
            }
            await refreshData();
        } catch (error) {
            console.error(`Failed to ${action} hot deal:`, error);
        } finally {
            setActionLoadingId(null);
        }
    };

    const getStatusBadge = (status: string) => {
        const badges: Record<string, string> = {
            pending: 'bg-yellow-500/10 text-yellow-500',
            active: 'bg-green-500/10 text-green-500',
            paused: 'bg-sky-500/10 text-sky-400',
            rejected: 'bg-red-500/10 text-red-500',
            expired: 'bg-gray-500/10 text-gray-500'
        };
        return badges[status] || badges.pending;
    };

    return (
        <TenantLayout>
            <div className="space-y-6 bg-slate-950 text-slate-100" dir={isRTL ? 'rtl' : 'ltr'}>
                <section className="overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 shadow-[0_28px_100px_rgba(2,6,23,0.45)]">
                    <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-end lg:justify-between lg:p-8">
                        <div className="max-w-2xl">
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-xs font-semibold text-fuchsia-200">
                                <span>🔥</span>
                                {t('title')}
                            </div>
                            <h1 className="text-3xl font-black tracking-tight text-white lg:text-4xl">{t('title')}</h1>
                            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">{t('subtitle')}</p>
                        </div>
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                router.push(`/${locale}/dashboard/hot-deals/new`);
                            }}
                            disabled={!canCreate && packageLimits !== null}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <span>+</span>
                            {t('createDeal')}
                        </button>
                    </div>

                    <div className="grid gap-4 border-t border-white/10 p-6 sm:grid-cols-3 lg:p-8">
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{t('package')}</p>
                            <p className="mt-3 text-lg font-bold text-white">{packageLimits?.packageName || '—'}</p>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{t('dealsLimit')}</p>
                            <p className="mt-3 text-lg font-bold text-white">
                                <span className="text-fuchsia-300">{deals.length}</span> / {packageLimits?.maxHotDeals === -1 ? t('unlimited') : packageLimits?.maxHotDeals ?? '—'}
                            </p>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{t('autoApproved')}</p>
                            <p className="mt-3 text-lg font-bold text-white">{packageLimits?.autoApprove ? 'Enabled' : '—'}</p>
                        </div>
                    </div>
                </section>

                {loading && (
                    <div className="flex justify-center rounded-[28px] border border-white/10 bg-slate-900 py-20">
                        <div className="h-11 w-11 animate-spin rounded-full border-2 border-fuchsia-400/20 border-t-fuchsia-400" />
                    </div>
                )}

                {!loading && deals.length === 0 && (
                    <div className="rounded-[28px] border border-white/10 bg-slate-900 px-6 py-16 text-center shadow-[0_20px_80px_rgba(2,6,23,0.35)]">
                        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-4xl">
                            🔥
                        </div>
                        <h3 className="text-2xl font-bold text-white">{t('noDealsYet')}</h3>
                        <p className="mx-auto mt-3 max-w-md text-sm text-slate-400">{t('noDealsDesc')}</p>
                        {(canCreate || packageLimits === null) && (
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    router.push(`/${locale}/dashboard/hot-deals/new`);
                                }}
                                className="mt-8 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/20 transition hover:brightness-110"
                            >
                                {t('createNewDeal')}
                            </button>
                        )}
                    </div>
                )}

                {!loading && deals.length > 0 && (
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                        {deals.map((deal) => {
                            const title = isRTL ? deal.title_ar : deal.title_en;
                            const serviceName = deal.service ? (isRTL ? deal.service.name_ar : deal.service.name_en) : '';
                            const statusKey = deal.status as any;

                            return (
                                <article key={deal.id} className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900 shadow-[0_20px_80px_rgba(2,6,23,0.35)]">
                                    <div className="relative h-44 bg-slate-950">
                                        {deal.image ? (
                                            <img
                                                src={getImageUrl(deal.image)}
                                                alt={title}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-fuchsia-900/40 to-slate-950">
                                                <span className="text-5xl opacity-20">🔥</span>
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                                        <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-3">
                                            <span className={`rounded-full border border-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] backdrop-blur ${getStatusBadge(deal.status)}`}>
                                                {t(`status.${statusKey}`)}
                                            </span>
                                            <span className="rounded-full border border-rose-400/20 bg-rose-500/90 px-3 py-1 text-xs font-bold text-white">
                                                {deal.discountType === 'percentage' ? `-${deal.discountValue}%` : `-${deal.discountValue} SAR`}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="p-6">
                                        <h3 className="text-xl font-black text-white">{title}</h3>
                                        <p className="mt-1 text-sm font-medium text-fuchsia-300">{serviceName}</p>

                                        <div className="mt-5 flex items-baseline gap-3">
                                            <span className="text-3xl font-black text-white">
                                                {deal.discountedPrice}
                                                <span className="ml-2 text-sm font-medium text-slate-400">SAR</span>
                                            </span>
                                            <span className="text-sm font-medium text-slate-500 line-through">{deal.originalPrice} SAR</span>
                                        </div>

                                        <div className="mt-5 space-y-2">
                                            {deal.status === 'active' && (
                                                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-medium text-slate-300">
                                                    {deal.redemptionCount || 0} / {deal.maxRedemptions === -1 ? t('unlimited') : deal.maxRedemptions} {t('used')}
                                                </div>
                                            )}
                                            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-medium text-slate-300">
                                                {t('valid')}: {new Date(deal.validFrom).toLocaleDateString(locale)} - {new Date(deal.validUntil).toLocaleDateString(locale)}
                                            </div>
                                        </div>

                                        {deal.status === 'rejected' && deal.rejectionReason && (
                                            <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4">
                                                <p className="text-xs font-medium text-rose-200">
                                                    <strong>{t('rejectedReason')}:</strong> {deal.rejectionReason}
                                                </p>
                                            </div>
                                        )}

                                        <div className="mt-6 flex flex-wrap gap-3">
                                            {deal.status === 'pending' && (
                                                <button className="flex-1 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-200">
                                                    {t('pendingReview')}
                                                </button>
                                            )}
                                            {deal.status === 'active' && (
                                                <button
                                                    onClick={() => handleDealAction(deal.id, 'pause')}
                                                    disabled={actionLoadingId === deal.id}
                                                    className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    {actionLoadingId === deal.id ? (isRTL ? 'جاري...' : 'Loading...') : t('pause')}
                                                </button>
                                            )}
                                            {deal.status === 'paused' && (
                                                <button
                                                    onClick={() => handleDealAction(deal.id, 'publish')}
                                                    disabled={actionLoadingId === deal.id}
                                                    className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    {actionLoadingId === deal.id ? (isRTL ? 'جاري...' : 'Loading...') : t('publish')}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => router.push(`/${locale}/dashboard/hot-deals/${deal.id}`)}
                                                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                                            >
                                                {t('viewDetails')}
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>
        </TenantLayout>
    );
}
