"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useTenantAuth } from "@/contexts/TenantAuthContext";
import { useTranslations } from "next-intl";
import { getImageUrl, tenantApi } from "@/lib/api";
import {
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  BanknotesIcon,
  BellIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  Cog6ToothIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  FolderIcon,
  GlobeAltIcon,
  HomeIcon,
  InformationCircleIcon,
  LifebuoyIcon,
  MegaphoneIcon,
  ShoppingBagIcon,
  SparklesIcon,
  UserGroupIcon,
  UsersIcon,
  Squares2X2Icon,
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
import {
  DASHBOARD_SECTION_PERMISSION_MAP,
  hasDashboardPermission
} from "@/lib/dashboardAccess";

interface TenantLayoutProps {
  children: React.ReactNode;
  fullWidth?: boolean;
}

type NavIcon = React.ComponentType<{ className?: string }>;
type NavigationLeafItem = {
  kind: "link";
  name: string;
  href: string;
  icon: NavIcon;
  badgeCount?: number;
  visible?: boolean;
  permissionKey?: string | null;
};

type NavigationGroupItem = {
  kind: "group";
  key: string;
  name: string;
  icon: NavIcon;
  visible?: boolean;
  children: NavigationLeafItem[];
};

type NavigationItem = NavigationLeafItem | NavigationGroupItem;

export function TenantLayout({ children, fullWidth = true }: TenantLayoutProps) {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';
  const { user, logout, permissions, sessionType } = useTenantAuth();
  const t = useTranslations("Navigation");
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const userMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const userMenuPanelRef = useRef<HTMLDivElement | null>(null);
  const notificationMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationButtonRef = useRef<HTMLButtonElement | null>(null);
  const notificationPanelRef = useRef<HTMLDivElement | null>(null);
  const [entitlements, setEntitlements] = useState<Record<string, any> | null>(null);
  const [entitlementsLoaded, setEntitlementsLoaded] = useState(false);
  const [entitlementsLoadFailed, setEntitlementsLoadFailed] = useState(false);
  const [usageAlerts, setUsageAlerts] = useState<any[]>([]);
  const [posAlerts, setPosAlerts] = useState<any[]>([]);
  const [posDueCount, setPosDueCount] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [expandedNavGroups, setExpandedNavGroups] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState(() => new Date());
  const [notificationSeenAt, setNotificationSeenAt] = useState(0);
  const [markingNotificationsRead, setMarkingNotificationsRead] = useState(false);
  const [notificationPanelPosition, setNotificationPanelPosition] = useState<{ top: number; left?: number; right?: number }>({ top: 0 });
  const [userMenuPosition, setUserMenuPosition] = useState<{ top: number; left?: number; right?: number }>({ top: 0 });
  const announcedAppointmentAlertIdsRef = useRef<Set<string>>(new Set());
  const hasLoadedAppointmentAlertsRef = useRef(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!user) return;

    refreshDashboardAlerts(false);
    const timer = window.setInterval(() => {
      refreshDashboardAlerts(true);
    }, 60_000);

    return () => window.clearInterval(timer);
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
  const isDashboardAccount = sessionType === 'tenant_account';
  const canAccessPermission = (key?: string | null) => {
    if (!key || !isDashboardAccount) return true;
    if (key === DASHBOARD_SECTION_PERMISSION_MAP.settings && permissions?.manage_accounts) {
      return true;
    }
    return hasDashboardPermission(permissions, key as any);
  };
  const displayName =
    user?.displayName ||
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
  const notificationCount = useMemo(() => {
    const unreadUsageCount = usageAlerts.length;
    const unreadOperationalCount = posAlerts.filter((alert) => {
      const timestamp = alert?.scheduledAt || alert?.createdAt;
      const parsed = timestamp ? new Date(timestamp) : null;
      return parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() > notificationSeenAt : true;
    }).length;

    return unreadUsageCount + unreadOperationalCount;
  }, [notificationSeenAt, posAlerts, usageAlerts]);
  const notificationFeed = useMemo(() => {
    const toTimestamp = (value: any) => {
      const parsed = value ? new Date(value) : null;
      return parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : 0;
    };

    return [
      ...posAlerts.map((alert) => ({
        key: `pos-${alert.id}`,
        kind: (alert.kind || 'pos') as 'pos' | 'appointment' | 'review',
        originalId: alert.id,
        title: locale === 'ar' ? (alert.title_ar || alert.title) : alert.title,
        message: locale === 'ar' ? (alert.message_ar || alert.message) : alert.message,
        detailPath: alert.detailPath || '/dashboard/pos',
        timestamp: toTimestamp(alert.scheduledAt || alert.createdAt),
        severity: alert.severity || 'medium'
      })),
      ...usageAlerts.map((alert) => ({
        key: `usage-${alert.id}`,
        kind: 'usage' as const,
        originalId: alert.id,
        title: locale === 'ar' ? (alert.title_ar || alert.title) : alert.title,
        message: locale === 'ar' ? (alert.message_ar || alert.message) : alert.message,
        detailPath: null,
        timestamp: toTimestamp(alert.createdAt),
        severity: alert.priority === 'high' || alert.priority === 'critical' ? 'high' : 'medium'
      }))
    ]
      .filter((item) => (item.kind !== 'pos' && item.kind !== 'appointment' && item.kind !== 'review') || item.timestamp > notificationSeenAt)
      .sort((left, right) => right.timestamp - left.timestamp)
      .slice(0, 6);
  }, [locale, posAlerts, usageAlerts, notificationSeenAt]);
  const notificationBadgeCount = notificationCount;
  const handleDismissNotification = (item: { kind: 'pos' | 'appointment' | 'review' | 'usage'; originalId: string }) => {
    if (item.kind === 'pos' || item.kind === 'appointment' || item.kind === 'review') {
      dismissPosAlert(item.originalId);
    } else {
      dismissAlert(item.originalId);
    }
  };

  const playAppointmentAlertTone = () => {
    if (typeof window === 'undefined') return;

    const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!AudioContextClass) return;

    try {
      const context = new AudioContextClass();
      if (context.state === 'suspended') {
        void context.resume();
      }
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      gainNode.gain.setValueAtTime(0.0001, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.03);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.42);
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.45);
      oscillator.onended = () => {
        void context.close().catch(() => null);
      };
    } catch (error) {
      console.warn('Failed to play appointment alert tone:', error);
    }
  };

  const refreshDashboardAlerts = async (allowSound = false) => {
    if (!user) return;

    try {
      const [limitsResponse, consumptionResponse, alertsResponse, posResponse, settingsResponse] = await Promise.all([
        tenantApi.getSubscriptionLimits(),
        tenantApi.getSubscriptionConsumption().catch(() => null),
        tenantApi.getSubscriptionAlerts({ limit: 3, unacknowledgedOnly: true }).catch(() => null),
        tenantApi.getPosAlerts({ limit: 3 }).catch(() => null),
        tenantApi.getSettings().catch(() => null)
      ]);

      const resolvedLimits = limitsResponse?.success && limitsResponse?.limits
        ? limitsResponse.limits
        : consumptionResponse?.data?.limits;

      setEntitlements(resolvedLimits || {});
      setEntitlementsLoadFailed(false);

      const alerts = alertsResponse?.success && Array.isArray(alertsResponse.alerts)
        ? alertsResponse.alerts
        : consumptionResponse?.data?.alerts || [];
      setUsageAlerts(alerts.filter((alert: any) => !alert?.acknowledged).slice(0, 3));

      const nextDashboardPreferences = {
        enableVoiceAlerts: settingsResponse?.success
          ? settingsResponse.data?.settings?.enableVoiceAlerts !== false
          : true
      };
        if (posResponse?.success) {
          const nextPosAlerts = Array.isArray(posResponse.alerts) ? posResponse.alerts.slice(0, 3) : [];
          const nextAppointmentAlertIds = nextPosAlerts
          .filter((alert: any) => alert?.kind === 'appointment')
          .map((alert: any) => String(alert.id));

        if (allowSound && hasLoadedAppointmentAlertsRef.current && nextDashboardPreferences.enableVoiceAlerts) {
          const newAppointmentAlertExists = nextAppointmentAlertIds.some(
            (alertId: string) => !announcedAppointmentAlertIdsRef.current.has(alertId)
          );
          if (newAppointmentAlertExists) {
            playAppointmentAlertTone();
          }
        }

        announcedAppointmentAlertIdsRef.current = new Set(nextAppointmentAlertIds);
        hasLoadedAppointmentAlertsRef.current = true;

        setPosAlerts(nextPosAlerts);
        setPosDueCount(posResponse.summary?.totalDueCount || 0);
      } else {
        setPosAlerts([]);
        setPosDueCount(0);
        announcedAppointmentAlertIdsRef.current = new Set();
        hasLoadedAppointmentAlertsRef.current = false;
      }
    } catch {
      setEntitlements(null);
      setEntitlementsLoadFailed(true);
      setPosAlerts([]);
      setPosDueCount(0);
    } finally {
      setEntitlementsLoaded(true);
    }
  };

  const markAllNotificationsAsRead = async () => {
    if (markingNotificationsRead) return;

    setMarkingNotificationsRead(true);
    try {
      await Promise.all(usageAlerts.map((alert) => tenantApi.acknowledgeSubscriptionAlert(alert.id).catch(() => null)));
      setUsageAlerts([]);
      const timestamp = Date.now();
      setNotificationSeenAt(timestamp);
      if (typeof window !== 'undefined' && user?.id) {
        window.localStorage.setItem(`rifah_tenant_notification_seen_at:${user.id}`, String(timestamp));
      }
    } finally {
      setMarkingNotificationsRead(false);
    }
  };

  const renderNotificationMenu = () => (
    <div ref={notificationMenuRef} className="relative z-50">
      <button
        ref={notificationButtonRef}
        type="button"
        onClick={() => {
          setUserMenuOpen(false);
          setNotificationMenuOpen((current) => !current);
        }}
        className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50"
        aria-label={locale === 'ar' ? 'الإشعارات' : 'Notifications'}
      >
          <BellIcon className="h-5 w-5 text-gray-600" />
          {notificationBadgeCount > 0 ? (
            <span className={`absolute -top-1 ${isRTL ? '-left-1' : '-right-1'} flex min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-white`}>
            {notificationBadgeCount > 99 ? '99+' : notificationBadgeCount}
          </span>
        ) : null}
      </button>

      {notificationMenuOpen && (
        typeof document !== 'undefined' ? createPortal(
          <div
            ref={notificationPanelRef}
            className="fixed isolate z-[5000] w-[24rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
            style={{
              top: notificationPanelPosition.top,
              left: notificationPanelPosition.left,
              right: notificationPanelPosition.right
            }}
          >
            <div className="border-b border-gray-100 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {locale === 'ar' ? 'الإشعارات' : 'Notifications'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {notificationCount > 0
                      ? (locale === 'ar' ? `${notificationCount} إشعار` : `${notificationCount} item(s)`)
                      : (locale === 'ar' ? 'لا توجد إشعارات جديدة' : 'No new notifications')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={markAllNotificationsAsRead}
                  disabled={markingNotificationsRead || notificationCount === 0}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {markingNotificationsRead
                    ? (locale === 'ar' ? 'جارٍ التحديث...' : 'Marking...')
                    : (locale === 'ar' ? 'تعيين الكل كمقروء' : 'Mark all as read')}
                </button>
                <button
                  type="button"
                  onClick={() => setNotificationMenuOpen(false)}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  {locale === 'ar' ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </div>
            <div className="max-h-[420px] overflow-y-auto p-2">
              {notificationFeed.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                  {locale === 'ar' ? 'لا توجد إشعارات حالياً' : 'No notifications right now'}
                </div>
              ) : notificationFeed.map((item) => (
                <div
                  key={item.key}
                  className={`mb-2 rounded-xl border px-3 py-3 ${
                    item.severity === 'high' ? 'border-rose-200 bg-rose-50' : 'border-gray-200 bg-white'
                  }`}
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  <div className={`flex items-start justify-between gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-gray-600">{item.message}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                        item.kind === 'pos'
                          ? 'bg-sky-100 text-sky-700'
                          : item.kind === 'appointment'
                            ? 'bg-amber-100 text-amber-700'
                            : item.kind === 'review'
                              ? 'bg-violet-100 text-violet-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}>
                        {item.kind === 'pos'
                          ? (locale === 'ar' ? 'تحصيل' : 'POS')
                          : item.kind === 'appointment'
                            ? (locale === 'ar' ? 'موعد' : 'Appointment')
                            : item.kind === 'review'
                              ? (locale === 'ar' ? 'تقييم' : 'Review')
                            : (locale === 'ar' ? 'اشتراك' : 'Subscription')}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDismissNotification(item)}
                        className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
                      >
                        {locale === 'ar' ? 'إخفاء' : 'Dismiss'}
                      </button>
                    </div>
                  </div>
                  {item.detailPath ? (
                    <Link
                      href={`/${locale}${item.detailPath}`}
                      onClick={() => setNotificationMenuOpen(false)}
                      className="mt-3 inline-flex text-xs font-semibold text-primary hover:underline"
                    >
                      {locale === 'ar' ? 'فتح التفاصيل' : 'Open details'}
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          </div>,
          document.body
        ) : null
      )}
    </div>
  );

  const renderUserMenuPanel = () => (
    <div
      ref={userMenuPanelRef}
      className="fixed isolate z-[10001] w-72 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
      style={{
        top: userMenuPosition.top,
        left: userMenuPosition.left,
        right: userMenuPosition.right
      }}
    >
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
        >
          <Cog6ToothIcon className="h-5 w-5 text-gray-500" />
          <span>{locale === 'ar' ? 'الإعدادات' : 'Settings'}</span>
        </button>
        <button
          type="button"
          disabled
          title={locale === 'ar' ? 'سيتم تفعيلها لاحقاً' : 'Coming soon'}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-gray-400 cursor-not-allowed"
        >
          <LifebuoyIcon className="h-5 w-5 text-gray-400" />
          <span>{locale === 'ar' ? 'مركز المساعدة' : 'Help Desk'}</span>
        </button>
        <button
          type="button"
          disabled
          title={locale === 'ar' ? 'سيتم تفعيله لاحقاً' : 'Coming soon'}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-gray-400 cursor-not-allowed"
        >
          <InformationCircleIcon className="h-5 w-5 text-gray-400" />
          <span>{locale === 'ar' ? 'حول' : 'About'}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setUserMenuOpen(false);
            void logout();
            if (typeof window !== 'undefined') {
              window.location.href = `/${locale}/login`;
            }
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-red-600 hover:bg-red-50"
        >
          <ArrowRightOnRectangleIcon className="h-5 w-5 text-red-500" />
          <span>{locale === 'ar' ? 'تسجيل الخروج' : 'Logout'}</span>
        </button>
      </div>
    </div>
  );
  useEffect(() => {
    if (!notificationMenuOpen) return;

    const updateNotificationPanelPosition = () => {
      const anchor = notificationButtonRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const nextTop = rect.bottom + 8;

      if (isRTL) {
        setNotificationPanelPosition({ top: nextTop, left: Math.max(16, rect.left) });
        return;
      }

      setNotificationPanelPosition({ top: nextTop, right: Math.max(16, window.innerWidth - rect.right) });
    };

    updateNotificationPanelPosition();
    window.addEventListener('resize', updateNotificationPanelPosition);
    window.addEventListener('scroll', updateNotificationPanelPosition, true);

    return () => {
      window.removeEventListener('resize', updateNotificationPanelPosition);
      window.removeEventListener('scroll', updateNotificationPanelPosition, true);
    };
  }, [isRTL, notificationMenuOpen]);
  useEffect(() => {
    if (!user) return;
    if (user.status === 'more_info_required' && !pathname?.includes('/onboarding/more-info')) {
      router.replace(`/${locale}/onboarding/more-info`);
    }
  }, [pathname, router, user?.status, locale]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!user?.id) {
      setNotificationSeenAt(0);
      announcedAppointmentAlertIdsRef.current = new Set();
      hasLoadedAppointmentAlertsRef.current = false;
      return;
    }

    const storedValue = window.localStorage.getItem(`rifah_tenant_notification_seen_at:${user.id}`);
    const parsedValue = storedValue ? Number(storedValue) : 0;
    setNotificationSeenAt(Number.isFinite(parsedValue) ? parsedValue : 0);
  }, [user?.id]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!userMenuOpen) return;

    const updatePosition = () => {
      const anchor = userMenuButtonRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const top = Math.min(
        window.innerHeight - 20,
        rect.bottom + 8
      );
      if (isRTL) {
        setUserMenuPosition({
          top,
          left: Math.max(8, rect.left)
        });
      } else {
        setUserMenuPosition({
          top,
          right: Math.max(8, window.innerWidth - rect.right)
        });
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isRTL, userMenuOpen]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        if (!userMenuPanelRef.current || !userMenuPanelRef.current.contains(target)) {
          setUserMenuOpen(false);
        }
      }
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(target)) {
        if (!notificationPanelRef.current || !notificationPanelRef.current.contains(target)) {
          setNotificationMenuOpen(false);
        }
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setUserMenuOpen(false);
        setNotificationMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const catalogChildren = useMemo<NavigationLeafItem[]>(() => {
    return [
      { kind: "link", name: t("services"), href: `/${locale}/dashboard/services`, icon: SparklesIcon, permissionKey: DASHBOARD_SECTION_PERMISSION_MAP.services },
      { kind: "link", name: t("products"), href: `/${locale}/dashboard/products`, icon: ShoppingBagIcon, visible: hasProductsAndOrders, permissionKey: DASHBOARD_SECTION_PERMISSION_MAP.products },
      { kind: "link", name: t("orders"), href: `/${locale}/dashboard/orders`, icon: Squares2X2Icon, visible: hasProductsAndOrders, permissionKey: DASHBOARD_SECTION_PERMISSION_MAP.orders }
    ];
  }, [hasProductsAndOrders, locale, t]);

  const marketingChildren = useMemo<NavigationLeafItem[]>(() => {
    return [
      { kind: "link", name: locale === 'ar' ? 'العروض الساخنة' : 'Hot Deals', href: `/${locale}/dashboard/hot-deals`, icon: SparklesIcon, visible: hasHotDeals, permissionKey: DASHBOARD_SECTION_PERMISSION_MAP['hot-deals'] },
      { kind: "link", name: locale === 'ar' ? 'إشعارات العملاء' : 'Customer push', href: `/${locale}/dashboard/notifications`, icon: BellIcon, visible: hasPushNotifications, permissionKey: DASHBOARD_SECTION_PERMISSION_MAP.notifications },
      { kind: "link", name: t("reviews"), href: `/${locale}/dashboard/reviews`, icon: SparklesIcon, permissionKey: DASHBOARD_SECTION_PERMISSION_MAP.reviews },
      { kind: "link", name: locale === 'ar' ? 'إعداد الصفحة' : 'Page Setup', href: `/${locale}/dashboard/page-setup`, icon: InformationCircleIcon, permissionKey: DASHBOARD_SECTION_PERMISSION_MAP.mypage }
    ];
  }, [hasHotDeals, hasPushNotifications, locale, t]);

  const billingChildren = useMemo<NavigationLeafItem[]>(() => {
    return [
      { kind: "link", name: locale === 'ar' ? 'فواتيري' : 'My Bills', href: `/${locale}/dashboard/bills`, icon: DocumentTextIcon, permissionKey: DASHBOARD_SECTION_PERMISSION_MAP.bills },
      { kind: "link", name: locale === 'ar' ? 'اشتراكي' : 'My Subscription', href: `/${locale}/dashboard/subscription`, icon: DocumentTextIcon, permissionKey: DASHBOARD_SECTION_PERMISSION_MAP.subscription },
      { kind: "link", name: t("financial"), href: `/${locale}/dashboard/financial`, icon: BanknotesIcon, permissionKey: DASHBOARD_SECTION_PERMISSION_MAP.financial }
    ];
  }, [locale, t]);

  const navigationItems = useMemo<NavigationItem[]>(() => {
    const catalogVisible = catalogChildren.some((child) => child.visible !== false && canAccessPermission(child.permissionKey));
    const marketingVisible = marketingChildren.some((child) => child.visible !== false && canAccessPermission(child.permissionKey));
    const billingVisible = billingChildren.some((child) => child.visible !== false && canAccessPermission(child.permissionKey));

    return [
      { kind: "link", name: t("dashboard"), href: `/${locale}/dashboard?view=home`, icon: HomeIcon, permissionKey: DASHBOARD_SECTION_PERMISSION_MAP.dashboard },
      {
        kind: "group",
        key: "catalog",
        name: t("catalog"),
        icon: FolderIcon,
        visible: catalogVisible,
        children: catalogChildren
      },
      { kind: "link", name: t("teams"), href: `/${locale}/dashboard/employees`, icon: UserGroupIcon, permissionKey: DASHBOARD_SECTION_PERMISSION_MAP.employees },
      { kind: "link", name: t("appointments"), href: `/${locale}/dashboard/appointments`, icon: CalendarDaysIcon, permissionKey: DASHBOARD_SECTION_PERMISSION_MAP.appointments },
      {
        kind: "link",
        name: locale === 'ar' ? 'نقطة البيع / التحصيل' : 'POS / Collections',
        href: `/${locale}/dashboard/pos`,
        icon: BanknotesIcon,
        badgeCount: posDueCount,
        permissionKey: DASHBOARD_SECTION_PERMISSION_MAP.pos
      },
      { kind: "link", name: locale === 'ar' ? 'الرسائل' : 'Messages', href: `/${locale}/dashboard/messages`, icon: ChatBubbleLeftRightIcon, visible: hasInternalMessaging, permissionKey: DASHBOARD_SECTION_PERMISSION_MAP.messages },
      { kind: "link", name: t("customers"), href: `/${locale}/dashboard/customers`, icon: UsersIcon, permissionKey: DASHBOARD_SECTION_PERMISSION_MAP.customers },
      {
        kind: "group",
        key: "marketing",
        name: locale === 'ar' ? 'التسويق' : 'Marketing',
        icon: MegaphoneIcon,
        visible: marketingVisible,
        children: marketingChildren
      },
      {
        kind: "group",
        key: "billing",
        name: locale === 'ar' ? 'الفواتير والمالية' : 'Billing & Finance',
        icon: BanknotesIcon,
        visible: billingVisible,
        children: billingChildren
      },
      { kind: "link", name: t("payroll"), href: `/${locale}/dashboard/payroll`, icon: BanknotesIcon, visible: hasPayroll, permissionKey: DASHBOARD_SECTION_PERMISSION_MAP.payroll },
      { kind: "link", name: t("reports"), href: `/${locale}/dashboard/reports`, icon: GlobeAltIcon, visible: hasReports, permissionKey: DASHBOARD_SECTION_PERMISSION_MAP.reports },
      { kind: "link", name: t("settings"), href: `/${locale}/dashboard/settings`, icon: Cog6ToothIcon, permissionKey: DASHBOARD_SECTION_PERMISSION_MAP.settings },
    ];
  }, [billingChildren, canAccessPermission, catalogChildren, hasHotDeals, hasInternalMessaging, hasPayroll, hasPushNotifications, hasReports, locale, marketingChildren, posDueCount, t]);
  const navigation = navigationItems.filter((item) => item.visible !== false && (item.kind === "group" || canAccessPermission(item.permissionKey)));
  const mobileNavigation = useMemo(() => {
    return navigation.flatMap((item) => {
      if (item.kind === "group") {
        return item.children.filter((child) => child.visible !== false && canAccessPermission(child.permissionKey));
      }
      return [item];
    });
  }, [canAccessPermission, navigation]);

  useEffect(() => {
    if (!entitlementsLoaded || entitlementsLoadFailed || entitlements === null || !pathname) return;

    const restrictedRoutes = [
      { href: `/${locale}/dashboard/products`, allowed: hasProductsAndOrders && canAccessPermission(DASHBOARD_SECTION_PERMISSION_MAP.products), feature: "productsAndOrders" },
      { href: `/${locale}/dashboard/orders`, allowed: hasProductsAndOrders && canAccessPermission(DASHBOARD_SECTION_PERMISSION_MAP.orders), feature: "productsAndOrders" },
      { href: `/${locale}/dashboard/hot-deals`, allowed: hasHotDeals && canAccessPermission(DASHBOARD_SECTION_PERMISSION_MAP['hot-deals']), feature: "hotDeals" },
      { href: `/${locale}/dashboard/messages`, allowed: hasInternalMessaging && canAccessPermission(DASHBOARD_SECTION_PERMISSION_MAP.messages), feature: "internalMessaging" },
      { href: `/${locale}/dashboard/notifications`, allowed: hasPushNotifications && canAccessPermission(DASHBOARD_SECTION_PERMISSION_MAP.notifications), feature: "pushNotifications" },
      { href: `/${locale}/dashboard/payroll`, allowed: hasPayroll && canAccessPermission(DASHBOARD_SECTION_PERMISSION_MAP.payroll), feature: "payroll" },
      { href: `/${locale}/dashboard/reports`, allowed: hasReports && canAccessPermission(DASHBOARD_SECTION_PERMISSION_MAP.reports), feature: "reports" },
      { href: `/${locale}/dashboard/mypage`, allowed: false, feature: "publicPageCustomization" },
      { href: `/${locale}/dashboard/page-setup`, allowed: canAccessPermission(DASHBOARD_SECTION_PERMISSION_MAP.mypage), feature: "publicPageCustomization" },
      { href: `/${locale}/dashboard/settings`, allowed: canAccessPermission(DASHBOARD_SECTION_PERMISSION_MAP.settings), feature: "settings" }
    ];

    const blockedRoute = restrictedRoutes.find((route) => pathname.startsWith(route.href) && !route.allowed);
    if (blockedRoute) {
      router.replace(`/${locale}/dashboard`);
    }
  }, [canAccessPermission, entitlements, entitlementsLoadFailed, entitlementsLoaded, locale, navigationItems, pathname, router]);

  const isActive = (href: string) => {
    const normalizedHref = href.split("?")[0];

    if (normalizedHref === `/${locale}/dashboard`) {
      return pathname === `/${locale}/dashboard`;
    }
    return pathname?.startsWith(normalizedHref);
  };

  const findActiveNavigationItem = (items: NavigationItem[]): NavigationLeafItem | NavigationGroupItem | undefined => {
    for (const item of items) {
      if (item.kind === "group") {
        const activeChild = findActiveNavigationItem(item.children);
        if (activeChild) {
          return activeChild;
        }
        continue;
      }

      if (isActive(item.href)) {
        return item;
      }
    }

    return undefined;
  };

  useEffect(() => {
    const activeGroupKeys: Array<"catalog" | "marketing" | "billing"> = [];

    if (catalogChildren.some((child) => isActive(child.href))) {
      activeGroupKeys.push("catalog");
    }
    if (marketingChildren.some((child) => isActive(child.href))) {
      activeGroupKeys.push("marketing");
    }
    if (billingChildren.some((child) => isActive(child.href))) {
      activeGroupKeys.push("billing");
    }

    if (activeGroupKeys.length === 0) {
      return;
    }

    setExpandedNavGroups((current) => {
      const next = { ...current };
      let changed = false;

      activeGroupKeys.forEach((key) => {
        if (next[key] === undefined) {
          next[key] = true;
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [billingChildren, catalogChildren, marketingChildren]);

  const currentSection = findActiveNavigationItem(navigation)?.name || t("dashboard");
  const sidebarWidth = sidebarCollapsed ? 88 : 280;
  const shellGridStyle = {
    gridTemplateRows: '88px minmax(0, 1fr)',
    gridTemplateColumns: isRTL
      ? `minmax(0, 1fr) ${sidebarWidth}px`
      : `${sidebarWidth}px minmax(0, 1fr)`,
    gridTemplateAreas: isRTL
      ? '"header logo" "content sidebar"'
      : '"logo header" "sidebar content"',
  } as React.CSSProperties;

  const toggleNavGroup = (key: string) => {
    setExpandedNavGroups((current) => ({
      ...current,
      [key]: !(current[key] ?? false)
    }));
  };

  const renderSidebarNavItem = (
    item: { name: string; href: string; icon: NavIcon; badgeCount?: number },
    options?: { nested?: boolean }
  ) => {
    const active = isActive(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.name}
        href={item.href}
        title={sidebarCollapsed ? item.name : undefined}
        aria-label={item.name}
        className={`group relative flex items-center rounded-xl transition-all ${sidebarCollapsed ? 'justify-center px-3 py-3' : 'gap-3 px-4 py-3'} ${!sidebarCollapsed && options?.nested ? (isRTL ? 'mr-3' : 'ml-3') : ''} ${
          active
            ? "bg-gradient-to-r from-primary to-primary/90 text-white shadow-lg"
            : "text-gray-700 hover:bg-gray-100"
        }`}
      >
        {sidebarCollapsed ? (
          <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'}`} />
        ) : isRTL ? (
          <>
            <span className="flex-1 font-medium text-right">{item.name}</span>
            <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'}`} />
          </>
        ) : (
          <>
            <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'}`} />
            <span className="flex-1 font-medium">{item.name}</span>
          </>
        )}
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

  const renderSidebarGroupItem = (item: NavigationGroupItem) => {
    const active = item.children.some((child) => isActive(child.href));
    const expanded = expandedNavGroups[item.key] ?? active;
    const Icon = item.icon;

    return (
      <div key={item.key} className="space-y-1">
        <button
          type="button"
          title={sidebarCollapsed ? item.name : undefined}
          aria-label={item.name}
          onClick={() => {
            if (sidebarCollapsed) {
              setSidebarCollapsed(false);
            }
            toggleNavGroup(item.key);
          }}
          className={`group relative flex w-full items-center rounded-xl transition-all ${sidebarCollapsed ? 'justify-center px-3 py-3' : 'gap-3 px-4 py-3'} ${
            active
              ? "bg-gradient-to-r from-primary to-primary/90 text-white shadow-lg"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          {sidebarCollapsed ? (
            <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'}`} />
          ) : isRTL ? (
            <>
              <ChevronDownIcon className={`h-4 w-4 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''} ${active ? 'text-white' : 'text-gray-400'}`} />
              <span className="flex-1 font-medium text-right">{item.name}</span>
              <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'}`} />
            </>
          ) : (
            <>
              <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'}`} />
              <span className="flex-1 font-medium">{item.name}</span>
              <ChevronDownIcon className={`h-4 w-4 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''} ${active ? 'text-white' : 'text-gray-400'}`} />
            </>
          )}
        </button>

        {!sidebarCollapsed && expanded ? (
          <div className={`space-y-1 ${isRTL ? 'mr-3' : 'ml-3'}`}>
            {item.children
              .filter((child) => child.visible !== false && canAccessPermission(child.permissionKey))
              .map((child) => renderSidebarNavItem(child, { nested: true }))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 lg:h-dvh lg:overflow-hidden">
      {/* Mobile Header */}
      <header className="lg:hidden bg-white/90 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-[60] shadow-sm">
        <div
          className="px-4 py-4 flex items-center justify-between"
          style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
        >
          <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
            <h1 className="text-xl font-bold text-gray-900">{t("dashboard")}</h1>
            <p className="text-sm text-gray-600">{user?.businessName}</p>
          </div>
          <div className="flex items-center gap-2">
            {renderNotificationMenu()}
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

      <div className="hidden lg:grid" style={{ ...shellGridStyle, direction: 'ltr', height: '100dvh', overflow: 'hidden' }}>
        <div
          className="h-full overflow-hidden border-b border-gray-200 bg-white/90 backdrop-blur-lg shadow-sm"
          style={{ gridArea: 'logo' }}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <div className="flex h-full items-center justify-between gap-3 px-4" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
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

        <header
          className="relative z-[2000] h-full overflow-visible border-b border-gray-200 bg-white/90 backdrop-blur-lg shadow-sm"
          style={{ gridArea: 'header' }}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <div
            className={`h-full items-center gap-4 px-6 ${isRTL ? 'flex flex-row-reverse justify-between' : 'grid grid-cols-[minmax(0,1fr)_auto]'}`}
          >
            {isRTL ? (
              <>
                <div className="flex items-center justify-start gap-3" style={{ flexDirection: 'row' }}>
                  {renderNotificationMenu()}

                  <Link
                    href={locale === 'ar' ? pathname?.replace('/ar', '/en') || '/en' : pathname?.replace('/en', '/ar') || '/ar'}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {locale === 'ar' ? 'EN' : 'عربي'}
                  </Link>

                  <div ref={userMenuRef} className="relative isolate z-[10000]">
                    <button
                      ref={userMenuButtonRef}
                      type="button"
                      onClick={() => {
                        setNotificationMenuOpen(false);
                        setUserMenuOpen((current) => !current);
                      }}
                      className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-sm hover:bg-gray-50"
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
                      <div className="min-w-0 text-right">
                        <p className="max-w-[180px] truncate text-sm font-semibold text-gray-900">{displayName}</p>
                        <p className="text-xs text-gray-500">{locale === 'ar' ? 'حساب المركز' : 'Tenant account'}</p>
                      </div>
                      <ChevronDownIcon className={`h-4 w-4 text-gray-500 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {userMenuOpen && (typeof document !== 'undefined' ? createPortal(renderUserMenuPanel(), document.body) : null)}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 min-w-0">
                  <div className="rounded-2xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 text-right">
                    <ClockIcon className="inline-block h-4 w-4 ml-2 align-[-2px]" />
                    {currentDateTimeLabel}
                  </div>
                  <div className="hidden xl:flex min-w-0 items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2 shadow-sm">
                    <span className="truncate text-sm font-semibold text-gray-900">{currentSection}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                      {locale === 'ar' ? 'القسم الحالي' : 'Current section'}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-start gap-3 min-w-0">
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

                <div className="flex items-center justify-end gap-3">
                  {renderNotificationMenu()}

                  <Link
                    href={locale === 'ar' ? pathname?.replace('/ar', '/en') || '/en' : pathname?.replace('/en', '/ar') || '/ar'}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {locale === 'ar' ? 'EN' : 'عربي'}
                  </Link>

                  <div ref={userMenuRef} className="relative isolate z-[10000]">
                    <button
                      ref={userMenuButtonRef}
                      type="button"
                      onClick={() => {
                        setNotificationMenuOpen(false);
                        setUserMenuOpen((current) => !current);
                      }}
                      className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-sm hover:bg-gray-50"
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
                      <div className="min-w-0 text-left">
                        <p className="max-w-[180px] truncate text-sm font-semibold text-gray-900">{displayName}</p>
                        <p className="text-xs text-gray-500">{locale === 'ar' ? 'حساب المركز' : 'Tenant account'}</p>
                      </div>
                      <ChevronDownIcon className={`h-4 w-4 text-gray-500 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {userMenuOpen && (typeof document !== 'undefined' ? createPortal(renderUserMenuPanel(), document.body) : null)}
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        <aside
          className={`relative z-40 h-full flex flex-col bg-white/90 backdrop-blur-lg shadow-xl border-gray-200 overflow-hidden transition-all duration-200 ${
              isRTL ? 'border-l' : 'border-r'
            }`}
          style={{ gridArea: 'sidebar' }}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {navigation.map((item) => item.kind === "group" ? renderSidebarGroupItem(item) : renderSidebarNavItem(item))}
          </nav>
        </aside>

        <main className="relative z-0 min-w-0 h-full overflow-y-auto" style={{ gridArea: 'content', minHeight: 0 }} dir={isRTL ? 'rtl' : 'ltr'}>
          <div className={fullWidth ? 'p-4 lg:p-6' : 'p-4 lg:p-8'}>
            <div className={`mx-auto w-full ${fullWidth ? 'max-w-none' : 'max-w-[1600px]'}`}>
              {children}
            </div>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="grid grid-cols-5 gap-1 p-2">
          {mobileNavigation.slice(0, 5).map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`relative flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-colors ${active ? "bg-primary/10 text-primary" : "text-gray-600"
                  }`}
              >
                <Icon className={`h-5 w-5 ${active ? 'text-primary' : 'text-gray-500'}`} />
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
