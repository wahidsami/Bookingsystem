import { useState } from 'react';
import { Sparkle, ChevronLeft, ChevronRight, LayoutGrid, Award, Shield, Settings, Info, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { Language, ViewType, NavigationItem } from '../types';
import { translations, navigationItems } from '../data/translations';
import LucideIcon from './LucideIcon';
import barspaIcon from '../assets/barspa_app_icon.png';
import barspaLogo from '../assets/barspa_logo.png';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  lang: Language;
  activeView: ViewType;
  onSelectView: (viewId: ViewType) => void;
  favoritePages?: ViewType[];
  accessibleMarketingModules?: Record<string, boolean>;
  hasServicePackages?: boolean;
  hasProductsAndOrders?: boolean;
  hasOrdersPermission?: boolean;
}

export default function Sidebar({
  isCollapsed,
  onToggleCollapse,
  lang,
  activeView,
  onSelectView,
  favoritePages = [],
  accessibleMarketingModules,
  hasServicePackages = true,
  hasProductsAndOrders = true,
  hasOrdersPermission = true,
}: SidebarProps) {
  const t = translations[lang];
  const isRtl = lang === 'ar';

  const [isMarketingExpanded, setIsMarketingExpanded] = useState(true);

  const categories = ['core', 'operations', 'growth', 'management'] as const;

  const getCategoryLabel = (cat: string) => {
    return t.categories[cat as keyof typeof t.categories] || cat;
  };

  // Get matching navigation items that are favorited (excluding legacy hidden workspaces)
  const favoriteNavItems = navigationItems.filter(
    item => !item.hidden && item.id !== 'services' && item.id !== 'packages' && favoritePages.includes(item.id)
  );

  return (
    <aside
      id="main-sidebar"
      className={`h-screen sticky top-0 shrink-0 bg-[#0A0124] text-zinc-300 border-[#1D035F]/60 transition-all duration-300 flex flex-col justify-between z-30 shadow-2xl ${
        isCollapsed ? 'w-20' : 'w-64'
      } ${isRtl ? 'border-l' : 'border-r'}`}
    >

      {/* Upper Logo and Collapse Button */}
      <div className="flex flex-col">
        <div className="p-4 flex items-center justify-between border-b border-[#1D035F]/60 h-16 bg-[#0A0124]/90 backdrop-blur-md">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center p-1 bg-[#1D035F] border border-[#A379E2]/30 shrink-0 select-none overflow-hidden shadow-sm">
              <img src={barspaIcon} alt="BarSpa" className="w-full h-full object-contain" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <img src={barspaLogo} alt="BarSpa" className="h-6 w-auto object-contain brightness-0 invert opacity-95" />
                <span className="text-[8.5px] text-[#A379E2] font-semibold tracking-wider -mt-0.5 truncate max-w-[150px] uppercase">
                  {lang === 'ar' ? 'منصة بارسبا للصالونات' : 'BARSPA BEAUTY PLATFORM'}
                </span>
              </div>
            )}
          </div>

          {/* Toggle Button */}
          {!isCollapsed && (
            <button
              onClick={onToggleCollapse}
              className="p-1.5 hover:bg-[#1D035F] rounded-lg text-[#A379E2] hover:text-white transition-colors cursor-pointer"
              title={isCollapsed ? t.expandSidebar : t.collapseSidebar}
            >
              {isRtl ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          )}
        </div>

        {/* Small inline toggle button when collapsed */}
        {isCollapsed && (
          <div className="flex justify-center py-3 border-b border-[#1D035F]/60 bg-[#12023F]/30">
            <button
              onClick={onToggleCollapse}
              className="p-2 bg-[#12023F] hover:bg-[#1D035F] rounded-xl text-[#A379E2] hover:text-white transition-all cursor-pointer border border-[#1D035F]"
            >
              {isRtl ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>
          </div>
        )}

        {/* Multi-Level Group Navigation */}
        <div className="px-3 py-4 space-y-5 overflow-y-auto max-h-[calc(100vh-190px)] scrollbar-none">

          {/* Favorite Pages Shelf (Personalization Hook) */}
          {favoriteNavItems.length > 0 && (
            <div className="space-y-1 bg-[#12023F]/60 p-2 rounded-xl border border-[#1D035F]">
              {!isCollapsed && (
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#A379E2] mb-2 px-2 font-sans flex items-center gap-1.5">
                  <Star size={11} fill="currentColor" />
                  <span>{isRtl ? 'المفضلة الفورية' : 'My Saved Favorites'}</span>
                </h4>
              )}

              <div className="space-y-0.5">
                {favoriteNavItems.map((item) => {
                  const isActive = activeView === item.id;
                  const itemLabel = isRtl ? item.labelAr : item.labelEn;
                  return (
                    <button
                      key={`fav-${item.id}`}
                      onClick={() => onSelectView(item.id)}
                      className={`w-full text-start flex items-center justify-between p-2 rounded-lg text-xs md:text-sm transition-colors group relative cursor-pointer border-s-2 ${
                        isActive
                          ? 'bg-[#1D035F] text-white font-bold border-[#6537C0] shadow-sm'
                          : 'text-zinc-400 hover:text-white hover:bg-[#12023F]/50 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`transition-colors shrink-0 ${isActive ? 'text-[#A379E2]' : 'text-zinc-500 group-hover:text-[#A379E2]'}`}>
                          <LucideIcon name={item.iconName} size={14} />
                        </span>
                        {!isCollapsed && <span className="truncate">{itemLabel}</span>}
                      </div>

                      {isCollapsed && (
                        <span className={`absolute ${isRtl ? 'right-full mr-2' : 'left-full ml-2'} top-1/2 -translate-y-1/2 bg-[#12023F] border border-[#1D035F] text-white text-[10px] px-2 py-1 rounded shadow-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap font-sans`}>
                          ⭐ {itemLabel}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {categories.map((cat) => {
            let itemsInCat = navigationItems.filter(
              (i) => !i.hidden && i.id !== 'services' && i.id !== 'packages' && i.category === cat
            );

            // Hide packages menu if entitlement is disabled (legacy safety)
            if (!hasServicePackages) {
              itemsInCat = itemsInCat.filter((i) => i.id !== 'packages');
            }

            // Hide orders menu if entitlement is disabled or staff lacks permission
            if (!hasProductsAndOrders || !hasOrdersPermission) {
              itemsInCat = itemsInCat.filter((i) => i.id !== 'orders');
            }

            if (itemsInCat.length === 0) return null;

            return (
              <div key={cat} className="space-y-1">
                {/* Section title (Hide if collapsed) */}
                {!isCollapsed && (
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#A379E2]/70 mb-2 px-3 font-sans">
                    {getCategoryLabel(cat)}
                  </h4>
                )}

                {/* Navigation Items */}
                <div className="space-y-0.5">
                  {itemsInCat.map((item) => {
                    const isActive = activeView === item.id;
                    const itemLabel = isRtl ? item.labelAr : item.labelEn;
                    const badge = isRtl ? item.badgeAr : item.badgeEn;

                    const marketingSubItems = [
                      { id: 'marketing-hot-deals' as ViewType, labelAr: 'العروض الساخنة', labelEn: 'Hot Deals', iconName: 'Tag' },
                      { id: 'marketing-notifications' as ViewType, labelAr: 'إشعارات الدفع المباشرة', labelEn: 'Push Notifications', iconName: 'Bell' },
                      { id: 'marketing-gift-cards' as ViewType, labelAr: 'بطاقات الهدايا', labelEn: 'Gift Cards', iconName: 'Gift' },
                      { id: 'marketing-reviews' as ViewType, labelAr: 'تقييمات العملاء', labelEn: 'Reviews', iconName: 'Star' },
                      { id: 'marketing-page-setup' as ViewType, labelAr: 'إعداد صفحة الهبوط', labelEn: 'Page Setup', iconName: 'Globe' },
                    ];

                    const activeMarketingModules = accessibleMarketingModules || {
                      'marketing-hot-deals': true,
                      'marketing-notifications': true,
                      'marketing-gift-cards': true,
                      'marketing-reviews': true,
                      'marketing-page-setup': true,
                    };

                    const visibleSubItems = marketingSubItems.filter(sub => activeMarketingModules[sub.id]);
                    const isMarketingAccessible = visibleSubItems.length > 0;

                    if (item.id.startsWith('marketing-')) {
                      return null; // Skip rendering child items as root items
                    }

                    if (item.id === 'marketing') {
                      if (!isMarketingAccessible) {
                        return null; // Hide the marketing menu entirely if no sub-items are accessible!
                      }

                      const isAnyChildActive = activeView.startsWith('marketing-');
                      const isOpen = isMarketingExpanded || isAnyChildActive;

                      return (
                        <div key={item.id} className="space-y-1">
                          {/* Main parent item */}
                          <button
                            onClick={() => {
                              if (isCollapsed) {
                                onToggleCollapse();
                                setIsMarketingExpanded(true);
                              } else {
                                setIsMarketingExpanded(!isMarketingExpanded);
                              }
                            }}
                            className={`w-full text-start flex items-center justify-between p-2.5 rounded-lg text-xs md:text-sm transition-colors group relative cursor-pointer border-s-2 ${
                              isAnyChildActive
                                ? 'bg-[#1D035F] text-white font-semibold border-[#6537C0] shadow-sm'
                                : 'text-zinc-400 hover:text-white hover:bg-[#12023F]/60 border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`transition-colors shrink-0 ${
                                  isAnyChildActive ? 'text-[#A379E2]' : 'text-zinc-500 group-hover:text-zinc-300'
                                }`}
                              >
                                <LucideIcon name={item.iconName} size={15} />
                              </span>
                              {!isCollapsed && <span className="truncate">{itemLabel}</span>}
                            </div>

                            {!isCollapsed && (
                              <span className="text-zinc-500 group-hover:text-zinc-300 transition-colors">
                                {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </span>
                            )}

                            {/* Collapsed Tooltip helper */}
                            {isCollapsed && (
                              <span className={`absolute ${isRtl ? 'right-full mr-2' : 'left-full ml-2'} top-1/2 -translate-y-1/2 bg-[#0A0124] border border-[#1D035F]/60 text-white text-[10px] px-2 py-1 rounded shadow-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap font-sans`}>
                                {itemLabel}
                              </span>
                            )}
                          </button>

                          {/* Render sub-items if expanded & sidebar is not collapsed */}
                          {isOpen && !isCollapsed && (
                            <div className={`ms-4 border-s border-[#1D035F]/60 ps-3 space-y-1 mt-1 transition-all`}>
                              {visibleSubItems.map((sub) => {
                                const isSubActive = activeView === sub.id;
                                const subLabel = isRtl ? sub.labelAr : sub.labelEn;

                                return (
                                  <button
                                    key={sub.id}
                                    onClick={() => onSelectView(sub.id)}
                                    className={`w-full text-start flex items-center gap-2.5 py-2 px-2.5 rounded-md text-xs transition-all relative cursor-pointer ${
                                      isSubActive
                                        ? 'bg-[#1D035F] text-[#FAF7FD] font-bold border-s-2 border-[#A379E2] -ms-[13px] ps-[11px]'
                                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#12023F]/40'
                                    }`}
                                  >
                                    <span className={`shrink-0 ${isSubActive ? 'text-[#A379E2]' : 'text-zinc-600'}`}>
                                      <LucideIcon name={sub.iconName} size={13} />
                                    </span>
                                    <span className="truncate text-[11px]">{subLabel}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <button
                        key={item.id}
                        onClick={() => onSelectView(item.id)}
                        className={`w-full text-start flex items-center justify-between p-2.5 rounded-lg text-xs md:text-sm transition-colors group relative cursor-pointer border-s-2 ${
                          isActive
                            ? 'bg-[#1D035F] text-white font-semibold border-[#6537C0] shadow-sm'
                            : 'text-zinc-400 hover:text-white hover:bg-[#12023F]/60 border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`transition-colors shrink-0 ${
                              isActive ? 'text-[#A379E2]' : 'text-zinc-500 group-hover:text-zinc-300'
                            }`}
                          >
                            <LucideIcon name={item.iconName} size={15} />
                          </span>
                          {!isCollapsed && <span className="truncate">{itemLabel}</span>}
                        </div>

                        {/* Badges (only if not collapsed) */}
                        {!isCollapsed && badge && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            badge === 'New' || badge === 'جديد'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : badge === 'Alert' || badge === 'تنبيه'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-[#6537C0]/20 text-[#D0BFF8] border border-[#6537C0]/30'
                          }`}>
                            {badge}
                          </span>
                        )}

                        {/* Collapsed Tooltip helper */}
                        {isCollapsed && (
                          <span className={`absolute ${isRtl ? 'right-full mr-2' : 'left-full ml-2'} top-1/2 -translate-y-1/2 bg-[#0A0124] border border-[#1D035F]/60 text-white text-[10px] px-2 py-1 rounded shadow-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap font-sans`}>
                            {itemLabel}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lower Profile / Footer */}
      <div className="p-4 border-t border-[#1D035F]/50 bg-[#070119]">
        {!isCollapsed ? (
          <div className="space-y-3">
            {/* System compliance */}
            <div className="p-2.5 bg-[#12023F]/60 border border-[#1D035F]/70 rounded-xl flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-zinc-300 uppercase leading-none">
                  {lang === 'ar' ? 'الربط المعتمد' : 'ZATCA INTEGRATED'}
                </p>
                <p className="text-[9px] text-zinc-400 leading-none mt-1">
                  {lang === 'ar' ? 'المرحلة ٢ - الفاتورة الإلكترونية' : 'Saudi e-Invoicing Phase 2'}
                </p>
              </div>
            </div>

            {/* Saudi Arabia context indicator */}
            <p className="text-[10px] text-zinc-400 text-center flex items-center justify-center gap-1 font-sans">
              <span>{t.saudiArabia}</span>
              <span>🇸🇦</span>
              <span>•</span>
              <span className="font-mono">v1.2</span>
            </p>
          </div>
        ) : (
          <div className="flex justify-center text-zinc-400">
            <span>🇸🇦</span>
          </div>
        )}
      </div>

    </aside>
  );
}
