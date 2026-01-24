'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { TenantLayout } from '@/components/TenantLayout';
import { tenantApi } from '@/lib/api';

export default function HotDealsPage() {
    const router = useRouter();
    const params = useParams();
    const locale = (params?.locale as string) || 'ar';
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
            // Handle response - check if data is wrapped
            const data = response.data || response;
            setCanCreate(data.canCreate ?? false);
            setPackageLimits(data.limits || null);
        } catch (error: any) {
            console.error('Error checking limits:', error);
            // On error, allow creation but show warning
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
            <div className="p-6">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Hot Deals & Offers</h1>
                        <p className="text-dark-300 mt-1">Create and manage promotional offers for the mobile app</p>
                    </div>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            router.push(`/${locale}/dashboard/hot-deals/new`);
                        }}
                        disabled={!canCreate && packageLimits !== null}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        + Create Hot Deal
                    </button>
                </div>

                {/* Package Limits Info */}
                {packageLimits && (
                    <div className="bg-dark-800 rounded-lg shadow-md p-4 border border-dark-700 mb-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-dark-400">Your Package</p>
                                <p className="text-white font-semibold">{packageLimits.packageName}</p>
                            </div>
                            <div>
                                <p className="text-sm text-dark-400">Hot Deals Limit</p>
                                <p className="text-white font-semibold">
                                    {deals.length} / {packageLimits.maxHotDeals === -1 ? '∞' : packageLimits.maxHotDeals}
                                </p>
                            </div>
                            {packageLimits.autoApprove && (
                                <div className="px-3 py-1 bg-green-500/10 text-green-500 rounded text-sm">
                                    ✓ Auto-Approved
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                    </div>
                )}

                {/* Empty State */}
                {!loading && deals.length === 0 && (
                    <div className="bg-dark-800 rounded-lg shadow-md p-12 border border-dark-700 text-center">
                        <div className="text-6xl mb-4">🔥</div>
                        <h3 className="text-xl font-semibold text-white mb-2">No hot deals yet</h3>
                        <p className="text-dark-300 mb-4">Create your first promotional offer to attract more customers</p>
                        {(canCreate || packageLimits === null) && (
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    router.push(`/${locale}/dashboard/hot-deals/new`);
                                }}
                                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                            >
                                Create Your First Deal
                            </button>
                        )}
                    </div>
                )}

                {/* Deals List */}
                {!loading && deals.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {deals.map((deal) => (
                            <div key={deal.id} className="bg-dark-800 rounded-lg shadow-md p-6 border border-dark-700 hover:border-purple-500 transition">
                                {/* Status Badge */}
                                <div className="flex justify-between items-start mb-4">
                                    <span className={`px-2 py-1 text-xs rounded ${getStatusBadge(deal.status)}`}>
                                        {deal.status.toUpperCase()}
                                    </span>
                                    {deal.status === 'active' && (
                                        <span className="text-xs text-dark-400">
                                            {deal.redemptionCount || 0} / {deal.maxRedemptions === -1 ? '∞' : deal.maxRedemptions} used
                                        </span>
                                    )}
                                </div>

                                {/* Deal Info */}
                                <h3 className="text-lg font-semibold text-white mb-2">{deal.title_en}</h3>
                                <p className="text-sm text-dark-300 mb-4">{deal.service?.name}</p>

                                {/* Pricing */}
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="text-2xl font-bold text-green-500">{deal.discountedPrice} SAR</span>
                                    <span className="text-sm text-dark-400 line-through">{deal.originalPrice} SAR</span>
                                    <span className="px-2 py-1 bg-red-500/10 text-red-500 text-xs rounded">
                                        -{deal.discountType === 'percentage' ? `${deal.discountValue}%` : `${deal.discountValue} SAR`}
                                    </span>
                                </div>

                                {/* Valid Period */}
                                <div className="text-xs text-dark-400 mb-4">
                                    Valid: {new Date(deal.validFrom).toLocaleDateString()} - {new Date(deal.validUntil).toLocaleDateString()}
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => router.push(`/${locale}/dashboard/hot-deals/${deal.id}`)}
                                        className="flex-1 px-3 py-2 bg-dark-700 text-white rounded hover:bg-dark-600 text-sm"
                                    >
                                        View Details
                                    </button>
                                    {deal.status === 'pending' && (
                                        <button
                                            className="px-3 py-2 bg-dark-700 text-dark-400 rounded text-sm"
                                            disabled
                                        >
                                            Pending Review
                                        </button>
                                    )}
                                </div>

                                {/* Rejection Reason */}
                                {deal.status === 'rejected' && deal.rejectionReason && (
                                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded">
                                        <p className="text-xs text-red-400">
                                            <strong>Rejected:</strong> {deal.rejectionReason}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </TenantLayout>
    );
}
