"use client";

import { useState, useEffect } from "react";
import { api, Tenant } from "@/lib/api";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function TenantsPage() {
    const { isAuthenticated } = useAuth();
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        loadTenants();
    }, [search]);

    const loadTenants = async () => {
        try {
            setLoading(true);
            const response = await api.get<{ success: boolean; tenants: Tenant[] }>(
                `/tenants${search ? `?search=${encodeURIComponent(search)}` : ""}`
            );
            if (response.success) {
                setTenants(response.tenants || []);
            }
        } catch (error) {
            console.error("Failed to load tenants:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-6">
                            <h1 className="text-2xl font-bold text-gray-900">Browse Salons & Spas</h1>
                            <Link
                                href="/"
                                className="text-sm font-medium text-gray-600 hover:text-primary transition-colors"
                            >
                                Home
                            </Link>
                        </div>
                        <div className="flex items-center gap-3">
                            {isAuthenticated ? (
                                <>
                                    <Link
                                        href="/dashboard"
                                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        My Dashboard
                                    </Link>
                                </>
                            ) : (
                                <Link
                                    href="/login"
                                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                                >
                                    Sign In
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Search */}
                <div className="mb-8">
                    <input
                        type="text"
                        placeholder="Search salons and spas..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full max-w-md px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                </div>

                {/* Tenants Grid */}
                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                        <p className="mt-4 text-gray-600">Loading salons...</p>
                    </div>
                ) : tenants.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-gray-600">No salons found</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {tenants.map((tenant) => (
                            <Link
                                key={tenant.id}
                                href={`/tenant/${tenant.slug}`}
                                className="group bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200 hover:shadow-2xl hover:border-primary/50 transition-all duration-300 transform hover:-translate-y-1"
                            >
                                {/* Logo Section */}
                                <div className="relative h-56 bg-gradient-to-br from-primary/5 to-secondary/5 flex items-center justify-center p-8">
                                    {tenant.logo ? (
                                        <img
                                            src={`http://localhost:5000${tenant.logo}`}
                                            alt={tenant.name}
                                            className="max-w-full max-h-full object-contain drop-shadow-lg"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.style.display = 'none';
                                            }}
                                        />
                                    ) : (
                                        <div className="w-32 h-32 bg-primary/10 rounded-full flex items-center justify-center">
                                            <span className="text-5xl font-bold text-primary">
                                                {tenant.name.charAt(0)}
                                            </span>
                                        </div>
                                    )}
                                    {/* Availability Badge */}
                                    {(tenant as any).isAvailable !== undefined && (
                                        <span className={`absolute top-4 right-4 px-3 py-1.5 text-xs font-semibold rounded-full shadow-sm flex items-center gap-1.5 ${
                                            (tenant as any).isAvailable 
                                                ? 'bg-green-100 text-green-800' 
                                                : 'bg-gray-100 text-gray-600'
                                        }`}>
                                            <span className={`w-2 h-2 rounded-full ${
                                                (tenant as any).isAvailable ? 'bg-green-500' : 'bg-gray-400'
                                            }`}></span>
                                            {(tenant as any).isAvailable ? 'Available Now' : 'Closed'}
                                        </span>
                                    )}
                                </div>

                                {/* Content Section */}
                                <div className="p-6">
                                    <div className="mb-4">
                                        <h3 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-primary transition-colors">
                                            {tenant.name}
                                        </h3>
                                        <p className="text-sm text-gray-500">{tenant.slug}</p>
                                    </div>
                                    {/* Stats */}
                                    <div className="flex items-center gap-6 mb-4">
                                        {tenant.servicesCount !== undefined && (
                                            <div className="flex items-center gap-2">
                                                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                </svg>
                                                <span className="text-sm font-medium text-gray-700">
                                                    {tenant.servicesCount} Services
                                                </span>
                                            </div>
                                        )}
                                        {tenant.staffCount !== undefined && (
                                            <div className="flex items-center gap-2">
                                                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                </svg>
                                                <span className="text-sm font-medium text-gray-700">
                                                    {tenant.staffCount} Staff
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Book Now Button */}
                                    <div className="mt-6 pt-4 border-t border-gray-100">
                                        <div className="flex items-center justify-between text-primary font-semibold group-hover:text-primary-dark transition-colors">
                                            <span>Book Now</span>
                                            <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

