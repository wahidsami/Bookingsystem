import { Settings, LogOut } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../data/translations';

// TODO: Restore the following imports when demo data is replaced with live data:
// import { useState } from 'react';
// import { LogOut, Building, Shield, Check, ExternalLink, CalendarDays, Coins } from 'lucide-react';

// TODO: Restore PROFILE_AVATAR_SRC when real user profile data is available from the API.
// const PROFILE_AVATAR_SRC = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
//   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="User avatar">
//     <defs>
//       <linearGradient id="avatarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
//         <stop offset="0%" stop-color="#f59e0b" />
//         <stop offset="100%" stop-color="#ec4899" />
//       </linearGradient>
//     </defs>
//     <rect width="120" height="120" rx="32" fill="url(#avatarGradient)" />
//     <circle cx="60" cy="48" r="24" fill="#fff" fill-opacity="0.92" />
//     <path d="M24 108c7-22 24-32 36-32s29 10 36 32" fill="#fff" fill-opacity="0.92" />
//   </svg>
// `)}`;

interface UserProfileMenuProps {
  lang: Language;
  onClose: () => void;
  onLogout: () => void;
  onSwitchTenant: (tenant: string) => void;
  currentTenant: string;
  onNavigateToSettings?: () => void;
}

export default function UserProfileMenu({
  lang,
  onClose,
  onLogout,
  // onSwitchTenant and currentTenant preserved but unused until tenant switcher is re-enabled
  onNavigateToSettings,
}: UserProfileMenuProps) {
  const t = translations[lang];

  // TODO: Restore availableTenants state when real multi-branch data is available from the API.
  // const [availableTenants] = useState([
  //   { id: 't1', nameAr: 'سبا لا كولين الفاخر - فرع العليا الرياض', nameEn: 'La Colline Luxury Spa - Olaya Riyadh' },
  //   { id: 't2', nameAr: 'مركز تجميل واستجمام بارسبا - فرع الكورنيش جدة', nameEn: 'BarSpa Beauty & Wellness - Corniche Jeddah' },
  //   { id: 't3', nameAr: 'صالون العروس الملكي - فرع الخبر', nameEn: 'Royal Bridal Salon - Khobar Branch' },
  // ]);

  return (
    <div className="w-64 bg-white dark:bg-[#0A0124] rounded-2xl shadow-xl border border-[#E7DDFC] dark:border-[#1D035F] overflow-hidden text-start">

      {/* TODO: Re-enable profile summary card when real user profile data (name, role) is available from the API. */}
      {/* TODO: Re-enable subscription badge when real plan data is available from the billing API. */}

      {/* Production-safe options only */}
      <div className="p-2 space-y-0.5">
        {/* Settings */}
        <button
          onClick={() => {
            onNavigateToSettings?.();
            onClose();
          }}
          className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-[#FAF7FD] dark:hover:bg-[#12023F] text-[#1D035F] dark:text-zinc-200 transition-all text-sm cursor-pointer"
        >
          <Settings size={16} className="text-[#A379E2]" />
          <span>{lang === 'ar' ? 'الإعدادات' : 'Settings'}</span>
        </button>
      </div>

      {/* Sign out */}
      <div className="p-2 border-t border-[#E7DDFC] dark:border-[#1D035F]/60">
        <button
          onClick={() => {
            onLogout();
            onClose();
          }}
          className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 transition-all text-sm font-semibold cursor-pointer"
        >
          <LogOut size={16} />
          <span>{t.logout}</span>
        </button>
      </div>
    </div>
  );
}
