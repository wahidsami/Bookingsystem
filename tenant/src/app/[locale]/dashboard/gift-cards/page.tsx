'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getImageUrl, tenantApi } from '@/lib/api';
import { TenantLayout } from '@/components/TenantLayout';

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
  package?: { title_en?: string; title_ar?: string } | null;
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
      if (!editingId && !createImageFile) {
        setError(isArabic ? 'صورة البطاقة مطلوبة عند الإنشاء' : 'Gift card image is required when creating');
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
                <label className="mb-1 block text-xs font-semibold text-gray-600">{isArabic ? 'العنوان (EN)' : 'Title (EN)'}</label>
                <input className="input" placeholder="Title (EN)" value={form.title_en} onChange={(e) => setForm((p) => ({ ...p, title_en: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">{isArabic ? 'العنوان (AR)' : 'Title (AR)'}</label>
                <input className="input" placeholder="العنوان (AR)" value={form.title_ar} onChange={(e) => setForm((p) => ({ ...p, title_ar: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">{isArabic ? 'الوصف (EN)' : 'Description (EN)'}</label>
                <textarea className="input min-h-20" placeholder="Description (EN)" value={form.description_en} onChange={(e) => setForm((p) => ({ ...p, description_en: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">{isArabic ? 'الوصف (AR)' : 'Description (AR)'}</label>
                <textarea className="input min-h-20" placeholder="الوصف (AR)" value={form.description_ar} onChange={(e) => setForm((p) => ({ ...p, description_ar: e.target.value }))} />
              </div>
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
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">{isArabic ? 'سعر البطاقة (SAR)' : 'Package price (SAR)'}</label>
                  <input className="input" type="number" step="0.01" placeholder={isArabic ? 'السعر' : 'Price'} value={form.priceAmount} onChange={(e) => setForm((p) => ({ ...p, priceAmount: Number(e.target.value || 0) }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">{isArabic ? 'الرصيد المضاف للمحفظة' : 'Wallet credit amount'}</label>
                  <input className="input" type="number" step="0.01" placeholder={isArabic ? 'الرصيد' : 'Credit'} value={form.walletCreditAmount} onChange={(e) => setForm((p) => ({ ...p, walletCreditAmount: Number(e.target.value || 0) }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">{isArabic ? 'البونص الإضافي' : 'Bonus amount'}</label>
                  <input className="input" type="number" step="0.01" placeholder={isArabic ? 'البونص' : 'Bonus'} value={form.bonusAmount} onChange={(e) => setForm((p) => ({ ...p, bonusAmount: Number(e.target.value || 0) }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">{isArabic ? 'تاريخ البداية' : 'Start date'}</label>
                  <input className="input" type="datetime-local" value={form.startsAt} onChange={(e) => setForm((p) => ({ ...p, startsAt: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">{isArabic ? 'تاريخ النهاية' : 'End date'}</label>
                  <input className="input" type="datetime-local" value={form.endsAt} onChange={(e) => setForm((p) => ({ ...p, endsAt: e.target.value }))} />
                </div>
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
                          alt={pkg.title_en}
                          className="h-20 w-32 rounded-lg border border-gray-200 bg-white object-cover"
                        />
                        <div className="min-w-56 flex-1">
                          <p className="text-base font-semibold text-gray-900">{isArabic ? pkg.title_ar : pkg.title_en}</p>
                          <p className="mt-1 text-xs text-gray-500">
                            {isArabic ? 'العنوان الإنجليزي:' : 'English title:'} {pkg.title_en || '-'}
                          </p>
                          <div className="mt-3 grid gap-2 text-xs text-gray-600 sm:grid-cols-3">
                            <p>{isArabic ? 'السعر:' : 'Price:'} <span className="font-semibold text-gray-900">{Number(pkg.priceAmount).toFixed(2)} SAR</span></p>
                            <p>{isArabic ? 'الرصيد:' : 'Credit:'} <span className="font-semibold text-emerald-700">{Number(pkg.walletCreditAmount).toFixed(2)} SAR</span></p>
                            <p>{isArabic ? 'البونص:' : 'Bonus:'} <span className="font-semibold text-indigo-700">{Number(pkg.bonusAmount).toFixed(2)} SAR</span></p>
                          </div>
                          <p className="mt-2 text-xs font-medium text-gray-700">
                            {isArabic ? 'إجمالي الرصيد:' : 'Total credited:'} {Number(pkg.walletCreditAmount + pkg.bonusAmount).toFixed(2)} SAR
                          </p>
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
                  const packageTitle = isArabic ? (tx.package?.title_ar || tx.package?.title_en || '-') : (tx.package?.title_en || tx.package?.title_ar || '-');
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
