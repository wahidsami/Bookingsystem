import React, { useState, useEffect } from 'react';
import {
  TrendingUp, Users, Calendar, Sparkles, Plus, Search, MapPin,
  Clock, Check, X, ShieldAlert, Award, Star, Gift, Package,
  Receipt, ShoppingBag, CreditCard, ChevronRight, MessageSquare,
  AlertCircle, Sparkle, ArrowLeft, ArrowRight, Save, Trash2, ShieldCheck, HelpCircle, Loader2
} from 'lucide-react';
import { Language, ViewType, QuickLaunchRequest } from '../types';
import { translations, navigationItems } from '../data/translations';
import {
  mockCustomers, mockEmployees,
  mockServices, mockTransactions, mockCampaigns,
  mockGiftCards, mockLoyalty, mockReviews
} from '../data/mockData';
import { tenantApiAdapter } from '../lib/tenantApiAdapter';
import LucideIcon from './LucideIcon';
import AppointmentWorkspace from './AppointmentWorkspace';
import FinanceReportsWorkspace from './FinanceReportsWorkspace';
import OperationsIntelligenceReport from './reports/OperationsIntelligenceReport';
import CustomersWorkspace from './CustomersWorkspace';
import TeamsWorkspace from './TeamsWorkspace';
import ServicesWorkspace from './ServicesWorkspace';
import Services2Workspace from './Services2Workspace';
import ResourcesWorkspace from './ResourcesWorkspace';
import ProductsWorkspace from './ProductsWorkspace';
import OrdersWorkspace from './OrdersWorkspace';
import HotDealsWorkspace from './HotDealsWorkspace';
import CustomerPushNotificationsWorkspace from './CustomerPushNotificationsWorkspace';
import PageSetupWorkspace from './PageSetupWorkspace';
import GiftCardsWorkspace from './GiftCardsWorkspace';
import ReviewsWorkspace from './ReviewsWorkspace';
import MessagesWorkspace from './MessagesWorkspace';
import PackagesWorkspace from './PackagesWorkspace';
import SupportWorkspace from './SupportWorkspace';
import SettingsWorkspace from './SettingsWorkspace';
import SubscriptionWorkspace from './subscription/SubscriptionWorkspace';
import BillingWorkspace from './subscription/BillingWorkspace';
import AuditWorkspace from './audit/AuditWorkspace';
import LoyaltyWorkspace from './LoyaltyWorkspace';
import { useTenantAuth } from '../contexts/TenantAuthContext';
import {
  buildTenantPlanSummary,
  formatTenantPlanBillingAmount,
  formatTenantPlanLimit
} from '../lib/tenantSubscription';
import { getAppointmentStatusToken } from '../lib/statusTokens';

interface WorkspaceProps {
  view: ViewType;
  lang: Language;
  onQuickAction: (type: any) => void;
  quickLaunchRequest?: QuickLaunchRequest | null;

  // Personalization props
  darkMode?: boolean;
  favoritePages?: ViewType[];
  onToggleFavoritePage?: (viewId: ViewType) => void;
  savedViews?: { id: string; name: string; view: ViewType; timestamp: string }[];
  onSaveView?: (name: string, viewId: ViewType) => void;
  onDeleteSavedView?: (id: string) => void;
  widgetOrder?: string[];
  onReorderWidgets?: (newOrder: string[]) => void;
  addEmployeeTrigger?: number;
  onAddEmployeeTriggerReset?: () => void;
  accessibleMarketingModules?: Record<string, boolean>;
  onChangeAccessibleMarketingModules?: (modules: Record<string, boolean>) => void;
}

export default function Workspace({
  view,
  lang,
  onQuickAction,
  quickLaunchRequest,
  darkMode = false,
  favoritePages = [],
  onToggleFavoritePage,
  savedViews = [],
  onSaveView,
  onDeleteSavedView,
  widgetOrder = ['revenue', 'bookings', 'customers', 'occupancy'],
  onReorderWidgets,
  addEmployeeTrigger = 0,
  onAddEmployeeTriggerReset,
  accessibleMarketingModules,
  onChangeAccessibleMarketingModules
}: WorkspaceProps) {
  const t = translations[lang];
  const isRtl = lang === 'ar';
  const { tenant, tenantSettings, packageEntitlements, subscription, subscriptionUsage } = useTenantAuth();

  // Local state for POS Cart
  const [posCart, setPosCart] = useState<{ item: any; quantity: number }[]>([]);
  const [posDiscount, setPosDiscount] = useState(0);
  const [posError, setPosError] = useState<string | null>(null);
  const [posSuccess, setPosSuccess] = useState<string | null>(null);
  const [posPaymentMethod, setPosPaymentMethod] = useState<'mada' | 'cash' | 'card'>('mada');
  const [posIsSubmitting, setPosIsSubmitting] = useState(false);

  // Local state for Saved Views Input
  const [newViewName, setNewViewName] = useState('');
  const [showSavedViewModal, setShowSavedViewModal] = useState(false);

  // Real Data State
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [todaysAppointments, setTodaysAppointments] = useState<any[]>([]);
  const [liveProducts, setLiveProducts] = useState<any[]>([]);
  const [tenantBills, setTenantBills] = useState<any[]>([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  // Simulated Loading State to display skeleton loading on view change (gives premium feel)
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadView = async () => {
      setIsLoading(true);
      if (view === 'dashboard') {
        try {
          const [statsRes, apptsRes] = await Promise.all([
            tenantApiAdapter.getDashboardStats(),
            tenantApiAdapter.getTodaysAppointments()
          ]);
          if (isMounted) {
            if (statsRes?.success) setDashboardStats(statsRes.stats);
            if (apptsRes?.success) setTodaysAppointments(apptsRes.appointments);
          }
        } catch (err) {
          console.error(err);
        }
      } else if (view === 'pos' || view === 'inventory') {
        try {
          const prodRes = await tenantApiAdapter.getProducts();
          if (isMounted) {
            setLiveProducts(Array.isArray(prodRes?.products) ? prodRes.products : []);
          }
        } catch (err) {
          console.error(err);
          if (isMounted) setLiveProducts([]);
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 400));
      }
      if (isMounted) setIsLoading(false);
    };
    loadView();
    return () => { isMounted = false; };
  }, [view]);

  // Helper to compute growth
  const computeGrowth = (today: number, yesterday: number) => {
    if (yesterday === 0) return today > 0 ? '+100%' : '0%';
    const pct = ((today - yesterday) / yesterday) * 100;
    return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
  };

  const revenueGrowth = dashboardStats ? computeGrowth(dashboardStats.todaysRevenue, dashboardStats.yesterdayRevenue) : '0%';
  const bookingsGrowth = dashboardStats ? computeGrowth(dashboardStats.todaysBookings, dashboardStats.yesterdayBookings) : '0%';
  const planSummary = buildTenantPlanSummary({
    locale: isRtl ? 'ar' : 'en',
    tenant,
    tenantSettings,
    packageEntitlements,
    subscription,
    usageSnapshot: subscriptionUsage
  });

  const teamSeatLimit = planSummary.usage.staff?.limit ?? planSummary.packageLimits?.maxStaff ?? null;
  const serviceLimit = planSummary.usage.services?.limit ?? planSummary.packageLimits?.maxServices ?? null;
  const productLimit = planSummary.usage.products?.limit ?? planSummary.packageLimits?.maxProducts ?? null;
  const marketingSmsLimit = planSummary.packageLimits?.smsMarketingCampaigns ?? null;
  const packageLimit = planSummary.packageLimits?.maxPackages ?? null;
  const currentTenantDisplay = isRtl ? planSummary.planNameAr : planSummary.planNameEn;

  useEffect(() => {
    let active = true;

    const loadTenantBills = async () => {
      if (view !== 'billing') {
        return;
      }

      setBillingLoading(true);
      setBillingError(null);
      try {
        const response = await tenantApiAdapter.getTenantBills();
        if (!active) return;
        setTenantBills(Array.isArray(response?.bills) ? response.bills : []);
      } catch (error: any) {
        if (!active) return;
        setBillingError(error?.message || (isRtl ? 'تعذر تحميل الفواتير.' : 'Failed to load invoices.'));
        setTenantBills([]);
      } finally {
        if (active) {
          setBillingLoading(false);
        }
      }
    };

    void loadTenantBills();

    return () => {
      active = false;
    };
  }, [view, isRtl]);

  // POS operations
  const handleAddToPosCart = (item: any) => {
    setPosError(null);
    setPosSuccess(null);
    setPosCart(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) {
        return prev.map(i => i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const handleRemoveFromPosCart = (itemId: string) => {
    setPosCart(prev => prev.filter(i => i.item.id !== itemId));
  };

  const getPosSubtotal = () => {
    return posCart.reduce((sum, i) => sum + (i.item.price * i.quantity), 0);
  };

  const getPosTotal = () => {
    const sub = getPosSubtotal();
    return Math.max(0, sub - posDiscount);
  };

  const handleCompletePayment = () => {
    if (posCart.length === 0) {
      setPosError(isRtl ? 'السلة فارغة! يرجى إضافة عناصر أولاً.' : 'POS cart is empty! Please add items first.');
      return;
    }
    setPosIsSubmitting(true);
    setPosError(null);
    setPosSuccess(null);
    setTimeout(() => {
      setPosIsSubmitting(false);
      setPosSuccess(
        isRtl
          ? `تم تجهيز الفاتورة بمبلغ ${getPosTotal()} ر.س وطريقة الدفع (${posPaymentMethod === 'mada' ? 'مدى' : posPaymentMethod === 'cash' ? 'نقدي' : 'بطاقة ائتمان'}). ملاحظة: الربط البرمجي لنقاط البيع مع الخادم (POST /tenant/pos/checkout) غير متوفر حالياً.`
          : `POS receipt prepared for ${getPosTotal()} SAR (${posPaymentMethod.toUpperCase()}). Note: Backend POS checkout integration (POST /tenant/pos/checkout) is not yet available in the API.`
      );
    }, 400);
  };

  // Reorder Dashboard Widget Logic
  const moveWidget = (index: number, direction: 'left' | 'right') => {
    if (!onReorderWidgets) return;
    const newOrder = [...widgetOrder];
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < newOrder.length) {
      // Swap positions
      const temp = newOrder[index];
      newOrder[index] = newOrder[targetIndex];
      newOrder[targetIndex] = temp;
      onReorderWidgets(newOrder);
    }
  };

  // Saved views action helper
  const handleCreateSavedView = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newViewName.trim()) return;
    if (onSaveView) {
      onSaveView(newViewName, view);
      setNewViewName('');
      setShowSavedViewModal(false);
    }
  };

  const isFavorited = favoritePages.includes(view);

  // Premium Shimmering Skeleton Loader UI Component
  const renderSkeleton = () => (
    <div className="space-y-6 animate-pulse" id="loading-skeleton-panel">
      {/* Header Skeleton */}
      <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-neutral-100'} flex justify-between items-center`}>
        <div className="space-y-2.5 w-2/3">
          <div className="h-2.5 bg-zinc-300 dark:bg-zinc-800 rounded-full w-24" />
          <div className="h-5 bg-zinc-300 dark:bg-zinc-800 rounded-full w-48" />
          <div className="h-3 bg-zinc-300 dark:bg-zinc-800 rounded-full w-full" />
        </div>
        <div className="h-9 bg-zinc-300 dark:bg-zinc-800 rounded-lg w-28" />
      </div>

      {/* Grid Content Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`p-5 rounded-2xl border h-44 ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-neutral-100'} space-y-4`}>
          <div className="flex justify-between">
            <div className="h-3 bg-zinc-300 dark:bg-zinc-800 rounded-full w-20" />
            <div className="h-8 bg-zinc-300 dark:bg-zinc-800 rounded-lg w-8" />
          </div>
          <div className="h-8 bg-zinc-300 dark:bg-zinc-800 rounded-full w-32" />
          <div className="h-3 bg-zinc-300 dark:bg-zinc-800 rounded-full w-full" />
        </div>
        <div className={`p-5 rounded-2xl border h-44 ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-neutral-100'} space-y-4`}>
          <div className="flex justify-between">
            <div className="h-3 bg-zinc-300 dark:bg-zinc-800 rounded-full w-20" />
            <div className="h-8 bg-zinc-300 dark:bg-zinc-800 rounded-lg w-8" />
          </div>
          <div className="h-8 bg-zinc-300 dark:bg-zinc-800 rounded-full w-32" />
          <div className="h-3 bg-zinc-300 dark:bg-zinc-800 rounded-full w-full" />
        </div>
        <div className={`p-5 rounded-2xl border h-44 ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-neutral-100'} space-y-4`}>
          <div className="flex justify-between">
            <div className="h-3 bg-zinc-300 dark:bg-zinc-800 rounded-full w-20" />
            <div className="h-8 bg-zinc-300 dark:bg-zinc-800 rounded-lg w-8" />
          </div>
          <div className="h-8 bg-zinc-300 dark:bg-zinc-800 rounded-full w-32" />
          <div className="h-3 bg-zinc-300 dark:bg-zinc-800 rounded-full w-full" />
        </div>
      </div>

      {/* Row Skeleton */}
      <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-neutral-100'} space-y-4`}>
        <div className="h-4 bg-zinc-300 dark:bg-zinc-800 rounded-full w-1/4" />
        <div className="space-y-2">
          <div className="h-3 bg-zinc-300 dark:bg-zinc-800 rounded-full w-full" />
          <div className="h-3 bg-zinc-300 dark:bg-zinc-800 rounded-full w-5/6" />
          <div className="h-3 bg-zinc-300 dark:bg-zinc-800 rounded-full w-4/5" />
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return renderSkeleton();
  }

  return (
    <div className="space-y-6" id="workspace-container">

      {/* View Header with dynamic favoriting capability (Personalization Hook) */}
      {view !== 'appointments' && (
      <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 md:p-6 rounded-2xl border transition-all duration-200 shadow-2xs ${
        darkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="relative">
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-black tracking-tight font-sans flex items-center gap-2">
              <span>
                {view === 'dashboard'
                  ? (isRtl ? 'لوحة التحكم والعمليات' : 'Operations Dashboard')
                  : (() => {
                      const navItem = navigationItems.find(item => item.id === view);
                      const viewName = isRtl ? (navItem?.labelAr || view) : (navItem?.labelEn || view);
                      return isRtl
                        ? translations.ar.emptyWorkspaceTitle.replace('{name}', viewName)
                        : translations.en.emptyWorkspaceTitle.replace('{name}', viewName);
                    })()}
              </span>

              {/* Custom Saved View Indicator Badge */}
              {savedViews.some(sv => sv.view === view) && (
                <span className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold px-2.5 py-0.5 rounded-full border border-amber-500/20">
                  {isRtl ? 'منظر مخصص محفوظ' : 'SAVED VIEW'}
                </span>
              )}
            </h1>

            {/* Star Favorite Button */}
            <button
              onClick={() => onToggleFavoritePage && onToggleFavoritePage(view)}
              className={`p-1.5 rounded-lg transition-all hover:scale-105 cursor-pointer ${
                isFavorited ? 'text-amber-500 hover:text-amber-600' : 'text-slate-300 hover:text-slate-500 dark:text-zinc-600 dark:hover:text-zinc-400'
              }`}
              title={isFavorited ? (isRtl ? 'إزالة من المفضلة' : 'Remove from Favorites') : (isRtl ? 'إضافة للمفضلة' : 'Save to Favorites')}
            >
              <Star size={16} fill={isFavorited ? 'currentColor' : 'none'} className="stroke-[2]" />
            </button>
          </div>

          {view === 'dashboard' && (
            <p className="text-xs md:text-sm text-slate-500 dark:text-zinc-400 mt-1 font-medium">
              {isRtl
                ? 'مركز إدارة ومتابعة العمليات اليومية وحركة الحجوزات لـ BarSpa'
                : 'BarSpa operational command & real-time monitoring center'}
            </p>
          )}
        </div>

        {/* Quick buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">

          {/* Save current view button */}
          <button
            onClick={() => setShowSavedViewModal(true)}
            className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              darkMode ? 'border-zinc-700 hover:bg-zinc-800' : 'border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            <Save size={13} />
            <span>{isRtl ? 'حفظ هذا المنظر مسبقاً' : 'Save view filter'}</span>
          </button>



          {(view === 'services' || view === 'services2') && (
            <button
              onClick={() => onQuickAction('service')}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs md:text-sm transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={16} />
              <span>{isRtl ? 'إضافة خدمة' : 'Add Service'}</span>
            </button>
          )}
          {view === 'products' && (
            <button
              onClick={() => onQuickAction('product')}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs md:text-sm transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={16} />
              <span>{isRtl ? 'إضافة منتج' : 'Add Product'}</span>
            </button>
          )}
          {view === 'employees' && (
            <button
              onClick={() => onQuickAction('employee')}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs md:text-sm transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={16} />
              <span>{isRtl ? 'تعيين عضو فريق' : 'Add Team Member'}</span>
            </button>
          )}
          {view === 'giftcards' && (
            <button
              onClick={() => onQuickAction('giftcard')}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs md:text-sm transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={16} />
              <span>{isRtl ? 'إصدار بطاقة' : 'Issue Gift Card'}</span>
            </button>
          )}
        </div>
      </div>
      )}

      {/* RENDER HIGH-FIDELITY VIEWS */}

      {/* 1. DASHBOARD WITH PERSONALIZED WIDGET ORDER & SAVED VIEWS */}
      {view === 'dashboard' && (
        <div className="space-y-6">

          {/* Personalized widget grid container */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {widgetOrder.map((widgetId, index) => {
              // Render individual stats blocks based on user order (reordering widgets support)
              if (widgetId === 'revenue') {
                return (
                  <div key="revenue" className={`p-5 rounded-2xl border flex justify-between items-start relative group transition-all duration-200 ${
                    darkMode ? 'bg-zinc-900 border-zinc-800 shadow-sm' : 'bg-white border-neutral-200/80 shadow-xs hover:border-neutral-300'
                  }`}>
                    <div className="space-y-1.5">
                      <span className="text-xs text-neutral-500 dark:text-zinc-400 font-semibold tracking-wide uppercase block">
                        {isRtl ? 'إجمالي المبيعات اليوم' : 'Today\'s Total Revenue'}
                      </span>
                      <p className="text-3xl font-black font-mono tracking-tight text-neutral-900 dark:text-white">
                        {(dashboardStats?.todaysRevenue || 0).toLocaleString()} <span className="text-base font-bold text-neutral-500 dark:text-zinc-400 font-sans">{t.riyal}</span>
                      </p>
                      <div className="pt-1">
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 border bg-emerald-50 text-emerald-950 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800">
                          <TrendingUp size={12} className="shrink-0 text-emerald-700 dark:text-emerald-300" />
                          <span dir="ltr">{revenueGrowth}</span>
                          <span>{isRtl ? 'عن أمس' : 'vs yesterday'}</span>
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2.5">
                      <span className="w-10 h-10 flex items-center justify-center bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300 rounded-xl border border-brand-100 dark:border-brand-900/40 shrink-0">
                        <TrendingUp size={20} />
                      </span>

                      {/* Widget Reordering buttons */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => moveWidget(index, 'left')} className="p-1 hover:bg-neutral-100 dark:hover:bg-zinc-800 rounded text-neutral-400" disabled={index === 0} title={isRtl ? 'تحريك للخلف' : 'Move left'}><ArrowLeft size={11} /></button>
                        <button onClick={() => moveWidget(index, 'right')} className="p-1 hover:bg-neutral-100 dark:hover:bg-zinc-800 rounded text-neutral-400" disabled={index === widgetOrder.length - 1} title={isRtl ? 'تحريك للأمام' : 'Move right'}><ArrowRight size={11} /></button>
                      </div>
                    </div>
                  </div>
                );
              }
              if (widgetId === 'bookings') {
                return (
                  <div key="bookings" className={`p-5 rounded-2xl border flex justify-between items-start relative group transition-all duration-200 ${
                    darkMode ? 'bg-zinc-900 border-zinc-800 shadow-sm' : 'bg-white border-neutral-200/80 shadow-xs hover:border-neutral-300'
                  }`}>
                    <div className="space-y-1.5">
                      <span className="text-xs text-neutral-500 dark:text-zinc-400 font-semibold tracking-wide uppercase block">
                        {isRtl ? 'حجوزات اليوم' : 'Today\'s Bookings'}
                      </span>
                      <p className="text-3xl font-black font-mono tracking-tight text-neutral-900 dark:text-white">
                        {(dashboardStats?.todaysBookings || 0).toLocaleString()}
                      </p>
                      <div className="pt-1">
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 border bg-emerald-50 text-emerald-950 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800">
                          <Calendar size={12} className="shrink-0 text-emerald-700 dark:text-emerald-300" />
                          <span dir="ltr">{bookingsGrowth}</span>
                          <span>{isRtl ? 'مقارنة بأمس' : 'vs yesterday'}</span>
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2.5">
                      <span className="w-10 h-10 flex items-center justify-center bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-xl border border-emerald-100 dark:border-emerald-900/40 shrink-0">
                        <Calendar size={20} />
                      </span>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => moveWidget(index, 'left')} className="p-1 hover:bg-neutral-100 dark:hover:bg-zinc-800 rounded text-neutral-400" disabled={index === 0} title={isRtl ? 'تحريك للخلف' : 'Move left'}><ArrowLeft size={11} /></button>
                        <button onClick={() => moveWidget(index, 'right')} className="p-1 hover:bg-neutral-100 dark:hover:bg-zinc-800 rounded text-neutral-400" disabled={index === widgetOrder.length - 1} title={isRtl ? 'تحريك للأمام' : 'Move right'}><ArrowRight size={11} /></button>
                      </div>
                    </div>
                  </div>
                );
              }
              if (widgetId === 'customers') {
                return (
                  <div key="customers" className={`p-5 rounded-2xl border flex justify-between items-start relative group transition-all duration-200 ${
                    darkMode ? 'bg-zinc-900 border-zinc-800 shadow-sm' : 'bg-white border-neutral-200/80 shadow-xs hover:border-neutral-300'
                  }`}>
                    <div className="space-y-1.5">
                      <span className="text-xs text-neutral-500 dark:text-zinc-400 font-semibold tracking-wide uppercase block">
                        {isRtl ? 'إجمالي العملاء' : 'Total Customers'}
                      </span>
                      <p className="text-3xl font-black font-mono tracking-tight text-neutral-900 dark:text-white">
                        {(dashboardStats?.totalCustomers || 0).toLocaleString()}
                      </p>
                      <div className="pt-1">
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 border bg-blue-50 text-blue-950 border-blue-200 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-800">
                          <Users size={12} className="shrink-0 text-blue-700 dark:text-blue-300" />
                          <span>{isRtl ? 'قاعدة العملاء النشطة' : 'Active Client Base'}</span>
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2.5">
                      <span className="w-10 h-10 flex items-center justify-center bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 rounded-xl border border-blue-100 dark:border-blue-900/40 shrink-0">
                        <Users size={20} />
                      </span>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => moveWidget(index, 'left')} className="p-1 hover:bg-neutral-100 dark:hover:bg-zinc-800 rounded text-neutral-400" disabled={index === 0} title={isRtl ? 'تحريك للخلف' : 'Move left'}><ArrowLeft size={11} /></button>
                        <button onClick={() => moveWidget(index, 'right')} className="p-1 hover:bg-neutral-100 dark:hover:bg-zinc-800 rounded text-neutral-400" disabled={index === widgetOrder.length - 1} title={isRtl ? 'تحريك للأمام' : 'Move right'}><ArrowRight size={11} /></button>
                      </div>
                    </div>
                  </div>
                );
              }
              if (widgetId === 'occupancy') {
                return (
                  <div key="occupancy" className={`p-5 rounded-2xl border flex justify-between items-start relative group transition-all duration-200 ${
                    darkMode ? 'bg-zinc-900 border-zinc-800 shadow-sm' : 'bg-white border-neutral-200/80 shadow-xs hover:border-neutral-300'
                  }`}>
                    <div className="space-y-1.5">
                      <span className="text-xs text-neutral-500 dark:text-zinc-400 font-semibold tracking-wide uppercase block">
                        {isRtl ? 'فريق العمل النشط' : 'Active Team Members'}
                      </span>
                      <p className="text-3xl font-black font-mono tracking-tight text-neutral-900 dark:text-white">
                        {(dashboardStats?.activeEmployees || 0).toLocaleString()}
                      </p>
                      <div className="pt-1">
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 border bg-rose-50 text-rose-950 border-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800">
                          <Sparkles size={12} className="shrink-0 text-rose-700 dark:text-rose-300" />
                          <span>
                            {teamSeatLimit === null
                              ? (isRtl ? 'مزامنة حدود الباقة جارية' : 'Syncing plan limits')
                              : teamSeatLimit === -1
                                ? (isRtl ? 'عدد المقاعد غير محدود' : 'Unlimited plan seats')
                                : `${dashboardStats?.activeEmployees || 0} / ${formatTenantPlanLimit(teamSeatLimit, isRtl ? 'ar' : 'en')} ${isRtl ? 'مقعد' : 'seats'}`}
                          </span>
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2.5">
                      <span className="w-10 h-10 flex items-center justify-center bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 rounded-xl border border-rose-100 dark:border-rose-900/40 shrink-0">
                        <Sparkles size={20} />
                      </span>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => moveWidget(index, 'left')} className="p-1 hover:bg-neutral-100 dark:hover:bg-zinc-800 rounded text-neutral-400" disabled={index === 0} title={isRtl ? 'تحريك للخلف' : 'Move left'}><ArrowLeft size={11} /></button>
                        <button onClick={() => moveWidget(index, 'right')} className="p-1 hover:bg-neutral-100 dark:hover:bg-zinc-800 rounded text-neutral-400" disabled={index === widgetOrder.length - 1} title={isRtl ? 'تحريك للأمام' : 'Move right'}><ArrowRight size={11} /></button>
                      </div>
                    </div>
                  </div>
                );
              }
              if (widgetId === 'packages') {
                return (
                  <div key="packages" className={`p-5 rounded-2xl border flex justify-between items-start relative group transition-all duration-200 ${
                    darkMode ? 'bg-zinc-900 border-zinc-800 shadow-sm' : 'bg-white border-neutral-200/80 shadow-xs hover:border-neutral-300'
                  }`}>
                    <div className="space-y-1.5">
                      <span className="text-xs text-neutral-500 dark:text-zinc-400 font-semibold tracking-wide uppercase block">
                        {isRtl ? 'الباقات النشطة' : 'Active Packages'}
                      </span>
                      <p className="text-3xl font-black font-mono tracking-tight text-neutral-900 dark:text-white">
                        {packageLimit === null ? '—' : packageLimit === -1 ? '∞' : packageLimit.toLocaleString()}
                      </p>
                      <div className="pt-1">
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 border bg-amber-50 text-amber-950 border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800">
                          <Package size={12} className="shrink-0 text-amber-700 dark:text-amber-300" />
                          <span>
                            {packageLimit === null
                              ? (isRtl ? 'مزامنة حدود الباقة جارية' : 'Syncing plan limits')
                              : packageLimit === -1
                                ? (isRtl ? 'عدد الباقات غير محدود' : 'Unlimited packages')
                                : `${isRtl ? 'باقة متاحة' : 'packages available'}`}
                          </span>
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2.5">
                      <span className="w-10 h-10 flex items-center justify-center bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 rounded-xl border border-amber-100 dark:border-amber-900/40 shrink-0">
                        <Package size={20} />
                      </span>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => moveWidget(index, 'left')} className="p-1 hover:bg-neutral-100 dark:hover:bg-zinc-800 rounded text-neutral-400" disabled={index === 0} title={isRtl ? 'تحريك للخلف' : 'Move left'}><ArrowLeft size={11} /></button>
                        <button onClick={() => moveWidget(index, 'right')} className="p-1 hover:bg-neutral-100 dark:hover:bg-zinc-800 rounded text-neutral-400" disabled={index === widgetOrder.length - 1} title={isRtl ? 'تحريك للأمام' : 'Move right'}><ArrowRight size={11} /></button>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })}
          </div>

          {/* Quick Saved Views Shelf (Personalization Hook) */}
          {savedViews.length > 0 && (
            <div className={`p-4 rounded-2xl border transition-colors ${
              darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-neutral-200/80 shadow-xs'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <Save size={14} className="shrink-0" />
                  <span>{isRtl ? 'المناظر المحفوظة المخصصة' : 'Personalized Saved Views'}</span>
                </h3>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
                  {savedViews.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {savedViews.map((sv) => (
                  <div
                    key={sv.id}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      darkMode
                        ? 'bg-zinc-850 border-zinc-700 text-zinc-200 hover:bg-zinc-800'
                        : 'bg-amber-50/50 border-amber-200/80 text-amber-950 hover:bg-amber-100/60'
                    }`}
                  >
                    <span>{sv.name}</span>
                    <span className="text-[10px] bg-white dark:bg-zinc-900 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-zinc-700 uppercase font-mono text-neutral-600 dark:text-zinc-400">{sv.view}</span>
                    <button
                      onClick={() => onDeleteSavedView && onDeleteSavedView(sv.id)}
                      className="text-neutral-400 hover:text-rose-600 transition-colors p-0.5"
                      title={isRtl ? 'حذف هذا المنظر' : 'Delete this saved view'}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Dashboard Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Today's Schedule Operational Component */}
            <div className={`p-6 rounded-2xl border transition-colors lg:col-span-2 ${
              darkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-neutral-200/80 shadow-xs'
            }`}>
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-neutral-100 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <h3 className="font-bold text-base text-neutral-900 dark:text-white">
                    {isRtl ? 'المواعيد التشغيلية اليوم' : 'Active Appointments Today'}
                  </h3>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-800 dark:bg-zinc-800 dark:text-zinc-200">
                    {todaysAppointments.length}
                  </span>
                </div>
                <button
                  onClick={() => onQuickAction('calendar')}
                  className="text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 hover:underline inline-flex items-center gap-1"
                >
                  <span>{isRtl ? 'عرض جدول المواعيد كاملاً' : 'View Full Schedule'}</span>
                  <ArrowRight size={13} className={isRtl ? 'rotate-180' : ''} />
                </button>
              </div>

              <div className="space-y-2.5">
                {todaysAppointments.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-neutral-200 dark:border-zinc-800 rounded-2xl">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-neutral-50 dark:bg-zinc-850 flex items-center justify-center text-neutral-400">
                      <Calendar size={24} />
                    </div>
                    <p className="text-sm font-bold text-neutral-700 dark:text-zinc-300">
                      {isRtl ? 'لا توجد مواعيد مسجلة لليوم حتى الآن' : 'No appointments scheduled for today'}
                    </p>
                    <p className="text-xs text-neutral-400 mt-1">
                      {isRtl ? 'يمكنك حجز موعد جديد مباشرة من قائمة الإجراءات السريعة' : 'You can book a new appointment directly from Quick Actions'}
                    </p>
                  </div>
                ) : (
                  todaysAppointments.slice(0, 4).map((apt: any) => {
                    const statusToken = getAppointmentStatusToken(apt.status);
                    return (
                      <div
                        key={apt.id}
                        className={`p-3.5 border rounded-xl transition-all flex items-center justify-between ${
                          darkMode ? 'border-zinc-800 bg-zinc-850/40 hover:border-brand-500' : 'border-neutral-200/70 bg-neutral-50/40 hover:border-brand-300 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusToken.dotClass || 'bg-neutral-400'}`} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                                {apt.customerName}
                              </p>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${statusToken.containerClass}`}>
                                {isRtl ? statusToken.labelAr : statusToken.labelEn}
                              </span>
                            </div>
                            <p className="text-xs text-neutral-500 dark:text-zinc-400 font-medium truncate mt-0.5">
                              {isRtl ? (apt.serviceName_ar || apt.serviceName) : apt.serviceName}
                              {apt.employeeName && (
                                <>
                                  <span className="mx-1.5 text-neutral-300 dark:text-zinc-700">•</span>
                                  <span>{apt.employeeName}</span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="text-end shrink-0 ps-3">
                          <div dir="ltr" className="inline-block text-end">
                            <span className="text-xs font-bold font-mono text-neutral-900 dark:text-white block">
                              {apt.startTime}
                            </span>
                            {apt.endTime && (
                              <span className="text-[11px] text-neutral-500 dark:text-zinc-400 font-mono block">
                                {apt.endTime}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className={`p-6 rounded-2xl border transition-colors flex flex-col justify-between ${
              darkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-neutral-200/80 shadow-xs'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-100 dark:border-zinc-800">
                  <h3 className="font-bold text-base text-neutral-900 dark:text-white">
                    {isRtl ? 'إجراءات تشغيلية سريعة' : 'Operational Quick Actions'}
                  </h3>
                  <span className="text-[11px] text-neutral-400 uppercase font-mono tracking-wider">
                    {isRtl ? 'مباشر' : 'Direct'}
                  </span>
                </div>
                <div className="space-y-2.5">
                  <button
                    onClick={() => onQuickAction('appointment')}
                    className={`w-full p-3.5 border rounded-xl flex items-center justify-between group transition-all text-start ${
                      darkMode ? 'border-zinc-800 bg-zinc-850/40 hover:bg-zinc-800 hover:border-brand-500' : 'border-neutral-200/80 bg-neutral-50/50 hover:bg-brand-50/30 hover:border-brand-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="p-2.5 bg-brand-50 dark:bg-brand-950/50 rounded-xl text-brand-700 dark:text-brand-300 border border-brand-100 dark:border-brand-900/50 group-hover:scale-105 transition-transform">
                        <Calendar size={18} />
                      </span>
                      <div>
                        <p className="text-sm font-bold text-neutral-900 dark:text-white">
                          {isRtl ? 'حجز موعد جديد' : 'New Booking'}
                        </p>
                        <p className="text-xs text-neutral-400">
                          {isRtl ? 'تسجيل عميل في التقويم' : 'Add appointment to calendar'}
                        </p>
                      </div>
                    </div>
                    <ArrowRight size={16} className={`text-neutral-400 group-hover:text-brand-600 transition-transform ${isRtl ? 'rotate-180 group-hover:-translate-x-1' : 'group-hover:translate-x-1'}`} />
                  </button>

                  <button
                    onClick={() => onQuickAction('service')}
                    className={`w-full p-3.5 border rounded-xl flex items-center justify-between group transition-all text-start ${
                      darkMode ? 'border-zinc-800 bg-zinc-850/40 hover:bg-zinc-800 hover:border-rose-500' : 'border-neutral-200/80 bg-neutral-50/50 hover:bg-rose-50/30 hover:border-rose-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="p-2.5 bg-rose-50 dark:bg-rose-950/50 rounded-xl text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-900/50 group-hover:scale-105 transition-transform">
                        <Sparkles size={18} />
                      </span>
                      <div>
                        <p className="text-sm font-bold text-neutral-900 dark:text-white">
                          {isRtl ? 'إضافة خدمة جديدة' : 'Add Service'}
                        </p>
                        <p className="text-xs text-neutral-400">
                          {isRtl ? 'تحديث قائمة الخدمات والأسعار' : 'Update service catalog'}
                        </p>
                      </div>
                    </div>
                    <ArrowRight size={16} className={`text-neutral-400 group-hover:text-rose-600 transition-transform ${isRtl ? 'rotate-180 group-hover:-translate-x-1' : 'group-hover:translate-x-1'}`} />
                  </button>

                  <button
                    onClick={() => onQuickAction('giftcard')}
                    className={`w-full p-3.5 border rounded-xl flex items-center justify-between group transition-all text-start ${
                      darkMode ? 'border-zinc-800 bg-zinc-850/40 hover:bg-zinc-800 hover:border-amber-500' : 'border-neutral-200/80 bg-neutral-50/50 hover:bg-amber-50/30 hover:border-amber-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="p-2.5 bg-amber-50 dark:bg-amber-950/50 rounded-xl text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900/50 group-hover:scale-105 transition-transform">
                        <Gift size={18} />
                      </span>
                      <div>
                        <p className="text-sm font-bold text-neutral-900 dark:text-white">
                          {isRtl ? 'إصدار بطاقة هدايا' : 'Issue Gift Card'}
                        </p>
                        <p className="text-xs text-neutral-400">
                          {isRtl ? 'تفعيل رصيد أو كوبون هدية' : 'Create digital voucher'}
                        </p>
                      </div>
                    </div>
                    <ArrowRight size={16} className={`text-neutral-400 group-hover:text-amber-600 transition-transform ${isRtl ? 'rotate-180 group-hover:-translate-x-1' : 'group-hover:translate-x-1'}`} />
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 2. APPOINTMENTS */}
      {view === 'appointments' && (
        <AppointmentWorkspace
          lang={lang}
          onQuickAction={onQuickAction}
          quickLaunchRequest={quickLaunchRequest}
          onToggleFavoritePage={() => onToggleFavoritePage && onToggleFavoritePage('appointments')}
          isFavorited={isFavorited}
          setShowSavedViewModal={setShowSavedViewModal}
        />
      )}

      {/* 3. CUSTOMERS */}
      {view === 'customers' && (
        <CustomersWorkspace lang={lang} quickLaunchRequest={quickLaunchRequest} />
      )}

      {/* 4. EMPLOYEES */}
      {view === 'employees' && (
        <TeamsWorkspace
          lang={lang}
          addEmployeeTrigger={addEmployeeTrigger}
          onAddEmployeeTriggerReset={onAddEmployeeTriggerReset}
          quickLaunchRequest={quickLaunchRequest}
        />
      )}

      {/* 5. SERVICES */}
      {view === 'services' && (
        <ServicesWorkspace lang={lang} quickLaunchRequest={quickLaunchRequest} />
      )}

      {/* 5B. SERVICES 2 */}
      {view === 'services2' && (
        <Services2Workspace lang={lang} quickLaunchRequest={quickLaunchRequest} />
      )}

      {/* 5C. RESOURCES (PHASE 1C) */}
      {view === 'resources' && (
        <ResourcesWorkspace lang={lang} darkMode={darkMode} />
      )}

      {/* 6. PRODUCTS */}
      {view === 'products' && (
        <ProductsWorkspace lang={lang} quickLaunchRequest={quickLaunchRequest} />
      )}

      {/* 6B. ORDERS */}
      {view === 'orders' && (
        <OrdersWorkspace lang={lang} darkMode={darkMode} />
      )}

      {/* 7. POS (POINT OF SALE) WITH DETAILED STATES */}
      {view === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">

          {/* Catalog Selection */}
          <div className={`lg:col-span-2 p-6 rounded-2xl border transition-colors space-y-4 ${
            darkMode ? 'bg-zinc-900 border-zinc-850 text-zinc-100' : 'bg-white border-neutral-100 shadow-xs'
          }`}>
            <h3 className="font-bold text-base">{isRtl ? 'سلة الخدمات والمنتجات السريعة' : 'Interactive Checkout POS Catalog'}</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mockServices.map(srv => (
                <div
                  key={srv.id}
                  onClick={() => handleAddToPosCart({ id: srv.id, nameAr: srv.nameAr, nameEn: srv.nameEn, price: srv.price, type: 'service' })}
                  className={`p-3 border rounded-xl cursor-pointer transition-all flex justify-between items-center group ${
                    darkMode ? 'border-zinc-800 hover:border-brand-500 hover:bg-zinc-800' : 'border-neutral-100 hover:border-brand-300 hover:bg-brand-50/10'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="text-[9px] bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded-full font-bold">{isRtl ? 'خدمة' : 'Service'}</span>
                    <p className="text-xs font-bold truncate group-hover:text-brand-950 dark:group-hover:text-white mt-1">{isRtl ? srv.nameAr : srv.nameEn}</p>
                  </div>
                  <span className="text-xs font-black text-brand-600 dark:text-brand-400 font-mono shrink-0">{srv.price} {t.riyal}</span>
                </div>
              ))}

              {liveProducts.length > 0 ? liveProducts.map(prd => (
                <div
                  key={prd.id}
                  onClick={() => prd.stock > 0 && handleAddToPosCart({ id: prd.id, nameAr: prd.nameAr, nameEn: prd.nameEn, price: prd.price, type: 'product' })}
                  className={`p-3 border rounded-xl cursor-pointer transition-all flex justify-between items-center group ${
                    prd.stock === 0 ? 'opacity-50 pointer-events-none' : ''
                  } ${
                    darkMode ? 'border-zinc-800 hover:border-brand-500 hover:bg-zinc-800' : 'border-neutral-100 hover:border-brand-300 hover:bg-brand-50/10'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="text-[9px] bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-bold">{isRtl ? 'منتج' : 'Product'}</span>
                    <p className="text-xs font-bold truncate group-hover:text-brand-950 dark:group-hover:text-white mt-1">{isRtl ? prd.nameAr : prd.nameEn}</p>
                  </div>
                  <span className="text-xs font-black text-brand-600 dark:text-brand-400 font-mono shrink-0">{prd.price} {t.riyal}</span>
                </div>
              )) : (
                <div className={`col-span-2 p-5 rounded-xl border text-center text-xs ${darkMode ? 'border-zinc-800 bg-zinc-900/60 text-zinc-400' : 'border-neutral-100 bg-neutral-50 text-neutral-500'}`}>
                  {isRtl ? 'لا توجد منتجات مضافة بعد.' : 'No live products are available yet.'}
                </div>
              )}
            </div>
          </div>

          {/* Ticket Receipt Area with error & success state simulation */}
          <div className={`p-6 rounded-2xl border transition-colors flex flex-col justify-between min-h-[400px] ${
            darkMode ? 'bg-zinc-900 border-zinc-850 text-zinc-100' : 'bg-white border-neutral-100 shadow-md'
          }`}>
            <div>
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-neutral-100 dark:border-zinc-850">
                <h3 className="font-bold text-sm md:text-base">{isRtl ? 'فاتورة العميل النشط' : 'Active Checkout Ticket'}</h3>
                {posCart.length > 0 && (
                  <button onClick={() => setPosCart([])} className="text-[10px] text-rose-500 hover:underline">{isRtl ? 'إفراغ' : 'Clear'}</button>
                )}
              </div>

              {/* Success / Error Alerts */}
              {posError && (
                <div className="p-3 mb-3 text-xs bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-xl flex items-center gap-2">
                  <AlertCircle size={14} />
                  <span>{posError}</span>
                </div>
              )}

              {posSuccess && (
                <div className="p-3 mb-3 text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center gap-2">
                  <Check size={14} />
                  <span>{posSuccess}</span>
                </div>
              )}

              {posCart.length === 0 ? (
                <div className="text-center py-12 text-neutral-400">
                  <ShoppingBag size={32} className="mx-auto text-neutral-300 dark:text-zinc-700 mb-2 stroke-[1.5]" />
                  <p className="text-xs">{isRtl ? 'اختر خدمات أو منتجات لبدء الفاتورة السريعة' : 'Select items to build ticket'}</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  {posCart.map(item => (
                    <div key={item.item.id} className="flex justify-between items-center text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold truncate">{isRtl ? item.item.nameAr : item.item.nameEn}</p>
                        <p className="text-[10px] text-neutral-400 font-mono">{item.quantity} x {item.item.price} {t.riyal}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold font-mono">{(item.item.price * item.quantity)} {t.riyal}</span>
                        <button onClick={() => handleRemoveFromPosCart(item.item.id)} className="p-0.5 hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-500 rounded"><X size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {posCart.length > 0 && (
              <div className="pt-4 border-t border-neutral-100 dark:border-zinc-800 space-y-3">
                <div className="flex justify-between text-xs text-neutral-400 font-medium">
                  <span>{isRtl ? 'المجموع الفرعي (قبل الضريبة)' : 'Subtotal (excl. VAT)'}</span>
                  <span className="font-mono">{(getPosTotal() / 1.15).toFixed(2)} {t.riyal}</span>
                </div>

                <div className="flex justify-between text-xs text-neutral-400 font-medium">
                  <span>{isRtl ? 'ضريبة القيمة المضافة (15%)' : 'VAT (15%)'}</span>
                  <span className="font-mono">{(getPosTotal() - (getPosTotal() / 1.15)).toFixed(2)} {t.riyal}</span>
                </div>

                {/* Simulated quick Discount */}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-400 font-medium">{isRtl ? 'خصم ترويجي' : 'Promotional Discount'}</span>
                  <div className="flex gap-1.5">
                    <button onClick={() => setPosDiscount(50)} className={`px-2 py-0.5 rounded text-[10px] border ${posDiscount === 50 ? 'bg-[#1D035F] text-white border-[#1D035F]' : 'bg-neutral-50 dark:bg-zinc-800 text-neutral-600 dark:text-zinc-300 border-neutral-200 dark:border-zinc-700'}`}>50 {t.riyal}</button>
                    <button onClick={() => setPosDiscount(100)} className={`px-2 py-0.5 rounded text-[10px] border ${posDiscount === 100 ? 'bg-[#1D035F] text-white border-[#1D035F]' : 'bg-neutral-50 dark:bg-zinc-800 text-neutral-600 dark:text-zinc-300 border-neutral-200 dark:border-zinc-700'}`}>100 {t.riyal}</button>
                    <button onClick={() => setPosDiscount(0)} className="text-[10px] text-neutral-400 hover:text-neutral-600">×</button>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] text-neutral-400 font-medium">{isRtl ? 'طريقة الدفع' : 'Payment Method'}</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['mada', 'cash', 'card'] as const).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPosPaymentMethod(method)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all text-center ${
                          posPaymentMethod === method
                            ? 'bg-[#1D035F] text-white border-[#1D035F] shadow-xs'
                            : 'bg-neutral-50 dark:bg-zinc-800 text-neutral-600 dark:text-zinc-300 border-neutral-200 dark:border-zinc-700 hover:bg-neutral-100'
                        }`}
                      >
                        {method === 'mada' ? (isRtl ? 'مدى' : 'Mada') : method === 'cash' ? (isRtl ? 'نقدي' : 'Cash') : (isRtl ? 'بطاقة' : 'Card')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between text-sm md:text-base font-black pt-2 border-t border-dashed border-neutral-100 dark:border-zinc-800">
                  <span>{isRtl ? 'الصافي النهائي للمدفوع' : 'Total Net Payable'}</span>
                  <span className="font-mono text-[#1D035F] dark:text-[#A78BFA]">{getPosTotal()} {t.riyal}</span>
                </div>

                <button
                  onClick={handleCompletePayment}
                  disabled={posIsSubmitting}
                  className="w-full py-2.5 rounded-xl bg-[#1D035F] hover:bg-[#280580] text-white font-bold text-xs md:text-sm text-center shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {posIsSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                  <span>
                    {posPaymentMethod === 'mada'
                      ? (isRtl ? 'تسديد الفاتورة عبر Mada' : 'Complete Mada Checkout')
                      : posPaymentMethod === 'cash'
                      ? (isRtl ? 'تسجيل الدفع النقدي' : 'Record Cash Payment')
                      : (isRtl ? 'تسديد الفاتورة عبر البطاقة' : 'Complete Card Checkout')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setPosCart([]); setPosDiscount(0); setPosSuccess(null); setPosError(null); }}
                  className="w-full py-1 text-center text-xs text-neutral-400 hover:text-rose-500 transition-colors cursor-pointer"
                >
                  {isRtl ? 'إفراغ السلة' : 'Clear Cart'}
                </button>
              </div>
            )}
          </div>

        </div>
      )}

      {/* 8. FINANCIAL */}
      {view === 'financial' && (
        <FinanceReportsWorkspace lang={lang} />
      )}

      {/* 9. REPORTS */}
      {view === 'reports' && (
        <OperationsIntelligenceReport lang={lang} />
      )}

      {/* 10. MARKETING OVERVIEW & COMPLIANCE CONTROLS */}
      {view === 'marketing' && (
        <div className="space-y-6 animate-fade-in">
          {/* Main Card header */}
          <div className={`p-6 rounded-2xl border transition-colors ${
            darkMode ? 'bg-zinc-900 border-zinc-850 text-zinc-100' : 'bg-white border-neutral-100 shadow-xs'
          }`}>
            <h3 className="font-extrabold text-base md:text-lg mb-2 text-brand-500">
              {isRtl ? 'بوابة التسويق والترويج الشاملة' : 'Integrated Marketing Workspace'}
            </h3>
            <p className="text-xs text-neutral-400 max-w-2xl leading-relaxed">
              {isRtl ? 'تحكم في عروض صالون بارسبا الفاخرة، حملات إشعارات الدفع المباشرة، بطاقات الإهداء، إعداد صفحة الهبوط العامة، ومراجعات العملاء من مكان واحد.' : 'Manage BarSpa seasonal campaigns, direct customer push notifications, prestige gift cards, public landing layouts, and client feedback from a single cohesive directory.'}
            </p>
          </div>

          {/* Module Access Config / Tester HUD */}
          <div className={`p-5 rounded-2xl border ${
            darkMode ? 'bg-zinc-900 border-zinc-850 text-zinc-100' : 'bg-white border-neutral-150'
          }`}>
            <h4 className="font-black text-xs md:text-sm mb-3 text-amber-500 flex items-center gap-2">
              <ShieldCheck size={16} />
              {isRtl ? 'أدوات اختبار الصلاحيات (المطلوبة): مَن يمكنه الوصول؟' : 'Required Accessibility Controller Panel:'}
            </h4>
            <p className="text-[11px] text-neutral-400 mb-4">
              {isRtl ? 'قم بتعطيل أو تفعيل أي موديول أدناه لاختبار القاعدة: "يجب ألا يظهر خيار التسويق في القائمة الجانبية إلا إذا كان هناك موديول فرعي واحد على الأقل متاحاً للوصول إليه".' : 'Toggle accessibility checkboxes below to dynamically verify the requirement: "Marketing menu should only appear if at least one child module is accessible."'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5 text-xs font-bold">
              {[
                { id: 'marketing-hot-deals', labelAr: 'العروض الساخنة', labelEn: 'Hot Deals' },
                { id: 'marketing-notifications', labelAr: 'إشعارات الدفع', labelEn: 'Push Notifications' },
                { id: 'marketing-gift-cards', labelAr: 'بطاقات الهدايا', labelEn: 'Gift Cards' },
                { id: 'marketing-reviews', labelAr: 'تقييمات العملاء', labelEn: 'Reviews' },
                { id: 'marketing-page-setup', labelAr: 'إعداد صفحة الهبوط', labelEn: 'Page Setup' }
              ].map(item => {
                const isChecked = accessibleMarketingModules ? !!accessibleMarketingModules[item.id] : true;
                return (
                  <label key={item.id} className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-colors select-none ${
                    isChecked
                      ? 'bg-brand-500/10 border-brand-500 text-brand-500'
                      : darkMode ? 'bg-zinc-950/20 border-zinc-850 text-zinc-500' : 'bg-neutral-50 border-neutral-150 text-neutral-400'
                  }`}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (onChangeAccessibleMarketingModules && accessibleMarketingModules) {
                          onChangeAccessibleMarketingModules({
                            ...accessibleMarketingModules,
                            [item.id]: e.target.checked
                          });
                        }
                      }}
                      className="accent-brand-500 cursor-pointer"
                    />
                    <span className="truncate">{isRtl ? item.labelAr : item.labelEn}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Directory Navigation Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { id: 'marketing-hot-deals', titleAr: 'العروض الساخنة', titleEn: 'Hot Deals', descAr: 'إنشاء عروض ترويجية وخصومات سريعة لرفع الإشغال ومعدل الحجوزات.', descEn: 'Launch seasonal discount offers to fill empty scheduling blocks.', icon: 'Tag', bg: 'from-amber-500/5 hover:from-amber-500/10' },
              { id: 'marketing-notifications', titleAr: 'إشعارات الدفع', titleEn: 'Push Notifications', descAr: 'بث رسائل تذكير وتنبيهات مباشرة لهواتف عملائك المستهدفين.', descEn: 'Broadcast instant alert popups directly to lockscreens of selected segments.', icon: 'Bell', bg: 'from-brand-500/5 hover:from-brand-500/10' },
              { id: 'marketing-gift-cards', titleAr: 'بطاقات الهدايا', titleEn: 'Gift Cards', descAr: 'إصدار وشحن بطاقات إهداء رقمية فخمة لضيوف بارسبا وعائلاتهم.', descEn: 'Configure and print elegant prepaid credits to boost customer loyalty.', icon: 'Gift', bg: 'from-rose-500/5 hover:from-rose-500/10' },
              { id: 'marketing-reviews', titleAr: 'تقييمات العملاء', titleEn: 'Reviews', descAr: 'متابعة أصداء العملاء وتقييماتهم المباشرة والرد الفوري عليها لتعزيز السمعة.', descEn: 'Audit real customer ratings and write prestigious replies to reinforce satisfaction.', icon: 'Star', bg: 'from-yellow-500/5 hover:from-yellow-500/10' },
              { id: 'marketing-page-setup', titleAr: 'إعداد صفحة الهبوط', titleEn: 'Page Setup', descAr: 'تحكم بالهوية البصرية، ألوان الموقع، ومحتوى البانر الموجه للعموم.', descEn: 'Customize site colors, carousel carousels, and visual theme rendered to public clients.', icon: 'Globe', bg: 'from-emerald-500/5 hover:from-emerald-500/10' }
            ].map((module) => {
              const isAccessible = accessibleMarketingModules ? !!accessibleMarketingModules[module.id] : true;
              return (
                <div
                  key={module.id}
                  className={`p-6 border rounded-2xl flex flex-col justify-between transition-all duration-300 relative overflow-hidden group ${
                    isAccessible
                      ? darkMode ? 'border-zinc-850 bg-zinc-900 text-zinc-100 hover:border-brand-500/60' : 'border-neutral-100 bg-white hover:border-brand-300 shadow-xs'
                      : 'opacity-50 pointer-events-none'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div className={`p-3 rounded-xl bg-zinc-950/40 border border-zinc-800 text-brand-500`}>
                        <LucideIcon name={module.icon} size={22} />
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        isAccessible
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                      }`}>
                        {isAccessible ? (isRtl ? 'متاح للوصول' : 'Accessible') : (isRtl ? 'مغلق' : 'Restricted')}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-extrabold text-sm md:text-base group-hover:text-brand-400 transition-colors">
                        {isRtl ? module.titleAr : module.titleEn}
                      </h4>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        {isRtl ? module.descAr : module.descEn}
                      </p>
                    </div>
                  </div>

                  {isAccessible && (
                    <button
                      onClick={() => onQuickAction({ type: 'navigate', viewId: module.id })}
                      className="mt-6 w-full py-2 bg-zinc-950 hover:bg-[#1D035F] border border-zinc-850 hover:border-[#6537C0] text-neutral-300 hover:text-white rounded-xl font-bold transition-all text-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>{isRtl ? 'دخول الموديول' : 'Open Workspace'}</span>
                      {isRtl ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* INTERNAL STAFF MESSAGES */}
      {view === 'messages' && (
        <MessagesWorkspace lang={lang} darkMode={darkMode} />
      )}

      {/* SUPPORT EXPERIENCE */}
      {view === 'support' && (
        <SupportWorkspace lang={lang} darkMode={darkMode} />
      )}

      {/* 10.1 HOT DEALS */}
      {view === 'marketing-hot-deals' && (
        <HotDealsWorkspace lang={lang} darkMode={darkMode} />
      )}

      {/* 10.2 PUSH NOTIFICATIONS */}
      {view === 'marketing-notifications' && (
        <CustomerPushNotificationsWorkspace lang={lang} darkMode={darkMode} />
      )}

      {/* 10.3 GIFT CARDS (NEW NESTED PATH) */}
      {view === 'marketing-gift-cards' && (
        <GiftCardsWorkspace lang={lang} darkMode={darkMode} quickLaunchRequest={quickLaunchRequest} />
      )}

      {/* 11. GIFT CARDS */}
      {view === 'giftcards' && (
        <GiftCardsWorkspace lang={lang} darkMode={darkMode} quickLaunchRequest={quickLaunchRequest} />
      )}

      {/* 10.4 REVIEWS (NEW NESTED PATH) */}
      {view === 'marketing-reviews' && (
        <ReviewsWorkspace lang={lang} darkMode={darkMode} />
      )}

      {/* 13. REVIEWS */}
      {view === 'reviews' && (
        <ReviewsWorkspace lang={lang} darkMode={darkMode} />
      )}

      {/* 10.5 PAGE SETUP */}
      {view === 'marketing-page-setup' && (
        <PageSetupWorkspace lang={lang} darkMode={darkMode} />
      )}

      {/* 14. INVENTORY */}
      {view === 'inventory' && (
        <div className={`p-6 rounded-2xl border transition-colors ${
          darkMode ? 'bg-zinc-900 border-zinc-850 text-zinc-100' : 'bg-white border-neutral-100 shadow-xs'
        }`}>
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-neutral-100 dark:border-zinc-800">
            <h3 className="font-bold text-base">{isRtl ? 'تنبيهات تدني وإعادة طلب المخزون' : 'Inventory Stock Level Alerts'}</h3>
            <span className="text-xs text-rose-500 bg-rose-50 dark:bg-rose-950/30 dark:text-rose-400 px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
              <ShieldAlert size={12} />
              {isRtl ? 'منتج واحد غير متوفر حالياً' : '1 item out-of-stock'}
            </span>
          </div>

          <div className="space-y-3">
            {liveProducts.length > 0 ? liveProducts.map((prd) => (
              <div key={prd.id} className={`p-3.5 border rounded-xl flex justify-between items-center text-xs ${
                darkMode ? 'border-zinc-800 bg-zinc-950/10' : 'border-neutral-100'
              }`}>
                <div>
                  <h4 className="font-bold">{isRtl ? prd.nameAr : prd.nameEn}</h4>
                  <p className="text-neutral-400 mt-1 font-mono text-[10px]">SKU: {prd.sku}</p>
                </div>
                <div className="text-end">
                  <p className="text-neutral-400 text-[10px] mb-1">{isRtl ? 'الكمية الحالية:' : 'Current Qty:'}</p>
                  <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                    prd.stock > 15 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' : prd.stock > 0 ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400'
                  }`}>{prd.stock} units</span>
                </div>
              </div>
            )) : (
              <div className={`p-4 rounded-xl border text-center text-xs ${darkMode ? 'border-zinc-800 bg-zinc-900/60 text-zinc-400' : 'border-neutral-100 bg-neutral-50 text-neutral-500'}`}>
                {isRtl ? 'لا توجد منتجات مخزنة حتى الآن.' : 'No products have been added to inventory yet.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 15. SUBSCRIPTION */}
      {view === 'subscription' && (
        <SubscriptionWorkspace lang={lang} darkMode={darkMode} />
      )}

      {/* 16. BILLING */}
      {view === 'billing' && (
        <BillingWorkspace lang={lang} darkMode={darkMode} />
      )}

      {/* 17. SETTINGS */}
      {view === 'settings' && (
        <SettingsWorkspace lang={lang} darkMode={darkMode} />
      )}

      {/* 18. AUDIT & OPERATIONS */}
      {view === 'audit' && (
        <AuditWorkspace lang={lang} darkMode={darkMode} />
      )}

      {/* 18. PACKAGES */}
      {view === 'packages' && (
        <PackagesWorkspace lang={lang} />
      )}

      {/* 19. LOYALTY */}
      {view === 'loyalty' && (
        <LoyaltyWorkspace lang={lang} darkMode={darkMode} />
      )}

      {/* Save view modal */}
      {showSavedViewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setShowSavedViewModal(false)} className="fixed inset-0 bg-neutral-950/60 backdrop-blur-xs" />
          <div className={`relative w-full max-w-sm rounded-2xl shadow-2xl border p-5 transition-all ${
            darkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-neutral-100 text-neutral-800'
          }`}>
            <h4 className="font-extrabold text-sm md:text-base">{isRtl ? '💾 حفظ هذا المنظر المخصص' : '💾 Save Current Filtered View'}</h4>
            <p className="text-[10px] text-neutral-400 mt-1">{isRtl ? 'احفظ الفلاتر النشطة لتبويب لوحة التحكم للوصول السريع إليها لاحقاً.' : 'Pin this view with its operational configuration to your dashboard.'}</p>

            <form onSubmit={handleCreateSavedView} className="mt-4 space-y-3">
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-neutral-200 dark:border-zinc-800 bg-transparent rounded-xl text-xs focus:ring-1 focus:ring-brand-500 focus:outline-none"
                placeholder={isRtl ? 'مثال: حجوزات الـ VIP ليوم السبت' : 'e.g. VIP Saturday Bookings'}
                value={newViewName}
                onChange={e => setNewViewName(e.target.value)}
              />
              <div className="flex justify-end gap-2 text-xs font-bold pt-2">
                <button type="button" onClick={() => setShowSavedViewModal(false)} className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-zinc-800 text-neutral-400">{isRtl ? 'إلغاء' : 'Cancel'}</button>
                <button type="submit" className="px-3.5 py-1.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors">{isRtl ? 'حفظ الحالتين' : 'Save View'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
