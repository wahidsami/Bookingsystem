import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  Check,
  X,
  Edit2,
  Trash2,
  AlertCircle,
  RotateCw,
  Layers,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Power,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { Language, TenantResourceType, TenantResourceInstance } from '../types';
import { tenantApiAdapter } from '../lib/tenantApiAdapter';

interface ResourcesWorkspaceProps {
  lang: Language;
  darkMode?: boolean;
}

export default function ResourcesWorkspace({ lang, darkMode = false }: ResourcesWorkspaceProps) {
  const isRtl = lang === 'ar';

  // 1. Data States
  const [resourceTypes, setResourceTypes] = useState<TenantResourceType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // 2. Filters & View States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [expandedTypeId, setExpandedTypeId] = useState<string | null>(null);

  // 3. Resource Type Modal State
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [typeModalMode, setTypeModalMode] = useState<'create' | 'edit'>('create');
  const [selectedType, setSelectedType] = useState<TenantResourceType | null>(null);
  const [typeNameAr, setTypeNameAr] = useState('');
  const [typeNameEn, setTypeNameEn] = useState('');
  const [typeIsActive, setTypeIsActive] = useState(true);
  const [typeFormError, setTypeFormError] = useState<string | null>(null);
  const [isSubmittingType, setIsSubmittingType] = useState(false);

  // 4. Resource Instance Modal State
  const [isInstanceModalOpen, setIsInstanceModalOpen] = useState(false);
  const [instanceModalMode, setInstanceModalMode] = useState<'create' | 'edit'>('create');
  const [selectedInstance, setSelectedInstance] = useState<TenantResourceInstance | null>(null);
  const [instanceTypeId, setInstanceTypeId] = useState('');
  const [instanceNameAr, setInstanceNameAr] = useState('');
  const [instanceNameEn, setInstanceNameEn] = useState('');
  const [instanceIsActive, setInstanceIsActive] = useState(true);
  const [instanceFormError, setInstanceFormError] = useState<string | null>(null);
  const [isSubmittingInstance, setIsSubmittingInstance] = useState(false);

  // 5. Deactivation Confirm Dialog State
  const [deactivateTarget, setDeactivateTarget] = useState<{
    type: 'resource_type' | 'resource';
    id: string;
    name: string;
    currentActive: boolean;
  } | null>(null);
  const [isSubmittingDeactivation, setIsSubmittingDeactivation] = useState(false);

  const showToast = (message: string) => {
    setSuccessToast(message);
    setTimeout(() => {
      setSuccessToast(null);
    }, 4000);
  };

  // Fetch all resource types with nested/counted resources
  const fetchResourceTypes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await tenantApiAdapter.getResourceTypes();
      if (res.success && Array.isArray(res.resourceTypes)) {
        setResourceTypes(res.resourceTypes);
        // If there's an expanded type, keep it or expand the first one if none expanded
        if (!expandedTypeId && res.resourceTypes.length > 0) {
          setExpandedTypeId(res.resourceTypes[0].id);
        }
      } else {
        setResourceTypes([]);
      }
    } catch (err: any) {
      console.error('Failed to fetch resource types:', err);
      setError(
        isRtl
          ? 'تعذر تحميل بيانات الموارد، يرجى المحاولة مرة أخرى.'
          : 'Failed to load resources catalog. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchResourceTypes();
  }, []);

  // Filtered resource types
  const filteredTypes = useMemo(() => {
    return resourceTypes.filter((type) => {
      const matchSearch =
        !searchQuery.trim() ||
        type.name_ar.toLowerCase().includes(searchQuery.toLowerCase()) ||
        type.name_en.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && type.is_active) ||
        (statusFilter === 'inactive' && !type.is_active);

      return matchSearch && matchStatus;
    });
  }, [resourceTypes, searchQuery, statusFilter]);

  // Overall Statistics
  const totalTypesCount = resourceTypes.length;
  const totalInstancesCount = useMemo(() => {
    return resourceTypes.reduce((acc, t) => acc + (t.resourcesCount || (t.resources?.length ?? 0)), 0);
  }, [resourceTypes]);
  const activeInstancesCount = useMemo(() => {
    return resourceTypes.reduce(
      (acc, t) => acc + (t.activeResourcesCount || (t.resources?.filter((r) => r.is_active).length ?? 0)),
      0
    );
  }, [resourceTypes]);

  // ─── Resource Type Handlers ─────────────────────────────────────────────
  const handleOpenCreateType = () => {
    setTypeModalMode('create');
    setSelectedType(null);
    setTypeNameAr('');
    setTypeNameEn('');
    setTypeIsActive(true);
    setTypeFormError(null);
    setIsTypeModalOpen(true);
  };

  const handleOpenEditType = (type: TenantResourceType) => {
    setTypeModalMode('edit');
    setSelectedType(type);
    setTypeNameAr(type.name_ar);
    setTypeNameEn(type.name_en);
    setTypeIsActive(type.is_active);
    setTypeFormError(null);
    setIsTypeModalOpen(true);
  };

  const handleSaveType = async (e: React.FormEvent) => {
    e.preventDefault();
    setTypeFormError(null);

    const trimmedAr = typeNameAr.trim();
    const trimmedEn = typeNameEn.trim();

    if (!trimmedAr || !trimmedEn) {
      setTypeFormError(
        isRtl
          ? 'يرجى إدخال اسم نوع المورد باللغتين العربية والإنجليزية.'
          : 'Please provide the resource type name in both Arabic and English.'
      );
      return;
    }

    setIsSubmittingType(true);
    try {
      if (typeModalMode === 'create') {
        const res = await tenantApiAdapter.createResourceType({
          name_ar: trimmedAr,
          name_en: trimmedEn,
          is_active: typeIsActive
        });
        if (res.success) {
          showToast(isRtl ? 'تمت إضافة فئة الموارد بنجاح' : 'Resource pool created successfully');
          setIsTypeModalOpen(false);
          await fetchResourceTypes();
          if (res.resourceType?.id) {
            setExpandedTypeId(res.resourceType.id);
          }
        }
      } else if (selectedType) {
        const res = await tenantApiAdapter.updateResourceType(selectedType.id, {
          name_ar: trimmedAr,
          name_en: trimmedEn,
          is_active: typeIsActive
        });
        if (res.success) {
          showToast(isRtl ? 'تم تحديث فئة الموارد بنجاح' : 'Resource pool updated successfully');
          setIsTypeModalOpen(false);
          await fetchResourceTypes();
        }
      }
    } catch (err: any) {
      console.error('Failed to save resource type:', err);
      const msg = err?.message || err?.error;
      setTypeFormError(
        msg ||
          (isRtl
            ? 'حدث خطأ أثناء حفظ فئة الموارد. تأكد من عدم تكرار الاسم.'
            : 'Failed to save resource pool. Ensure name is unique.')
      );
    } finally {
      setIsSubmittingType(false);
    }
  };

  // ─── Resource Instance Handlers ──────────────────────────────────────────
  const handleOpenCreateInstance = (targetTypeId?: string) => {
    setInstanceModalMode('create');
    setSelectedInstance(null);
    setInstanceTypeId(targetTypeId || (resourceTypes[0]?.id ?? ''));
    setInstanceNameAr('');
    setInstanceNameEn('');
    setInstanceIsActive(true);
    setInstanceFormError(null);
    setIsInstanceModalOpen(true);
  };

  const handleOpenEditInstance = (instance: TenantResourceInstance) => {
    setInstanceModalMode('edit');
    setSelectedInstance(instance);
    setInstanceTypeId(instance.resourceTypeId);
    setInstanceNameAr(instance.name_ar);
    setInstanceNameEn(instance.name_en);
    setInstanceIsActive(instance.is_active);
    setInstanceFormError(null);
    setIsInstanceModalOpen(true);
  };

  const handleSaveInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    setInstanceFormError(null);

    const trimmedAr = instanceNameAr.trim();
    const trimmedEn = instanceNameEn.trim();

    if (!instanceTypeId) {
      setInstanceFormError(
        isRtl ? 'يرجى اختيار فئة المورد التابع لها.' : 'Please select a parent resource type.'
      );
      return;
    }

    if (!trimmedAr || !trimmedEn) {
      setInstanceFormError(
        isRtl
          ? 'يرجى إدخال اسم المورد الفعلي باللغتين العربية والإنجليزية.'
          : 'Please provide the physical resource name in both Arabic and English.'
      );
      return;
    }

    setIsSubmittingInstance(true);
    try {
      if (instanceModalMode === 'create') {
        const res = await tenantApiAdapter.createResource({
          resourceTypeId: instanceTypeId,
          name_ar: trimmedAr,
          name_en: trimmedEn,
          is_active: instanceIsActive
        });
        if (res.success) {
          showToast(isRtl ? 'تمت إضافة المورد الفعلي بنجاح' : 'Physical resource created successfully');
          setIsInstanceModalOpen(false);
          await fetchResourceTypes();
        }
      } else if (selectedInstance) {
        const res = await tenantApiAdapter.updateResource(selectedInstance.id, {
          resourceTypeId: instanceTypeId,
          name_ar: trimmedAr,
          name_en: trimmedEn,
          is_active: instanceIsActive
        });
        if (res.success) {
          showToast(isRtl ? 'تم تحديث بيانات المورد بنجاح' : 'Resource updated successfully');
          setIsInstanceModalOpen(false);
          await fetchResourceTypes();
        }
      }
    } catch (err: any) {
      console.error('Failed to save resource instance:', err);
      const msg = err?.message || err?.error;
      setInstanceFormError(
        msg ||
          (isRtl
            ? 'حدث خطأ أثناء حفظ المورد. تأكد من عدم تكرار الاسم في نفس الفئة.'
            : 'Failed to save resource instance. Check for duplicate name.')
      );
    } finally {
      setIsSubmittingInstance(false);
    }
  };

  // ─── Deactivation / Safe Toggle ──────────────────────────────────────────
  const handleConfirmDeactivate = async () => {
    if (!deactivateTarget) return;
    setIsSubmittingDeactivation(true);
    try {
      if (deactivateTarget.type === 'resource_type') {
        // Safe toggle
        const newActiveState = !deactivateTarget.currentActive;
        const res = await tenantApiAdapter.updateResourceType(deactivateTarget.id, {
          is_active: newActiveState
        });
        if (res.success) {
          showToast(
            isRtl
              ? newActiveState
                ? 'تمت إعادة تنشيط فئة الموارد بنجاح'
                : 'تم إيقاف تنشيط فئة الموارد (لن تتاح للحجوزات المستقبلية)'
              : newActiveState
                ? 'Resource pool reactivated'
                : 'Resource pool deactivated (unavailable for future bookings)'
          );
        }
      } else {
        const newActiveState = !deactivateTarget.currentActive;
        const res = await tenantApiAdapter.updateResource(deactivateTarget.id, {
          is_active: newActiveState
        });
        if (res.success) {
          showToast(
            isRtl
              ? newActiveState
                ? 'تمت إعادة تنشيط المورد بنجاح'
                : 'تم إيقاف تنشيط المورد (لن يتاح للحجوزات المستقبلية)'
              : newActiveState
                ? 'Resource reactivated'
                : 'Resource deactivated (unavailable for future bookings)'
          );
        }
      }
      setDeactivateTarget(null);
      await fetchResourceTypes();
    } catch (err: any) {
      console.error('Failed to update status:', err);
      alert(
        err?.message ||
          (isRtl ? 'فشل تعديل حالة التنشيط للمورد.' : 'Failed to update resource activation state.')
      );
    } finally {
      setIsSubmittingDeactivation(false);
    }
  };

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="space-y-6 animate-fade-in">
      {/* Toast Notification */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-emerald-600 text-white text-xs font-bold shadow-xl border border-emerald-500/30"
          >
            <ShieldCheck size={16} />
            <span>{successToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Workspace Action Bar / Subtitle Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {isRtl ? 'فئات الموارد والمعدات المادية' : 'Resource Pools & Physical Instances'}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-brand-200 bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 dark:border-brand-800/60">
              {isRtl ? 'المرحلة 1C' : 'Phase 1C'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 leading-relaxed font-normal">
            {isRtl
              ? 'إدارة غرف المساج، محطات العناية، وأجهزة الليزر لتخصيصها آلياً مع الحجوزات دون تضارب.'
              : 'Manage treatment rooms, chairs, and specialized equipment allocated automatically by the scheduling engine.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => handleOpenCreateInstance()}
            disabled={resourceTypes.length === 0}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-800 text-xs font-bold shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-700"
            title={
              resourceTypes.length === 0
                ? isRtl
                  ? 'أضف فئة موارد أولاً'
                  : 'Add a resource type first'
                : ''
            }
          >
            <Plus size={15} />
            <span>{isRtl ? 'إضافة مورد فعلي' : 'Add Physical Resource'}</span>
          </button>

          <button
            onClick={handleOpenCreateType}
            className="px-4 py-2.5 bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={15} />
            <span>{isRtl ? 'إضافة فئة موارد' : 'Add Resource Type'}</span>
          </button>
        </div>
      </div>

      {/* KPI Statistic Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Resource Pools */}
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/90 bg-white shadow-2xs transition-all hover:border-brand-200 flex items-center justify-between dark:bg-zinc-900 dark:border-zinc-800">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block">
              {isRtl ? 'فئات الموارد / المجموعات' : 'Resource Pools'}
            </span>
            <span className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mt-1 block">
              {totalTypesCount}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border border-brand-100 bg-brand-50 text-brand-600 dark:bg-brand-950/70 dark:text-brand-300 dark:border-brand-800/60">
            <Layers size={20} />
          </div>
        </div>

        {/* Total Physical Resources */}
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/90 bg-white shadow-2xs transition-all hover:border-slate-300 flex items-center justify-between dark:bg-zinc-900 dark:border-zinc-800">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block">
              {isRtl ? 'إجمالي الموارد المادية' : 'Total Resources'}
            </span>
            <span className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mt-1 block">
              {totalInstancesCount}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border border-purple-100 bg-purple-50 text-purple-600 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800/60">
            <Boxes size={20} />
          </div>
        </div>

        {/* Active for Scheduling */}
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/90 bg-white shadow-2xs transition-all hover:border-emerald-200 flex items-center justify-between dark:bg-zinc-900 dark:border-zinc-800">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block">
              {isRtl ? 'الموارد الجاهزة للحجز' : 'Active for Scheduling'}
            </span>
            <span className="text-2xl md:text-3xl font-black text-emerald-700 dark:text-emerald-400 mt-1 block">
              {activeInstancesCount}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border border-emerald-100 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800/60">
            <Check size={20} />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search
            size={16}
            className={`absolute top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-400 ${
              isRtl ? 'right-3' : 'left-3'
            }`}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isRtl
                ? 'البحث بالاسم (غرفة مساج، جهاز ليزر...)'
                : 'Search pools & resources...'
            }
            className={`w-full text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 placeholder:text-slate-400 shadow-2xs transition dark:bg-zinc-900 dark:border-zinc-800 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-brand-400 ${
              isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'
            }`}
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="flex items-center p-1 rounded-xl border border-slate-200/80 bg-slate-100/80 dark:bg-zinc-900 dark:border-zinc-800">
            {(['all', 'active', 'inactive'] as const).map((filterKey) => (
              <button
                key={filterKey}
                onClick={() => setStatusFilter(filterKey)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  statusFilter === filterKey
                    ? 'bg-brand-500 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 dark:text-zinc-300 dark:hover:text-white'
                }`}
              >
                {filterKey === 'all' && (isRtl ? 'الكل' : 'All')}
                {filterKey === 'active' && (isRtl ? 'النشطة' : 'Active')}
                {filterKey === 'inactive' && (isRtl ? 'المعطلة' : 'Inactive')}
              </button>
            ))}
          </div>

          <button
            onClick={fetchResourceTypes}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-600 hover:text-slate-900 shadow-2xs transition cursor-pointer dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:text-white"
            title={isRtl ? 'تحديث' : 'Refresh'}
          >
            <RotateCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading && resourceTypes.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <RotateCw size={24} className="animate-spin text-brand-500" />
          <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
            {isRtl ? 'جارٍ تحميل سجل الموارد...' : 'Loading resources catalog...'}
          </p>
        </div>
      ) : error ? (
        <div className="p-5 rounded-2xl border border-rose-200 bg-rose-50 text-rose-800 flex items-center justify-between dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-300">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} />
            <span className="text-xs font-bold">{error}</span>
          </div>
          <button
            onClick={fetchResourceTypes}
            className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-rose-700 transition"
          >
            {isRtl ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      ) : filteredTypes.length === 0 ? (
        /* Empty State */
        <div className="py-14 px-6 rounded-2xl border border-dashed border-slate-200 bg-white/70 shadow-2xs text-center flex flex-col items-center justify-center gap-3 dark:bg-zinc-900/60 dark:border-zinc-800">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center border border-brand-100 bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300 dark:border-brand-800/60">
            <Boxes size={28} />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {isRtl ? 'لا توجد موارد مضافة بعد' : 'No Resource Pools Found'}
          </h3>
          <p className="text-xs max-w-md leading-relaxed text-slate-500 dark:text-zinc-400 font-normal">
            {searchQuery
              ? isRtl
                ? 'لا توجد نتائج تطابق معايير البحث الحالية.'
                : 'No resource pools matched your search criteria.'
              : isRtl
                ? 'ابدأ بإضافة فئة الموارد (مثل: غرف المساج، كراسي البديكير، أجهزة الليزر) ثم أضف الموارد المادية تحتها.'
                : 'Start by creating a resource pool (e.g. Massage Rooms, Pedicure Chairs, Laser Devices) and add physical units under it.'}
          </p>
          {!searchQuery && (
            <button
              onClick={handleOpenCreateType}
              className="mt-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={15} />
              <span>{isRtl ? 'إضافة فئة موارد جديدة' : 'Add First Resource Type'}</span>
            </button>
          )}
        </div>
      ) : (
        /* Resource Types Cards List */
        <div className="space-y-4">
          {filteredTypes.map((type) => {
            const isExpanded = expandedTypeId === type.id;
            const instances = type.resources || [];
            const activeCount = instances.filter((i) => i.is_active).length;

            return (
              <div
                key={type.id}
                className={`rounded-2xl border border-slate-200 bg-white shadow-2xs transition-all overflow-hidden dark:bg-zinc-900 dark:border-zinc-800 ${
                  !type.is_active ? 'opacity-90' : ''
                }`}
              >
                {/* Header Row */}
                <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-zinc-800/80">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => setExpandedTypeId(isExpanded ? null : type.id)}
                      className="p-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition cursor-pointer dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:text-white"
                      title={isExpanded ? (isRtl ? 'طي' : 'Collapse') : (isRtl ? 'توسيع' : 'Expand')}
                    >
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>

                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-brand-100 bg-brand-50 text-brand-600 dark:bg-brand-950/70 dark:text-brand-300 dark:border-brand-800/60">
                      <Layers size={18} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {isRtl ? type.name_ar : type.name_en}
                        </h3>
                        {((isRtl && type.name_en) || (!isRtl && type.name_ar)) && (
                          <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                            ({isRtl ? type.name_en : type.name_ar})
                          </span>
                        )}
                        {!type.is_active && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-slate-200 bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300">
                            {isRtl ? 'معطل' : 'Inactive'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs">
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                          {activeCount} {isRtl ? 'مورد نشط' : 'active resources'}
                        </span>
                        <span className="font-bold text-slate-300 dark:text-zinc-600">•</span>
                        <span className="font-medium text-slate-500 dark:text-zinc-400">
                          {instances.length} {isRtl ? 'إجمالي الموارد المادية' : 'total instances'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions for Resource Type */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleOpenCreateInstance(type.id)}
                      className="px-3.5 py-2 rounded-xl border border-brand-200/80 bg-brand-50/70 hover:bg-brand-100 text-brand-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs dark:bg-brand-950/40 dark:border-brand-800/60 dark:text-brand-300 dark:hover:bg-brand-900/60"
                    >
                      <Plus size={14} />
                      <span>{isRtl ? 'إضافة مورد' : 'Add Resource'}</span>
                    </button>

                    <button
                      onClick={() => handleOpenEditType(type)}
                      className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-600 hover:text-slate-900 shadow-2xs transition cursor-pointer dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:text-white"
                      title={isRtl ? 'تعديل الفئة' : 'Edit Pool'}
                    >
                      <Edit2 size={14} />
                    </button>

                    <button
                      onClick={() =>
                        setDeactivateTarget({
                          type: 'resource_type',
                          id: type.id,
                          name: isRtl ? type.name_ar : type.name_en,
                          currentActive: type.is_active
                        })
                      }
                      className={`p-2 rounded-xl border shadow-2xs transition cursor-pointer ${
                        type.is_active
                          ? 'border-slate-200 bg-white text-slate-400 hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50/60 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-amber-400 dark:hover:bg-amber-950/40'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300'
                      }`}
                      title={
                        type.is_active
                          ? isRtl
                            ? 'إيقاف تنشيط الفئة'
                            : 'Deactivate Pool'
                          : isRtl
                            ? 'إعادة تنشيط الفئة'
                            : 'Reactivate Pool'
                      }
                    >
                      <Power size={14} />
                    </button>
                  </div>
                </div>

                {/* Sub-List: Physical Resource Instances */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-5 border-t border-slate-100 bg-slate-50/60 dark:bg-zinc-950/50 dark:border-zinc-800/80"
                    >
                      {/* Section label for visual hierarchy */}
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-3 flex items-center gap-1.5">
                        <Boxes size={13} className="text-slate-400 dark:text-zinc-500" />
                        <span>{isRtl ? 'الموارد المادية التابعة لهذه الفئة' : 'Physical Units in this Pool'}</span>
                      </div>

                      {instances.length === 0 ? (
                        <div className="py-8 px-6 text-center border border-dashed border-slate-200 rounded-2xl bg-white/90 shadow-2xs flex flex-col items-center justify-center gap-2 dark:bg-zinc-900/60 dark:border-zinc-800">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400 dark:text-zinc-500 mb-1">
                            <Boxes size={20} />
                          </div>
                          <p className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
                            {isRtl
                              ? 'لا توجد موارد مادية مسجلة تحت هذه الفئة بعد.'
                              : 'No physical resources registered under this pool yet.'}
                          </p>
                          <button
                            onClick={() => handleOpenCreateInstance(type.id)}
                            className="mt-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                          >
                            <Plus size={14} />
                            <span>
                              {isRtl
                                ? `إضافة أول مورد لـ ${type.name_ar}`
                                : `Add first resource to ${type.name_en}`}
                            </span>
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {instances.map((resItem) => (
                            <div
                              key={resItem.id}
                              className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                                resItem.is_active
                                  ? 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-700'
                                  : 'bg-slate-50/90 border-slate-200/80 text-slate-600 dark:bg-zinc-900/50 dark:border-zinc-800/80 dark:text-zinc-400'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                      resItem.is_active
                                        ? 'bg-emerald-500 ring-2 ring-emerald-500/20'
                                        : 'bg-slate-400 dark:bg-zinc-500'
                                    }`}
                                  />
                                  <h4 className={`text-xs truncate ${
                                    resItem.is_active
                                      ? 'font-bold text-slate-900 dark:text-white'
                                      : 'font-semibold text-slate-600 dark:text-zinc-300'
                                  }`}>
                                    {isRtl ? resItem.name_ar : resItem.name_en}
                                  </h4>
                                </div>
                                <span className="text-[11px] block truncate mt-0.5 font-medium text-slate-500 dark:text-zinc-400">
                                  {isRtl ? resItem.name_en : resItem.name_ar}
                                </span>
                                <span
                                  className={`inline-block text-[10px] mt-1.5 px-2.5 py-0.5 rounded-full border ${
                                    resItem.is_active
                                      ? 'font-bold bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300'
                                      : 'font-semibold bg-slate-100 border-slate-200 text-slate-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400'
                                  }`}
                                >
                                  {resItem.is_active
                                    ? isRtl
                                      ? 'جاهز للحجز'
                                      : 'Available'
                                    : isRtl
                                      ? 'معطل مؤقتاً'
                                      : 'Deactivated'}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={() => handleOpenEditInstance(resItem)}
                                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition shadow-2xs cursor-pointer dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:text-white"
                                  title={isRtl ? 'تعديل' : 'Edit'}
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  onClick={() =>
                                    setDeactivateTarget({
                                      type: 'resource',
                                      id: resItem.id,
                                      name: isRtl ? resItem.name_ar : resItem.name_en,
                                      currentActive: resItem.is_active
                                    })
                                  }
                                  className={`p-1.5 rounded-lg border transition shadow-2xs cursor-pointer ${
                                    resItem.is_active
                                      ? 'border-slate-200 bg-white text-slate-400 hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50/60 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-amber-400 dark:hover:bg-amber-950/40'
                                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300'
                                  }`}
                                  title={
                                    resItem.is_active
                                      ? isRtl
                                        ? 'إيقاف تنشيط المورد'
                                        : 'Deactivate Resource'
                                      : isRtl
                                        ? 'إعادة تنشيط المورد'
                                        : 'Reactivate Resource'
                                  }
                                >
                                  <Power size={13} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── MODAL 1: Create / Edit Resource Type ─────────────────────── */}
      <AnimatePresence>
        {isTypeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-md p-6 rounded-2xl border border-slate-200 bg-white shadow-xl space-y-4 text-slate-900 dark:bg-zinc-900 dark:border-zinc-800 dark:text-white"
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center border border-brand-100 bg-brand-50 text-brand-600 dark:bg-brand-950/70 dark:text-brand-300 dark:border-brand-800/60">
                    <Layers size={16} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {typeModalMode === 'create'
                      ? isRtl
                        ? 'إنشاء فئة موارد جديدة'
                        : 'Create New Resource Pool'
                      : isRtl
                        ? 'تعديل فئة الموارد'
                        : 'Edit Resource Pool'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsTypeModalOpen(false)}
                  className="p-1.5 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-100 text-slate-400 hover:text-slate-700 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-white transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {typeFormError && (
                <div className="p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 border border-rose-200 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-200">
                  <AlertCircle size={15} />
                  <span>{typeFormError}</span>
                </div>
              )}

              <form onSubmit={handleSaveType} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold block mb-1 text-slate-700 dark:text-zinc-200">
                    {isRtl ? 'اسم فئة المورد بالعربية *' : 'Pool Name (Arabic) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={typeNameAr}
                    onChange={(e) => setTypeNameAr(e.target.value)}
                    placeholder={isRtl ? 'مثال: غرف المساج' : 'e.g. غرف المساج'}
                    className="w-full p-2.5 rounded-xl text-xs font-semibold border border-slate-300 bg-slate-50/70 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 placeholder:text-slate-400 shadow-2xs transition outline-none dark:bg-zinc-800 dark:border-zinc-700 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-brand-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold block mb-1 text-slate-700 dark:text-zinc-200">
                    {isRtl ? 'اسم فئة المورد بالإنجليزية *' : 'Pool Name (English) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={typeNameEn}
                    onChange={(e) => setTypeNameEn(e.target.value)}
                    placeholder="e.g. Massage Rooms"
                    className="w-full p-2.5 rounded-xl text-xs font-semibold border border-slate-300 bg-slate-50/70 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 placeholder:text-slate-400 shadow-2xs transition outline-none dark:bg-zinc-800 dark:border-zinc-700 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-brand-400"
                  />
                </div>

                {/* Operational Status Section */}
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 dark:bg-zinc-800/60 dark:border-zinc-700 transition-all">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold block text-slate-900 dark:text-white">
                        {isRtl ? 'الحالة التشغيلية' : 'Operational Status'}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] border ${
                        typeIsActive
                          ? 'font-bold border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:border-emerald-700 dark:text-emerald-300'
                          : 'font-semibold border-slate-200 bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400'
                      }`}>
                        {typeIsActive
                          ? (isRtl ? 'نشط ومتاح' : 'Active & Available')
                          : (isRtl ? 'معطل' : 'Disabled')}
                      </span>
                    </div>
                    <span className="text-[11px] font-normal block text-slate-500 dark:text-zinc-400">
                      {isRtl
                        ? 'المجموعات النشطة تكون متاحة لربطها بالخدمات والحجز'
                        : 'Active pools can be linked to services and booked'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTypeIsActive(!typeIsActive)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none shadow-2xs ${
                      typeIsActive ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-200 hover:bg-slate-300 dark:bg-zinc-700 dark:hover:bg-zinc-600'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        typeIsActive
                          ? isRtl
                            ? '-translate-x-5'
                            : 'translate-x-5'
                          : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-slate-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsTypeModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-700"
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingType}
                    className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isSubmittingType
                      ? isRtl
                        ? 'جارٍ الحفظ...'
                        : 'Saving...'
                      : isRtl
                        ? 'حفظ'
                        : 'Save'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL 2: Create / Edit Physical Resource Instance ────────── */}
      <AnimatePresence>
        {isInstanceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-md p-6 rounded-2xl border border-slate-200 bg-white shadow-xl space-y-4 text-slate-900 dark:bg-zinc-900 dark:border-zinc-800 dark:text-white"
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center border border-brand-100 bg-brand-50 text-brand-600 dark:bg-brand-950/70 dark:text-brand-300 dark:border-brand-800/60">
                    <Boxes size={16} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {instanceModalMode === 'create'
                      ? isRtl
                        ? 'إضافة مورد فعلي جديد'
                        : 'Add Physical Resource Instance'
                      : isRtl
                        ? 'تعديل المورد الفعلي'
                        : 'Edit Physical Resource'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsInstanceModalOpen(false)}
                  className="p-1.5 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-100 text-slate-400 hover:text-slate-700 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-white transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {instanceFormError && (
                <div className="p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 border border-rose-200 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-200">
                  <AlertCircle size={15} />
                  <span>{instanceFormError}</span>
                </div>
              )}

              <form onSubmit={handleSaveInstance} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold block mb-1 text-slate-700 dark:text-zinc-200">
                    {isRtl ? 'فئة المورد (نوع المورد) *' : 'Resource Type / Pool *'}
                  </label>
                  <select
                    value={instanceTypeId}
                    onChange={(e) => setInstanceTypeId(e.target.value)}
                    required
                    className="w-full p-2.5 rounded-xl text-xs font-semibold border border-slate-300 bg-slate-50/70 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 shadow-2xs transition outline-none cursor-pointer dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                  >
                    <option value="">{isRtl ? 'اختر فئة المورد...' : 'Select resource type...'}</option>
                    {resourceTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {isRtl ? t.name_ar : t.name_en} ({isRtl ? t.name_en : t.name_ar})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold block mb-1 text-slate-700 dark:text-zinc-200">
                    {isRtl ? 'اسم المورد بالعربية *' : 'Resource Name (Arabic) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={instanceNameAr}
                    onChange={(e) => setInstanceNameAr(e.target.value)}
                    placeholder={isRtl ? 'مثال: غرفة المساج 1' : 'e.g. غرفة المساج 1'}
                    className="w-full p-2.5 rounded-xl text-xs font-semibold border border-slate-300 bg-slate-50/70 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 placeholder:text-slate-400 shadow-2xs transition outline-none dark:bg-zinc-800 dark:border-zinc-700 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-brand-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold block mb-1 text-slate-700 dark:text-zinc-200">
                    {isRtl ? 'اسم المورد بالإنجليزية *' : 'Resource Name (English) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={instanceNameEn}
                    onChange={(e) => setInstanceNameEn(e.target.value)}
                    placeholder="e.g. Massage Room 1"
                    className="w-full p-2.5 rounded-xl text-xs font-semibold border border-slate-300 bg-slate-50/70 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 placeholder:text-slate-400 shadow-2xs transition outline-none dark:bg-zinc-800 dark:border-zinc-700 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-brand-400"
                  />
                </div>

                {/* Availability Status Section */}
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 dark:bg-zinc-800/60 dark:border-zinc-700 transition-all">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold block text-slate-900 dark:text-white">
                        {isRtl ? 'الحالة التشغيلية' : 'Availability Status'}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] border ${
                        instanceIsActive
                          ? 'font-bold border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:border-emerald-700 dark:text-emerald-300'
                          : 'font-semibold border-slate-200 bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400'
                      }`}>
                        {instanceIsActive
                          ? (isRtl ? 'متاح للجدولة' : 'Available')
                          : (isRtl ? 'معطل مؤقتاً' : 'Deactivated')}
                      </span>
                    </div>
                    <span className="text-[11px] font-normal block text-slate-500 dark:text-zinc-400">
                      {isRtl
                        ? 'المورد النشط يخصص تلقائياً للحجوزات'
                        : 'Active resource is eligible for automatic booking allocation'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInstanceIsActive(!instanceIsActive)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none shadow-2xs ${
                      instanceIsActive ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-200 hover:bg-slate-300 dark:bg-zinc-700 dark:hover:bg-zinc-600'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        instanceIsActive
                          ? isRtl
                            ? '-translate-x-5'
                            : 'translate-x-5'
                          : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-slate-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsInstanceModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-700"
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingInstance}
                    className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isSubmittingInstance
                      ? isRtl
                        ? 'جارٍ الحفظ...'
                        : 'Saving...'
                      : isRtl
                        ? 'حفظ المورد'
                        : 'Save Resource'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL 3: Safe Deactivation Confirmation Dialog ─────────── */}
      <AnimatePresence>
        {deactivateTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-sm p-6 rounded-2xl border border-slate-200 bg-white shadow-xl space-y-4 text-slate-900 dark:bg-zinc-900 dark:border-zinc-800 dark:text-white"
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center border shadow-2xs ${
                deactivateTarget.currentActive
                  ? 'border-amber-200 bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60'
              }`}>
                <Power size={20} />
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {deactivateTarget.currentActive
                    ? isRtl
                      ? `إيقاف تنشيط: ${deactivateTarget.name}`
                      : `Deactivate: ${deactivateTarget.name}`
                    : isRtl
                      ? `إعادة تنشيط: ${deactivateTarget.name}`
                      : `Reactivate: ${deactivateTarget.name}`}
                </h3>
                <p className="text-xs mt-2 leading-relaxed text-slate-500 dark:text-zinc-400 font-normal">
                  {deactivateTarget.currentActive
                    ? isRtl
                      ? 'إلغاء التنشيط يعني أن هذا المورد سيتوقف عن استقبال أي حجوزات مجدولة جديدة مع الحفاظ الكامل على كافة سجلات المواعيد السابقة.'
                      : 'Deactivation means this resource will no longer be available for future scheduling. All historical appointments remain intact.'
                    : isRtl
                      ? 'إعادة التنشيط ستجعل هذا المورد متاحاً فوراً لمحرك الجدولة الآلي للحجوزات الجديدة.'
                      : 'Reactivation will make this resource immediately available for automated booking scheduling.'}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setDeactivateTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
                >
                  {isRtl ? 'تراجع' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeactivate}
                  disabled={isSubmittingDeactivation}
                  className={`px-5 py-2 text-white rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50 shadow-sm ${
                    deactivateTarget.currentActive
                      ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800'
                      : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
                  }`}
                >
                  {isSubmittingDeactivation
                    ? isRtl
                      ? 'جارٍ التحديث...'
                      : 'Updating...'
                    : deactivateTarget.currentActive
                      ? isRtl
                        ? 'تأكيد الإيقاف'
                        : 'Confirm Deactivate'
                      : isRtl
                        ? 'تأكيد التنشيط'
                        : 'Confirm Reactivate'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
