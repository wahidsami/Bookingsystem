'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getImageUrl, tenantApi } from '@/lib/api';
import { TenantLayout } from '@/components/TenantLayout';

type GiftPackage = {
  id: string;
  title?: string | null;
  description?: string | null;
  title_en: string;
  title_ar: string;
  description_en?: string | null;
  description_ar?: string | null;
  displayOrder: number;
  discountPreset?: string | null;
  discountPercent?: number | string | null;
  priceAmount: number;
  walletCreditAmount: number;
  bonusAmount: number;
  endsAt?: string | null;
  expirationPreset?: string | null;
  imageUrl?: string | null;
  isActive: boolean;
  createdAt?: string | null;
};

type GiftTransaction = {
  id: string;
  status: string;
  deliveryChannel: string;
  purchaseAmount: number;
  creditAmount: number;
  bonusAmount: number;
  totalCreditAmount: number;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  createdAt: string;
  sender?: { firstName?: string; lastName?: string; email?: string } | null;
  recipient?: { firstName?: string; lastName?: string; email?: string } | null;
  package?: { title?: string; title_en?: string; title_ar?: string } | null;
  settlement?: { status?: string; grossAmount?: number; platformFeeAmount?: number; netTenantPayableAmount?: number } | null;
};

type GiftRedemption = {
  id: string;
  code?: string | null;
  scopeType?: string | null;
  redeemedAmount: number;
  remainingAfter: number;
  senderName?: string | null;
  senderEmail?: string | null;
  appointmentId?: string | null;
  orderId?: string | null;
  createdAt: string;
};

const defaultForm = {
  title: '',
  description: '',
  displayOrder: 0,
  walletCreditAmount: 0,
  discountPreset: '10',
  customDiscountPercent: '',
  bonusAmount: 0,
  expirationPreset: '1_month',
  isActive: true
};

const DISCOUNT_PRESET_VALUES = ['2', '5', '7', '10', 'custom'] as const;
const EXPIRATION_PRESETS: Record<string, { labelEn: string; labelAr: string; days?: number }> = {
  '1_week': { labelEn: '1 week', labelAr: 'أسبوع واحد', days: 7 },
  '2_weeks': { labelEn: '2 weeks', labelAr: 'أسبوعان', days: 14 },
  '3_weeks': { labelEn: '3 weeks', labelAr: '3 أسابيع', days: 21 },
  '1_month': { labelEn: '1 month', labelAr: 'شهر واحد', days: 30 },
  '2_months': { labelEn: '2 months', labelAr: 'شهران', days: 60 },
  '3_months': { labelEn: '3 months', labelAr: '3 أشهر', days: 90 },
  '1_year': { labelEn: '1 year', labelAr: 'سنة واحدة', days: 365 },
  never: { labelEn: 'Never', labelAr: 'بدون انتهاء' }
};

const getPackageTitle = (item: GiftPackage) => item.title || item.title_en || item.title_ar || '-';
const getPackageDescription = (item: GiftPackage) => item.description || item.description_en || item.description_ar || '';
const getPackageDiscountPercent = (item: GiftPackage) => {
  if (item.discountPercent !== undefined && item.discountPercent !== null && `${item.discountPercent}`.trim() !== '') {
    const parsed = Number(item.discountPercent);
    if (Number.isFinite(parsed)) return parsed;
  }
  const wallet = Number(item.walletCreditAmount || 0);
  const price = Number(item.priceAmount || 0);
  if (wallet > 0 && price >= 0 && price <= wallet) {
    return Number((100 - ((price / wallet) * 100)).toFixed(2));
  }
  return 0;
};

const getPackageDiscountPreset = (item: GiftPackage) => {
  const presetValue = item.discountPreset ? String(item.discountPreset) : '';
  if (DISCOUNT_PRESET_VALUES.includes(presetValue as (typeof DISCOUNT_PRESET_VALUES)[number])) {
    return presetValue;
  }
  const percent = getPackageDiscountPercent(item);
  const preset = DISCOUNT_PRESET_VALUES.find((value) => value !== 'custom' && Math.abs(Number(value) - percent) < 0.01);
  return preset || 'custom';
};

const getPackageExpirationPreset = (item: GiftPackage) => {
  if (item.expirationPreset && EXPIRATION_PRESETS[item.expirationPreset]) return item.expirationPreset;
  if (!item.endsAt) return 'never';
  const startSource = item.createdAt || item.endsAt;
  const start = new Date(startSource);
  const end = new Date(item.endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'never';
  const diffDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  const matched = Object.entries(EXPIRATION_PRESETS).find(([key, value]) => key !== 'never' && value.days && Math.abs(value.days - diffDays) <= 2);
  return matched?.[0] || 'never';
};

const formatExpirationPreset = (preset: string, isArabic: boolean) => EXPIRATION_PRESETS[preset]?.[isArabic ? 'labelAr' : 'labelEn'] || (isArabic ? 'غير محدد' : 'Unspecified');
const calculatePriceFromDiscount = (walletCreditAmount: number, discountPercent: number) => {
  const credit = Number(walletCreditAmount || 0);
  const discount = Number(discountPercent || 0);
  const price = credit - (credit * (discount / 100));
  return Number(Math.max(0, price).toFixed(2));
};

export default function TenantGiftCardsPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'ar';
  const isArabic = locale === 'ar';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [packages, setPackages] = useState<GiftPackage[]>([]);
  const [transactionsCount, setTransactionsCount] = useState(0);
  const [transactions, setTransactions] = useState<GiftTransaction[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [redemptionSummary, setRedemptionSummary] = useState<any>(null);
  const [redemptions, setRedemptions] = useState<GiftRedemption[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createImageFile, setCreateImageFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<'builder' | 'reports'>('builder');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [packagesRes, summaryRes, txRes, redemptionsRes] = await Promise.all([
        tenantApi.getTenantGiftCardPackages(),
        tenantApi.getTenantGiftCardSummary().catch(() => null),
        tenantApi.getTenantGiftCardTransactions({ limit: 20 }).catch(() => null),
        tenantApi.getTenantGiftCardRedemptions({ limit: 20 }).catch(() => null)
      ]);
      setPackages(packagesRes?.packages || []);
      setSummary(summaryRes?.summary || null);
      setTransactions(txRes?.transactions || []);
      setTransactionsCount((txRes?.transactions || []).length);
      setRedemptions(redemptionsRes?.redemptions || []);
      setRedemptionSummary(redemptionsRes?.summary || null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load gift cards');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setForm(defaultForm);
    setCreateImageFile(null);
    setEditingId(null);
  };

  const startEdit = (item: GiftPackage) => {
    const discountPreset = getPackageDiscountPreset(item);
    const discountPercent = getPackageDiscountPercent(item);
    setEditingId(item.id);
    setForm({
      title: getPackageTitle(item),
      description: getPackageDescription(item),
      displayOrder: Number(item.displayOrder || 0),
      walletCreditAmount: Number(item.walletCreditAmount || 0),
      discountPreset,
      customDiscountPercent: discountPreset === 'custom' ? String(discountPercent || '') : '',
      bonusAmount: Number(item.bonusAmount || 0),
      expirationPreset: getPackageExpirationPreset(item),
      isActive: item.isActive !== false
    });
  };

  const submit = async () => {
    try {
      const resolvedTitle = form.title.trim();
      const resolvedDescription = form.description.trim();
      const discountPreset = form.discountPreset;
      const discountPercent = discountPreset === 'custom'
        ? Number(form.customDiscountPercent || 0)
        : Number(discountPreset || 0);
      if (!resolvedTitle) {
        setError(isArabic ? 'العنوان مطلوب' : 'Title is required');
        return;
      }
      if (!Number.isFinite(Number(form.walletCreditAmount)) || Number(form.walletCreditAmount) <= 0) {
        setError(isArabic ? 'قيمة البطاقة يجب أن تكون أكبر من صفر' : 'Gift card value must be greater than 0');
        return;
      }
      if (discountPreset === 'custom' && !String(form.customDiscountPercent || '').trim()) {
        setError(isArabic ? 'أدخل نسبة الخصم المخصصة' : 'Enter a custom discount percentage');
        return;
      }
      if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent >= 100) {
        setError(isArabic ? 'نسبة الخصم يجب أن تكون بين 0 و 100' : 'Discount percentage must be between 0 and 100');
        return;
      }
      if (!editingId && !createImageFile) {
        setError(isArabic ? 'صورة البطاقة مطلوبة عند الإنشاء' : 'Gift card image is required when creating');
        return;
      }
      setSaving(true);
      setError(null);
      const walletCreditAmount = Number(form.walletCreditAmount || 0);
      const priceAmount = calculatePriceFromDiscount(walletCreditAmount, discountPercent);
      const payload = {
        title: resolvedTitle,
        title_en: resolvedTitle,
        title_ar: resolvedTitle,
        description: resolvedDescription || null,
        description_en: resolvedDescription || null,
        description_ar: resolvedDescription || null,
        displayOrder: Number(form.displayOrder || 0),
        walletCreditAmount,
        priceAmount,
        discountPreset,
        discountPercent,
        discountValue: discountPercent,
        bonusAmount: Number(form.bonusAmount || 0),
        expirationPreset: form.expirationPreset || 'never',
        isActive: form.isActive
      };
      if (editingId) await tenantApi.updateTenantGiftCardPackage(editingId, payload);
      else await tenantApi.createTenantGiftCardPackage(payload, createImageFile);
      resetForm();
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to save gift package');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (pkg: GiftPackage) => {
    try {
      await tenantApi.setTenantGiftCardPackageActive(pkg.id, !pkg.isActive);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update package');
    }
  };

  const exportCsv = async () => {
    try {
      setError(null);
      const { blob, filename } = await tenantApi.downloadTenantGiftCardTransactionsCsv();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename || 'tenant-gift-transactions.csv';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || 'Failed to export CSV');
    }
  };

  const personLabel = (person?: { firstName?: string; lastName?: string; email?: string } | null) => {
    if (!person) return '-';
    const full = `${person.firstName || ''} ${person.lastName || ''}`.trim();
    return full || person.email || '-';
  };

  const formatStatus = (status?: string) => {
    const key = (status || '').toLowerCase();
    if (isArabic) {
      if (key === 'redeemed') return 'تم الاستلام';
      if (key === 'sent_completed') return 'تم الإرسال';
      if (key === 'sent_pending_claim') return 'بانتظار الاستلام';
      if (key === 'purchased') return 'تم الشراء';
      if (key === 'cancelled') return 'ملغي';
      if (key === 'expired') return 'منتهي';
      if (key === 'pending') return 'معلق';
      if (key === 'partially_settled') return 'تسوية جزئية';
      if (key === 'settled') return 'تمت التسوية';
      return status || '-';
    }
    return status || '-';
  };

  return (
    <TenantLayout>
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h1 className="text-2xl font-bold text-gray-900">{isArabic ? 'بطاقات الهدايا' : 'Gift Cards'}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {isArabic ? 'إنشاء بطاقات هدايا خاصة بالمركز مع صورة مخصصة ومتابعة المبيعات.' : 'Create tenant-branded gift cards with custom artwork and sales tracking.'}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs text-gray-500">{isArabic ? 'عدد الحزم' : 'Packages'}</p>
            <p className="text-xl font-semibold text-gray-900">{packages.length}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs text-gray-500">{isArabic ? 'إجمالي المبيعات' : 'Gross sales'}</p>
            <p className="text-xl font-semibold text-gray-900">{Number(summary?.grossSales || 0).toFixed(2)} SAR</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs text-gray-500">{isArabic ? 'آخر العمليات' : 'Recent transactions'}</p>
            <p className="text-xl font-semibold text-gray-900">{transactionsCount}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
            <button
              className={`rounded-lg px-3 py-2 text-sm ${activeTab === 'builder' ? 'bg-white font-semibold text-gray-900 shadow-sm' : 'text-gray-600'}`}
              onClick={() => setActiveTab('builder')}
            >
              {isArabic ? 'إنشاء البطاقات' : 'Card Builder'}
            </button>
            <button
              className={`rounded-lg px-3 py-2 text-sm ${activeTab === 'reports' ? 'bg-white font-semibold text-gray-900 shadow-sm' : 'text-gray-600'}`}
              onClick={() => setActiveTab('reports')}
            >
              {isArabic ? 'التقارير' : 'Reports'}
            </button>
          </div>
          <button className="btn btn-secondary" onClick={exportCsv}>
            {isArabic ? 'تصدير CSV' : 'Export CSV'}
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

      {activeTab === 'builder' && (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 xl:col-span-1">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">{editingId ? (isArabic ? 'تعديل البطاقة' : 'Edit package') : (isArabic ? 'إضافة بطاقة جديدة' : 'Create package')}</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">{isArabic ? 'العنوان' : 'Title'}</label>
                <input className="input" placeholder={isArabic ? 'العنوان' : 'Title'} value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">{isArabic ? 'الوصف' : 'Description'}</label>
                <textarea className="input min-h-20" placeholder={isArabic ? 'الوصف' : 'Description'} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
              </div>
              <div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-600">{isArabic ? 'ترتيب العرض' : 'Display order'}</label>
                    <input className="input" type="number" placeholder={isArabic ? 'الترتيب' : 'Display order'} value={form.displayOrder} onChange={(e) => setForm((p) => ({ ...p, displayOrder: Number(e.target.value || 0) }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-600">{isArabic ? 'الحالة' : 'Status'}</label>
                    <label className="flex h-11 items-center gap-2 rounded-xl border border-gray-200 px-3">
                      <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />
                      <span>{isArabic ? 'فعالة' : 'Active'}</span>
                    </label>
                  </div>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">{isArabic ? 'قيمة البطاقة (SAR)' : 'Gift card value (SAR)'}</label>
                <input className="input" type="number" step="0.01" placeholder={isArabic ? 'القيمة' : 'Value'} value={form.walletCreditAmount} onChange={(e) => setForm((p) => ({ ...p, walletCreditAmount: Number(e.target.value || 0) }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">{isArabic ? 'الخصم' : 'Discount'}</label>
                <select
                  className="input"
                  value={form.discountPreset}
                  onChange={(e) => setForm((p) => ({ ...p, discountPreset: e.target.value, customDiscountPercent: e.target.value === 'custom' ? p.customDiscountPercent : '' }))}
                >
                  <option value="2">2%</option>
                  <option value="5">5%</option>
                  <option value="7">7%</option>
                  <option value="10">10%</option>
                  <option value="custom">{isArabic ? 'مخصص' : 'Custom'}</option>
                </select>
                {form.discountPreset === 'custom' ? (
                  <input
                    className="input mt-2"
                    type="number"
                    step="0.01"
                    min="0"
                    max="99.99"
                    placeholder={isArabic ? 'أدخل نسبة مخصصة' : 'Enter custom percentage'}
                    value={form.customDiscountPercent}
                    onChange={(e) => setForm((p) => ({ ...p, customDiscountPercent: e.target.value }))}
                  />
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">{isArabic ? 'سعر البطاقة' : 'Package price'}</label>
                  <div className="input flex items-center justify-between gap-2 bg-gray-50 text-gray-800">
                    <span>{Number(form.walletCreditAmount || 0) > 0 ? `${calculatePriceFromDiscount(Number(form.walletCreditAmount || 0), form.discountPreset === 'custom' ? Number(form.customDiscountPercent || 0) : Number(form.discountPreset || 0)).toFixed(2)} SAR` : '-'}</span>
                    <span className="text-[11px] font-medium text-gray-500">{isArabic ? 'محسوب تلقائياً' : 'Auto-calculated'}</span>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">{isArabic ? 'الصلاحية' : 'Expiration'}</label>
                  <select className="input" value={form.expirationPreset} onChange={(e) => setForm((p) => ({ ...p, expirationPreset: e.target.value }))}>
                    <option value="1_week">{isArabic ? 'أسبوع واحد' : '1 week'}</option>
                    <option value="2_weeks">{isArabic ? 'أسبوعان' : '2 weeks'}</option>
                    <option value="3_weeks">{isArabic ? '3 أسابيع' : '3 weeks'}</option>
                    <option value="1_month">{isArabic ? 'شهر واحد' : '1 month'}</option>
                    <option value="2_months">{isArabic ? 'شهران' : '2 months'}</option>
                    <option value="3_months">{isArabic ? '3 أشهر' : '3 months'}</option>
                    <option value="1_year">{isArabic ? 'سنة واحدة' : '1 year'}</option>
                    <option value="never">{isArabic ? 'بدون انتهاء' : 'Never'}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">{isArabic ? 'البونص الإضافي (اختياري)' : 'Bonus amount (optional)'}</label>
                <input className="input" type="number" step="0.01" min="0" placeholder={isArabic ? 'البونص' : 'Bonus'} value={form.bonusAmount} onChange={(e) => setForm((p) => ({ ...p, bonusAmount: Number(e.target.value || 0) }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">
                  {isArabic ? 'صورة البطاقة' : 'Card image'}
                  {!editingId ? <span className="ml-1 text-rose-500">*</span> : null}
                </label>
                <input
                  className="input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCreateImageFile(e.target.files?.[0] || null)}
                />
                {createImageFile ? (
                  <p className="mt-1 text-xs text-gray-500">{isArabic ? 'الملف المحدد:' : 'Selected file:'} {createImageFile.name}</p>
                ) : null}
                {editingId ? (
                  <p className="mt-1 text-xs text-gray-400">{isArabic ? 'يمكنك تغيير صورة البطاقة مباشرة من هذا النموذج.' : 'You can update the package image directly from this form.'}</p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <button className="btn btn-primary flex-1" disabled={saving} onClick={submit}>{saving ? (isArabic ? 'جارٍ الحفظ...' : 'Saving...') : (editingId ? (isArabic ? 'تحديث' : 'Update') : (isArabic ? 'إنشاء' : 'Create'))}</button>
                {editingId && <button className="btn btn-secondary" onClick={resetForm}>{isArabic ? 'إلغاء' : 'Cancel'}</button>}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white xl:col-span-2">
            <div className="border-b border-gray-200 px-4 py-3 text-sm text-gray-600">{isArabic ? `الحزم (${packages.length})` : `Packages (${packages.length})`}</div>
            {loading ? (
              <div className="p-8 text-center text-gray-500">{isArabic ? 'جارٍ التحميل...' : 'Loading...'}</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {packages.map((pkg) => (
                  <div key={pkg.id} className="p-4">
                    <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
                      <div className="flex flex-wrap items-start gap-4">
                        <img
                          src={getImageUrl(pkg.imageUrl)}
                          alt={getPackageTitle(pkg)}
                          className="h-20 w-32 rounded-lg border border-gray-200 bg-white object-cover"
                        />
                        <div className="min-w-56 flex-1">
                          <p className="text-base font-semibold text-gray-900">{getPackageTitle(pkg)}</p>
                          {getPackageDescription(pkg) ? (
                            <p className="mt-1 text-xs text-gray-500 line-clamp-2">{getPackageDescription(pkg)}</p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-emerald-50 px-2 py-1 font-medium text-emerald-700">
                              {isArabic ? 'القيمة' : 'Value'} {Number(pkg.walletCreditAmount).toFixed(2)} SAR
                            </span>
                            <span className="rounded-full bg-rose-50 px-2 py-1 font-medium text-rose-700">
                              {isArabic ? 'السعر' : 'Price'} {Number(pkg.priceAmount).toFixed(2)} SAR
                            </span>
                            <span className="rounded-full bg-indigo-50 px-2 py-1 font-medium text-indigo-700">
                              {isArabic ? 'الخصم' : 'Discount'} {getPackageDiscountPercent(pkg).toFixed(2)}%
                            </span>
                            <span className="rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-700">
                              {formatExpirationPreset(getPackageExpirationPreset(pkg), isArabic)}
                            </span>
                            {Number(pkg.bonusAmount || 0) > 0 ? (
                              <span className="rounded-full bg-amber-50 px-2 py-1 font-medium text-amber-700">
                                + {Number(pkg.bonusAmount).toFixed(2)} SAR {isArabic ? 'بونص' : 'bonus'}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="ml-auto flex min-w-[220px] flex-col items-end gap-2">
                          <span className={`rounded-full px-2 py-1 text-xs ${pkg.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                            {pkg.isActive ? (isArabic ? 'فعالة' : 'Active') : (isArabic ? 'متوقفة' : 'Inactive')}
                          </span>
                          <div className="flex flex-wrap justify-end gap-2">
                            <button className="btn btn-secondary" onClick={() => startEdit(pkg)}>
                              {isArabic ? 'تعديل' : 'Edit'}
                            </button>
                            <button className="btn btn-secondary" onClick={() => toggleActive(pkg)}>
                              {pkg.isActive ? (isArabic ? 'إيقاف' : 'Deactivate') : (isArabic ? 'تفعيل' : 'Activate')}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {!packages.length && <div className="p-8 text-center text-gray-500">{isArabic ? 'لا توجد بطاقات حالياً' : 'No gift card packages yet'}</div>}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-xs text-gray-500">{isArabic ? 'عمليات الاسترداد' : 'Redemptions'}</p>
              <p className="text-xl font-semibold text-gray-900">{Number(redemptionSummary?.totalRedemptions || 0)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-xs text-gray-500">{isArabic ? 'إجمالي المسترد' : 'Total redeemed'}</p>
              <p className="text-xl font-semibold text-gray-900">{Number(redemptionSummary?.totalRedeemedAmount || 0).toFixed(2)} SAR</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-xs text-gray-500">{isArabic ? 'استرداد بطاقات رفاه العامة' : 'Admin-global redeemed'}</p>
              <p className="text-xl font-semibold text-gray-900">{Number(redemptionSummary?.adminGlobalRedemptionsAmount || 0).toFixed(2)} SAR</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-xs text-gray-500">{isArabic ? 'استرداد بطاقات المركز' : 'Tenant-scoped redeemed'}</p>
              <p className="text-xl font-semibold text-gray-900">{Number(redemptionSummary?.tenantScopedRedemptionsAmount || 0).toFixed(2)} SAR</p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <div className="border-b border-gray-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-800">
                {isArabic ? 'عمليات الاسترداد الفعلية في المركز' : 'In-center gift card redemptions'}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left">{isArabic ? 'التاريخ' : 'Date'}</th>
                    <th className="px-3 py-2 text-left">{isArabic ? 'الكود' : 'Code'}</th>
                    <th className="px-3 py-2 text-left">{isArabic ? 'النوع' : 'Scope'}</th>
                    <th className="px-3 py-2 text-left">{isArabic ? 'قيمة الاسترداد' : 'Redeemed'}</th>
                    <th className="px-3 py-2 text-left">{isArabic ? 'المتبقي' : 'Remaining after'}</th>
                    <th className="px-3 py-2 text-left">{isArabic ? 'المشتري' : 'Purchased by'}</th>
                    <th className="px-3 py-2 text-left">{isArabic ? 'السياق' : 'Context'}</th>
                  </tr>
                </thead>
                <tbody>
                  {redemptions.map((row) => (
                    <tr key={row.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{new Date(row.createdAt).toLocaleString(isArabic ? 'ar-SA' : 'en-US')}</td>
                      <td className="px-3 py-2 text-gray-800">{row.code || '-'}</td>
                      <td className="px-3 py-2 text-gray-700">{row.scopeType === 'tenant_scoped' ? (isArabic ? 'خاصة بالمركز' : 'Tenant scoped') : (isArabic ? 'عامة' : 'Admin global')}</td>
                      <td className="px-3 py-2 text-emerald-700 whitespace-nowrap">{Number(row.redeemedAmount || 0).toFixed(2)} SAR</td>
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{Number(row.remainingAfter || 0).toFixed(2)} SAR</td>
                      <td className="px-3 py-2 text-gray-700">{row.senderName || row.senderEmail || '-'}</td>
                      <td className="px-3 py-2 text-gray-700">{row.appointmentId ? (isArabic ? 'حجز' : 'Appointment') : row.orderId ? (isArabic ? 'طلب' : 'Order') : '-'}</td>
                    </tr>
                  ))}
                  {!redemptions.length && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                        {isArabic ? 'لا توجد عمليات استرداد بعد' : 'No redemptions yet'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <div className="border-b border-gray-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-800">
              {isArabic ? 'تقرير تفصيلي لحركة بطاقات الهدايا' : 'Detailed Gift Card Transactions'}
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              {isArabic
                ? 'يعرض من اشترى البطاقة، لمن أُرسلت، أين ذهب الرصيد، وحالة التسوية المالية.'
                : 'Shows purchaser, recipient, where credit went, and settlement status.'}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">{isArabic ? 'التاريخ' : 'Date'}</th>
                  <th className="px-3 py-2 text-left">{isArabic ? 'الباقة' : 'Package'}</th>
                  <th className="px-3 py-2 text-left">{isArabic ? 'المشتري' : 'Purchaser'}</th>
                  <th className="px-3 py-2 text-left">{isArabic ? 'المستلم' : 'Recipient'}</th>
                  <th className="px-3 py-2 text-left">{isArabic ? 'قناة الإرسال' : 'Delivery'}</th>
                  <th className="px-3 py-2 text-left">{isArabic ? 'الحالة' : 'Status'}</th>
                  <th className="px-3 py-2 text-left">{isArabic ? 'المدفوع' : 'Paid'}</th>
                  <th className="px-3 py-2 text-left">{isArabic ? 'الرصيد المضاف' : 'Credited'}</th>
                  <th className="px-3 py-2 text-left">{isArabic ? 'إلى رصيد' : 'Balance Destination'}</th>
                  <th className="px-3 py-2 text-left">{isArabic ? 'صافي مستحق المركز' : 'Net Tenant Payable'}</th>
                  <th className="px-3 py-2 text-left">{isArabic ? 'حالة التسوية' : 'Settlement'}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const packageTitle = tx.package?.title || tx.package?.title_en || tx.package?.title_ar || '-';
                  const recipientLabel = personLabel(tx.recipient) !== '-' ? personLabel(tx.recipient) : (tx.recipientEmail || tx.recipientPhone || '-');
                  const destination = tx.recipient
                    ? `${isArabic ? 'محفظة المستخدم' : 'User wallet'} (${recipientLabel})`
                    : (tx.recipientEmail || tx.recipientPhone
                      ? `${isArabic ? 'مطالبة لاحقة عبر' : 'Pending claim via'} ${tx.recipientEmail || tx.recipientPhone}`
                      : (isArabic ? 'محفظة المشتري' : 'Purchaser wallet'));
                  return (
                    <tr key={tx.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{new Date(tx.createdAt).toLocaleString(isArabic ? 'ar-SA' : 'en-US')}</td>
                      <td className="px-3 py-2 text-gray-800">{packageTitle}</td>
                      <td className="px-3 py-2 text-gray-700">{personLabel(tx.sender)}</td>
                      <td className="px-3 py-2 text-gray-700">{recipientLabel}</td>
                      <td className="px-3 py-2 text-gray-700">{tx.deliveryChannel || '-'}</td>
                      <td className="px-3 py-2 text-gray-700">{formatStatus(tx.status)}</td>
                      <td className="px-3 py-2 text-gray-800 whitespace-nowrap">{Number(tx.purchaseAmount || 0).toFixed(2)} SAR</td>
                      <td className="px-3 py-2 text-emerald-700 whitespace-nowrap">+{Number(tx.totalCreditAmount || 0).toFixed(2)} SAR</td>
                      <td className="px-3 py-2 text-gray-700">{destination}</td>
                      <td className="px-3 py-2 text-gray-800 whitespace-nowrap">{Number(tx.settlement?.netTenantPayableAmount || 0).toFixed(2)} SAR</td>
                      <td className="px-3 py-2 text-gray-700">{formatStatus(tx.settlement?.status)}</td>
                    </tr>
                  );
                })}
                {!transactions.length && (
                  <tr>
                    <td colSpan={11} className="px-3 py-8 text-center text-gray-500">
                      {isArabic ? 'لا توجد عمليات حتى الآن' : 'No transactions yet'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </div>
        </div>
      )}
    </div>
    </TenantLayout>
  );
}
