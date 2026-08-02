import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Sparkle, Info, X, Check } from 'lucide-react';
import { Language, ViewType, TabItem, QuickLaunchRequest } from './types';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Workspace from './components/Workspace';
import GlobalSearch from './components/GlobalSearch';
import ActivityCenter from './components/ActivityCenter';
import PublicExperience from './components/PublicExperience';
import { translations, navigationItems } from './data/translations';
import { isElevatedDashboardRoleKey, useTenantAuth } from './contexts/TenantAuthContext';
import { tenantApiAdapter } from './lib/tenantApiAdapter';
import {
  hasHotDealsEntitlement,
  hasProductsAndOrdersEntitlement,
  hasPublicPageCustomizationEntitlement,
  hasPushNotificationsEntitlement
} from './lib/tenantEntitlements';
import {
  dashboardLandingPageToView,
  normalizeDashboardLandingPage
} from './lib/dashboardLandingPage';

const DEFAULT_DASHBOARD_TAB: TabItem = {
  id: 'tab-dashboard',
  view: 'dashboard',
  titleAr: 'لوحة التحكم',
  titleEn: 'Dashboard',
};

const LOGOUT_PENDING_KEY = 'refah-logout-pending';

const createTabForView = (view: ViewType): TabItem => {
  const navItem = navigationItems.find(item => item.id === view);
  return {
    id: `tab-${view}`,
    view,
    titleAr: navItem?.labelAr || view,
    titleEn: navItem?.labelEn || view,
  };
};

export default function App() {
  const {
    user,
    account,
    tenantSettings,
    sessionType,
    permissions,
    packageEntitlements,
    error: authError,
    loading: authLoading,
    isAuthenticated,
    login,
    logout,
    refreshUser
  } = useTenantAuth();
  const [lang, setLang] = useState<Language>('ar');
  const [currentPath, setCurrentPath] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );
  const [currentSearch, setCurrentSearch] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.search : ''
  );
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentTenant, setCurrentTenant] = useState('سبا لا كولين الفاخر - فرع العليا الرياض');

  // Open Tabs State
  const [tabs, setTabs] = useState<TabItem[]>([DEFAULT_DASHBOARD_TAB]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-dashboard');
  const activeView = tabs.find(t => t.id === activeTabId)?.view || 'dashboard';
  const landingPageAppliedRef = useRef<string | null>(null);

  // Personalization States (Synced to LocalStorage for premium persistence)
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('refah-dark-mode') === 'true';
  });
  const [favoritePages, setFavoritePages] = useState<ViewType[]>(() => {
    try {
      const saved = localStorage.getItem('refah-favorite-pages');
      return saved ? JSON.parse(saved) : ['appointments', 'reports'];
    } catch {
      return ['appointments', 'reports'];
    }
  });
  const [savedViews, setSavedViews] = useState<{ id: string; name: string; view: ViewType; timestamp: string }[]>(() => {
    try {
      const saved = localStorage.getItem('refah-saved-views');
      return saved ? JSON.parse(saved) : [
        { id: 'sv-1', name: 'جلسات الـ VIP ليوم السبت', view: 'appointments', timestamp: '2026-06-27' },
        { id: 'sv-2', name: 'تقارير المبيعات العليا', view: 'reports', timestamp: '2026-06-27' }
      ];
    } catch {
      return [];
    }
  });
  const [widgetOrder, setWidgetOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('refah-widget-order');
      return saved ? JSON.parse(saved) : ['revenue', 'bookings', 'customers', 'occupancy'];
    } catch {
      return ['revenue', 'bookings', 'customers', 'occupancy'];
    }
  });

  // Modal & Search States
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isActivityCenterOpen, setIsActivityCenterOpen] = useState(false);
  const [addEmployeeTrigger, setAddEmployeeTrigger] = useState<number>(0);
  const [quickLaunchRequest, setQuickLaunchRequest] = useState<QuickLaunchRequest | null>(null);
  const dashboardBootstrapAttemptedRef = useRef(false);

  // Dynamic accessibility control for the Marketing group modules
  const [accessibleMarketingModules, setAccessibleMarketingModules] = useState<Record<string, boolean>>({
    'marketing-hot-deals': true,
  'marketing-gift-cards': true,
  'marketing-notifications': true,
  'marketing-reviews': true,
  'marketing-page-setup': true,
  'support': true,
  });
  const hasFullDashboardAccess =
    sessionType === 'tenant_owner' ||
    isElevatedDashboardRoleKey(account?.roleKey || user?.roleKey || permissions?.roleKey);

  // Custom premium Toast Notifications
  const [toasts, setToasts] = useState<{ id: string; messageAr: string; messageEn: string; type: 'success' | 'info' }[]>([]);

  // Sync personalizations to localStorage
  useEffect(() => {
    localStorage.setItem('refah-dark-mode', String(darkMode));
    const root = document.getElementById('refah-app-shell');
    if (root) {
      if (darkMode) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('refah-favorite-pages', JSON.stringify(favoritePages));
  }, [favoritePages]);

  useEffect(() => {
    localStorage.setItem('refah-saved-views', JSON.stringify(savedViews));
  }, [savedViews]);

  useEffect(() => {
    localStorage.setItem('refah-widget-order', JSON.stringify(widgetOrder));
  }, [widgetOrder]);

  const navigateToPath = useCallback((nextPath: string, options?: { replace?: boolean }) => {
    if (typeof window === 'undefined') return;

    const normalizedPath = nextPath.startsWith('/') ? nextPath : `/${nextPath}`;
    const nextSearch = '';
    const current = `${window.location.pathname}${window.location.search}`;
    const target = `${normalizedPath}${nextSearch}`;

    if (current === target) {
      return;
    }

    if (options?.replace) {
      window.history.replaceState(null, '', normalizedPath);
    } else {
      window.history.pushState(null, '', normalizedPath);
    }
    setCurrentPath(normalizedPath);
    setCurrentSearch(nextSearch);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
      setCurrentSearch(window.location.search);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    const isLogoutPending =
      typeof window !== 'undefined' && window.sessionStorage.getItem(LOGOUT_PENDING_KEY) === '1';

    if (isLogoutPending && currentPath.startsWith('/dashboard')) {
      navigateToPath('/', { replace: true });
      return;
    }

    if (isLogoutPending) {
      return;
    }

    if (currentPath.startsWith('/dashboard') && !isAuthenticated) {
      if (!dashboardBootstrapAttemptedRef.current) {
        dashboardBootstrapAttemptedRef.current = true;
        void refreshUser();
        return;
      }

      navigateToPath('/login', { replace: true });
      return;
    }

    if (isAuthenticated && !currentPath.startsWith('/dashboard')) {
      navigateToPath('/dashboard', { replace: true });
    }
  }, [authLoading, currentPath, isAuthenticated, navigateToPath, refreshUser]);

  useEffect(() => {
    if (!isAuthenticated) {
      landingPageAppliedRef.current = null;
      setTabs([DEFAULT_DASHBOARD_TAB]);
      setActiveTabId(DEFAULT_DASHBOARD_TAB.id);
      return;
    }

    dashboardBootstrapAttemptedRef.current = false;
  }, [isAuthenticated]);

  useEffect(() => {
    if (!currentPath.startsWith('/dashboard')) {
      dashboardBootstrapAttemptedRef.current = false;
    }
  }, [currentPath]);

  useEffect(() => {
    const tenantLabel =
      user?.businessName ||
      user?.displayName ||
      user?.name ||
      user?.business_name ||
      user?.name_en ||
      user?.name_ar ||
      null;

    if (tenantLabel) {
      setCurrentTenant(String(tenantLabel));
    }
  }, [user]);

  useEffect(() => {
    if (hasFullDashboardAccess) {
      setAccessibleMarketingModules({
        'marketing-hot-deals': true,
        'marketing-gift-cards': true,
        'marketing-notifications': true,
        'marketing-reviews': true,
        'marketing-page-setup': true,
        'support': true,
      });
      return;
    }

    setAccessibleMarketingModules({
      'marketing-hot-deals': hasHotDealsEntitlement(packageEntitlements),
      'marketing-gift-cards': hasProductsAndOrdersEntitlement(packageEntitlements),
      'marketing-notifications': hasPushNotificationsEntitlement(packageEntitlements),
      'marketing-reviews': Boolean(permissions?.view_reviews),
      'marketing-page-setup': hasPublicPageCustomizationEntitlement(packageEntitlements),
      'support': Boolean(permissions?.view_messages || permissions?.view_dashboard)
    });
  }, [packageEntitlements, permissions, hasFullDashboardAccess]);

  const addToast = (msgAr: string, msgEn: string, type: 'success' | 'info' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, messageAr: msgAr, messageEn: msgEn, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Keyboard listeners for shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Command Palette Trigger: Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
        return;
      }

      // Ignore standard letters if user is focusing an input, textarea or select
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }

      // 2. Toggle Dark Mode shortcut: D key
      if (e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setDarkMode(prev => {
          const next = !prev;
          addToast(
            next ? 'تم تفعيل المظهر الداكن الفاخر 🌙' : 'تم تفعيل المظهر المضيء الكلاسيكي ☀️',
            next ? 'Luxury Dark Mode activated 🌙' : 'Classic Light Mode activated ☀️',
            'info'
          );
          return next;
        });
      }

      // 3. Toggle Favorite current page shortcut: F key
      if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        handleToggleFavoritePage(activeView);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeView]);

  const handleToggleFavoritePage = (viewId: ViewType) => {
    setFavoritePages(prev => {
      const exists = prev.includes(viewId);
      let next: ViewType[];
      if (exists) {
        next = prev.filter(v => v !== viewId);
        addToast(
          `تمت إزالة صفحة ${viewId} من المفضلة السريعة`,
          `Removed ${viewId} page from favorites panel`,
          'info'
        );
      } else {
        next = [...prev, viewId];
        addToast(
          `تمت إضافة صفحة ${viewId} لمفضلتك السحابية الخاصة ⭐`,
          `Saved ${viewId} page to your dashboard favorites ⭐`,
          'success'
        );
      }
      return next;
    });
  };

  const handleSaveView = (name: string, viewId: ViewType) => {
    const newView = {
      id: `sv-${Date.now()}`,
      name,
      view: viewId,
      timestamp: new Date().toISOString().split('T')[0]
    };
    setSavedViews(prev => [newView, ...prev]);
    addToast(
      `تم حفظ المنظر المخصص "${name}" بنجاح 💾`,
      `Custom filtered view "${name}" saved successfully 💾`,
      'success'
    );
  };

  const handleDeleteSavedView = (id: string) => {
    setSavedViews(prev => prev.filter(sv => sv.id !== id));
    addToast(
      'تم إزالة المنظر المخصص بنجاح',
      'Saved view deleted successfully',
      'info'
    );
  };

  const handleToggleLang = () => {
    setLang(prev => {
      const next = prev === 'ar' ? 'en' : 'ar';
      
      // Update tenant name translation counterpart automatically
      if (next === 'en') {
        setCurrentTenant(c => 
          c.includes('العليا') 
            ? 'La Colline Luxury Spa - Olaya Riyadh' 
            : c.includes('الكورنيش') 
            ? 'REFAH Beauty & Spa - Corniche Jeddah' 
            : 'Royal Bridal Salon - Khobar Branch'
        );
      } else {
        setCurrentTenant(c => 
          c.includes('Olaya') 
            ? 'سبا لا كولين الفاخر - فرع العليا الرياض' 
            : c.includes('Corniche') 
            ? 'مركز تجميل واستجمام رفاه - فرع الكورنيش جدة' 
            : 'صالون العروس الملكي - فرع الخبر'
        );
      }

      addToast(
        `تم تحويل واجهة النظام للغة العربية الفصحى 🇸🇦`,
        `System layout converted to English successfully 🇬🇧`,
        'info'
      );
      return next;
    });
  };

  const handleSelectView = (viewId: ViewType) => {
    // Check if view has an existing open tab
    const existingTab = tabs.find(t => t.view === viewId);
    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      const navItem = navigationItems.find(n => n.id === viewId);
      if (navItem) {
        const newTab: TabItem = createTabForView(viewId);
        setTabs(prev => [...prev, newTab]);
        setActiveTabId(newTab.id);
      }
    }
  };

  useLayoutEffect(() => {
    if (!isAuthenticated || authLoading) {
      return;
    }

    const sessionKey = user?.id || account?.id || 'tenant-session';
    if (landingPageAppliedRef.current === sessionKey) {
      return;
    }

    const landingPage = dashboardLandingPageToView(
      normalizeDashboardLandingPage(tenantSettings?.dashboardSettings?.defaultLandingPage)
    );

    landingPageAppliedRef.current = sessionKey;
    setTabs([createTabForView(landingPage)]);
    setActiveTabId(`tab-${landingPage}`);
  }, [account?.id, authLoading, isAuthenticated, tenantSettings?.dashboardSettings?.defaultLandingPage, user?.id]);

  // URL Path & Simulated Routing Synchronization
  useEffect(() => {
    const handleUrlChange = () => {
      const path = window.location.pathname;
      let targetView: ViewType | null = null;
      if (path === '/dashboard/hot-deals') targetView = 'marketing-hot-deals';
      else if (path === '/dashboard/gift-cards') targetView = 'marketing-gift-cards';
      else if (path === '/dashboard/notifications') targetView = 'marketing-notifications';
      else if (path === '/dashboard/reviews') targetView = 'marketing-reviews';
      else if (path === '/dashboard/page-setup') targetView = 'marketing-page-setup';
      else if (path === '/dashboard/support') targetView = 'support';
      else if (path === '/dashboard/messages') targetView = 'messages';
      else if (path === '/dashboard/customers' || path.startsWith('/dashboard/customers/')) targetView = 'customers';
      
      if (targetView) {
        handleSelectView(targetView);
      }
    };

    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  // Sync activeView changes back to browser address bar history
  useEffect(() => {
    let path = '';
    if (activeView === 'marketing-hot-deals') path = '/dashboard/hot-deals';
    else if (activeView === 'marketing-gift-cards') path = '/dashboard/gift-cards';
    else if (activeView === 'marketing-notifications') path = '/dashboard/notifications';
    else if (activeView === 'marketing-reviews') path = '/dashboard/reviews';
    else if (activeView === 'marketing-page-setup') path = '/dashboard/page-setup';
    else if (activeView === 'support') path = '/dashboard/support';
    else if (activeView === 'messages') path = '/dashboard/messages';
    else if (activeView === 'customers') {
      if (window.location.pathname.startsWith('/dashboard/customers/')) {
        path = window.location.pathname;
      } else {
        path = '/dashboard/customers';
      }
    }
    
    if (path && window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
  }, [activeView]);

  const handleCloseTab = (id: string) => {
    // Never allow closing the last remaining tab to avoid an empty state
    if (tabs.length === 1) {
      addToast(
        'لا يمكن إغلاق آخر تبويب نشط حالياً.',
        'Cannot close the last remaining active tab.',
        'info'
      );
      return;
    }

    const indexToClose = tabs.findIndex(t => t.id === id);
    const updatedTabs = tabs.filter(t => t.id !== id);
    setTabs(updatedTabs);

    if (id === activeTabId) {
      // Switch active view to the closest remaining tab
      const nextActiveIndex = indexToClose > 0 ? indexToClose - 1 : 0;
      setActiveTabId(updatedTabs[nextActiveIndex].id);
    }
  };

  const handleSelectTab = (id: string) => {
    setActiveTabId(id);
  };

  const handleQuickAction = (action: any) => {
    const type = typeof action === 'string' ? action : action?.type;
    const launchRequest = {
      target: type,
      nonce: Date.now() + Math.floor(Math.random() * 1000),
      serviceId: typeof action === 'object' && action?.serviceId ? action.serviceId : undefined,
      section: typeof action === 'object' && action?.section ? action.section : undefined
    };

    if (type === 'employee') {
      handleSelectView('employees');
      setAddEmployeeTrigger(prev => prev + 1);
      return;
    }

    if (type === 'giftcard') {
      handleSelectView('marketing-gift-cards');
      setQuickLaunchRequest(launchRequest);
      return;
    }

    const targetView =
      type === 'appointment' ? 'appointments' :
      type === 'customer' ? 'customers' :
      type === 'service' ? 'services' :
      type === 'product' ? 'products' :
      'dashboard';

    handleSelectView(targetView);
    setQuickLaunchRequest(launchRequest);
  };

  useEffect(() => {
    if (!quickLaunchRequest) {
      return;
    }

    const targetView =
      quickLaunchRequest.target === 'appointment' ? 'appointments' :
      quickLaunchRequest.target === 'customer' ? 'customers' :
      quickLaunchRequest.target === 'service' ? 'services' :
      quickLaunchRequest.target === 'product' ? 'products' :
      quickLaunchRequest.target === 'employee' ? 'employees' :
      'marketing-gift-cards';

    if (activeView !== targetView) {
      return;
    }

    const timer = window.setTimeout(() => setQuickLaunchRequest(null), 0);
    return () => window.clearTimeout(timer);
  }, [activeView, quickLaunchRequest]);

  const handleSwitchTenant = (tenant: string) => {
    setCurrentTenant(tenant);
    addToast(
      `تم تبديل فرع التشغيل بنجاح إلى: ${tenant}`,
      `Operational branch switched successfully to: ${tenant}`,
      'success'
    );
  };

  const handleLogout = async () => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(LOGOUT_PENDING_KEY, '1');
    }
    tenantApiAdapter.clearTokens();
    void logout();
    window.location.replace('/');
  };

  const handleLogin = async (email: string, password: string) => {
    await login(email, password);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(LOGOUT_PENDING_KEY);
    }
    navigateToPath('/dashboard', { replace: true });
  };

  const isRtl = lang === 'ar';

  if (authLoading) {
    return (
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        className="min-h-screen flex items-center justify-center bg-zinc-950 text-white"
      >
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-4 shadow-2xl">
          <Sparkle className="text-amber-400" size={18} />
          <span className="text-sm font-medium">
            {isRtl ? 'جارٍ تحميل جلسة المستأجر الحية...' : 'Loading live tenant session...'}
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <PublicExperience
        path={currentPath}
        search={currentSearch}
        lang={lang}
        onToggleLang={handleToggleLang}
        onNavigate={navigateToPath}
        onLogin={handleLogin}
        loginLoading={authLoading}
        loginError={authError}
      />
    );
  }

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className={`min-h-screen flex overflow-hidden font-sans relative transition-colors duration-200 ${
        darkMode ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-800'
      }`}
      id="refah-app-shell"
    >
      
      {/* Sidebar (dark luxury layout with favoritePages) */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        lang={lang}
        activeView={activeView}
        onSelectView={handleSelectView}
        favoritePages={favoritePages}
        accessibleMarketingModules={accessibleMarketingModules}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0" id="main-content-panel">
        
        {/* Sticky Header with integrated tab navigator */}
        <Topbar
          lang={lang}
          onToggleLang={handleToggleLang}
          activeView={activeView}
          onOpenSearch={() => setIsSearchOpen(true)}
          onQuickAction={handleQuickAction}
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={handleSelectTab}
          onCloseTab={handleCloseTab}
          currentTenant={currentTenant}
          onSwitchTenant={handleSwitchTenant}
          onLogout={handleLogout}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode(!darkMode)}
          onOpenActivityCenter={() => setIsActivityCenterOpen(true)}
        />

        {/* Content View area (bright clean layout) */}
        <main className={`flex-1 overflow-y-auto p-6 md:p-8 transition-colors duration-200 ${
          darkMode ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-800'
        }`}>
          <Workspace
            view={activeView}
            lang={lang}
            onQuickAction={handleQuickAction}
            darkMode={darkMode}
            favoritePages={favoritePages}
            onToggleFavoritePage={handleToggleFavoritePage}
            savedViews={savedViews}
            onSaveView={handleSaveView}
            onDeleteSavedView={handleDeleteSavedView}
          widgetOrder={widgetOrder}
          onReorderWidgets={setWidgetOrder}
          addEmployeeTrigger={addEmployeeTrigger}
          onAddEmployeeTriggerReset={() => setAddEmployeeTrigger(0)}
          quickLaunchRequest={quickLaunchRequest}
          accessibleMarketingModules={accessibleMarketingModules}
          onChangeAccessibleMarketingModules={setAccessibleMarketingModules}
        />
        </main>
      </div>

      {/* Unified Global Command-Palette Search */}
      <AnimatePresence>
        {isSearchOpen && (
          <GlobalSearch
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            lang={lang}
            onNavigate={handleSelectView}
            onQuickAction={handleQuickAction}
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode(!darkMode)}
          />
        )}
      </AnimatePresence>

      {/* Live Operations Activity Center Slide-out Drawer */}
      <AnimatePresence>
        {isActivityCenterOpen && (
          <ActivityCenter
            isOpen={isActivityCenterOpen}
            onClose={() => setIsActivityCenterOpen(false)}
            lang={lang}
            darkMode={darkMode}
          />
        )}
      </AnimatePresence>

      {/* Luxurious Toast Alerts Portal */}
      <div className={`fixed bottom-6 ${isRtl ? 'left-6' : 'right-6'} z-50 flex flex-col gap-3.5 max-w-sm w-full`}>
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              className={`border shadow-xl p-4 rounded-xl flex items-start gap-3 text-start relative overflow-hidden transition-colors ${
                darkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              {/* Luxury Accent stripe */}
              <div className={`absolute top-0 bottom-0 w-1 bg-brand-500 ${isRtl ? 'right-0' : 'left-0'}`} />

              <span className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${toast.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-brand-500/10 text-brand-500'}`}>
                {toast.type === 'success' ? <Check size={14} /> : <Info size={14} />}
              </span>

              <div className="flex-1 min-w-0 pr-2">
                <p className="text-xs md:text-sm font-semibold leading-snug">
                  {isRtl ? toast.messageAr : toast.messageEn}
                </p>
              </div>

              <button
                onClick={() => removeToast(toast.id)}
                className="p-1 hover:bg-neutral-100 dark:hover:bg-zinc-800 rounded text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                <X size={12} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
}
