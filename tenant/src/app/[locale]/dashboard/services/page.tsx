"use client";

import { useState, useEffect } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { tenantApi } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Currency } from "@/components/Currency";
import Link from "next/link";

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
  isActive: boolean;
  employees?: Employee[];
  createdAt: string;
}

const CATEGORIES = [
  "Hair Services",
  "Facial & Skin Care",
  "Massage & Body",
  "Nail Services",
  "Makeup",
  "Bridal Services",
  "General"
];

export default function ServicesPage() {
  const t = useTranslations("Services");
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';

  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadServices();
  }, [filterActive, filterCategory, searchTerm]);

  const loadServices = async () => {
    try {
      setLoading(true);
      setError("");
      
      const params: any = {};
      if (filterActive !== undefined) {
        params.isActive = filterActive;
      }
      if (filterCategory) {
        params.category = filterCategory;
      }
      if (searchTerm) {
        params.search = searchTerm;
      }

      const response = await tenantApi.getServices(params);
      
      // Handle different response structures
      const data = response.data || response;
      
      if (data.success !== false) {
        // Response is successful (either success: true or success is undefined but no error)
        const servicesList = data.services || data.data?.services || [];
        setServices(servicesList);
        
        if (servicesList.length === 0 && !filterActive && !filterCategory && !searchTerm) {
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
    if (!confirm(locale === 'ar' 
      ? `هل أنت متأكد من حذف الخدمة "${serviceName}"؟` 
      : `Are you sure you want to delete service "${serviceName}"?`)) {
      return;
    }

    try {
      const response = await tenantApi.deleteService(id);
      if (response.success) {
        loadServices();
      } else {
        alert(response.message || t("deleteError"));
      }
    } catch (err: any) {
      console.error("Failed to delete service:", err);
      alert(err.message || t("deleteError"));
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

  return (
    <TenantLayout>
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("title")}
            </h2>
            <p className="text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t("subtitle")}
            </p>
          </div>
          <Link
            href={`/${locale}/dashboard/services/new`}
            className="btn btn-primary"
            style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
          >
            <span className="mr-2">{isRTL ? '➕' : ''}</span>
            {t("addService")}
            <span className="ml-2">{!isRTL ? '➕' : ''}</span>
          </Link>
        </div>
      </div>

      {/* Filters and Search */}
      <div className={`card mb-6 ${isRTL ? 'text-right' : ''}`}>
        <div className={`flex flex-col md:flex-row gap-4 ${isRTL ? 'md:flex-row-reverse' : ''}`}>
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            />
          </div>

          {/* Category Filter */}
          <div className="w-full md:w-48">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              <option value="">{t("allCategories")}</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Active Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterActive(undefined)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterActive === undefined
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {t("all")}
            </button>
            <button
              onClick={() => setFilterActive(true)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterActive === true
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {t("active")}
            </button>
            <button
              onClick={() => setFilterActive(false)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterActive === false
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {t("inactive")}
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-600">{t("loading")}</p>
        </div>
      ) : services.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">💇</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{t("noServices")}</h3>
          <p className="text-gray-600 mb-6">{t("noServicesDesc")}</p>
          <Link href={`/${locale}/dashboard/services/new`} className="btn btn-primary">
            {t("addFirstService")}
          </Link>
        </div>
      ) : (
        /* Services Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <div key={service.id} className="card hover:shadow-xl transition-shadow">
              {/* Service Image */}
              <div className="relative mb-4">
                <div className="w-full h-48 bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center">
                  {service.image ? (
                    <img
                      src={`http://localhost:5000/uploads/${service.image}`}
                      alt={locale === 'ar' ? service.name_ar : service.name_en}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-6xl">💇</span>
                  )}
                </div>
                {service.hasOffer && (
                  <div className={`absolute top-2 ${isRTL ? 'left-2' : 'right-2'} px-2 py-1 bg-red-500 text-white text-xs font-semibold rounded`}>
                    🎉 {t("offer")}
                  </div>
                )}
                {service.hasGift && (
                  <div className={`absolute top-2 ${isRTL ? 'right-2' : 'left-2'} px-2 py-1 bg-green-500 text-white text-xs font-semibold rounded`}>
                    🎁 {t("gift")}
                  </div>
                )}
                <div
                  className={`absolute bottom-2 ${isRTL ? 'right-2' : 'left-2'} w-6 h-6 rounded-full border-2 border-white ${
                    service.isActive ? 'bg-green-500' : 'bg-gray-400'
                  }`}
                  title={service.isActive ? t("active") : t("inactive")}
                ></div>
              </div>

              {/* Service Info */}
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {locale === 'ar' ? service.name_ar : service.name_en}
                </h3>
                {service.category && (
                  <p className="text-sm text-gray-600 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    📂 {service.category}
                  </p>
                )}
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <span>⏱️ {formatDuration(service.duration)}</span>
                  {service.employees && service.employees.length > 0 && (
                    <span>👥 {service.employees.length} {t("employees")}</span>
                  )}
                </div>
              </div>

              {/* Pricing Breakdown */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{t("rawPrice")}</span>
                  <span className="font-semibold text-gray-900">
                    <Currency amount={service.rawPrice} />
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{t("tax")} ({service.taxRate}%)</span>
                  <span className="text-gray-700">
                    <Currency amount={service.rawPrice * (service.taxRate / 100)} />
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{t("commission")} ({service.commissionRate}%)</span>
                  <span className="text-gray-700">
                    <Currency amount={service.rawPrice * (service.commissionRate / 100)} />
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <span className="font-semibold text-gray-900">{t("finalPrice")}</span>
                  <span className="font-bold text-primary text-lg">
                    <Currency amount={service.finalPrice} />
                  </span>
                </div>
              </div>

              {/* Includes */}
              {service.includes && service.includes.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-600 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("includes")}:
                  </p>
                  <div className={`flex flex-wrap gap-1 ${isRTL ? 'justify-end' : ''}`}>
                    {service.includes.slice(0, 3).map((item, index) => (
                      <span key={index} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        {item}
                      </span>
                    ))}
                    {service.includes.length > 3 && (
                      <span className="text-xs text-gray-500">+{service.includes.length - 3}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Employees */}
              {service.employees && service.employees.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-600 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("assignedEmployees")}:
                  </p>
                  <div className={`flex flex-wrap gap-2 ${isRTL ? 'justify-end' : ''}`}>
                    {service.employees.slice(0, 3).map((emp) => (
                      <div key={emp.id} className="flex items-center gap-1">
                        {emp.photo ? (
                          <img
                            src={`http://localhost:5000/uploads/${emp.photo}`}
                            alt={emp.name}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs">
                            {emp.name.charAt(0)}
                          </div>
                        )}
                        <span className="text-xs text-gray-700">{emp.name}</span>
                      </div>
                    ))}
                    {service.employees.length > 3 && (
                      <span className="text-xs text-gray-500">+{service.employees.length - 3}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Link
                  href={`/${locale}/dashboard/services/${service.id}`}
                  className="flex-1 btn btn-secondary text-center"
                >
                  {t("edit")}
                </Link>
                <button
                  onClick={() => handleDelete(service.id, locale === 'ar' ? service.name_ar : service.name_en)}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  {t("delete")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </TenantLayout>
  );
}

