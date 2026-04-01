"use client";

import { useState, useEffect } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { getImageUrl, tenantApi } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Currency } from "@/components/Currency";
import Link from "next/link";

interface Employee {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  nationality?: string;
  bio?: string;
  experience?: string;
  skills: string[];
  photo?: string;
  rating: number;
  totalBookings: number;
  salary: number;
  commissionRate: number;
  workingHours?: any;
  isActive: boolean;
  createdAt: string;
}

export default function EmployeesPage() {
  const t = useTranslations("Employees");
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined);
  const [error, setError] = useState("");
  const [limits, setLimits] = useState<any>(null);

  useEffect(() => {
    loadEmployees();
  }, [filterActive, searchTerm]);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      setError("");

      const params: any = {};
      if (filterActive !== undefined) {
        params.isActive = filterActive;
      }
      if (searchTerm) {
        params.search = searchTerm;
      }

      const [response, limitsData] = await Promise.all([
        tenantApi.getEmployees(params),
        tenantApi.getSubscriptionLimits().catch(() => null)
      ]);

      if (limitsData?.staff) {
        setLimits(limitsData.staff);
      }

      // Handle different response structures
      const data = response.data || response;

      if (data.success !== false) {
        // Response is successful (either success: true or success is undefined but no error)
        const employeesList = data.employees || data.data?.employees || [];
        setEmployees(employeesList);

        if (employeesList.length === 0 && !filterActive && !searchTerm) {
          console.log("No employees found. Response:", response);
        }
      } else {
        setError(data.message || t("loadError"));
        setEmployees([]);
      }
    } catch (err: any) {
      console.error("Failed to load employees:", err);
      console.error("Error details:", {
        message: err.message,
        stack: err.stack,
        response: err.response
      });
      setError(err.message || t("loadError"));
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(locale === 'ar'
      ? `هل أنت متأكد من حذف الموظف "${name}"؟`
      : `Are you sure you want to delete employee "${name}"?`)) {
      return;
    }

    try {
      const response = await tenantApi.deleteEmployee(id);
      if (response.success) {
        loadEmployees();
      } else {
        alert(response.message || t("deleteError"));
      }
    } catch (err: any) {
      console.error("Failed to delete employee:", err);
      alert(err.message || t("deleteError"));
    }
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
          <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {limits && (
              <div className="text-sm px-3 py-1 bg-gray-100 rounded-lg whitespace-nowrap">
                <span className="text-gray-500">{isRTL ? 'الحد المسموح:' : 'Limit:'} </span>
                <span className={`font-medium ${!limits.allowed ? 'text-red-600' : 'text-gray-900'}`}>
                  {limits.current} / {limits.limit}
                </span>
              </div>
            )}
            <Link
              href={limits && !limits.allowed ? '#' : `/${locale}/dashboard/employees/new`}
              className={`btn btn-primary ${limits && !limits.allowed ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
              style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
              onClick={(e) => {
                if (limits && !limits.allowed) {
                  e.preventDefault();
                  alert(isRTL ? 'تم الوصول للحد الأقصى לבاقتك' : 'You have reached your subscription limit');
                }
              }}
            >
              <span className="mr-2">{isRTL ? '➕' : ''}</span>
              {t("addEmployee")}
              <span className="ml-2">{!isRTL ? '➕' : ''}</span>
            </Link>
          </div>
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

          {/* Active Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterActive(undefined)}
              className={`px-4 py-2 rounded-lg transition-colors ${filterActive === undefined
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
            >
              {t("all")}
            </button>
            <button
              onClick={() => setFilterActive(true)}
              className={`px-4 py-2 rounded-lg transition-colors ${filterActive === true
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
            >
              {t("active")}
            </button>
            <button
              onClick={() => setFilterActive(false)}
              className={`px-4 py-2 rounded-lg transition-colors ${filterActive === false
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
      ) : employees.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">👥</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{t("noEmployees")}</h3>
          <p className="text-gray-600 mb-6">{t("noEmployeesDesc")}</p>
          <Link href={`/${locale}/dashboard/employees/new`} className="btn btn-primary">
            {t("addFirstEmployee")}
          </Link>
        </div>
      ) : (
        /* Employees Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {employees.map((employee) => (
            <div key={employee.id} className="card hover:shadow-xl transition-shadow">
              {/* Employee Photo and Status */}
              <div className="relative mb-4">
                <div className="w-24 h-24 mx-auto rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                  {employee.photo ? (
                    <img
                      src={getImageUrl(employee.photo)}
                      alt={employee.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl">👤</span>
                  )}
                </div>
                <div
                  className={`absolute top-0 ${isRTL ? 'left-0' : 'right-0'} w-6 h-6 rounded-full border-2 border-white ${employee.isActive ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                ></div>
              </div>

              {/* Employee Info */}
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold text-gray-900 mb-1">{employee.name}</h3>
                {employee.nationality && (
                  <p className="text-sm text-gray-600 mb-2">🌍 {employee.nationality}</p>
                )}
                {employee.experience && (
                  <p className="text-sm text-gray-600 mb-2">⭐ {employee.experience}</p>
                )}
                {employee.skills && employee.skills.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1 mt-2">
                    {employee.skills.slice(0, 3).map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full"
                      >
                        {skill}
                      </span>
                    ))}
                    {employee.skills.length > 3 && (
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                        +{employee.skills.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-4 text-center">
                <div>
                  <p className="text-xs text-gray-600 mb-1">{t("rating")}</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {employee.rating ? Number(employee.rating).toFixed(1) : '5.0'} ⭐
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">{t("bookings")}</p>
                  <p className="text-lg font-semibold text-gray-900">{employee.totalBookings}</p>
                </div>
              </div>

              {/* Salary */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{t("salary")}</span>
                  <span className="font-semibold text-gray-900">
                    <Currency amount={employee.salary} />
                  </span>
                </div>
                {employee.commissionRate > 0 && (
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-gray-600">{t("commission")}</span>
                    <span className="font-semibold text-gray-900">
                      {employee.commissionRate}%
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Link
                  href={`/${locale}/dashboard/employees/${employee.id}`}
                  className="flex-1 btn btn-secondary text-center"
                >
                  {t("edit")}
                </Link>
                <button
                  onClick={() => handleDelete(employee.id, employee.name)}
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

