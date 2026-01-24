'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TenantLayout } from '@/components/TenantLayout';
import { tenantApi } from '@/lib/api';

export default function NewHotDealPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [services, setServices] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        serviceId: '',
        title_en: '',
        title_ar: '',
        description_en: '',
        description_ar: '',
        discountType: 'percentage',
        discountValue: '',
        validFrom: new Date().toISOString().split('T')[0],
        validUntil: '',
        maxRedemptions: '50'
    });

    useEffect(() => {
        fetchServices();
    }, []);

    const fetchServices = async () => {
        try {
            const response = await tenantApi.getServices();
            setServices(response.services || []);
        } catch (error: any) {
            console.error('Error fetching services:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await tenantApi.createHotDeal({
                ...formData,
                discountValue: parseFloat(formData.discountValue),
                maxRedemptions: parseInt(formData.maxRedemptions)
            });
            alert('Hot deal created! It will be reviewed by admin.');
            router.push('/dashboard/hot-deals');
        } catch (error: any) {
            alert(error.message || 'Failed to create hot deal');
        } finally {
            setLoading(false);
        }
    };

    return (
        <TenantLayout>
            <div className="p-6 max-w-4xl">
                {/* Header */}
                <div className="mb-6">
                    <button
                        onClick={() => router.back()}
                        className="text-dark-400 hover:text-white mb-4"
                    >
                        ← Back to Hot Deals
                    </button>
                    <h1 className="text-2xl font-bold text-white">Create Hot Deal</h1>
                    <p className="text-dark-300 mt-1">Set up a promotional offer for your services</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Service Selection */}
                    <div className="bg-dark-800 rounded-lg shadow-md p-6 border border-dark-700">
                        <h2 className="text-lg font-semibold text-white mb-4">Service</h2>
                        <div>
                            <label className="block text-sm font-medium text-dark-300 mb-1">
                                Select Service *
                            </label>
                            <select
                                required
                                value={formData.serviceId}
                                onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
                                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="">Choose a service</option>
                                {services.map((service) => (
                                    <option key={service.id} value={service.id}>
                                        {service.name} - {service.price} SAR
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Deal Information */}
                    <div className="bg-dark-800 rounded-lg shadow-md p-6 border border-dark-700">
                        <h2 className="text-lg font-semibold text-white mb-4">Deal Information</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-dark-300 mb-1">
                                    Title (English) *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.title_en}
                                    onChange={(e) => setFormData({ ...formData, title_en: e.target.value })}
                                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                                    placeholder="e.g., Summer Haircut Special"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-dark-300 mb-1">
                                    Title (Arabic) *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.title_ar}
                                    onChange={(e) => setFormData({ ...formData, title_ar: e.target.value })}
                                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                                    dir="rtl"
                                    placeholder="مثال: عرض قصة صيفية خاصة"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-dark-300 mb-1">
                                    Description (English)
                                </label>
                                <textarea
                                    value={formData.description_en}
                                    onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
                                    rows={2}
                                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                                    placeholder="Brief description of your offer"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-dark-300 mb-1">
                                    Description (Arabic)
                                </label>
                                <textarea
                                    value={formData.description_ar}
                                    onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })}
                                    rows={2}
                                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                                    dir="rtl"
                                    placeholder="وصف موجز لعرضك"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Discount Settings */}
                    <div className="bg-dark-800 rounded-lg shadow-md p-6 border border-dark-700">
                        <h2 className="text-lg font-semibold text-white mb-4">Discount Settings</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-dark-300 mb-1">
                                    Discount Type *
                                </label>
                                <select
                                    value={formData.discountType}
                                    onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                                >
                                    <option value="percentage">Percentage (%)</option>
                                    <option value="fixed_amount">Fixed Amount (SAR)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-dark-300 mb-1">
                                    Discount Value *
                                </label>
                                <input
                                    type="number"
                                    required
                                    step="0.01"
                                    value={formData.discountValue}
                                    onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                                    placeholder={formData.discountType === 'percentage' ? '20' : '50'}
                                />
                                <p className="text-xs text-dark-400 mt-1">
                                    Maximum 50% discount allowed
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Validity Period */}
                    <div className="bg-dark-800 rounded-lg shadow-md p-6 border border-dark-700">
                        <h2 className="text-lg font-semibold text-white mb-4">Validity Period</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-dark-300 mb-1">
                                    Valid From *
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={formData.validFrom}
                                    onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-dark-300 mb-1">
                                    Valid Until *
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={formData.validUntil}
                                    onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-dark-300 mb-1">
                                    Max Redemptions
                                </label>
                                <input
                                    type="number"
                                    value={formData.maxRedemptions}
                                    onChange={(e) => setFormData({ ...formData, maxRedemptions: e.target.value })}
                                    className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                                    placeholder="50"
                                />
                                <p className="text-xs text-dark-400 mt-1">
                                    Maximum number of times this deal can be used. Use -1 for unlimited.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Submit Buttons */}
                    <div className="bg-dark-800 rounded-lg shadow-md p-6 border border-dark-700">
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="px-6 py-2 border border-dark-600 rounded-lg text-dark-300 hover:bg-dark-700"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                            >
                                {loading ? 'Creating...' : 'Create Hot Deal'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </TenantLayout>
    );
}
