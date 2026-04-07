"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useTenantAuth } from "@/contexts/TenantAuthContext";
import { useTranslations } from "next-intl";
import { getImageUrl, tenantApi } from "@/lib/api";
import {
  hasHotDealsEntitlement,
  hasInternalMessagingEntitlement,
  hasPayrollEntitlement,
  hasProductsAndOrdersEntitlement,
  hasPublicPageCustomizationEntitlement,
  hasPushNotificationsEntitlement,
  hasReportsEntitlement
} from "@/lib/packageEntitlements";
import { useRouter } from "next/navigation";

interface TenantLayoutProps {
  children: React.ReactNode;
}

export function TenantLayout({ children }: TenantLayoutProps) {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';
  const { user, logout } = useTenantAuth();
  const t = useTranslations("Navigation");
  const [entitlements, setEntitlements] = useState<Record<string, any> | null>(null);
  const [entitlementsLoaded, setEntitlementsLoaded] = useState(false);
  const [entitlementsLoadFailed, setEntitlementsLoadFailed] = useState(false);
  const [usageAlerts, setUsageAlerts] = useState<any[]>([]);
  const [posAlerts, setPosAlerts] = useState<any[]>([]);
  const [posDueCount, setPosDueCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    Promise.all([
      tenantApi.getSubscriptionLimits(),
      tenantApi.getSubscriptionConsumption().catch(() => null),
      tenantApi.getSubscriptionAlerts({ limit: 3, unacknowledgedOnly: true }).catch(() => null),
      tenantApi.getPosAlerts({ limit: 3 }).catch(() => null)
    ])
      .then(([limitsResponse, consumptionResponse, alertsResponse, posResponse]) => {
        const resolvedLimits = limitsResponse?.success && limitsResponse?.limits
          ? limitsResponse.limits
          : consumptionResponse?.data?.limits;

        setEntitlements(resolvedLimits || {});
        setEntitlementsLoadFailed(false);

        const alerts = alertsResponse?.success && Array.isArray(alertsResponse.alerts)
          ? alertsResponse.alerts
          : consumptionResponse?.data?.alerts || [];
        setUsageAlerts(alerts.filter((alert: any) => !alert?.acknowledged).slice(0, 3));

        if (posResponse?.success) {
          setPosAlerts(Array.isArray(posResponse.alerts) ? posResponse.alerts.slice(0, 3) : []);
          setPosDueCount(posResponse.summary?.totalDueCount || 0);
        } else {
          setPosAlerts([]);
          setPosDueCount(0);
        }
      })
      .catch(() => {
        setEntitlements(null);
        setEntitlementsLoadFailed(true);
        setPosAlerts([]);
        setPosDueCount(0);
      })
      .finally(() => setEntitlementsLoaded(true));
  }, [user?.id, user?.status]);

  const dismissAlert = async (alertId: string) => {
    setUsageAlerts((current) => current.filter((alert) => alert.id !== alertId));
    try {
      await tenantApi.acknowledgeSubscriptionAlert(alertId);
    } catch (error) {
      console.error('Failed to acknowledge usage alert:', error);
    }
  };

  const dismissPosAlert = (alertId: string) => {
    setPosAlerts((current) => current.filter((alert) => alert.id !== alertId));
  };

  const canEvaluateEntitlements = entitlementsLoaded && !entitlementsLoadFailed && entitlements !== null;
  const hasProductsAndOrders = canEvaluateEntitlements && hasProductsAndOrdersEntitlement(entitlements);
  const hasInternalMessaging = canEvaluateEntitlements && hasInternalMessagingEntitlement(entitlements);
  const hasHotDeals = canEvaluateEntitlements && hasHotDealsEntitlement(entitlements);
  const hasPushNotifications = canEvaluateEntitlements && hasPushNotificationsEntitlement(entitlements);
  const hasPayroll = canEvaluateEntitlements && hasPayrollEntitlement(entitlements);
  const hasReports = canEvaluateEntitlements && hasReportsEntitlement(entitlements);
  const hasPublicPageCustomization = canEvaluateEntitlements && hasPublicPageCustomizationEntitlement(entitlements);

  useEffect(() => {
    if (!user) return;

    const pendingPaymentAllowedRoutes = [
      `/${locale}/payment`,
      `/${locale}/subscription/pay`,
      `/${locale}/dashboard/bills`,
      `/${locale}/dashboard/subscription`
    ];

    const isPendingPaymentAllowedRoute = pendingPaymentAllowedRoutes.some((route) => pathname?.startsWith(route));

    if (user.status === 'payment_pending' && !isPendingPaymentAllowedRoute) {
      router.replace(`/${locale}/payment`);
    } else if (user.status === 'more_info_required' && !pathname?.includes('/onboarding/more-info')) {
      router.replace(`/${locale}/onboarding/more-info`);
    }
  }, [user?.status, pathname, locale, router]);

  const navigation = useMemo(() => [
    { name: t("dashboard"), href: `/${locale}/dashboard`, icon: "📊" },
    { name: t("services"), href: `/${locale}/dashboard/services`, icon: "✨" },
    { name: t("products"), href: `/${locale}/dashboard/products`, icon: "🛍️", visible: hasProductsAndOrders },
    { name: t("employees"), href: `/${locale}/dashboard/employees`, icon: "👥" },
    { name: locale === 'ar' ? 'الجداول' : 'Schedules', href: `/${locale}/dashboard/schedules`, icon: "📅" },
    { name: t("appointments"), href: `/${locale}/dashboard/appointments`, icon: "📅" },
    {
      name: locale === 'ar' ? 'نقطة البيع / التحصيل' : 'POS / Collections',
      href: `/${locale}/dashboard/pos`,
      icon: "🏷️",
      badgeCount: posDueCount,
    },
    { name: t("orders"), href: `/${locale}/dashboard/orders`, icon: "📦", visible: hasProductsAndOrders },
    { name: locale === 'ar' ? 'العروض الساخنة' : 'Hot Deals', href: `/${locale}/dashboard/hot-deals`, icon: "🔥", visible: hasHotDeals },
    { name: locale === 'ar' ? 'الرسائل' : 'Messages', href: `/${locale}/dashboard/messages`, icon: "📬", visible: hasInternalMessaging },
    { name: locale === 'ar' ? 'إشعارات العملاء' : 'Customer push', href: `/${locale}/dashboard/notifications`, icon: "🔔", visible: hasPushNotifications },
    { name: t("customers"), href: `/${locale}/dashboard/customers`, icon: "🤝" },
    { name: locale === 'ar' ? 'فواتيري' : 'My Bills', href: `/${locale}/dashboard/bills`, icon: "🧾" },
    { name: locale === 'ar' ? 'اشتراكي' : 'My Subscription', href: `/${locale}/dashboard/subscription`, icon: "📋" },
    { name: t("financial"), href: `/${locale}/dashboard/financial`, icon: "💰" },
    { name: t("payroll"), href: `/${locale}/dashboard/payroll`, icon: "💳", visible: hasPayroll },
    { name: t("reviews"), href: `/${locale}/dashboard/reviews`, icon: "⭐" },
    { name: t("reports"), href: `/${locale}/dashboard/reports`, icon: "📈", visible: hasReports },
    { name: t("myPage"), href: `/${locale}/dashboard/mypage`, icon: "🌐", visible: hasPublicPageCustomization },
    { name: t("settings"), href: `/${locale}/dashboard/settings`, icon: "⚙️" },
  ].filter((item) => item.visible !== false), [hasHotDeals, hasInternalMessaging, hasPayroll, hasProductsAndOrders, hasPublicPageCustomization, hasPushNotifications, hasReports, locale, posDueCount, t]);

  useEffect(() => {
    if (!entitlementsLoaded || entitlementsLoadFailed || entitlements === null || !pathname) return;

    const restrictedRoutes = [
      { href: `/${locale}/dashboard/products`, allowed: hasProductsAndOrders, feature: "productsAndOrders" },
      { href: `/${locale}/dashboard/orders`, allowed: hasProductsAndOrders, feature: "productsAndOrders" },
      { href: `/${locale}/dashboard/hot-deals`, allowed: hasHotDeals, feature: "hotDeals" },
      { href: `/${locale}/dashboard/messages`, allowed: hasInternalMessaging, feature: "internalMessaging" },
      { href: `/${locale}/dashboard/notifications`, allowed: hasPushNotifications, feature: "pushNotifications" },
      { href: `/${locale}/dashboard/payroll`, allowed: hasPayroll, feature: "payroll" },
      { href: `/${locale}/dashboard/reports`, allowed: hasReports, feature: "reports" },
      { href: `/${locale}/dashboard/mypage`, allowed: hasPublicPageCustomization, feature: "publicPageCustomization" }
    ];

    const blockedRoute = restrictedRoutes.find((route) => pathname.startsWith(route.href) && !route.allowed);
    if (blockedRoute) {
      router.replace(`/${locale}/dashboard/subscription?lockedFeature=${blockedRoute.feature}`);
    }
  }, [entitlements, entitlementsLoadFailed, entitlementsLoaded, hasHotDeals, hasInternalMessaging, hasPayroll, hasProductsAndOrders, hasPublicPageCustomization, hasPushNotifications, hasReports, locale, pathname, router]);

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
          {/* Business Info */}
          <div className="px-6 py-6 border-b border-gray-200 bg-gradient-to-r from-primary/5 to-secondary/5">
            <div
              className="flex items-start gap-3"
              style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
            >
              {(user?.logo || user?.profileImage) ? (
                <img
                  src={user.logo ? (user.logo.startsWith('http') ? user.logo : getImageUrl(user.logo)) : getImageUrl(user.profileImage)}
                  alt="Business Logo"
                  className="w-12 h-12 rounded-lg object-cover border-2 border-primary/20"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                  <span className="text-primary font-semibold text-xl">
                    {user?.businessName?.[0] || (locale === 'ar' ? 'م' : 'B')}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                <p className="text-base font-bold text-gray-900 truncate">
                  {user?.businessName || (locale === 'ar' ? 'اسم المركز' : 'Business name')}
                </p>
                <p className="text-xs text-gray-600">{Array.isArray(user?.businessType) ? user.businessType.map((t: string) => t.replace('_', ' ')).join(', ') : user?.businessType || "Salon"}</p>
                <div
                  className="mt-3 flex items-center gap-2"
                  style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                >
                  <Image src="/refahlogo.svg" alt="Rifah" width={22} height={22} />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                    {locale === 'ar' ? 'منصة رفاه' : 'Rifah Platform'}
                  </span>
                </div>
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
                  <span className="flex-1 font-medium">{item.name}</span>
                  {item.badgeCount ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        active ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {item.badgeCount > 99 ? '99+' : item.badgeCount}
                    </span>
                  ) : null}
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
          <div className="p-4 lg:p-8">
            {(posAlerts.length > 0 || usageAlerts.length > 0) && (
              <div className="mb-4 space-y-2">
                {posAlerts.map((alert) => (
                  <div
                    key={`pos-${alert.id}`}
                    className={`rounded-2xl border px-4 py-3 flex items-start justify-between gap-3 ${
                      alert.severity === 'high'
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : 'bg-sky-50 border-sky-200 text-sky-900'
                    }`}
                    style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                  >
                    <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      <p className="text-sm font-bold">
                        {locale === 'ar' ? (alert.title_ar || alert.title) : alert.title}
                      </p>
                      <p className="text-xs mt-1 opacity-90">
                        {locale === 'ar' ? (alert.message_ar || alert.message) : alert.message}
                      </p>
                      <Link
                        href={`/${locale}${alert.detailPath || '/dashboard/pos'}`}
                        className="mt-2 inline-flex text-xs font-semibold underline"
                      >
                        {locale === 'ar' ? 'فتح التحصيل' : 'Open collection'}
                      </Link>
                    </div>
                    <button
                      type="button"
                      onClick={() => dismissPosAlert(alert.id)}
                      className="text-xs font-semibold px-3 py-1 rounded-full bg-white/80 hover:bg-white"
                    >
                      {locale === 'ar' ? 'إخفاء' : 'Dismiss'}
                    </button>
                  </div>
                ))}
                {usageAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`rounded-2xl border px-4 py-3 flex items-start justify-between gap-3 ${
                      alert.priority === 'high' || alert.priority === 'critical'
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                    style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                  >
                    <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      <p className="text-sm font-bold">
                        {locale === 'ar' ? (alert.title_ar || alert.title) : alert.title}
                      </p>
                      <p className="text-xs mt-1 opacity-90">
                        {locale === 'ar' ? (alert.message_ar || alert.message) : alert.message}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => dismissAlert(alert.id)}
                      className="text-xs font-semibold px-3 py-1 rounded-full bg-white/80 hover:bg-white"
                    >
                      {locale === 'ar' ? 'إخفاء' : 'Dismiss'}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {children}
          </div>
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
                className={`relative flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-colors ${active ? "bg-primary/10 text-primary" : "text-gray-600"
                  }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-xs font-medium truncate w-full text-center">
                  {item.name}
                </span>
                {item.badgeCount ? (
                  <span className="absolute -top-1 right-3 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {item.badgeCount > 99 ? '99+' : item.badgeCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
