'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TenantLayout } from '@/components/TenantLayout';
import { tenantApi } from '@/lib/api';

export default function HotDealDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'ar';
  const hotDealId = params?.id as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deal, setDeal] = useState<any>(null);

  useEffect(() => {
    const loadDeal = async () => {
      if (!hotDealId) {
        setError('Hot deal was not found.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await tenantApi.getHotDeal(hotDealId);
        const dealData = response?.data || response?.deal || response;

        if (!dealData?.id) {
          throw new Error('Hot deal details are unavailable.');
        }

        setDeal(dealData);
      } catch (err: any) {
        setError(err.message || 'Failed to load hot deal details.');
      } finally {
        setLoading(false);
      }
    };

    loadDeal();
  }, [hotDealId]);

  const goBack = () => router.push(`/${locale}/dashboard/hot-deals`);

  const getStatusBadge = (status?: string) => {
    const normalizedStatus = status || 'pending';
    const badgeMap: Record<string, string> = {
      pending: 'bg-yellow-500/10 text-yellow-500',
      active: 'bg-green-500/10 text-green-500',
      rejected: 'bg-red-500/10 text-red-500',
      expired: 'bg-gray-500/10 text-gray-500'
    };

    return badgeMap[normalizedStatus] || badgeMap.pending;
  };

  return (
    <TenantLayout>
      <div className="p-6 max-w-4xl">
        <button
          onClick={goBack}
          className="text-dark-400 hover:text-white mb-4"
        >
          ← Back to Hot Deals
        </button>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
          </div>
        )}

        {!loading && error && (
          <div className="bg-dark-800 rounded-lg shadow-md p-8 border border-dark-700">
            <h1 className="text-2xl font-bold text-white mb-2">Hot Deal Details</h1>
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={goBack}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Back to List
            </button>
          </div>
        )}

        {!loading && !error && deal && (
          <div className="space-y-6">
            <div className="bg-dark-800 rounded-lg shadow-md p-6 border border-dark-700">
              <div className="flex justify-between items-start gap-4 mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-white">{deal.title_en || deal.title_ar || 'Hot Deal'}</h1>
                  <p className="text-dark-300 mt-1">{deal.title_ar || deal.title_en || ''}</p>
                </div>
                <span className={`px-3 py-1 text-xs rounded ${getStatusBadge(deal.status)}`}>
                  {(deal.status || 'pending').toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="bg-dark-700 rounded-lg p-4">
                  <p className="text-dark-400 mb-1">Service</p>
                  <p className="text-white font-semibold">{deal.service?.name || deal.serviceName || 'Not linked'}</p>
                </div>
                <div className="bg-dark-700 rounded-lg p-4">
                  <p className="text-dark-400 mb-1">Pricing</p>
                  <p className="text-white font-semibold">
                    {deal.discountedPrice} SAR
                    <span className="text-dark-400 line-through ml-2">{deal.originalPrice} SAR</span>
                  </p>
                </div>
                <div className="bg-dark-700 rounded-lg p-4">
                  <p className="text-dark-400 mb-1">Discount</p>
                  <p className="text-white font-semibold">
                    {deal.discountType === 'percentage'
                      ? `${deal.discountValue}%`
                      : `${deal.discountValue} SAR`}
                  </p>
                </div>
                <div className="bg-dark-700 rounded-lg p-4">
                  <p className="text-dark-400 mb-1">Redemptions</p>
                  <p className="text-white font-semibold">
                    {deal.redemptionCount || 0} / {deal.maxRedemptions === -1 ? '∞' : deal.maxRedemptions}
                  </p>
                </div>
                <div className="bg-dark-700 rounded-lg p-4">
                  <p className="text-dark-400 mb-1">Valid From</p>
                  <p className="text-white font-semibold">{new Date(deal.validFrom).toLocaleDateString()}</p>
                </div>
                <div className="bg-dark-700 rounded-lg p-4">
                  <p className="text-dark-400 mb-1">Valid Until</p>
                  <p className="text-white font-semibold">{new Date(deal.validUntil).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-dark-800 rounded-lg shadow-md p-6 border border-dark-700">
              <h2 className="text-lg font-semibold text-white mb-4">Descriptions</h2>
              <div className="space-y-4">
                <div className="bg-dark-700 rounded-lg p-4">
                  <p className="text-dark-400 mb-1">English</p>
                  <p className="text-white">{deal.description_en || 'No English description provided.'}</p>
                </div>
                <div className="bg-dark-700 rounded-lg p-4">
                  <p className="text-dark-400 mb-1">Arabic</p>
                  <p className="text-white">{deal.description_ar || 'No Arabic description provided.'}</p>
                </div>
              </div>

              {deal.status === 'rejected' && deal.rejectionReason && (
                <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
                  <p className="text-red-400 text-sm">
                    <strong>Rejection reason:</strong> {deal.rejectionReason}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </TenantLayout>
  );
}
