'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { format, subDays } from 'date-fns';
import Link from 'next/link';

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

type TenantFinancial = {
  id: string;
  name: string;
  plan: string;
  tenant_status: string;
  total_bookings: number;
  gross_revenue: number;
  platform_commission: number;
  net_revenue: number;
  avg_booking_value: number;
  pending_transactions: number;
  failed_transactions: number;
};

type EmployeeMetric = {
  id: string;
  name: string;
  commissionRate: number;
  total_appointments: number;
  days_worked: number;
  hours_worked: number;
  avg_duration_minutes: number;
  commission_earned: number;
  total_value_handled: number;
};

type Transaction = {
  id: string;
  createdAt: string;
  tenant_name: string;
  transaction_type: string;
  item_name: string;
  amount: number;
  your_fee: number;
  tenant_revenue: number;
  payment_status: string;
  paymentMethod: string;
};

export default function TenantDetailPage() {
  const params = useParams();
  const tenantId = params.id as string;

  const [tenant, setTenant] = useState<TenantFinancial | null>(null);
  const [employees, setEmployees] = useState<EmployeeMetric[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<string>('30');

  useEffect(() => {
    fetchData();
  }, [tenantId, period]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const startDate = format(
        subDays(new Date(), parseInt(period)),
        "yyyy-MM-dd'T'00:00:00'Z'"
      );
      const endDate = format(new Date(), "yyyy-MM-dd'T'23:59:59'Z'");

      const [tenantRes, employeesRes, transactionsRes] = await Promise.all([
        adminApi.getTenantFinancials(tenantId, startDate, endDate),
        adminApi.getTenantEmployeeMetrics(tenantId, startDate, endDate),
        adminApi.getTransactionDetails(tenantId, 50, 0),
      ]);

      if (tenantRes.success && Array.isArray(tenantRes.data)) {
        setTenant(tenantRes.data[0] || null);
      }

      if (employeesRes.success) {
        setEmployees(Array.isArray(employeesRes.data) ? employeesRes.data : []);
      }

      if (transactionsRes.success) {
        setTransactions(Array.isArray(transactionsRes.data) ? transactionsRes.data : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching tenant details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportEmployees = () => {
    const exportData = employees.map((emp) => ({
      'Employee Name': emp.name,
      'Appointments': emp.total_appointments,
      'Hours Worked': emp.hours_worked.toFixed(2),
      'Days Worked': emp.days_worked,
      'Avg Duration (min)': emp.avg_duration_minutes,
      'Commission Rate': `${emp.commissionRate}%`,
      'Commission Earned': `SAR ${emp.commission_earned.toLocaleString('en-SA', { minimumFractionDigits: 2 })}`,
      'Value Handled': `SAR ${emp.total_value_handled.toLocaleString('en-SA', { minimumFractionDigits: 2 })}`,
    }));
    exportToCSV(exportData, `${tenant?.name}-staff-${format(new Date(), 'yyyy-MM-dd')}`);
  };

  const handleExportTransactions = () => {
    const exportData = transactions.map((txn) => ({
      'Date': format(new Date(txn.createdAt), 'yyyy-MM-dd HH:mm:ss'),
      'Type': txn.transaction_type,
      'Item': txn.item_name,
      'Amount': `SAR ${txn.amount.toLocaleString('en-SA', { minimumFractionDigits: 2 })}`,
      'Platform Fee': `SAR ${txn.your_fee.toLocaleString('en-SA', { minimumFractionDigits: 2 })}`,
      'Tenant Revenue': `SAR ${txn.tenant_revenue.toLocaleString('en-SA', { minimumFractionDigits: 2 })}`,
      'Payment Method': txn.paymentMethod || 'N/A',
      'Status': txn.payment_status,
    }));
    exportToCSV(exportData, `${tenant?.name}-transactions-${format(new Date(), 'yyyy-MM-dd')}`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {Array(5)
          .fill(0)
          .map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-gray-200" />
          ))}
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        {error || 'Tenant not found'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/financial/tenants">
            <button className="rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              ← Back
            </button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{tenant.name}</h1>
            <p className="text-gray-600">Plan: {tenant.plan}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportEmployees}
            disabled={loading || employees.length === 0}
            className="rounded border border-blue-300 bg-blue-50 px-4 py-2 font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            📥 Staff CSV
          </button>
          <button
            onClick={handleExportTransactions}
            disabled={loading || transactions.length === 0}
            className="rounded border border-purple-300 bg-purple-50 px-4 py-2 font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50"
          >
            📥 Transactions CSV
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

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm font-medium text-gray-600">Gross Revenue</p>
          <p className="mt-2 text-2xl font-bold">
            SAR {tenant.gross_revenue.toLocaleString('en-SA', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-500">from customers</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm font-medium text-gray-600">Net Revenue</p>
          <p className="mt-2 text-2xl font-bold text-green-600">
            SAR {tenant.net_revenue.toLocaleString('en-SA', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-500">after commission</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm font-medium text-gray-600">Bookings</p>
          <p className="mt-2 text-2xl font-bold">{tenant.total_bookings}</p>
          <p className="text-xs text-gray-500">
            Avg: SAR {tenant.avg_booking_value.toLocaleString('en-SA', { maximumFractionDigits: 2 })}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm font-medium text-gray-600">Your Commission</p>
          <p className="mt-2 text-2xl font-bold text-orange-600">
            SAR {tenant.platform_commission.toLocaleString('en-SA', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-500">paid to you</p>
        </div>
      </div>

      {/* Employee Metrics */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-6">
          <h3 className="text-lg font-semibold">Staff Performance</h3>
          <p className="text-sm text-gray-600">Hours worked and commission earned</p>
        </div>
        <div className="p-6">
          {employees.length === 0 ? (
            <p className="text-sm text-gray-600">No employee data available</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-2 text-left font-semibold">Employee</th>
                    <th className="px-4 py-2 text-right font-semibold">Appointments</th>
                    <th className="px-4 py-2 text-right font-semibold">Hours Worked</th>
                    <th className="px-4 py-2 text-right font-semibold">Days Active</th>
                    <th className="px-4 py-2 text-right font-semibold">Avg Duration</th>
                    <th className="px-4 py-2 text-right font-semibold">Commission Rate</th>
                    <th className="px-4 py-2 text-right font-semibold">Earned</th>
                    <th className="px-4 py-2 text-right font-semibold">Value Handled</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{emp.name}</td>
                      <td className="px-4 py-3 text-right">{emp.total_appointments}</td>
                      <td className="px-4 py-3 text-right">
                        {emp.hours_worked.toLocaleString('en-SA', { maximumFractionDigits: 1 })} hrs
                      </td>
                      <td className="px-4 py-3 text-right">{emp.days_worked}</td>
                      <td className="px-4 py-3 text-right">
                        {emp.avg_duration_minutes.toLocaleString('en-SA', { maximumFractionDigits: 0 })} min
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-block rounded border border-gray-300 bg-gray-50 px-2 py-1">
                          {emp.commissionRate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        SAR {emp.commission_earned.toLocaleString('en-SA', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        SAR {emp.total_value_handled.toLocaleString('en-SA', { maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-6">
          <h3 className="text-lg font-semibold">Recent Transactions</h3>
          <p className="text-sm text-gray-600">Latest 50 completed transactions</p>
        </div>
        <div className="p-6">
          {transactions.length === 0 ? (
            <p className="text-sm text-gray-600">No transactions found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-2 text-left font-semibold">Date</th>
                    <th className="px-4 py-2 text-left font-semibold">Type</th>
                    <th className="px-4 py-2 text-left font-semibold">Item</th>
                    <th className="px-4 py-2 text-right font-semibold">Amount</th>
                    <th className="px-4 py-2 text-right font-semibold">Your Fee</th>
                    <th className="px-4 py-2 text-right font-semibold">Tenant Revenue</th>
                    <th className="px-4 py-2 text-left font-semibold">Payment Method</th>
                    <th className="px-4 py-2 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        {format(new Date(tx.createdAt), 'MMM dd, yyyy HH:mm')}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block rounded border border-gray-300 bg-gray-50 px-2 py-1 capitalize">
                          {tx.transaction_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">{tx.item_name}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        SAR {tx.amount.toLocaleString('en-SA', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right text-orange-600">
                        SAR {tx.your_fee.toLocaleString('en-SA', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        SAR {tx.tenant_revenue.toLocaleString('en-SA', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-sm">{tx.paymentMethod}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded px-2 py-1 text-xs font-semibold ${
                            tx.payment_status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : tx.payment_status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {tx.payment_status}
                        </span>
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
