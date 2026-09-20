import React, { useState } from 'react';
import { Award, Star, Gift, ShieldCheck, Sparkles, TrendingUp, Users, ArrowUpRight, Check, HelpCircle, AlertCircle, Sliders } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../data/translations';

interface LoyaltyWorkspaceProps {
  lang: Language;
  darkMode?: boolean;
}

export default function LoyaltyWorkspace({ lang, darkMode = false }: LoyaltyWorkspaceProps) {
  const isRtl = lang === 'ar';
  const t = translations[lang];

  // Loyalty Program Rules Configuration
  const [pointsPerRiyal, setPointsPerRiyal] = useState(1);
  const [riyalPerPoints, setRiyalPerPoints] = useState(10); // 100 points = 10 SAR
  const [minRedemptionPoints, setMinRedemptionPoints] = useState(100);
  const [pointsExpiryMonths, setPointsExpiryMonths] = useState(12);
  const [isSaved, setIsSaved] = useState(false);

  const tiers = [
    {
      id: 'bronze',
      nameAr: 'العضوية البرونزية',
      nameEn: 'Bronze Member',
      minPoints: 0,
      multiplier: '1.0x',
      color: 'from-amber-700 to-amber-900',
      badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
      perksAr: ['اكتساب نقطة مقابل كل ريال', 'هدية ترحيبية عند أول زيارة', 'إشعارات العروض الخاصة'],
      perksEn: ['1 pt per 1 SAR spent', 'Welcome gift on first visit', 'Exclusive promotions access'],
      membersCount: 142
    },
    {
      id: 'silver',
      nameAr: 'العضوية الفضية',
      nameEn: 'Silver VIP',
      minPoints: 500,
      multiplier: '1.25x',
      color: 'from-slate-400 to-slate-600',
      badgeBg: 'bg-slate-100 text-slate-900 border-slate-300',
      perksAr: ['مضاعف ١.٢٥ نقطة لكل ريال', 'أولوية الحجز في أوقات الذروة', 'خصم ٥٪ على منتجات العناية'],
      perksEn: ['1.25x points multiplier', 'Peak hour booking priority', '5% discount on retail products'],
      membersCount: 68
    },
    {
      id: 'gold',
      nameAr: 'العضوية الذهبية',
      nameEn: 'Gold Elite',
      minPoints: 1500,
      multiplier: '1.5x',
      color: 'from-amber-400 to-amber-600',
      badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
      perksAr: ['مضاعف ١.٥ نقطة لكل ريال', 'جلسة مساج علاجي مجانية سنوياً', 'خصم ١٠٪ على جميع الخدمات والمنتجات'],
      perksEn: ['1.5x points multiplier', '1 complimentary annual therapy session', '10% discount on all services & retail'],
      membersCount: 31
    },
    {
      id: 'platinum',
      nameAr: 'العضوية البلاتينية الملكية',
      nameEn: 'Platinum Royal VIP',
      minPoints: 3500,
      multiplier: '2.0x',
      color: 'from-[#1D035F] to-[#6537C0]',
      badgeBg: 'bg-purple-100 text-purple-950 border-purple-300',
      perksAr: ['مضاعف مضاعف ٢.٠x لكل ريال', 'جناح VIP خاص ومشروبات مجانية فاخرة', 'خدمة الكونسيرج ومرافقة خاصة للمواعيد'],
      perksEn: ['2.0x points multiplier', 'Private VIP luxury suite access', 'Dedicated concierge & personalized booking'],
      membersCount: 12
    }
  ];

  const handleSaveRules = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className={`space-y-8 animate-fadeIn font-sans ${isRtl ? 'rtl' : 'ltr'}`}>
      
      {/* Top Header Banner */}
      <div className={`p-6 sm:p-8 rounded-3xl border transition-all ${
        darkMode 
          ? 'bg-[#0A0124] border-[#1D035F] text-zinc-100' 
          : 'bg-gradient-to-br from-white via-purple-50/30 to-[#FAF7FD] border-[#E7DDFC] shadow-xs'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F3EDFC] dark:bg-[#1D035F]/60 border border-[#A379E2]/30 text-[#6537C0] dark:text-[#A379E2] text-xs font-bold">
              <Award size={14} />
              <span>{isRtl ? 'برنامج ولاء ومكافآت بارسبا المعتمد' : 'BarSpa Certified Loyalty Engine'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {isRtl ? 'برنامج الولاء والمكافآت الفاخرة' : 'Customer Loyalty & Rewards Program'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 max-w-2xl leading-relaxed">
              {isRtl 
                ? 'إدارة مستويات العضوية التلقائية، قواعد اكتساب النقاط الذكية، ومتابعة أرصدة مكافآت العملاء المرتبطة مباشرة بملفات الـ CRM.'
                : 'Manage automated membership tiers, earning rules, and track customer rewards balances synchronized with the CRM registry.'}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-center p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs">
              <p className="text-[10px] uppercase font-bold text-slate-400">{isRtl ? 'إجمالي الأعضاء' : 'Total Members'}</p>
              <p className="text-xl font-black font-mono text-[#1D035F] dark:text-[#A379E2] mt-0.5">253</p>
            </div>
            <div className="text-center p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs">
              <p className="text-[10px] uppercase font-bold text-slate-400">{isRtl ? 'النقاط المصروفة' : 'Points Issued'}</p>
              <p className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">84.2K</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tiers Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-[#6537C0]" />
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              {isRtl ? 'مستويات وفئات العضوية' : 'Membership Tiers & VIP Benefits'}
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-semibold">
            {isRtl ? '٤ فئات تصنيفية معتمدة' : '4 Certified VIP Tiers'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`rounded-2xl border p-5 flex flex-col justify-between transition-all hover:shadow-md ${
                darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-2xs'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      {isRtl ? tier.nameAr : tier.nameEn}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {tier.minPoints > 0 
                        ? (isRtl ? `يبدأ من ${tier.minPoints} نقطة` : `From ${tier.minPoints} pts`)
                        : (isRtl ? 'المستوى الأساسي الترحيبي' : 'Base welcome tier')}
                    </p>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${tier.badgeBg}`}>
                    {tier.multiplier}
                  </span>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {isRtl ? 'مزايا الفئة:' : 'Tier Perks:'}
                  </p>
                  <ul className="space-y-1.5">
                    {(isRtl ? tier.perksAr : tier.perksEn).map((perk, i) => (
                      <li key={i} className="text-xs text-slate-600 dark:text-zinc-300 flex items-start gap-1.5 leading-tight">
                        <Check size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                <span className="text-slate-400 text-[11px]">{isRtl ? 'الأعضاء النشطين:' : 'Active Members:'}</span>
                <span className="font-bold font-mono text-slate-800 dark:text-zinc-200">{tier.membersCount}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Program Rules Configuration Form */}
      <div className={`p-6 sm:p-8 rounded-3xl border ${
        darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-2xs'
      }`}>
        <div className="flex items-center gap-2 mb-6">
          <Sliders size={18} className="text-[#6537C0]" />
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              {isRtl ? 'قواعد احتساب واكتساب واستبدال النقاط' : 'Earning & Redemption Conversion Rules'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              {isRtl ? 'تحديد معادلات التحويل المالية بين الريال السعودي ورصيد النقاط' : 'Configure financial exchange ratios between SAR and loyalty credits'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveRules} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Rule 1 */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
                {isRtl ? 'النقاط المكتسبة لكل ١ ر.س' : 'Points Earned per 1 SAR'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={pointsPerRiyal}
                  onChange={(e) => setPointsPerRiyal(parseFloat(e.target.value) || 1)}
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-[#1D035F]"
                />
                <span className={`absolute top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold ${isRtl ? 'left-3' : 'right-3'}`}>
                  {isRtl ? 'نقطة' : 'pts'}
                </span>
              </div>
            </div>

            {/* Rule 2 */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
                {isRtl ? 'قيمة الخصم لكل ١٠٠ نقطة' : 'Discount Value per 100 pts'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={riyalPerPoints}
                  onChange={(e) => setRiyalPerPoints(parseInt(e.target.value) || 10)}
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-[#1D035F]"
                />
                <span className={`absolute top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold ${isRtl ? 'left-3' : 'right-3'}`}>
                  {isRtl ? 'ر.س' : 'SAR'}
                </span>
              </div>
            </div>

            {/* Rule 3 */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
                {isRtl ? 'الحد الأدنى للنقاط للاستبدال' : 'Min Points to Redeem'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="10"
                  step="10"
                  value={minRedemptionPoints}
                  onChange={(e) => setMinRedemptionPoints(parseInt(e.target.value) || 100)}
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-[#1D035F]"
                />
                <span className={`absolute top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold ${isRtl ? 'left-3' : 'right-3'}`}>
                  {isRtl ? 'نقطة' : 'pts'}
                </span>
              </div>
            </div>

            {/* Rule 4 */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
                {isRtl ? 'صلاحية انتهاء النقاط' : 'Points Expiration'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="36"
                  value={pointsExpiryMonths}
                  onChange={(e) => setPointsExpiryMonths(parseInt(e.target.value) || 12)}
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-[#1D035F]"
                />
                <span className={`absolute top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold ${isRtl ? 'left-3' : 'right-3'}`}>
                  {isRtl ? 'شهراً' : 'months'}
                </span>
              </div>
            </div>

          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
              <span>
                {isRtl 
                  ? 'يتم تطبيق قواعد التحويل تلقائياً عند إتمام المواعيد أو مشتريات نقاط البيع.' 
                  : 'Conversion rules are applied automatically upon appointment or POS checkout.'}
              </span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              {isSaved && (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 animate-fadeIn">
                  <Check size={14} />
                  <span>{isRtl ? 'تم حفظ القواعد وتحديث المعايير!' : 'Rules updated successfully!'}</span>
                </span>
              )}
              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#1D035F] hover:bg-[#2E0B7A] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                {isRtl ? 'حفظ إعدادات الولاء' : 'Save Loyalty Settings'}
              </button>
            </div>
          </div>
        </form>
      </div>

    </div>
  );
}
