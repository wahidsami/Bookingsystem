'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { AdminLayout } from '@/components/AdminLayout';
import { adminApi } from '@/lib/api';

// Mapping from formData field keys to FeaturePricing featureKeys (same as create)
const RESOURCE_PRICE_MAP: Record<string, { featureKey: string; multiplier?: number }> = {
    maxBookingsPerMonth: { featureKey: 'bookingsPerMonth' },
    maxStaff: { featureKey: 'maxStaff' },
    maxServices: { featureKey: 'maxServices' },
    maxProducts: { featureKey: 'maxProducts' },
    storageGB: { featureKey: 'storage', multiplier: 1024 },
};

const FEATURES_PRICE_MAP: Record<string, { featureKey: string; isBoolean?: boolean }> = {
    hasSubscriptionFee: { featureKey: 'subscriptionFee', isBoolean: true },
    hasProductsAndOrders: { featureKey: 'productsAndOrders', isBoolean: true },
    hasInternalMessaging: { featureKey: 'internalMessaging', isBoolean: true },
    whatsappNotifications: { featureKey: 'whatsappNotifications' },
    inAppMarketingNotifications: { featureKey: 'inAppMarketingNotifications' },
    aiContentAssistant: { featureKey: 'aiContentAssistant' },
    promotionalEmails: { featureKey: 'promotionalEmails' },
    searchRankingBoost: { featureKey: 'searchRankingBoost' },
    newToRefahDays: { featureKey: 'newToRefah' },
    maxHotDeals: { featureKey: 'hotDeals' },
};

const defaultFormData = {
    name: '',
    name_ar: '',
    slug: '',
    description: '',
    description_ar: '',
    platformCommission: '5.00',
    displayOrder: '0',
    isActive: true,
    isFeatured: false,
    maxBookingsPerMonth: '100',
    maxStaff: '5',
    maxServices: '20',
    maxProducts: '10',
    storageGB: '2',
    hasSubscriptionFee: true,
    hasProductsAndOrders: false,
    hasInternalMessaging: false,
    whatsappNotifications: '0',
    inAppMarketingNotifications: '0',
    aiContentAssistant: '0',
    promotionalEmails: '0',
    searchRankingBoost: '0',
    hasNewToRefah: false,
    newToRefahDays: '0',
    featuredCarousel: false,
    carouselPriority: 'low',
    maxHotDeals: '0',
    hotDealsAutoApprove: false,
    featuredProducts: '0'
};

export default function EditPackagePage() {
    const router = useRouter();
    const params = useParams();
    const packageId = params.id as string;

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [featurePrices, setFeaturePrices] = useState<Record<string, number>>({});
    const [formData, setFormData] = useState(defaultFormData);

    useEffect(() => {
        adminApi.getFeaturePricing().then((res) => {
            if (res.success) {
                const priceMap: Record<string, number> = {};
                res.features.forEach((f: any) => { priceMap[f.featureKey] = parseFloat(f.unitPrice); });
                setFeaturePrices(priceMap);
            }
        }).catch(() => {});
    }, []);

    useEffect(() => {
        if (!packageId) return;
        fetchPackage();
    }, [packageId]);

    const fetchPackage = async () => {
        try {
            const response = await adminApi.getPackage(packageId);
            const pkg = response.package;
            const limits = pkg.limits || {};

            const toStr = (v: any, def: string) => (v === undefined || v === null ? def : String(v));
            const toBool = (v: any, def: boolean) => (typeof v === 'boolean' ? v : def);

            setFormData({
                name: pkg.name || '',
                name_ar: pkg.name_ar || '',
                slug: pkg.slug || '',
                description: pkg.description || '',
                description_ar: pkg.description_ar || '',
                platformCommission: toStr(pkg.platformCommission, '5.00'),
                displayOrder: toStr(pkg.displayOrder, '0'),
                isActive: pkg.isActive !== false,
                isFeatured: pkg.isFeatured === true,
                maxBookingsPerMonth: toStr(limits.maxBookingsPerMonth, '100'),
                maxStaff: toStr(limits.maxStaff, '5'),
                maxServices: toStr(limits.maxServices, '20'),
                maxProducts: toStr(limits.maxProducts, '10'),
                storageGB: toStr(limits.storageGB, '2'),
                hasSubscriptionFee: toBool(limits.hasSubscriptionFee, true),
                hasProductsAndOrders: toBool(limits.hasProductsAndOrders, false),
                hasInternalMessaging: toBool(limits.hasInternalMessaging, false),
                whatsappNotifications: toStr(limits.whatsappNotifications, '0'),
                inAppMarketingNotifications: toStr(limits.inAppMarketingNotifications, '0'),
                aiContentAssistant: toStr(limits.aiContentAssistant, '0'),
                promotionalEmails: toStr(limits.promotionalEmails, '0'),
                searchRankingBoost: toStr(limits.searchRankingBoost, '0'),
                hasNewToRefah: toBool(limits.hasNewToRefah, false),
                newToRefahDays: toStr(limits.newToRefahDays, '0'),
                featuredCarousel: toBool(limits.featuredCarousel, false),
                carouselPriority: limits.carouselPriority || 'low',
                maxHotDeals: toStr(limits.maxHotDeals, '0'),
                hotDealsAutoApprove: toBool(limits.hotDealsAutoApprove, false),
                featuredProducts: toStr(limits.featuredProducts, '0')
            });
        } catch (error: any) {
            alert(error.message || 'Failed to fetch package');
        } finally {
            setFetching(false);
        }
    };

    const getFieldCost = (fieldKey: string): number => {
        const mapping = RESOURCE_PRICE_MAP[fieldKey];
        if (!mapping) return 0;
        const qty = parseInt((formData as any)[fieldKey] || '0');
        if (isNaN(qty) || qty <= 0) return 0;
        const unitPrice = featurePrices[mapping.featureKey] || 0;
        const multiplier = mapping.multiplier || 1;
        return qty * multiplier * unitPrice;
    };

    const resourceLimitsTotal = Object.keys(RESOURCE_PRICE_MAP).reduce((sum, key) => sum + getFieldCost(key), 0);

    const getFeatureItemCost = (fieldKey: string): number => {
        const mapping = FEATURES_PRICE_MAP[fieldKey];
        if (!mapping) return 0;
        const unitPrice = featurePrices[mapping.featureKey] || 0;
        if (mapping.isBoolean) {
            return (formData as any)[fieldKey] === true ? unitPrice : 0;
        } else if (fieldKey === 'newToRefahDays') {
            if (!formData.hasNewToRefah) return 0;
            const days = parseInt(formData.newToRefahDays || '0');
            return isNaN(days) || days <= 0 ? 0 : days * unitPrice;
        } else {
            const qty = parseInt((formData as any)[fieldKey] || '0');
            return isNaN(qty) || qty <= 0 ? 0 : qty * unitPrice;
        }
    };

    const featuresTotal = Object.keys(FEATURES_PRICE_MAP).reduce((sum, key) => sum + getFeatureItemCost(key), 0);

    const commissionPct = parseFloat(formData.platformCommission) || 0;
    const rawCostAmountA = resourceLimitsTotal + featuresTotal;
    const costWithCommissionAmountB = rawCostAmountA + (rawCostAmountA * (commissionPct / 100));
    const finalMonthlyPrice = costWithCommissionAmountB + (costWithCommissionAmountB * 0.15);
    const finalSixMonthPrice = (costWithCommissionAmountB * 6) + ((costWithCommissionAmountB * 6) * 0.15);
    const finalAnnualPrice = (costWithCommissionAmountB * 12) + ((costWithCommissionAmountB * 12) * 0.15);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const limits = {
                maxBookingsPerMonth: formData.maxBookingsPerMonth === '-1' ? -1 : parseInt(formData.maxBookingsPerMonth),
                maxStaff: formData.maxStaff === '-1' ? -1 : parseInt(formData.maxStaff),
                maxServices: formData.maxServices === '-1' ? -1 : parseInt(formData.maxServices),
                maxProducts: formData.maxProducts === '-1' ? -1 : parseInt(formData.maxProducts),
                storageGB: parseInt(formData.storageGB),
                hasSubscriptionFee: formData.hasSubscriptionFee,
                hasProductsAndOrders: formData.hasProductsAndOrders,
                hasInternalMessaging: formData.hasInternalMessaging,
                whatsappNotifications: parseInt(formData.whatsappNotifications) || 0,
                inAppMarketingNotifications: parseInt(formData.inAppMarketingNotifications) || 0,
                aiContentAssistant: parseInt(formData.aiContentAssistant) || 0,
                promotionalEmails: parseInt(formData.promotionalEmails) || 0,
                searchRankingBoost: parseInt(formData.searchRankingBoost) || 0,
                newToRefahDays: parseInt(formData.newToRefahDays) || 0,
                hasNewToRefah: formData.hasNewToRefah,
                featuredCarousel: formData.featuredCarousel,
                carouselPriority: formData.carouselPriority,
                maxHotDeals: formData.maxHotDeals === '-1' ? -1 : parseInt(formData.maxHotDeals),
                hotDealsAutoApprove: formData.hotDealsAutoApprove,
                featuredProducts: formData.featuredProducts === '-1' ? -1 : parseInt(formData.featuredProducts)
            };

            const payload = {
                name: formData.name,
                name_ar: formData.name_ar,
                slug: formData.slug,
                description: formData.description,
                description_ar: formData.description_ar,
                monthlyPrice: finalMonthlyPrice,
                sixMonthPrice: finalSixMonthPrice,
                annualPrice: finalAnnualPrice,
                platformCommission: parseFloat(formData.platformCommission),
                displayOrder: parseInt(formData.displayOrder),
                isActive: formData.isActive,
                isFeatured: formData.isFeatured,
                limits
            };

            await adminApi.updatePackage(packageId, payload);
            alert('Package updated successfully!');
            router.push('/dashboard/packages');
        } catch (error: any) {
            alert(error.message || 'Failed to update package');
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                        <p className="mt-4 text-dark-300">Loading package...</p>
                    </div>
                </div>
            </AdminLayout>
        );
    }

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
                    <h1 className="text-2xl font-bold text-white">Edit Package</h1>
                    <p className="text-dark-300 mt-1">Update subscription package — same form as create</p>
                </div>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-6">
                        <div className="bg-dark-800 rounded-lg shadow-md p-6 border border-dark-700">
                            <h2 className="text-lg font-semibold text-white mb-4">Basic Information</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-dark-300 mb-1">Name (English) *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-dark-300 mb-1">Name (Arabic) *</label>
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
                                        <label className="block text-sm font-medium text-dark-300 mb-1">Slug (URL-friendly) *</label>
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
                                        <label className="block text-sm font-medium text-dark-300 mb-1">Display Order</label>
                                        <input
                                            type="number"
                                            value={formData.displayOrder}
                                            onChange={(e) => setFormData({ ...formData, displayOrder: e.target.value })}
                                            className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-dark-300 mb-1">Description (English)</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows={2}
                                        className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-dark-300 mb-1">Description (Arabic)</label>
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

                        <div className="bg-dark-800 rounded-lg shadow-md p-6 border border-dark-700">
                            <h2 className="text-lg font-semibold text-white mb-4">Pricing Calculation (SAR)</h2>
                            <p className="text-sm text-dark-400 mb-6">Prices are automatically calculated from limits & features, plus the platform commission, and 15% VAT (ضريبة القيمة المضافة).</p>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-dark-300 mb-1">Platform Commission (%)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.platformCommission}
                                        onChange={(e) => setFormData({ ...formData, platformCommission: e.target.value })}
                                        className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    />
                                    <p className="text-xs text-dark-400 mt-1">This markup is added to the base cost before VAT.</p>
                                </div>
                                <div className="p-4 bg-dark-900 rounded-lg border border-dark-700 space-y-4">
                                    <div className="flex justify-between items-center pb-3 border-b border-dark-700">
                                        <div>
                                            <span className="text-sm font-medium text-white block">Monthly Price</span>
                                            <span className="text-xs text-dark-400">Includes 15% VAT</span>
                                        </div>
                                        <div className="text-xl font-bold text-green-400">SAR {finalMonthlyPrice.toFixed(2)}</div>
                                    </div>
                                    <div className="flex justify-between items-center pb-3 border-b border-dark-700">
                                        <div>
                                            <span className="text-sm font-medium text-white block">6-Month Price</span>
                                            <span className="text-xs text-dark-400">Includes 15% VAT</span>
                                        </div>
                                        <div className="text-lg font-bold text-purple-400">SAR {finalSixMonthPrice.toFixed(2)}</div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <span className="text-sm font-medium text-white block">Annual Price</span>
                                            <span className="text-xs text-dark-400">Includes 15% VAT</span>
                                        </div>
                                        <div className="text-lg font-bold text-purple-400">SAR {finalAnnualPrice.toFixed(2)}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

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

                    <div className="space-y-6">
                        <div className="bg-dark-800 rounded-lg shadow-md p-6 border border-dark-700">
                            <div className="flex items-center justify-between mb-1">
                                <h2 className="text-lg font-semibold text-white">Resource Limits</h2>
                                <span className="text-sm font-semibold px-3 py-1 rounded-full bg-purple-500/20 text-purple-300">
                                    Total: SAR {resourceLimitsTotal.toFixed(2)}
                                </span>
                            </div>
                            <p className="text-sm text-dark-400 mb-4">Use -1 for unlimited</p>
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { key: 'maxBookingsPerMonth', label: 'Bookings/Month' },
                                    { key: 'maxStaff', label: 'Max Staff' },
                                    { key: 'maxServices', label: 'Max Services' },
                                    { key: 'maxProducts', label: 'Max Products' },
                                    { key: 'storageGB', label: 'Storage (GB)' },
                                ].map((field) => {
                                    const qty = parseInt((formData as any)[field.key] || '0');
                                    const cost = getFieldCost(field.key);
                                    const isUnlimited = qty === -1;
                                    return (
                                        <div key={field.key}>
                                            <label className="block text-sm font-medium text-dark-300 mb-1">{field.label}</label>
                                            <input
                                                type="number"
                                                value={(formData as any)[field.key]}
                                                onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                                                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                            />
                                            <div className="mt-1 text-xs">
                                                {isUnlimited ? <span className="text-yellow-400">∞ Unlimited</span> : cost > 0 ? <span className="text-green-400">SAR {cost.toFixed(2)}</span> : <span className="text-dark-500">SAR 0.00</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="bg-dark-800 rounded-lg shadow-md p-6 border border-dark-700">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-white">Features</h2>
                                <span className="text-sm font-semibold px-3 py-1 rounded-full bg-purple-500/20 text-purple-300">
                                    Total: SAR {featuresTotal.toFixed(2)} / month
                                </span>
                            </div>
                            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-2 border-b border-dark-700 pb-6">
                                {[
                                    { key: 'hasSubscriptionFee', label: 'Subscription Fee' },
                                    { key: 'hasProductsAndOrders', label: 'Products & Orders (E-commerce)' },
                                    { key: 'hasInternalMessaging', label: 'Internal Messaging' },
                                ].map((feature) => {
                                    const cost = getFeatureItemCost(feature.key);
                                    return (
                                        <div key={feature.key} className="flex flex-col">
                                            <label className="flex items-center gap-2 cursor-pointer mb-1">
                                                <input
                                                    type="checkbox"
                                                    checked={(formData as any)[feature.key] as boolean}
                                                    onChange={(e) => setFormData({ ...formData, [feature.key]: e.target.checked })}
                                                    className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                                                />
                                                <span className="text-sm font-medium text-white">{feature.label}</span>
                                            </label>
                                            <div className="text-xs ml-6">
                                                {cost > 0 ? <span className="text-green-400">SAR {cost.toFixed(2)} / mo</span> : <span className="text-dark-500">SAR 0.00</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                    { key: 'whatsappNotifications', label: 'WhatsApp Notifications', desc: 'Max messages/mo' },
                                    { key: 'inAppMarketingNotifications', label: 'In-App Marketing Notifs', desc: 'Max messages/mo' },
                                    { key: 'aiContentAssistant', label: '✨ AI Content Assistant', desc: 'Tokens/mo (in thousands)' },
                                    { key: 'promotionalEmails', label: 'Promotional Emails', desc: 'Max emails/mo' },
                                    { key: 'searchRankingBoost', label: 'Search Ranking Boost', desc: 'Times boosted/mo' },
                                ].map((field) => {
                                    const cost = getFeatureItemCost(field.key);
                                    return (
                                        <div key={field.key} className="bg-dark-900/50 p-3 rounded-lg border border-dark-600/50">
                                            <label className="block text-sm font-medium text-white mb-2">
                                                {field.label}
                                                <span className="block text-xs text-dark-400 font-normal">{field.desc}</span>
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={(formData as any)[field.key]}
                                                onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                                                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                                            />
                                            <div className="mt-2 text-xs text-right">
                                                {cost > 0 ? <span className="text-green-400 font-medium">SAR {cost.toFixed(2)}</span> : <span className="text-dark-500">SAR 0.00</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div className="bg-dark-900/50 p-3 rounded-lg border border-dark-600/50">
                                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                                        <input
                                            type="checkbox"
                                            checked={formData.hasNewToRefah}
                                            onChange={(e) => setFormData({ ...formData, hasNewToRefah: e.target.checked })}
                                            className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                                        />
                                        <span className="text-sm font-medium text-white">New to Refah Tag</span>
                                    </label>
                                    <div className={`transition-opacity ${formData.hasNewToRefah ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                        <label className="block text-xs text-dark-400 mb-1">Duration (Days)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={formData.newToRefahDays}
                                            onChange={(e) => setFormData({ ...formData, newToRefahDays: e.target.value })}
                                            className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm"
                                            disabled={!formData.hasNewToRefah}
                                        />
                                        <div className="mt-2 text-xs text-right">
                                            {getFeatureItemCost('newToRefahDays') > 0 ? <span className="text-green-400 font-medium">SAR {getFeatureItemCost('newToRefahDays').toFixed(2)}</span> : <span className="text-dark-500">SAR 0.00</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-dark-800 rounded-lg shadow-md p-6 border border-dark-700">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-lg font-semibold text-white">Promotional Features</h2>
                                <span className="text-sm font-semibold px-3 py-1 rounded-full bg-purple-500/20 text-purple-300">
                                    Total: SAR {getFeatureItemCost('maxHotDeals').toFixed(2)} / mo
                                </span>
                            </div>
                            <p className="text-sm text-dark-400 mb-4">Features for mobile app visibility and marketing</p>
                            <div className="space-y-4">
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
                                            <label className="block text-sm font-medium text-dark-300 mb-1">Carousel Priority</label>
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
                                <div>
                                    <label className="block text-sm font-medium text-dark-300 mb-1">Max Hot Deals</label>
                                    <input
                                        type="number"
                                        value={formData.maxHotDeals}
                                        onChange={(e) => setFormData({ ...formData, maxHotDeals: e.target.value })}
                                        className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-purple-500"
                                        placeholder="0 = none, -1 = unlimited"
                                    />
                                    <div className="mt-1 text-xs mb-3">
                                        {parseInt(formData.maxHotDeals) === -1 ? <span className="text-yellow-400">∞ Unlimited</span> : getFeatureItemCost('maxHotDeals') > 0 ? <span className="text-green-400">SAR {getFeatureItemCost('maxHotDeals').toFixed(2)}</span> : <span className="text-dark-500">SAR 0.00</span>}
                                    </div>
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
                            </div>
                        </div>
                    </div>

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
                                    {loading ? 'Updating...' : 'Update Package'}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </AdminLayout>
    );
}
