import { useState } from 'react';
import { Sparkle, ChevronLeft, ChevronRight, LayoutGrid, Award, Shield, Settings, Info, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { Language, ViewType, NavigationItem } from '../types';
import { translations, navigationItems } from '../data/translations';
import LucideIcon from './LucideIcon';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  lang: Language;
  activeView: ViewType;
  onSelectView: (viewId: ViewType) => void;
  favoritePages?: ViewType[];
  accessibleMarketingModules?: Record<string, boolean>;
}

export default function Sidebar({
  isCollapsed,
  onToggleCollapse,
  lang,
  activeView,
  onSelectView,
  favoritePages = [],
  accessibleMarketingModules,
}: SidebarProps) {
  const t = translations[lang];
  const isRtl = lang === 'ar';

  const [isMarketingExpanded, setIsMarketingExpanded] = useState(true);

  const categories = ['core', 'operations', 'growth', 'management'] as const;

  const getCategoryLabel = (cat: string) => {
    return t.categories[cat as keyof typeof t.categories] || cat;
  };

  // Get matching navigation items that are favorited
  const favoriteNavItems = navigationItems.filter(item => favoritePages.includes(item.id));

  return (
    <aside
      id="main-sidebar"
      className={`h-screen sticky top-0 shrink-0 bg-zinc-950 text-zinc-300 border-zinc-800 transition-all duration-300 flex flex-col justify-between z-30 shadow-2xl ${
        isCollapsed ? 'w-20' : 'w-64'
      } ${isRtl ? 'border-l' : 'border-r'}`}
    >
      
      {/* Upper Logo and Collapse Button */}
      <div className="flex flex-col">
        <div className="p-5 flex items-center justify-between border-b border-zinc-900 h-16 bg-zinc-950/80">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center font-bold text-zinc-950 shrink-0 select-none">
              R
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="text-base font-bold tracking-tight text-white font-sans uppercase">
                  {t.appName} <span className="text-brand-500 text-xs font-normal font-sans ml-0.5 mr-0.5">{lang === 'ar' ? 'رفاه' : ''}</span>
                </span>
                <span className="text-[9px] text-zinc-500 font-semibold tracking-wide -mt-0.5 truncate max-w-[150px]">
                  {lang === 'ar' ? 'المنصة الملكية للصالونات' : 'REFAH BEAUTY PLATFORM'}
                </span>
              </div>
            )}
          </div>

          {/* Toggle Button */}
          {!isCollapsed && (
            <button
              onClick={onToggleCollapse}
              className="p-1.5 hover:bg-zinc-900 rounded-lg text-zinc-500 hover:text-white transition-colors cursor-pointer"
              title={isCollapsed ? t.expandSidebar : t.collapseSidebar}
            >
              {isRtl ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          )}
        </div>

        {/* Small inline toggle button when collapsed */}
        {isCollapsed && (
          <div className="flex justify-center py-4 border-b border-zinc-900 bg-zinc-950/20">
            <button
              onClick={onToggleCollapse}
              className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all cursor-pointer"
            >
              {isRtl ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>
          </div>
        )}

        {/* Multi-Level Group Navigation */}
        <div className="px-3 py-4 space-y-5 overflow-y-auto max-h-[calc(100vh-190px)] scrollbar-none">
          
          {/* Favorite Pages Shelf (Personalization Hook) */}
          {favoriteNavItems.length > 0 && (
            <div className="space-y-1 bg-zinc-900/30 p-2 rounded-xl border border-zinc-900/40">
              {!isCollapsed && (
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-2 px-2 font-sans flex items-center gap-1.5">
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
                          ? 'bg-zinc-900 text-white font-bold border-amber-500'
                          : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`transition-colors shrink-0 ${isActive ? 'text-amber-500' : 'text-zinc-500 group-hover:text-amber-400'}`}>
                          <LucideIcon name={item.iconName} size={14} />
                        </span>
                        {!isCollapsed && <span className="truncate">{itemLabel}</span>}
                      </div>
                      
                      {isCollapsed && (
                        <span className={`absolute ${isRtl ? 'right-full mr-2' : 'left-full ml-2'} top-1/2 -translate-y-1/2 bg-zinc-900 text-white text-[10px] px-2 py-1 rounded shadow-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap font-sans`}>
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
            const itemsInCat = navigationItems.filter((i) => i.category === cat);
            return (
              <div key={cat} className="space-y-1">
                {/* Section title (Hide if collapsed) */}
                {!isCollapsed && (
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 px-3 font-sans">
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
                                ? 'bg-zinc-900 text-white font-medium border-brand-500'
                                : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50 border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`transition-colors shrink-0 ${
                                  isAnyChildActive ? 'text-brand-500' : 'text-zinc-500 group-hover:text-zinc-300'
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
                              <span className={`absolute ${isRtl ? 'right-full mr-2' : 'left-full ml-2'} top-1/2 -translate-y-1/2 bg-zinc-900 text-white text-[10px] px-2 py-1 rounded shadow-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap font-sans`}>
                                {itemLabel}
                              </span>
                            )}
                          </button>

                          {/* Render sub-items if expanded & sidebar is not collapsed */}
                          {isOpen && !isCollapsed && (
                            <div className={`ms-4 border-s border-zinc-800/80 ps-3 space-y-1 mt-1 transition-all`}>
                              {visibleSubItems.map((sub) => {
                                const isSubActive = activeView === sub.id;
                                const subLabel = isRtl ? sub.labelAr : sub.labelEn;

                                return (
                                  <button
                                    key={sub.id}
                                    onClick={() => onSelectView(sub.id)}
                                    className={`w-full text-start flex items-center gap-2.5 py-2 px-2.5 rounded-md text-xs transition-all relative cursor-pointer ${
                                      isSubActive
                                        ? 'bg-zinc-900 text-brand-400 font-bold border-s-2 border-brand-400 -ms-[13px] ps-[11px]'
                                        : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900/20'
                                    }`}
                                  >
                                    <span className={`shrink-0 ${isSubActive ? 'text-brand-400' : 'text-zinc-600'}`}>
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
                            ? 'bg-zinc-900 text-white font-medium border-brand-500'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50 border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`transition-colors shrink-0 ${
                              isActive ? 'text-brand-500' : 'text-zinc-500 group-hover:text-zinc-300'
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
                              : 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                          }`}>
                            {badge}
                          </span>
                        )}

                        {/* Collapsed Tooltip helper */}
                        {isCollapsed && (
                          <span className={`absolute ${isRtl ? 'right-full mr-2' : 'left-full ml-2'} top-1/2 -translate-y-1/2 bg-zinc-900 text-white text-[10px] px-2 py-1 rounded shadow-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap font-sans`}>
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
      <div className="p-4 border-t border-zinc-900 bg-zinc-950/40">
        {!isCollapsed ? (
          <div className="space-y-3">
            {/* System compliance */}
            <div className="p-2.5 bg-zinc-900 border border-zinc-800/60 rounded-xl flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-zinc-400 uppercase leading-none">
                  {lang === 'ar' ? 'الربط المعتمد' : 'ZATCA INTEGRATED'}
                </p>
                <p className="text-[9px] text-zinc-500 leading-none mt-1">
                  {lang === 'ar' ? 'المرحلة ٢ - الفاتورة الإلكترونية' : 'Saudi e-Invoicing Phase 2'}
                </p>
              </div>
            </div>

            {/* Saudi Arabia context indicator */}
            <p className="text-[10px] text-zinc-500 text-center flex items-center justify-center gap-1 font-sans">
              <span>{t.saudiArabia}</span>
              <span>🇸🇦</span>
              <span>•</span>
              <span className="font-mono">v1.2</span>
            </p>
          </div>
        ) : (
          <div className="flex justify-center text-zinc-500">
            <span>🇸🇦</span>
          </div>
        )}
      </div>

    </aside>
  );
}
