import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Activity, Sparkles, ShoppingBag, Calendar, CheckCircle2, 
  AlertTriangle, RefreshCw, PlusCircle, CreditCard, UserCheck, Trash2
} from 'lucide-react';
import { Language } from '../types';

interface ActivityItem {
  id: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  timeAr: string;
  timeEn: string;
  type: 'sale' | 'booking' | 'system' | 'checkin' | 'alert';
  badgeColor: string;
}

interface ActivityCenterProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  darkMode?: boolean;
}

export default function ActivityCenter({ isOpen, onClose, lang, darkMode = false }: ActivityCenterProps) {
  const isRtl = lang === 'ar';
  
  // Base mock activities
  const [activities, setActivities] = useState<ActivityItem[]>([
    {
      id: 'act-1',
      titleAr: 'مبيعات ناجحة - كارت هدايا 💳',
      titleEn: 'Gift Card Sale - ZATCA Compliant',
      descriptionAr: 'تم إصدار فاتورة مبيعات مبسطة رقم #INV-2938 بقيمة ٥٠٠ ر.س للعميلة غادة العتيبي.',
      descriptionEn: 'Simplified e-Invoice #INV-2938 issued for 500 SAR to customer Ghada Al-Otaibi.',
      timeAr: 'منذ دقيقة',
      timeEn: '1 min ago',
      type: 'sale',
      badgeColor: 'bg-emerald-500'
    },
    {
      id: 'act-2',
      titleAr: 'تسجيل دخول العميلة 🔔',
      titleEn: 'VIP Customer Checked-In',
      descriptionAr: 'وصلت العميلة نورة عبد العزيز الآن إلى فرع صالون العليا، وجاري تجهيز غرفة المساج العلاجي.',
      descriptionEn: 'VIP client Noura Abdulaziz arrived at Olaya branch. Therapy suite preparation initiated.',
      timeAr: 'منذ ٥ دقائق',
      timeEn: '5 mins ago',
      type: 'checkin',
      badgeColor: 'bg-blue-500'
    },
    {
      id: 'act-3',
      titleAr: 'تأكيد حجز خدمة تصفيف 💇‍♀️',
      titleEn: 'Hairstyling Booking Confirmed',
      descriptionAr: 'تم تأكيد حجز "قص وصبغة مع دلال" للعميلة سارة الأحمد غداً الساعة ٦:٠٠ م.',
      descriptionEn: 'Confirmed "Haircut & Color with Dalal" for Sarah Al-Ahmed tomorrow at 6:00 PM.',
      timeAr: 'منذ ٢٠ دقيقة',
      timeEn: '20 mins ago',
      type: 'booking',
      badgeColor: 'bg-rose-500'
    },
    {
      id: 'act-4',
      titleAr: 'تنبيه تدني المخزون ⚠️',
      titleEn: 'Low Stock Threshold Reached',
      descriptionAr: 'المنتج "سيروم الورد العضوي" انخفض إلى قطعتين فقط في مستودع العليا.',
      descriptionEn: 'Product "Organic Rose Serum" dropped below threshold (2 left) in Olaya warehouse.',
      timeAr: 'منذ ساعة',
      timeEn: '1 hour ago',
      type: 'alert',
      badgeColor: 'bg-amber-500'
    },
    {
      id: 'act-5',
      titleAr: 'تحديث حالة الموظف 💼',
      titleEn: 'Staff Shift Rotation Updated',
      descriptionAr: 'الأخصائية نادين الحربي انتقلت إلى حالة "استراحة غداء".',
      descriptionEn: 'Specialist Nadeen Al-Harbi updated status to "Lunch Break".',
      timeAr: 'منذ ساعتين',
      timeEn: '2 hours ago',
      type: 'system',
      badgeColor: 'bg-zinc-500'
    }
  ]);

  const [filter, setFilter] = useState<'all' | 'sale' | 'booking' | 'alert'>('all');

  const filteredActivities = activities.filter(act => {
    if (filter === 'all') return true;
    return act.type === filter;
  });

  // Action: Interactive Simulation
  const simulateCheckin = () => {
    const names = isRtl 
      ? ['هيفاء آل سعود', 'رهف الشمري', 'ديما عبد الله', 'خلود الرياض']
      : ['Haifa Al-Saud', 'Rahaf Al-Shammari', 'Dima Abdullah', 'Kholoud Riyadh'];
    
    const selectedName = names[Math.floor(Math.random() * names.length)];
    const id = 'sim-' + Math.random().toString(36).substr(2, 5);
    
    const newAct: ActivityItem = {
      id,
      titleAr: 'وصول وتسجيل دخول عميل 🌟',
      titleEn: 'VIP Client Arrived & Checked-In',
      descriptionAr: `العميلة ${selectedName} سجلت دخولها للصالون الآن عبر مسح رمز الاستجابة السريعة QR.`,
      descriptionEn: `Customer ${selectedName} checked-in via premium QR scan. Welcome protocol started.`,
      timeAr: 'الآن',
      timeEn: 'Just now',
      type: 'checkin',
      badgeColor: 'bg-blue-500'
    };

    setActivities(prev => [newAct, ...prev]);
  };

  const simulateSale = () => {
    const id = 'sim-' + Math.random().toString(36).substr(2, 5);
    const amount = Math.floor(150 + Math.random() * 850);
    const num = Math.floor(1000 + Math.random() * 9000);

    const newAct: ActivityItem = {
      id,
      titleAr: 'فاتورة سحابية مدمجة مع ZATCA 🧾',
      titleEn: 'Cloud simplified e-Invoice Approved',
      descriptionAr: `تم دفع ${amount} ر.س ومزامنة الفاتورة رقم #FT-${num} مع هيئة الزكاة والضريبة والجمارك بالكامل.`,
      descriptionEn: `Payment of ${amount} SAR processed. e-Invoice #FT-${num} successfully signed with ZATCA authority.`,
      timeAr: 'الآن',
      timeEn: 'Just now',
      type: 'sale',
      badgeColor: 'bg-emerald-500'
    };

    setActivities(prev => [newAct, ...prev]);
  };

  const simulateAlert = () => {
    const id = 'sim-' + Math.random().toString(36).substr(2, 5);
    const items = isRtl 
      ? ['شامبو زيت الأرغان المغربي', 'صبغة الشعر البلاتينية', 'رداء الحرير الملكي']
      : ['Moroccan Argan Shampoo', 'Platinum Hair Dye', 'Royal Silk Robe'];
    
    const selectedItem = items[Math.floor(Math.random() * items.length)];

    const newAct: ActivityItem = {
      id,
      titleAr: 'تنبيه عاجل لإعادة طلب مستلزمات ⚠️',
      titleEn: 'Critical Asset Stock Warning ⚠️',
      descriptionAr: `منتج المستلزمات "${selectedItem}" انتهى تماماً من المخزن اليوم! يرجى التواصل مع المورد المعتمد.`,
      descriptionEn: `Inventory product "${selectedItem}" completely out of stock today! Action required to reorder.`,
      timeAr: 'الآن',
      timeEn: 'Just now',
      type: 'alert',
      badgeColor: 'bg-rose-500'
    };

    setActivities(prev => [newAct, ...prev]);
  };

  const clearAll = () => {
    setActivities([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      <div className="absolute inset-0 overflow-hidden">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-neutral-950/60 backdrop-blur-xs transition-opacity"
        />

        {/* Sliding Panel */}
        <div className={`fixed inset-y-0 max-w-full flex ${isRtl ? 'left-0' : 'right-0'}`}>
          <motion.div
            initial={{ x: isRtl ? '-100%' : '100%' }}
            animate={{ x: 0 }}
            exit={{ x: isRtl ? '-100%' : '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className={`w-screen max-w-md flex flex-col h-full shadow-2xl border-l overflow-hidden transition-colors duration-200 ${
              darkMode 
                ? 'bg-zinc-900 border-zinc-800 text-zinc-100' 
                : 'bg-white border-neutral-100 text-neutral-800'
            }`}
          >
            {/* Header */}
            <div className={`p-5 flex items-center justify-between border-b ${
              darkMode ? 'border-zinc-800 bg-zinc-950/45' : 'border-neutral-100 bg-neutral-50/50'
            }`}>
              <div className="flex items-center gap-2.5">
                <span className={`p-2 rounded-xl shrink-0 ${darkMode ? 'bg-zinc-800 text-brand-400' : 'bg-brand-50 text-brand-600'}`}>
                  <Activity size={18} className="animate-pulse" />
                </span>
                <div>
                  <h3 className="text-sm md:text-base font-extrabold tracking-tight">
                    {isRtl ? 'مركز العمليات والنشاط المباشر' : 'Live Activity & Operations Hub'}
                  </h3>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    {isRtl ? 'سجل العمليات والرقابة الذاتية الفورية' : 'Real-time e-invoice audit & salon logs'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-neutral-200/50 rounded-lg text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick Interactive Simulation Controls (Enterprise Sandbox) */}
            <div className={`p-4 border-b flex flex-col gap-2 ${
              darkMode ? 'bg-zinc-950/20 border-zinc-800' : 'bg-brand-50/20 border-neutral-100'
            }`}>
              <span className="text-[9px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-widest block">
                {isRtl ? '🛠️ أدوات المحاكاة والتحكم الفوري (ساندبوكس)' : '🛠️ ENTERPRISE SIMULATION TOOLS'}
              </span>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <button
                  onClick={simulateCheckin}
                  className="px-2 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  <UserCheck size={11} />
                  <span>{isRtl ? 'دخول عميل' : 'Check-In'}</span>
                </button>
                <button
                  onClick={simulateSale}
                  className="px-2 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  <CreditCard size={11} />
                  <span>{isRtl ? 'فاتورة زكاة' : 'e-Invoice'}</span>
                </button>
                <button
                  onClick={simulateAlert}
                  className="px-2 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  <AlertTriangle size={11} />
                  <span>{isRtl ? 'نفاد مخزن' : 'Stock Alert'}</span>
                </button>
              </div>
            </div>

            {/* Segment Controls */}
            <div className={`px-4 py-2.5 flex items-center justify-between border-b text-[11px] font-semibold ${
              darkMode ? 'border-zinc-800 bg-zinc-900/50' : 'border-neutral-50 bg-neutral-50/20'
            }`}>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-2.5 py-1 rounded-md transition-all ${filter === 'all' ? 'bg-zinc-900 text-white dark:bg-zinc-800' : 'text-zinc-400 hover:text-zinc-600'}`}
                >
                  {isRtl ? 'الكل' : 'All'}
                </button>
                <button
                  onClick={() => setFilter('sale')}
                  className={`px-2.5 py-1 rounded-md transition-all ${filter === 'sale' ? 'bg-zinc-900 text-white dark:bg-zinc-800' : 'text-zinc-400 hover:text-zinc-600'}`}
                >
                  {isRtl ? 'المبيعات' : 'Sales'}
                </button>
                <button
                  onClick={() => setFilter('booking')}
                  className={`px-2.5 py-1 rounded-md transition-all ${filter === 'booking' ? 'bg-zinc-900 text-white dark:bg-zinc-800' : 'text-zinc-400 hover:text-zinc-600'}`}
                >
                  {isRtl ? 'الحجوزات' : 'Bookings'}
                </button>
                <button
                  onClick={() => setFilter('alert')}
                  className={`px-2.5 py-1 rounded-md transition-all ${filter === 'alert' ? 'bg-zinc-900 text-white dark:bg-zinc-800' : 'text-zinc-400 hover:text-zinc-600'}`}
                >
                  {isRtl ? 'تنبيهات' : 'Alerts'}
                </button>
              </div>

              {activities.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-zinc-400 hover:text-rose-500 flex items-center gap-0.5"
                >
                  <Trash2 size={11} />
                  <span>{isRtl ? 'تفريغ' : 'Clear'}</span>
                </button>
              )}
            </div>

            {/* Activities list */}
            <div className="flex-1 overflow-y-auto p-4 divide-y divide-neutral-100/50 dark:divide-zinc-800/50 max-h-[calc(100vh-220px)]">
              {filteredActivities.length === 0 ? (
                <div className="text-center py-16 text-zinc-400">
                  <Activity size={32} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-3 stroke-[1.5]" />
                  <p className="text-xs font-semibold">{isRtl ? 'السجل فارغ حالياً' : 'Log is currently empty'}</p>
                  <p className="text-[10px] text-zinc-400 mt-1">{isRtl ? 'استخدم أدوات المحاكاة أعلاه لتوليد حركات تجريبية فورية!' : 'Use the simulation tools above to generate instant test actions!'}</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {filteredActivities.map((act) => (
                    <motion.div
                      key={act.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="py-3.5 flex gap-3 relative first:pt-0 hover:bg-neutral-50/20 dark:hover:bg-zinc-800/10 rounded-lg px-2 transition-all group"
                    >
                      {/* Left indicator bubble */}
                      <span className={`w-2 h-2 rounded-full ${act.badgeColor} mt-1.5 shrink-0`} />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-1">
                          <p className="text-xs font-bold truncate">
                            {isRtl ? act.titleAr : act.titleEn}
                          </p>
                          <span className="text-[9px] text-zinc-400 whitespace-nowrap font-mono shrink-0">
                            {isRtl ? act.timeAr : act.timeEn}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                          {isRtl ? act.descriptionAr : act.descriptionEn}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Footer with statutory indicator */}
            <div className={`p-4 border-t text-center text-[10px] text-zinc-500 transition-colors ${
              darkMode ? 'border-zinc-800 bg-zinc-950/30' : 'border-neutral-100 bg-neutral-50/60'
            }`}>
              <p className="flex items-center justify-center gap-1 font-sans">
                <CheckCircle2 size={12} className="text-emerald-500" />
                <span>{isRtl ? 'الربط السحابي النشط متزامن مع ZATCA والأنظمة' : 'ZATCA e-Invoicing Phase 2 Fully Connected'}</span>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
