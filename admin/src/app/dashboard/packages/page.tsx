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
    monthlyPrice: string;
    sixMonthPrice: string;
    annualPrice: string;
    sixMonthPerMonth: number;
    annualPerMonth: number;
    sixMonthSavings: number;
    annualSavings: number;
    platformCommission: string;
    displayOrder: number;
    isActive: boolean;
    isFeatured: boolean;
    isCustom: boolean;
    limits: any;
    createdAt: string;
    updatedAt: string;
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
                        className={`bg-white rounded-lg shadow-md overflow-hidden border-2 ${
                            pkg.isFeatured ? 'border-purple-500' : 'border-gray-200'
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

                            {/* Pricing */}
                            <div className="mb-6">
                                <div className="mb-3">
                                    <div className="text-2xl font-bold text-gray-900">
                                        <Currency amount={parseFloat(pkg.monthlyPrice)} />
                                    </div>
                                    <div className="text-sm text-gray-500">per month</div>
                                </div>

                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">6 Months:</span>
                                        <span className="font-semibold">
                                            <Currency amount={pkg.sixMonthPerMonth} />/mo
                                        </span>
                                    </div>
                                    {pkg.sixMonthSavings > 0 && (
                                        <div className="text-green-600 text-xs">
                                            Save <Currency amount={pkg.sixMonthSavings} />
                                        </div>
                                    )}

                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Annual:</span>
                                        <span className="font-semibold">
                                            <Currency amount={pkg.annualPerMonth} />/mo
                                        </span>
                                    </div>
                                    {pkg.annualSavings > 0 && (
                                        <div className="text-green-600 text-xs">
                                            Save <Currency amount={pkg.annualSavings} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Key Limits */}
                            <div className="border-t border-gray-200 pt-4 mb-4">
                                <h4 className="text-xs font-semibold text-gray-700 mb-2">KEY LIMITS</h4>
                                <ul className="space-y-1 text-sm text-gray-600">
                                    <li>
                                        Bookings: {pkg.limits.maxBookingsPerMonth === -1 ? 'Unlimited' : pkg.limits.maxBookingsPerMonth}/mo
                                    </li>
                                    <li>
                                        Staff: {pkg.limits.maxStaff === -1 ? 'Unlimited' : pkg.limits.maxStaff}
                                    </li>
                                    <li>
                                        Services: {pkg.limits.maxServices === -1 ? 'Unlimited' : pkg.limits.maxServices}
                                    </li>
                                    <li>
                                        Commission: {pkg.platformCommission}%
                                    </li>
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
                                    className={`flex-1 px-4 py-2 rounded-lg text-sm ${
                                        pkg.isActive
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

