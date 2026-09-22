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
    <div className={`pt-6 border-t ${darkMode ? 'border-zinc-800' : 'border-slate-200'} space-y-4`}>
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
            darkMode
              ? 'bg-brand-950/60 text-brand-300 border-brand-800/40'
              : 'bg-brand-50 text-brand-600 border-brand-100'
          }`}>
            <Boxes size={16} />
          </div>
          <div>
            <h4 className={`text-xs font-bold uppercase tracking-wider ${
              darkMode ? 'text-zinc-100' : 'text-slate-900'
            }`}>
              {isRtl ? 'الموارد والغرف المطلوبة' : 'Resource & Room Requirements'}
            </h4>
            <span className={`text-xs block mt-0.5 font-normal ${
              darkMode ? 'text-zinc-400' : 'text-slate-500'
            }`}>
              {isRtl
                ? 'تخصيص الغرف أو الأجهزة المطلوبة لتنفيذ الخدمة دون تضارب'
                : 'Require physical rooms or specialized equipment for automatic allocation'}
            </span>
          </div>
        </div>
      </div>

      {/* Question Toggle: Does this service require resources? */}
      <div className={`p-5 rounded-2xl border shadow-2xs space-y-4 ${
        darkMode ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className={`text-xs font-bold block ${darkMode ? 'text-white' : 'text-slate-900'}`}>
              {isRtl ? 'هل تتطلب هذه الخدمة موارد أو غرفاً خاصة؟' : 'Does this service require resources?'}
            </span>
            <span className={`text-xs block font-normal ${darkMode ? 'text-zinc-400' : 'text-slate-500'}`}>
              {isRtl
                ? 'مثل غرفة مساج، كرسي بديكير، أو جهاز ليزر مخصص أثناء تنفيذ الجلسة'
                : 'e.g. Dedicated massage suite, pedicure chair, or laser device during the appointment'}
            </span>
          </div>

          <div className={`flex items-center gap-1 p-1 rounded-xl border shrink-0 ${
            darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              type="button"
              onClick={() => handleToggleRequiresResources(false)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                !requiresResources
                  ? darkMode ? 'bg-zinc-800 text-white shadow-2xs' : 'bg-slate-900 text-white shadow-2xs'
                  : darkMode ? 'text-zinc-300 hover:text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              {isRtl ? 'لا' : 'No'}
            </button>
            <button
              type="button"
              onClick={() => handleToggleRequiresResources(true)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                requiresResources
                  ? 'bg-brand-500 text-white shadow-2xs'
                  : darkMode ? 'text-zinc-300 hover:text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              {isRtl ? 'نعم' : 'Yes'}
            </button>
          </div>
        </div>

        {/* When Yes: Resource Requirements List */}
        {requiresResources && (
          <div className={`pt-4 border-t space-y-3 ${darkMode ? 'border-zinc-800' : 'border-slate-100'}`}>
            {isLoadingTypes ? (
              <p className={`text-xs font-semibold py-2 ${darkMode ? 'text-zinc-400' : 'text-slate-500'}`}>
                {isRtl ? 'جارٍ تحميل فئات الموارد...' : 'Loading resource pools...'}
              </p>
            ) : availableTypes.length === 0 ? (
              /* Empty state if tenant has no resource types */
              <div className={`p-4 rounded-xl border space-y-1.5 ${
                darkMode ? 'bg-amber-950/30 border-amber-800/60 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}>
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span className="text-xs font-bold">
                    {isRtl ? 'لا توجد موارد مضافة بعد' : 'No Resource Pools Available'}
                  </span>
                </div>
                <p className={`text-xs leading-relaxed font-normal ${
                  darkMode ? 'text-amber-300' : 'text-amber-800'
                }`}>
                  {isRtl
                    ? 'لم يتم إنشاء أي فئات موارد لصالونك حتى الآن. يمكنك التوجه إلى قسم "الموارد" في القائمة الجانبية لإضافة فئات وغرف مثل (غرف المساج، أجهزة الليزر).'
                    : 'No resource pools have been created for your salon yet. Head to the "Resources" workspace in the sidebar to create pools like Massage Rooms or Laser Devices.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className={`flex items-center justify-between text-xs font-bold uppercase tracking-wider px-2 ${
                  darkMode ? 'text-zinc-400' : 'text-slate-500'
                }`}>
                  <span>{isRtl ? 'فئة المورد المطلوبة' : 'Required Resource Pool'}</span>
                  <span className="w-24 text-center">{isRtl ? 'العدد' : 'Quantity'}</span>
                </div>

                {requirements.map((req, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-3 p-3 rounded-xl border shadow-2xs ${
                      darkMode ? 'bg-zinc-800/60 border-zinc-700' : 'bg-slate-50/80 border-slate-200'
                    }`}
                  >
                    {/* Resource Type Dropdown */}
                    <div className="flex-1 min-w-0">
                      <select
                        value={req.resourceTypeId}
                        onChange={(e) =>
                          handleUpdateRequirementRow(index, 'resourceTypeId', e.target.value)
                        }
                        className={`w-full p-2.5 text-xs font-semibold rounded-xl border shadow-2xs transition outline-none cursor-pointer ${
                          darkMode
                            ? 'bg-zinc-800 border-zinc-700 text-white focus:border-brand-400'
                            : 'border-slate-300 bg-white hover:border-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 text-slate-900'
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
                        className={`w-full p-2.5 text-xs font-bold text-center rounded-xl border shadow-2xs transition outline-none ${
                          darkMode
                            ? 'bg-zinc-800 border-zinc-700 text-white focus:border-brand-400'
                            : 'border-slate-300 bg-white hover:border-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 text-slate-900'
                        }`}
                      />
                    </div>

                    {/* Remove Row Button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveRequirementRow(index)}
                      className={`p-2.5 rounded-xl border shadow-2xs transition cursor-pointer shrink-0 ${
                        darkMode
                          ? 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-rose-400 hover:bg-rose-950/30'
                          : 'border-slate-200 hover:border-rose-200 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600'
                      }`}
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
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-bold shadow-2xs transition cursor-pointer ${
                      darkMode
                        ? 'bg-brand-950/40 border-brand-800/60 text-brand-300 hover:bg-brand-900/50'
                        : 'border-brand-200/80 bg-brand-50/70 hover:bg-brand-100 text-brand-700'
                    }`}
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
