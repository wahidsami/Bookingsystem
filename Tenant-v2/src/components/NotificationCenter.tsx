import { useCallback, useEffect, useState } from 'react';
import { Bell, Check, Calendar, ShieldAlert, Sparkles, MessageSquare, Loader2, TriangleAlert } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../data/translations';
import { tenantApiAdapter } from '../lib/tenantApiAdapter';

interface Notification {
  id: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  timeAr: string;
  timeEn: string;
  type: 'appointment' | 'system' | 'review' | 'inventory';
  unread: boolean;
  sourceType?: string;
}

interface NotificationCenterProps {
  lang: Language;
  onClose: () => void;
}

const POLL_INTERVAL_MS = 60_000;

export default function NotificationCenter({ lang, onClose }: NotificationCenterProps) {
  const t = translations[lang];
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await tenantApiAdapter.getTenantHeaderNotifications({ limit: 12 });
      const nextNotifications = Array.isArray(response?.notifications) ? response.notifications : [];

      setNotifications(nextNotifications);
      setUnreadCount(Number(response?.unreadCount || nextNotifications.filter((item: Notification) => item.unread).length || 0));
      setError(null);
    } catch (loadError: any) {
      setError(loadError?.message || (lang === 'ar' ? 'تعذر تحميل التنبيهات.' : 'Failed to load notifications.'));
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    loadNotifications();
    const timer = window.setInterval(() => {
      loadNotifications();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [loadNotifications]);

  const markAllRead = async () => {
    try {
      await tenantApiAdapter.markAllTenantHeaderNotificationsRead();
      await loadNotifications();
    } catch (markError: any) {
      setError(markError?.message || (lang === 'ar' ? 'تعذر تحديث حالة التنبيهات.' : 'Failed to update notifications.'));
    }
  };

  const markRead = async (notification: Notification) => {
    if (!notification.unread) {
      return;
    }

    try {
      await tenantApiAdapter.markTenantHeaderNotificationRead(notification.id);
      setNotifications((prev) => prev.map((item) => (item.id === notification.id ? { ...item, unread: false } : item)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (markError: any) {
      setError(markError?.message || (lang === 'ar' ? 'تعذر تحديث حالة التنبيه.' : 'Failed to update notification.'));
    }
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'appointment':
        return <Calendar className="text-[#6537C0] dark:text-[#A379E2]" size={16} />;
      case 'inventory':
        return <ShieldAlert className="text-amber-600 dark:text-amber-400" size={16} />;
      case 'review':
        return <Sparkles className="text-rose-600 dark:text-rose-400" size={16} />;
      default:
        return <MessageSquare className="text-blue-600 dark:text-blue-400" size={16} />;
    }
  };

  const getBgClass = (type: Notification['type']) => {
    switch (type) {
      case 'appointment': return 'bg-[#F3EDFC] dark:bg-[#1D035F]';
      case 'inventory': return 'bg-amber-50 dark:bg-amber-950/40';
      case 'review': return 'bg-rose-50 dark:bg-rose-950/40';
      default: return 'bg-blue-50 dark:bg-blue-950/40';
    }
  };

  return (
    <div className="w-80 md:w-96 bg-white dark:bg-[#0A0124] rounded-2xl shadow-xl border border-[#E7DDFC] dark:border-[#1D035F] overflow-hidden text-start">
      {/* Header */}
      <div className="p-4 border-b border-[#E7DDFC] dark:border-[#1D035F]/60 flex items-center justify-between bg-[#FAF7FD] dark:bg-[#12023F]/60">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#1D035F] dark:text-white text-sm md:text-base">
            {t.notifications}
          </span>
          {unreadCount > 0 && (
            <span className="bg-[#6537C0] text-white text-[11px] font-bold px-2 py-0.5 rounded-full font-sans">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-[#6537C0] hover:text-[#1D035F] dark:text-[#A379E2] dark:hover:text-white hover:underline transition-all flex items-center gap-1 font-medium cursor-pointer"
            >
              <Check size={12} />
              {lang === 'ar' ? 'تعليم الكل كمقروء' : 'Mark all read'}
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="max-h-[360px] overflow-y-auto divide-y divide-[#E7DDFC]/60 dark:divide-[#1D035F]/40">
        {loading ? (
          <div className="p-8 text-center text-neutral-400 text-sm">
            <Loader2 size={28} className="mx-auto text-[#A379E2] mb-2 stroke-[1.5] animate-spin" />
            {lang === 'ar' ? 'جارٍ تحميل التنبيهات...' : 'Loading notifications...'}
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-500 text-sm">
            <TriangleAlert size={28} className="mx-auto text-rose-300 mb-2 stroke-[1.5]" />
            <p className="font-semibold">{lang === 'ar' ? 'تعذر تحميل التنبيهات' : 'Unable to load notifications'}</p>
            <p className="mt-1 text-xs text-neutral-400 leading-relaxed">{error}</p>
            <button
              type="button"
              onClick={loadNotifications}
              className="mt-4 text-xs font-semibold text-[#6537C0] dark:text-[#A379E2] hover:underline cursor-pointer"
            >
              {lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-neutral-400 text-sm">
            <Bell size={28} className="mx-auto text-neutral-300 dark:text-[#1D035F] mb-2 stroke-[1.5]" />
            {lang === 'ar' ? 'لا توجد تنبيهات جديدة حالياً' : 'No new notifications.'}
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-4 transition-all hover:bg-[#FAF7FD] dark:hover:bg-[#12023F]/50 flex gap-3 relative group ${
                notification.unread ? 'bg-[#FAF7FD] dark:bg-[#12023F]/30' : ''
              }`}
            >
              {notification.unread && (
                <div className={`absolute top-0 bottom-0 w-1 ${lang === 'ar' ? 'right-0' : 'left-0'} bg-[#6537C0]`} />
              )}

              <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${getBgClass(notification.type)}`}>
                {getIcon(notification.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-1">
                  <p className={`text-xs md:text-sm font-semibold text-[#1D035F] dark:text-zinc-100 truncate ${notification.unread ? 'text-[#1D035F] dark:text-white font-bold' : ''}`}>
                    {lang === 'ar' ? notification.titleAr : notification.titleEn}
                  </p>
                  <span className="text-[10px] text-zinc-400 whitespace-nowrap font-mono shrink-0">
                    {lang === 'ar' ? notification.timeAr : notification.timeEn}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  {lang === 'ar' ? notification.bodyAr : notification.bodyEn}
                </p>

                {notification.unread && (
                  <div className="mt-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => markRead(notification)}
                      className="text-[10px] text-[#6537C0] hover:text-[#1D035F] dark:text-[#A379E2] dark:hover:text-white hover:underline font-medium cursor-pointer"
                    >
                      {lang === 'ar' ? 'تعليم كمقروء' : 'Mark as read'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-[#E7DDFC] dark:border-[#1D035F]/60 bg-[#FAF7FD] dark:bg-[#070119] text-center">
        <button
          onClick={onClose}
          className="text-xs font-semibold text-[#1D035F] dark:text-zinc-300 hover:text-[#6537C0] dark:hover:text-white transition-all hover:underline cursor-pointer"
        >
          {lang === 'ar' ? 'إغلاق نافذة التنبيهات' : 'Close Notifications'}
        </button>
      </div>
    </div>
  );
}
