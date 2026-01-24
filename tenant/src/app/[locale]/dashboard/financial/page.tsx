"use client";

import { useState, useEffect } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { tenantApi } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Currency } from "@/components/Currency";
import Link from "next/link";

interface Overview {
  totalRevenue: number;
  totalRawPrice: number;
  totalTax: number;
  totalPlatformFees: number;
  totalTenantRevenue: number;
  totalEmployeeCommissions: number;
  netRevenue: number;
  totalBookings: number;
  totalOrders?: number;
  paidBookings: number;
  paidOrders?: number;
  pendingPayments: number;
  completedBookings: number;
  completedOrders?: number;
  appointmentRevenue?: number;
  orderRevenue?: number;
  appointmentTenantRevenue?: number;
  orderTenantRevenue?: number;
}

interface EmployeeRevenue {
  id: string;
  name: string;
  photo?: string;
  baseSalary: number;
  commissionRate: number;
  totalBookings: number;
  paidBookings: number;
  totalRevenueGenerated: number;
  totalCommission: number;
  totalEarnings: number;
}

interface ServiceRevenue {
  id: string;
  name_en: string;
  name_ar: string;
  category: string;
  servicePrice: number;
  totalBookings: number;
  totalRevenue: number;
  totalTax: number;
  totalPlatformFees: number;
  totalTenantRevenue: number;
}

interface ProductRevenue {
  id: string;
  name_en: string;
  name_ar: string;
  category: string;
  productPrice: number;
  totalOrders: number;
  totalQuantity: number;
  totalRevenue: number;
  totalPlatformFees: number;
  totalTenantRevenue: number;
}

interface DailyRevenue {
  date: string;
  bookings: number;
  orders: number;
  revenue: number;
  tenantRevenue: number;
}

export default function FinancialPage() {
  const t = useTranslations("Financial");
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [employees, setEmployees] = useState<EmployeeRevenue[]>([]);
  const [services, setServices] = useState<ServiceRevenue[]>([]);
  const [products, setProducts] = useState<ProductRevenue[]>([]);
  const [dailyRevenue, setDailyRevenue] = useState<DailyRevenue[]>([]);
  const [employeeTotals, setEmployeeTotals] = useState<any>(null);
  const [serviceTotals, setServiceTotals] = useState<any>(null);
  const [productTotals, setProductTotals] = useState<any>(null);
  
  // Date filters
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1); // First day of current month
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    date.setDate(0); // Last day of current month
    return date.toISOString().split('T')[0];
  });

  // Active tab
  const [activeTab, setActiveTab] = useState<'overview' | 'employees' | 'services' | 'products'>('overview');

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const params = { startDate, endDate };
      
      const [overviewRes, employeesRes, servicesRes, productsRes, dailyRes] = await Promise.all([
        tenantApi.getFinancialOverview(params),
        tenantApi.getEmployeeRevenue(params),
        tenantApi.getServiceRevenue(params),
        tenantApi.getProductRevenue(params),
        tenantApi.getDailyRevenue(params)
      ]);

      if (overviewRes.success) setOverview(overviewRes.overview);
      if (employeesRes.success) {
        setEmployees(employeesRes.employees);
        setEmployeeTotals(employeesRes.totals);
      }
      if (servicesRes.success) {
        setServices(servicesRes.services);
        setServiceTotals(servicesRes.totals);
      }
      if (productsRes.success) {
        setProducts(productsRes.products);
        setProductTotals(productsRes.totals);
      }
      if (dailyRes.success) setDailyRevenue(dailyRes.dailyRevenue);
    } catch (err: any) {
      console.error("Failed to load financial data:", err);
      setError(err.message || t("loadError"));
    } finally {
      setLoading(false);
    }
  };

  const setQuickDateRange = (range: 'today' | 'week' | 'month' | 'year') => {
    const today = new Date();
    let start: Date, end: Date;

    switch (range) {
      case 'today':
        start = today;
        end = today;
        break;
      case 'week':
        start = new Date(today);
        start.setDate(today.getDate() - 7);
        end = today;
        break;
      case 'month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'year':
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today.getFullYear(), 11, 31);
        break;
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
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
        </div>
      </div>

      {/* Date Filters */}
      <div className={`card mb-6 ${isRTL ? 'text-right' : ''}`}>
        <div className={`flex flex-col md:flex-row gap-4 items-center ${isRTL ? 'md:flex-row-reverse' : ''}`}>
          <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <button onClick={() => setQuickDateRange('today')} className="btn btn-sm btn-secondary">
              {t("today")}
            </button>
            <button onClick={() => setQuickDateRange('week')} className="btn btn-sm btn-secondary">
              {t("thisWeek")}
            </button>
            <button onClick={() => setQuickDateRange('month')} className="btn btn-sm btn-secondary">
              {t("thisMonth")}
            </button>
            <button onClick={() => setQuickDateRange('year')} className="btn btn-sm btn-secondary">
              {t("thisYear")}
            </button>
          </div>
          <div className={`flex gap-4 flex-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("startDate")}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("endDate")}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex gap-2 mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
            activeTab === 'overview'
              ? 'bg-primary text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {t("overview")}
        </button>
        <button
          onClick={() => setActiveTab('employees')}
          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
            activeTab === 'employees'
              ? 'bg-primary text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {t("employeeRevenue")}
        </button>
        <button
          onClick={() => setActiveTab('services')}
          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
            activeTab === 'services'
              ? 'bg-primary text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {t("serviceRevenue")}
        </button>
        <button
          onClick={() => setActiveTab('products')}
          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
            activeTab === 'products'
              ? 'bg-primary text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {t("productRevenue")}
        </button>
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
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && overview && (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="card bg-gradient-to-br from-green-50 to-green-100 border border-green-200">
                  <div className="text-sm font-medium text-green-600 mb-1">{t("totalRevenue")}</div>
                  <div className="text-2xl font-bold text-green-800">
                    <Currency amount={overview.totalRevenue} />
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    {overview.totalBookings || 0} {t("bookings")}
                    {overview.totalOrders && overview.totalOrders > 0 && ` • ${overview.totalOrders} ${t("orders")}`}
                  </div>
                </div>
                <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200">
                  <div className="text-sm font-medium text-blue-600 mb-1">{t("tenantRevenue")}</div>
                  <div className="text-2xl font-bold text-blue-800">
                    <Currency amount={overview.totalTenantRevenue} />
                  </div>
                  <div className="text-xs text-blue-600 mt-1">{t("afterPlatformFees")}</div>
                </div>
                <div className="card bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200">
                  <div className="text-sm font-medium text-purple-600 mb-1">{t("netRevenue")}</div>
                  <div className="text-2xl font-bold text-purple-800">
                    <Currency amount={overview.netRevenue} />
                  </div>
                  <div className="text-xs text-purple-600 mt-1">{t("afterCommissions")}</div>
                </div>
                <div className="card bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200">
                  <div className="text-sm font-medium text-yellow-600 mb-1">{t("pendingPayments")}</div>
                  <div className="text-2xl font-bold text-yellow-800">
                    <Currency amount={overview.pendingPayments} />
                  </div>
                  <div className="text-xs text-yellow-600 mt-1">
                    {(overview.totalBookings || 0) - (overview.paidBookings || 0)} {t("unpaidBookings")}
                    {overview.totalOrders && overview.totalOrders > 0 && ` • ${(overview.totalOrders || 0) - (overview.paidOrders || 0)} ${t("unpaidOrders")}`}
                  </div>
                </div>
              </div>

              {/* Revenue Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("revenueBreakdown")}
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">{t("rawPrice")}</span>
                      <span className="font-semibold"><Currency amount={overview.totalRawPrice} /></span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">{t("tax")} (15% VAT)</span>
                      <span className="font-semibold"><Currency amount={overview.totalTax} /></span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <span className="text-red-600">{t("platformFees")}</span>
                      <span className="font-semibold text-red-600">- <Currency amount={overview.totalPlatformFees} /></span>
                    </div>
                    {overview.appointmentRevenue !== undefined && overview.orderRevenue !== undefined && (
                      <>
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                          <span className="text-blue-600">📅 {t("appointmentRevenue")}</span>
                          <span className="font-semibold text-blue-600"><Currency amount={overview.appointmentRevenue} /></span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                          <span className="text-green-600">🛍️ {t("productRevenue")}</span>
                          <span className="font-semibold text-green-600"><Currency amount={overview.orderRevenue} /></span>
                        </div>
                      </>
                    )}
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border-2 border-blue-200">
                      <span className="font-semibold text-blue-800">{t("tenantRevenue")}</span>
                      <span className="font-bold text-blue-800"><Currency amount={overview.totalTenantRevenue} /></span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                      <span className="text-orange-600">{t("employeeCommissions")}</span>
                      <span className="font-semibold text-orange-600">- <Currency amount={overview.totalEmployeeCommissions} /></span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-green-100 rounded-lg border-2 border-green-300">
                      <span className="font-bold text-green-800">{t("netRevenue")}</span>
                      <span className="font-bold text-green-800 text-xl"><Currency amount={overview.netRevenue} /></span>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t("bookingStats")}
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">{t("totalBookings")}</span>
                      <span className="font-semibold text-2xl">{overview.totalBookings}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <span className="text-green-600">{t("completedBookings")}</span>
                      <span className="font-semibold text-green-600">{overview.completedBookings}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <span className="text-green-600">{t("paidBookings")}</span>
                      <span className="font-semibold text-green-600">{overview.paidBookings}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                      <span className="text-yellow-600">{t("unpaidBookings")}</span>
                      <span className="font-semibold text-yellow-600">{overview.totalBookings - overview.paidBookings}</span>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">{t("averageBookingValue")}</div>
                      <div className="font-bold text-xl text-blue-800">
                        <Currency amount={overview.totalBookings > 0 ? overview.totalRevenue / overview.totalBookings : 0} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Employee Revenue Tab */}
          {activeTab === 'employees' && (
            <div className="space-y-6">
              {/* Summary */}
              {employeeTotals && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="card bg-gray-50">
                    <div className="text-sm text-gray-600">{t("totalEmployees")}</div>
                    <div className="text-2xl font-bold">{employeeTotals.totalEmployees}</div>
                  </div>
                  <div className="card bg-blue-50">
                    <div className="text-sm text-blue-600">{t("totalRevenueGenerated")}</div>
                    <div className="text-2xl font-bold text-blue-800"><Currency amount={employeeTotals.totalRevenueGenerated} /></div>
                  </div>
                  <div className="card bg-orange-50">
                    <div className="text-sm text-orange-600">{t("totalCommissions")}</div>
                    <div className="text-2xl font-bold text-orange-800"><Currency amount={employeeTotals.totalCommissions} /></div>
                  </div>
                  <div className="card bg-green-50">
                    <div className="text-sm text-green-600">{t("totalPayroll")}</div>
                    <div className="text-2xl font-bold text-green-800"><Currency amount={employeeTotals.totalPayroll} /></div>
                  </div>
                </div>
              )}

              {/* Employee Table */}
              {employees.length === 0 ? (
                <div className="card text-center py-12">
                  <div className="text-6xl mb-4">👥</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{t("noEmployeeData")}</h3>
                  <p className="text-gray-600">{t("noEmployeeDataDesc")}</p>
                </div>
              ) : (
                <div className="card overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">{t("employee")}</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">{t("bookings")}</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{t("revenueGenerated")}</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{t("baseSalary")}</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{t("commission")}</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{t("totalEarnings")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {employees.map((emp) => (
                        <tr key={emp.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4">
                            <div className="font-semibold text-gray-900">{emp.name}</div>
                            <div className="text-xs text-gray-500">{emp.commissionRate}% {t("commissionRate")}</div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="font-semibold">{emp.totalBookings}</span>
                            <span className="text-xs text-green-600 ml-1">({emp.paidBookings} {t("paid")})</span>
                          </td>
                          <td className="px-4 py-4 text-right font-semibold">
                            <Currency amount={emp.totalRevenueGenerated} />
                          </td>
                          <td className="px-4 py-4 text-right text-gray-600">
                            <Currency amount={emp.baseSalary} />
                          </td>
                          <td className="px-4 py-4 text-right text-orange-600 font-semibold">
                            <Currency amount={emp.totalCommission} />
                          </td>
                          <td className="px-4 py-4 text-right text-green-600 font-bold">
                            <Currency amount={emp.totalEarnings} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Service Revenue Tab */}
          {activeTab === 'services' && (
            <div className="space-y-6">
              {/* Summary */}
              {serviceTotals && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="card bg-gray-50">
                    <div className="text-sm text-gray-600">{t("totalServices")}</div>
                    <div className="text-2xl font-bold">{serviceTotals.totalServices}</div>
                  </div>
                  <div className="card bg-green-50">
                    <div className="text-sm text-green-600">{t("totalRevenue")}</div>
                    <div className="text-2xl font-bold text-green-800"><Currency amount={serviceTotals.totalRevenue} /></div>
                  </div>
                  <div className="card bg-blue-50">
                    <div className="text-sm text-blue-600">{t("totalBookings")}</div>
                    <div className="text-2xl font-bold text-blue-800">{serviceTotals.totalBookings}</div>
                  </div>
                  <div className="card bg-purple-50">
                    <div className="text-sm text-purple-600">{t("tenantRevenue")}</div>
                    <div className="text-2xl font-bold text-purple-800"><Currency amount={serviceTotals.totalTenantRevenue} /></div>
                  </div>
                </div>
              )}

              {/* Service Table */}
              {services.length === 0 ? (
                <div className="card text-center py-12">
                  <div className="text-6xl mb-4">💇</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{t("noServiceData")}</h3>
                  <p className="text-gray-600">{t("noServiceDataDesc")}</p>
                </div>
              ) : (
                <div className="card overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">{t("service")}</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">{t("category")}</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">{t("bookings")}</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{t("totalRevenue")}</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{t("tenantRevenue")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {services.map((service) => (
                        <tr key={service.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4">
                            <div className="font-semibold text-gray-900">
                              {locale === 'ar' ? service.name_ar : service.name_en}
                            </div>
                            <div className="text-xs text-gray-500">
                              <Currency amount={service.servicePrice} /> {t("perBooking")}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="px-2 py-1 bg-gray-100 rounded text-sm">{service.category}</span>
                          </td>
                          <td className="px-4 py-4 text-center font-semibold">
                            {service.totalBookings}
                          </td>
                          <td className="px-4 py-4 text-right font-semibold text-green-600">
                            <Currency amount={service.totalRevenue} />
                          </td>
                          <td className="px-4 py-4 text-right font-semibold text-blue-600">
                            <Currency amount={service.totalTenantRevenue} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
                </div>
              )}

          {/* Product Revenue Tab */}
          {activeTab === 'products' && (
            <div className="space-y-6">
              {/* Summary */}
              {productTotals && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="card bg-gray-50">
                    <div className="text-sm text-gray-600">{t("totalProducts")}</div>
                    <div className="text-2xl font-bold">{productTotals.totalProducts}</div>
                  </div>
                  <div className="card bg-green-50">
                    <div className="text-sm text-green-600">{t("totalRevenue")}</div>
                    <div className="text-2xl font-bold text-green-800"><Currency amount={productTotals.totalRevenue} /></div>
                  </div>
                  <div className="card bg-blue-50">
                    <div className="text-sm text-blue-600">{t("totalOrders")}</div>
                    <div className="text-2xl font-bold text-blue-800">{productTotals.totalOrders}</div>
                  </div>
                  <div className="card bg-purple-50">
                    <div className="text-sm text-purple-600">{t("tenantRevenue")}</div>
                    <div className="text-2xl font-bold text-purple-800"><Currency amount={productTotals.totalTenantRevenue} /></div>
                  </div>
                </div>
              )}

              {/* Product Table */}
              {products.length === 0 ? (
                <div className="card text-center py-12">
                  <div className="text-6xl mb-4">🛍️</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{t("noProductData")}</h3>
                  <p className="text-gray-600">{t("noProductDataDesc")}</p>
                </div>
              ) : (
                <div className="card overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">{t("product")}</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">{t("category")}</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">{t("orders")}</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">{t("quantity")}</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{t("totalRevenue")}</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{t("tenantRevenue")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {products.map((product) => (
                        <tr key={product.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4">
                            <div className="font-semibold text-gray-900">
                              {locale === 'ar' ? product.name_ar : product.name_en}
                            </div>
                            <div className="text-xs text-gray-500">
                              <Currency amount={product.productPrice} /> {t("perUnit")}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="px-2 py-1 bg-gray-100 rounded text-sm">{product.category}</span>
                          </td>
                          <td className="px-4 py-4 text-center font-semibold">
                            {product.totalOrders}
                          </td>
                          <td className="px-4 py-4 text-center font-semibold">
                            {product.totalQuantity}
                          </td>
                          <td className="px-4 py-4 text-right font-semibold text-green-600">
                            <Currency amount={product.totalRevenue} />
                          </td>
                          <td className="px-4 py-4 text-right font-semibold text-blue-600">
                            <Currency amount={product.totalTenantRevenue} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </TenantLayout>
  );
}

