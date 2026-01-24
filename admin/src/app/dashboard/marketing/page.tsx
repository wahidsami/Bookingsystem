'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/AdminLayout';
import { adminApi } from '@/lib/api';

export default function HotDealsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [hotDeals, setHotDeals] = useState<any[]>([]);

    useEffect(() => {
        fetchPendingDeals();
    }, []);

    const fetchPendingDeals = async () => {
        try {
            const response = await adminApi.getPendingHotDeals();
            setHotDeals(response.deals || []);
        } catch (error: any) {
            console.error('Error fetching deals:', error);
            alert(error.message || 'Failed to fetch hot deals');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (dealId: string) => {
        if (!confirm('Approve this hot deal?')) return;

        try {
            await adminApi.approveHotDeal(dealId);
            alert('Hot deal approved!');
            fetchPendingDeals();
        } catch (error: any) {
            alert(error.message || 'Failed to approve deal');
        }
    };

    const handleReject = async (dealId: string) => {
        const reason = prompt('Rejection reason:');
        if (!reason) return;

        try {
            await adminApi.rejectHotDeal(dealId, reason);
            alert('Hot deal rejected');
            fetchPendingDeals();
        } catch (error: any) {
            alert(error.message || 'Failed to reject deal');
        }
    };

    return (
        <AdminLayout>
            <div className="p-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-white">Hot Deals Approval</h1>
                    <p className="text-dark-300 mt-1">Review and approve tenant promotional offers</p>
                </div>

                {/* Loading */}
                {loading && (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                    </div>
                )}

                {/* Empty State */}
                {!loading && hotDeals.length === 0 && (
                    <div className="bg-dark-800 rounded-lg shadow-md p-12 border border-dark-700 text-center">
                        <div className="text-6xl mb-4">🎉</div>
                        <h3 className="text-xl font-semibold text-white mb-2">All caught up!</h3>
                        <p className="text-dark-300">No pending hot deals to review</p>
                    </div>
                )}

                {/* Hot Deals List */}
                {!loading && hotDeals.length > 0 && (
                    <div className="space-y-4">
                        {hotDeals.map((deal) => (
                            <div key={deal.id} className="bg-dark-800 rounded-lg shadow-md p-6 border border-dark-700">
                                <div className="flex justify-between items-start">
                                    {/* Deal Info */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-3">
                                            <h3 className="text-lg font-semibold text-white">{deal.title_en}</h3>
                                            <span className="px-2 py-1 bg-yellow-500/10 text-yellow-500 text-xs rounded">
                                                Pending Approval
                                            </span>
                                        </div>

                                        {/* Tenant Info */}
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="text-sm text-dark-400">By:</span>
                                            <span className="text-sm text-white font-medium">
                                                {deal.tenant?.businessNameEn}
                                            </span>
                                        </div>

                                        {/* Service Info */}
                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <p className="text-xs text-dark-400">Service</p>
                                                <p className="text-sm text-white">{deal.service?.name}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-dark-400">Discount</p>
                                                <p className="text-sm text-white">
                                                    {deal.discountType === 'percentage'
                                                        ? `${deal.discountValue}%`
                                                        : `${deal.discountValue} SAR`}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-dark-400">Original Price</p>
                                                <p className="text-sm text-white">{deal.originalPrice} SAR</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-dark-400">Discounted Price</p>
                                                <p className="text-sm text-green-500 font-semibold">
                                                    {deal.discountedPrice} SAR
                                                </p>
                                            </div>
                                        </div>

                                        {/* Description */}
                                        {deal.description_en && (
                                            <div className="mb-4">
                                                <p className="text-xs text-dark-400 mb-1">Description</p>
                                                <p className="text-sm text-dark-300">{deal.description_en}</p>
                                            </div>
                                        )}

                                        {/* Valid Period */}
                                        <div className="flex gap-4 text-xs text-dark-400">
                                            <span>Valid from: {new Date(deal.validFrom).toLocaleDateString()}</span>
                                            <span>Until: {new Date(deal.validUntil).toLocaleDateString()}</span>
                                            {deal.maxRedemptions > 0 && (
                                                <span>Max: {deal.maxRedemptions} bookings</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-2 ml-4">
                                        <button
                                            onClick={() => handleApprove(deal.id)}
                                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                                        >
                                            ✓ Approve
                                        </button>
                                        <button
                                            onClick={() => handleReject(deal.id)}
                                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                                        >
                                            ✗ Reject
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
