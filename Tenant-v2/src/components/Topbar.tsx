import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, Bell, Plus, Sparkle, Globe, ChevronDown, Check, 
  User, Shield, CalendarDays, KeyRound, LogOut, Info, AlertTriangle,
  Moon, Sun, Activity
} from 'lucide-react';
import { Language, ViewType, TabItem } from '../types';
import { translations } from '../data/translations';
import Breadcrumbs from './Breadcrumbs';
import Tabs from './Tabs';
import NotificationCenter from './NotificationCenter';
import UserProfileMenu from './UserProfileMenu';

const PROFILE_AVATAR_SRC = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="User avatar">
    <defs>
      <linearGradient id="avatarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#6537C0" />
        <stop offset="100%" stop-color="#1D035F" />
      </linearGradient>
    </defs>
    <rect width="96" height="96" rx="24" fill="url(#avatarGradient)" />
    <circle cx="48" cy="38" r="18" fill="#fff" fill-opacity="0.92" />
    <path d="M18 86c6-18 19-26 30-26s24 8 30 26" fill="#fff" fill-opacity="0.92" />
  </svg>
`)}`;

interface TopbarProps {
  lang: Language;
  onToggleLang: () => void;
  activeView: ViewType;
  onOpenSearch: () => void;
  onQuickAction: (type: 'appointment' | 'customer' | 'service' | 'product' | 'employee' | 'giftcard') => void;
  
  // Tabs management
  tabs: TabItem[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;

  // Tenant/Shop name
  currentTenant: string;
  onSwitchTenant: (tenant: string) => void;
  onLogout: () => void;

  // Personalization & Dark Mode
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
  // TODO: Re-enable Operations Hub after replacing demo data with real live events.
  onOpenActivityCenter?: () => void;
  onNavigateToSettings?: () => void;
}

export default function Topbar({
  lang,
  onToggleLang,
  activeView,
  onOpenSearch,
  onQuickAction,
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  currentTenant,
  onSwitchTenant,
  onLogout,
  darkMode = false,
  onToggleDarkMode,
  onOpenActivityCenter,
  onNavigateToSettings
}: TopbarProps) {
  const t = translations[lang];
  const isRtl = lang === 'ar';

  // Popover States
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [quickCreateMenuStyle, setQuickCreateMenuStyle] = useState<CSSProperties | null>(null);
  const [notificationsMenuStyle, setNotificationsMenuStyle] = useState<CSSProperties | null>(null);
  const [profileMenuStyle, setProfileMenuStyle] = useState<CSSProperties | null>(null);

  // Refs for closing on outside click
  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const quickCreateRef = useRef<HTMLDivElement>(null);
  const notificationsMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const quickCreateMenuRef = useRef<HTMLDivElement>(null);

  const resolveAnchoredMenuStyle = (button: HTMLDivElement | null, menuWidth: number) => {
    if (!button || typeof window === 'undefined') {
      return null;
    }

    const buttonRect = button.getBoundingClientRect();
    const top = Math.max(12, Math.round(buttonRect.bottom + 8));
    const viewportPadding = 12;
    const actualWidth = Math.min(menuWidth, Math.max(160, window.innerWidth - (viewportPadding * 2)));

    if (isRtl) {
      const left = Math.min(
        Math.max(viewportPadding, Math.round(buttonRect.left)),
        Math.max(viewportPadding, window.innerWidth - actualWidth - viewportPadding)
      );

      return {
        position: 'fixed',
        top,
        left,
        width: actualWidth,
        zIndex: 9999
      } satisfies CSSProperties;
    }

    const left = Math.min(
      Math.max(viewportPadding, Math.round(buttonRect.right - actualWidth)),
      Math.max(viewportPadding, window.innerWidth - actualWidth - viewportPadding)
    );

    return {
      position: 'fixed',
      top,
      left,
      width: actualWidth,
      zIndex: 9999
    } satisfies CSSProperties;
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        if (notificationsMenuRef.current?.contains(event.target as Node)) {
          return;
        }
        setIsNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        if (profileMenuRef.current?.contains(event.target as Node)) {
          return;
        }
        setIsProfileOpen(false);
      }
      if (quickCreateRef.current && !quickCreateRef.current.contains(event.target as Node)) {
        if (quickCreateMenuRef.current?.contains(event.target as Node)) {
          return;
        }
        setIsQuickCreateOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isQuickCreateOpen) {
      setQuickCreateMenuStyle(null);
      return;
    }

    const updateMenuPosition = () => {
      setQuickCreateMenuStyle(resolveAnchoredMenuStyle(quickCreateRef.current, 224));
    };

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [isQuickCreateOpen, isRtl]);

  useEffect(() => {
    if (!isNotificationsOpen) {
      setNotificationsMenuStyle(null);
      return;
    }

    const updateMenuPosition = () => {
      setNotificationsMenuStyle(resolveAnchoredMenuStyle(notificationsRef.current, 384));
    };

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [isNotificationsOpen, isRtl]);

  useEffect(() => {
    if (!isProfileOpen) {
      setProfileMenuStyle(null);
      return;
    }

    const updateMenuPosition = () => {
      setProfileMenuStyle(resolveAnchoredMenuStyle(profileRef.current, 256));
    };

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [isProfileOpen, isRtl]);

  const handleQuickCreateClick = (type: any) => {
    onQuickAction(type);
    setIsQuickCreateOpen(false);
  };

  return (
    <header className={`sticky top-0 z-40 border-b flex flex-col w-full h-auto transition-colors duration-200 ${
      darkMode ? 'bg-[#0A0124] border-[#1D035F]/60 text-zinc-100' : 'bg-white/95 backdrop-blur-md border-[#E7DDFC] text-[#1D035F]'
    }`}>
      
      {/* Top Row: Navigation and Utilities */}
      <div className="flex items-center justify-between px-6 py-3.5 h-16">
        
        {/* Left Section */}
        <div className="flex items-center gap-6 flex-1">
          {/* Active breadcrumbs */}
          <div className="hidden md:block shrink-0">
            <Breadcrumbs view={activeView} lang={lang} />
          </div>

          {/* Centered or Left Search Input Trigger */}
          <div 
            onClick={onOpenSearch}
            className="relative max-w-xs w-full hidden sm:block cursor-pointer group"
          >
            <Search className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-[#6537C0] transition-colors`} size={15} />
            <div className={`w-full ${isRtl ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-1.5 border rounded-full text-xs font-sans transition-all flex justify-between items-center ${
              darkMode ? 'bg-[#12023F]/50 hover:bg-[#1D035F]/50 border-[#1D035F]/70 text-zinc-400' : 'bg-[#FAF7FD] hover:bg-[#F3EDFC] border-[#E7DDFC] text-slate-600'
            }`}>
              <span className="truncate">{t.searchPlaceholder.split('...')[0]}...</span>
              <kbd className={`hidden lg:inline-block px-1.5 py-0.5 border rounded text-[9px] font-mono shadow-xs ${
                darkMode ? 'bg-[#0A0124] border-[#1D035F] text-zinc-400' : 'bg-white border-[#E7DDFC] text-slate-500'
              }`}>
                Ctrl + K
              </kbd>
            </div>
          </div>
        </div>

        {/* Right Section: Interactive Actions */}
        <div className="flex items-center gap-3">
          
          {/* Active branch / tenant display */}
          <div className="hidden lg:flex flex-col text-end font-sans">
            <span className="text-[10px] font-bold text-[#A379E2] uppercase tracking-wider leading-none">
              {lang === 'ar' ? 'الفرع النشط' : 'ACTIVE OUTLET'}
            </span>
            <span className={`text-xs font-bold leading-none mt-1 ${darkMode ? 'text-zinc-200' : 'text-[#1D035F]'}`}>
              {currentTenant}
            </span>
          </div>

          {/* Quick Create Dropdown Button */}
          <div ref={quickCreateRef} className="relative">
            <button
              onClick={() => {
                setIsQuickCreateOpen(!isQuickCreateOpen);
                setIsNotificationsOpen(false);
                setIsProfileOpen(false);
              }}
              className="px-4 py-2 rounded-lg bg-[#6537C0] hover:bg-[#5527B0] text-white font-medium text-xs md:text-sm shadow-sm shadow-[#6537C0]/25 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus size={15} className="shrink-0" />
              <span className="hidden sm:inline">{t.quickCreate}</span>
              <ChevronDown size={12} className="opacity-80 shrink-0" />
            </button>

            {/* Quick Create Menu */}
            {isQuickCreateOpen && quickCreateMenuStyle && typeof document !== 'undefined' && createPortal(
              <div
                ref={quickCreateMenuRef}
                dir={isRtl ? 'rtl' : 'ltr'}
                className={`rounded-2xl shadow-xl border p-2 space-y-0.5 text-start ${
                  darkMode ? 'bg-[#0A0124] border-[#1D035F] text-zinc-200' : 'bg-white border-[#E7DDFC] text-[#1D035F]'
                }`}
                style={quickCreateMenuStyle}
              >
                <p className="text-[10px] font-bold text-[#A379E2] uppercase tracking-wider p-2">
                  {lang === 'ar' ? 'إجراء تشغيل فوري' : 'QUICK ACTION'}
                </p>
                <button
                  onClick={() => handleQuickCreateClick('appointment')}
                  className="w-full text-start px-3 py-2 rounded-xl hover:bg-[#FAF7FD] dark:hover:bg-[#12023F] text-xs md:text-sm font-semibold transition-all cursor-pointer"
                >
                  {t.quickActions.newAppointment}
                </button>
                <button
                  onClick={() => handleQuickCreateClick('customer')}
                  className="w-full text-start px-3 py-2 rounded-xl hover:bg-[#FAF7FD] dark:hover:bg-[#12023F] text-xs md:text-sm font-semibold transition-all cursor-pointer"
                >
                  {t.quickActions.newCustomer}
                </button>
                <button
                  onClick={() => handleQuickCreateClick('service')}
                  className="w-full text-start px-3 py-2 rounded-xl hover:bg-[#FAF7FD] dark:hover:bg-[#12023F] text-xs md:text-sm font-semibold transition-all cursor-pointer"
                >
                  {t.quickActions.newService}
                </button>
                <button
                  onClick={() => handleQuickCreateClick('product')}
                  className="w-full text-start px-3 py-2 rounded-xl hover:bg-[#FAF7FD] dark:hover:bg-[#12023F] text-xs md:text-sm font-semibold transition-all cursor-pointer"
                >
                  {t.quickActions.newProduct}
                </button>
                <button
                  onClick={() => handleQuickCreateClick('employee')}
                  className="w-full text-start px-3 py-2 rounded-xl hover:bg-[#FAF7FD] dark:hover:bg-[#12023F] text-xs md:text-sm font-semibold transition-all cursor-pointer"
                >
                  {t.quickActions.newEmployee}
                </button>
                <button
                  onClick={() => handleQuickCreateClick('giftcard')}
                  className="w-full text-start px-3 py-2 rounded-xl hover:bg-[#FAF7FD] dark:hover:bg-[#12023F] text-xs md:text-sm font-semibold transition-all cursor-pointer"
                >
                  {t.quickActions.newGiftCard}
                </button>
              </div>,
              document.body
            )}
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-[#E7DDFC] dark:bg-[#1D035F]/60 mx-1 hidden sm:block" />

          {/* Global Search Mobile Button */}
          <button 
            onClick={onOpenSearch}
            className={`p-2 rounded-xl sm:hidden cursor-pointer ${darkMode ? 'text-zinc-300 hover:bg-[#12023F]' : 'text-slate-600 hover:bg-[#FAF7FD]'}`}
          >
            <Search size={18} />
          </button>

          {/* Dark Mode Toggle Button */}
          <button
            onClick={onToggleDarkMode}
            className={`p-2 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
              darkMode ? 'text-[#A379E2] hover:bg-[#12023F]' : 'text-[#1D035F] hover:bg-[#FAF7FD]'
            }`}
            title={lang === 'ar' ? 'تبديل المظهر' : 'Toggle Theme (Shortcut: D)'}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* TODO: Re-enable Operations Hub after replacing demo data with real live events. */}
          {/* Activity Center button hidden for production — contains mock/demo data */}

          {/* Language Selector Toggle */}
          <button
            onClick={onToggleLang}
            className={`p-2 rounded-xl transition-all flex items-center gap-1 cursor-pointer ${
              darkMode ? 'text-zinc-300 hover:bg-[#12023F]' : 'text-[#1D035F] hover:bg-[#FAF7FD]'
            }`}
            title={lang === 'ar' ? 'English' : 'العربية'}
          >
            <Globe size={18} />
            <span className="text-xs font-bold font-sans uppercase">
              {lang === 'ar' ? 'EN' : 'AR'}
            </span>
          </button>

          {/* Notification Center Trigger */}
          <div ref={notificationsRef} className="relative">
            <button
              onClick={() => {
                setIsNotificationsOpen(!isNotificationsOpen);
                setIsProfileOpen(false);
                setIsQuickCreateOpen(false);
              }}
              className={`p-2 rounded-xl relative transition-all cursor-pointer ${
                darkMode ? 'text-zinc-300 hover:bg-[#12023F]' : 'text-[#1D035F] hover:bg-[#FAF7FD]'
              }`}
            >
              <Bell size={18} />
              {/* Floating Pulse Dot */}
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#6537C0]" />
            </button>

            {/* Notification Center Dropdown */}
            {isNotificationsOpen && notificationsMenuStyle && typeof document !== 'undefined' && createPortal(
              <div ref={notificationsMenuRef} dir={isRtl ? 'rtl' : 'ltr'} style={notificationsMenuStyle}>
                <NotificationCenter lang={lang} onClose={() => setIsNotificationsOpen(false)} />
              </div>,
              document.body
            )}
          </div>

          {/* Profile Selector Trigger */}
          <div ref={profileRef} className="relative">
            <button
              onClick={() => {
                setIsProfileOpen(!isProfileOpen);
                setIsNotificationsOpen(false);
                setIsQuickCreateOpen(false);
              }}
              className={`flex items-center gap-2 p-1 rounded-xl transition-all cursor-pointer ${
                darkMode ? 'hover:bg-[#12023F]' : 'hover:bg-[#FAF7FD]'
              }`}
            >
              <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-[#E7DDFC] dark:border-[#1D035F]">
                <img
                  src={PROFILE_AVATAR_SRC}
                  alt="User Portrait"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <ChevronDown size={14} className="text-neutral-500 hidden sm:block" />
            </button>

            {/* Profile Dropdown */}
            {isProfileOpen && profileMenuStyle && typeof document !== 'undefined' && createPortal(
              <div ref={profileMenuRef} dir={isRtl ? 'rtl' : 'ltr'} style={profileMenuStyle}>
                <UserProfileMenu
                  lang={lang}
                  onClose={() => setIsProfileOpen(false)}
                  onLogout={onLogout}
                  onSwitchTenant={onSwitchTenant}
                  currentTenant={currentTenant}
                  onNavigateToSettings={onNavigateToSettings}
                />
              </div>,
              document.body
            )}
          </div>

        </div>
      </div>

      {/* Lower Row: Tab Bar Manager */}
      <Tabs
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={onSelectTab}
        onCloseTab={onCloseTab}
        lang={lang}
      />

    </header>
  );
}
