import React, { useState, useEffect, useRef } from 'react';
import { 
  Gift, Sparkles, Plus, AlertCircle, RefreshCw, Trash2, Calendar, 
  Sparkle, ShieldAlert, Upload, X, ArrowRight, ArrowLeft, Search, Check, 
  FileSpreadsheet, ClipboardList, TrendingUp, UserCheck, Settings, 
  Eye, ToggleLeft, ToggleRight, Layers, FileDown, CheckCircle, Info, Edit3
} from 'lucide-react';
import { tenantApiAdapter } from '../lib/tenantApiAdapter';

interface GiftCardsWorkspaceProps {
  lang: 'ar' | 'en';
  darkMode?: boolean;
}

interface GiftCardPackage {
  id: string;
  title: string;
  description: string;
  displayOrder: number;
  walletCreditAmount: number;
  discountPreset: 'none' | 'percentage' | 'custom';
  customDiscountPercent: number;
  bonusAmount: number;
  expirationPreset: 'none' | '1month' | '3months' | '6months' | '1year';
  isActive: boolean;
  image: string;
}

interface RedemptionLog {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string;
  amount: number;
  appointmentId: string | null;
  redeemedAt: string;
  redeemedBy: 'admin' | 'tenant';
  status: 'success' | 'reversed';
}

interface TransactionLog {
  id: string;
  packageName: string;
  code: string;
  buyerName: string;
  recipientName: string;
  amountPaid: number;
  walletCreditAmount: number;
  bonusAmount: number;
  purchasedAt: string;
  status: 'completed' | 'refunded';
}

interface ReportsSummary {
  totalRedemptions: number;
  redeemedAmount: number;
  adminRedeemedAmount: number;
  tenantRedeemedAmount: number;
}

export default function GiftCardsWorkspace({ lang, darkMode = false }: GiftCardsWorkspaceProps) {
  const isRtl = lang === 'ar';

  // UI state
  const [activeTab, setActiveTab] = useState<'builder' | 'reports'>('builder');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [packages, setPackages] = useState<GiftCardPackage[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionLog[]>([]);
  const [transactions, setTransactions] = useState<TransactionLog[]>([]);
  const [summary, setSummary] = useState<ReportsSummary>({
    totalRedemptions: 0,
    redeemedAmount: 0,
    adminRedeemedAmount: 0,
    tenantRedeemedAmount: 0
  });

  // Builder Form States
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formDisplayOrder, setFormDisplayOrder] = useState<number>(1);
  const [formWalletCredit, setFormWalletCredit] = useState<number>(500);
  const [formDiscountPreset, setFormDiscountPreset] = useState<'none' | 'percentage' | 'custom'>('percentage');
  const [formCustomDiscount, setFormCustomDiscount] = useState<number>(10);
  const [formBonusAmount, setFormBonusAmount] = useState<number>(50);
  const [formExpiration, setFormExpiration] = useState<'none' | '1month' | '3months' | '6months' | '1year'>('1year');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formImage, setFormImage] = useState<string>('');

  // Image upload states
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filters & Pagination states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [txPage, setTxPage] = useState<number>(1);
  const [redPage, setRedPage] = useState<number>(1);
  const itemsPerPage = 5;

  // Fetch all API data
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load packages
      const pkgData = await tenantApiAdapter.get('/tenant/gift-cards/packages');
      setPackages(Array.isArray(pkgData?.packages) ? pkgData.packages : Array.isArray(pkgData) ? pkgData : []);

      // Load summary
      const sumData = await tenantApiAdapter.get('/tenant/gift-cards/reports/summary');
      setSummary(sumData?.summary || sumData || {
        totalRedemptions: 0,
        redeemedAmount: 0,
        adminRedeemedAmount: 0,
        tenantRedeemedAmount: 0
      });

      // Load redemptions
      const redData = await tenantApiAdapter.get('/tenant/gift-cards/reports/redemptions');
      setRedemptions(Array.isArray(redData?.redemptions) ? redData.redemptions : Array.isArray(redData) ? redData : []);

      // Load transactions
      const txData = await tenantApiAdapter.get('/tenant/gift-cards/reports/transactions');
      setTransactions(Array.isArray(txData?.transactions) ? txData.transactions : Array.isArray(txData) ? txData : []);

    } catch (err: any) {
      setError(err.message || "Failed to establish synchronization with gift card servers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Form Reset
  const resetForm = () => {
    setEditingId(null);
    setFormTitle('');
    setFormDescription('');
    setFormDisplayOrder(1);
    setFormWalletCredit(500);
    setFormDiscountPreset('percentage');
    setFormCustomDiscount(10);
    setFormBonusAmount(50);
    setFormExpiration('1year');
    setFormIsActive(true);
    setFormImage('');
  };

  // Preset fill helper
  const loadPackageIntoForm = (pkg: GiftCardPackage) => {
    setEditingId(pkg.id);
    setFormTitle(pkg.title);
    setFormDescription(pkg.description);
    setFormDisplayOrder(pkg.displayOrder);
    setFormWalletCredit(pkg.walletCreditAmount);
    setFormDiscountPreset(pkg.discountPreset);
    setFormCustomDiscount(pkg.customDiscountPercent);
    setFormBonusAmount(pkg.bonusAmount);
    setFormExpiration(pkg.expirationPreset);
    setFormIsActive(pkg.isActive);
    setFormImage(pkg.image);
  };

  // Image base64 handler
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert(isRtl ? "يرجى اختيار ملف صورة صالح." : "Please choose a valid image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      if (e.target?.result) {
        try {
          setUploadingImage(true);
          const base64Str = e.target.result as string;
          if (editingId) {
            // Post directly to specific package image endpoint
            const res = await fetch(`/api/v1/tenant/gift-cards/packages/${editingId}/image`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ image: base64Str })
            });
            if (!res.ok) throw new Error("Server image processing error.");
            const data = await res.json();
            setFormImage(data.imageUrl);
          } else {
            // Just save in state for creation
            setFormImage(base64Str);
          }
        } catch (err: any) {
          alert(isRtl ? "فشل رفع الصورة: " : "Image upload failed: " + err.message);
        } finally {
          setUploadingImage(false);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  };

  // Active status toggle click
  const togglePackageActive = async (id: string, currentStatus: boolean) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/tenant/gift-cards/packages/${id}/active`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus })
      });
      if (!res.ok) throw new Error("Could not toggle package state.");
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to toggle status.");
    } finally {
      setLoading(false);
    }
  };

  // Submit Handler (Create/Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (!formTitle.trim()) {
      alert(isRtl ? "حقل العنوان مطلوب." : "Title is required.");
      return;
    }
    if (Number(formWalletCredit) <= 0) {
      alert(isRtl ? "يجب أن تكون قيمة شحن المحفظة أكبر من 0." : "Wallet credit amount must be greater than 0.");
      return;
    }
    if (formDiscountPreset === 'custom' && (formCustomDiscount < 0 || formCustomDiscount > 100)) {
      alert(isRtl ? "نسبة الخصم المخصصة يجب أن تكون بين 0 و 100." : "Custom discount percentage must be between 0 and 100.");
      return;
    }
    if (!editingId && !formImage) {
      alert(isRtl ? "يرجى تحميل غلاف لبطاقة الإهداء قبل الإنشاء." : "An image background is required to create a gift card package.");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        title: formTitle,
        description: formDescription,
        displayOrder: Number(formDisplayOrder),
        walletCreditAmount: Number(formWalletCredit),
        discountPreset: formDiscountPreset,
        customDiscountPercent: formDiscountPreset === 'custom' ? Number(formCustomDiscount) : (formDiscountPreset === 'percentage' ? 10 : 0),
        bonusAmount: Number(formBonusAmount),
        expirationPreset: formExpiration,
        isActive: formIsActive,
        image: formImage
      };

      const url = editingId 
        ? `/api/v1/tenant/gift-cards/packages/${editingId}` 
        : `/api/v1/tenant/gift-cards/packages`;

      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to process gift card packaging.");
      }

      resetForm();
      await loadData();
      alert(isRtl ? "🎉 تم حفظ حزمة بطاقات الهدايا بنجاح!" : "🎉 Gift card package saved successfully!");
    } catch (err: any) {
      alert(err.message || "Error submitting package details.");
    } finally {
      setLoading(false);
    }
  };

  // CSV download function
  const downloadCsv = () => {
    window.open('/api/v1/tenant/gift-cards/reports/transactions.csv', '_blank');
  };

  // Helper calculations for displaying values
  const getDiscountPercent = (preset: 'none' | 'percentage' | 'custom', customVal: number) => {
    if (preset === 'none') return 0;
    if (preset === 'percentage') return 10;
    return customVal;
  };

  const getExpirationLabel = (preset: 'none' | '1month' | '3months' | '6months' | '1year') => {
    switch (preset) {
      case 'none': return isRtl ? 'صلاحية مدى الحياة' : 'Lifetime validity';
      case '1month': return isRtl ? 'شهر واحد' : '1 Month';
      case '3months': return isRtl ? '٣ أشهر' : '3 Months';
      case '6months': return isRtl ? '٦ أشهر' : '6 Months';
      case '1year': return isRtl ? 'سنة واحدة' : '1 Year';
      default: return preset;
    }
  };

  // Filtering for reports tables
  const filteredTransactions = (Array.isArray(transactions) ? transactions : []).filter(tx =>
    tx.buyerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    tx.recipientName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    tx.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tx.packageName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRedemptions = (Array.isArray(redemptions) ? redemptions : []).filter(red =>
    red.customerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    red.code.toLowerCase().includes(searchQuery.toLowerCase()) || 
    red.customerPhone.includes(searchQuery)
  );

  // Pagination bounds
  const totalTxPages = Math.ceil(filteredTransactions.length / itemsPerPage) || 1;
  const paginatedTransactions = filteredTransactions.slice((txPage - 1) * itemsPerPage, txPage * itemsPerPage);

  const totalRedPages = Math.ceil(filteredRedemptions.length / itemsPerPage) || 1;
  const paginatedRedemptions = filteredRedemptions.slice((redPage - 1) * itemsPerPage, redPage * itemsPerPage);

  return (
    <div className={`space-y-8 ${darkMode ? 'text-zinc-100 font-sans' : 'text-neutral-800 font-sans'}`}>
      
      {/* Simulation/HUD Panel */}
      <div className={`p-4 rounded-xl border flex flex-wrap gap-4 items-center justify-between ${
        darkMode ? 'bg-zinc-900/80 border-zinc-800' : 'bg-neutral-50 border-neutral-200'
      }`}>
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-500"></span>
          </span>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider">
              {isRtl ? 'إدارة بطاقات الهدايا الفاخرة' : 'REFAH Gift Card Authority'}
            </h4>
            <p className="text-[10px] text-zinc-400 mt-0.5">
              {isRtl ? 'بوابة تصميم وتتبع كوبونات الإهداء ورصيد المحافظ الذكي لصالون رفاه.' : 'Configure pre-paid balance campaigns and monitor redemption metrics.'}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadData}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer hover:scale-102 ${
              darkMode ? 'bg-zinc-950 hover:bg-zinc-800 border-zinc-800 text-zinc-200' : 'bg-white hover:bg-neutral-100 border-neutral-200 text-neutral-700'
            }`}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            {isRtl ? 'تحديث البيانات' : 'Sync Metrics'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3">
          <ShieldAlert size={20} className="text-rose-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-black text-rose-500">{isRtl ? 'خطأ اتصال بالشبكة' : 'Synchronisation Error'}</h4>
            <p className="text-[11px] text-rose-400 mt-1 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* TOP SUMMARY CARD (Omnipresent HUD) */}
      <div className={`p-6 rounded-2xl border ${
        darkMode ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-neutral-150 shadow-xs'
      }`}>
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-1.5">
            <span className="text-[10px] font-black text-brand-500 uppercase tracking-widest block">
              {isRtl ? 'البرنامج المالي والترويجي للمحفظة' : 'REFAH GIFT VOUCHER CAMPAIGNS'}
            </span>
            <h2 className="text-lg md:text-xl font-extrabold flex items-center gap-2">
              <Gift className="text-brand-500" size={20} />
              {isRtl ? 'إصدار وتصميم بطاقات الإهداء الرقمية' : 'Digital Gift Cards & Balance Issuance'}
            </h2>
            <p className="text-xs text-neutral-400 max-w-xl">
              {isRtl 
                ? 'قم بتهيئة باقات هدايا جذابة بخصومات حصرية وقيم شحن إضافية (بونص) لزيادة مبيعات الخدمات وولاء الزبائن لصالون رفاه.' 
                : 'Offer customers customizable gift experiences with beautiful covers, priority discounts, and instant wallet credit bonuses.'}
            </p>
          </div>

          <div className="flex gap-4 flex-wrap w-full lg:w-auto">
            <div className={`p-4 rounded-xl border text-start flex-1 lg:flex-none min-w-[130px] ${darkMode ? 'bg-zinc-950 border-zinc-855' : 'bg-neutral-50 border-neutral-200'}`}>
              <span className="text-[9px] text-zinc-500 uppercase tracking-wider block">{isRtl ? 'عدد الباقات النشطة' : 'Active packages'}</span>
              <span className="text-lg font-black font-mono text-brand-500 mt-1 block">
                {packages.filter(p => p.isActive).length} / {packages.length}
              </span>
            </div>
            <div className={`p-4 rounded-xl border text-start flex-1 lg:flex-none min-w-[130px] ${darkMode ? 'bg-zinc-950 border-zinc-855' : 'bg-neutral-50 border-neutral-200'}`}>
              <span className="text-[9px] text-zinc-500 uppercase tracking-wider block">{isRtl ? 'إجمالي المبالغ المستردة' : 'Total Redeemed'}</span>
              <span className="text-lg font-black font-mono text-emerald-500 mt-1 block">
                {summary.redeemedAmount.toLocaleString()} {isRtl ? 'ر.س' : 'SAR'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="border-b border-zinc-800/40 flex gap-4">
        <button
          onClick={() => setActiveTab('builder')}
          className={`pb-3 text-xs md:text-sm font-extrabold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'builder' 
              ? 'border-brand-500 text-brand-500' 
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Settings size={14} />
          {isRtl ? 'منشئ ومصمم البطاقات' : 'Gift Card Builder'}
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`pb-3 text-xs md:text-sm font-extrabold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'reports' 
              ? 'border-brand-500 text-brand-500' 
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <TrendingUp size={14} />
          {isRtl ? 'التقارير والمبيعات والاسترداد' : 'Redemptions & Reports'}
        </button>
      </div>

      {/* TAB 1: BUILDER */}
      {activeTab === 'builder' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Create/Edit Form */}
          <div className={`lg:col-span-5 p-6 rounded-2xl border space-y-6 self-start ${
            darkMode ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-neutral-150 shadow-sm'
          }`}>
            <div className="border-b border-zinc-800/60 pb-3 flex items-center justify-between">
              <h3 className="font-extrabold text-sm md:text-base flex items-center gap-2">
                <Sparkles size={16} className="text-brand-500" />
                {editingId ? (isRtl ? 'تعديل باقة الإهداء الحالية' : 'Modify Gift Card Package') : (isRtl ? 'إنشاء باقة إهداء فاخرة جديدة' : 'Configure New Luxury Package')}
              </h3>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-[10px] text-zinc-400 hover:text-white underline cursor-pointer"
                >
                  {isRtl ? 'إلغاء التعديل' : 'Cancel Edit'}
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              
              {/* Title */}
              <div className="space-y-1.5">
                <label className="font-bold text-zinc-400 block">{isRtl ? 'عنوان الباقة (مثلاً: بطاقة الرفاه الفضية)' : 'Package Display Title *'}</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={isRtl ? 'ادخل اسماً جذاباً للعميل...' : 'Enter enticing spa package title...'}
                  className={`w-full p-3 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden font-bold transition-all ${
                    darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-250 text-neutral-800'
                  }`}
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="font-bold text-zinc-400 block">{isRtl ? 'شرح ووصف مميزات الكارت الفخم' : 'Package Description'}</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder={isRtl ? 'اكتب ترويحاً للخدمات الإضافية المشمولة بالرصيد...' : 'Mention complimentary perks or priority booking privileges...'}
                  rows={2}
                  className={`w-full p-3 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden leading-relaxed transition-all ${
                    darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-250 text-neutral-800'
                  }`}
                />
              </div>

              {/* Display Order & Credit Value */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-zinc-400 block">{isRtl ? 'قيمة الرصيد (المحفظة) *' : 'Wallet Credit Value *'}</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formWalletCredit}
                    onChange={(e) => setFormWalletCredit(Number(e.target.value))}
                    placeholder="500"
                    className={`w-full p-3 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden font-mono font-bold transition-all ${
                      darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-250 text-neutral-800'
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-zinc-400 block">{isRtl ? 'رصيد المكافأة الإضافي (بونص)' : 'Complimentary Bonus'}</label>
                  <input
                    type="number"
                    min={0}
                    value={formBonusAmount}
                    onChange={(e) => setFormBonusAmount(Number(e.target.value))}
                    placeholder="50"
                    className={`w-full p-3 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden font-mono font-bold transition-all ${
                      darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-250 text-neutral-800'
                    }`}
                  />
                </div>
              </div>

              {/* Discount Presets */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-zinc-400 block">{isRtl ? 'العرض المسبق للخصم' : 'Discount Preset Setup'}</label>
                  <select
                    value={formDiscountPreset}
                    onChange={(e: any) => setFormDiscountPreset(e.target.value)}
                    className={`w-full p-3 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden font-bold cursor-pointer transition-all ${
                      darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-250 text-neutral-800'
                    }`}
                  >
                    <option value="none">{isRtl ? 'بدون خصم (السعر كامل)' : 'Full Face Value Price'}</option>
                    <option value="percentage">{isRtl ? 'خصم مسبق تلقائي (10%)' : 'Standard 10% Discount'}</option>
                    <option value="custom">{isRtl ? 'خصم مخصص (%)' : 'Enter Custom Discount %'}</option>
                  </select>
                </div>

                {formDiscountPreset === 'custom' ? (
                  <div className="space-y-1.5">
                    <label className="font-bold text-brand-500 block">{isRtl ? 'نسبة الخصم المخصصة *' : 'Custom Discount % *'}</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      required
                      value={formCustomDiscount}
                      onChange={(e) => setFormCustomDiscount(Number(e.target.value))}
                      placeholder="20"
                      className={`w-full p-3 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden font-mono font-bold transition-all ${
                        darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-250 text-neutral-800'
                      }`}
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="font-bold text-zinc-500 block">{isRtl ? 'ترتيب الظهور في التطبيق' : 'Application Display Order'}</label>
                    <input
                      type="number"
                      min={1}
                      value={formDisplayOrder}
                      onChange={(e) => setFormDisplayOrder(Number(e.target.value))}
                      className={`w-full p-3 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden font-bold transition-all ${
                        darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-250 text-neutral-800'
                      }`}
                    />
                  </div>
                )}
              </div>

              {/* Expiration Preset */}
              <div className="space-y-1.5">
                <label className="font-bold text-zinc-400 block">{isRtl ? 'فترة صلاحية الرصيد' : 'Expiration Duration Preset'}</label>
                <select
                  value={formExpiration}
                  onChange={(e: any) => setFormExpiration(e.target.value)}
                  className={`w-full p-3 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden font-bold cursor-pointer transition-all ${
                    darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-250 text-neutral-800'
                  }`}
                >
                  <option value="none">{isRtl ? 'صلاحية مفتوحة (مدى الحياة)' : 'Indefinite (Lifetime Validity)'}</option>
                  <option value="1month">{isRtl ? 'صلاحية شهر واحد' : '1 Month Expiration Period'}</option>
                  <option value="3months">{isRtl ? 'صلاحية ٣ أشهر' : '3 Months Expiration Period'}</option>
                  <option value="6months">{isRtl ? 'صلاحية ٦ أشهر' : '6 Months Expiration Period'}</option>
                  <option value="1year">{isRtl ? 'صلاحية سنة واحدة كاملة' : '1 Year Expiration Period'}</option>
                </select>
              </div>

              {/* Upload Image Cover Area */}
              <div className="space-y-1.5">
                <label className="font-bold text-zinc-400 block">{isRtl ? 'غلاف بطاقة الهدايا الفاخر (مطلوب للإنشاء) *' : 'Prestige Card Background Cover *'}</label>
                
                <div 
                  className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${
                    dragActive ? 'border-brand-500 bg-brand-500/5' : darkMode ? 'border-zinc-800 bg-zinc-950' : 'border-neutral-250 bg-neutral-50'
                  }`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                >
                  {uploadingImage ? (
                    <div className="py-4 space-y-2">
                      <RefreshCw size={24} className="animate-spin text-brand-500 mx-auto" />
                      <span className="text-[11px] text-zinc-400 block">{isRtl ? 'جاري رفع الملف للسحابة...' : 'Uploading resource metadata...'}</span>
                    </div>
                  ) : formImage ? (
                    <div className="relative inline-block group">
                      <img 
                        src={formImage} 
                        alt="Gift Card preview cover" 
                        className="h-28 object-cover rounded-lg border border-zinc-800 max-w-xs" 
                      />
                      <button
                        type="button"
                        onClick={() => setFormImage('')}
                        className="absolute -top-2 -right-2 p-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full transition-all cursor-pointer shadow-md"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload size={20} className="mx-auto text-zinc-400" />
                      <p className="text-[11px] text-zinc-400">
                        {isRtl ? 'اسحب صورتك هنا أو ' : 'Drag and drop files here, or '}
                        <button 
                          type="button" 
                          onClick={() => fileInputRef.current?.click()}
                          className="text-brand-500 hover:underline font-bold cursor-pointer"
                        >
                          {isRtl ? 'تصفح جهازك' : 'browse local system'}
                        </button>
                      </p>
                      <p className="text-[9px] text-zinc-500">
                        {isRtl ? 'تنسيقات مدعومة: JPG, PNG, WebP (بأبعاد ٢:١ يفضل)' : 'Supports JPG, PNG, WebP. Recommended ratio 2:1'}
                      </p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Is Active Toggle */}
              <div className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                darkMode ? 'bg-zinc-950 border-zinc-855' : 'bg-neutral-50 border-neutral-200'
              }`}>
                <div className="space-y-0.5">
                  <span className="font-extrabold text-xs block">{isRtl ? 'حالة التفعيل والبيع الفوري' : 'Active Status & Instant Sale'}</span>
                  <span className="text-[10px] text-zinc-400 block">
                    {isRtl ? 'إتاحة الباقة للشراء المباشر فوراً لجميع ضيوف رفاه.' : 'Make this package available for online purchase.'}
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formIsActive} 
                    onChange={(e) => setFormIsActive(e.target.checked)} 
                    className="sr-only peer" 
                  />
                  <div className="w-10 h-5 bg-zinc-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-500"></div>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-brand-500 hover:bg-brand-600 disabled:bg-neutral-600 text-white font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-brand-500/10"
              >
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                {editingId 
                  ? (isRtl ? 'حفظ التعديلات الحالية' : 'Commit Changes Now') 
                  : (isRtl ? 'إنشاء وإصدار الباقة' : 'Publish Gift Package')
                }
              </button>

            </form>
          </div>

          {/* Right Column: Configured Package Cards display */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex justify-between items-center">
              <div className="text-start">
                <h3 className="font-extrabold text-sm md:text-base flex items-center gap-2">
                  <Layers className="text-brand-500" size={16} />
                  {isRtl ? 'الباقات الرقمية المهيأة للبيع' : 'Active Active Promotion Packages'}
                </h3>
                <p className="text-[10px] text-zinc-400 mt-0.5">{isRtl ? 'اضغط على رمز التعديل لتعبئة الحقول وتعديل المعايير.' : 'Click edit button to reload fields and tweak criteria.'}</p>
              </div>
            </div>

            {packages.length === 0 ? (
              <div className="p-12 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-xl space-y-3">
                <Gift size={36} className="mx-auto text-zinc-700" />
                <h4 className="font-bold text-xs">{isRtl ? 'لا توجد حزم بطاقات حالية' : 'No configured vouchers'}</h4>
                <p className="text-[11px] text-zinc-400">{isRtl ? 'قم بإنشاء وتحديد أول باقة إهداء لصالون رفاه.' : 'Create your first luxury prepaid pack now using the builder form.'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {packages.map((pkg) => {
                  const discountPercent = getDiscountPercent(pkg.discountPreset, pkg.customDiscountPercent);
                  const price = pkg.walletCreditAmount * (1 - discountPercent / 100);

                  return (
                    <div 
                      key={pkg.id}
                      className={`rounded-2xl border overflow-hidden flex flex-col justify-between transition-all duration-300 group hover:shadow-xl ${
                        darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-neutral-150 shadow-xs'
                      } ${!pkg.isActive ? 'opacity-65' : ''}`}
                    >
                      {/* Image background area with text overlay */}
                      <div className="h-36 relative overflow-hidden bg-zinc-950">
                        <img 
                          src={pkg.image} 
                          alt={pkg.title} 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 filter brightness-90" 
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent p-4 flex flex-col justify-between text-white text-start">
                          <div className="flex justify-between items-start">
                            <span className="text-[9px] bg-brand-500/90 font-black tracking-widest px-1.5 py-0.5 rounded-sm uppercase">
                              {isRtl ? 'صالون رفاه الفاخر' : 'REFAH PRESTIGE'}
                            </span>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => loadPackageIntoForm(pkg)}
                                className="p-1 bg-zinc-900/80 hover:bg-brand-500 text-white rounded transition-colors cursor-pointer"
                                title={isRtl ? 'تعديل المعايير' : 'Edit criteria'}
                              >
                                <Edit3 size={11} />
                              </button>
                              <button
                                type="button"
                                onClick={() => togglePackageActive(pkg.id, pkg.isActive)}
                                className={`p-1 rounded transition-colors cursor-pointer ${
                                  pkg.isActive ? 'bg-emerald-500/80 hover:bg-emerald-600 text-white' : 'bg-zinc-700 hover:bg-zinc-600 text-white'
                                }`}
                                title={pkg.isActive ? (isRtl ? 'تعطيل الحزمة' : 'Disable package') : (isRtl ? 'تفعيل الحزمة' : 'Enable package')}
                              >
                                <Check size={11} />
                              </button>
                            </div>
                          </div>

                          <div className="space-y-0.5">
                            <h4 className="font-extrabold text-sm font-sans drop-shadow-md">{pkg.title}</h4>
                            <p className="text-[10px] text-zinc-300 truncate drop-shadow-sm">{pkg.description}</p>
                          </div>
                        </div>
                      </div>

                      {/* Package parameters metrics */}
                      <div className="p-4 space-y-3.5 text-xs text-start">
                        <div className="grid grid-cols-2 gap-3 border-b border-zinc-800/60 pb-3">
                          <div>
                            <span className="text-[9px] text-zinc-400 block">{isRtl ? 'قيمة الرصيد (الرئيسية)' : 'Wallet Credit Value'}</span>
                            <span className="font-extrabold text-brand-500 text-sm font-mono mt-0.5 block">{pkg.walletCreditAmount.toLocaleString()} {isRtl ? 'ر.س' : 'SAR'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-zinc-400 block">{isRtl ? 'سعر البيع النهائي' : 'Purchasing Price'}</span>
                            <span className="font-extrabold text-emerald-500 text-sm font-mono mt-0.5 block">
                              {price.toLocaleString()} {isRtl ? 'ر.س' : 'SAR'}
                              {discountPercent > 0 && (
                                <span className="text-[9px] text-zinc-500 line-through font-normal ml-1.5">
                                  {pkg.walletCreditAmount}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-[10px] text-zinc-400">
                          <div className="space-y-0.5">
                            <span className="block font-bold">{isRtl ? 'الخصم الترويجي:' : 'Promo Discount:'}</span>
                            <span className="font-extrabold text-zinc-200 block font-mono">
                              {discountPercent > 0 ? `${discountPercent}%` : (isRtl ? 'بدون خصم' : 'Full price')}
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            <span className="block font-bold">{isRtl ? 'مبلغ البونص المضاف:' : 'Added Bonus:'}</span>
                            <span className="font-extrabold text-amber-500 block font-mono">
                              +{pkg.bonusAmount.toLocaleString()} {isRtl ? 'ر.س' : 'SAR'}
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-2.5 border-t border-zinc-800/40 text-[10px] text-zinc-500">
                          <span className="flex items-center gap-1">
                            <Calendar size={11} />
                            {getExpirationLabel(pkg.expirationPreset)}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full font-bold uppercase ${
                            pkg.isActive 
                              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500' 
                              : 'bg-neutral-500/10 text-neutral-400'
                          }`}>
                            {pkg.isActive ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'معطل' : 'Disabled')}
                          </span>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 2: REPORTS */}
      {activeTab === 'reports' && (
        <div className="space-y-8 animate-fade-in">
          
          {/* Summary stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className={`p-5 rounded-2xl border text-start space-y-2 ${darkMode ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-neutral-150 shadow-xs'}`}>
              <div className="flex justify-between items-center text-zinc-500">
                <span className="text-[10px] uppercase tracking-wider font-bold">{isRtl ? 'إجمالي عمليات الاسترداد' : 'Total Redemptions'}</span>
                <CheckCircle size={16} className="text-emerald-500" />
              </div>
              <p className="text-2xl font-black font-mono">{summary.totalRedemptions} {isRtl ? 'مرة' : 'Times'}</p>
              <p className="text-[9px] text-zinc-500 mt-1">{isRtl ? 'سجل كوبونات الإهداء المستهلكة بالكامل.' : 'Total times codes redeemed successfully.'}</p>
            </div>

            <div className={`p-5 rounded-2xl border text-start space-y-2 ${darkMode ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-neutral-150 shadow-xs'}`}>
              <div className="flex justify-between items-center text-zinc-500">
                <span className="text-[10px] uppercase tracking-wider font-bold">{isRtl ? 'إجمالي المبالغ المستردة' : 'Redeemed amount'}</span>
                <TrendingUp size={16} className="text-brand-500" />
              </div>
              <p className="text-2xl font-black font-mono text-brand-500">{summary.redeemedAmount.toLocaleString()} {isRtl ? 'ر.س' : 'SAR'}</p>
              <p className="text-[9px] text-zinc-500 mt-1">{isRtl ? 'القيمة المالية التي تم شطبها كلياً.' : 'Total face value redeemed as salon credits.'}</p>
            </div>

            <div className={`p-5 rounded-2xl border text-start space-y-2 ${darkMode ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-neutral-150 shadow-xs'}`}>
              <div className="flex justify-between items-center text-zinc-500">
                <span className="text-[10px] uppercase tracking-wider font-bold">{isRtl ? 'استرداد بواسطة الإدارة' : 'Admin manual redemptions'}</span>
                <UserCheck size={16} className="text-amber-500" />
              </div>
              <p className="text-2xl font-black font-mono">{summary.adminRedeemedAmount.toLocaleString()} {isRtl ? 'ر.س' : 'SAR'}</p>
              <p className="text-[9px] text-zinc-500 mt-1">{isRtl ? 'تم استهلاكها يدوياً بواسطة مدراء الفروع.' : 'Redeemed by salon staff / branch receptionists.'}</p>
            </div>

            <div className={`p-5 rounded-2xl border text-start space-y-2 ${darkMode ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-neutral-150 shadow-xs'}`}>
              <div className="flex justify-between items-center text-zinc-500">
                <span className="text-[10px] uppercase tracking-wider font-bold">{isRtl ? 'استرداد عبر التطبيق' : 'Tenant App Redemptions'}</span>
                <Layers size={16} className="text-zinc-400" />
              </div>
              <p className="text-2xl font-black font-mono">{summary.tenantRedeemedAmount.toLocaleString()} {isRtl ? 'ر.س' : 'SAR'}</p>
              <p className="text-[9px] text-zinc-500 mt-1">{isRtl ? 'تم تطبيقها ذاتياً بواسطة العملاء للتطبيق.' : 'Applied directly by clients during checkout.'}</p>
            </div>

          </div>

          {/* Table Toolbar Search and CSV Action */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3 top-3.5 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setTxPage(1);
                  setRedPage(1);
                }}
                placeholder={isRtl ? 'البحث بالاسم، رمز الكارت أو اسم الباقة...' : 'Search records by name, code, package title...'}
                className={`w-full pl-9 pr-3 py-2.5 rounded-lg border text-xs focus:ring-1 focus:ring-brand-500 outline-hidden transition-all ${
                  darkMode ? 'bg-zinc-950 border-zinc-850 text-white' : 'bg-white border-neutral-200 text-neutral-800'
                }`}
              />
            </div>

            <button
              type="button"
              onClick={downloadCsv}
              className="py-2.5 px-4 bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold rounded-lg border border-brand-500 flex items-center justify-center gap-1.5 cursor-pointer transition-all hover:scale-102 shadow-sm"
            >
              <FileDown size={14} />
              {isRtl ? 'تصدير كشف المبيعات (CSV)' : 'Export Purchases to CSV'}
            </button>
          </div>

          {/* 1. TRANSACTIONS TABLE */}
          <div className={`p-6 rounded-2xl border space-y-4 ${
            darkMode ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-neutral-150 shadow-sm'
          }`}>
            <div className="border-b border-zinc-800/60 pb-3 flex items-center gap-2 text-start">
              <ClipboardList className="text-brand-500" size={16} />
              <div>
                <h4 className="font-extrabold text-sm">{isRtl ? 'سجل مبيعات وشراء بطاقات الهدايا' : 'Gift Card Purchases & Transactions Log'}</h4>
                <p className="text-[10px] text-zinc-400 mt-0.5">{isRtl ? 'قائمة تفصيلية بكافة عمليات شراء وتصدير رصيد المحفظة الترويجي.' : 'Detailed transaction ledger tracking purchased codes and pay amounts.'}</p>
              </div>
            </div>

            {filteredTransactions.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">
                <p>{isRtl ? 'لا يوجد عمليات شراء مطابقة للبحث.' : 'No purchase transactions matching search.'}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto rounded-xl border border-zinc-850">
                  <table className="w-full text-xs text-start border-collapse">
                    <thead>
                      <tr className={`border-b border-zinc-850 text-neutral-400 ${darkMode ? 'bg-zinc-950/80' : 'bg-neutral-50/80'}`}>
                        <th className="p-3 text-start font-black">{isRtl ? 'معرف المبيعات' : 'Transaction ID'}</th>
                        <th className="p-3 text-start font-black">{isRtl ? 'تاريخ الشراء' : 'Purchased At'}</th>
                        <th className="p-3 text-start font-black">{isRtl ? 'الباقة المستهدفة' : 'Target Package'}</th>
                        <th className="p-3 text-start font-black">{isRtl ? 'رمز الكود' : 'Voucher Code'}</th>
                        <th className="p-3 text-start font-black">{isRtl ? 'المشتري → المستلم' : 'Buyer → Recipient'}</th>
                        <th className="p-3 text-start font-black font-mono">{isRtl ? 'مبلغ الدفع' : 'Amount Paid'}</th>
                        <th className="p-3 text-start font-black font-mono">{isRtl ? 'الرصيد المشحون' : 'Credit Balance'}</th>
                        <th className="p-3 text-center font-black">{isRtl ? 'حالة الدفع' : 'Status'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850">
                      {paginatedTransactions.map((tx) => (
                        <tr key={tx.id} className={darkMode ? 'text-zinc-300' : 'text-neutral-700'}>
                          <td className="p-3 whitespace-nowrap font-mono text-[10px]">{tx.id}</td>
                          <td className="p-3 whitespace-nowrap font-mono text-[10px]">{new Date(tx.purchasedAt).toLocaleString()}</td>
                          <td className="p-3 font-extrabold">{tx.packageName}</td>
                          <td className="p-3 whitespace-nowrap font-mono font-bold text-brand-500">{tx.code}</td>
                          <td className="p-3 truncate max-w-[150px]">
                            <span className="font-bold">{tx.buyerName}</span>
                            <span className="text-zinc-400 mx-1">→</span>
                            <span className="text-zinc-400">{tx.recipientName}</span>
                          </td>
                          <td className="p-3 font-mono font-bold">{tx.amountPaid.toLocaleString()} {isRtl ? 'ر.س' : 'SAR'}</td>
                          <td className="p-3 font-mono font-bold text-brand-500">
                            {tx.walletCreditAmount.toLocaleString()} 
                            {tx.bonusAmount > 0 && <span className="text-[10px] text-amber-500 ml-1">+{tx.bonusAmount}</span>}
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full text-[9px] font-bold">
                              {isRtl ? 'مكتمل' : tx.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="flex justify-between items-center text-xs pt-1">
                  <span className="text-zinc-400">
                    {isRtl ? `صفحة ${txPage} من أصل ${totalTxPages}` : `Page ${txPage} of ${totalTxPages}`}
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={txPage === 1}
                      onClick={() => setTxPage(p => Math.max(1, p - 1))}
                      className={`p-1.5 rounded-md border text-xs cursor-pointer ${
                        darkMode ? 'border-zinc-800 hover:bg-zinc-800 disabled:opacity-40' : 'border-neutral-200 hover:bg-neutral-50 disabled:opacity-40'
                      }`}
                    >
                      <ArrowLeft size={14} className={isRtl ? 'rotate-180' : ''} />
                    </button>
                    <button
                      disabled={txPage === totalTxPages}
                      onClick={() => setTxPage(p => Math.min(totalTxPages, p + 1))}
                      className={`p-1.5 rounded-md border text-xs cursor-pointer ${
                        darkMode ? 'border-zinc-800 hover:bg-zinc-800 disabled:opacity-40' : 'border-neutral-200 hover:bg-neutral-50 disabled:opacity-40'
                      }`}
                    >
                      <ArrowRight size={14} className={isRtl ? 'rotate-180' : ''} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. REDEMPTIONS TABLE */}
          <div className={`p-6 rounded-2xl border space-y-4 ${
            darkMode ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-neutral-150 shadow-sm'
          }`}>
            <div className="border-b border-zinc-800/60 pb-3 flex items-center gap-2 text-start">
              <CheckCircle className="text-emerald-500" size={16} />
              <div>
                <h4 className="font-extrabold text-sm">{isRtl ? 'سجل عمليات الاسترداد والاستهلاك الفعلي' : 'Pre-paid Voucher Redemptions Ledger'}</h4>
                <p className="text-[10px] text-zinc-400 mt-0.5">{isRtl ? 'تفاصيل عمليات سحب الرصيد من الكروت لدفع الفواتير وحجوزات الصالون.' : 'Audit logs of credits extracted from codes to pay for appointments.'}</p>
              </div>
            </div>

            {filteredRedemptions.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">
                <p>{isRtl ? 'لا يوجد عمليات استرداد مطابقة للبحث.' : 'No redemptions found.'}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto rounded-xl border border-zinc-850">
                  <table className="w-full text-xs text-start border-collapse">
                    <thead>
                      <tr className={`border-b border-zinc-850 text-neutral-400 ${darkMode ? 'bg-zinc-950/80' : 'bg-neutral-50/80'}`}>
                        <th className="p-3 text-start font-black">{isRtl ? 'معرف الاسترداد' : 'Redemption ID'}</th>
                        <th className="p-3 text-start font-black">{isRtl ? 'تاريخ الاستهلاك' : 'Redeemed At'}</th>
                        <th className="p-3 text-start font-black font-mono">{isRtl ? 'رمز الكرت' : 'Voucher Code'}</th>
                        <th className="p-3 text-start font-black">{isRtl ? 'العميل المستهلك' : 'Consuming Customer'}</th>
                        <th className="p-3 text-start font-black">{isRtl ? 'قيمة الخصم المستقطع' : 'Deducted Credit'}</th>
                        <th className="p-3 text-start font-black">{isRtl ? 'مرتبط بحجز' : 'Appointment link'}</th>
                        <th className="p-3 text-center font-black">{isRtl ? 'طريقة الاسترداد' : 'Redeemed Via'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850">
                      {paginatedRedemptions.map((red) => (
                        <tr key={red.id} className={darkMode ? 'text-zinc-300' : 'text-neutral-700'}>
                          <td className="p-3 whitespace-nowrap font-mono text-[10px]">{red.id}</td>
                          <td className="p-3 whitespace-nowrap font-mono text-[10px]">{new Date(red.redeemedAt).toLocaleString()}</td>
                          <td className="p-3 whitespace-nowrap font-mono font-bold text-emerald-500">{red.code}</td>
                          <td className="p-3">
                            <span className="font-extrabold block">{red.customerName}</span>
                            <span className="text-[10px] text-zinc-500 block font-mono">{red.customerPhone}</span>
                          </td>
                          <td className="p-3 font-mono font-bold text-emerald-500">-{red.amount.toLocaleString()} {isRtl ? 'ر.س' : 'SAR'}</td>
                          <td className="p-3">
                            {red.appointmentId ? (
                              <span className="font-mono text-[10px] bg-brand-500/10 text-brand-400 border border-brand-500/20 px-1.5 py-0.5 rounded">
                                {red.appointmentId}
                              </span>
                            ) : (
                              <span className="text-zinc-500 font-mono text-[10px]">—</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                              red.redeemedBy === 'admin' 
                                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                                : 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                            }`}>
                              {red.redeemedBy === 'admin' ? (isRtl ? 'الموظف' : 'Admin manual') : (isRtl ? 'العميل' : 'Client app')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="flex justify-between items-center text-xs pt-1">
                  <span className="text-zinc-400">
                    {isRtl ? `صفحة ${redPage} من أصل ${totalRedPages}` : `Page ${redPage} of ${totalRedPages}`}
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={redPage === 1}
                      onClick={() => setRedPage(p => Math.max(1, p - 1))}
                      className={`p-1.5 rounded-md border text-xs cursor-pointer ${
                        darkMode ? 'border-zinc-800 hover:bg-zinc-800 disabled:opacity-40' : 'border-neutral-200 hover:bg-neutral-50 disabled:opacity-40'
                      }`}
                    >
                      <ArrowLeft size={14} className={isRtl ? 'rotate-180' : ''} />
                    </button>
                    <button
                      disabled={redPage === totalRedPages}
                      onClick={() => setRedPage(p => Math.min(totalRedPages, p + 1))}
                      className={`p-1.5 rounded-md border text-xs cursor-pointer ${
                        darkMode ? 'border-zinc-800 hover:bg-zinc-800 disabled:opacity-40' : 'border-neutral-200 hover:bg-neutral-50 disabled:opacity-40'
                      }`}
                    >
                      <ArrowRight size={14} className={isRtl ? 'rotate-180' : ''} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
