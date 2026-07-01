"use client";

import { useMemo, useState } from "react";
import { Currency } from "@/components/Currency";
import {
  calculateServiceTeamCommission,
  type ServiceEmployeeAssignment,
} from "@/components/serviceEmployeeAssignments";
import {
  ChevronDownIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

export type ServiceVariant = {
  id?: string;
  description: string;
  duration: string;
  finalPrice: string;
  isActive: boolean;
};

type Breakdown = {
  raw: number;
  commission: number;
  tax: number;
  final: number;
  total: number;
  teamCommission: number;
  netAfterTeamCommission: number;
};

interface ServicePricingVariantsSectionProps {
  locale: string;
  isRTL: boolean;
  priceType: string;
  finalPrice: string;
  duration: string;
  globalSettings: {
    taxRate: number;
    serviceCommissionRate: number;
  };
  employeeAssignments: ServiceEmployeeAssignment[];
  variants: ServiceVariant[];
  onPriceTypeChange: (value: string) => void;
  onFinalPriceChange: (value: string) => void;
  onDurationChange: (value: string) => void;
  onVariantsChange: (variants: ServiceVariant[]) => void;
}

function calculateBreakdown(finalPrice: string, globalSettings: { taxRate: number; serviceCommissionRate: number }): Breakdown {
  const final = parseFloat(finalPrice || "0");
  const multiplier = 1 + (globalSettings.serviceCommissionRate / 100) + (globalSettings.taxRate / 100);
  const raw = multiplier > 0 ? final / multiplier : 0;
  const commission = raw * (globalSettings.serviceCommissionRate / 100);
  const tax = raw * (globalSettings.taxRate / 100);
  const total = raw + commission + tax;
  const teamCommission = 0;
  return {
    raw,
    commission,
    tax,
    final,
    total,
    teamCommission,
    netAfterTeamCommission: total
  };
}

const createVariantId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `variant-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export function ServicePricingVariantsSection({
  locale,
  isRTL,
  priceType,
  finalPrice,
  duration,
  globalSettings,
  employeeAssignments,
  variants,
  onPriceTypeChange,
  onFinalPriceChange,
  onDurationChange,
  onVariantsChange
}: ServicePricingVariantsSectionProps) {
  const [showMainBreakdown, setShowMainBreakdown] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [variantBreakdownIndex, setVariantBreakdownIndex] = useState<number | null>(null);
  const [newVariant, setNewVariant] = useState<ServiceVariant>({
    description: "",
    duration: "30",
    finalPrice: "",
    isActive: true
  });

  const mainBreakdown = useMemo(() => {
    const breakdown = calculateBreakdown(finalPrice, globalSettings);
    const teamCommission = calculateServiceTeamCommission(breakdown.final, employeeAssignments);
    return {
      ...breakdown,
      teamCommission,
      netAfterTeamCommission: breakdown.total - teamCommission
    };
  }, [employeeAssignments, finalPrice, globalSettings]);

  const addVariant = () => {
    const trimmedDescription = newVariant.description.trim();
    const trimmedDuration = newVariant.duration.trim();
    const trimmedPrice = newVariant.finalPrice.trim();

    if (!trimmedDescription || !trimmedDuration || !trimmedPrice) {
      return;
    }

    onVariantsChange([
      ...variants,
      {
        id: createVariantId(),
        description: trimmedDescription,
        duration: trimmedDuration,
        finalPrice: trimmedPrice,
        isActive: newVariant.isActive
      }
    ]);

    setNewVariant({
      description: "",
      duration: "30",
      finalPrice: "",
      isActive: true
    });
    setShowVariantModal(false);
  };

  const updateVariant = (index: number, patch: Partial<ServiceVariant>) => {
    onVariantsChange(
      variants.map((variant, currentIndex) =>
        currentIndex === index ? { ...variant, ...patch } : variant
      )
    );
  };

  const removeVariant = (index: number) => {
    onVariantsChange(variants.filter((_, currentIndex) => currentIndex !== index));
    if (variantBreakdownIndex === index) {
      setVariantBreakdownIndex(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className={`rounded-3xl border border-white/10 bg-white/5 p-4 text-slate-100 shadow-[0_18px_60px_rgba(15,23,42,0.18)] backdrop-blur ${isRTL ? 'text-right' : 'text-left'}`}>
        <div className={`flex items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <div>
            <h4 className="text-lg font-semibold text-white">
              {locale === 'ar' ? 'التسعير' : 'Pricing'}
            </h4>
            <p className="text-sm text-slate-300">
              {locale === 'ar'
                ? 'أدخل السعر النهائي، وسيحسب النظام الضريبة والعمولة تلقائياً.'
                : 'Enter the final customer price and the system will derive tax and commission.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMainBreakdown((current) => !current)}
              className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-200 transition hover:border-cyan-300/40 hover:text-cyan-200"
              title={locale === 'ar' ? 'عرض تفاصيل السعر' : 'Show price breakdown'}
            >
              <EyeIcon className="h-5 w-5" />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowActionsMenu((current) => !current)}
                className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-200 transition hover:border-cyan-300/40 hover:text-cyan-200"
                title={locale === 'ar' ? 'خيارات إضافية' : 'More actions'}
              >
                <EllipsisVerticalIcon className="h-5 w-5" />
              </button>

              {showActionsMenu ? (
                <div className={`absolute top-12 z-20 w-64 rounded-2xl border border-white/10 bg-slate-950 p-2 shadow-2xl ${isRTL ? 'left-0' : 'right-0'}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowVariantModal(true);
                      setShowActionsMenu(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/5 ${isRTL ? 'flex-row-reverse text-right' : 'text-left'}`}
                  >
                    <PlusIcon className="h-4 w-4 text-cyan-300" />
                    {locale === 'ar' ? 'إضافة متغير' : 'Add variant'}
                  </button>
                  <button
                    type="button"
                    disabled
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 ${isRTL ? 'flex-row-reverse text-right' : 'text-left'}`}
                  >
                    <ChevronDownIcon className="h-4 w-4" />
                    {locale === 'ar' ? 'تسعير متقدم' : 'Advance pricing'}
                  </button>
                  <button
                    type="button"
                    disabled
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 ${isRTL ? 'flex-row-reverse text-right' : 'text-left'}`}
                  >
                    <ChevronDownIcon className="h-4 w-4" />
                    {locale === 'ar' ? 'مدة متقدمة' : 'Advance duration'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[180px,minmax(0,1fr),180px]">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {locale === 'ar' ? 'نوع السعر' : 'Price type'}
            </label>
            <select
              value={priceType}
              onChange={(event) => onPriceTypeChange(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-slate-100 focus:border-transparent focus:ring-2 focus:ring-cyan-400/30"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              <option value="fixed">{locale === 'ar' ? 'ثابت' : 'Fixed'}</option>
              <option value="free">{locale === 'ar' ? 'مجاني' : 'Free'}</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {locale === 'ar' ? 'السعر النهائي' : 'Final price'} (SAR)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={finalPrice}
              onChange={(event) => onFinalPriceChange(event.target.value)}
              disabled={priceType === 'free'}
              required={priceType !== 'free'}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-slate-100 focus:border-transparent focus:ring-2 focus:ring-cyan-400/30 disabled:cursor-not-allowed disabled:bg-slate-800/60"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {locale === 'ar' ? 'المدة (دقيقة)' : 'Duration (minutes)'}
            </label>
            <input
              type="number"
              min="15"
              step="15"
              value={duration}
              onChange={(event) => onDurationChange(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-slate-100 focus:border-transparent focus:ring-2 focus:ring-cyan-400/30"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            />
          </div>
        </div>

        {showMainBreakdown ? (
          <div className="relative mt-4 rounded-3xl border border-cyan-300/20 bg-cyan-400/10 p-4 shadow-sm">
            <div className={`mb-3 flex items-center justify-between ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
              <div>
                <p className="text-sm font-semibold text-white">
                  {locale === 'ar' ? 'تفاصيل السعر' : 'Price breakdown'}
                </p>
                <p className="text-xs text-slate-300">
                  {locale === 'ar' ? 'انقر لإخفاء التفاصيل' : 'Click to hide the breakdown'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMainBreakdown(false)}
                className="rounded-full border border-white/10 bg-white/10 p-1 text-slate-200 transition hover:text-white"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">{locale === 'ar' ? 'السعر النهائي' : 'Final price'}</span>
                <span className="font-semibold text-white"><Currency amount={mainBreakdown.final} /></span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">
                  {locale === 'ar' ? 'العمولة' : 'Commission'} ({globalSettings.serviceCommissionRate}%)
                </span>
                <span className="text-white"><Currency amount={mainBreakdown.commission} /></span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">
                  {locale === 'ar' ? 'الضريبة' : 'Tax'} ({globalSettings.taxRate}%)
                </span>
                <span className="text-white"><Currency amount={mainBreakdown.tax} /></span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">{locale === 'ar' ? 'السعر الأساسي' : 'Base price'}</span>
                <span className="text-white"><Currency amount={mainBreakdown.raw} /></span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">{locale === 'ar' ? 'عمولة الفريق' : 'Team commission'}</span>
                <span className="text-red-600">- <Currency amount={mainBreakdown.teamCommission} /></span>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-2">
                <span className="font-semibold text-white">{locale === 'ar' ? 'الصافي بعد عمولة الفريق' : 'Net after team commission'}</span>
                <span className="font-bold text-cyan-200"><Currency amount={mainBreakdown.netAfterTeamCommission} /></span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-slate-100 shadow-[0_18px_60px_rgba(15,23,42,0.18)] backdrop-blur">
        <div className={`mb-4 flex items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          <div>
            <h4 className="text-lg font-semibold text-white">
              {locale === 'ar' ? 'النسخ / المتغيرات' : 'Variants'}
            </h4>
            <p className="text-sm text-slate-300">
              {locale === 'ar'
                ? 'أضف نسخاً إضافية للخدمة بالوصف والمدة والسعر.'
                : 'Add service variants with description, duration, and price.'}
            </p>
          </div>
          <button type="button" onClick={() => setShowVariantModal(true)} className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-cyan-300/40 hover:bg-white/10">
            {locale === 'ar' ? 'إضافة متغير' : 'Add variant'}
          </button>
        </div>

        {variants.length > 0 ? (
          <div className="space-y-3">
            {variants.map((variant, index) => {
              const breakdown = calculateBreakdown(variant.finalPrice, globalSettings);
              const isActive = variant.isActive !== false;
              const showBreakdown = variantBreakdownIndex === index;

              return (
                <div key={variant.id || `${variant.description}-${index}`} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <div className={`flex items-start justify-between gap-4 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">
                        {variant.description || (locale === 'ar' ? 'متغير' : 'Variant')}
                      </p>
                      <p className="mt-1 text-xs text-slate-300">
                        {locale === 'ar' ? 'المدة' : 'Duration'}: {variant.duration} {locale === 'ar' ? 'دقيقة' : 'min'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setVariantBreakdownIndex(showBreakdown ? null : index)}
                        className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-200 transition hover:border-cyan-300/40 hover:text-cyan-200"
                        title={locale === 'ar' ? 'عرض تفاصيل السعر' : 'Show price breakdown'}
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateVariant(index, { isActive: !isActive })}
                        className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                          isActive
                            ? 'bg-emerald-500/15 text-emerald-200'
                            : 'bg-white/10 text-slate-400'
                        }`}
                      >
                        {isActive ? (locale === 'ar' ? 'نشط' : 'Active') : (locale === 'ar' ? 'غير نشط' : 'Inactive')}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeVariant(index)}
                        className="rounded-full border border-red-400/30 bg-white/5 p-2 text-red-300 transition hover:bg-red-500/10"
                        title={locale === 'ar' ? 'حذف' : 'Delete'}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-gray-600">{locale === 'ar' ? 'السعر' : 'Price'}</span>
                    <span className="font-semibold text-gray-900"><Currency amount={breakdown.final} /></span>
                  </div>

                  {showBreakdown ? (
              <div className="mt-3 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">{locale === 'ar' ? 'العمولة' : 'Commission'}</span>
                  <span className="text-white"><Currency amount={breakdown.commission} /></span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">{locale === 'ar' ? 'الضريبة' : 'Tax'}</span>
                  <span className="text-white"><Currency amount={breakdown.tax} /></span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">{locale === 'ar' ? 'السعر الأساسي' : 'Base price'}</span>
                  <span className="text-white"><Currency amount={breakdown.raw} /></span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">{locale === 'ar' ? 'عمولة الفريق' : 'Team commission'}</span>
                  <span className="text-red-600">- <Currency amount={calculateServiceTeamCommission(breakdown.final, employeeAssignments)} /></span>
                </div>
                <div className="flex items-center justify-between border-t border-white/10 pt-2">
                  <span className="font-semibold text-white">{locale === 'ar' ? 'الصافي' : 'Net'}</span>
                  <span className="font-bold text-cyan-200">
                    <Currency amount={breakdown.total - calculateServiceTeamCommission(breakdown.final, employeeAssignments)} />
                  </span>
                </div>
              </div>
            ) : null}
          </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
            {locale === 'ar' ? 'لا توجد متغيرات بعد.' : 'No variants added yet.'}
          </div>
        )}
      </div>

      {showVariantModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-950 p-6 text-slate-100 shadow-2xl">
              <div className={`mb-5 flex items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
              <div>
                <h4 className="text-xl font-semibold text-white">
                  {locale === 'ar' ? 'إضافة متغير' : 'Add variant'}
                </h4>
                <p className="text-sm text-slate-300">
                  {locale === 'ar'
                    ? 'أضف نسخة جديدة للخدمة مع وصف وسعر ومدة.'
                    : 'Create a new service variant with description, price, and duration.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowVariantModal(false)}
                className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:text-white"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {locale === 'ar' ? 'الوصف' : 'Description'}
                </label>
                <textarea
                  value={newVariant.description}
                  onChange={(event) => setNewVariant((current) => ({ ...current, description: event.target.value }))}
                  rows={3}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-slate-100 focus:border-transparent focus:ring-2 focus:ring-cyan-400/30"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? 'المدة' : 'Duration'} ({locale === 'ar' ? 'دقيقة' : 'min'})
                  </label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={newVariant.duration}
                    onChange={(event) => setNewVariant((current) => ({ ...current, duration: event.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-slate-100 focus:border-transparent focus:ring-2 focus:ring-cyan-400/30"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? 'السعر النهائي' : 'Final price'} (SAR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newVariant.finalPrice}
                    onChange={(event) => setNewVariant((current) => ({ ...current, finalPrice: event.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-slate-100 focus:border-transparent focus:ring-2 focus:ring-cyan-400/30"
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                </div>
              </div>

              <label className={`flex items-center gap-2 text-sm font-medium text-slate-200 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                <input
                  type="checkbox"
                  checked={newVariant.isActive}
                  onChange={(event) => setNewVariant((current) => ({ ...current, isActive: event.target.checked }))}
                  className="h-4 w-4 text-cyan-400 focus:ring-cyan-400"
                />
                <span>{locale === 'ar' ? 'نشط' : 'Active'}</span>
              </label>
            </div>

            <div className={`mt-6 flex items-center justify-end gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
              <button type="button" onClick={() => setShowVariantModal(false)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10">
                {locale === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={addVariant}
                className="rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:from-cyan-400 hover:to-blue-400"
                disabled={!newVariant.description.trim() || !newVariant.duration.trim() || !newVariant.finalPrice.trim()}
              >
                {locale === 'ar' ? 'إضافة' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
