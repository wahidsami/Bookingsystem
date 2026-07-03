import { useState } from 'react';
import { Bell, Check, Trash2, Calendar, ShieldAlert, Sparkles, MessageSquare } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../data/translations';

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
}

interface NotificationCenterProps {
  lang: Language;
  onClose: () => void;
}

export default function NotificationCenter({ lang, onClose }: NotificationCenterProps) {
  const t = translations[lang];
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: 'n1',
      titleAr: 'حجز مؤكد جديد',
      titleEn: 'New Confirmed Appointment',
      bodyAr: 'قامت سارة أحمد بحجز جلسة مساج الأحجار الساخنة غداً الساعة ٤:٣٠ م مع نادين الحربي.',
      bodyEn: 'Sarah Ahmed booked a Hot Stone Massage session tomorrow at 4:30 PM with Nadeen Al-Harbi.',
      timeAr: 'منذ دقيقتين',
      timeEn: '2 mins ago',
      type: 'appointment',
      unread: true,
    },
    {
      id: 'n2',
      titleAr: 'تنبيه تدني المخزون ⚠️',
      titleEn: 'Low Stock Alert ⚠️',
      bodyAr: 'شامبو الترطيب العميق العضوي تبقت منه قطعتان فقط في المستودع الرئيسي.',
      bodyEn: 'Sulfate-Free Organic Deep Hydration Shampoo has only 2 items left in stock.',
      timeAr: 'منذ ساعة',
      timeEn: '1 hour ago',
      type: 'inventory',
      unread: true,
    },
    {
      id: 'n3',
      titleAr: 'تقييم ممتاز ٥ نجوم ⭐',
      titleEn: 'New 5-Star Review ⭐',
      bodyAr: 'كتبت مها الشمري: "أفضل تجربة صالون في الرياض على الإطلاق، الديكور فاخر والمعاملة راقية جداً".',
      bodyEn: 'Maha Al-Shammari reviewed: "Best salon experience in Riyadh, extremely luxurious decor and elegant team."',
      timeAr: 'منذ ٤ ساعات',
      timeEn: '4 hours ago',
      type: 'review',
      unread: false,
    },
    {
      id: 'n4',
      titleAr: 'تحديث اشتراك رفاه السحابي',
      titleEn: 'REFAH Subscription Renewed',
      bodyAr: 'تم بنجاح خصم الدفعة الشهرية لصالون سبا لا كولين الفاخر. الباقة مفعلة بالكامل.',
      bodyEn: 'Monthly SaaS payment completed successfully for La Colline Luxury Spa. Plan fully active.',
      timeAr: 'أمس الساعة ٩:٠٠ ص',
      timeEn: 'Yesterday 9:00 AM',
      type: 'system',
      unread: false,
    },
  ]);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const toggleRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, unread: !n.unread } : n));
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

  const unreadCount = notifications.filter(n => n.unread).length;

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
              {lang === 'ar' ? 'مقروءة' : 'Mark all read'}
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-neutral-400 hover:text-rose-600 hover:underline transition-all flex items-center gap-1 font-medium"
            >
              <Trash2 size={12} />
              {lang === 'ar' ? 'مسح' : 'Clear all'}
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="max-h-[360px] overflow-y-auto divide-y divide-neutral-100">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-neutral-400 text-sm">
            <Bell size={28} className="mx-auto text-neutral-300 mb-2 stroke-[1.5]" />
            {lang === 'ar' ? 'لا توجد تنبيهات جديدة حالياً' : 'No new notifications.'}
          </div>
        ) : (
          notifications.map(n => (
            <div
              key={n.id}
              className={`p-4 transition-all hover:bg-neutral-50 flex gap-3 relative group ${
                n.unread ? 'bg-brand-50/30' : ''
              }`}
            >
              {/* Left Stripe status */}
              {n.unread && (
                <div className={`absolute top-0 bottom-0 w-1 ${lang === 'ar' ? 'right-0' : 'left-0'} bg-brand-600`} />
              )}

              {/* Icon Container */}
              <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${getBgClass(n.type)}`}>
                {getIcon(n.type)}
              </div>

              {/* Text Area */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-1">
                  <p className={`text-xs md:text-sm font-semibold text-neutral-800 truncate ${n.unread ? 'text-brand-950 font-bold' : ''}`}>
                    {lang === 'ar' ? n.titleAr : n.titleEn}
                  </p>
                  <span className="text-[10px] text-neutral-400 whitespace-nowrap font-mono shrink-0">
                    {lang === 'ar' ? n.timeAr : n.timeEn}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                  {lang === 'ar' ? n.bodyAr : n.bodyEn}
                </p>
                
                {/* Micro Action */}
                <div className="mt-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => toggleRead(n.id)}
                    className="text-[10px] text-brand-600 hover:text-brand-800 hover:underline font-medium"
                  >
                    {n.unread 
                      ? (lang === 'ar' ? 'تعليم كمقروء' : 'Mark as read') 
                      : (lang === 'ar' ? 'تعليم كغير مقروء' : 'Mark as unread')}
                  </button>
                </div>
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
