'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { getImageUrl, tenantApi } from '@/lib/api';
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
  PencilSquareIcon,
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
  customerType?: 'service_only' | 'product_only' | 'both' | 'walk_in';
  totalOrders?: number;
  totalProductsPurchased?: number;
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

  const isWalkInCustomer = (customer: Customer) => {
    const firstName = `${customer.firstName || ''}`.trim().toLowerCase();
    const lastName = `${customer.lastName || ''}`.trim();
    return (firstName === 'customer' || firstName === 'عميل') && /^\d{3}$/.test(lastName);
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
      <div className="relative space-y-8 pb-8" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[320px] bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.10),_transparent_30%),linear-gradient(180deg,_rgba(15,23,42,0.02),_transparent_60%)]" />

        <section className="card overflow-hidden border border-slate-200/80 bg-slate-950 text-white shadow-2xl shadow-slate-950/10">
          <div className="flex flex-col gap-6 p-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
                {locale === 'ar' ? 'CRM' : 'CRM'}
              </p>
              <h1 className="text-4xl font-black tracking-tight" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t('title')}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-300" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t('subtitle')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <button
                onClick={handleExport}
                className="btn-primary inline-flex items-center gap-2"
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
                {t('export')}
              </button>
            </div>
          </div>
        </section>

        {stats && (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="card border border-slate-200/80 bg-white p-5 shadow-xl shadow-slate-950/5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t('totalCustomers')}</p>
                  <p className="mt-3 text-4xl font-black text-slate-950">{stats.totalCustomers}</p>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600">
                  <UserGroupIcon className="h-7 w-7" />
                </div>
              </div>
            </div>
            <div className="card border border-slate-200/80 bg-white p-5 shadow-xl shadow-slate-950/5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t('newThisMonth')}</p>
                  <p className="mt-3 text-4xl font-black text-emerald-600">+{stats.newCustomersThisMonth}</p>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                  <UserPlusIcon className="h-7 w-7" />
                </div>
              </div>
            </div>
            <div className="card border border-slate-200/80 bg-white p-5 shadow-xl shadow-slate-950/5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t('returningRate')}</p>
                  <p className="mt-3 text-4xl font-black text-violet-600">{stats.returningRate}%</p>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600">
                  <ArrowPathIcon className="h-7 w-7" />
                </div>
              </div>
            </div>
            <div className="card border border-slate-200/80 bg-white p-5 shadow-xl shadow-slate-950/5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t('avgBookings')}</p>
                  <p className="mt-3 text-4xl font-black text-amber-600">{stats.averageBookingsPerCustomer}</p>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
                  <StarIcon className="h-7 w-7" />
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="card border border-slate-200/80 bg-white p-5 shadow-xl shadow-slate-950/5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 ${isRTL ? 'right-4' : 'left-4'}`} />
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 text-sm text-slate-950 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'}`}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              />
            </div>
            <div className="flex flex-wrap gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <option value="lastVisit">{t('sortByLastVisit')}</option>
                <option value="totalSpent">{t('sortBySpent')}</option>
                <option value="totalBookings">{t('sortByBookings')}</option>
                <option value="firstName">{t('sortByName')}</option>
              </select>
              <select value={loyaltyFilter} onChange={(e) => setLoyaltyFilter(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <option value="">{t('allTiers')}</option>
                <option value="platinum">{t('platinum')}</option>
                <option value="gold">{t('gold')}</option>
                <option value="silver">{t('silver')}</option>
                <option value="bronze">{t('bronze')}</option>
              </select>
              <select value={customerTypeFilter} onChange={(e) => setCustomerTypeFilter(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <option value="">{t('allTypes')}</option>
                <option value="walk_in">{locale === 'ar' ? 'عملاء حضوري' : 'Walk-ins'}</option>
                <option value="service_only">{t('servicesOnly')}</option>
                <option value="product_only">{t('productsOnly')}</option>
                <option value="both">{t('both')}</option>
              </select>
            </div>
          </div>
        </section>

        <section className="card overflow-hidden border border-slate-200/80 bg-white shadow-xl shadow-slate-950/5">
          {loading ? (
            <div className="flex min-h-[24rem] items-center justify-center">
              <div className="spinner" />
            </div>
          ) : error ? (
            <div className="flex min-h-[24rem] items-center justify-center px-4 text-center text-rose-600">
              {error}
            </div>
          ) : customers.length === 0 ? (
            <div className="flex min-h-[24rem] flex-col items-center justify-center px-4 text-center text-slate-500">
              <UserGroupIcon className="mb-4 h-12 w-12 text-slate-300" />
              <p>{t('noCustomers')}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-950 text-white">
                    <tr>
                      <th className={`px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] ${isRTL ? 'text-right' : 'text-left'}`}>{t('customer')}</th>
                      <th className={`px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] ${isRTL ? 'text-right' : 'text-left'}`}>{t('type')}</th>
                      <th className={`px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] ${isRTL ? 'text-right' : 'text-left'}`}>{t('contact')}</th>
                      <th className={`px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] ${isRTL ? 'text-right' : 'text-left'}`}>{t('bookings')}</th>
                      <th className={`px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] ${isRTL ? 'text-right' : 'text-left'}`}>{t('orders')}</th>
                      <th className={`px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] ${isRTL ? 'text-right' : 'text-left'}`}>{t('spent')}</th>
                      <th className={`px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] ${isRTL ? 'text-right' : 'text-left'}`}>{t('loyalty')}</th>
                      <th className={`px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] ${isRTL ? 'text-right' : 'text-left'}`}>{t('lastVisit')}</th>
                      <th className={`px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] ${isRTL ? 'text-right' : 'text-left'}`}>{locale === 'ar' ? 'الإجراء' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {customers.map((customer) => (
                      <tr key={customer.id} onClick={() => router.push(`/${locale}/dashboard/customers/${customer.id}`)} className="cursor-pointer transition hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary font-semibold">
                              {customer.photo ? (
                                <img
                                  src={customer.photo.startsWith('http') ? customer.photo : getImageUrl(customer.photo)}
                                  alt={`${customer.firstName} ${customer.lastName}`}
                                  className="h-12 w-12 rounded-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <span>{customer.firstName.charAt(0)}{customer.lastName.charAt(0)}</span>
                              )}
                            </div>
                            <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                              <div className="flex items-center gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                                <p className="font-semibold text-slate-950">{customer.firstName} {customer.lastName}</p>
                                {isWalkInCustomer(customer) && (
                                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                                    {locale === 'ar' ? 'عميل حضوري' : 'Walk-in'}
                                  </span>
                                )}
                              </div>
                              {customer.tags.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                                  {customer.tags.slice(0, 2).map((tag, i) => (
                                    <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {customer.customerType === 'both' && <span className="badge badge-info">📅🛍️ {t('both')}</span>}
                          {customer.customerType === 'service_only' && <span className="badge badge-secondary">📅 {t('services')}</span>}
                          {customer.customerType === 'product_only' && <span className="badge badge-success">🛍️ {t('products')}</span>}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          <div className="flex items-center gap-1" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                            <EnvelopeIcon className="h-4 w-4 text-slate-400" />
                            {customer.email}
                          </div>
                          <div className="mt-1 flex items-center gap-1" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                            <PhoneIcon className="h-4 w-4 text-slate-400" />
                            {customer.phone}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-slate-950">{customer.totalBookings}</span>
                          {customer.noShowCount > 0 && <span className="mt-1 block text-xs text-rose-500">{customer.noShowCount} {t('noShows')}</span>}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-slate-950">{customer.totalOrders || 0}</span>
                          {customer.totalProductsPurchased && customer.totalProductsPurchased > 0 && (
                            <span className="mt-1 block text-xs text-slate-500">{customer.totalProductsPurchased} {t('items')}</span>
                          )}
                        </td>
                        <td className="px-6 py-4"><Currency amount={customer.totalSpent} className="font-semibold text-slate-950" /></td>
                        <td className="px-6 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getLoyaltyColor(customer.loyaltyTier)}`}>{t(customer.loyaltyTier)}</span></td>
                        <td className="px-6 py-4 text-sm text-slate-500">{formatDate(customer.lastVisit)}</td>
                        <td className="px-6 py-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/${locale}/dashboard/customers/${customer.id}`);
                            }}
                            className="inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/15"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                            <span>{isWalkInCustomer(customer) ? (locale === 'ar' ? 'تعديل الحضوري' : 'Edit walk-in') : (locale === 'ar' ? 'عرض/تعديل' : 'View / Edit')}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-slate-200 px-6 py-4">
                <p className="text-sm text-slate-500">
                  {t('showing')} {(page - 1) * 20 + 1}-{Math.min(page * 20, totalCustomers)} {t('of')} {totalCustomers}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                    {isRTL ? <ChevronRightIcon className="h-5 w-5" /> : <ChevronLeftIcon className="h-5 w-5" />}
                  </button>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                    {isRTL ? <ChevronLeftIcon className="h-5 w-5" /> : <ChevronRightIcon className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </TenantLayout>
  );
}

