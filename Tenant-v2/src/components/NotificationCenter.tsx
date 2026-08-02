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
        return <Calendar className="text-brand-600" size={16} />;
      case 'inventory':
        return <ShieldAlert className="text-amber-600" size={16} />;
      case 'review':
        return <Sparkles className="text-rose-600" size={16} />;
      default:
        return <MessageSquare className="text-blue-600" size={16} />;
    }
  };

  const getBgClass = (type: Notification['type']) => {
    switch (type) {
      case 'appointment': return 'bg-brand-50';
      case 'inventory': return 'bg-amber-50';
      case 'review': return 'bg-rose-50';
      default: return 'bg-blue-50';
    }
  };

  return (
    <div className="w-80 md:w-96 bg-white rounded-2xl shadow-xl border border-neutral-100 overflow-hidden text-start">
      {/* Header */}
      <div className="p-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-neutral-800 text-sm md:text-base">
            {t.notifications}
          </span>
          {unreadCount > 0 && (
            <span className="bg-brand-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full font-sans">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-brand-600 hover:text-brand-800 hover:underline transition-all flex items-center gap-1 font-medium"
            >
              <Check size={12} />
              {lang === 'ar' ? 'تعليم الكل كمقروء' : 'Mark all read'}
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="max-h-[360px] overflow-y-auto divide-y divide-neutral-100">
        {loading ? (
          <div className="p-8 text-center text-neutral-400 text-sm">
            <Loader2 size={28} className="mx-auto text-neutral-300 mb-2 stroke-[1.5] animate-spin" />
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
              className="mt-4 text-xs font-semibold text-brand-700 hover:underline"
            >
              {lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-neutral-400 text-sm">
            <Bell size={28} className="mx-auto text-neutral-300 mb-2 stroke-[1.5]" />
            {lang === 'ar' ? 'لا توجد تنبيهات جديدة حالياً' : 'No new notifications.'}
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-4 transition-all hover:bg-neutral-50 flex gap-3 relative group ${
                notification.unread ? 'bg-brand-50/30' : ''
              }`}
            >
              {notification.unread && (
                <div className={`absolute top-0 bottom-0 w-1 ${lang === 'ar' ? 'right-0' : 'left-0'} bg-brand-600`} />
              )}

              <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${getBgClass(notification.type)}`}>
                {getIcon(notification.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-1">
                  <p className={`text-xs md:text-sm font-semibold text-neutral-800 truncate ${notification.unread ? 'text-brand-950 font-bold' : ''}`}>
                    {lang === 'ar' ? notification.titleAr : notification.titleEn}
                  </p>
                  <span className="text-[10px] text-neutral-400 whitespace-nowrap font-mono shrink-0">
                    {lang === 'ar' ? notification.timeAr : notification.timeEn}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                  {lang === 'ar' ? notification.bodyAr : notification.bodyEn}
                </p>

                {notification.unread && (
                  <div className="mt-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => markRead(notification)}
                      className="text-[10px] text-brand-600 hover:text-brand-800 hover:underline font-medium"
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
      <div className="p-3 border-t border-neutral-100 bg-neutral-50 text-center">
        <button
          onClick={onClose}
          className="text-xs font-semibold text-neutral-600 hover:text-brand-700 transition-all hover:underline"
        >
          {lang === 'ar' ? 'إغلاق نافذة التنبيهات' : 'Close Notifications'}
        </button>
      </div>
    </div>
  );
}
