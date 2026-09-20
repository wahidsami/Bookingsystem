import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, X, Calendar, Users, Sparkles, CornerDownLeft, 
  Terminal, Plus, BarChart3, Moon, Sun, Laptop, ArrowRightLeft,
  Settings, ShoppingBag, ShieldCheck, Heart
} from 'lucide-react';
import { Language, ViewType } from '../types';
import { translations, navigationItems } from '../data/translations';
import { mockCustomers, mockServices } from '../data/mockData';
import LucideIcon from './LucideIcon';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onNavigate: (viewId: ViewType) => void;
  onQuickAction?: (type: 'appointment' | 'customer' | 'service' | 'product' | 'employee' | 'giftcard') => void;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export default function GlobalSearch({ 
  isOpen, 
  onClose, 
  lang, 
  onNavigate,
  onQuickAction,
  darkMode = false,
  onToggleDarkMode
}: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const t = translations[lang];
  const isRtl = lang === 'ar';

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 120);
      setSelectedIndex(0);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Command items definitions
  const commands = [
    {
      id: 'cmd-apt',
      labelAr: 'إنشاء حجز موعد جديد سريع',
      labelEn: 'Create New Appointment Booking',
      icon: Calendar,
      action: () => {
        if (onQuickAction) onQuickAction('appointment');
      },
      shortcut: 'C + A',
      category: 'actions'
    },
    {
      id: 'cmd-prd',
      labelAr: 'إضافة منتج جديد للمخازن',
      labelEn: 'Create New Product Asset',
      icon: Plus,
      action: () => {
        if (onQuickAction) onQuickAction('product');
      },
      shortcut: 'C + P',
      category: 'actions'
    },
    {
      id: 'cmd-cust',
      labelAr: 'تسجيل وإضافة عميل جديد',
      labelEn: 'Register New VIP Customer',
      icon: Users,
      action: () => {
        if (onQuickAction) onQuickAction('customer');
      },
      shortcut: 'C + C',
      category: 'actions'
    },
    {
      id: 'cmd-rep',
      labelAr: 'فتح تقارير الأداء المالي والبياني',
      labelEn: 'Open Reports & Analytics Hub',
      icon: BarChart3,
      action: () => {
        onNavigate('reports');
      },
      shortcut: 'G + R',
      category: 'navigation'
    },
    {
      id: 'cmd-dark',
      labelAr: darkMode ? 'التحويل للمظهر المضيء' : 'التحويل للمظهر الداكن الفاخر',
      labelEn: darkMode ? 'Switch to Light Mode' : 'Switch to Luxury Dark Mode',
      icon: darkMode ? Sun : Moon,
      action: () => {
        if (onToggleDarkMode) onToggleDarkMode();
      },
      shortcut: 'D',
      category: 'settings'
    }
  ];

  // Matched items computation
  const filteredCommands = commands.filter(cmd => {
    const label = lang === 'ar' ? cmd.labelAr : cmd.labelEn;
    return label.toLowerCase().includes(query.toLowerCase());
  });

  const matchedNav = navigationItems.filter(item => {
    if (item.hidden || item.id === 'services' || item.id === 'packages') return false;
    const label = lang === 'ar' ? item.labelAr : item.labelEn;
    return label.toLowerCase().includes(query.toLowerCase());
  });

  const matchedCustomers = mockCustomers.filter(cust => {
    return cust.name.toLowerCase().includes(query.toLowerCase()) || 
           cust.phone.includes(query) || 
           cust.email.toLowerCase().includes(query.toLowerCase());
  });

  const matchedServices = mockServices.filter(srv => {
    const name = lang === 'ar' ? srv.nameAr : srv.nameEn;
    return name.toLowerCase().includes(query.toLowerCase());
  });

  // Flat list of all items for keyboard navigation
  interface FlatItem {
    type: 'command' | 'nav' | 'customer' | 'service';
    id: string;
    payload: any;
  }

  const flatItems: FlatItem[] = [];
  
  filteredCommands.forEach(cmd => {
    flatItems.push({ type: 'command', id: cmd.id, payload: cmd });
  });
  
  matchedNav.slice(0, 4).forEach(item => {
    flatItems.push({ type: 'nav', id: item.id, payload: item });
  });

  matchedCustomers.slice(0, 4).forEach(cust => {
    flatItems.push({ type: 'customer', id: cust.id, payload: cust });
  });

  matchedServices.slice(0, 4).forEach(srv => {
    flatItems.push({ type: 'service', id: srv.id, payload: srv });
  });

  const totalItemsCount = flatItems.length;

  // Keyboard navigation listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % totalItemsCount);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + totalItemsCount) % totalItemsCount);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (totalItemsCount > 0 && selectedIndex < totalItemsCount) {
          executeSelection(flatItems[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, totalItemsCount]);

  // Auto scroll focused item into view
  useEffect(() => {
    const activeEl = listRef.current?.querySelector('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const executeSelection = (item: FlatItem) => {
    if (item.type === 'command') {
      item.payload.action();
    } else if (item.type === 'nav') {
      onNavigate(item.payload.id);
    } else if (item.type === 'customer') {
      onNavigate('customers');
    } else if (item.type === 'service') {
      onNavigate('services2');
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 sm:px-6">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-neutral-950/60 backdrop-blur-md"
        id="search-backdrop"
      />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -16 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className={`relative w-full max-w-2xl rounded-2xl shadow-2xl border overflow-hidden flex flex-col max-h-[500px] transition-colors duration-200 ${
          darkMode 
            ? 'bg-[#0A0124] border-[#1D035F] text-zinc-100' 
            : 'bg-white border-[#E7DDFC] text-[#1D035F]'
        }`}
        id="search-panel"
      >
        {/* Search header with Terminal / Command style */}
        <div className={`flex items-center px-4 py-4 border-b transition-colors ${
          darkMode ? 'border-[#1D035F]/60 bg-[#0A0124]' : 'border-[#E7DDFC] bg-[#FAF7FD]'
        }`}>
          <Search className="text-zinc-400 shrink-0 mx-2" size={20} />
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent border-none text-sm md:text-base font-sans focus:outline-none focus:ring-0"
            placeholder={isRtl ? 'اكتب أمراً أو ابحث عن عميل أو خدمة... (مثال: حجز موعد)' : 'Type a command, customer or service... (e.g. create appointment)'}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${darkMode ? 'bg-[#12023F] text-[#A379E2]' : 'bg-[#E7DDFC]/60 text-[#1D035F]'}`}>
              ⌘K
            </span>
            <button
              onClick={onClose}
              className="p-1 hover:bg-[#FAF7FD] dark:hover:bg-[#12023F] rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-zinc-200 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Results body with Flat indexing */}
        <div ref={listRef} className="overflow-y-auto flex-1 p-2 space-y-4 max-h-[360px]">
          
          {totalItemsCount === 0 && (
            <div className="p-8 text-center">
              <span className={`inline-block p-3 rounded-full mb-2 ${darkMode ? 'bg-[#12023F] text-[#A379E2]' : 'bg-[#FAF7FD] text-[#6537C0]'}`}>
                <Terminal size={24} />
              </span>
              <p className="text-sm font-semibold">
                {isRtl ? 'لم يتم العثور على نتائج تطابق البحث' : 'No matching commands or resources found'}
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                {isRtl ? 'حاول كتابة "حجز" أو "منتج" أو اسم عميل معروف مثل "سارة"' : 'Try typing "create", "product", or a customer name like "Sarah"'}
              </p>
            </div>
          )}

          {totalItemsCount > 0 && (
            <div className="space-y-4">
              {/* Commands Group */}
              {filteredCommands.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-bold text-[#A379E2] uppercase tracking-widest px-3 mb-1.5">
                    {isRtl ? 'أوامر النظام السريعة' : 'Instant System Commands'}
                  </h3>
                  <div className="space-y-0.5">
                    {filteredCommands.map((cmd) => {
                      const globalIdx = flatItems.findIndex(i => i.id === cmd.id);
                      const isFocused = globalIdx === selectedIndex;
                      const Icon = cmd.icon;
                      return (
                        <button
                          key={cmd.id}
                          onClick={() => executeSelection({ type: 'command', id: cmd.id, payload: cmd })}
                          data-active={isFocused}
                          className={`w-full text-start flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                            isFocused 
                              ? darkMode 
                                ? 'bg-[#1D035F] text-white font-medium' 
                                : 'bg-[#F3EDFC] text-[#1D035F] font-medium'
                              : 'hover:bg-[#FAF7FD] dark:hover:bg-[#12023F]/50 text-neutral-500 dark:text-zinc-400'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`p-1.5 rounded-lg shrink-0 ${
                              isFocused 
                                ? 'bg-[#6537C0] text-white' 
                                : darkMode ? 'bg-[#12023F] text-[#A379E2]' : 'bg-[#FAF7FD] text-[#6537C0]'
                            }`}>
                              <Icon size={14} />
                            </span>
                            <span className={`text-xs md:text-sm ${isFocused ? 'text-[#1D035F] dark:text-white font-bold' : ''}`}>
                              {isRtl ? cmd.labelAr : cmd.labelEn}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                            {cmd.shortcut && (
                              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                                isFocused 
                                  ? 'bg-[#6537C0]/20 text-[#6537C0] dark:text-[#A379E2]' 
                                  : darkMode ? 'bg-[#12023F] text-zinc-500' : 'bg-neutral-100 text-neutral-400'
                              }`}>
                                {cmd.shortcut}
                              </span>
                            )}
                            {isFocused && (
                              <CornerDownLeft size={10} className="text-[#6537C0] opacity-85 shrink-0" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Modules Group */}
              {matchedNav.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-bold text-[#A379E2] uppercase tracking-widest px-3 mb-1.5">
                    {isRtl ? 'الأقسام والصفحات' : 'Go to Modules'}
                  </h3>
                  <div className="space-y-0.5">
                    {matchedNav.slice(0, 4).map((item) => {
                      const globalIdx = flatItems.findIndex(i => i.id === item.id);
                      const isFocused = globalIdx === selectedIndex;
                      return (
                        <button
                          key={item.id}
                          onClick={() => executeSelection({ type: 'nav', id: item.id, payload: item })}
                          data-active={isFocused}
                          className={`w-full text-start flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                            isFocused 
                              ? darkMode 
                                ? 'bg-[#1D035F] text-white font-medium' 
                                : 'bg-[#F3EDFC] text-[#1D035F] font-medium'
                              : 'hover:bg-[#FAF7FD] dark:hover:bg-[#12023F]/50 text-neutral-500 dark:text-zinc-400'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`p-1.5 rounded-lg shrink-0 ${
                              isFocused 
                                ? 'bg-[#6537C0] text-white' 
                                : darkMode ? 'bg-[#12023F] text-[#A379E2]' : 'bg-[#FAF7FD] text-[#6537C0]'
                            }`}>
                              <LucideIcon name={item.iconName} size={14} />
                            </span>
                            <span className={`text-xs md:text-sm ${isFocused ? 'text-[#1D035F] dark:text-white font-bold' : ''}`}>
                              {isRtl ? item.labelAr : item.labelEn}
                            </span>
                          </div>
                          {isFocused && (
                            <CornerDownLeft size={10} className="text-[#6537C0] opacity-85 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Customers Group */}
              {matchedCustomers.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-bold text-[#A379E2] uppercase tracking-widest px-3 mb-1.5">
                    {isRtl ? 'سجل العملاء' : 'Customers Matching'}
                  </h3>
                  <div className="space-y-0.5">
                    {matchedCustomers.slice(0, 4).map((cust) => {
                      const globalIdx = flatItems.findIndex(i => i.id === cust.id);
                      const isFocused = globalIdx === selectedIndex;
                      return (
                        <button
                          key={cust.id}
                          onClick={() => executeSelection({ type: 'customer', id: cust.id, payload: cust })}
                          data-active={isFocused}
                          className={`w-full text-start flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                            isFocused 
                              ? darkMode 
                                ? 'bg-[#1D035F] text-white' 
                                : 'bg-[#F3EDFC] text-[#1D035F] font-medium'
                              : 'hover:bg-[#FAF7FD] dark:hover:bg-[#12023F]/50 text-neutral-500 dark:text-zinc-400'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                              <Users size={14} />
                            </span>
                            <div className="min-w-0">
                              <p className={`text-xs md:text-sm font-semibold truncate ${isFocused ? 'text-[#1D035F] dark:text-white' : ''}`}>
                                {cust.name}
                              </p>
                              <p className="text-[10px] text-zinc-400 truncate font-mono">
                                {cust.phone} • {cust.email}
                              </p>
                            </div>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${isFocused ? 'bg-emerald-500 text-white' : 'bg-neutral-100 text-neutral-500 dark:bg-[#12023F] dark:text-zinc-400'}`}>
                            {cust.totalSpent}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Services Group */}
              {matchedServices.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-bold text-[#A379E2] uppercase tracking-widest px-3 mb-1.5">
                    {isRtl ? 'قائمة الخدمات الفاخرة' : 'Services Catalog'}
                  </h3>
                  <div className="space-y-0.5">
                    {matchedServices.slice(0, 4).map((srv) => {
                      const globalIdx = flatItems.findIndex(i => i.id === srv.id);
                      const isFocused = globalIdx === selectedIndex;
                      return (
                        <button
                          key={srv.id}
                          onClick={() => executeSelection({ type: 'service', id: srv.id, payload: srv })}
                          data-active={isFocused}
                          className={`w-full text-start flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                            isFocused 
                              ? darkMode 
                                ? 'bg-[#1D035F] text-white' 
                                : 'bg-[#F3EDFC] text-[#1D035F] font-medium'
                              : 'hover:bg-[#FAF7FD] dark:hover:bg-[#12023F]/50 text-neutral-500 dark:text-zinc-400'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 shrink-0">
                              <Sparkles size={14} />
                            </span>
                            <div className="min-w-0">
                              <p className={`text-xs md:text-sm font-semibold truncate ${isFocused ? 'text-[#1D035F] dark:text-white' : ''}`}>
                                {isRtl ? srv.nameAr : srv.nameEn}
                              </p>
                              <p className="text-[10px] text-zinc-400">
                                {isRtl ? srv.categoryAr : srv.categoryEn} • {srv.duration} {isRtl ? 'دقيقة' : 'mins'}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-bold font-mono text-[#6537C0] dark:text-[#A379E2]">
                            {srv.price} {isRtl ? 'ر.س' : 'SAR'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer info with hotkeys */}
        <div className={`px-4 py-3 border-t flex flex-wrap justify-between items-center text-[10px] text-zinc-400 transition-colors ${
          darkMode ? 'border-[#1D035F]/60 bg-[#070119]' : 'border-[#E7DDFC] bg-[#FAF7FD]'
        }`}>
          <div className="flex items-center gap-3.5">
            <span className="flex items-center gap-1.5">
              <kbd className="px-1 py-0.5 bg-white dark:bg-[#12023F] border border-[#E7DDFC] dark:border-[#1D035F] rounded text-zinc-500 dark:text-zinc-300 font-mono shadow-xs text-[9px]">↑↓</kbd> 
              <span>{isRtl ? 'للتنقل' : 'to navigate'}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1 py-0.5 bg-white dark:bg-[#12023F] border border-[#E7DDFC] dark:border-[#1D035F] rounded text-zinc-500 dark:text-zinc-300 font-mono shadow-xs text-[9px]">Enter</kbd> 
              <span>{isRtl ? 'للتحديد' : 'to select'}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1 py-0.5 bg-white dark:bg-[#12023F] border border-[#E7DDFC] dark:border-[#1D035F] rounded text-zinc-500 dark:text-zinc-300 font-mono shadow-xs text-[9px]">Esc</kbd> 
              <span>{isRtl ? 'للإغلاق' : 'to close'}</span>
            </span>
          </div>
          <div className="mt-1 sm:mt-0 font-sans tracking-wide">
            {isRtl ? 'محرك أوامر بارسبا السريع' : 'BarSpa Command Control Engine'}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
