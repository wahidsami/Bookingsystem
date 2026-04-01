'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { adminApi } from '@/lib/api';

interface HotDeal {
    id: string;
    title_en: string;
    title_ar: string;
    description_en?: string;
    description_ar?: string;
    discountType: 'percentage' | 'fixed_amount';
    discountValue: number;
    originalPrice: number;
    discountedPrice: number;
    validFrom: string;
    validUntil: string;
    maxRedemptions: number;
    currentRedemptions: number;
    status: 'pending' | 'active' | 'rejected' | 'expired';
    createdAt: string;
    tenant?: {
        id: string;
        businessNameEn: string;
        businessNameAr?: string;
    };
    service?: {
        id: string;
        name_en: string;
        name_ar?: string;
        finalPrice?: number;
        rawPrice?: number;
    };
}

export default function MarketingPage() {
    const [deals, setDeals] = useState<HotDeal[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);

    // Reject modal state
    const [rejectModal, setRejectModal] = useState<{ open: boolean; dealId: string | null; reason: string }>({
        open: false,
        dealId: null,
        reason: '',
    });

    // Toast notification
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        loadDeals();
    }, []);

    const loadDeals = async () => {
        setLoading(true);
        try {
            const response = await adminApi.getPendingHotDeals();
            if (response.success) {
                setDeals(response.deals || []);
            }
        } catch (error) {
            console.error('Failed to load pending hot deals:', error);
            showToast('Failed to load pending deals', 'error');
        } finally {
            setLoading(false);
        }
    };

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    const handleApprove = async (id: string) => {
        setProcessing(id);
        try {
            await adminApi.approveHotDeal(id);
            setDeals(prev => prev.filter(d => d.id !== id));
            showToast('Deal approved — it is now live on the mobile app! 🎉', 'success');
        } catch (error: any) {
            showToast(error.message || 'Failed to approve deal', 'error');
        } finally {
            setProcessing(null);
        }
    };

    const openRejectModal = (id: string) => {
        setRejectModal({ open: true, dealId: id, reason: '' });
    };

    const handleReject = async () => {
        if (!rejectModal.dealId || !rejectModal.reason.trim()) return;
        setProcessing(rejectModal.dealId);
        try {
            await adminApi.rejectHotDeal(rejectModal.dealId, rejectModal.reason.trim());
            setDeals(prev => prev.filter(d => d.id !== rejectModal.dealId));
            setRejectModal({ open: false, dealId: null, reason: '' });
            showToast('Deal rejected and tenant has been notified.', 'success');
        } catch (error: any) {
            showToast(error.message || 'Failed to reject deal', 'error');
        } finally {
            setProcessing(null);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const savings = (deal: HotDeal) =>
        deal.originalPrice > 0
            ? Math.round(((deal.originalPrice - deal.discountedPrice) / deal.originalPrice) * 100)
            : deal.discountValue;

    return (
        <AdminLayout>
            <div className="space-y-6 animate-fade-in">

                {/* Toast */}
                {toast && (
                    <div className={`fixed top-6 right-6 z-50 px-5 py-4 rounded-lg shadow-xl text-sm font-medium transition-all ${toast.type === 'success'
                            ? 'bg-green-500/20 border border-green-500/40 text-green-300'
                            : 'bg-red-500/20 border border-red-500/40 text-red-300'
                        }`}>
                        {toast.type === 'success' ? '✓ ' : '✕ '}{toast.message}
                    </div>
                )}

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white">🔥 Hot Deals Moderation</h1>
                        <p className="text-dark-400 text-sm mt-1">
                            Review and approve promotional deals submitted by tenants
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {deals.length > 0 && (
                            <span className="px-3 py-1 bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-sm rounded-full font-medium">
                                {deals.length} pending {deals.length === 1 ? 'review' : 'reviews'}
                            </span>
                        )}
                        <button onClick={loadDeals} className="btn btn-secondary btn-sm">
                            ↻ Refresh
                        </button>
                    </div>
                </div>

                {/* Loading */}
                {loading && (
                    <div className="card">
                        <div className="card-body flex items-center justify-center py-16">
                            <div className="spinner w-10 h-10" />
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!loading && deals.length === 0 && (
                    <div className="card">
                        <div className="card-body text-center py-20">
                            <div className="text-6xl mb-4">🎉</div>
                            <h3 className="text-xl font-semibold text-white mb-2">All caught up!</h3>
                            <p className="text-dark-400 text-sm max-w-sm mx-auto">
                                No hot deals are waiting for review right now. New submissions will appear here.
                            </p>
                        </div>
                    </div>
                )}

                {/* Deal Cards Grid */}
                {!loading && deals.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                        {deals.map((deal) => (
                            <div key={deal.id} className="card border border-dark-700 hover:border-yellow-500/40 transition-colors">
                                <div className="card-body space-y-4">

                                    {/* Deal Header */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-white text-base leading-tight truncate">
                                                {deal.title_en}
                                            </h3>
                                            {deal.title_ar && (
                                                <p className="text-xs text-dark-400 mt-0.5 truncate" dir="rtl">
                                                    {deal.title_ar}
                                                </p>
                                            )}
                                        </div>
                                        {/* Savings badge */}
                                        <span className="flex-shrink-0 px-2 py-1 bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold rounded-md">
                                            Save {savings(deal)}%
                                        </span>
                                    </div>

                                    {/* Tenant & Service */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="text-dark-400">By:</span>
                                            <span className="text-purple-400 font-medium">
                                                {deal.tenant?.businessNameEn ?? 'Unknown Tenant'}
                                            </span>
                                        </div>
                                        {deal.service && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="text-dark-400">Service:</span>
                                                <span className="text-dark-200">{deal.service.name_en}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Pricing */}
                                    <div className="bg-dark-900 rounded-lg p-3 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-dark-400">Discount</span>
                                            <span className="text-sm font-semibold text-orange-400">
                                                {deal.discountType === 'percentage'
                                                    ? `${deal.discountValue}% off`
                                                    : `${deal.discountValue} SAR off`}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-dark-400">Original Price</span>
                                            <span className="text-sm text-dark-300 line-through">
                                                {deal.originalPrice?.toFixed(2)} SAR
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between border-t border-dark-700 pt-1 mt-1">
                                            <span className="text-xs text-dark-400">Discounted Price</span>
                                            <span className="text-base font-bold text-green-400">
                                                {deal.discountedPrice?.toFixed(2)} SAR
                                            </span>
                                        </div>
                                    </div>

                                    {/* Validity & Redemptions */}
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div>
                                            <p className="text-dark-400 mb-0.5">Valid From</p>
                                            <p className="text-dark-200 font-medium">{formatDate(deal.validFrom)}</p>
                                        </div>
                                        <div>
                                            <p className="text-dark-400 mb-0.5">Expires</p>
                                            <p className="text-dark-200 font-medium">{formatDate(deal.validUntil)}</p>
                                        </div>
                                        <div>
                                            <p className="text-dark-400 mb-0.5">Max Redeem</p>
                                            <p className="text-dark-200 font-medium">
                                                {deal.maxRedemptions === -1 ? 'Unlimited' : deal.maxRedemptions}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-dark-400 mb-0.5">Submitted</p>
                                            <p className="text-dark-200 font-medium">{formatDate(deal.createdAt)}</p>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    {deal.description_en && (
                                        <p className="text-xs text-dark-400 italic leading-relaxed line-clamp-2">
                                            {deal.description_en}
                                        </p>
                                    )}

                                    {/* Actions */}
                                    <div className="flex gap-2 pt-1 border-t border-dark-700">
                                        <button
                                            onClick={() => handleApprove(deal.id)}
                                            disabled={processing === deal.id}
                                            className="flex-1 btn btn-success btn-sm disabled:opacity-50"
                                        >
                                            {processing === deal.id ? (
                                                <span className="flex items-center justify-center gap-1">
                                                    <div className="spinner w-3 h-3" /> Wait...
                                                </span>
                                            ) : '✓ Approve'}
                                        </button>
                                        <button
                                            onClick={() => openRejectModal(deal.id)}
                                            disabled={processing === deal.id}
                                            className="flex-1 btn btn-danger btn-sm disabled:opacity-50"
                                        >
                                            ✕ Reject
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Reject Modal */}
                {rejectModal.open && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-dark-800 border border-dark-600 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5">
                            <div>
                                <h2 className="text-lg font-semibold text-white">Reject Hot Deal</h2>
                                <p className="text-sm text-dark-400 mt-1">
                                    A mandatory rejection reason will be sent to the tenant.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-dark-300 mb-2">
                                    Reason for Rejection <span className="text-red-400">*</span>
                                </label>
                                <textarea
                                    rows={4}
                                    value={rejectModal.reason}
                                    onChange={e => setRejectModal(prev => ({ ...prev, reason: e.target.value }))}
                                    placeholder="e.g. The original price appears inflated. Please resubmit with accurate pricing."
                                    className="input w-full resize-none text-sm"
                                    autoFocus
                                />
                                <p className="text-xs text-dark-500 mt-1">
                                    {rejectModal.reason.trim().length}/250 characters
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setRejectModal({ open: false, dealId: null, reason: '' })}
                                    className="flex-1 btn btn-secondary"
                                    disabled={processing !== null}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleReject}
                                    disabled={!rejectModal.reason.trim() || processing !== null}
                                    className="flex-1 btn btn-danger disabled:opacity-50"
                                >
                                    {processing ? (
                                        <span className="flex items-center justify-center gap-1">
                                            <div className="spinner w-3 h-3" /> Rejecting...
                                        </span>
                                    ) : 'Confirm Rejection'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </AdminLayout>
    );
}
