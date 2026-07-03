import { useState } from 'react';
import { LogOut, Building, Shield, Check, ExternalLink, CalendarDays, Coins } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../data/translations';

interface UserProfileMenuProps {
  lang: Language;
  onClose: () => void;
  onLogout: () => void;
  onSwitchTenant: (tenant: string) => void;
  currentTenant: string;
}

export default function UserProfileMenu({
  lang,
  onClose,
  onLogout,
  onSwitchTenant,
  currentTenant,
}: UserProfileMenuProps) {
  const t = translations[lang];
  const [availableTenants] = useState([
    { id: 't1', nameAr: 'سبا لا كولين الفاخر - فرع العليا الرياض', nameEn: 'La Colline Luxury Spa - Olaya Riyadh' },
    { id: 't2', nameAr: 'مركز تجميل واستجمام رفاه - فرع الكورنيش جدة', nameEn: 'REFAH Beauty & Spa - Corniche Jeddah' },
    { id: 't3', nameAr: 'صالون العروس الملكي - فرع الخبر', nameEn: 'Royal Bridal Salon - Khobar Branch' },
  ]);

  return (
    <div className="w-80 bg-white rounded-2xl shadow-xl border border-neutral-100 overflow-hidden text-start">
      {/* Profile summary card */}
      <div className="p-4 bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-950 text-white">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full border-2 border-brand-200 overflow-hidden shrink-0">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop"
              alt="User Avatar"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h4 className="text-sm md:text-base font-bold text-white tracking-wide">
              {lang === 'ar' ? 'أحمد بن عبد الله' : 'Ahmad Bin Abdullah'}
            </h4>
            <p className="text-xs text-brand-200/90 font-medium">
              {lang === 'ar' ? 'المالك العام والمدير التنفيذي' : 'SaaS Administrator (Owner)'}
            </p>
          </div>
        </div>

        {/* Subscription Badge */}
        <div className="mt-4 pt-3 border-t border-neutral-700/60 flex items-center justify-between">
          <span className="text-[10px] uppercase font-mono tracking-widest text-brand-200/80 flex items-center gap-1">
            <Shield size={10} className="text-brand-300" />
            {lang === 'ar' ? 'باقة بريميوم بلس' : 'PREMIUM PLUS PLAN'}
          </span>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
            {lang === 'ar' ? 'نشط' : 'Active'}
          </span>
        </div>
      </div>

      {/* Main Options */}
      <div className="p-2 space-y-0.5 border-b border-neutral-100">
        <button
          onClick={onClose}
          className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-neutral-50 text-neutral-700 hover:text-neutral-950 transition-all text-sm"
        >
          <div className="flex items-center gap-2.5">
            <CalendarDays size={16} className="text-neutral-400" />
            <span>{t.myAccount}</span>
          </div>
          <ExternalLink size={12} className="text-neutral-300" />
        </button>

        <button
          onClick={onClose}
          className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-neutral-50 text-neutral-700 hover:text-neutral-950 transition-all text-sm"
        >
          <div className="flex items-center gap-2.5">
            <Coins size={16} className="text-neutral-400" />
            <span>{t.businessSettings}</span>
          </div>
          <ExternalLink size={12} className="text-neutral-300" />
        </button>
      </div>

      {/* Tenant switcher */}
      <div className="p-3 bg-neutral-50/70 border-b border-neutral-100">
        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1">
          <Building size={12} />
          {t.switchTenant}
        </p>
        <div className="space-y-1">
          {availableTenants.map((tItem) => {
            const isSelected =
              currentTenant === (lang === 'ar' ? tItem.nameAr : tItem.nameEn);
            return (
              <button
                key={tItem.id}
                onClick={() => {
                  onSwitchTenant(lang === 'ar' ? tItem.nameAr : tItem.nameEn);
                  onClose();
                }}
                className={`w-full text-start p-2 rounded-xl text-xs transition-all flex items-center justify-between ${
                  isSelected
                    ? 'bg-brand-50 border border-brand-100 text-brand-900 font-semibold'
                    : 'bg-white border border-neutral-100 text-neutral-600 hover:border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                <span className="truncate max-w-[200px]">
                  {lang === 'ar' ? tItem.nameAr : tItem.nameEn}
                </span>
                {isSelected && <Check size={12} className="text-brand-600 shrink-0 mx-1" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sign out */}
      <div className="p-2">
        <button
          onClick={() => {
            onLogout();
            onClose();
          }}
          className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-rose-50 text-rose-600 hover:text-rose-700 transition-all text-sm font-semibold"
        >
          <LogOut size={16} />
          <span>{t.logout}</span>
        </button>
      </div>
    </div>
  );
}
