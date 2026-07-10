import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, Users, Calendar, Sparkles, Plus, Search, MapPin, 
  Clock, Check, X, ShieldAlert, Award, Star, Gift, Package, 
  Receipt, ShoppingBag, CreditCard, ChevronRight, MessageSquare, 
  AlertCircle, Sparkle, ArrowLeft, ArrowRight, Save, Trash2, ShieldCheck, HelpCircle
} from 'lucide-react';
import { Language, ViewType } from '../types';
import { translations, navigationItems } from '../data/translations';
import { 
  mockCustomers, mockEmployees, 
  mockServices, mockProducts, mockTransactions, mockCampaigns, 
  mockGiftCards, mockLoyalty, mockReviews, mockInvoices 
} from '../data/mockData';
import { tenantApiAdapter } from '../lib/tenantApiAdapter';
import LucideIcon from './LucideIcon';
import AppointmentWorkspace from './AppointmentWorkspace';
import FinanceOverviewReport from './reports/FinanceOverviewReport';
import SalesOverviewReport from './reports/SalesOverviewReport';
import CustomersWorkspace from './CustomersWorkspace';
import TeamsWorkspace from './TeamsWorkspace';
import ServicesWorkspace from './ServicesWorkspace';
import ProductsWorkspace from './ProductsWorkspace';
import HotDealsWorkspace from './HotDealsWorkspace';
import CustomerPushNotificationsWorkspace from './CustomerPushNotificationsWorkspace';
import PageSetupWorkspace from './PageSetupWorkspace';
import GiftCardsWorkspace from './GiftCardsWorkspace';
import ReviewsWorkspace from './ReviewsWorkspace';
import MessagesWorkspace from './MessagesWorkspace';

interface WorkspaceProps {
  view: ViewType;
  lang: Language;
  onQuickAction: (type: any) => void;
  
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

  // Local state for POS Cart
  const [posCart, setPosCart] = useState<{ item: any; quantity: number }[]>([]);
  const [posDiscount, setPosDiscount] = useState(0);
  const [posError, setPosError] = useState<string | null>(null);
  const [posSuccess, setPosSuccess] = useState<string | null>(null);

  // Local state for Saved Views Input
  const [newViewName, setNewViewName] = useState('');
  const [showSavedViewModal, setShowSavedViewModal] = useState(false);

  // Real Data State
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [todaysAppointments, setTodaysAppointments] = useState<any[]>([]);

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
    setPosSuccess(
      isRtl 
        ? `تم إتمام عملية الدفع بنجاح بقيمة ${getPosTotal()} ر.س وطباعة الفاتورة والربط مع ZATCA!` 
        : `Payment of ${getPosTotal()} SAR completed successfully. e-Invoice cleared with ZATCA!`
    );
    setPosCart([]);
    setPosDiscount(0);
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
      <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl border transition-colors duration-200 shadow-sm ${
        darkMode ? 'bg-zinc-900 border-zinc-850 text-zinc-100' : 'bg-white border-neutral-100 text-neutral-800'
      }`}>
        <div className="relative">
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-black tracking-tight font-sans flex items-center gap-2">
              <span>
                {(() => {
                  const navItem = navigationItems.find(item => item.id === view);
                  const viewName = isRtl ? (navItem?.labelAr || view) : (navItem?.labelEn || view);
                  return isRtl 
                    ? translations.ar.emptyWorkspaceTitle.replace('{name}', viewName)
                    : translations.en.emptyWorkspaceTitle.replace('{name}', viewName);
                })()}
              </span>
              
              {/* Custom Saved View Indicator Badge */}
              {savedViews.some(sv => sv.view === view) && (
                <span className="text-[9px] bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold px-2 py-0.5 rounded-full border border-amber-500/10">
                  {isRtl ? 'منظر مخصص محفوظ' : 'SAVED VIEW'}
                </span>
              )}
            </h1>
            
            {/* Star Favorite Button */}
            <button
              onClick={() => onToggleFavoritePage && onToggleFavoritePage(view)}
              className={`p-1 rounded-md transition-all hover:scale-105 cursor-pointer ${
                isFavorited ? 'text-amber-500 hover:text-amber-600' : 'text-zinc-300 hover:text-zinc-500 dark:text-zinc-600'
              }`}
              title={isFavorited ? (isRtl ? 'إزالة من المفضلة' : 'Remove from Favorites') : (isRtl ? 'إضافة للمفضلة' : 'Save to Favorites')}
            >
              <Star size={16} fill={isFavorited ? 'currentColor' : 'none'} className="stroke-[2]" />
            </button>
          </div>
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

          {view === 'appointments' && (
            <button
              onClick={() => onQuickAction('appointment')}
              className="px-4 py-2 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs md:text-sm transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={16} />
              <span>{isRtl ? 'حجز موعد سريع' : 'Book Appointment'}</span>
            </button>
          )}
          {view === 'customers' && (
            <button
              onClick={() => onQuickAction('customer')}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs md:text-sm transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={16} />
              <span>{isRtl ? 'إضافة عميل' : 'Add Customer'}</span>
            </button>
          )}
          {view === 'services' && (
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
                  <div key="revenue" className={`p-5 rounded-2xl border flex justify-between items-start relative group transition-colors duration-200 ${
                    darkMode ? 'bg-zinc-900 border-zinc-850' : 'bg-white border-neutral-100 shadow-xs'
                  }`}>
                    <div>
                      <span className="text-xs text-neutral-400 font-semibold uppercase">{isRtl ? 'إجمالي المبيعات' : 'Total Revenue'}</span>
                      <p className="text-2xl font-black mt-1 font-mono">{(dashboardStats?.todaysRevenue || 0).toLocaleString()} {t.riyal}</p>
                      <span className="text-xs text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 px-2 py-0.5 rounded-full mt-2 inline-block">
                        {revenueGrowth} {isRtl ? 'عن أمس' : 'vs yesterday'}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-2.5">
                      <span className="p-2.5 bg-brand-50 dark:bg-brand-950/40 rounded-xl text-brand-600 dark:text-brand-400"><TrendingUp size={18} /></span>
                      
                      {/* Widget Reordering buttons */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => moveWidget(index, 'left')} className="p-1 hover:bg-neutral-100 dark:hover:bg-zinc-800 rounded text-neutral-400" disabled={index === 0}><ArrowLeft size={10} /></button>
                        <button onClick={() => moveWidget(index, 'right')} className="p-1 hover:bg-neutral-100 dark:hover:bg-zinc-800 rounded text-neutral-400" disabled={index === widgetOrder.length - 1}><ArrowRight size={10} /></button>
                      </div>
                    </div>
                  </div>
                );
              }
              if (widgetId === 'bookings') {
                return (
                  <div key="bookings" className={`p-5 rounded-2xl border flex justify-between items-start relative group transition-colors duration-200 ${
                    darkMode ? 'bg-zinc-900 border-zinc-850' : 'bg-white border-neutral-100 shadow-xs'
                  }`}>
                    <div>
                      <span className="text-xs text-neutral-400 font-semibold uppercase">{isRtl ? 'حجوزات اليوم' : 'Today\'s Bookings'}</span>
                      <p className="text-2xl font-black mt-1 font-mono">{dashboardStats?.todaysBookings || 0}</p>
                      <span className="text-xs text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 px-2 py-0.5 rounded-full mt-2 inline-block">
                        {bookingsGrowth} {isRtl ? 'مقارنة بأمس' : 'vs yesterday'}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-2.5">
                      <span className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400"><Calendar size={18} /></span>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => moveWidget(index, 'left')} className="p-1 hover:bg-neutral-100 dark:hover:bg-zinc-800 rounded text-neutral-400" disabled={index === 0}><ArrowLeft size={10} /></button>
                        <button onClick={() => moveWidget(index, 'right')} className="p-1 hover:bg-neutral-100 dark:hover:bg-zinc-800 rounded text-neutral-400" disabled={index === widgetOrder.length - 1}><ArrowRight size={10} /></button>
                      </div>
                    </div>
                  </div>
                );
              }
              if (widgetId === 'customers') {
                return (
                  <div key="customers" className={`p-5 rounded-2xl border flex justify-between items-start relative group transition-colors duration-200 ${
                    darkMode ? 'bg-zinc-900 border-zinc-850' : 'bg-white border-neutral-100 shadow-xs'
                  }`}>
                    <div>
                      <span className="text-xs text-neutral-400 font-semibold uppercase">{isRtl ? 'إجمالي العملاء' : 'Total Customers'}</span>
                      <p className="text-2xl font-black mt-1 font-mono">{dashboardStats?.totalCustomers || 0}</p>
                      <span className="text-xs text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 px-2 py-0.5 rounded-full mt-2 inline-block">
                        {isRtl ? 'قاعدة العملاء' : 'Active Client Base'}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-2.5">
                      <span className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-blue-600 dark:text-blue-400"><Users size={18} /></span>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => moveWidget(index, 'left')} className="p-1 hover:bg-neutral-100 dark:hover:bg-zinc-800 rounded text-neutral-400" disabled={index === 0}><ArrowLeft size={10} /></button>
                        <button onClick={() => moveWidget(index, 'right')} className="p-1 hover:bg-neutral-100 dark:hover:bg-zinc-800 rounded text-neutral-400" disabled={index === widgetOrder.length - 1}><ArrowRight size={10} /></button>
                      </div>
                    </div>
                  </div>
                );
              }
              if (widgetId === 'occupancy') {
                return (
                  <div key="occupancy" className={`p-5 rounded-2xl border flex justify-between items-start relative group transition-colors duration-200 ${
                    darkMode ? 'bg-zinc-900 border-zinc-850' : 'bg-white border-neutral-100 shadow-xs'
                  }`}>
                    <div>
                      <span className="text-xs text-neutral-400 font-semibold uppercase">{isRtl ? 'فريق العمل النشط' : 'Active Team Members'}</span>
                      <p className="text-2xl font-black mt-1 font-mono">{dashboardStats?.activeEmployees || 0}</p>
                      <span className="text-xs text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 px-2 py-0.5 rounded-full mt-2 inline-block">
                        {isRtl ? 'متاحين للخدمة' : 'Ready to serve'}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-2.5">
                      <span className="p-2.5 bg-rose-50 dark:bg-rose-950/40 rounded-xl text-rose-600 dark:text-rose-400"><Sparkles size={18} /></span>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => moveWidget(index, 'left')} className="p-1 hover:bg-neutral-100 dark:hover:bg-zinc-800 rounded text-neutral-400" disabled={index === 0}><ArrowLeft size={10} /></button>
                        <button onClick={() => moveWidget(index, 'right')} className="p-1 hover:bg-neutral-100 dark:hover:bg-zinc-800 rounded text-neutral-400" disabled={index === widgetOrder.length - 1}><ArrowRight size={10} /></button>
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
            <div className={`p-5 rounded-2xl border transition-colors ${
              darkMode ? 'bg-zinc-900 border-zinc-850' : 'bg-white border-neutral-100 shadow-xs'
            }`}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-3 flex items-center gap-1.5">
                <Save size={13} />
                <span>{isRtl ? 'مرشحات المناظر المحفوظة المخصصة' : 'My Personalized Saved Views'}</span>
              </h3>
              <div className="flex flex-wrap gap-2.5">
                {savedViews.map((sv) => (
                  <div 
                    key={sv.id}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                      darkMode 
                        ? 'bg-zinc-850 border-zinc-750 text-zinc-200 hover:bg-zinc-800' 
                        : 'bg-amber-50/40 border-amber-100 text-amber-900 hover:bg-amber-50'
                    }`}
                  >
                    <span>{sv.name}</span>
                    <span className="text-[9px] bg-white/50 px-1.5 py-0.5 rounded uppercase font-mono">{sv.view}</span>
                    <button 
                      onClick={() => onDeleteSavedView && onDeleteSavedView(sv.id)}
                      className="text-neutral-400 hover:text-rose-500 transition-colors ml-1"
                      title={isRtl ? 'حذف هذا المنظر' : 'Delete this saved view'}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Dashboard Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Today's Schedule */}
            <div className={`p-6 rounded-2xl border transition-colors lg:col-span-2 ${
              darkMode ? 'bg-zinc-900 border-zinc-850 text-zinc-100' : 'bg-white border-neutral-100 shadow-xs'
            }`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-base">{isRtl ? 'المواعيد النشطة اليوم' : 'Active Appointments Today'}</h3>
                <span className="text-xs text-brand-600 hover:underline cursor-pointer">{isRtl ? 'عرض جدول المواعيد كاملاً' : 'View Calendar'}</span>
              </div>
              <div className="space-y-3">
                {todaysAppointments.length === 0 ? (
                  <div className="p-4 text-center text-xs text-neutral-400 border rounded-xl border-dashed">
                    {isRtl ? 'لا توجد مواعيد نشطة اليوم' : 'No active appointments today'}
                  </div>
                ) : (
                  todaysAppointments.slice(0, 3).map((apt: any) => (
                    <div key={apt.id} className={`p-3 border rounded-xl transition-all flex items-center justify-between ${
                      darkMode ? 'border-zinc-800 hover:border-brand-500' : 'border-neutral-100 hover:border-brand-200'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${apt.status === 'completed' ? 'bg-emerald-500' : apt.status === 'confirmed' ? 'bg-blue-500' : 'bg-amber-500'}`} />
                        <div>
                          <p className="text-sm font-semibold">{apt.customerName}</p>
                          <p className="text-xs text-neutral-400">{isRtl ? (apt.serviceName_ar || apt.serviceName) : apt.serviceName} • {apt.employeeName}</p>
                        </div>
                      </div>
                      <div className="text-end">
                        <span className="text-xs font-bold block font-mono">{apt.startTime}</span>
                        <span className="text-[10px] text-neutral-400 block font-mono">{apt.endTime}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className={`p-6 rounded-2xl border transition-colors ${
              darkMode ? 'bg-zinc-900 border-zinc-850 text-zinc-100' : 'bg-white border-neutral-100 shadow-xs'
            }`}>
              <h3 className="font-bold text-base mb-4">{isRtl ? 'روابط التشغيل السريعة' : 'Operation Hub Quick Shortcuts'}</h3>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => onQuickAction('appointment')} className={`p-3 border rounded-xl text-center transition-all ${
                  darkMode ? 'border-zinc-800 hover:bg-zinc-800/50 hover:border-brand-500' : 'border-neutral-100 hover:border-brand-200 hover:bg-brand-50/20'
                }`}>
                  <span className="inline-block p-2 bg-brand-50 dark:bg-brand-950/40 rounded-lg text-brand-600 dark:text-brand-400 mb-1"><Calendar size={18} /></span>
                  <p className="text-xs font-bold">{isRtl ? 'حجز جديد' : 'New Booking'}</p>
                </button>
                <button onClick={() => onQuickAction('customer')} className={`p-3 border rounded-xl text-center transition-all ${
                  darkMode ? 'border-zinc-800 hover:bg-zinc-800/50 hover:border-emerald-500' : 'border-neutral-100 hover:border-emerald-200 hover:bg-emerald-50/20'
                }`}>
                  <span className="inline-block p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-emerald-600 dark:text-emerald-400 mb-1"><Users size={18} /></span>
                  <p className="text-xs font-bold">{isRtl ? 'عميل جديد' : 'New Client'}</p>
                </button>
                <button onClick={() => onQuickAction('service')} className={`p-3 border rounded-xl text-center transition-all ${
                  darkMode ? 'border-zinc-800 hover:bg-zinc-800/50 hover:border-rose-500' : 'border-neutral-100 hover:border-rose-200 hover:bg-rose-50/20'
                }`}>
                  <span className="inline-block p-2 bg-rose-50 dark:bg-rose-950/40 rounded-lg text-rose-600 dark:text-rose-400 mb-1"><Sparkles size={18} /></span>
                  <p className="text-xs font-bold">{isRtl ? 'إضافة خدمة' : 'Add Service'}</p>
                </button>
                <button onClick={() => onQuickAction('giftcard')} className={`p-3 border rounded-xl text-center transition-all ${
                  darkMode ? 'border-zinc-800 hover:bg-zinc-800/50 hover:border-amber-500' : 'border-neutral-100 hover:border-amber-200 hover:bg-amber-50/20'
                }`}>
                  <span className="inline-block p-2 bg-amber-50 dark:bg-amber-950/40 rounded-lg text-amber-600 dark:text-amber-400 mb-1"><Gift size={18} /></span>
                  <p className="text-xs font-bold">{isRtl ? 'بطاقة هدايا' : 'Issue Card'}</p>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 2. APPOINTMENTS */}
      {view === 'appointments' && (
        <AppointmentWorkspace lang={lang} onQuickAction={onQuickAction} />
      )}

      {/* 3. CUSTOMERS */}
      {view === 'customers' && (
        <CustomersWorkspace lang={lang} />
      )}

      {/* 4. EMPLOYEES */}
      {view === 'employees' && (
        <TeamsWorkspace 
          lang={lang} 
          addEmployeeTrigger={addEmployeeTrigger}
          onAddEmployeeTriggerReset={onAddEmployeeTriggerReset}
        />
      )}

      {/* 5. SERVICES */}
      {view === 'services' && (
        <ServicesWorkspace lang={lang} />
      )}

      {/* 6. PRODUCTS */}
      {view === 'products' && (
        <ProductsWorkspace lang={lang} />
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

              {mockProducts.map(prd => (
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
              ))}
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
                  <span>{isRtl ? 'المجموع الفرعي' : 'Subtotal'}</span>
                  <span className="font-mono">{getPosSubtotal()} {t.riyal}</span>
                </div>
                
                {/* Simulated quick Discount */}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-400 font-medium">{isRtl ? 'خصم ترويجي' : 'Promotional Discount'}</span>
                  <div className="flex gap-1.5">
                    <button onClick={() => setPosDiscount(50)} className={`px-2 py-0.5 rounded text-[10px] border ${posDiscount === 50 ? 'bg-brand-500 text-white' : 'bg-neutral-50 dark:bg-zinc-800 text-neutral-600 dark:text-zinc-300 border-neutral-200 dark:border-zinc-700'}`}>50 {t.riyal}</button>
                    <button onClick={() => setPosDiscount(100)} className={`px-2 py-0.5 rounded text-[10px] border ${posDiscount === 100 ? 'bg-brand-500 text-white' : 'bg-neutral-50 dark:bg-zinc-800 text-neutral-600 dark:text-zinc-300 border-neutral-200 dark:border-zinc-700'}`}>100 {t.riyal}</button>
                    <button onClick={() => setPosDiscount(0)} className="text-[10px] text-neutral-400 hover:text-neutral-600">×</button>
                  </div>
                </div>

                <div className="flex justify-between text-sm md:text-base font-black pt-2 border-t border-dashed border-neutral-100 dark:border-zinc-800">
                  <span>{isRtl ? 'الصافي النهائي للمدفوع' : 'Total Net Payable'}</span>
                  <span className="font-mono text-brand-600 dark:text-brand-400">{getPosTotal()} {t.riyal}</span>
                </div>

                <button 
                  onClick={handleCompletePayment}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-700 to-brand-600 hover:from-brand-800 hover:to-brand-700 text-white font-bold text-xs md:text-sm text-center shadow hover:shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CreditCard size={16} />
                  <span>{isRtl ? 'تسديد الفاتورة عبر Mada' : 'Complete Mada Checkout'}</span>
                </button>
              </div>
            )}
          </div>

        </div>
      )}

      {/* 8. FINANCIAL */}
      {view === 'financial' && (
        <FinanceOverviewReport lang={lang} />
      )}

      {/* 9. REPORTS */}
      {view === 'reports' && (
        <SalesOverviewReport lang={lang} />
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
              {isRtl ? 'تحكم في عروض صالون رفاه الفاخرة، حملات إشعارات الدفع المباشرة، بطاقات الإهداء، إعداد صفحة الهبوط العامة، ومراجعات العملاء من مكان واحد.' : 'Manage REFAH seasonal campaigns, direct customer push notifications, prestige gift cards, public landing layouts, and client feedback from a single cohesive directory.'}
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
              { id: 'marketing-gift-cards', titleAr: 'بطاقات الهدايا', titleEn: 'Gift Cards', descAr: 'إصدار وشحن بطاقات إهداء رقمية فخمة لضيوف رفاه وعائلاتهم.', descEn: 'Configure and print elegant prepaid credits to boost customer loyalty.', icon: 'Gift', bg: 'from-rose-500/5 hover:from-rose-500/10' },
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
                      className="mt-6 w-full py-2 bg-zinc-950 hover:bg-brand-500 border border-zinc-850 hover:border-brand-400 text-neutral-300 hover:text-white rounded-xl font-bold transition-all text-xs cursor-pointer flex items-center justify-center gap-1"
                    >
                      <span>{isRtl ? 'دخول الموديل' : 'Open Workspace'}</span>
                      {isRtl ? <ArrowLeft size={12} className="rotate-180" /> : <ArrowRight size={12} />}
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
        <GiftCardsWorkspace lang={lang} darkMode={darkMode} />
      )}

      {/* 11. GIFT CARDS */}
      {view === 'giftcards' && (
        <GiftCardsWorkspace lang={lang} darkMode={darkMode} />
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
            {mockProducts.map((prd) => (
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
            ))}
          </div>
        </div>
      )}

      {/* 15. SUBSCRIPTION */}
      {view === 'subscription' && (
        <div className={`p-6 rounded-2xl border transition-colors ${
          darkMode ? 'bg-zinc-900 border-zinc-850 text-zinc-100' : 'bg-white border-neutral-100 shadow-md'
        }`}>
          <div className="flex justify-between items-start mb-6 pb-4 border-b border-neutral-100 dark:border-zinc-800">
            <div>
              <span className="text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-widest">{isRtl ? 'تفاصيل باقة المنشأة' : 'REFAH SAAS TENANT BILLING PLAN'}</span>
              <h3 className="text-lg md:text-xl font-extrabold mt-1">{isRtl ? 'باقة صالونات بريميوم بلس السحابية' : 'REFAH Premium Plus Salon Suite'}</h3>
            </div>
            <span className="bg-brand-50 dark:bg-brand-950/30 text-brand-800 dark:text-brand-300 border border-brand-100 dark:border-brand-900 px-3 py-1 rounded-full text-xs font-bold">
              {isRtl ? 'نشط وتعمل بشكل مثالي' : 'Active & Compliant'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="space-y-3">
              <div className="flex justify-between py-1.5 border-b border-neutral-50 dark:border-zinc-800">
                <span className="font-medium text-neutral-400">{isRtl ? 'سعر الاشتراك الشهري' : 'Monthly Fee'}</span>
                <span className="font-bold font-mono">450 ر.س / شهرياً</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-neutral-50 dark:border-zinc-800">
                <span className="font-medium text-neutral-400">{isRtl ? 'الحد الأقصى لأعضاء الفريق' : 'Team Seats Allowed'}</span>
                <span className="font-bold font-mono">{isRtl ? 'غير محدود' : 'Unlimited'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-neutral-50 dark:border-zinc-800">
                <span className="font-medium text-neutral-400">{isRtl ? 'خدمات الحجز الذاتي المدمجة' : 'Self-booking link'}</span>
                <span className="font-bold text-emerald-600 font-sans">✓ {isRtl ? 'مفعل ومتاح لصالونك' : 'Active & Live'}</span>
              </div>
            </div>

            <div className="bg-brand-50/50 dark:bg-brand-950/10 p-4 rounded-xl border border-brand-100 dark:border-brand-950 flex flex-col justify-between">
              <div>
                <p className="font-bold mb-1">{isRtl ? 'الحد الائتماني المتاح لحملات التسويق' : 'Sms Campaign Monthly Balance'}</p>
                <p className="text-xs text-neutral-400">{isRtl ? 'تم استهلاك 1,420 من أصل 10,000 رسالة مجانية مخصصة شهرياً' : 'Used 1,420 out of 10,000 complimentary marketing SMS.'}</p>
              </div>
              <div className="w-full bg-neutral-200 dark:bg-zinc-800 h-2 rounded-full mt-4 overflow-hidden">
                <div className="bg-brand-600 h-full w-[14%]" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 16. BILLING */}
      {view === 'billing' && (
        <div className={`p-6 rounded-2xl border transition-colors ${
          darkMode ? 'bg-zinc-900 border-zinc-850 text-zinc-100' : 'bg-white border-neutral-100 shadow-xs'
        }`}>
          <h3 className="font-bold text-base mb-4">{isRtl ? 'سجل فواتير اشتراك منصة رفاه' : 'SaaS Subscription Invoices'}</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-100 dark:border-zinc-800 text-neutral-400 font-bold bg-neutral-50/50 dark:bg-zinc-950/20">
                  <th className="p-3 text-start">{isRtl ? 'رقم الفاتورة المعتمد' : 'Invoice Reference'}</th>
                  <th className="p-3 text-start">{isRtl ? 'فترة الفوترة' : 'Billing Cycle'}</th>
                  <th className="p-3 text-start">{isRtl ? 'تاريخ الإصدار' : 'Issued Date'}</th>
                  <th className="p-3 text-start">{isRtl ? 'المبلغ المستحق' : 'Amount'}</th>
                  <th className="p-3 text-start">{isRtl ? 'حالة الدفع' : 'Payment Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-zinc-800/30">
                {mockInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-neutral-50/50 dark:hover:bg-zinc-800/20">
                    <td className="p-3 font-mono font-bold">{inv.id}</td>
                    <td className="p-3 font-semibold">{isRtl ? inv.periodAr : inv.periodEn}</td>
                    <td className="p-3 text-neutral-400 font-mono">{inv.date}</td>
                    <td className="p-3 font-mono font-bold">{inv.amount}</td>
                    <td className="p-3"><span className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded font-bold text-[10px]">{isRtl ? inv.statusAr : inv.statusEn}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 17. SETTINGS */}
      {view === 'settings' && (
        <div className={`p-6 rounded-2xl border transition-colors ${
          darkMode ? 'bg-zinc-900 border-zinc-850 text-zinc-100' : 'bg-white border-neutral-100 shadow-xs'
        }`}>
          <h3 className="font-bold text-base mb-4">{isRtl ? 'الإعدادات العامة وتفاصيل المنشأة' : 'Salon Profile & Tax Regulations'}</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1">{isRtl ? 'الاسم التجاري للمركز (عربي)' : 'Salon Brand Name (Arabic)'}</label>
                <input type="text" className="w-full px-3 py-2 border border-neutral-200 dark:border-zinc-800 rounded-xl bg-transparent focus:ring-1 focus:ring-brand-500 focus:outline-none" defaultValue="سبا لا كولين الفاخر" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1">{isRtl ? 'الاسم التجاري للمركز (إنجليزي)' : 'Salon Brand Name (English)'}</label>
                <input type="text" className="w-full px-3 py-2 border border-neutral-200 dark:border-zinc-800 rounded-xl text-start bg-transparent focus:ring-1 focus:ring-brand-500 focus:outline-none" defaultValue="La Colline Luxury Spa" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1">{isRtl ? 'رقم التسجيل الضريبي السعودي (شاملاً VAT 15%)' : 'Saudi VAT Tax Registration Number'}</label>
                <input type="text" className="w-full px-3 py-2 border border-neutral-200 dark:border-zinc-800 rounded-xl text-start font-mono bg-transparent focus:ring-1 focus:ring-brand-500 focus:outline-none" defaultValue="310029301900003" />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1">{isRtl ? 'العنوان الجغرافي والفرع الرئيسي' : 'Salon Geographic Location'}</label>
                <input type="text" className="w-full px-3 py-2 border border-neutral-200 dark:border-zinc-800 rounded-xl bg-transparent focus:ring-1 focus:ring-brand-500 focus:outline-none" defaultValue="شارع العليا العام، الرياض" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1">{isRtl ? 'توقيتات العمل اليومي' : 'Daily Opening Hours'}</label>
                <input type="text" className="w-full px-3 py-2 border border-neutral-200 dark:border-zinc-800 rounded-xl bg-transparent focus:ring-1 focus:ring-brand-500 focus:outline-none" defaultValue="١٠:٠٠ ص - ١٠:٠٠ م (السبت - الخميس)" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1">{isRtl ? 'رسالة ترحيب الفاتورة التلقائية' : 'Receipt Greeting Text'}</label>
                <input type="text" className="w-full px-3 py-2 border border-neutral-200 dark:border-zinc-800 rounded-xl bg-transparent focus:ring-1 focus:ring-brand-500 focus:outline-none" defaultValue="شكراً لزيارتك لسبا لا كولين. يسعدنا دائماً تقديم الرفاهية الكاملة لك." />
              </div>
            </div>
          </div>
        </div>
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
