'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getImageUrl, tenantApi } from '@/lib/api';

type GiftPackage = {
  id: string;
  title_en: string;
  title_ar: string;
  description_en?: string | null;
  description_ar?: string | null;
  displayOrder: number;
  priceAmount: number;
  walletCreditAmount: number;
  bonusAmount: number;
  startsAt?: string | null;
  endsAt?: string | null;
  imageUrl?: string | null;
  isActive: boolean;
};

const defaultForm = {
  title_en: '',
  title_ar: '',
  description_en: '',
  description_ar: '',
  displayOrder: 0,
  priceAmount: 0,
  walletCreditAmount: 0,
  bonusAmount: 0,
  startsAt: '',
  endsAt: '',
  isActive: true
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
  const [summary, setSummary] = useState<any>(null);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [packagesRes, summaryRes, txRes] = await Promise.all([
        tenantApi.getTenantGiftCardPackages(),
        tenantApi.getTenantGiftCardSummary().catch(() => null),
        tenantApi.getTenantGiftCardTransactions({ limit: 20 }).catch(() => null)
      ]);
      setPackages(packagesRes?.packages || []);
      setSummary(summaryRes?.summary || null);
      setTransactionsCount((txRes?.transactions || []).length);
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
    setEditingId(null);
  };

  const startEdit = (item: GiftPackage) => {
    setEditingId(item.id);
    setForm({
      title_en: item.title_en || '',
      title_ar: item.title_ar || '',
      description_en: item.description_en || '',
      description_ar: item.description_ar || '',
      displayOrder: Number(item.displayOrder || 0),
      priceAmount: Number(item.priceAmount || 0),
      walletCreditAmount: Number(item.walletCreditAmount || 0),
      bonusAmount: Number(item.bonusAmount || 0),
      startsAt: item.startsAt ? item.startsAt.slice(0, 16) : '',
      endsAt: item.endsAt ? item.endsAt.slice(0, 16) : '',
      isActive: item.isActive !== false
    });
  };

  const submit = async () => {
    try {
      if (!form.title_en.trim() || !form.title_ar.trim()) {
        setError(isArabic ? 'الاسم مطلوب بالعربية والإنجليزية' : 'English and Arabic titles are required');
        return;
      }
      setSaving(true);
      setError(null);
      const payload = {
        ...form,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null
      };
      if (editingId) await tenantApi.updateTenantGiftCardPackage(editingId, payload);
      else await tenantApi.createTenantGiftCardPackage(payload);
      resetForm();
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to save gift package');
    } finally {
      setSaving(false);
    }
  };

  const onUploadImage = async (id: string, file?: File | null) => {
    if (!file) return;
    try {
      setError(null);
      await tenantApi.uploadTenantGiftCardPackageImage(id, file);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to upload image');
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

  return (
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
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 xl:col-span-1">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">{editingId ? (isArabic ? 'تعديل البطاقة' : 'Edit package') : (isArabic ? 'إضافة بطاقة جديدة' : 'Create package')}</h2>
          <div className="space-y-3">
            <input className="input" placeholder="Title (EN)" value={form.title_en} onChange={(e) => setForm((p) => ({ ...p, title_en: e.target.value }))} />
            <input className="input" placeholder="العنوان (AR)" value={form.title_ar} onChange={(e) => setForm((p) => ({ ...p, title_ar: e.target.value }))} />
            <textarea className="input min-h-20" placeholder="Description (EN)" value={form.description_en} onChange={(e) => setForm((p) => ({ ...p, description_en: e.target.value }))} />
            <textarea className="input min-h-20" placeholder="الوصف (AR)" value={form.description_ar} onChange={(e) => setForm((p) => ({ ...p, description_ar: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <input className="input" type="number" placeholder={isArabic ? 'الترتيب' : 'Display order'} value={form.displayOrder} onChange={(e) => setForm((p) => ({ ...p, displayOrder: Number(e.target.value || 0) }))} />
              <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />
                <span>{isArabic ? 'فعالة' : 'Active'}</span>
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input className="input" type="number" step="0.01" placeholder={isArabic ? 'السعر' : 'Price'} value={form.priceAmount} onChange={(e) => setForm((p) => ({ ...p, priceAmount: Number(e.target.value || 0) }))} />
              <input className="input" type="number" step="0.01" placeholder={isArabic ? 'الرصيد' : 'Credit'} value={form.walletCreditAmount} onChange={(e) => setForm((p) => ({ ...p, walletCreditAmount: Number(e.target.value || 0) }))} />
              <input className="input" type="number" step="0.01" placeholder={isArabic ? 'البونص' : 'Bonus'} value={form.bonusAmount} onChange={(e) => setForm((p) => ({ ...p, bonusAmount: Number(e.target.value || 0) }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className="input" type="datetime-local" value={form.startsAt} onChange={(e) => setForm((p) => ({ ...p, startsAt: e.target.value }))} />
              <input className="input" type="datetime-local" value={form.endsAt} onChange={(e) => setForm((p) => ({ ...p, endsAt: e.target.value }))} />
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
                  <div className="flex flex-wrap items-center gap-4">
                    <img src={getImageUrl(pkg.imageUrl)} alt={pkg.title_en} className="h-16 w-28 rounded-lg border border-gray-200 object-cover" />
                    <div className="min-w-52 flex-1">
                      <p className="font-semibold text-gray-900">{isArabic ? pkg.title_ar : pkg.title_en}</p>
                      <p className="text-xs text-gray-500">{Number(pkg.priceAmount).toFixed(2)} SAR -> {Number(pkg.walletCreditAmount + pkg.bonusAmount).toFixed(2)} SAR</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs ${pkg.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>{pkg.isActive ? (isArabic ? 'فعالة' : 'Active') : (isArabic ? 'متوقفة' : 'Inactive')}</span>
                    <button className="btn btn-secondary" onClick={() => startEdit(pkg)}>{isArabic ? 'تعديل' : 'Edit'}</button>
                    <button className="btn btn-secondary" onClick={() => toggleActive(pkg)}>{pkg.isActive ? (isArabic ? 'إيقاف' : 'Deactivate') : (isArabic ? 'تفعيل' : 'Activate')}</button>
                    <label className="btn btn-secondary cursor-pointer">
                      {isArabic ? 'رفع صورة' : 'Upload image'}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => onUploadImage(pkg.id, e.target.files?.[0])} />
                    </label>
                  </div>
                </div>
              ))}
              {!packages.length && <div className="p-8 text-center text-gray-500">{isArabic ? 'لا توجد بطاقات حالياً' : 'No gift card packages yet'}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

