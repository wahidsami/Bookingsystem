'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { getImageUrl, tenantApi } from '@/lib/api';
import { TenantLayout } from '@/components/TenantLayout';
import {
  ChartBarIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import { Currency } from '@/components/Currency';

export default function ReportsPage() {
  const t = useTranslations('Reports');
  const locale = useLocale();
  const isRTL = locale === 'ar';

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Data states
  const [summary, setSummary] = useState<any>(null);
  const [bookingTrends, setBookingTrends] = useState<any[]>([]);
  const [servicePerformance, setServicePerformance] = useState<any[]>([]);
  const [employeePerformance, setEmployeePerformance] = useState<any[]>([]);
  const [peakHours, setPeakHours] = useState<any>(null);
  const [customerAnalytics, setCustomerAnalytics] = useState<any>(null);

  const setDateRangePreset = (preset: string) => {
    const now = new Date();
    let start: Date;
    
    switch (preset) {
      case 'week':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(now.toISOString().split('T')[0]);
    setDateRange(preset);
  };

  useEffect(() => {
    setDateRangePreset('month');
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = { startDate, endDate };

      const [summaryRes, trendsRes, servicesRes, employeesRes, peakRes, customerRes] = await Promise.all([
        tenantApi.getReportsSummary(params),
        tenantApi.getBookingTrends({ ...params, groupBy: dateRange === 'year' ? 'month' : 'day' }),
        tenantApi.getServicePerformance(params),
        tenantApi.getEmployeePerformance(params),
        tenantApi.getPeakHoursAnalysis(params),
        tenantApi.getCustomerAnalytics(params),
      ]);

      if (summaryRes.success) setSummary(summaryRes.data);
      if (trendsRes.success) setBookingTrends(trendsRes.data);
      if (servicesRes.success) setServicePerformance(servicesRes.data);
      if (employeesRes.success) setEmployeePerformance(employeesRes.data);
      if (peakRes.success) setPeakHours(peakRes.data);
      if (customerRes.success) setCustomerAnalytics(customerRes.data);

    } catch (err: any) {
      console.error('Failed to load reports:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      loadData();
    }
  }, [startDate, endDate]);

  const tabs = [
    { id: 'overview', icon: ChartBarIcon, label: t('overview') },
    { id: 'services', icon: CurrencyDollarIcon, label: t('services') },
    { id: 'employees', icon: UserGroupIcon, label: t('employees') },
    { id: 'peakHours', icon: ClockIcon, label: t('peakHours') },
    { id: 'customers', icon: UserGroupIcon, label: t('customers') },
  ];

  const getMaxValue = (data: number[]) => Math.max(...data, 1);

  if (loading) {
    return (
      <TenantLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout>
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {t('title')}
          </h1>
          <p className="text-gray-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {t('subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <a
            href={`/${locale}/dashboard/reports/generate`}
            className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 no-print"
          >
            {locale === 'ar' ? 'إنشاء تقرير' : 'Generate report'}
          </a>
          {['week', 'month', 'quarter', 'year'].map((preset) => (
            <button
              key={preset}
              onClick={() => setDateRangePreset(preset)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === preset
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {t(preset)}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-1">
        <div className="flex gap-1 overflow-x-auto" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
            >
              <tab.icon className="w-5 h-5" />
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && summary && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{t('totalBookings')}</p>
                  <p className="text-2xl font-bold text-gray-900">{summary.totalBookings}</p>
                  <p className="text-xs text-gray-400">{summary.completedBookings} {t('completed')}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <CalendarDaysIcon className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{t('totalRevenue')}</p>
                  <Currency amount={summary.totalRevenue} className="text-2xl font-bold text-green-600" />
                  <p className="text-xs text-gray-400">{t('avgBooking')}: <Currency amount={summary.avgBookingValue} /></p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <CurrencyDollarIcon className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{t('completionRate')}</p>
                  <p className="text-2xl font-bold text-purple-600">{summary.completionRate}%</p>
                  <p className="text-xs text-gray-400">{summary.cancelledBookings} {t('cancelled')}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <ArrowTrendingUpIcon className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{t('uniqueCustomers')}</p>
                  <p className="text-2xl font-bold text-orange-600">{summary.uniqueCustomers}</p>
                  <p className="text-xs text-gray-400">{summary.noShowBookings} {t('noShows')}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <UserGroupIcon className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Booking Trends Chart */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('bookingTrends')}
            </h3>
            <div className="h-64 flex items-end gap-1">
              {bookingTrends.slice(-30).map((day, index) => (
                <div
                  key={index}
                  className="flex-1 bg-primary-200 hover:bg-primary-400 transition-colors rounded-t"
                  style={{
                    height: `${(day.bookings / getMaxValue(bookingTrends.map(d => d.bookings))) * 100}%`,
                    minHeight: day.bookings > 0 ? '8px' : '2px'
                  }}
                  title={`${day.date}: ${day.bookings} ${t('bookings')}`}
                />
              ))}
            </div>
            <p className="text-center text-sm text-gray-500 mt-2">{t('last30Days')}</p>
          </div>
        </div>
      )}

      {/* Services Tab */}
      {activeTab === 'services' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('servicePerformance')}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('service')}
                  </th>
                  <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('bookings')}
                  </th>
                  <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('revenue')}
                  </th>
                  <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('avgRevenue')}
                  </th>
                  <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('completionRate')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {servicePerformance.map((service) => (
                  <tr key={service.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      <p className="font-medium text-gray-900">
                        {locale === 'ar' ? service.name_ar : service.name_en}
                      </p>
                      <p className="text-sm text-gray-500">{service.category}</p>
                    </td>
                    <td className="px-6 py-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      <span className="font-medium">{service.totalBookings}</span>
                      <span className="text-sm text-gray-500"> ({service.completedBookings} {t('completed')})</span>
                    </td>
                    <td className="px-6 py-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      <Currency amount={service.revenue} className="font-medium text-green-600" />
                    </td>
                    <td className="px-6 py-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      <Currency amount={service.avgRevenue} />
                    </td>
                    <td className="px-6 py-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      <span className={`font-medium ${parseFloat(service.completionRate) >= 80 ? 'text-green-600' : parseFloat(service.completionRate) >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {service.completionRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Employees Tab */}
      {activeTab === 'employees' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('employeePerformance')}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('employee')}
                  </th>
                  <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('bookings')}
                  </th>
                  <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('revenue')}
                  </th>
                  <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('commission')}
                  </th>
                  <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('completionRate')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {employeePerformance.map((employee) => (
                  <tr key={employee.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                          {employee.photo ? (
                            <img src={getImageUrl(employee.photo)} alt={employee.name} className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <span className="text-primary-600 font-medium">{employee.name?.charAt(0)}</span>
                          )}
                        </div>
                        <span className="font-medium text-gray-900">{employee.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      <span className="font-medium">{employee.totalBookings}</span>
                      <span className="text-sm text-gray-500"> ({employee.completedBookings} {t('completed')})</span>
                    </td>
                    <td className="px-6 py-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      <Currency amount={employee.revenue} className="font-medium text-green-600" />
                    </td>
                    <td className="px-6 py-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      <Currency amount={employee.commission} />
                    </td>
                    <td className="px-6 py-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      <span className={`font-medium ${parseFloat(employee.completionRate) >= 80 ? 'text-green-600' : parseFloat(employee.completionRate) >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {employee.completionRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Peak Hours Tab */}
      {activeTab === 'peakHours' && peakHours && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Hourly Distribution */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t('hourlyDistribution')}
              </h3>
              <div className="space-y-2">
                {peakHours.hourlyData.filter((h: any) => h.bookings > 0).map((hour: any) => (
                  <div key={hour.hour} className="flex items-center gap-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <span className="w-16 text-sm text-gray-600">{hour.hour}</span>
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full"
                        style={{ width: `${(hour.bookings / getMaxValue(peakHours.hourlyData.map((h: any) => h.bookings))) * 100}%` }}
                      />
                    </div>
                    <span className="w-12 text-sm font-medium text-gray-900">{hour.bookings}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Daily Distribution */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t('dailyDistribution')}
              </h3>
              <div className="space-y-3">
                {peakHours.dailyData.map((day: any) => (
                  <div key={day.day} className="flex items-center gap-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <span className="w-24 text-sm text-gray-600">{t(day.day.toLowerCase())}</span>
                    <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-lg"
                        style={{ width: `${(day.bookings / getMaxValue(peakHours.dailyData.map((d: any) => d.bookings))) * 100}%` }}
                      />
                    </div>
                    <span className="w-12 text-sm font-medium text-gray-900">{day.bookings}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Peak Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h4 className="text-sm text-gray-500 mb-2">{t('peakHoursLabel')}</h4>
              <div className="flex flex-wrap gap-2">
                {peakHours.peakHours.map((hour: string) => (
                  <span key={hour} className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
                    {hour}
                  </span>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h4 className="text-sm text-gray-500 mb-2">{t('busiestDays')}</h4>
              <div className="flex flex-wrap gap-2">
                {peakHours.busiestDays.map((day: string) => (
                  <span key={day} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                    {t(day.toLowerCase())}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customers Tab */}
      {activeTab === 'customers' && customerAnalytics && (
        <div className="space-y-6">
          {/* Customer Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">{t('totalCustomers')}</p>
              <p className="text-2xl font-bold text-gray-900">{customerAnalytics.totalCustomers}</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">{t('newCustomers')}</p>
              <p className="text-2xl font-bold text-green-600">{customerAnalytics.newCustomers}</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">{t('returningCustomers')}</p>
              <p className="text-2xl font-bold text-blue-600">{customerAnalytics.returningCustomers}</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">{t('retentionRate')}</p>
              <p className="text-2xl font-bold text-purple-600">{customerAnalytics.retentionRate}%</p>
            </div>
          </div>

          {/* Customer Segments */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('customerSegments')}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-3xl font-bold text-gray-600">{customerAnalytics.segments.oneTime}</p>
                <p className="text-sm text-gray-500">{t('oneTime')}</p>
                <Currency amount={customerAnalytics.segmentRevenue.oneTime} className="text-xs text-gray-400" />
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-3xl font-bold text-blue-600">{customerAnalytics.segments.occasional}</p>
                <p className="text-sm text-gray-500">{t('occasional')}</p>
                <Currency amount={customerAnalytics.segmentRevenue.occasional} className="text-xs text-blue-400" />
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-3xl font-bold text-green-600">{customerAnalytics.segments.regular}</p>
                <p className="text-sm text-gray-500">{t('regular')}</p>
                <Currency amount={customerAnalytics.segmentRevenue.regular} className="text-xs text-green-400" />
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-3xl font-bold text-purple-600">{customerAnalytics.segments.loyal}</p>
                <p className="text-sm text-gray-500">{t('loyal')}</p>
                <Currency amount={customerAnalytics.segmentRevenue.loyal} className="text-xs text-purple-400" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </TenantLayout>
  );
}

