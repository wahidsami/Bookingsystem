import React, { useState, useEffect, useRef } from 'react';
import { 
  Tag, Sparkles, Plus, AlertCircle, RefreshCw, Trash2, Calendar, 
  Percent, X, Pause, Play, Check, Upload, Image as ImageIcon, 
  ArrowLeft, Clock, ArrowRight, Lock, CheckCircle 
} from 'lucide-react';
import { tenantApiAdapter } from '../lib/tenantApiAdapter';

interface HotDealsWorkspaceProps {
  lang: 'ar' | 'en';
  darkMode?: boolean;
}

// Interfaces matching backend and requirement
interface HotDeal {
  id: string;
  serviceId: string;
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  discountType: 'percentage' | 'fixed_amount';
  discountValue: number;
  validFrom: string;
  validUntil: string;
  maxRedemptions: number;
  redemptionCount: number;
  status: 'active' | 'paused' | 'scheduled' | 'expired' | 'rejected';
  rejectionReason: string | null;
  image: string;
  createdAt: string;
}

interface PackageLimits {
  maxHotDeals: number;
  currentHotDeals: number;
  remaining: number;
  totalCreated: number;
}

// Gorgeous preset high-res spa images
const IMAGE_PRESETS = [
  {
    name: "Swedish Massage Therapy",
    url: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=800&auto=format&fit=crop"
  },
  {
    name: "Hydrafacial Skin Care",
    url: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?q=80&w=800&auto=format&fit=crop"
  },
  {
    name: "Luxury Nails & Spa",
    url: "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?q=80&w=800&auto=format&fit=crop"
  },
  {
    name: "Keratin Hair Care",
    url: "https://images.unsplash.com/photo-1562322140-8baeececf3df?q=80&w=800&auto=format&fit=crop"
  },
  {
    name: "Bridal Cosmetics & Makeup",
    url: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=800&auto=format&fit=crop"
  }
];

export default function HotDealsWorkspace({ lang, darkMode = false }: HotDealsWorkspaceProps) {
  const isRtl = lang === 'ar';

  // Sub-routing states: 'list' | 'new' | 'edit'
  const [subView, setSubView] = useState<'list' | 'new' | 'edit'>('list');
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  // Data states from API
  const [deals, setDeals] = useState<HotDeal[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [limits, setLimits] = useState<PackageLimits | null>(null);
  
  // Statuses
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter and Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Interactive self-contained notification system
  const [notifications, setNotifications] = useState<{ id: string; textAr: string; textEn: string; type: 'success' | 'error' }[]>([]);

  // 1. FORM STATES FOR CREATE/EDIT
  const [image, setImage] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [descEn, setDescEn] = useState('');
  const [descAr, setDescAr] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed_amount'>('percentage');
  const [discountValue, setDiscountValue] = useState<number | ''>('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState<number | ''>(100);

  // File Upload Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ----------------------------------------------------
  // ROUTE SYNCHRONIZATION WITH BROWSER ADRESS BAR PATH
  // ----------------------------------------------------
  useEffect(() => {
    const syncRouteWithUrl = () => {
      const path = window.location.pathname;
      if (path === '/dashboard/hot-deals/new') {
        setSubView('new');
        setSelectedDealId(null);
        resetFormFields();
      } else if (path.startsWith('/dashboard/hot-deals/')) {
        const id = path.replace('/dashboard/hot-deals/', '');
        if (id && id !== 'new') {
          setSubView('edit');
          setSelectedDealId(id);
        } else {
          setSubView('list');
          setSelectedDealId(null);
        }
      } else {
        setSubView('list');
        setSelectedDealId(null);
      }
    };

    syncRouteWithUrl();
    window.addEventListener('popstate', syncRouteWithUrl);
    return () => window.removeEventListener('popstate', syncRouteWithUrl);
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // ----------------------------------------------------
  // DATA FETCHING (GET LIMITS & GET DEALS)
  // ----------------------------------------------------
  const fetchLimitsAndDeals = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [dealsRes, limitsRes, servicesData] = await Promise.all([
        tenantApiAdapter.get('/tenant/hot-deals'),
        tenantApiAdapter.get('/tenant/hot-deals/limits'),
        tenantApiAdapter.getServices()
      ]);

      setServices(servicesData?.services || []);

      setDeals(Array.isArray(dealsRes?.deals) ? dealsRes.deals : Array.isArray(dealsRes) ? dealsRes : []);
      setLimits(limitsRes?.limits || limitsRes || null);
    } catch (err: any) {
      console.error(err);
      setError(isRtl 
        ? "فشل في مزامنة البيانات مع خادم التشغيل السحابي. يرجى التحقق من اتصال الشبكة وإعادة المحاولة." 
        : "Failed to sync data with the cloud runtime server. Please check your network and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLimitsAndDeals();
  }, []);

  // Fetch deal details when selectedDealId changes (for Edit mode)
  useEffect(() => {
    if (subView === 'edit' && selectedDealId) {
      const loadDealToForm = async () => {
      try {
        setLoading(true);
          const res = await tenantApiAdapter.get(`/tenant/hot-deals/${selectedDealId}`);
          const deal: HotDeal = res?.deal || res?.data || res;
          
          setImage(deal.image);
          setServiceId(deal.serviceId);
          setTitleEn(deal.title_en);
          setTitleAr(deal.title_ar);
          setDescEn(deal.description_en || '');
          setDescAr(deal.description_ar || '');
          setDiscountType(deal.discountType);
          setDiscountValue(deal.discountValue);
          setValidFrom(deal.validFrom);
          setValidUntil(deal.validUntil);
          setMaxRedemptions(deal.maxRedemptions);
        } catch (err: any) {
          triggerNotification(
            "فشل في استرداد بيانات العرض المختار.",
            "Failed to fetch selected promo deal data.",
            "error"
          );
          navigateTo('/dashboard/hot-deals');
        } finally {
          setLoading(false);
        }
      };
      loadDealToForm();
    }
  }, [selectedDealId, subView]);

  // ----------------------------------------------------
  // FORM FIELD UTILITIES
  // ----------------------------------------------------
  const resetFormFields = () => {
    setImage('');
    setServiceId('');
    setTitleEn('');
    setTitleAr('');
    setDescEn('');
    setDescAr('');
    setDiscountType('percentage');
    setDiscountValue('');
    setValidFrom(new Date().toISOString().split('T')[0]);
    setValidUntil('');
    setMaxRedemptions(100);
  };

  const triggerNotification = (ar: string, en: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications(prev => [...prev, { id, textAr: ar, textEn: en, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4500);
  };

  // Drag and drop or browse handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        triggerNotification(
          "تم تحميل وقراءة صورتك المخصصة بنجاح!",
          "Custom image uploaded and loaded successfully!",
          "success"
        );
      };
      reader.readAsDataURL(file);
    }
  };

  // ----------------------------------------------------
  // ACTION HANDLERS (PAUSE, RESUME, DELETE, CREATE/EDIT SUBMIT)
  // ----------------------------------------------------
  const handlePauseDeal = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/v1/tenant/hot-deals/${id}/pause`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error("Pause failed");
      
      const updatedDeal = await res.json();
      setDeals(prev => prev.map(d => d.id === id ? updatedDeal : d));
      triggerNotification(
        "تم إيقاف العرض الساخن مؤقتاً بنجاح ⏸️",
        "Hot deal paused successfully ⏸️",
        "success"
      );
      // Refresh limits
      const limRes = await fetch('/api/v1/tenant/hot-deals/limits');
      if (limRes.ok) setLimits(await limRes.json());
    } catch (err) {
      triggerNotification(
        "فشل إيقاف العرض مؤقتاً.",
        "Failed to pause promotional deal.",
        "error"
      );
    }
  };

  const handleResumeDeal = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/v1/tenant/hot-deals/${id}/resume`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error("Resume failed");
      
      const updatedDeal = await res.json();
      setDeals(prev => prev.map(d => d.id === id ? updatedDeal : d));
      triggerNotification(
        "تم استئناف وتفعيل العرض الساخن بنجاح! ⚡",
        "Hot deal resumed and activated successfully! ⚡",
        "success"
      );
      // Refresh limits
      const limRes = await fetch('/api/v1/tenant/hot-deals/limits');
      if (limRes.ok) setLimits(await limRes.json());
    } catch (err) {
      triggerNotification(
        "فشل تفعيل العرض.",
        "Failed to resume promotional deal.",
        "error"
      );
    }
  };

  const handleDeleteDeal = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(isRtl ? "هل أنت متأكد من رغبتك في حذف هذا العرض الساخن نهائياً؟" : "Are you absolutely sure you want to delete this hot deal permanently?")) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/tenant/hot-deals/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error("Delete failed");
      
      setDeals(prev => prev.filter(d => d.id !== id));
      triggerNotification(
        "تم حذف العرض الساخن نهائياً.",
        "Hot deal deleted permanently.",
        "success"
      );
      // Refresh limits
      const limRes = await fetch('/api/v1/tenant/hot-deals/limits');
      if (limRes.ok) setLimits(await limRes.json());
    } catch (err) {
      triggerNotification(
        "فشل حذف العرض الترويجي.",
        "Failed to delete promotional deal.",
        "error"
      );
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ------------------
    // VALIDATIONS
    // ------------------
    if (!serviceId) {
      triggerNotification(
        "يرجى تحديد الخدمة المطلوبة للعرض أولاً.",
        "Please select a target service for the deal.",
        "error"
      );
      return;
    }

    if (subView === 'new' && !image) {
      triggerNotification(
        "صورة العرض مطلوبة لعملية الإنشاء.",
        "Deal image is required on creation.",
        "error"
      );
      return;
    }

    if (!validFrom || !validUntil) {
      triggerNotification(
        "يرجى تحديد تواريخ صلاحية العرض كاملة.",
        "Please specify both start and end validity dates.",
        "error"
      );
      return;
    }

    if (new Date(validUntil) <= new Date(validFrom)) {
      triggerNotification(
        "تاريخ الانتهاء يجب أن يكون لاحقاً لتاريخ البدء.",
        "Validity end date must be strictly after valid from date.",
        "error"
      );
      return;
    }

    if (!discountValue || Number(discountValue) <= 0) {
      triggerNotification(
        "قيمة الخصم يجب أن تكون أكبر من الصفر.",
        "Discount value must be greater than zero.",
        "error"
      );
      return;
    }

    // Additional commercial guard: percent cannot exceed 100
    if (discountType === 'percentage' && Number(discountValue) > 100) {
      triggerNotification(
        "معدل نسبة الخصم لا يمكن أن يتجاوز ١٠٠٪.",
        "Discount percentage rate cannot exceed 100%.",
        "error"
      );
      return;
    }

    // Additional guard: fixed value cannot exceed original price
    const selectedSrv = services.find(s => s.id === serviceId);
    if (selectedSrv && discountType === 'fixed_amount' && Number(discountValue) >= selectedSrv.price) {
      triggerNotification(
        `قيمة الخصم الثابت لا يمكن أن تعادل أو تزيد عن السعر الأصلي للخدمة (${selectedSrv.price} ر.س).`,
        `Fixed discount cannot equal or exceed the service original price (${selectedSrv.price} SAR).`,
        "error"
      );
      return;
    }

    try {
      setSaving(true);
      const payload = {
        serviceId,
        title_en: titleEn,
        title_ar: titleAr,
        description_en: descEn,
        description_ar: descAr,
        discountType,
        discountValue: Number(discountValue),
        validFrom,
        validUntil,
        maxRedemptions: Number(maxRedemptions) || 100,
        image
      };

      const url = subView === 'new' ? '/api/v1/tenant/hot-deals' : `/api/v1/tenant/hot-deals/${selectedDealId}`;
      const method = subView === 'new' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "API transaction failed");
      }

      const savedDeal = await res.json();

      triggerNotification(
        subView === 'new' ? "تم إطلاق العرض الساخن الجديد بنجاح! 🎉" : "تم تحديث وحفظ بيانات العرض الترويجي بنجاح! 💾",
        subView === 'new' ? "New premium hot deal launched successfully! 🎉" : "Promotional deal updated and saved successfully! 💾",
        "success"
      );

      // Reload lists & counters
      await fetchLimitsAndDeals();
      
      // Navigate back
      navigateTo('/dashboard/hot-deals');
    } catch (err: any) {
      triggerNotification(
        err.message || "حدث خطأ غير متوقع أثناء المعالجة.",
        err.message || "An unexpected error occurred during processing.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  // ----------------------------------------------------
  // COMPUTATIONAL / MATH RENDERING HELPERS
  // ----------------------------------------------------
  const getSelectedServiceDetails = () => {
    return services.find(s => s.id === serviceId);
  };

  const calculateDiscountedPrice = () => {
    const srv = getSelectedServiceDetails();
    if (!srv || discountValue === '') return null;
    
    const originalPrice = srv.price;
    const value = Number(discountValue);

    if (discountType === 'percentage') {
      const discount = (originalPrice * value) / 100;
      return {
        discounted: Math.max(0, originalPrice - discount),
        saved: discount
      };
    } else {
      return {
        discounted: Math.max(0, originalPrice - value),
        saved: Math.min(originalPrice, value)
      };
    }
  };

  // ----------------------------------------------------
  // RENDER FILTERED GRID LIST
  // ----------------------------------------------------
  const getFilteredDeals = () => {
    return deals.filter(deal => {
      // 1. Search Query Match (Title Ar/En or Promo code or Service name)
      const serviceObj = services.find(s => s.id === deal.serviceId);
      const srvNameAr = serviceObj?.nameAr || '';
      const srvNameEn = serviceObj?.nameEn || '';
      const q = searchQuery.toLowerCase().trim();

      const matchesSearch = 
        !q ||
        deal.title_ar.toLowerCase().includes(q) ||
        deal.title_en.toLowerCase().includes(q) ||
        (deal.description_ar && deal.description_ar.toLowerCase().includes(q)) ||
        (deal.description_en && deal.description_en.toLowerCase().includes(q)) ||
        srvNameAr.toLowerCase().includes(q) ||
        srvNameEn.toLowerCase().includes(q);

      // 2. Status Filter Match
      const matchesStatus = statusFilter === 'all' || deal.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  };

  const filteredDeals = getFilteredDeals();

  return (
    <div className="space-y-6 relative">
      
      {/* Floating notifications portal */}
      <div className={`fixed bottom-6 ${isRtl ? 'left-6' : 'right-6'} z-50 flex flex-col gap-3.5 max-w-sm w-full`}>
        {notifications.map((notif) => (
          <div
            key={notif.id}
            className={`shadow-xl p-4 rounded-xl border flex items-start gap-3 text-start relative overflow-hidden transition-all duration-300 animate-slide-in ${
              darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-100'
            }`}
          >
            <div className={`absolute top-0 bottom-0 w-1 ${isRtl ? 'right-0' : 'left-0'} ${notif.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${notif.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
              {notif.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            </span>
            <div className="flex-1 min-w-0 pr-2">
              <p className="text-xs md:text-sm font-semibold leading-relaxed">
                {isRtl ? notif.textAr : notif.textEn}
              </p>
            </div>
          </div>
        ))}
      </div>

      {loading && subView === 'list' ? (
        /* LOADING SKELETON GRID */
        <div className="space-y-6">
          <div className="h-28 bg-zinc-800/20 dark:bg-zinc-900/40 rounded-2xl animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="border border-zinc-200 dark:border-zinc-850 p-6 rounded-2xl animate-pulse space-y-4">
                <div className="h-44 bg-zinc-800/20 dark:bg-zinc-900/40 rounded-xl" />
                <div className="h-4 bg-zinc-800/20 dark:bg-zinc-900/40 rounded w-3/4" />
                <div className="h-3 bg-zinc-800/20 dark:bg-zinc-900/40 rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        /* ERROR VIEW */
        <div className={`p-10 rounded-2xl border text-center max-w-xl mx-auto space-y-4 ${
          darkMode ? 'bg-zinc-900 border-rose-950/40' : 'bg-rose-50/50 border-rose-100'
        }`}>
          <div className="p-3.5 bg-rose-500/10 text-rose-500 rounded-full w-fit mx-auto">
            <AlertCircle size={38} />
          </div>
          <h3 className="font-extrabold text-base md:text-lg">{isRtl ? 'عذرًا، تعذر تحميل العروض' : 'Unable to Retrieve Hot Deals'}</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">{error}</p>
          <button
            onClick={fetchLimitsAndDeals}
            className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-2 mx-auto cursor-pointer"
          >
            <RefreshCw size={13} />
            {isRtl ? 'إعادة تشغيل الاتصال' : 'Retry Synchronization'}
          </button>
        </div>
      ) : subView === 'list' ? (
        /* ==================================================== */
        /* LIST PAGE VIEW                                       */
        /* ==================================================== */
        <div className="space-y-6 animate-fade-in" id="hot-deals-list-view">
          
          {/* Header Action Row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="text-amber-500" size={20} />
                <h1 className="text-lg md:text-xl font-extrabold tracking-tight">
                  {isRtl ? 'العروض الترويجية والخصومات الساخنة' : 'Hot Real-Time Promotional Deals'}
                </h1>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                {isRtl ? 'أطلقي عروضاً فورية ومؤقتة تظهر مباشرة لتعبئة فترات الحجز الخالية وزيادة الإشغال.' : 'Launch fast-acting, time-sensitive deals visible in client apps to instantly fill empty schedules.'}
              </p>
            </div>
            
            <button
              onClick={() => navigateTo('/dashboard/hot-deals/new')}
              className="px-4.5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-brand-500/10 self-start"
              id="btn-create-hot-deal"
            >
              <Plus size={15} />
              {isRtl ? 'إنشاء عرض ساخن جديد' : 'Create New Hot Deal'}
            </button>
          </div>

          {/* PACKAGE LIMITS INFO CARD */}
          {limits && (
            <div className={`p-5 rounded-2xl border overflow-hidden relative transition-all duration-300 ${
              darkMode 
                ? 'bg-zinc-900/60 border-zinc-800 text-zinc-100 shadow-inner' 
                : 'bg-white border-slate-100 text-slate-800 shadow-sm shadow-slate-100/40'
            }`} id="package-limits-card">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="p-3 bg-brand-500/10 text-brand-500 rounded-xl">
                    <Lock size={20} />
                  </div>
                  <div>
                    <h3 className="text-xs md:text-sm font-black tracking-tight flex items-center gap-2">
                      {isRtl ? 'مستوى حزمة العروض الساخنة للمنشأة' : 'Tenant Promo Campaign Workspace Limit'}
                      <span className="px-2 py-0.5 bg-brand-500/10 text-brand-500 text-[9px] rounded-full font-black font-mono">
                        Enterprise SaaS
                      </span>
                    </h3>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      {isRtl 
                        ? `الحد الأقصى للعروض النشطة/المجدولة في نفس الوقت هو ${limits.maxHotDeals} عروض. متاح لك إنشاء عروض إضافية وتفعيلها.` 
                        : `Your active quota allows up to ${limits.maxHotDeals} concurrent active/scheduled campaigns. Expand on demand.`}
                    </p>
                  </div>
                </div>

                {/* Progress bar info */}
                <div className="w-full md:w-60 space-y-1.5 shrink-0">
                  <div className="flex justify-between text-xs font-bold font-mono">
                    <span className="text-zinc-400">{isRtl ? 'المستهلك:' : 'Quota Usage:'}</span>
                    <span>{limits.currentHotDeals} / {limits.maxHotDeals}</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-brand-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (limits.currentHotDeals / limits.maxHotDeals) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-zinc-500 text-end font-mono">
                    {isRtl ? `${limits.remaining} عروض شاغرة متبقية` : `${limits.remaining} vacant deal slots remaining`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Filtering & Search HUD */}
          <div className={`p-4 rounded-xl border flex flex-col sm:flex-row gap-4 items-center justify-between ${
            darkMode ? 'bg-zinc-900/40 border-zinc-800/80' : 'bg-white border-slate-100 shadow-xs'
          }`}>
            {/* Search Input */}
            <div className="relative w-full sm:max-w-xs">
              <input
                type="text"
                placeholder={isRtl ? "البحث باسم العرض، الخدمة..." : "Search by title, service..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-9 pr-4 py-2 text-xs rounded-lg border outline-hidden transition-all focus:ring-1 focus:ring-brand-500 ${
                  darkMode ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-slate-50 border-slate-200'
                }`}
              />
              <span className={`absolute top-2.5 ${isRtl ? 'left-3' : 'left-3'} text-zinc-400`}>
                <Clock size={14} className="animate-pulse" />
              </span>
            </div>

            {/* Status Tabs Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {[
                { id: 'all', ar: 'الكل', en: 'All' },
                { id: 'active', ar: 'نشط', en: 'Active' },
                { id: 'paused', ar: 'موقوف', en: 'Paused' },
                { id: 'scheduled', ar: 'مجدول', en: 'Scheduled' },
                { id: 'expired', ar: 'منتهي', en: 'Expired' },
                { id: 'rejected', ar: 'مرفوض', en: 'Rejected' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-brand-500 text-white shadow-xs shadow-brand-500/25'
                      : darkMode
                      ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-750 hover:text-zinc-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {isRtl ? tab.ar : tab.en}
                </button>
              ))}
            </div>
          </div>

          {/* DEAL CARDS GRID */}
          {filteredDeals.length === 0 ? (
            /* EMPTY FILTER RESULT */
            <div className={`p-16 rounded-2xl border text-center max-w-md mx-auto space-y-4 ${
              darkMode ? 'bg-zinc-900 border-zinc-850' : 'bg-white border-neutral-100 shadow-xs'
            }`}>
              <div className="p-4 bg-brand-500/10 text-brand-500 rounded-full w-fit mx-auto">
                <Tag size={40} />
              </div>
              <h3 className="font-extrabold text-base">{isRtl ? 'لم نعثر على أي نتائج مطابقة' : 'No Matching Deals Found'}</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                {isRtl 
                  ? 'يرجى مراجعة معايير التصفية أو كلمة البحث المدخلة، أو إنشاء عرض جديد تماماً لتعبئة الجدول.' 
                  : 'Please check your filters or try search keywords, or launch a new promotional campaign.'}
              </p>
              <button
                onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
                className="px-4.5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                {isRtl ? 'إعادة تعيين الفلاتر' : 'Reset All Filters'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="hot-deals-grid">
              {filteredDeals.map((deal) => {
                const srv = services.find(s => s.id === deal.serviceId);
                const srvName = srv ? (isRtl ? srv.nameAr : srv.nameEn) : (isRtl ? "خدمة غير معروفة" : "Unknown Service");
                const originalPrice = srv ? srv.price : 0;
                
                // Live calculation of discount
                let discountedPrice = originalPrice;
                let discountText = '';
                if (deal.discountType === 'percentage') {
                  discountedPrice = originalPrice - (originalPrice * deal.discountValue) / 100;
                  discountText = `${deal.discountValue}%`;
                } else {
                  discountedPrice = Math.max(0, originalPrice - deal.discountValue);
                  discountText = isRtl ? `${deal.discountValue} ر.س` : `${deal.discountValue} SAR`;
                }

                return (
                  <div
                    key={deal.id}
                    onClick={() => navigateTo(`/dashboard/hot-deals/${deal.id}`)}
                    className={`border rounded-2xl flex flex-col justify-between overflow-hidden transition-all duration-300 group hover:-translate-y-1 hover:shadow-xl cursor-pointer ${
                      darkMode 
                        ? 'bg-zinc-900 border-zinc-850 hover:border-brand-500/60 text-zinc-100' 
                        : 'bg-white border-neutral-100 hover:border-brand-200/80 shadow-xs'
                    }`}
                  >
                    {/* Visual/Image Header */}
                    <div className="relative h-44 w-full bg-zinc-800 overflow-hidden">
                      <img 
                        src={deal.image || "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=800&auto=format&fit=crop"} 
                        alt={isRtl ? deal.title_ar : deal.title_en}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                      />
                      
                      {/* Dark overlay gradients */}
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent" />

                      {/* Floating Discount Badge */}
                      <span className="absolute top-3 right-3 bg-brand-500 text-white font-black px-3 py-1 rounded-xl text-xs shadow-md tracking-tight font-sans">
                        {discountText} {isRtl ? 'خصم' : 'OFF'}
                      </span>

                      {/* Status Floating Badge */}
                      <span className={`absolute top-3 left-3 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full shadow-sm ${
                        deal.status === 'active'
                          ? 'bg-emerald-500/90 text-white'
                          : deal.status === 'scheduled'
                          ? 'bg-amber-500/90 text-white'
                          : deal.status === 'paused'
                          ? 'bg-slate-500/90 text-white'
                          : deal.status === 'expired'
                          ? 'bg-neutral-600/90 text-white'
                          : 'bg-rose-600/90 text-white'
                      }`}>
                        {deal.status === 'active' && (isRtl ? 'نشط الآن' : 'Active')}
                        {deal.status === 'scheduled' && (isRtl ? 'مجدول' : 'Scheduled')}
                        {deal.status === 'paused' && (isRtl ? 'موقوف مؤقتاً' : 'Paused')}
                        {deal.status === 'expired' && (isRtl ? 'منتهي الصلاحية' : 'Expired')}
                        {deal.status === 'rejected' && (isRtl ? 'مرفوض إدارياً' : 'Rejected')}
                      </span>

                      {/* Service Category pill on image bottom */}
                      <span className="absolute bottom-3 left-3 text-[10px] bg-black/40 text-neutral-200 px-2.5 py-0.5 rounded-full backdrop-blur-xs">
                        {srv ? (isRtl ? srv.categoryAr : srv.categoryEn) : ''}
                      </span>
                    </div>

                    {/* Deal Details Container */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      
                      {/* Service + Title block */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-black tracking-widest text-brand-500 uppercase">
                          {srvName}
                        </span>
                        <h3 className="font-extrabold text-sm md:text-base leading-snug group-hover:text-brand-400 transition-colors">
                          {isRtl ? deal.title_ar : deal.title_en}
                        </h3>
                        <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                          {isRtl ? deal.description_ar : deal.description_en}
                        </p>
                      </div>

                      {/* COMMERCIAL PRICING BOX */}
                      <div className={`p-3 rounded-xl flex items-center justify-between border ${
                        darkMode ? 'bg-zinc-950/50 border-zinc-800' : 'bg-slate-50/60 border-slate-150'
                      }`}>
                        <div>
                          <span className="text-[10px] text-zinc-400 block leading-none">{isRtl ? 'السعر الأصلي:' : 'Original Price:'}</span>
                          <span className="text-xs font-bold text-zinc-500 line-through font-mono mt-1 block">
                            {originalPrice} {isRtl ? 'ر.س' : 'SAR'}
                          </span>
                        </div>
                        
                        <div className="text-end">
                          <span className="text-[10px] text-brand-500 block leading-none font-bold">{isRtl ? 'السعر الساخن الجديد:' : 'Special Hot Price:'}</span>
                          <span className="text-sm font-black text-emerald-500 font-mono mt-1 block">
                            {discountedPrice.toFixed(1)} {isRtl ? 'ر.س' : 'SAR'}
                          </span>
                        </div>
                      </div>

                      {/* REJECTION REASON ALERT IF REJECTED */}
                      {deal.status === 'rejected' && deal.rejectionReason && (
                        <div className="p-3 bg-rose-500/5 border border-rose-500/20 text-rose-500 rounded-xl space-y-1">
                          <span className="text-[10px] font-black tracking-wider uppercase block">{isRtl ? 'سبب الرفض الإداري:' : 'Administrative Rejection Reason:'}</span>
                          <p className="text-[10px] font-sans leading-relaxed text-rose-400 dark:text-rose-300">
                            {deal.rejectionReason}
                          </p>
                        </div>
                      )}

                      {/* STATS: EXPIRY + REDEMPTIONS */}
                      <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex justify-between items-center text-[10px] font-mono text-zinc-400">
                        <span className="flex items-center gap-1">
                          <Calendar size={11} className="text-zinc-500" />
                          <span>{deal.validFrom} {isRtl ? 'إلى' : 'to'} {deal.validUntil}</span>
                        </span>
                        
                        <span className="font-bold text-zinc-300">
                          {isRtl ? 'المحجوز:' : 'Booked:'} <strong className="text-brand-500 font-black">{deal.redemptionCount}</strong> / {deal.maxRedemptions}
                        </span>
                      </div>
                    </div>

                    {/* CARD HOVER INTERACTIONS BAR */}
                    <div className={`px-5 py-3 border-t flex justify-between items-center text-xs font-bold ${
                      darkMode ? 'bg-zinc-950/40 border-zinc-850' : 'bg-neutral-50/50 border-neutral-100'
                    }`}>
                      <span className="text-brand-500 text-[10px] font-bold underline group-hover:text-brand-600">
                        {isRtl ? 'عرض وتعديل التفاصيل ←' : 'View & Edit Details ←'}
                      </span>

                      <div className="flex items-center gap-2">
                        {deal.status === 'active' ? (
                          <button
                            onClick={(e) => handlePauseDeal(deal.id, e)}
                            className="p-1.5 bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 hover:text-slate-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer text-[10px]"
                            title={isRtl ? 'إيقاف مؤقت' : 'Pause Promotion'}
                          >
                            <Pause size={12} />
                            {isRtl ? 'إيقاف' : 'Pause'}
                          </button>
                        ) : (deal.status === 'paused' || deal.status === 'rejected') ? (
                          <button
                            onClick={(e) => handleResumeDeal(deal.id, e)}
                            className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-lg transition-colors flex items-center gap-1 cursor-pointer text-[10px]"
                            title={isRtl ? 'تفعيل العرض' : 'Activate Promotion'}
                          >
                            <Play size={12} />
                            {isRtl ? 'تفعيل' : 'Resume'}
                          </button>
                        ) : null}

                        <button
                          onClick={(e) => handleDeleteDeal(deal.id, e)}
                          className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-lg transition-colors flex items-center gap-1 cursor-pointer text-[10px]"
                          title={isRtl ? 'حذف نهائي' : 'Delete Campaign'}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      ) : (
        /* ==================================================== */
        /* CREATE / EDIT PAGE VIEW                              */
        /* ==================================================== */
        <div className="space-y-6 max-w-4xl mx-auto animate-fade-in" id="hot-deals-form-view">
          
          {/* Top Back Action navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigateTo('/dashboard/hot-deals')}
              className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                darkMode 
                  ? 'border-zinc-800 text-zinc-300 hover:bg-zinc-900 bg-zinc-900/40' 
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 bg-white shadow-xs'
              }`}
            >
              {isRtl ? <ArrowRight size={14} /> : <ArrowLeft size={14} />}
              {isRtl ? 'الرجوع للقائمة الرئيسية' : 'Back to Hot Deals list'}
            </button>

            <h2 className="text-sm font-black text-brand-500 font-mono tracking-wider">
              {subView === 'new' 
                ? (isRtl ? 'حملة ترويجية جديدة' : 'New Promo Campaign') 
                : (isRtl ? 'تعديل بيانات العرض' : 'Modify Deal Parameters')}
            </h2>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-6">
            
            {/* Form Header Info Banner */}
            <div className={`p-5 rounded-2xl border ${
              darkMode ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-slate-100 shadow-xs'
            }`}>
              <h1 className="text-base md:text-lg font-extrabold flex items-center gap-2">
                <Tag className="text-brand-500" size={18} />
                {subView === 'new' 
                  ? (isRtl ? 'إطلاق عرض ساخن جديد لزيادة الإشغال' : 'Launch New High-Occupancy Deal') 
                  : (isRtl ? 'تفاصيل وتعديل العرض الساخن' : 'Modify Existing Campaign Parameters')}
              </h1>
              <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                {isRtl 
                  ? 'يرجى استكمال الحقول المطلوبة لضمان حجز متوازن للعملاء. ستخضع التحديثات لتقييم السياسة السعرية مباشرة.' 
                  : 'Complete all sections below to broadcast this deal. Real-time discount limits are calculated instantly.'}
              </p>
            </div>

            {/* SECTION 1: IMAGE UPLOAD / PRESETS */}
            <div className={`p-6 rounded-2xl border space-y-4 ${
              darkMode ? 'bg-zinc-900 border-zinc-800/80' : 'bg-white border-slate-100'
            }`} id="form-section-image">
              <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                <span className="w-5 h-5 rounded-full bg-brand-500/10 text-brand-500 flex items-center justify-center font-mono text-[10px] font-black">
                  1
                </span>
                <h3 className="text-xs md:text-sm font-extrabold tracking-tight">
                  {isRtl ? 'صورة العرض الترويجي الجاذبة' : 'Attractive Promotional Display Image'}
                </h3>
                <span className="text-[10px] text-rose-500 font-black font-sans shrink-0">
                  {subView === 'new' ? (isRtl ? '*مطلوبة' : '*Required') : ''}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Drag and Drop Box & File preview */}
                <div className="md:col-span-5 space-y-3">
                  <label className="text-[11px] font-bold text-zinc-400 block">
                    {isRtl ? 'تحميل صورة مخصصة بالملفات:' : 'Upload custom salon asset file:'}
                  </label>
                  
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`h-40 rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-all duration-200 ${
                      image 
                        ? 'border-brand-500/50 bg-brand-500/5' 
                        : darkMode 
                        ? 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/40' 
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50'
                    }`}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*"
                      className="hidden"
                    />

                    {image ? (
                      <div className="relative w-full h-full">
                        <img 
                          src={image} 
                          alt="Custom upload" 
                          className="w-full h-full object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setImage(''); }}
                          className="absolute -top-2 -right-2 p-1 bg-rose-500 text-white rounded-full hover:bg-rose-600 shadow-lg"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="p-2.5 bg-zinc-500/5 text-zinc-400 rounded-lg w-fit mx-auto">
                          <Upload size={22} className="mx-auto" />
                        </div>
                        <p className="text-[11px] font-bold">
                          {isRtl ? 'اضغط للتصفح أو اسحب الصورة هنا' : 'Click to browse or drop asset file here'}
                        </p>
                        <p className="text-[9px] text-zinc-500">
                          Supports JPG, PNG or WEBP (Max 5MB)
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Preset professional library */}
                <div className="md:col-span-7 space-y-3">
                  <label className="text-[11px] font-bold text-zinc-400 block">
                    {isRtl ? 'أو اختار من مكتبة صالون رفاه الجاهزة للخدمات الاسترخائية الفاخرة:' : 'Or pick from REFAH professional stock assets library:'}
                  </label>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {IMAGE_PRESETS.map((p, idx) => {
                      const isSelected = image === p.url;
                      return (
                        <div
                          key={idx}
                          onClick={() => setImage(p.url)}
                          className={`group h-24 rounded-xl overflow-hidden relative cursor-pointer border transition-all duration-300 ${
                            isSelected 
                              ? 'ring-2 ring-brand-500 border-transparent scale-98' 
                              : darkMode 
                              ? 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-700' 
                              : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                          }`}
                        >
                          <img 
                            src={p.url} 
                            alt={p.name} 
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/40 flex items-end p-1.5">
                            <span className="text-[9px] font-bold text-white leading-tight line-clamp-1">
                              {p.name}
                            </span>
                          </div>
                          {isSelected && (
                            <div className="absolute top-1 right-1 p-0.5 bg-brand-500 text-white rounded-full">
                              <Check size={8} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>

            {/* SECTION 2: SERVICE SELECTION */}
            <div className={`p-6 rounded-2xl border space-y-4 ${
              darkMode ? 'bg-zinc-900 border-zinc-800/80' : 'bg-white border-slate-100'
            }`} id="form-section-service">
              <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                <span className="w-5 h-5 rounded-full bg-brand-500/10 text-brand-500 flex items-center justify-center font-mono text-[10px] font-black">
                  2
                </span>
                <h3 className="text-xs md:text-sm font-extrabold tracking-tight">
                  {isRtl ? 'ربط وتحديد الخدمة الأساسية' : 'Primary Target Service Binding'}
                </h3>
                <span className="text-[10px] text-rose-500 font-black font-sans">* {isRtl ? 'مطلوبة' : 'Required'}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                
                {/* Select dropdown */}
                <div className="md:col-span-7 space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400 block">
                    {isRtl ? 'اختر الخدمة المطروحة للعرض:' : 'Choose campaign service offering:'}
                  </label>
                  <select
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                    required
                    className={`w-full p-3 rounded-xl border text-xs font-bold outline-hidden transition-all focus:ring-1 focus:ring-brand-500 ${
                      darkMode ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <option value="">-- {isRtl ? 'اختر خدمة للبدء' : 'Select Service to bind'} --</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {isRtl ? s.nameAr : s.nameEn} ({s.price} SAR - {s.duration} mins)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected Service Preview Box */}
                <div className="md:col-span-5">
                  {serviceId ? (
                    (() => {
                      const srv = getSelectedServiceDetails();
                      if (!srv) return null;
                      return (
                        <div className={`p-4 rounded-xl border space-y-2 ${
                          darkMode ? 'bg-zinc-950/40 border-zinc-800' : 'bg-slate-50/60 border-slate-150'
                        }`}>
                          <span className="text-[9px] font-black tracking-wider uppercase text-brand-500 block">
                            {isRtl ? 'تفاصيل الخدمة النشطة:' : 'Bound Service Specifications:'}
                          </span>
                          
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold">{isRtl ? srv.nameAr : srv.nameEn}</span>
                            <span className="font-bold text-brand-500 font-mono">{srv.price} SAR</span>
                          </div>

                          <div className="flex justify-between items-center text-[10px] text-zinc-400">
                            <span>{isRtl ? 'فئة الخدمة:' : 'Category:'} {isRtl ? srv.categoryAr : srv.categoryEn}</span>
                            <span>{isRtl ? 'المدة:' : 'Duration:'} {srv.duration} {isRtl ? 'دقيقة' : 'mins'}</span>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="p-4 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-500 py-6">
                      {isRtl ? 'يرجى تحديد خدمة لتفعيل العرض ومعاينة الأسعار.' : 'Please choose a service to see catalog pricing details.'}
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* SECTION 3: DEAL INFORMATION */}
            <div className={`p-6 rounded-2xl border space-y-4 ${
              darkMode ? 'bg-zinc-900 border-zinc-800/80' : 'bg-white border-slate-100'
            }`} id="form-section-info">
              <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                <span className="w-5 h-5 rounded-full bg-brand-500/10 text-brand-500 flex items-center justify-center font-mono text-[10px] font-black">
                  3
                </span>
                <h3 className="text-xs md:text-sm font-extrabold tracking-tight">
                  {isRtl ? 'بيانات وحملة العرض الفوري' : 'Deal Description & Identity Information'}
                </h3>
              </div>

              {/* Bilingual Title inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400">
                    {isRtl ? 'عنوان العرض (بالعربية):' : 'Campaign Title (Arabic):'}
                    <span className="text-rose-500 font-black ml-1">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={isRtl ? "مثال: هروب الاسترخاء الملكي بالأروما" : "e.g. Arabic Name"}
                    value={titleAr}
                    onChange={(e) => setTitleAr(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-xs font-medium outline-hidden transition-all focus:ring-1 focus:ring-brand-500 ${
                      darkMode ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400">
                    {isRtl ? 'عنوان العرض (بالإلكترونية):' : 'Campaign Title (English):'}
                    <span className="text-rose-500 font-black ml-1">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={isRtl ? "e.g. Royal Aromatherapy Getaway" : "e.g. Royal Aromatherapy Getaway"}
                    value={titleEn}
                    onChange={(e) => setTitleEn(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-xs font-medium outline-hidden transition-all focus:ring-1 focus:ring-brand-500 ${
                      darkMode ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200'
                    }`}
                  />
                </div>
              </div>

              {/* Bilingual Description inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400">
                    {isRtl ? 'الوصف التسويقي للعميل (بالعربية):' : 'Marketing Subtitle (Arabic):'}
                  </label>
                  <textarea
                    rows={3}
                    placeholder={isRtl ? "استمتعي بجلسة مساج استثنائية لتهدئة الأعصاب وتجديد الطاقة بأسعار حصرية..." : "Arabic description"}
                    value={descAr}
                    onChange={(e) => setDescAr(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-xs font-medium outline-hidden transition-all focus:ring-1 focus:ring-brand-500 ${
                      darkMode ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400">
                    {isRtl ? 'الوصف التسويقي للعميل (بالإلكترونية):' : 'Marketing Subtitle (English):'}
                  </label>
                  <textarea
                    rows={3}
                    placeholder={isRtl ? "Experience a pure sense of relief with our custom organic aromatherapy escape..." : "English description"}
                    value={descEn}
                    onChange={(e) => setDescEn(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-xs font-medium outline-hidden transition-all focus:ring-1 focus:ring-brand-500 ${
                      darkMode ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200'
                    }`}
                  />
                </div>
              </div>

              {/* Maximum usage redemptions */}
              <div className="space-y-1.5 sm:max-w-xs">
                <label className="text-[11px] font-bold text-zinc-400">
                  {isRtl ? 'الحد الأقصى لعدد مرات الحجز المتاحة:' : 'Maximum Available Redeem Quota:'}
                  <span className="text-rose-500 font-black ml-1">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={maxRedemptions}
                  onChange={(e) => setMaxRedemptions(e.target.value === '' ? '' : Number(e.target.value))}
                  className={`w-full p-2.5 rounded-lg border text-xs font-bold font-mono outline-hidden transition-all focus:ring-1 focus:ring-brand-500 ${
                    darkMode ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200'
                  }`}
                />
                <p className="text-[10px] text-zinc-500 font-sans">
                  {isRtl ? 'سيتم إغلاق العرض تلقائياً بعد استهلاك هذه الحصة.' : 'This deal closes automatically once this allocation completes.'}
                </p>
              </div>

            </div>

            {/* SECTION 4: DISCOUNT SETTINGS */}
            <div className={`p-6 rounded-2xl border space-y-4 ${
              darkMode ? 'bg-zinc-900 border-zinc-800/80' : 'bg-white border-slate-100'
            }`} id="form-section-discount">
              <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                <span className="w-5 h-5 rounded-full bg-brand-500/10 text-brand-500 flex items-center justify-center font-mono text-[10px] font-black">
                  4
                </span>
                <h3 className="text-xs md:text-sm font-extrabold tracking-tight">
                  {isRtl ? 'خصائص وهيكلة الخصم السعري' : 'Discount Formulation & Calibration'}
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                
                {/* Discount type toggle + inputs */}
                <div className="md:col-span-6 space-y-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-zinc-400 block">
                      {isRtl ? 'نوع الخصم التجاري:' : 'Commercial discount type:'}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => { setDiscountType('percentage'); setDiscountValue(''); }}
                        className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 border ${
                          discountType === 'percentage'
                            ? 'bg-brand-500 border-transparent text-white shadow-xs'
                            : darkMode
                            ? 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-900'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <Percent size={14} />
                        {isRtl ? 'نسبة مئوية (%)' : 'Percentage (%)'}
                      </button>

                      <button
                        type="button"
                        onClick={() => { setDiscountType('fixed_amount'); setDiscountValue(''); }}
                        className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 border ${
                          discountType === 'fixed_amount'
                            ? 'bg-brand-500 border-transparent text-white shadow-xs'
                            : darkMode
                            ? 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-900'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <Tag size={14} />
                        {isRtl ? 'مبلغ ثابت (ر.س)' : 'Fixed Amount (SAR)'}
                      </button>
                    </div>
                  </div>

                  {/* Discount input field */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-400 block">
                      {discountType === 'percentage' 
                        ? (isRtl ? 'معدل نسبة الخصم مئوية:' : 'Discount Rate (%):') 
                        : (isRtl ? 'معدل الخصم الثابت بالريال السعودي:' : 'Discount Amount (SAR):')}
                      <span className="text-rose-500 font-black ml-1">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        required
                        min={1}
                        placeholder={discountType === 'percentage' ? "25" : "100"}
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value === '' ? '' : Number(e.target.value))}
                        className={`w-full p-2.5 rounded-lg border text-xs font-bold font-mono outline-hidden transition-all focus:ring-1 focus:ring-brand-500 ${
                          darkMode ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200'
                        }`}
                      />
                      <span className={`absolute top-2.5 ${isRtl ? 'left-3' : 'right-3'} text-[10px] font-black font-mono text-zinc-500`}>
                        {discountType === 'percentage' ? "%" : "SAR"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Live pricing calculator mock card */}
                <div className="md:col-span-6">
                  {serviceId && discountValue !== '' ? (
                    (() => {
                      const res = calculateDiscountedPrice();
                      const srv = getSelectedServiceDetails();
                      if (!res || !srv) return null;
                      return (
                        <div className={`p-4 rounded-xl border border-dashed text-xs space-y-3 ${
                          darkMode ? 'bg-zinc-950/20 border-brand-500/30' : 'bg-brand-500/5 border-brand-200/50'
                        }`}>
                          <h4 className="font-extrabold text-[10px] uppercase text-brand-500 tracking-wider flex items-center gap-1">
                            <Sparkles size={11} />
                            {isRtl ? 'محاكاة السعر الساخن الترويجي للعملاء:' : 'Live Promotional Pricing Simulation:'}
                          </h4>
                          
                          <div className="space-y-2 font-mono">
                            <div className="flex justify-between">
                              <span className="text-zinc-400">{isRtl ? 'السعر الأصلي للكتالوج:' : 'Original Catalog Price:'}</span>
                              <span className="font-bold">{srv.price} SAR</span>
                            </div>

                            <div className="flex justify-between text-brand-500 font-bold border-b border-zinc-100 dark:border-zinc-800 pb-2">
                              <span>{isRtl ? 'القيمة المخصومة للعميلة:' : 'Saved discount value:'}</span>
                              <span>- {res.saved.toFixed(1)} SAR</span>
                            </div>

                            <div className="flex justify-between text-emerald-500 text-sm font-black pt-1">
                              <span className="font-sans font-extrabold">{isRtl ? 'السعر النهائي الفوري للخدمة:' : 'Calculated Hot Deal Price:'}</span>
                              <span>{res.discounted.toFixed(1)} SAR</span>
                            </div>
                          </div>

                          <p className="text-[10px] text-zinc-500 leading-normal font-sans">
                            {isRtl 
                              ? 'سيعرض هذا السعر المحدث فورياً في تطبيق الجوال للعملاء، لرفع إقبال الحجوزات السريعة.' 
                              : 'This active special pricing will be directly visible to customers on mobile apps for immediate reservation.'}
                          </p>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="p-4 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-500 py-8">
                      {isRtl ? 'أدخل خدمة وقيمة للخصم لمعاينة التسعير الفوري.' : 'Specify bound service and discount value to simulate customer rates.'}
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* SECTION 5: VALIDITY PERIOD */}
            <div className={`p-6 rounded-2xl border space-y-4 ${
              darkMode ? 'bg-zinc-900 border-zinc-800/80' : 'bg-white border-slate-100'
            }`} id="form-section-validity">
              <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                <span className="w-5 h-5 rounded-full bg-brand-500/10 text-brand-500 flex items-center justify-center font-mono text-[10px] font-black">
                  5
                </span>
                <h3 className="text-xs md:text-sm font-extrabold tracking-tight">
                  {isRtl ? 'فترة الصلاحية ونطاق تفعيل الحملة' : 'Validity Term & Scheduling Boundaries'}
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* valid from */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400">
                    {isRtl ? 'تاريخ بداية صلاحية العرض:' : 'Campaign Activation Date (From):'}
                    <span className="text-rose-500 font-black ml-1">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-xs font-bold font-mono outline-hidden transition-all focus:ring-1 focus:ring-brand-500 ${
                      darkMode ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-zinc-700'
                    }`}
                  />
                </div>

                {/* valid until */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400">
                    {isRtl ? 'تاريخ انتهاء صلاحية العرض:' : 'Campaign Expiration Date (Until):'}
                    <span className="text-rose-500 font-black ml-1">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-xs font-bold font-mono outline-hidden transition-all focus:ring-1 focus:ring-brand-500 ${
                      darkMode ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-zinc-700'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* SUBMIT ACTIONS BAR */}
            <div className={`p-4 rounded-xl border flex justify-end gap-3.5 text-xs font-bold ${
              darkMode ? 'bg-zinc-950/60 border-zinc-800' : 'bg-neutral-50 border-neutral-150'
            }`}>
              <button
                type="button"
                onClick={() => navigateTo('/dashboard/hot-deals')}
                disabled={saving}
                className={`px-5 py-2.5 rounded-xl border cursor-pointer transition-all ${
                  darkMode 
                    ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800 disabled:opacity-50' 
                    : 'border-neutral-250 text-neutral-600 hover:bg-neutral-100 disabled:opacity-50'
                }`}
              >
                {isRtl ? 'إلغاء التغييرات' : 'Cancel Changes'}
              </button>

              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-2"
                id="btn-save-hot-deal"
              >
                {saving && <RefreshCw size={12} className="animate-spin" />}
                {subView === 'new' 
                  ? (isRtl ? 'إطلاق العرض الساخن للجمهور' : 'Broadcast & Launch Deal') 
                  : (isRtl ? 'حفظ وتأكيد التعديلات' : 'Commit & Save Updates')}
              </button>
            </div>

          </form>
        </div>
      )}

    </div>
  );
}
