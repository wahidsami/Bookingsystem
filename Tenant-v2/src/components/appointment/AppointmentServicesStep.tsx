import React, { useMemo, useState } from 'react';
import { Search, Package as PackageIcon, Clock, DollarSign } from 'lucide-react';
import { type ServiceRecord, type ServiceVariantRecord } from '../../lib/serviceContract';
import AppointmentServiceRow from './AppointmentServiceRow';
export interface StagedService {
  id: string;
  serviceId: string;
  variantId?: string;
  serviceCategory?: string;
  staffId: string;
  startTime: number;
  duration: number;
  discountType: 'none' | 'flat' | 'percent';
  discountValue: number;
  notes: string;
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
  bookingRecoveryMode?: 'chain' | 'modify_professionals' | 'separate_services';
  forceExpandAll?: boolean;
  canonicalServices: ServiceRecord[];
  servicePackages?: any[];
  stagedServices: StagedService[];
  availableStylists: any[];
  serviceCategoryTabs: { key: string; labelAr: string; labelEn: string }[];
  currentServiceCategory: string;
  setCurrentServiceCategory: (key: string) => void;
  serviceSearch: string;
  setServiceSearch: (val: string) => void;
  onAddService: (service: ServiceRecord, variant?: ServiceVariantRecord | null) => void;
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
  bookingRecoveryMode = 'chain',
  forceExpandAll = false,
  canonicalServices,
  servicePackages = [],
  stagedServices,
  availableStylists,
  serviceCategoryTabs,
  currentServiceCategory,
  setCurrentServiceCategory,
  serviceSearch,
  setServiceSearch,
  onAddService,
  onAddPackage,
  onUpdateService,
  onRemoveService,
}: AppointmentServicesStepProps) {

  const [activeTab, setActiveTab] = useState<'services' | 'packages'>('services');

  const filteredServices = useMemo(() => {
    let filtered = canonicalServices;
    if (currentServiceCategory && currentServiceCategory !== 'all') {
      filtered = filtered.filter(s => {
        const cat = s.category || s.categoryEn || s.categoryAr || '';
        return cat.toLowerCase() === currentServiceCategory.toLowerCase();
      });
    }
    const query = serviceSearch.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter(s => {
        const nameEn = `${s.nameEn || ''}`.toLowerCase();
        const nameAr = `${s.nameAr || ''}`.toLowerCase();
        const cat = `${s.category || ''}`.toLowerCase();
        const descriptionEn = `${s.descriptionEn || ''}`.toLowerCase();
        const descriptionAr = `${s.descriptionAr || ''}`.toLowerCase();
        const variants = Array.isArray(s.variants) ? s.variants : [];
        const variantMatch = variants.some((variant) => {
          const variantNameEn = `${variant?.nameEn || variant?.name_en || ''}`.toLowerCase();
          const variantNameAr = `${variant?.nameAr || variant?.name_ar || ''}`.toLowerCase();
          const variantDescriptionEn = `${variant?.descriptionEn || variant?.description_en || variant?.description || ''}`.toLowerCase();
          const variantDescriptionAr = `${variant?.descriptionAr || variant?.description_ar || variant?.description || ''}`.toLowerCase();
          return (
            variantNameEn.includes(query)
            || variantNameAr.includes(query)
            || variantDescriptionEn.includes(query)
            || variantDescriptionAr.includes(query)
          );
        });
        return nameEn.includes(query) || nameAr.includes(query) || descriptionEn.includes(query) || descriptionAr.includes(query) || cat.includes(query) || variantMatch;
      });
    }
    return filtered;
  }, [canonicalServices, currentServiceCategory, serviceSearch]);

  const groupedServices = useMemo(() => {
    const groups: Record<string, Array<{ service: ServiceRecord; variant: ServiceVariantRecord | null }>> = {};

    filteredServices.forEach((service) => {
      const cat = (isRtl ? service.categoryAr || service.category : service.categoryEn || service.category) || (isRtl ? 'أخرى' : 'Other');
      if (!groups[cat]) {
        groups[cat] = [];
      }

      groups[cat].push({ service, variant: null });

      const variants = Array.isArray(service.variants) ? service.variants : [];
      variants.forEach((variant) => {
        groups[cat].push({ service, variant });
      });
    });

    return groups;
  }, [filteredServices, isRtl]);

  return (
    <div className="flex flex-col h-full animate-fadeIn min-h-[60vh]">
      <section className="flex flex-col flex-1 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm h-full max-w-4xl mx-auto w-full">
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary/70">
            {isRtl ? 'تصفح الخدمات' : 'Service Browser'}
          </p>
          <h4 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
            {isRtl ? 'قائمة الخدمات' : 'Services Catalog'}
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

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
              placeholder={isRtl ? 'ابحث عن الخدمة...' : 'Search by service name...'}
              className="w-full rounded-[20px] border border-slate-300 bg-white py-3.5 pl-11 pr-4 text-sm text-slate-900 focus:border-transparent focus:ring-2 focus:ring-primary shadow-sm"
            />
          </div>

          <div className="flex bg-slate-100 rounded-xl p-1 shrink-0 mb-4">
            <button
              onClick={() => setActiveTab('services')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${
                activeTab === 'services'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {isRtl ? 'الخدمات' : 'Services'}
            </button>
            <button
              onClick={() => setActiveTab('packages')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${
                activeTab === 'packages'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {isRtl ? 'الباقات' : 'Packages'}
            </button>
          </div>

          {activeTab === 'services' && (
            <div className="flex flex-wrap gap-2">
            {serviceCategoryTabs.map((tab) => {
              const active = currentServiceCategory === tab.key || (!currentServiceCategory && tab.key === 'all');
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setCurrentServiceCategory(tab.key)}
                  className={`rounded-full border px-5 py-2 text-sm font-semibold transition ${
                    active
                      ? 'border-primary bg-primary/5 text-primary shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                  }`}
                >
                  {isRtl ? tab.labelAr : tab.labelEn}
                </button>
              );
            })}
          </div>
          )}

          {activeTab === 'packages' && (
            <div className="space-y-4 pb-4">
              {servicePackages.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {servicePackages.map(pkg => (
                    <div key={pkg.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <PackageIcon className="w-5 h-5 text-primary" />
                          <h4 className="font-bold text-slate-900">{isRtl ? pkg.name_ar : pkg.name_en}</h4>
                        </div>
                        <div className="flex gap-4 text-xs font-semibold text-slate-500 mb-4">
                          <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> {pkg.totalPrice} {isRtl ? 'ر.س' : 'SAR'}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {pkg.totalDuration} {isRtl ? 'دقيقة' : 'min'}</span>
                        </div>
                        <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside mb-4 pl-1">
                          {(pkg.items || []).map((item: any) => {
                            const srv = canonicalServices.find(s => s.id === item.serviceId);
                            return srv ? <li key={item.id} className="truncate">{isRtl ? srv.nameAr || srv.name_ar : srv.nameEn || srv.name_en}</li> : null;
                          })}
                        </ul>
                      </div>
                      <button
                        onClick={() => onAddPackage && onAddPackage(pkg.id)}
                        className="w-full py-2 bg-primary/10 text-primary hover:bg-primary/20 font-bold text-sm rounded-xl transition"
                      >
                        {isRtl ? 'إضافة الباقة' : 'Add Package'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                  {isRtl ? 'لا توجد باقات متاحة.' : 'No packages available.'}
                </div>
              )}
            </div>
          )}

          {activeTab === 'services' && (
            <div className="space-y-6 pb-4">
            {Object.keys(groupedServices).length > 0 ? (
              Object.keys(groupedServices).map((categoryName) => (
                <div key={categoryName} className="space-y-3">
                  <h3 className="text-xl font-medium tracking-tight text-slate-900 capitalize px-1 pb-1 border-b border-slate-100">
                    {categoryName}
                  </h3>
                  <div className="space-y-3">
                    {groupedServices[categoryName].map(({ service, variant }) => {
                      const stagedItem = variant
                        ? stagedServices.find((s) => s.serviceId === service.id && s.variantId === variant.id)
                        : stagedServices.find((s) => s.serviceId === service.id && !s.variantId);

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
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                {serviceSearch.trim()
                  ? (isRtl ? 'لا توجد خدمات مطابقة للبحث الحالي.' : 'No services match the current search.')
                  : (isRtl ? 'لا توجد خدمات ضمن هذه الفئة.' : 'No services available in this category.')}
              </div>
            )}
          </div>
          )}
        </div>
      </section>
    </div>
  );
}
