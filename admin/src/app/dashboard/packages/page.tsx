'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/AdminLayout';
import { adminApi } from '@/lib/api';
import { Currency } from '@/components/Currency';

interface Package {
    id: string;
    name: string;
    name_ar: string;
    slug: string;
    description: string;
    description_ar: string;
    monthlyPrice: string | number;
    sixMonthPrice: string | number;
    annualPrice: string | number;
    sixMonthPerMonth?: number;
    annualPerMonth?: number;
    sixMonthSavings?: number;
    annualSavings?: number;
    platformCommission: string;
    displayOrder: number;
    isActive: boolean;
    isFeatured: boolean;
    isCustom: boolean;
    limits: any;
    createdAt: string;
    updatedAt: string;
}

/** Build key limits/features list for card: only show when value is "included" (number > 0 or boolean true) */
function getKeyLimitsList(limits: any): { label: string; value: string }[] {
    if (!limits || typeof limits !== 'object') return [];
    const list: { label: string; value: string }[] = [];
    const n = (v: any) => (typeof v === 'number' ? v : parseInt(String(v), 10));
    const isIncludedNum = (v: any) => !Number.isNaN(n(v)) && n(v) > 0;
    const hasUnlimited = (v: any) => v === -1 || v === '-1';

    // Resource limits (always show)
    if (limits.maxBookingsPerMonth !== undefined && limits.maxBookingsPerMonth !== null)
        list.push({ label: 'Bookings', value: hasUnlimited(limits.maxBookingsPerMonth) ? 'Unlimited /mo' : `${limits.maxBookingsPerMonth} /mo` });
    if (limits.maxStaff !== undefined && limits.maxStaff !== null)
        list.push({ label: 'Staff', value: hasUnlimited(limits.maxStaff) ? 'Unlimited' : `${limits.maxStaff} members` });
    if (limits.maxServices !== undefined && limits.maxServices !== null)
        list.push({ label: 'Services', value: hasUnlimited(limits.maxServices) ? 'Unlimited' : `${limits.maxServices}` });
    if (limits.maxProducts !== undefined && limits.maxProducts !== null)
        list.push({ label: 'Products', value: hasUnlimited(limits.maxProducts) ? 'Unlimited' : `${limits.maxProducts}` });
    if (limits.storageGB !== undefined && limits.storageGB !== null && n(limits.storageGB) >= 0)
        list.push({ label: 'Storage', value: `${limits.storageGB} GB` });

    // Boolean features — only list if true (included)
    if (limits.hasSubscriptionFee === true) list.push({ label: 'Subscription fee', value: 'Included' });
    if (limits.hasProductsAndOrders === true) list.push({ label: 'Products & orders', value: 'Included' });
    if (limits.hasInternalMessaging === true) list.push({ label: 'Internal messaging', value: 'Included' });
    if (limits.hasNewToRefah === true)
        list.push({ label: 'New to Refah', value: limits.newToRefahDays ? `${limits.newToRefahDays} days` : 'Included' });
    if (limits.featuredCarousel === true)
        list.push({ label: 'Featured carousel', value: limits.carouselPriority ? `${limits.carouselPriority}` : 'Included' });
    if (limits.hotDealsAutoApprove === true) list.push({ label: 'Hot deals auto-approve', value: 'Included' });

    // Numeric features — only list if > 0 (included)
    if (isIncludedNum(limits.whatsappNotifications)) list.push({ label: 'WhatsApp notifications', value: `${limits.whatsappNotifications} /mo` });
    if (isIncludedNum(limits.inAppMarketingNotifications)) list.push({ label: 'In-app marketing', value: `${limits.inAppMarketingNotifications} /mo` });
    if (isIncludedNum(limits.aiContentAssistant)) list.push({ label: 'AI content assistant', value: `${limits.aiContentAssistant} tokens` });
    if (isIncludedNum(limits.promotionalEmails)) list.push({ label: 'Promotional emails', value: `${limits.promotionalEmails} /mo` });
    if (isIncludedNum(limits.searchRankingBoost)) list.push({ label: 'Search ranking boost', value: `${limits.searchRankingBoost} /mo` });
    if (limits.maxHotDeals !== undefined && limits.maxHotDeals !== null && n(limits.maxHotDeals) !== 0)
        list.push({ label: 'Hot deals', value: hasUnlimited(limits.maxHotDeals) ? 'Unlimited' : `${limits.maxHotDeals}` });
    if (limits.featuredProducts !== undefined && limits.featuredProducts !== null && (n(limits.featuredProducts) > 0 || hasUnlimited(limits.featuredProducts)))
        list.push({ label: 'Featured products', value: hasUnlimited(limits.featuredProducts) ? 'Unlimited' : `${limits.featuredProducts}` });

    return list;
}

export default function PackagesPage() {
    const router = useRouter();
    const [packages, setPackages] = useState<Package[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInactive, setShowInactive] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        fetchPackages();
    }, [showInactive]);

    const fetchPackages = async () => {
        try {
            const response = await adminApi.getPackages(showInactive);
            setPackages(response.packages);
        } catch (error) {
            console.error('Failed to fetch packages:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePackage = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await adminApi.deletePackage(id);
            alert('Package deleted successfully');
            fetchPackages();
        } catch (error: any) {
            alert(error.message || 'Failed to delete package');
        }
    };

    const handleToggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            await adminApi.updatePackage(id, {
                isActive: !currentStatus
            });
            fetchPackages();
        } catch (error: any) {
            alert(error.message || 'Failed to update package');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading packages...</p>
                </div>
            </div>
        );
    }

    return (
        <AdminLayout>
            <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Subscription Packages</h1>
                        <p className="text-gray-600 mt-1">Manage subscription plans and pricing</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowInactive(!showInactive)}
                            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                            {showInactive ? 'Hide' : 'Show'} Inactive
                        </button>
                        <button
                            onClick={() => router.push('/dashboard/packages/new')}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                        >
                            + Create Package
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {packages.map((pkg) => (
                        <div
                            key={pkg.id}
                            className={`bg-white rounded-lg shadow-md overflow-hidden border-2 ${pkg.isFeatured ? 'border-purple-500' : 'border-gray-200'
                                } ${!pkg.isActive ? 'opacity-60' : ''}`}
                        >
                            {pkg.isFeatured && (
                                <div className="bg-purple-600 text-white text-center py-1 text-sm font-semibold">
                                    Most Popular
                                </div>
                            )}

                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900">{pkg.name}</h3>
                                        <p className="text-sm text-gray-500">{pkg.name_ar}</p>
                                    </div>
                                    {!pkg.isActive && (
                                        <span className="px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded">
                                            Inactive
                                        </span>
                                    )}
                                </div>

                                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{pkg.description}</p>

                                {/* Pricing — one value per row: monthly, then 6-month total, then annual total */}
                                <div className="mb-6">
                                    <div className="mb-3">
                                        <div className="text-2xl font-bold text-gray-900">
                                            <Currency amount={parseFloat(String(pkg.monthlyPrice))} />
                                        </div>
                                        <div className="text-sm text-gray-500">per month</div>
                                        <div className="text-xs text-purple-600 mt-1 font-medium bg-purple-50 inline-block px-2 py-0.5 rounded">
                                            Includes 15% VAT (ضريبة القيمة المضافة)
                                        </div>
                                    </div>

                                    {/* Totals only — no duplicate per-month line; use stored totals or derive from monthly if stored value looks like per-month */}
                                    {(() => {
                                        const monthly = parseFloat(String(pkg.monthlyPrice)) || 0;
                                        let sixTotal = parseFloat(String(pkg.sixMonthPrice)) || 0;
                                        let annualTotal = parseFloat(String(pkg.annualPrice)) || 0;
                                        const isSixMonthLikelyPerMonth = monthly > 0 && sixTotal > 0 && Math.abs(sixTotal - monthly) < Math.max(monthly * 0.2, 1);
                                        const isAnnualLikelyPerMonth = monthly > 0 && annualTotal > 0 && Math.abs(annualTotal - monthly) < Math.max(monthly * 0.2, 1);
                                        if (isSixMonthLikelyPerMonth) sixTotal = Math.round(monthly * 6 * 100) / 100;
                                        if (isAnnualLikelyPerMonth) annualTotal = Math.round(monthly * 12 * 100) / 100;
                                        return (
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between items-center">
                                                    <div className="flex flex-col">
                                                        <span className="text-gray-600">6 Months total</span>
                                                        <span className="text-[10px] text-gray-400">inc. VAT</span>
                                                    </div>
                                                    <span className="font-semibold text-gray-900">
                                                        <Currency amount={sixTotal} />
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <div className="flex flex-col">
                                                        <span className="text-gray-600">Annual total</span>
                                                        <span className="text-[10px] text-gray-400">inc. VAT</span>
                                                    </div>
                                                    <span className="font-semibold text-gray-900">
                                                        <Currency amount={annualTotal} />
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Key Limits & Features — only show when included (value > 0 or true) */}
                                <div className="border-t border-gray-200 pt-4 mb-4">
                                    <h4 className="text-xs font-semibold text-gray-700 mb-2">KEY LIMITS & FEATURES</h4>
                                    <ul className="space-y-1 text-sm text-gray-600">
                                        {(() => {
                                            const keyLimits = getKeyLimitsList(pkg.limits);
                                            return keyLimits.length > 0 ? (
                                                keyLimits.map((item, i) => (
                                                    <li key={i}>
                                                        <span className="font-medium text-gray-700">{item.label}:</span> {item.value}
                                                    </li>
                                                ))
                                            ) : (
                                                <li className="text-gray-500 italic">No limits defined</li>
                                            );
                                        })()}
                                    </ul>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => router.push(`/dashboard/packages/${pkg.id}`)}
                                        className="flex-1 px-4 py-2 border border-purple-500 rounded-lg text-purple-500 hover:bg-purple-500 hover:text-white text-sm transition-colors"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleToggleStatus(pkg.id, pkg.isActive)}
                                        className={`flex-1 px-4 py-2 rounded-lg text-sm ${pkg.isActive
                                                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                                            }`}
                                    >
                                        {pkg.isActive ? 'Deactivate' : 'Activate'}
                                    </button>
                                    {!pkg.isCustom && (
                                        <button
                                            onClick={() => handleDeletePackage(pkg.id, pkg.name)}
                                            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {packages.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-gray-500 mb-4">No packages found</p>
                        <button
                            onClick={() => router.push('/dashboard/packages/new')}
                            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                        >
                            Create Your First Package
                        </button>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

