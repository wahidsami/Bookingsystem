import { useState, useEffect, useRef } from 'react';
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
  onOpenActivityCenter?: () => void;
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
  onOpenActivityCenter
}: TopbarProps) {
  const t = translations[lang];
  const isRtl = lang === 'ar';

  // Popover States
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);

  // Refs for closing on outside click
  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const quickCreateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (quickCreateRef.current && !quickCreateRef.current.contains(event.target as Node)) {
        setIsQuickCreateOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleQuickCreateClick = (type: any) => {
    onQuickAction(type);
    setIsQuickCreateOpen(false);
  };

  return (
    <header className={`sticky top-0 z-40 border-b flex flex-col w-full h-auto transition-colors duration-200 ${
      darkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-800'
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
            <Search className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-brand-500 transition-colors`} size={15} />
            <div className={`w-full ${isRtl ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-1.5 border-0 rounded-full text-xs font-sans transition-all flex justify-between items-center ${
              darkMode ? 'bg-zinc-800 hover:bg-zinc-750 text-zinc-400' : 'bg-slate-100 hover:bg-slate-200/60 text-slate-500'
            }`}>
              <span className="truncate">{t.searchPlaceholder.split('...')[0]}...</span>
              <kbd className={`hidden lg:inline-block px-1.5 py-0.5 border rounded text-[9px] font-mono shadow-xs ${
                darkMode ? 'bg-zinc-900 border-zinc-700 text-zinc-500' : 'bg-white border-slate-200/60 text-slate-400'
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
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">
              {lang === 'ar' ? 'الفرع الفاخر النشط' : 'PREMIUM OUTLET'}
            </span>
            <span className={`text-xs font-bold leading-none mt-1 ${darkMode ? 'text-zinc-200' : 'text-slate-800'}`}>
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
              className="px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 text-white font-medium text-xs md:text-sm shadow-md hover:bg-zinc-800 dark:hover:bg-white transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus size={15} className="shrink-0" />
              <span className="hidden sm:inline">{t.quickCreate}</span>
              <ChevronDown size={12} className="opacity-80 shrink-0" />
            </button>

            {/* Quick Create Menu */}
            {isQuickCreateOpen && (
              <div className={`absolute ${isRtl ? 'left-0' : 'right-0'} mt-2 w-56 rounded-2xl shadow-xl border p-2 space-y-0.5 z-50 text-start ${
                darkMode ? 'bg-zinc-800 border-zinc-700 text-zinc-200' : 'bg-white border-neutral-100 text-neutral-800'
              }`}>
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider p-2">
                  {lang === 'ar' ? 'إجراء تشغيل فوري' : 'SELECT CORE ENTITY'}
                </p>
                <button
                  onClick={() => handleQuickCreateClick('appointment')}
                  className="w-full text-start px-3 py-2 rounded-xl hover:bg-neutral-100/30 text-xs md:text-sm font-semibold transition-all"
                >
                  {t.quickActions.newAppointment}
                </button>
                <button
                  onClick={() => handleQuickCreateClick('customer')}
                  className="w-full text-start px-3 py-2 rounded-xl hover:bg-neutral-100/30 text-xs md:text-sm font-semibold transition-all"
                >
                  {t.quickActions.newCustomer}
                </button>
                <button
                  onClick={() => handleQuickCreateClick('service')}
                  className="w-full text-start px-3 py-2 rounded-xl hover:bg-neutral-100/30 text-xs md:text-sm font-semibold transition-all"
                >
                  {t.quickActions.newService}
                </button>
                <button
                  onClick={() => handleQuickCreateClick('product')}
                  className="w-full text-start px-3 py-2 rounded-xl hover:bg-neutral-100/30 text-xs md:text-sm font-semibold transition-all"
                >
                  {t.quickActions.newProduct}
                </button>
                <button
                  onClick={() => handleQuickCreateClick('employee')}
                  className="w-full text-start px-3 py-2 rounded-xl hover:bg-neutral-100/30 text-xs md:text-sm font-semibold transition-all"
                >
                  {t.quickActions.newEmployee}
                </button>
                <button
                  onClick={() => handleQuickCreateClick('giftcard')}
                  className="w-full text-start px-3 py-2 rounded-xl hover:bg-neutral-100/30 text-xs md:text-sm font-semibold transition-all"
                >
                  {t.quickActions.newGiftCard}
                </button>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-neutral-200 dark:bg-zinc-700 mx-1 hidden sm:block" />

          {/* Global Search Mobile Button */}
          <button 
            onClick={onOpenSearch}
            className={`p-2 rounded-xl sm:hidden cursor-pointer ${darkMode ? 'text-zinc-300 hover:bg-zinc-800' : 'text-neutral-500 hover:bg-neutral-100'}`}
          >
            <Search size={18} />
          </button>

          {/* Dark Mode Toggle Button */}
          <button
            onClick={onToggleDarkMode}
            className={`p-2 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
              darkMode ? 'text-amber-400 hover:bg-zinc-800' : 'text-neutral-600 hover:bg-neutral-100'
            }`}
            title={lang === 'ar' ? 'تبديل المظهر' : 'Toggle Theme (Shortcut: D)'}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Live Activity Center Trigger (Enterprise Requirement) */}
          <button
            onClick={onOpenActivityCenter}
            className={`p-2 rounded-xl relative transition-all flex items-center justify-center cursor-pointer ${
              darkMode ? 'text-zinc-300 hover:bg-zinc-800' : 'text-neutral-600 hover:bg-neutral-100'
            }`}
            title={lang === 'ar' ? 'سجل العمليات المباشر' : 'Live Operations Activity Feed'}
          >
            <Activity size={18} />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500" />
          </button>

          {/* Language Selector Toggle */}
          <button
            onClick={onToggleLang}
            className={`p-2 rounded-xl transition-all flex items-center gap-1 cursor-pointer ${
              darkMode ? 'text-zinc-300 hover:bg-zinc-800' : 'text-neutral-600 hover:bg-neutral-100'
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
                darkMode ? 'text-zinc-300 hover:bg-zinc-800' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              <Bell size={18} />
              {/* Floating Pulse Dot */}
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-600" />
            </button>

            {/* Notification Center Dropdown */}
            {isNotificationsOpen && (
              <div className={`absolute ${isRtl ? 'left-0' : 'right-0'} mt-3 z-50`}>
                <NotificationCenter lang={lang} onClose={() => setIsNotificationsOpen(false)} />
              </div>
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
                darkMode ? 'hover:bg-zinc-800' : 'hover:bg-neutral-100'
              }`}
            >
              <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-neutral-200 dark:border-zinc-700">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=100&auto=format&fit=crop"
                  alt="User Portrait"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <ChevronDown size={14} className="text-neutral-500 hidden sm:block" />
            </button>

            {/* Profile Dropdown */}
            {isProfileOpen && (
              <div className={`absolute ${isRtl ? 'left-0' : 'right-0'} mt-3 z-50`}>
                <UserProfileMenu
                  lang={lang}
                  onClose={() => setIsProfileOpen(false)}
                  onLogout={onLogout}
                  onSwitchTenant={onSwitchTenant}
                  currentTenant={currentTenant}
                />
              </div>
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
