'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/AdminLayout';
import { adminApi } from '@/lib/api';

export default function NewPackagePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        name_ar: '',
        slug: '',
        description: '',
        description_ar: '',
        monthlyPrice: '',
        sixMonthPrice: '',
        annualPrice: '',
        platformCommission: '5.00',
        displayOrder: '0',
        isActive: true,
        isFeatured: false,
        // Limits
        maxBookingsPerMonth: '100',
        maxStaff: '5',
        maxServices: '20',
        maxProducts: '10',
        storageGB: '2',
        // Features
        hasAdvancedReports: false,
        hasWhatsAppNotifications: false,
        hasSMSNotifications: false,
        hasEmailNotifications: true,
        hasVoiceNotifications: false,
        hasMultiLocation: false,
        hasInventoryManagement: false,
        hasLoyaltyProgram: false,
        hasGiftCards: false,
        hasOnlinePayments: true,
        hasCustomBranding: false,
        hasAPIAccess: false,
        hasPrioritySupport: false,
        hasDedicatedAccountManager: false,
        // Promotional Features
        featuredCarousel: false,
        carouselPriority: 'low',
        maxHotDeals: '0',
        hotDealsAutoApprove: false,
        searchRankingBoost: 'standard',
        homepageBanner: false,
        featuredProducts: '0',
        pushNotifications: false,
        emailMarketing: false,
        advancedAnalytics: false,
        prioritySupport: false
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Build limits object
            const limits = {
                maxBookingsPerMonth: formData.maxBookingsPerMonth === '-1' ? -1 : parseInt(formData.maxBookingsPerMonth),
                maxStaff: formData.maxStaff === '-1' ? -1 : parseInt(formData.maxStaff),
                maxServices: formData.maxServices === '-1' ? -1 : parseInt(formData.maxServices),
                maxProducts: formData.maxProducts === '-1' ? -1 : parseInt(formData.maxProducts),
                storageGB: parseInt(formData.storageGB),
                hasAdvancedReports: formData.hasAdvancedReports,
                hasWhatsAppNotifications: formData.hasWhatsAppNotifications,
                hasSMSNotifications: formData.hasSMSNotifications,
                hasEmailNotifications: formData.hasEmailNotifications,
                hasVoiceNotifications: formData.hasVoiceNotifications,
                hasMultiLocation: formData.hasMultiLocation,
                hasInventoryManagement: formData.hasInventoryManagement,
                hasLoyaltyProgram: formData.hasLoyaltyProgram,
                hasGiftCards: formData.hasGiftCards,
                hasOnlinePayments: formData.hasOnlinePayments,
                hasCustomBranding: formData.hasCustomBranding,
                hasAPIAccess: formData.hasAPIAccess,
                hasPrioritySupport: formData.hasPrioritySupport,
                hasDedicatedAccountManager: formData.hasDedicatedAccountManager,
                // Promotional Features
                featuredCarousel: formData.featuredCarousel,
                carouselPriority: formData.carouselPriority,
                maxHotDeals: formData.maxHotDeals === '-1' ? -1 : parseInt(formData.maxHotDeals),
                hotDealsAutoApprove: formData.hotDealsAutoApprove,
                searchRankingBoost: formData.searchRankingBoost,
                homepageBanner: formData.homepageBanner,
                featuredProducts: formData.featuredProducts === '-1' ? -1 : parseInt(formData.featuredProducts),
                pushNotifications: formData.pushNotifications,
                emailMarketing: formData.emailMarketing,
                advancedAnalytics: formData.advancedAnalytics,
                prioritySupport: formData.prioritySupport
            };

            const payload = {
                name: formData.name,
                name_ar: formData.name_ar,
                slug: formData.slug,
                description: formData.description,
                description_ar: formData.description_ar,
                monthlyPrice: parseFloat(formData.monthlyPrice),
                sixMonthPrice: parseFloat(formData.sixMonthPrice),
                annualPrice: parseFloat(formData.annualPrice),
                platformCommission: parseFloat(formData.platformCommission),
                displayOrder: parseInt(formData.displayOrder),
                isActive: formData.isActive,
                isFeatured: formData.isFeatured,
                limits
            };

            await adminApi.createPackage(payload);
            alert('Package created successfully!');
            router.push('/dashboard/packages');
        } catch (error: any) {
            alert(error.message || 'Failed to create package');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AdminLayout>
            <div className="p-6">
                <div className="mb-6">
                    <button
                        onClick={() => router.back()}
                        className="text-dark-400 hover:text-white mb-4"
                    >
                        ← Back to Packages
                    </button>
                    <h1 className="text-2xl font-bold text-white">Create New Package</h1>
                    <p className="text-dark-300 mt-1">Define a new subscription package</p>
                </div>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column */}
                    <div className="space-y-6">
                        {/* Basic Information */}
                        <div className="bg-dark-800 rounded-lg shadow-md p-6 border border-dark-700">
                            <h2 className="text-lg font-semibold text-white mb-4">Basic Information</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-dark-300 mb-1">
                                        Name (English) *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-dark-300 mb-1">
                                        Name (Arabic) *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name_ar}
                                        onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                                        className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        dir="rtl"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-dark-300 mb-1">
                                            Slug (URL-friendly) *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.slug}
                                            onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                                            className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                            placeholder="e.g., premium-plus"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-dark-300 mb-1">
                                            Display Order
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.displayOrder}
                                            onChange={(e) => setFormData({ ...formData, displayOrder: e.target.value })}
                                            className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-dark-300 mb-1">
                                        Description (English)
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows={2}
                                        className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                                        className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        dir="rtl"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Pricing */}
                        <div className="bg-dark-800 rounded-lg shadow-md p-6 border border-dark-700">
                            <h2 className="text-lg font-semibold text-white mb-4">Pricing (SAR)</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-dark-300 mb-1">
                                        Monthly Price *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={formData.monthlyPrice}
                                        onChange={(e) => setFormData({ ...formData, monthlyPrice: e.target.value })}
                                        className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-dark-300 mb-1">
                                        6-Month Price *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={formData.sixMonthPrice}
                                        onChange={(e) => setFormData({ ...formData, sixMonthPrice: e.target.value })}
                                        className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    />
                                    <p className="text-xs text-dark-400 mt-1">Recommended: Monthly × 6 × 0.9 (10% off)</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-dark-300 mb-1">
                                        Annual Price *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={formData.annualPrice}
                                        onChange={(e) => setFormData({ ...formData, annualPrice: e.target.value })}
                                        className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    />
                                    <p className="text-xs text-dark-400 mt-1">Recommended: Monthly × 12 × 0.83 (17% off)</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-dark-300 mb-1">
                                        Platform Commission (%)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.platformCommission}
                                        onChange={(e) => setFormData({ ...formData, platformCommission: e.target.value })}
                                        className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Status */}
                        <div className="bg-dark-800 rounded-lg shadow-md p-6 border border-dark-700">
                            <h2 className="text-lg font-semibold text-white mb-4">Status</h2>
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.isActive}
                                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                        className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                                    />
                                    <span className="text-sm text-dark-300">Active (available for new subscriptions)</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.isFeatured}
                                        onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                                        className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                                    />
                                    <span className="text-sm text-dark-300">Featured (Most Popular badge)</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                        {/* Limits */}
                        <div className="bg-dark-800 rounded-lg shadow-md p-6 border border-dark-700">
                            <h2 className="text-lg font-semibold text-white mb-4">Resource Limits</h2>
                            <p className="text-sm text-dark-400 mb-4">Use -1 for unlimited</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-dark-300 mb-1">
                                        Bookings/Month
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.maxBookingsPerMonth}
                                        onChange={(e) => setFormData({ ...formData, maxBookingsPerMonth: e.target.value })}
                                        className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-dark-300 mb-1">
                                        Max Staff
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.maxStaff}
                                        onChange={(e) => setFormData({ ...formData, maxStaff: e.target.value })}
                                        className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-dark-300 mb-1">
                                        Max Services
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.maxServices}
                                        onChange={(e) => setFormData({ ...formData, maxServices: e.target.value })}
                                        className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-dark-300 mb-1">
                                        Max Products
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.maxProducts}
                                        onChange={(e) => setFormData({ ...formData, maxProducts: e.target.value })}
                                        className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-dark-300 mb-1">
                                        Storage (GB)
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.storageGB}
                                        onChange={(e) => setFormData({ ...formData, storageGB: e.target.value })}
                                        className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Features */}
                        <div className="bg-dark-800 rounded-lg shadow-md p-6 border border-dark-700">
                            <h2 className="text-lg font-semibold text-white mb-4">Features</h2>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { key: 'hasAdvancedReports', label: 'Advanced Reports' },
                                    { key: 'hasWhatsAppNotifications', label: 'WhatsApp Notifications' },
                                    { key: 'hasSMSNotifications', label: 'SMS Notifications' },
                                    { key: 'hasEmailNotifications', label: 'Email Notifications' },
                                    { key: 'hasVoiceNotifications', label: 'Voice Notifications' },
                                    { key: 'hasMultiLocation', label: 'Multi-Location' },
                                    { key: 'hasInventoryManagement', label: 'Inventory Management' },
                                    { key: 'hasLoyaltyProgram', label: 'Loyalty Program' },
                                    { key: 'hasGiftCards', label: 'Gift Cards' },
                                    { key: 'hasOnlinePayments', label: 'Online Payments' },
                                    { key: 'hasCustomBranding', label: 'Custom Branding' },
                                    { key: 'hasAPIAccess', label: 'API Access' },
                                    { key: 'hasPrioritySupport', label: 'Priority Support' },
                                    { key: 'hasDedicatedAccountManager', label: 'Account Manager' },
                                ].map((feature) => (
                                    <label key={feature.key} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData[feature.key as keyof typeof formData] as boolean}
                                            onChange={(e) => setFormData({ ...formData, [feature.key]: e.target.checked })}
                                            className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                                        />
                                        <span className="text-sm text-dark-300">{feature.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Promotional Features */}
                        <div className="bg-dark-800 rounded-lg shadow-md p-6 border border-dark-700">
                            <h2 className="text-lg font-semibold text-white mb-2">Promotional Features</h2>
                            <p className="text-sm text-dark-400 mb-4">Features for mobile app visibility and marketing</p>
                            <div className="space-y-4">
                                {/* Featured Carousel */}
                                <div className="pb-4 border-b border-dark-700">
                                    <label className="flex items-center gap-2 cursor-pointer mb-3">
                                        <input
                                            type="checkbox"
                                            checked={formData.featuredCarousel}
                                            onChange={(e) => setFormData({ ...formData, featuredCarousel: e.target.checked })}
                                            className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                                        />
                                        <span className="text-sm font-medium text-white">Featured in Home Carousel</span>
                                    </label>
                                    {formData.featuredCarousel && (
                                        <div className="ml-6">
                                            <label className="block text-sm font-medium text-dark-300 mb-1">
                                                Carousel Priority
                                            </label>
                                            <select
                                                value={formData.carouselPriority}
                                                onChange={(e) => setFormData({ ...formData, carouselPriority: e.target.value })}
                                                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                                            >
                                                <option value="low">Low (appears less often)</option>
                                                <option value="medium">Medium (balanced rotation)</option>
                                                <option value="high">High (appears more often)</option>
                                            </select>
                                        </div>
                                    )}
                                </div>

                                {/* Hot Deals */}
                                <div className="pb-4 border-b border-dark-700">
                                    <label className="block text-sm font-medium text-dark-300 mb-1">
                                        Max Hot Deals
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.maxHotDeals}
                                        onChange={(e) => setFormData({ ...formData, maxHotDeals: e.target.value })}
                                        className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-purple-500"
                                        placeholder="0 = none, -1 = unlimited"
                                    />
                                    {parseInt(formData.maxHotDeals) > 0 && (
                                        <label className="flex items-center gap-2 cursor-pointer mt-2">
                                            <input
                                                type="checkbox"
                                                checked={formData.hotDealsAutoApprove}
                                                onChange={(e) => setFormData({ ...formData, hotDealsAutoApprove: e.target.checked })}
                                                className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                                            />
                                            <span className="text-sm text-dark-300">Auto-Approve Hot Deals</span>
                                        </label>
                                    )}
                                </div>

                                {/* Search Ranking */}
                                <div className="pb-4 border-b border-dark-700">
                                    <label className="block text-sm font-medium text-dark-300 mb-1">
                                        Search Ranking Boost
                                    </label>
                                    <select
                                        value={formData.searchRankingBoost}
                                        onChange={(e) => setFormData({ ...formData, searchRankingBoost: e.target.value })}
                                        className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                                    >
                                        <option value="standard">Standard (algorithm-based)</option>
                                        <option value="boosted">Boosted (higher in results)</option>
                                        <option value="top">Top Priority (always on top)</option>
                                    </select>
                                </div>

                                {/* Marketing Features Grid */}
                                <div className="grid grid-cols-2 gap-3">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.homepageBanner}
                                            onChange={(e) => setFormData({ ...formData, homepageBanner: e.target.checked })}
                                            className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                                        />
                                        <span className="text-sm text-dark-300">Homepage Banner Ads</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.pushNotifications}
                                            onChange={(e) => setFormData({ ...formData, pushNotifications: e.target.checked })}
                                            className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                                        />
                                        <span className="text-sm text-dark-300">Push Notifications</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.emailMarketing}
                                            onChange={(e) => setFormData({ ...formData, emailMarketing: e.target.checked })}
                                            className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                                        />
                                        <span className="text-sm text-dark-300">Email Marketing</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.advancedAnalytics}
                                            onChange={(e) => setFormData({ ...formData, advancedAnalytics: e.target.checked })}
                                            className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                                        />
                                        <span className="text-sm text-dark-300">Advanced Analytics</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.prioritySupport}
                                            onChange={(e) => setFormData({ ...formData, prioritySupport: e.target.checked })}
                                            className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                                        />
                                        <span className="text-sm text-dark-300">Priority Support</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Submit Buttons - Full Width */}
                    <div className="lg:col-span-2">
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
                                    {loading ? 'Creating...' : 'Create Package'}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </AdminLayout>
    );
}

