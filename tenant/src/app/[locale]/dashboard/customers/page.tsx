'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { tenantApi } from '@/lib/api';
import { TenantLayout } from '@/components/TenantLayout';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  UserGroupIcon,
  UserPlusIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  StarIcon,
  PhoneIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';
import { Currency } from '@/components/Currency';

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  photo: string | null;
  gender: string | null;
  joinedAt: string;
  totalBookings: number;
  totalSpent: number;
  lastVisit: string | null;
  firstVisit: string | null;
  loyaltyTier: string;
  loyaltyPoints: number;
  noShowCount: number;
  cancellationCount: number;
  tags: string[];
  notes: string;
}

interface CustomerStats {
  totalCustomers: number;
  newCustomersThisMonth: number;
  returningCustomers: number;
  returningRate: number;
  averageBookingsPerCustomer: number;
  loyaltyTierDistribution: {
    bronze: number;
    silver: number;
    gold: number;
    platinum: number;
  };
}

export default function CustomersPage() {
  const t = useTranslations('Customers');
  const locale = useLocale();
  const router = useRouter();
  const isRTL = locale === 'ar';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination & filters
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('lastVisit');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [loyaltyFilter, setLoyaltyFilter] = useState('');
  const [customerTypeFilter, setCustomerTypeFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const response = await tenantApi.getCustomers({
        page,
        limit: 20,
        search,
        sortBy,
        sortOrder,
        loyaltyTier: loyaltyFilter,
        customerType: customerTypeFilter,
      });

      if (response.success) {
        setCustomers(response.data.customers);
        setTotalPages(response.data.pagination.totalPages);
        setTotalCustomers(response.data.pagination.total);
      }
    } catch (err: any) {
      console.error('Failed to load customers:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await tenantApi.getCustomerStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (err) {
      console.error('Failed to load customer stats:', err);
    }
  };

  useEffect(() => {
    loadCustomers();
    loadStats();
  }, [page, sortBy, sortOrder, loyaltyFilter, customerTypeFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (page === 1) {
        loadCustomers();
      } else {
        setPage(1);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const handleExport = async () => {
    try {
      const blob = await tenantApi.exportCustomers();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'customers.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export customers:', err);
    }
  };

  const getLoyaltyColor = (tier: string) => {
    switch (tier) {
      case 'platinum': return 'bg-purple-100 text-purple-800';
      case 'gold': return 'bg-yellow-100 text-yellow-800';
      case 'silver': return 'bg-gray-100 text-gray-800';
      default: return 'bg-amber-100 text-amber-800';
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

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
        <div className="flex gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <button
            onClick={handleExport}
            className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <ArrowDownTrayIcon className="w-5 h-5 mx-2" />
            {t('export')}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{t('totalCustomers')}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalCustomers}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <UserGroupIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{t('newThisMonth')}</p>
                <p className="text-2xl font-bold text-green-600">+{stats.newCustomersThisMonth}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <UserPlusIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{t('returningRate')}</p>
                <p className="text-2xl font-bold text-purple-600">{stats.returningRate}%</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <ArrowPathIcon className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{t('avgBookings')}</p>
                <p className="text-2xl font-bold text-orange-600">{stats.averageBookingsPerCustomer}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <StarIcon className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className={`w-5 h-5 text-gray-400 absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3' : 'left-3'}`} />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500`}
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            />
          </div>
          <div className="flex gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="lastVisit">{t('sortByLastVisit')}</option>
              <option value="totalSpent">{t('sortBySpent')}</option>
              <option value="totalBookings">{t('sortByBookings')}</option>
              <option value="firstName">{t('sortByName')}</option>
            </select>
            <select
              value={loyaltyFilter}
              onChange={(e) => setLoyaltyFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">{t('allTiers')}</option>
              <option value="platinum">{t('platinum')}</option>
              <option value="gold">{t('gold')}</option>
              <option value="silver">{t('silver')}</option>
              <option value="bronze">{t('bronze')}</option>
            </select>
            <select
              value={customerTypeFilter}
              onChange={(e) => setCustomerTypeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">{t('allTypes')}</option>
              <option value="service_only">{t('servicesOnly')}</option>
              <option value="product_only">{t('productsOnly')}</option>
              <option value="both">{t('both')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Customer List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64 text-red-500">
            {error}
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <UserGroupIcon className="w-12 h-12 mb-4" />
            <p>{t('noCustomers')}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('customer')}
                    </th>
                    <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('type')}
                    </th>
                    <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('contact')}
                    </th>
                    <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('bookings')}
                    </th>
                    <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('orders')}
                    </th>
                    <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('spent')}
                    </th>
                    <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('loyalty')}
                    </th>
                    <th className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('lastVisit')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {customers.map((customer) => (
                    <tr
                      key={customer.id}
                      onClick={() => router.push(`/${locale}/dashboard/customers/${customer.id}`)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                          <div className={`w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center ${isRTL ? 'ml-3' : 'mr-3'} relative`}>
                            {customer.photo ? (
                              <>
                                <img
                                  src={customer.photo.startsWith('http') 
                                    ? customer.photo 
                                    : customer.photo.startsWith('/')
                                      ? `http://localhost:5000${customer.photo}`
                                      : `http://localhost:5000/uploads/${customer.photo}`}
                                  alt={`${customer.firstName} ${customer.lastName}`}
                                  className="w-10 h-10 rounded-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                    if (fallback) fallback.style.display = 'flex';
                                  }}
                                />
                                <span className="text-primary-600 font-medium hidden absolute inset-0 items-center justify-center">
                                  {customer.firstName.charAt(0)}{customer.lastName.charAt(0)}
                                </span>
                              </>
                            ) : (
                              <span className="text-primary-600 font-medium">
                                {customer.firstName.charAt(0)}{customer.lastName.charAt(0)}
                              </span>
                            )}
                          </div>
                          <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                            <p className="font-medium text-gray-900">
                              {customer.firstName} {customer.lastName}
                            </p>
                            {customer.tags.length > 0 && (
                              <div className="flex gap-1 mt-1" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                                {customer.tags.slice(0, 2).map((tag, i) => (
                                  <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        {customer.customerType === 'both' && (
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                            📅🛍️ {t('both')}
                          </span>
                        )}
                        {customer.customerType === 'service_only' && (
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                            📅 {t('services')}
                          </span>
                        )}
                        {customer.customerType === 'product_only' && (
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                            🛍️ {t('products')}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                          <div className="flex items-center text-sm text-gray-600" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                            <EnvelopeIcon className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                            {customer.email}
                          </div>
                          <div className="flex items-center text-sm text-gray-600 mt-1" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                            <PhoneIcon className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                            {customer.phone}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        <span className="font-medium text-gray-900">{customer.totalBookings}</span>
                        {customer.noShowCount > 0 && (
                          <span className="text-xs text-red-500 block">
                            {customer.noShowCount} {t('noShows')}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        <span className="font-medium text-gray-900">{customer.totalOrders || 0}</span>
                        {customer.totalProductsPurchased && customer.totalProductsPurchased > 0 && (
                          <span className="text-xs text-gray-500 block">
                            {customer.totalProductsPurchased} {t('items')}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        <Currency amount={customer.totalSpent} className="font-medium text-gray-900" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getLoyaltyColor(customer.loyaltyTier)}`}>
                          {t(customer.loyaltyTier)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        {formatDate(customer.lastVisit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {t('showing')} {(page - 1) * 20 + 1}-{Math.min(page * 20, totalCustomers)} {t('of')} {totalCustomers}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  {isRTL ? <ChevronRightIcon className="w-5 h-5" /> : <ChevronLeftIcon className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  {isRTL ? <ChevronLeftIcon className="w-5 h-5" /> : <ChevronRightIcon className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
    </TenantLayout>
  );
}

