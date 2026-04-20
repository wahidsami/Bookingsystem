"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useTenantAuth } from "@/contexts/TenantAuthContext";
import { useTranslations } from "next-intl";
import { getImageUrl, tenantApi } from "@/lib/api";
import {
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  Cog6ToothIcon,
  InformationCircleIcon,
  LifebuoyIcon,
  ChevronDownIcon
} from "@heroicons/react/24/outline";
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
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const [entitlements, setEntitlements] = useState<Record<string, any> | null>(null);
  const [entitlementsLoaded, setEntitlementsLoaded] = useState(false);
  const [entitlementsLoadFailed, setEntitlementsLoadFailed] = useState(false);
  const [usageAlerts, setUsageAlerts] = useState<any[]>([]);
  const [posAlerts, setPosAlerts] = useState<any[]>([]);
  const [posDueCount, setPosDueCount] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

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
  const tenantTimeZone = user?.settings?.timezone || user?.timezone || 'Asia/Riyadh';
  const displayName =
    user?.ownerNameEn ||
    user?.ownerName ||
    user?.contactPersonNameEn ||
    user?.contactPersonNameAr ||
    user?.businessName ||
    user?.email ||
    (locale === 'ar' ? 'المستخدم' : 'User');
  const displayInitials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase())
    .join('') || (locale === 'ar' ? 'م' : 'U');
  const currentDateTimeLabel = useMemo(() => {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
      timeZone: tenantTimeZone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(now);
  }, [locale, now, tenantTimeZone]);
  useEffect(() => {
    if (!user) return;
    if (user.status === 'more_info_required' && !pathname?.includes('/onboarding/more-info')) {
      router.replace(`/${locale}/onboarding/more-info`);
    }
  }, [pathname, router, user?.status, locale]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

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
  const currentSection = navigation.find((item) => isActive(item.href))?.name || t("dashboard");

  const renderSidebarNavItem = (item: { name: string; href: string; icon: string; badgeCount?: number }) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.name}
        href={item.href}
        title={sidebarCollapsed ? item.name : undefined}
        aria-label={item.name}
        className={`group relative flex items-center rounded-xl transition-all ${sidebarCollapsed ? 'justify-center px-3 py-3' : 'gap-3 px-4 py-3'} ${
          active
            ? "bg-gradient-to-r from-primary to-primary/90 text-white shadow-lg"
            : "text-gray-700 hover:bg-gray-100"
        }`}
        style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
      >
        <span className="text-xl">{item.icon}</span>
        {!sidebarCollapsed && <span className="flex-1 font-medium">{item.name}</span>}
        {!sidebarCollapsed && item.badgeCount ? (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              active ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'
            }`}
          >
            {item.badgeCount > 99 ? '99+' : item.badgeCount}
          </span>
        ) : null}
        {sidebarCollapsed && item.badgeCount ? (
          <span className={`absolute ${isRTL ? '-left-1' : '-right-1'} -top-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white`}>
            {item.badgeCount > 99 ? '99+' : item.badgeCount}
          </span>
        ) : null}
      </Link>
    );
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

      <div className="hidden lg:flex min-h-screen" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <aside
          className={`sticky top-0 h-screen flex flex-col bg-white/90 backdrop-blur-lg shadow-xl border-gray-200 overflow-hidden transition-all duration-200 ${
            isRTL ? 'border-l' : 'border-r'
          }`}
          style={{ width: sidebarCollapsed ? 88 : 280 }}
        >
          <div
            className="h-[88px] border-b border-gray-200 bg-gradient-to-r from-primary/5 to-secondary/5 px-4"
            style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
          >
            <div className="flex h-full items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {(user?.logo || user?.profileImage) ? (
                  <img
                    src={user.logo ? (user.logo.startsWith('http') ? user.logo : getImageUrl(user.logo)) : getImageUrl(user.profileImage)}
                    alt="Business Logo"
                    className="h-12 w-12 rounded-xl object-cover border-2 border-primary/20 shrink-0"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-primary font-semibold text-xl">
                      {user?.businessName?.[0] || (locale === 'ar' ? 'م' : 'B')}
                    </span>
                  </div>
                )}
                {!sidebarCollapsed && (
                  <div className="min-w-0" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    <p className="truncate text-base font-bold text-gray-900">
                      {user?.businessName || (locale === 'ar' ? 'اسم المركز' : 'Business name')}
                    </p>
                    <p className="truncate text-xs text-gray-600">
                      {Array.isArray(user?.businessType)
                        ? user.businessType.map((item: string) => item.replace('_', ' ')).join(', ')
                        : user?.businessType || 'Salon'}
                    </p>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSidebarCollapsed((current) => !current)}
                className="rounded-lg border border-gray-200 bg-white p-2 text-gray-700 hover:bg-gray-50"
                aria-label={sidebarCollapsed ? (locale === 'ar' ? 'توسيع القائمة' : 'Expand sidebar') : (locale === 'ar' ? 'تصغير القائمة' : 'Collapse sidebar')}
              >
                {sidebarCollapsed
                  ? (isRTL ? <ChevronRightIcon className="h-5 w-5" /> : <ChevronLeftIcon className="h-5 w-5" />)
                  : <Bars3Icon className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {navigation.map((item) => renderSidebarNavItem(item))}
          </nav>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 h-[88px] border-b border-gray-200 bg-white/90 backdrop-blur-lg shadow-sm">
            <div className="flex h-full items-center justify-between px-6" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <div className="flex items-center gap-3 min-w-0" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <div className="rounded-2xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700">
                  <ClockIcon className="inline-block h-4 w-4 mr-2 align-[-2px]" />
                  {currentDateTimeLabel}
                </div>
                <div className="hidden xl:flex min-w-0 items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2 shadow-sm">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                    {locale === 'ar' ? 'القسم الحالي' : 'Current section'}
                  </span>
                  <span className="truncate text-sm font-semibold text-gray-900">{currentSection}</span>
                </div>
              </div>

              <div className="flex items-center gap-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <Link
                  href={locale === 'ar' ? pathname?.replace('/ar', '/en') || '/en' : pathname?.replace('/en', '/ar') || '/ar'}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {locale === 'ar' ? 'EN' : 'عربي'}
                </Link>

                <div ref={userMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen((current) => !current)}
                    className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-sm hover:bg-gray-50"
                    style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                  >
                    {user?.profileImage || user?.logo ? (
                      <img
                        src={user.profileImage ? getImageUrl(user.profileImage) : getImageUrl(user.logo)}
                        alt={displayName}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                        {displayInitials}
                      </div>
                    )}
                    <div className="min-w-0 text-left" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      <p className="max-w-[180px] truncate text-sm font-semibold text-gray-900">{displayName}</p>
                      <p className="text-xs text-gray-500">{locale === 'ar' ? 'حساب المركز' : 'Tenant account'}</p>
                    </div>
                    <ChevronDownIcon className={`h-4 w-4 text-gray-500 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {userMenuOpen && (
                    <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} mt-2 w-72 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl`}>
                      <div className="border-b border-gray-100 px-4 py-4">
                        <p className="text-sm font-semibold text-gray-900">{displayName}</p>
                        <p className="mt-1 text-xs text-gray-500">{user?.email}</p>
                      </div>
                      <div className="p-2">
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            router.push(`/${locale}/dashboard/settings`);
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                        >
                          <Cog6ToothIcon className="h-5 w-5 text-gray-500" />
                          <span>{locale === 'ar' ? 'الإعدادات' : 'Settings'}</span>
                        </button>
                        <button
                          type="button"
                          disabled
                          title={locale === 'ar' ? 'سيتم تفعيلها لاحقاً' : 'Coming soon'}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-gray-400 cursor-not-allowed"
                          style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                        >
                          <LifebuoyIcon className="h-5 w-5 text-gray-400" />
                          <span>{locale === 'ar' ? 'مركز المساعدة' : 'Help Desk'}</span>
                        </button>
                        <button
                          type="button"
                          disabled
                          title={locale === 'ar' ? 'سيتم تفعيله لاحقاً' : 'Coming soon'}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-gray-400 cursor-not-allowed"
                          style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                        >
                          <InformationCircleIcon className="h-5 w-5 text-gray-400" />
                          <span>{locale === 'ar' ? 'حول' : 'About'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            logout();
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                          style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                        >
                          <ArrowRightOnRectangleIcon className="h-5 w-5 text-red-500" />
                          <span>{locale === 'ar' ? 'تسجيل الخروج' : 'Logout'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 p-4 lg:p-8">
            <div className="mx-auto w-full max-w-[1600px]">
            {(posAlerts.length > 0 || usageAlerts.length > 0) && (
              <div className="mb-4 space-y-2">
                {posAlerts.map((alert) => (
                  <div
                    key={`pos-${alert.id}`}
                    className={`rounded-2xl border px-3 py-2.5 flex items-start justify-between gap-3 ${
                      alert.severity === 'high'
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : 'bg-sky-50 border-sky-200 text-sky-900'
                    }`}
                    style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                  >
                    <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      <p className="text-[13px] font-bold leading-tight">
                        {locale === 'ar' ? (alert.title_ar || alert.title) : alert.title}
                      </p>
                      <p className="text-[11px] mt-1 opacity-90 leading-snug">
                        {locale === 'ar' ? (alert.message_ar || alert.message) : alert.message}
                      </p>
                      <Link
                        href={`/${locale}${alert.detailPath || '/dashboard/pos'}`}
                        className="mt-1.5 inline-flex text-[11px] font-semibold underline"
                      >
                        {locale === 'ar' ? 'فتح التحصيل' : 'Open collection'}
                      </Link>
                    </div>
                    <button
                      type="button"
                      onClick={() => dismissPosAlert(alert.id)}
                      className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold hover:bg-white"
                    >
                      {locale === 'ar' ? 'إخفاء' : 'Dismiss'}
                    </button>
                  </div>
                ))}
                {usageAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`rounded-2xl border px-3 py-2.5 flex items-start justify-between gap-3 ${
                      alert.priority === 'high' || alert.priority === 'critical'
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                    style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                  >
                    <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      <p className="text-[13px] font-bold leading-tight">
                        {locale === 'ar' ? (alert.title_ar || alert.title) : alert.title}
                      </p>
                      <p className="text-[11px] mt-1 opacity-90 leading-snug">
                        {locale === 'ar' ? (alert.message_ar || alert.message) : alert.message}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => dismissAlert(alert.id)}
                      className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold hover:bg-white"
                    >
                      {locale === 'ar' ? 'إخفاء' : 'Dismiss'}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {children}
            </div>
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
