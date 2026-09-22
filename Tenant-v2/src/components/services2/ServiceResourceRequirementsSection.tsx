import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Plus,
  Trash2,
  AlertCircle,
  HelpCircle,
  Layers,
  Check
} from 'lucide-react';
import { Language, TenantResourceType, ServiceResourceRequirementDraft } from '../../types';
import { tenantApiAdapter } from '../../lib/tenantApiAdapter';

interface ServiceResourceRequirementsSectionProps {
  lang: Language;
  requirements: ServiceResourceRequirementDraft[];
  onChange: (requirements: ServiceResourceRequirementDraft[]) => void;
  darkMode?: boolean;
}

export default function ServiceResourceRequirementsSection({
  lang,
  requirements,
  onChange,
  darkMode = false
}: ServiceResourceRequirementsSectionProps) {
  const isRtl = lang === 'ar';

  const [availableTypes, setAvailableTypes] = useState<TenantResourceType[]>([]);
  const [isLoadingTypes, setIsLoadingTypes] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Derived state: does this service require resources?
  const requiresResources = requirements.length > 0;

  // Fetch active resource types from tenant API
  useEffect(() => {
    let isMounted = true;
    const fetchTypes = async () => {
      setIsLoadingTypes(true);
      setLoadError(null);
      try {
        const res = await tenantApiAdapter.getResourceTypes();
        if (isMounted && res.success && Array.isArray(res.resourceTypes)) {
          // Keep active ones, plus any already in requirements for historical preservation
          const activeOrUsed = res.resourceTypes.filter((t) => {
            if (t.is_active) return true;
            return requirements.some((r) => r.resourceTypeId === t.id);
          });
          setAvailableTypes(activeOrUsed);
        }
      } catch (err) {
        console.error('Failed to load resource types for service form:', err);
        if (isMounted) {
          setLoadError(
            isRtl
              ? 'تعذر تحميل فئات الموارد المتاحة.'
              : 'Failed to load available resource pools.'
          );
        }
      } finally {
        if (isMounted) setIsLoadingTypes(false);
      }
    };

    fetchTypes();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggleRequiresResources = (value: boolean) => {
    if (!value) {
      // Clear all requirements
      onChange([]);
    } else {
      // Add first requirement row if empty
      if (requirements.length === 0) {
        const defaultTypeId = availableTypes[0]?.id || '';
        onChange([
          {
            resourceTypeId: defaultTypeId,
            variantId: null,
            quantity: 1
          }
        ]);
      }
    }
  };

  const handleAddRequirementRow = () => {
    // Pick first available type not already selected, or first type
    const unusedType = availableTypes.find(
      (t) => !requirements.some((r) => r.resourceTypeId === t.id)
    );
    const selectedTypeId = unusedType?.id || availableTypes[0]?.id || '';

    onChange([
      ...requirements,
      {
        resourceTypeId: selectedTypeId,
        variantId: null,
        quantity: 1
      }
    ]);
  };

  const handleUpdateRequirementRow = (
    index: number,
    field: 'resourceTypeId' | 'quantity',
    value: string | number
  ) => {
    const updated = requirements.map((req, i) => {
      if (i !== index) return req;
      if (field === 'resourceTypeId') {
        const matchedType = availableTypes.find((t) => t.id === value);
        return {
          ...req,
          resourceTypeId: String(value),
          resourceType: matchedType
            ? {
                id: matchedType.id,
                name_en: matchedType.name_en,
                name_ar: matchedType.name_ar,
                is_active: matchedType.is_active
              }
            : req.resourceType
        };
      } else {
        const qty = Math.max(1, Math.round(Number(value) || 1));
        return {
          ...req,
          quantity: qty
        };
      }
    });
    onChange(updated);
  };

  const handleRemoveRequirementRow = (index: number) => {
    const updated = requirements.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className="pt-6 border-t border-slate-100 dark:border-zinc-800 space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Boxes size={15} />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-neutral-800 dark:text-zinc-200">
              {isRtl ? 'الموارد والغرف المطلوبة' : 'Resource & Room Requirements'}
            </h4>
            <span className="text-[10px] text-neutral-400 block">
              {isRtl
                ? 'تخصيص الغرف أو الأجهزة المطلوبة لتنفيذ الخدمة دون تضارب'
                : 'Require physical rooms or specialized equipment for automatic allocation'}
            </span>
          </div>
        </div>
      </div>

      {/* Question Toggle: Does this service require resources? */}
      <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-zinc-750 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-neutral-800 dark:text-zinc-200 block">
              {isRtl ? 'هل تتطلب هذه الخدمة موارد أو غرفاً خاصة؟' : 'Does this service require resources?'}
            </span>
            <span className="text-[10px] text-neutral-400 block">
              {isRtl
                ? 'مثل غرفة مساج، كرسي بديكير، أو جهاز ليزر مخصص أثناء تنفيذ الجلسة'
                : 'e.g. Dedicated massage suite, pedicure chair, or laser device during the appointment'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 shrink-0">
            <button
              type="button"
              onClick={() => handleToggleRequiresResources(false)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                !requiresResources
                  ? 'bg-neutral-800 text-white shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              {isRtl ? 'لا' : 'No'}
            </button>
            <button
              type="button"
              onClick={() => handleToggleRequiresResources(true)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                requiresResources
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              {isRtl ? 'نعم' : 'Yes'}
            </button>
          </div>
        </div>

        {/* When Yes: Resource Requirements List */}
        {requiresResources && (
          <div className="pt-3 border-t border-slate-200/80 dark:border-zinc-750 space-y-3">
            {isLoadingTypes ? (
              <p className="text-xs text-neutral-400 font-semibold py-2">
                {isRtl ? 'جارٍ تحميل فئات الموارد...' : 'Loading resource pools...'}
              </p>
            ) : availableTypes.length === 0 ? (
              /* Empty state if tenant has no resource types */
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 space-y-1">
                <div className="flex items-center gap-2">
                  <AlertCircle size={15} />
                  <span className="text-xs font-bold">
                    {isRtl ? 'لا توجد موارد مضافة بعد' : 'No Resource Pools Available'}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
                  {isRtl
                    ? 'لم يتم إنشاء أي فئات موارد لصالونك حتى الآن. يمكنك التوجه إلى قسم "الموارد" في القائمة الجانبية لإضافة فئات وغرف مثل (غرف المساج، أجهزة الليزر).'
                    : 'No resource pools have been created for your salon yet. Head to the "Resources" workspace in the sidebar to create pools like Massage Rooms or Laser Devices.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-[10px] font-black text-neutral-400 uppercase tracking-wider px-1">
                  <span>{isRtl ? 'فئة المورد المطلوبة' : 'Required Resource Pool'}</span>
                  <span>{isRtl ? 'العدد المطلوب' : 'Quantity'}</span>
                </div>

                {requirements.map((req, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2.5 p-2.5 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-2xs"
                  >
                    {/* Resource Type Dropdown */}
                    <div className="flex-1 min-w-0">
                      <select
                        value={req.resourceTypeId}
                        onChange={(e) =>
                          handleUpdateRequirementRow(index, 'resourceTypeId', e.target.value)
                        }
                        className={`w-full p-2 text-xs font-bold rounded-lg border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                          darkMode
                            ? 'bg-zinc-800 border-zinc-700 text-white'
                            : 'bg-slate-50 border-slate-200 text-neutral-800'
                        }`}
                      >
                        <option value="">
                          {isRtl ? 'اختر فئة المورد...' : 'Select resource type...'}
                        </option>
                        {availableTypes.map((t) => (
                          <option key={t.id} value={t.id}>
                            {isRtl ? t.name_ar : t.name_en} ({isRtl ? t.name_en : t.name_ar})
                            {!t.is_active ? (isRtl ? ' - معطل' : ' - Inactive') : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity Input */}
                    <div className="w-24 shrink-0">
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={req.quantity || 1}
                        onChange={(e) =>
                          handleUpdateRequirementRow(index, 'quantity', e.target.value)
                        }
                        className={`w-full p-2 text-xs font-black text-center rounded-lg border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                          darkMode
                            ? 'bg-zinc-800 border-zinc-700 text-white'
                            : 'bg-slate-50 border-slate-200 text-neutral-900'
                        }`}
                      />
                    </div>

                    {/* Remove Row Button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveRequirementRow(index)}
                      className="p-2 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer shrink-0"
                      title={isRtl ? 'حذف هذا الشرط' : 'Remove requirement'}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}

                {/* Add Another Resource Requirement Button */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleAddRequirementRow}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-xs font-bold transition cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>
                      {isRtl
                        ? 'إضافة مورد مطلوب آخر (مثل: جهاز ليزر + غرفة علاج)'
                        : 'Add another required resource (e.g. Laser Device + Treatment Room)'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
