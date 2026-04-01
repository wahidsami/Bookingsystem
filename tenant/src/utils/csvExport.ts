/**
 * Client-side CSV export for tenant report tables.
 * Builds CSV from table data and triggers download.
 */

function escapeCsvCell(value: unknown): string {
  if (value == null) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers.map(escapeCsvCell).join(',')];
  rows.forEach((row) => lines.push(row.map(escapeCsvCell).join(',')));
  return lines.join('\n');
}

function downloadCsv(csvContent: string, filename: string) {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function exportEmployeesToCsv(employees: any[], startDate: string, endDate: string) {
  const headers = ['Employee', 'Bookings', 'Paid Bookings', 'Revenue Generated', 'Base Salary', 'Commission', 'Total Earnings'];
  const rows = (employees || []).map((e) => [
    e.name ?? '',
    e.totalBookings ?? 0,
    e.paidBookings ?? 0,
    e.totalRevenueGenerated ?? 0,
    e.baseSalary ?? 0,
    e.totalCommission ?? 0,
    e.totalEarnings ?? 0,
  ]);
  if (rows.length === 0) return false;
  downloadCsv(buildCsv(headers, rows), `employee-revenue-${startDate}-${endDate}`);
  return true;
}

export function exportServicesToCsv(services: any[], startDate: string, endDate: string, locale: string) {
  const nameKey = locale === 'ar' ? 'name_ar' : 'name_en';
  const headers = ['Service', 'Category', 'Bookings', 'Total Revenue', 'Tax', 'Platform Fees', 'Tenant Revenue'];
  const rows = (services || []).map((s) => [
    s[nameKey] ?? s.name_en ?? '',
    s.category ?? '',
    s.totalBookings ?? 0,
    s.totalRevenue ?? 0,
    s.totalTax ?? 0,
    s.totalPlatformFees ?? 0,
    s.totalTenantRevenue ?? 0,
  ]);
  if (rows.length === 0) return false;
  downloadCsv(buildCsv(headers, rows), `service-revenue-${startDate}-${endDate}`);
  return true;
}

export function exportProductsToCsv(products: any[], startDate: string, endDate: string, locale: string) {
  const nameKey = locale === 'ar' ? 'name_ar' : 'name_en';
  const headers = ['Product', 'Category', 'Orders', 'Quantity', 'Total Revenue', 'Platform Fees', 'Tenant Revenue'];
  const rows = (products || []).map((p) => [
    p[nameKey] ?? p.name_en ?? '',
    p.category ?? '',
    p.totalOrders ?? 0,
    p.totalQuantity ?? 0,
    p.totalRevenue ?? 0,
    p.totalPlatformFees ?? 0,
    p.totalTenantRevenue ?? 0,
  ]);
  if (rows.length === 0) return false;
  downloadCsv(buildCsv(headers, rows), `product-revenue-${startDate}-${endDate}`);
  return true;
}

export function exportDailyRevenueToCsv(daily: any[], startDate: string, endDate: string) {
  const headers = ['Date', 'Bookings', 'Orders', 'Revenue', 'Tenant Revenue'];
  const rows = (daily || []).map((d) => [
    d.date ?? '',
    d.bookings ?? 0,
    d.orders ?? 0,
    d.revenue ?? 0,
    d.tenantRevenue ?? 0,
  ]);
  if (rows.length === 0) return false;
  downloadCsv(buildCsv(headers, rows), `daily-revenue-${startDate}-${endDate}`);
  return true;
}

export function exportServicePerformanceToCsv(performance: any[], startDate: string, endDate: string, locale: string) {
  const nameKey = locale === 'ar' ? 'name_ar' : 'name_en';
  const headers = ['Service', 'Category', 'Total Bookings', 'Completed', 'Revenue', 'Avg Revenue', 'Completion Rate %'];
  const rows = (performance || []).map((s) => [
    s[nameKey] ?? s.name_en ?? '',
    s.category ?? '',
    s.totalBookings ?? 0,
    s.completedBookings ?? 0,
    s.revenue ?? 0,
    s.avgRevenue ?? 0,
    s.completionRate ?? 0,
  ]);
  if (rows.length === 0) return false;
  downloadCsv(buildCsv(headers, rows), `service-performance-${startDate}-${endDate}`);
  return true;
}

export function exportEmployeePerformanceToCsv(performance: any[], startDate: string, endDate: string) {
  const headers = ['Employee', 'Total Bookings', 'Completed', 'Revenue', 'Commission', 'Completion Rate %'];
  const rows = (performance || []).map((e) => [
    e.name ?? '',
    e.totalBookings ?? 0,
    e.completedBookings ?? 0,
    e.revenue ?? 0,
    e.commission ?? 0,
    e.completionRate ?? 0,
  ]);
  if (rows.length === 0) return false;
  downloadCsv(buildCsv(headers, rows), `employee-performance-${startDate}-${endDate}`);
  return true;
}

export function exportBookingTrendsToCsv(trends: any[], startDate: string, endDate: string) {
  const headers = ['Date', 'Bookings', 'Completed', 'Revenue'];
  const rows = (trends || []).map((t) => [t.date ?? '', t.bookings ?? 0, t.completed ?? 0, t.revenue ?? 0]);
  if (rows.length === 0) return false;
  downloadCsv(buildCsv(headers, rows), `booking-trends-${startDate}-${endDate}`);
  return true;
}
