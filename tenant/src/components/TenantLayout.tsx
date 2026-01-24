"use client";

import { usePathname, useParams } from "next/navigation";
import Link from "next/link";
import { useTenantAuth } from "@/contexts/TenantAuthContext";
import { useTranslations } from "next-intl";
import { Currency } from "./Currency";

interface TenantLayoutProps {
  children: React.ReactNode;
}

export function TenantLayout({ children }: TenantLayoutProps) {
  const pathname = usePathname();
  const params = useParams();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';
  const { user, logout } = useTenantAuth();
  const t = useTranslations("Navigation");

  const navigation = [
    { name: t("dashboard"), href: `/${locale}/dashboard`, icon: "📊" },
    { name: t("services"), href: `/${locale}/dashboard/services`, icon: "✨" },
    { name: t("products"), href: `/${locale}/dashboard/products`, icon: "🛍️" },
    { name: t("employees"), href: `/${locale}/dashboard/employees`, icon: "👥" },
    { name: locale === 'ar' ? 'الجداول' : 'Schedules', href: `/${locale}/dashboard/schedules`, icon: "📅" },
    { name: t("appointments"), href: `/${locale}/dashboard/appointments`, icon: "📅" },
    { name: t("orders"), href: `/${locale}/dashboard/orders`, icon: "📦" },
    { name: locale === 'ar' ? 'العروض الساخنة' : 'Hot Deals', href: `/${locale}/dashboard/hot-deals`, icon: "🔥" },
    { name: t("customers"), href: `/${locale}/dashboard/customers`, icon: "🤝" },
    { name: t("financial"), href: `/${locale}/dashboard/financial`, icon: "💰" },
    { name: t("reports"), href: `/${locale}/dashboard/reports`, icon: "📈" },
    { name: t("myPage"), href: `/${locale}/dashboard/mypage`, icon: "🌐" },
    { name: t("settings"), href: `/${locale}/dashboard/settings`, icon: "⚙️" },
  ];

  const isActive = (href: string) => {
    if (href === `/${locale}/dashboard`) {
      return pathname === `/${locale}/dashboard`;
    }
    return pathname?.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Mobile Header */}
      <header className="lg:hidden bg-white/90 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div
          className="px-4 py-4 flex items-center justify-between"
          style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
        >
          <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
            <h1 className="text-xl font-bold text-gray-900">{t("dashboard")}</h1>
            <p className="text-sm text-gray-600">{user?.businessName}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <Link
              href={locale === 'ar' ? pathname?.replace('/ar', '/en') || '/en' : pathname?.replace('/en', '/ar') || '/ar'}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              {locale === 'ar' ? 'EN' : 'عربي'}
            </Link>
          </div>
        </div>
      </header>

      <div className="flex" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        {/* Sidebar */}
        <aside
          className={`hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:bg-white/90 lg:backdrop-blur-lg lg:shadow-xl ${isRTL ? 'lg:right-0 lg:border-l lg:border-gray-200' : 'lg:left-0 lg:border-r lg:border-gray-200'
            }`}
        >
          {/* Sidebar Header */}
          <div
            className="flex items-center gap-3 px-6 py-6 border-b border-gray-200"
            style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-2xl">ر</span>
            </div>
            <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
              <h2 className="text-lg font-bold text-gray-900">رفاه</h2>
              <p className="text-xs text-gray-500">
                {locale === 'ar' ? 'لوحة تحكم الصالون' : 'Salon Dashboard'}
              </p>
            </div>
          </div>

          {/* Business Info */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-primary/5 to-secondary/5">
            <div
              className="flex items-center gap-3"
              style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
            >
              {(user?.logo || user?.profileImage) ? (
                <img
                  src={user.logo ? (user.logo.startsWith('http') ? user.logo : `http://localhost:5000${user.logo}`) : user.profileImage}
                  alt="Business Logo"
                  className="w-12 h-12 rounded-lg object-cover border-2 border-primary/20"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                  <span className="text-primary font-semibold text-xl">
                    {user?.businessName?.[0] || "S"}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                <p className="text-sm font-bold text-gray-900 truncate">
                  {user?.businessName || "صالون رفاه"}
                </p>
                <p className="text-xs text-gray-600">{user?.businessType || "Salon"}</p>
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
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active
                      ? "bg-gradient-to-r from-primary to-primary/90 text-white shadow-lg"
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

          {/* Language Switcher & Logout */}
          <div className="px-4 py-4 border-t border-gray-200 space-y-2">
            <Link
              href={locale === 'ar' ? pathname?.replace('/ar', '/en') || '/en' : pathname?.replace('/en', '/ar') || '/ar'}
              className="flex items-center gap-3 px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
              style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
            >
              <span className="text-xl">🌐</span>
              <span className="font-medium">{locale === 'ar' ? 'English' : 'العربية'}</span>
            </Link>
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
              style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
            >
              <span className="text-xl">🚪</span>
              <span className="font-medium">{locale === 'ar' ? 'تسجيل الخروج' : 'Logout'}</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className={`flex-1 ${isRTL ? 'lg:mr-64' : 'lg:ml-64'}`}>
          {/* Desktop Header */}
          <header className="hidden lg:block bg-white/90 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-40 shadow-sm">
            <div className="px-6 py-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              <h1 className="text-2xl font-bold text-gray-900">
                {navigation.find((item) => isActive(item.href))?.name || t("dashboard")}
              </h1>
            </div>
          </header>

          {/* Page Content */}
          <div className="p-4 lg:p-8">{children}</div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="grid grid-cols-5 gap-1 p-2">
          {navigation.slice(0, 5).map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-colors ${active ? "bg-primary/10 text-primary" : "text-gray-600"
                  }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-xs font-medium truncate w-full text-center">
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

