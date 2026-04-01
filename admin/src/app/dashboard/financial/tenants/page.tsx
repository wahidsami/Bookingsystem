'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import Link from 'next/link';
import { format, subDays } from 'date-fns';

// CSV Export utility
const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) {
    alert('No data to export');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value;
      }).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

type LeaderboardData = {
  rank: number;
  id: string;
  name: string;
  plan: string;
  bookings: number;
  gross_revenue: number;
  your_commission: number;
  tenant_earned: number;
  avg_per_booking: number;
  active_days: number;
};

export default function TenantLeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardData[]>([]);
  const [filteredLeaderboard, setFilteredLeaderboard] = useState<LeaderboardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<string>('30');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [minRevenue, setMinRevenue] = useState<string>('');
  const [maxRevenue, setMaxRevenue] = useState<string>('');

  useEffect(() => {
    fetchLeaderboard();
  }, [period]);

  useEffect(() => {
    applyFilters();
  }, [leaderboard, searchTerm, planFilter, minRevenue, maxRevenue]);

  const applyFilters = () => {
    let filtered = leaderboard;

    // Search by tenant name
    if (searchTerm.trim()) {
      filtered = filtered.filter((tenant) =>
        tenant.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by plan
    if (planFilter !== 'all') {
      filtered = filtered.filter(
        (tenant) => tenant.plan.toLowerCase() === planFilter.toLowerCase()
      );
    }

    // Filter by revenue range
    if (minRevenue) {
      const min = parseFloat(minRevenue);
      if (!isNaN(min)) {
        filtered = filtered.filter((tenant) => tenant.tenant_earned >= min);
      }
    }

    if (maxRevenue) {
      const max = parseFloat(maxRevenue);
      if (!isNaN(max)) {
        filtered = filtered.filter((tenant) => tenant.tenant_earned <= max);
      }
    }

    setFilteredLeaderboard(filtered);
  };

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);

      const startDate = format(
        subDays(new Date(), parseInt(period)),
        "yyyy-MM-dd'T'00:00:00'Z'"
      );
      const endDate = format(new Date(), "yyyy-MM-dd'T'23:59:59'Z'");

      const response = await adminApi.getTenantLeaderboard(50, startDate, endDate);

      if (!response.success) {
        throw new Error('Failed to fetch leaderboard');
      }

      setLeaderboard(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPlanBadgeColor = (plan: string) => {
    switch (plan?.toLowerCase()) {
      case 'professional':
        return 'bg-blue-100 text-blue-800';
      case 'starter':
        return 'bg-green-100 text-green-800';
      case 'enterprise':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleExport = () => {
    const exportData = filteredLeaderboard.map((tenant) => ({
      'Rank': tenant.rank,
      'Tenant Name': tenant.name,
      'Plan': tenant.plan,
      'Bookings': tenant.bookings,
      'Gross Revenue': `SAR ${tenant.gross_revenue.toLocaleString('en-SA', { minimumFractionDigits: 2 })}`,
      'Your Commission': `SAR ${tenant.your_commission.toLocaleString('en-SA', { minimumFractionDigits: 2 })}`,
      'Tenant Revenue': `SAR ${tenant.tenant_earned.toLocaleString('en-SA', { minimumFractionDigits: 2 })}`,
      'Avg Per Booking': `SAR ${tenant.avg_per_booking.toLocaleString('en-SA', { minimumFractionDigits: 2 })}`,
      'Active Days': tenant.active_days,
    }));
    exportToCSV(exportData, `tenant-leaderboard-${format(new Date(), 'yyyy-MM-dd')}`);
  };
  const uniquePlans = Array.from(new Set(leaderboard.map((t) => t.plan)));
  const totalRevenue = filteredLeaderboard.reduce((sum, item) => sum + item.tenant_earned, 0);
  const totalTenants = filteredLeaderboard.length;
  const averageRevenue = totalTenants > 0 ? totalRevenue / totalTenants : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tenant Leaderboard</h1>
          <p className="text-gray-600">Top performing tenants by revenue</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={loading || filteredLeaderboard.length === 0}
            className="rounded border border-green-300 bg-green-50 px-4 py-2 font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
          >
            📥 Export CSV
          </button>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded border border-gray-300 bg-white px-3 py-2"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Search Tenant</label>
            <input
              type="text"
              placeholder="Enter tenant name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Plan Type</label>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="all">All Plans</option>
              {uniquePlans.map((plan) => (
                <option key={plan} value={plan}>
                  {plan}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Min Revenue (SAR)</label>
            <input
              type="number"
              placeholder="0"
              value={minRevenue}
              onChange={(e) => setMinRevenue(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Max Revenue (SAR)</label>
            <input
              type="number"
              placeholder="No limit"
              value={maxRevenue}
              onChange={(e) => setMaxRevenue(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {(searchTerm || planFilter !== 'all' || minRevenue || maxRevenue) && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {filteredLeaderboard.length} of {leaderboard.length} tenants
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setPlanFilter('all');
                setMinRevenue('');
                setMaxRevenue('');
              }}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Tenant Revenue</p>
              <p className="mt-2 text-2xl font-bold">
                SAR {totalRevenue.toLocaleString('en-SA', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-500">from {totalTenants} active tenants</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average Revenue</p>
              <p className="mt-2 text-2xl font-bold">
                SAR {averageRevenue.toLocaleString('en-SA', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-500">per tenant</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Your Commission</p>
              <p className="mt-2 text-2xl font-bold text-green-600">
                SAR{' '}
                {leaderboard
                  .reduce((sum, item) => sum + item.your_commission, 0)
                  .toLocaleString('en-SA', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-500">platform earnings</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-6">
          <h3 className="text-lg font-semibold">Tenant Rankings</h3>
          <p className="text-sm text-gray-600">Click on a tenant to view detailed financial metrics</p>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="space-y-2">
              {Array(5)
                .fill(0)
                .map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded bg-gray-200" />
                ))}
            </div>
          ) : error ? (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
          ) : leaderboard.length === 0 ? (
            <div className="rounded-lg bg-gray-50 p-8 text-center">
              <p className="text-gray-600">No tenant data available for this period</p>
            </div>
          ) : filteredLeaderboard.length === 0 ? (
            <div className="rounded-lg bg-gray-50 p-8 text-center">
              <p className="text-gray-600">No tenants match your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-2 text-right font-semibold">Rank</th>
                    <th className="px-4 py-2 text-left font-semibold">Tenant</th>
                    <th className="px-4 py-2 text-left font-semibold">Plan</th>
                    <th className="px-4 py-2 text-right font-semibold">Bookings</th>
                    <th className="px-4 py-2 text-right font-semibold">Active Days</th>
                    <th className="px-4 py-2 text-right font-semibold">Gross Revenue</th>
                    <th className="px-4 py-2 text-right font-semibold">Net Revenue</th>
                    <th className="px-4 py-2 text-right font-semibold">Your Commission</th>
                    <th className="px-4 py-2 text-right font-semibold">Avg/Booking</th>
                    <th className="px-4 py-2 text-center font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaderboard.map((item, index) => (
                    <tr key={item.id} className={`border-b border-gray-100 hover:bg-gray-50 ${index < 3 ? 'bg-yellow-50' : ''}`}>
                      <td className="px-4 py-3 text-right font-bold">
                        {item.rank <= 3 && <span className="text-lg">🏆 </span>}
                        {item.rank}
                      </td>
                      <td className="px-4 py-3 font-medium">{item.name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${getPlanBadgeColor(item.plan)}`}>
                          {item.plan}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{item.bookings}</td>
                      <td className="px-4 py-3 text-right">{item.active_days}</td>
                      <td className="px-4 py-3 text-right">
                        SAR {item.gross_revenue.toLocaleString('en-SA', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        SAR {item.tenant_earned.toLocaleString('en-SA', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600">
                        SAR {item.your_commission.toLocaleString('en-SA', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        SAR {item.avg_per_booking.toLocaleString('en-SA', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link href={`/dashboard/financial/tenants/${item.id}`}>
                          <button className="rounded border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50">
                            Details
                          </button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
