import React, { useMemo } from 'react';
import { Search, Package as PackageIcon, Clock, Trash, PlusCircle, Layers } from 'lucide-react';
import { type ServiceRecord, type ServiceVariantRecord } from '../../lib/serviceContract';
import AppointmentServiceRow from './AppointmentServiceRow';

export interface StagedService {
  id: string;
  itemType?: 'service' | 'package';
  packageId?: string;
  packageInstanceId?: string;
  packageItemId?: string;
  sequenceOrder?: number;
  serviceId: string;
  variantId?: string;
  serviceCategory?: string;
  staffId: string;
  startTime: number;
  startTimeIso?: string;
  duration: number;
  discountType?: 'none' | 'flat' | 'percent';
  discountValue?: number;
  notes?: string;
  basePrice?: number;
  finalPrice?: number;
  timingMode?: 'auto' | 'manual';
  overtimeApproval?: { approved: boolean };
}

interface AppointmentServicesStepProps {
  tenantId: string;
  tenantTimezone: string;
  selectedDate: string;
  isRtl: boolean;
  boardStartHour?: number;
  slotMinutes?: number;
  bookingRecoveryMode?: 'chain' | 'modify_professionals' | 'separate_services';
  forceExpandAll?: boolean;
  canonicalServices: ServiceRecord[];
  servicePackages?: any[];
  services2Bundles?: any[];
  tenantCategories?: any[];
  stagedServices: StagedService[];
  availableStylists: any[];
  serviceCategoryTabs: { key: string; labelAr: string; labelEn: string }[];
  currentServiceCategory: string;
  setCurrentServiceCategory: (key: string) => void;
  serviceSearch: string;
  setServiceSearch: (val: string) => void;
  onAddService: (service: ServiceRecord, variant?: ServiceVariantRecord | null) => void;
  onAddBundle?: (bundleId: string) => void;
  onAddPackage?: (packageId: string) => void;
  onUpdateService: (id: string, updates: Partial<StagedService>) => void;
  onRemoveService: (index: number) => void;
  formatMinutesToTime: (mins: number) => string;
  onPrevious: () => void;
  onNext: () => void;
}

export default function AppointmentServicesStep({
  tenantId,
  tenantTimezone,
  selectedDate,
  isRtl,
  boardStartHour = 9,
  slotMinutes = 5,
  bookingRecoveryMode = 'chain',
  forceExpandAll = false,
  canonicalServices,
  servicePackages = [],
  services2Bundles = [],
  tenantCategories = [],
  stagedServices,
  availableStylists,
  serviceCategoryTabs,
  currentServiceCategory,
  setCurrentServiceCategory,
  serviceSearch,
  setServiceSearch,
  onAddService,
  onAddBundle,
  onAddPackage,
  onUpdateService,
  onRemoveService,
}: AppointmentServicesStepProps) {

  const effectiveBundles = useMemo(() => {
    if (services2Bundles && services2Bundles.length > 0) {
      return services2Bundles;
    }
    return servicePackages || [];
  }, [services2Bundles, servicePackages]);

  // Unified search filtering for services
  const filteredServices = useMemo(() => {
    let list = canonicalServices;
    const query = serviceSearch.trim().toLowerCase();
    if (query) {
      list = list.filter(s => {
        const nameEn = `${s.nameEn || s.name_en || ''}`.toLowerCase();
        const nameAr = `${s.nameAr || s.name_ar || ''}`.toLowerCase();
        const descEn = `${s.descriptionEn || s.description_en || ''}`.toLowerCase();
        const descAr = `${s.descriptionAr || s.description_ar || ''}`.toLowerCase();
        const variants = Array.isArray(s.variants) ? s.variants : [];
        const variantMatch = variants.some((v) => {
          const vNameEn = `${v?.nameEn || v?.name_en || ''}`.toLowerCase();
          const vNameAr = `${v?.nameAr || v?.name_ar || ''}`.toLowerCase();
          return vNameEn.includes(query) || vNameAr.includes(query);
        });
        return nameEn.includes(query) || nameAr.includes(query) || descEn.includes(query) || descAr.includes(query) || variantMatch;
      });
    }
    return list;
  }, [canonicalServices, serviceSearch]);

  // Unified search filtering for bundles
  const filteredBundles = useMemo(() => {
    let list = effectiveBundles;
    const query = serviceSearch.trim().toLowerCase();
    if (query) {
      list = list.filter(b => {
        const nameEn = `${b.name_en || b.nameEn || ''}`.toLowerCase();
        const nameAr = `${b.name_ar || b.nameAr || ''}`.toLowerCase();
        const descEn = `${b.description_en || b.descriptionEn || ''}`.toLowerCase();
        const descAr = `${b.description_ar || b.descriptionAr || ''}`.toLowerCase();
        const itemsMatch = Array.isArray(b.items) && b.items.some((item: any) => {
          const srv = canonicalServices.find(s => s.id === item.serviceId);
          const sNameEn = `${srv?.nameEn || item?.service?.name_en || ''}`.toLowerCase();
          const sNameAr = `${srv?.nameAr || item?.service?.name_ar || ''}`.toLowerCase();
          return sNameEn.includes(query) || sNameAr.includes(query);
        });
        return nameEn.includes(query) || nameAr.includes(query) || descEn.includes(query) || descAr.includes(query) || itemsMatch;
      });
    }
    return list;
  }, [effectiveBundles, serviceSearch, canonicalServices]);

  // Group items by tenant category
  const categorySections = useMemo(() => {
    const sections: Array<{
      id: string;
      labelAr: string;
      labelEn: string;
      services: ServiceRecord[];
      bundles: any[];
    }> = [];

    // Real tenant categories
    (tenantCategories || []).forEach(cat => {
      const catServices = filteredServices.filter(s => s.tenantServiceCategoryId === cat.id);
      const catBundles = filteredBundles.filter(b => b.tenantServiceCategoryId === cat.id);

      const matchesFilter = currentServiceCategory === 'all' || currentServiceCategory === cat.id;
      if (matchesFilter && (catServices.length > 0 || catBundles.length > 0 || currentServiceCategory === cat.id)) {
        sections.push({
          id: cat.id,
          labelAr: cat.name_ar || cat.nameAr || 'فئة',
          labelEn: cat.name_en || cat.nameEn || 'Category',
          services: catServices,
          bundles: catBundles
        });
      }
    });

    // Uncategorized items (pinned last)
    const uncategorizedServices = filteredServices.filter(s => !s.tenantServiceCategoryId);
    const uncategorizedBundles = filteredBundles.filter(b => !b.tenantServiceCategoryId);

    const matchesUncategorized = currentServiceCategory === 'all' || currentServiceCategory === 'uncategorized';
    if (matchesUncategorized && (uncategorizedServices.length > 0 || uncategorizedBundles.length > 0 || currentServiceCategory === 'uncategorized')) {
      sections.push({
        id: 'uncategorized',
        labelAr: 'غير مصنف',
        labelEn: 'Uncategorized',
        services: uncategorizedServices,
        bundles: uncategorizedBundles
      });
    }

    return sections;
  }, [tenantCategories, filteredServices, filteredBundles, currentServiceCategory]);

  const totalMatchingItems = useMemo(() => {
    return categorySections.reduce((acc, s) => acc + s.services.length + s.bundles.length, 0);
  }, [categorySections]);

  const handleAddBundleClick = (bundleId: string) => {
    if (onAddBundle) {
      onAddBundle(bundleId);
    } else if (onAddPackage) {
      onAddPackage(bundleId);
    }
  };

  return (
    <div className="flex flex-col h-full animate-fadeIn min-h-[60vh]">
      <section className="flex flex-col flex-1 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm h-full max-w-4xl mx-auto w-full">
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary/70">
            {isRtl ? 'كتالوج الخدمات والباقات' : 'Services & Bundles Catalog'}
          </p>
          <h4 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
            {isRtl ? 'اختيار الخدمات والباقات للموعد' : 'Select Services & Bundles for Appointment'}
          </h4>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 sm:px-6 space-y-6">
          {bookingRecoveryMode !== 'chain' && (
            <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 shadow-sm">
              <p className="font-bold">
                {bookingRecoveryMode === 'modify_professionals'
                  ? (isRtl ? 'وضع تعديل المختصين' : 'Modify professionals mode')
                  : (isRtl ? 'وضع الحجز المنفصل' : 'Separate services mode')}
              </p>
              <p className="mt-1 leading-5 text-amber-800/90">
                {bookingRecoveryMode === 'modify_professionals'
                  ? (isRtl
                    ? 'حافظ على الخدمات والأوقات الحالية ثم عدّل المختصين المتاحين قبل المتابعة.'
                    : 'Keep the current services and times, then adjust the available professionals before continuing.')
                  : (isRtl
                    ? 'سيتم التحقق من كل خدمة بشكل مستقل، وسيتم إنشاء مواعيد منفصلة عند التأكيد النهائي.'
                    : 'Each service will be validated independently and separate appointments will be created on the final confirmation.')}
              </p>
            </div>
          )}

          {/* Search Input */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
              placeholder={isRtl ? 'ابحث عن خدمة أو باقة بالاسم أو الوصف...' : 'Search for a service or bundle...'}
              className="w-full rounded-[20px] border border-slate-300 bg-white py-3.5 pl-11 pr-4 text-sm text-slate-900 focus:border-transparent focus:ring-2 focus:ring-primary shadow-sm"
            />
          </div>

          {/* Tenant Category Navigation Pills */}
          <div className="flex flex-wrap gap-2">
            {serviceCategoryTabs.map((tab) => {
              const active = currentServiceCategory === tab.key || (!currentServiceCategory && tab.key === 'all');
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setCurrentServiceCategory(tab.key)}
                  className={`rounded-full border px-4 py-1.5 text-xs font-bold transition cursor-pointer ${
                    active
                      ? 'border-primary bg-primary text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                  }`}
                >
                  {isRtl ? tab.labelAr : tab.labelEn}
                </button>
              );
            })}
          </div>

          {/* Staged Bundles Section: Displays any active bundles added to the appointment queue */}
          {(() => {
            const pkgCartItems = stagedServices.filter(s => s.itemType === 'package');
            if (pkgCartItems.length === 0) return null;

            const pkgGroups = pkgCartItems.reduce((acc, curr) => {
              const groupKey = curr.packageInstanceId || curr.packageId!;
              if (!acc[groupKey]) acc[groupKey] = [];
              acc[groupKey].push(curr);
              return acc;
            }, {} as Record<string, typeof stagedServices>);

            return (
              <div className="space-y-4 rounded-2xl bg-purple-50/40 border border-purple-200/80 p-4">
                <div className="flex items-center justify-between border-b border-purple-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <PackageIcon className="w-4 h-4 text-purple-700" />
                    <h3 className="text-sm font-black text-purple-900">
                      {isRtl ? 'الباقات المختارة في الجلسة' : 'Selected Bundles in Session'}
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                    {Object.keys(pkgGroups).length} {isRtl ? 'باقات' : 'bundles'}
                  </span>
                </div>

                {Object.entries(pkgGroups).map(([instanceId, items]) => {
                  const pkgId = items[0].packageId;
                  const pkg = effectiveBundles.find(p => p.id === pkgId);
                  const pkgName = pkg ? (isRtl ? pkg.name_ar || pkg.nameAr : pkg.name_en || pkg.nameEn) : 'Bundle';
                  const pkgPrice = pkg ? pkg.totalPrice : 0;
                  const pkgDuration = pkg ? pkg.totalDuration : 0;

                  return (
                    <div key={instanceId} className="bg-white border border-purple-200 rounded-xl p-4 shadow-2xs relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-full h-1 bg-purple-600" />
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded uppercase">
                              BUNDLE
                            </span>
                            <h4 className="font-bold text-slate-900 text-base">{pkgName}</h4>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 font-semibold">
                            {pkgPrice} {isRtl ? 'ر.س' : 'SAR'} • {pkgDuration} {isRtl ? 'دقيقة إجمالية' : 'min total'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (onRemoveService) {
                              const indicesToRemove: number[] = [];
                              stagedServices.forEach((s, idx) => {
                                if ((s.packageInstanceId || s.packageId) === instanceId) {
                                  indicesToRemove.push(idx);
                                }
                              });
                              indicesToRemove.reverse().forEach(idx => onRemoveService(idx));
                            }
                          }}
                          className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition cursor-pointer"
                          title={isRtl ? 'إزالة الباقة' : 'Remove Bundle'}
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-2 mt-3 border-t border-slate-100 pt-3">
                        <h5 className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-purple-600" />
                          <span>{isRtl ? 'خطوات التنفيذ للمختصين والمواعيد:' : 'Execution Steps & Staff Assignment:'}</span>
                        </h5>
                        {items.map((item) => {
                          const srv = canonicalServices.find(s => s.id === item.serviceId);
                          if (!srv) return null;
                          return (
                            <AppointmentServiceRow
                              tenantId={tenantId}
                              tenantTimezone={tenantTimezone}
                              selectedDate={selectedDate}
                              key={item.id}
                              service={srv}
                              variant={srv.variants?.find((v: any) => v.id === item.variantId) || null}
                              isRtl={isRtl}
                              boardStartHour={boardStartHour}
                              slotMinutes={slotMinutes}
                              forceExpanded={true}
                              availableStylists={availableStylists}
                              stagedItem={item}
                              onAddService={() => {}}
                              onUpdateService={onUpdateService}
                              onRemoveService={() => {}}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Unified Catalog Sections */}
          {totalMatchingItems === 0 ? (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
              {serviceSearch.trim()
                ? (isRtl ? 'لا توجد خدمات أو باقات مطابقة للبحث الحالي.' : 'No services or bundles match the search.')
                : (isRtl ? 'لا توجد خدمات أو باقات ضمن هذه الفئة.' : 'No services or bundles in this category.')}
            </div>
          ) : (
            <div className="space-y-8 pb-4">
              {categorySections.map((section) => {
                const totalSectionItems = section.services.length + section.bundles.length;
                if (totalSectionItems === 0) return null;

                return (
                  <div key={`sec-${section.id}`} data-appointment-category={section.id} className="space-y-4">
                    {/* Category Heading */}
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
                        <h3 className="text-base font-bold tracking-tight text-slate-900">
                          {isRtl ? section.labelAr : section.labelEn}
                        </h3>
                      </div>
                      <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                        {section.services.length} {isRtl ? 'خدمات' : 'services'} • {section.bundles.length} {isRtl ? 'باقات' : 'bundles'}
                      </span>
                    </div>

                    {/* Category Bundles (if any) */}
                    {section.bundles.length > 0 && (
                      <div className="space-y-3">
                        <span className="text-[11px] font-black uppercase text-purple-700 tracking-wider flex items-center gap-1.5">
                          <PackageIcon className="w-3.5 h-3.5" />
                          <span>{isRtl ? 'باقات الفئة' : 'Category Bundles'}</span>
                        </span>

                        <div className="grid grid-cols-1 gap-3">
                          {section.bundles.map((bundle) => {
                            const isParallel = bundle.scheduleType === 'parallel';
                            const bName = isRtl ? bundle.name_ar || bundle.nameAr : bundle.name_en || bundle.nameEn;
                            const bDesc = isRtl ? bundle.description_ar || bundle.descriptionAr : bundle.description_en || bundle.descriptionEn;

                            return (
                              <div
                                key={`bundle-${bundle.id}`}
                                data-bundle-id={bundle.id}
                                className="rounded-2xl border border-purple-200/90 bg-purple-50/20 p-4 hover:border-purple-300 hover:shadow-sm transition-all"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div className="flex items-start gap-3 min-w-0">
                                    <div className="w-12 h-12 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center shrink-0 text-purple-600 overflow-hidden">
                                      {bundle.image ? (
                                        <img src={bundle.image} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <PackageIcon className="w-6 h-6 text-purple-600" />
                                      )}
                                    </div>
                                    <div className="min-w-0 space-y-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[9px] font-black bg-purple-100 text-purple-800 border border-purple-200 px-1.5 py-0.5 rounded uppercase">
                                          BUNDLE
                                        </span>
                                        {isParallel && (
                                          <span className="text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
                                            {isRtl ? 'متزامن (قيد التطوير)' : 'Parallel (Soon)'}
                                          </span>
                                        )}
                                        <h4 className="font-bold text-slate-900 text-sm truncate">
                                          {bName}
                                        </h4>
                                      </div>
                                      <p className="text-xs text-slate-500 line-clamp-1">
                                        {bDesc || (isRtl ? 'باقة مجمعة من الخدمات المميزة' : 'Combined bundle of premium services')}
                                      </p>
                                      <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500">
                                        <span className="flex items-center gap-1">
                                          <Clock className="w-3 h-3 text-purple-500" />
                                          <span>{bundle.totalDuration} {isRtl ? 'دقيقة' : 'min'}</span>
                                        </span>
                                        <span>•</span>
                                        <span>{bundle.items?.length || 0} {isRtl ? 'خدمات مدمجة' : 'included services'}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-purple-100">
                                    <div className="text-right rtl:text-left">
                                      <span className="text-[10px] text-purple-600 font-bold block">
                                        {isRtl ? 'سعر الباقة الإجمالي' : 'Bundle Price'}
                                      </span>
                                      <span className="text-base font-black text-slate-900 font-mono">
                                        {bundle.totalPrice} <span className="text-[10px]">{isRtl ? 'ر.س' : 'SAR'}</span>
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleAddBundleClick(bundle.id)}
                                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition shadow-sm cursor-pointer flex items-center gap-1.5"
                                    >
                                      <PlusCircle className="w-3.5 h-3.5" />
                                      <span>{isRtl ? 'إضافة الباقة' : 'Add Bundle'}</span>
                                    </button>
                                  </div>
                                </div>

                                {/* Included Services summary chips */}
                                {bundle.items && bundle.items.length > 0 && (
                                  <div className="mt-3 pt-2.5 border-t border-purple-100/80 flex flex-wrap items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-purple-700 ml-1 rtl:mr-1">
                                      {isRtl ? 'الخدمات المضمنة:' : 'Included:'}
                                    </span>
                                    {bundle.items.map((item: any, idx: number) => {
                                      const srv = canonicalServices.find(s => s.id === item.serviceId);
                                      const srvName = srv
                                        ? (isRtl ? srv.nameAr || srv.name_ar : srv.nameEn || srv.name_en)
                                        : (isRtl ? item.service?.name_ar : item.service?.name_en) || 'Service';
                                      return (
                                        <span key={`${item.id || idx}`} className="text-[10px] bg-white border border-purple-200/70 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                                          {idx + 1}. {srvName}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Category Services */}
                    {section.services.length > 0 && (
                      <div className="space-y-3">
                        {section.bundles.length > 0 && (
                          <span className="text-[11px] font-black uppercase text-primary tracking-wider block">
                            {isRtl ? 'خدمات الفئة' : 'Category Services'}
                          </span>
                        )}

                        <div className="space-y-3">
                          {section.services.map((service) => {
                            const variants = Array.isArray(service.variants) && service.variants.length > 0 ? service.variants : [null];

                            return variants.map((variant) => {
                              const stagedItem = variant
                                ? stagedServices.find((s) => s.serviceId === service.id && s.variantId === variant.id && s.itemType !== 'package')
                                : stagedServices.find((s) => s.serviceId === service.id && !s.variantId && s.itemType !== 'package');

                              return (
                                <AppointmentServiceRow
                                  tenantId={tenantId}
                                  tenantTimezone={tenantTimezone}
                                  selectedDate={selectedDate}
                                  key={variant ? `${service.id}-${variant.id}` : service.id}
                                  service={service}
                                  variant={variant}
                                  isRtl={isRtl}
                                  boardStartHour={boardStartHour}
                                  slotMinutes={slotMinutes}
                                  forceExpanded={forceExpandAll}
                                  availableStylists={availableStylists}
                                  stagedItem={stagedItem || null}
                                  onAddService={onAddService}
                                  onUpdateService={onUpdateService}
                                  onRemoveService={(id) => {
                                    const idx = stagedServices.findIndex(s => s.id === id);
                                    if (idx !== -1) onRemoveService(idx);
                                  }}
                                />
                              );
                            });
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
