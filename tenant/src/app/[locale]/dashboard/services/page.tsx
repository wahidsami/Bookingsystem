"use client";

import { useState, useEffect, useMemo } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { getImageUrl, tenantApi } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { Currency } from "@/components/Currency";
import Link from "next/link";
import { useAppDialog } from "@/components/AppDialogProvider";
import {
  ArrowPathIcon,
  PhotoIcon,
  PencilSquareIcon,
  PlusIcon,
  PowerIcon,
  TrashIcon,
  UsersIcon
} from "@heroicons/react/24/outline";

interface Employee {
  id: string;
  name: string;
  photo?: string;
  isActive: boolean;
}

interface Service {
  id: string;
  name_en: string;
  name_ar: string;
  description_en?: string;
  description_ar?: string;
  image?: string;
  targetGender?: 'all' | 'female' | 'male';
  rawPrice: number;
  taxRate: number;
  commissionRate: number;
  finalPrice: number;
  category: string;
  duration: number;
  includes?: string[];
  hasOffer: boolean;
  offerDetails?: string;
  hasGift: boolean;
  giftType?: 'text' | 'product';
  giftDetails?: string;
  availableInCenter?: boolean;
  availableHomeVisit?: boolean;
  isActive: boolean;
  employees?: Employee[];
  createdAt: string;
}

type ServiceFilterMode =
  | "all"
  | "active"
  | "inactive"
  | "female"
  | "male"
  | "all-genders"
  | "center"
  | "home-visit"
  | "has-offer"
  | "has-gift"
  | "az"
  | "za"
  | "newest"
  | "oldest";

export default function ServicesPage() {
  const dialog = useAppDialog();
  const t = useTranslations("Services");
  const params = useParams();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';

  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState<ServiceFilterMode>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [error, setError] = useState("");
  const [limits, setLimits] = useState<any>(null);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      setLoading(true);
      setError("");
      const [response, limitsData] = await Promise.all([
        tenantApi.getServices(),
        tenantApi.getSubscriptionLimits().catch(() => null)
      ]);

      if (limitsData?.services) {
        setLimits(limitsData.services);
      }

      // Handle different response structures
      const data = response.data || response;

      if (data.success !== false) {
        // Response is successful (either success: true or success is undefined but no error)
        const servicesList = data.services || data.data?.services || [];
        setServices(servicesList);

        if (servicesList.length === 0) {
          console.log("No services found. Response:", response);
        }
      } else {
        setError(data.message || t("loadError"));
        setServices([]);
      }
    } catch (err: any) {
      console.error("Failed to load services:", err);
      console.error("Error details:", {
        message: err.message,
        stack: err.stack,
        response: err.response
      });
      setError(err.message || t("loadError"));
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const serviceName = locale === 'ar' ? name : name;
    if (!(await dialog.confirm(locale === 'ar'
      ? `هل أنت متأكد من حذف الخدمة "${serviceName}"؟`
      : `Are you sure you want to delete service "${serviceName}"?`))) {
      return;
    }

    try {
      const response = await tenantApi.deleteService(id);
      if (response.success) {
        await dialog.alert({
          title: locale === 'ar' ? 'تم الحذف' : 'Deleted',
          message: locale === 'ar' ? `تم حذف الخدمة "${serviceName}" بنجاح.` : `Service "${serviceName}" was deleted successfully.`,
          tone: "success"
        });
        await loadServices();
      } else {
        await dialog.alert({
          title: locale === 'ar' ? 'تعذر الحذف' : 'Delete failed',
          message: response.message || t("deleteError"),
          tone: "danger"
        });
      }
    } catch (err: any) {
      console.error("Failed to delete service:", err);
      await dialog.alert({
        title: locale === 'ar' ? 'تعذر الحذف' : 'Delete failed',
        message: err.message || t("deleteError"),
        tone: "danger"
      });
    }
  };

  const handleToggleActive = async (service: Service) => {
    const nextIsActive = !service.isActive;
    const confirmed = await dialog.confirm(
      locale === "ar"
        ? `هل تريد ${nextIsActive ? "تفعيل" : "إيقاف"} الخدمة "${service.name_ar || service.name_en}"؟`
        : `Do you want to ${nextIsActive ? "activate" : "deactivate"} service "${service.name_en || service.name_ar}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const submitData = new FormData();
      submitData.append("isActive", nextIsActive.toString());
      submitData.append("finalPrice", String(service.finalPrice ?? 0));

      const response = await tenantApi.updateService(service.id, submitData);
      if (response.success) {
        await dialog.alert({
          title: locale === "ar" ? "تم التحديث" : "Updated",
          message: locale === "ar"
            ? `تم ${nextIsActive ? "تفعيل" : "إيقاف"} الخدمة بنجاح.`
            : `Service was ${nextIsActive ? "activated" : "deactivated"} successfully.`,
          tone: "success"
        });
        await loadServices();
      } else {
        await dialog.alert({
          title: locale === "ar" ? "فشل التحديث" : "Update failed",
          message: response.message || t("updateError"),
          tone: "danger"
        });
      }
    } catch (err: any) {
      console.error("Failed to update service status:", err);
      await dialog.alert({
        title: locale === "ar" ? "فشل التحديث" : "Update failed",
        message: err.message || t("updateError"),
        tone: "danger"
      });
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} ${t("minutes")}`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getTargetAudienceLabel = (targetGender?: string) => {
    switch (targetGender) {
      case 'female':
        return t("femaleOnly");
      case 'male':
        return t("maleOnly");
      default:
        return t("allGenders");
    }
  };

  const filterOptions = useMemo(() => ([
    { value: "all", label: locale === "ar" ? "كل الخدمات" : "All services" },
    { value: "active", label: t("activeOnly") },
    { value: "inactive", label: t("inactiveOnly") },
    { value: "all-genders", label: t("allGenders") },
    { value: "female", label: t("femaleOnly") },
    { value: "male", label: t("maleOnly") },
    { value: "center", label: t("availableInCenter") },
    { value: "home-visit", label: t("availableHomeVisit") },
    { value: "has-offer", label: t("hasOfferOnly") },
    { value: "has-gift", label: t("hasGiftOnly") },
    { value: "az", label: locale === "ar" ? "ترتيب أ-ي" : "Sort A-Z" },
    { value: "za", label: locale === "ar" ? "ترتيب ي-أ" : "Sort Z-A" },
    { value: "newest", label: locale === "ar" ? "الأحدث" : "Newest" },
    { value: "oldest", label: locale === "ar" ? "الأقدم" : "Oldest" }
  ]), [locale, t]);

  const servicesAfterGlobalFilters = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = services.filter((service) => {
      const serviceName = `${service.name_en || ""} ${service.name_ar || ""} ${service.description_en || ""} ${service.description_ar || ""}`.toLowerCase();
      if (term && !serviceName.includes(term)) return false;

      switch (filterMode) {
        case "active":
          return service.isActive;
        case "inactive":
          return !service.isActive;
        case "female":
          return service.targetGender === "female";
        case "male":
          return service.targetGender === "male";
        case "all-genders":
          return !service.targetGender || service.targetGender === "all";
        case "center":
          return service.availableInCenter !== false;
        case "home-visit":
          return service.availableHomeVisit === true;
        case "has-offer":
          return service.hasOffer;
        case "has-gift":
          return service.hasGift;
        default:
          return true;
      }
    });

    const sorted = [...filtered];
    switch (filterMode) {
      case "az":
        sorted.sort((a, b) => (locale === "ar" ? (a.name_ar || "").localeCompare(b.name_ar || "") : (a.name_en || "").localeCompare(b.name_en || "")));
        break;
      case "za":
        sorted.sort((a, b) => (locale === "ar" ? (b.name_ar || "").localeCompare(a.name_ar || "") : (b.name_en || "").localeCompare(a.name_en || "")));
        break;
      case "newest":
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "oldest":
        sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      default:
        break;
    }

    return sorted;
  }, [filterMode, locale, searchTerm, services]);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    servicesAfterGlobalFilters.forEach((service) => {
      const category = (service.category || "").trim() || t("uncategorized");
      map.set(category, (map.get(category) || 0) + 1);
    });

    const entries = Array.from(map.entries()).sort((a, b) => {
      if (a[0] === t("uncategorized")) return 1;
      if (b[0] === t("uncategorized")) return -1;
      return a[0].localeCompare(b[0]);
    });

    return [
      { key: "all", name: t("allCategories"), count: servicesAfterGlobalFilters.length },
      ...entries.map(([name, count]) => ({ key: name, name, count }))
    ];
  }, [servicesAfterGlobalFilters, t]);

  const visibleServices = useMemo(() => {
    if (selectedCategory === "all") {
      return servicesAfterGlobalFilters;
    }
    return servicesAfterGlobalFilters.filter((service) => ((service.category || "").trim() || t("uncategorized")) === selectedCategory);
  }, [selectedCategory, servicesAfterGlobalFilters, t]);

  const currentCategoryLabel = useMemo(() => {
    return categories.find((category) => category.key === selectedCategory)?.name || t("allCategories");
  }, [categories, selectedCategory, t]);

  return (
    <TenantLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white shadow-[0_28px_100px_rgba(15,23,42,0.3)] sm:p-6">
          <div className={`flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between ${isRTL ? 'lg:flex-row-reverse' : ''}`}>
            <div className="max-w-3xl space-y-3" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                {locale === 'ar' ? 'واجهة الخدمات' : 'Services shell'}
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h2>
              <p className="max-w-2xl text-sm leading-6 text-slate-300">{t("subtitle")}</p>
            </div>
            {limits && (
              <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 shadow-[0_18px_60px_rgba(15,23,42,0.18)] backdrop-blur">
                <div className="text-slate-400">{locale === 'ar' ? 'الحد المسموح' : 'Limit'}</div>
                <div className={`text-xl font-semibold ${!limits.allowed ? 'text-red-300' : 'text-white'}`}>
                  {limits.current} / {limits.limit}
                </div>
              </div>
            )}
          </div>

          <div className={`mt-5 flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur lg:flex-row lg:items-center lg:justify-between ${isRTL ? 'lg:flex-row-reverse' : ''}`}>
            <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder={t("searchPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/20"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                />
              </div>
              <div className="w-full lg:w-72">
                <select
                  value={filterMode}
                  onChange={(e) => setFilterMode(e.target.value as ServiceFilterMode)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/20"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {filterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Link
              href={limits && !limits.allowed ? '#' : `/${locale}/dashboard/services/new`}
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:from-cyan-400 hover:to-blue-400 ${limits && !limits.allowed ? 'pointer-events-none opacity-50' : ''}`}
              onClick={(e) => {
                if (limits && !limits.allowed) {
                  e.preventDefault();
                  dialog.alert({
                    title: locale === 'ar' ? 'الحد وصل' : 'Limit reached',
                    message: locale === 'ar' ? 'تم الوصول للحد الأقصى في الباقة الحالية.' : 'You have reached your current package limit.',
                    tone: 'danger'
                  });
                }
              }}
            >
              <PlusIcon className="h-5 w-5" />
              <span>{t("addService")}</span>
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-slate-200 shadow-[0_18px_60px_rgba(15,23,42,0.18)] backdrop-blur">
              <ArrowPathIcon className="h-5 w-5 animate-spin text-cyan-300" />
              <p className="text-sm text-slate-300">{t("loading")}</p>
            </div>
          </div>
        ) : services.length === 0 ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/5 py-16 text-center text-slate-100 shadow-[0_18px_60px_rgba(15,23,42,0.18)] backdrop-blur">
            <PhotoIcon className="mb-4 h-14 w-14 text-slate-500" />
            <h3 className="text-xl font-semibold text-white">{t("noServices")}</h3>
            <p className="mt-2 max-w-md text-sm text-slate-300">{t("noServicesDesc")}</p>
            <Link href={`/${locale}/dashboard/services/new`} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:from-cyan-400 hover:to-blue-400">
              <PlusIcon className="h-5 w-5" />
              <span>{t("addFirstService")}</span>
            </Link>
          </div>
        ) : (
          <div className={`grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] ${isRTL ? 'lg:[direction:rtl]' : ''}`}>
            <aside className="rounded-[1.75rem] border border-white/10 bg-white/5 p-4 text-slate-100 shadow-[0_18px_60px_rgba(15,23,42,0.18)] backdrop-blur">
              <div className="mb-4 flex items-center justify-between" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                <h3 className="text-lg font-bold text-white">{locale === 'ar' ? 'الفئات' : 'Categories'}</h3>
                <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                  {categories.length - 1}
                </span>
              </div>
              <div className="space-y-2">
                {categories.map((category) => {
                  const active = selectedCategory === category.key;
                  return (
                    <button
                      key={category.key}
                      type="button"
                      onClick={() => setSelectedCategory(category.key)}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                        active
                          ? 'border-cyan-300/40 bg-cyan-400/10 text-cyan-100 shadow-[0_10px_30px_rgba(6,182,212,0.12)]'
                          : 'border-white/10 bg-slate-950/40 text-slate-200 hover:border-cyan-300/30 hover:bg-white/10'
                      }`}
                      style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                    >
                      <span className="font-medium">{category.name}</span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${active ? 'bg-cyan-400 text-slate-950' : 'bg-white/10 text-slate-200'}`}>
                        {category.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="rounded-[1.75rem] border border-white/10 bg-white/5 p-4 text-slate-100 shadow-[0_18px_60px_rgba(15,23,42,0.18)] backdrop-blur">
              <div className="mb-4 flex items-center justify-between gap-4" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  <h3 className="text-xl font-bold text-white">{currentCategoryLabel}</h3>
                  <p className="text-sm text-slate-300">
                    {visibleServices.length} {locale === 'ar' ? 'خدمة' : 'services'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => loadServices()}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-cyan-300/40 hover:bg-white/10"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  <span>{locale === 'ar' ? 'تحديث' : 'Refresh'}</span>
                </button>
              </div>

              {visibleServices.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 py-16 text-center">
                  <PhotoIcon className="h-14 w-14 text-slate-500" />
                  <h4 className="mt-4 text-lg font-semibold text-white">{t("noServices")}</h4>
                  <p className="mt-2 text-sm text-slate-300">{t("noServicesDesc")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleServices.map((service) => (
                    <div
                      key={service.id}
                      className="rounded-[1.75rem] border border-white/10 bg-slate-950/45 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.14)] transition hover:border-cyan-300/20 hover:shadow-[0_18px_60px_rgba(15,23,42,0.22)]"
                    >
                      <div className={`flex flex-col gap-4 xl:flex-row xl:items-center ${isRTL ? 'xl:flex-row-reverse' : ''}`}>
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-white/10">
                            {service.image ? (
                              <img
                                src={getImageUrl(service.image)}
                                alt={locale === 'ar' ? service.name_ar : service.name_en}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <PhotoIcon className="h-8 w-8 text-slate-500" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h4 className="truncate text-lg font-bold text-white">
                                  {locale === 'ar' ? service.name_ar : service.name_en}
                                </h4>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-300">
                                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-medium">
                                    ⏱ {formatDuration(service.duration)}
                                  </span>
                                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-medium">
                                    <UsersIcon className={`${isRTL ? 'ml-1' : 'mr-1'} h-4 w-4`} />
                                    {service.employees?.length || 0} {t("performers")}
                                  </span>
                                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-medium">
                                    {getTargetAudienceLabel(service.targetGender)}
                                  </span>
                                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-semibold ${service.isActive ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/10 text-slate-300'}`}>
                                    {service.isActive ? t("active") : t("inactive")}
                                  </span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                                  <span>{locale === 'ar' ? 'الفئة' : 'Category'}: {(service.category || "").trim() || t("uncategorized")}</span>
                                  {service.hasOffer && <span>• {t("offer")}</span>}
                                  {service.hasGift && <span>• {t("gift")}</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center justify-between gap-4 xl:flex-col xl:items-end">
                          <div className="text-right">
                            <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
                              {t("finalPrice")}
                            </div>
                            <div className="text-2xl font-bold text-primary">
                              <Currency amount={service.finalPrice} />
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Link
                              href={`/${locale}/dashboard/services/${service.id}`}
                              title={t("edit")}
                              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:border-cyan-300/40 hover:text-cyan-200"
                            >
                              <PencilSquareIcon className="h-5 w-5" />
                            </Link>
                            <button
                              type="button"
                              title={service.isActive ? t("deactivate") : t("activate")}
                              onClick={() => handleToggleActive(service)}
                              className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
                                service.isActive
                                  ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15'
                                  : 'border-white/10 bg-white/5 text-slate-200 hover:border-cyan-300/40 hover:text-cyan-200'
                              }`}
                            >
                              <PowerIcon className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              title={t("delete")}
                              onClick={() => handleDelete(service.id, locale === 'ar' ? service.name_ar : service.name_en)}
                              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-red-400/30 bg-red-500/10 text-red-200 transition hover:bg-red-500/15"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </TenantLayout>
  );
}

