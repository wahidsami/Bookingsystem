"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { BRANDING } from "@/config/branding";

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const { t, isRTL } = useLanguage();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const navigation = [
        { name: t("nav.dashboard"), href: "/dashboard", icon: "📊" },
        { name: t("nav.profile"), href: "/dashboard/profile", icon: "👤" },
        { name: t("nav.bookings"), href: "/dashboard/bookings", icon: "📅" },
        { name: t("nav.purchases"), href: "/dashboard/purchases", icon: "🛍️" },
        { name: t("nav.payments"), href: "/dashboard/payments", icon: "💳" },
        { name: t("nav.paymentMethods"), href: "/dashboard/payment-methods", icon: "💳" },
        { name: t("nav.wallet"), href: "/dashboard/wallet", icon: "💰" },
        { name: t("nav.settings"), href: "/dashboard/settings", icon: "⚙️" },
    ];

    const isActive = (href: string) => {
        if (href === "/dashboard") {
            return pathname === "/dashboard";
        }
        return pathname?.startsWith(href);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
            {/* Mobile Header */}
            <header className="lg:hidden bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-50">
                <div 
                    className="px-4 py-4 flex items-center justify-between"
                    style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                >
                    <div className="flex items-center gap-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                        {/* Burger Menu Button */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                            aria-label="Toggle menu"
                        >
                            <svg
                                className="w-6 h-6 text-gray-700"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                {mobileMenuOpen ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                )}
                            </svg>
                        </button>
                        {BRANDING.logo.url && (
                            <div className="relative w-8 h-8 flex-shrink-0">
                                <Image
                                    src={BRANDING.logo.url}
                                    alt={BRANDING.name}
                                    fill
                                    className="object-contain"
                                    priority
                                />
                            </div>
                        )}
                        <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                            <h1 className="text-xl font-bold text-gray-900">{BRANDING.name}</h1>
                            <p className="text-sm text-gray-600">
                                {user?.firstName} {user?.lastName}
                            </p>
                        </div>
                    </div>
                    <div 
                        className="flex items-center gap-2"
                        style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                    >
                        <LanguageSwitcher variant="minimal" />
                        <Link
                            href="/tenants"
                            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm"
                        >
                            {t("nav.browseSalons")}
                        </Link>
                    </div>
                </div>

                {/* Mobile Menu Dropdown */}
                {mobileMenuOpen && (
                    <div className="lg:hidden border-t border-gray-200 bg-white">
                        <nav className="px-4 py-4 space-y-2">
                            {navigation.map((item) => {
                                const active = isActive(item.href);
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                                            active
                                                ? "bg-primary text-white"
                                                : "text-gray-700 hover:bg-gray-100"
                                        }`}
                                        style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                                    >
                                        <span className="text-xl">{item.icon}</span>
                                        <span className="font-medium">{item.name}</span>
                                    </Link>
                                );
                            })}
                            <div className="pt-4 border-t border-gray-200 space-y-2">
                                <Link
                                    href="/tenants"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="flex items-center gap-3 px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                                    style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                                >
                                    <span className="text-xl">🏢</span>
                                    <span className="font-medium">{t("nav.browseSalons")}</span>
                                </Link>
                                <button
                                    onClick={() => {
                                        setMobileMenuOpen(false);
                                        logout();
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                                    style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                                >
                                    <span className="text-xl">🚪</span>
                                    <span className="font-medium">{t("nav.logout")}</span>
                                </button>
                            </div>
                        </nav>
                    </div>
                )}
            </header>

            <div className="flex" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                {/* Sidebar */}
                <aside className={`hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:bg-white/80 lg:backdrop-blur-lg ${isRTL ? 'lg:right-0 lg:border-l lg:border-gray-200' : 'lg:left-0 lg:border-r lg:border-gray-200'}`}>
                    {/* Sidebar Header */}
                    <div 
                        className="flex items-center gap-3 px-6 py-6 border-b border-gray-200"
                        style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                    >
                        {BRANDING.logo.url ? (
                            <div className="relative w-10 h-10 flex-shrink-0">
                                <Image
                                    src={BRANDING.logo.url}
                                    alt={BRANDING.name}
                                    fill
                                    className="object-contain"
                                    priority
                                />
                            </div>
                        ) : (
                            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                                <span className="text-white font-bold text-xl">R</span>
                            </div>
                        )}
                        <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                            <h2 className="text-lg font-bold text-gray-900">{BRANDING.name}</h2>
                            <p className="text-xs text-gray-500">{isRTL ? 'لوحة تحكم المستخدم' : 'User Dashboard'}</p>
                        </div>
                    </div>

                    {/* User Info */}
                    <div className="px-6 py-4 border-b border-gray-200">
                        <div 
                            className="flex items-center gap-3"
                            style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                        >
                            {user?.profileImage ? (
                                <img
                                    src={`http://localhost:5000${user.profileImage}`}
                                    alt="Profile"
                                    className="w-10 h-10 rounded-full object-cover"
                                    onError={(e) => {
                                        console.error('Image load error:', user.profileImage);
                                        e.currentTarget.style.display = 'none';
                                    }}
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                    <span className="text-primary font-semibold">
                                        {user?.firstName?.[0] || "U"}
                                    </span>
                                </div>
                            )}
                            <div className="flex-1 min-w-0" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                                <p className="text-sm font-medium text-gray-900 truncate">
                                    {user?.firstName} {user?.lastName}
                                </p>
                                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                            </div>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                        {navigation.map((item) => {
                            const active = isActive(item.href);
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                                        active
                                            ? "bg-primary text-white"
                                            : "text-gray-700 hover:bg-gray-100"
                                    }`}
                                    style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                                >
                                    <span className="text-xl">{item.icon}</span>
                                    <span className="font-medium">{item.name}</span>
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Language Switcher */}
                    <div className="px-4 py-3 border-t border-gray-200">
                        <LanguageSwitcher variant="toggle" className="w-full justify-center" />
                    </div>

                    {/* Sidebar Footer */}
                    <div className="px-4 py-4 border-t border-gray-200 space-y-2">
                        <Link
                            href="/tenants"
                            className="flex items-center gap-3 px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                            style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                        >
                            <span className="text-xl">🏢</span>
                            <span className="font-medium">{t("nav.browseSalons")}</span>
                        </Link>
                        <button
                            onClick={logout}
                            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                            style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                        >
                            <span className="text-xl">🚪</span>
                            <span className="font-medium">{t("nav.logout")}</span>
                        </button>
                    </div>
                </aside>

                {/* Main Content */}
                <main className={`flex-1 ${isRTL ? 'lg:mr-64' : 'lg:ml-64'}`}>
                    {/* Desktop Header */}
                    <header className="hidden lg:block bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-40">
                        <div className="px-6 py-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                            <h1 className="text-2xl font-bold text-gray-900">
                                {navigation.find((item) => isActive(item.href))?.name || t("nav.dashboard")}
                            </h1>
                        </div>
                    </header>

                    {/* Page Content */}
                    <div className="p-4 lg:p-8">{children}</div>
                </main>
            </div>
        </div>
    );
}

