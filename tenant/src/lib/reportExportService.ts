'use client';

import { tenantApi } from '@/lib/api';

export type ReportExportCell = string | number | boolean | null | undefined;

export type ReportExportTable = {
  title: string;
  columns: string[];
  rows: ReportExportCell[][];
  metadataRows?: Array<[string, ReportExportCell]>;
};

export type ReportExportPayload = {
  fileName?: string;
  reportTitle?: string;
  startDate: string;
  endDate: string;
  sections: string[];
  tables: ReportExportTable[];
  notes?: string;
};

type ReportExportSource = Record<string, any>;

function safeText(value: ReportExportCell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function escapeCsvCell(value: ReportExportCell): string {
  const text = safeText(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildDelimitedLines(payload: ReportExportPayload): string[] {
  const lines: string[] = [];

  if (payload.reportTitle) {
    lines.push(['Report', payload.reportTitle].map(escapeCsvCell).join(','));
  }

  lines.push(['Period', `${payload.startDate} - ${payload.endDate}`].map(escapeCsvCell).join(','));
  lines.push(['Sections', payload.sections.join(' | ') || ''].map(escapeCsvCell).join(','));

  if (payload.notes) {
    lines.push(['Notes', payload.notes].map(escapeCsvCell).join(','));
  }

  if (payload.tables.length > 0) {
    lines.push('');
  }

  payload.tables.forEach((table, index) => {
    if (index > 0) {
      lines.push('');
    }

    lines.push(escapeCsvCell(table.title));

    if (table.metadataRows?.length) {
      table.metadataRows.forEach(([label, value]) => {
        lines.push([label, value].map(escapeCsvCell).join(','));
      });
      lines.push('');
    }

    lines.push(table.columns.map(escapeCsvCell).join(','));
    table.rows.forEach((row) => {
      lines.push(row.map(escapeCsvCell).join(','));
    });
  });

  return lines;
}

function buildExcelHtml(payload: ReportExportPayload): string {
  const rows: string[] = [];

  const escapeXml = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const rowXml = (cells: ReportExportCell[]) => (
    `<Row>${
      cells.map((cell) => {
        const isNumber = typeof cell === 'number' && Number.isFinite(cell);
        const isBoolean = typeof cell === 'boolean';
        const text = escapeXml(safeText(cell));
        return `<Cell><Data ss:Type="${isNumber ? 'Number' : isBoolean ? 'Boolean' : 'String'}">${isBoolean ? (cell ? '1' : '0') : text}</Data></Cell>`;
      }).join('')
    }</Row>`
  );

  rows.push('<?xml version="1.0" encoding="UTF-8"?>');
  rows.push('<?mso-application progid="Excel.Sheet"?>');
  rows.push('<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">');
  rows.push('<Worksheet ss:Name="Report"><Table>');

  if (payload.reportTitle) {
    rows.push(rowXml(['Report', payload.reportTitle]));
  }

  rows.push(rowXml(['Period', `${payload.startDate} - ${payload.endDate}`]));
  rows.push(rowXml(['Sections', payload.sections.join(' | ') || '']));

  if (payload.notes) {
    rows.push(rowXml(['Notes', payload.notes]));
  }

  payload.tables.forEach((table) => {
    rows.push(rowXml([table.title]));

    if (table.metadataRows?.length) {
      table.metadataRows.forEach(([label, value]) => {
        rows.push(rowXml([label, value]));
      });
    }

    rows.push(rowXml(table.columns));
    if (table.rows.length > 0) {
      table.rows.forEach((row) => rows.push(rowXml(row)));
    } else {
      rows.push(rowXml(['No rows found.']));
    }
    rows.push(rowXml(['']));
  });

  rows.push('</Table></Worksheet></Workbook>');
  return rows.join('');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeFilePart(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildFileName(payload: ReportExportPayload, extension: 'csv' | 'xls') {
  const base =
    payload.fileName ||
    payload.reportTitle ||
    `report-${payload.startDate}-${payload.endDate}`;
  return `${sanitizeFilePart(base)}.${extension}`;
}

function buildPdfFileName(params: {
  startDate: string;
  endDate: string;
  title?: string;
}) {
  const base = params.title || `report-${params.startDate}-${params.endDate}`;
  return `${sanitizeFilePart(base)}.pdf`;
}

export async function exportPdf(params: {
  startDate: string;
  endDate: string;
  sections: string[];
  title?: string;
}): Promise<{ blob: Blob; filename: string }> {
  const file = await tenantApi.downloadReportPdf(params);
  if (typeof document !== 'undefined') {
    downloadBlob(file.blob, file.filename || buildPdfFileName(params));
  }
  return file;
}

export function exportCsv(payload: ReportExportPayload) {
  if (typeof document === 'undefined') return false;
  const content = buildDelimitedLines(payload).join('\n');
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, buildFileName(payload, 'csv'));
  return true;
}

export function exportExcel(payload: ReportExportPayload) {
  if (typeof document === 'undefined') return false;
  const html = buildExcelHtml(payload);
  const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  downloadBlob(blob, buildFileName(payload, 'xls'));
  return true;
}

export function printReport() {
  if (typeof window === 'undefined') return;

  const cleanup = () => document.body.classList.remove('report-preview-printing');
  document.body.classList.add('report-preview-printing');
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
  window.setTimeout(cleanup, 1000);
}

function localizedLabel(locale: string, en: string, ar: string) {
  return locale === 'ar' ? ar : en;
}

function numberRow(value: unknown) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function metricRows(metrics: Array<[string, ReportExportCell]>) {
  return metrics;
}

export function buildReportExportTables(params: {
  locale: string;
  sections: string[];
  data: ReportExportSource;
}) {
  const { locale, sections, data } = params;
  const tables: ReportExportTable[] = [];
  const include = (sectionId: string) => sections.includes(sectionId);
  const includeAny = (sectionIds: string[]) => sectionIds.some((sectionId) => sections.includes(sectionId));

  if (includeAny(['overview', 'executive']) && (data.overview || data.summary || data.financialOverview)) {
    const overview = data.overview || data.summary || data.financialOverview;
    tables.push({
      title: localizedLabel(locale, 'Executive overview', 'نظرة عامة تنفيذية'),
      columns: [
        localizedLabel(locale, 'Metric', 'المؤشر'),
        localizedLabel(locale, 'Value', 'القيمة')
      ],
      rows: metricRows([
        [localizedLabel(locale, 'Total revenue', 'إجمالي الإيرادات'), numberRow(overview.totalRevenue)],
        [localizedLabel(locale, 'Tenant revenue', 'إيراد المركز'), numberRow(overview.totalTenantRevenue)],
        [localizedLabel(locale, 'Net revenue', 'صافي الإيرادات'), numberRow(overview.netRevenue)],
        [localizedLabel(locale, 'Total bookings', 'إجمالي الحجوزات'), numberRow(overview.totalBookings)],
        [localizedLabel(locale, 'Completed bookings', 'الحجوزات المكتملة'), numberRow(overview.completedBookings)],
        [localizedLabel(locale, 'Pending payments', 'المدفوعات المعلقة'), numberRow(overview.pendingPayments)]
      ])
    });
  }

  if (includeAny(['sales', 'appointments', 'daily', 'bookingTrends'])) {
    const trends = data.bookingTrends || data.dailyRevenue || [];
    if (trends.length) {
      tables.push({
        title: localizedLabel(locale, 'Sales and booking trends', 'اتجاهات المبيعات والحجوزات'),
        columns: [
          localizedLabel(locale, 'Date', 'التاريخ'),
          localizedLabel(locale, 'Bookings', 'الحجوزات'),
          localizedLabel(locale, 'Completed', 'المكتملة'),
          localizedLabel(locale, 'Revenue', 'الإيراد')
        ],
        rows: trends.map((trend: any) => [
          trend.date ?? '',
          numberRow(trend.bookings),
          numberRow(trend.completed),
          numberRow(trend.revenue ?? trend.totalRevenue ?? 0)
        ])
      });
    }
  }

  if (includeAny(['financial', 'discounts', 'refunds', 'paymentMethods']) && (data.financialOverview || data.overview)) {
    const financial = data.financialOverview || data.overview;
    tables.push({
      title: localizedLabel(locale, 'Financial summary', 'الملخص المالي'),
      columns: [
        localizedLabel(locale, 'Metric', 'المؤشر'),
        localizedLabel(locale, 'Value', 'القيمة')
      ],
      rows: metricRows([
        [localizedLabel(locale, 'Gross revenue', 'الإيراد الخام'), numberRow(financial.totalRevenue)],
        [localizedLabel(locale, 'Tenant revenue', 'إيراد المركز'), numberRow(financial.totalTenantRevenue)],
        [localizedLabel(locale, 'Net revenue', 'صافي الإيرادات'), numberRow(financial.netRevenue)],
        [localizedLabel(locale, 'Taxes', 'الضرائب'), numberRow(financial.totalTax)],
        [localizedLabel(locale, 'Platform fees', 'رسوم المنصة'), numberRow(financial.totalPlatformFees)],
        [localizedLabel(locale, 'Employee commissions', 'عمولات الموظفين'), numberRow(financial.totalEmployeeCommissions)]
      ])
    });
  }

  if (include('rebookings') && data.rebookings) {
    tables.push({
      title: localizedLabel(locale, 'Rebooking analytics', 'تحليلات إعادة الحجز'),
      columns: [
        localizedLabel(locale, 'Date', 'التاريخ'),
        localizedLabel(locale, 'Rebookings', 'إعادة الحجز'),
        localizedLabel(locale, 'Revenue', 'الإيراد')
      ],
      rows: (data.rebookings.trend || []).map((item: any) => [
        item.date ?? '',
        numberRow(item.rebookings ?? item.count ?? 0),
        numberRow(item.rebookedRevenue ?? item.revenue ?? 0)
      ])
    });
    if (data.rebookings.topRebookingEmployees?.length) {
      tables.push({
        title: localizedLabel(locale, 'Top rebooking employees', 'أفضل الموظفين في إعادة الحجز'),
        columns: [
          localizedLabel(locale, 'Employee', 'الموظف'),
          localizedLabel(locale, 'Rebookings', 'إعادة الحجز'),
          localizedLabel(locale, 'Revenue', 'الإيراد')
        ],
        rows: data.rebookings.topRebookingEmployees.map((item: any) => [
          item.name ?? item.employeeName ?? '',
          numberRow(item.rebookings ?? item.count ?? 0),
          numberRow(item.rebookedRevenue ?? item.revenue ?? 0)
        ])
      });
    }
  }

  if (include('employees') && data.employees?.length) {
    tables.push({
      title: localizedLabel(locale, 'Employee revenue', 'إيراد الموظفين'),
      columns: [
        localizedLabel(locale, 'Employee', 'الموظف'),
        localizedLabel(locale, 'Bookings', 'الحجوزات'),
        localizedLabel(locale, 'Revenue generated', 'الإيراد'),
        localizedLabel(locale, 'Commission', 'العمولة'),
        localizedLabel(locale, 'Total earnings', 'الإجمالي')
      ],
      rows: data.employees.map((item: any) => [
        item.name ?? '',
        numberRow(item.totalBookings),
        numberRow(item.totalRevenueGenerated ?? item.revenue ?? 0),
        numberRow(item.totalCommission ?? item.commission ?? 0),
        numberRow(item.totalEarnings ?? item.totalRevenueGenerated ?? 0)
      ])
    });
  }

  if (include('services') && data.services?.length) {
    tables.push({
      title: localizedLabel(locale, 'Service performance', 'أداء الخدمات'),
      columns: [
        localizedLabel(locale, 'Service', 'الخدمة'),
        localizedLabel(locale, 'Bookings', 'الحجوزات'),
        localizedLabel(locale, 'Revenue', 'الإيراد'),
        localizedLabel(locale, 'Tenant revenue', 'إيراد المركز')
      ],
      rows: data.services.map((item: any) => [
        locale === 'ar' ? item.name_ar ?? item.name_en ?? '' : item.name_en ?? item.name_ar ?? '',
        numberRow(item.totalBookings),
        numberRow(item.totalRevenue),
        numberRow(item.totalTenantRevenue)
      ])
    });
  }

  if (include('products') && data.products?.length) {
    tables.push({
      title: localizedLabel(locale, 'Product performance', 'أداء المنتجات'),
      columns: [
        localizedLabel(locale, 'Product', 'المنتج'),
        localizedLabel(locale, 'Orders', 'الطلبات'),
        localizedLabel(locale, 'Quantity', 'الكمية'),
        localizedLabel(locale, 'Revenue', 'الإيراد'),
        localizedLabel(locale, 'Tenant revenue', 'إيراد المركز')
      ],
      rows: data.products.map((item: any) => [
        locale === 'ar' ? item.name_ar ?? item.name_en ?? '' : item.name_en ?? item.name_ar ?? '',
        numberRow(item.totalOrders),
        numberRow(item.totalQuantity),
        numberRow(item.totalRevenue),
        numberRow(item.totalTenantRevenue)
      ])
    });
  }

  if (include('discounts') && data.discounts) {
    tables.push({
      title: localizedLabel(locale, 'Discounts report', 'تقرير الخصومات'),
      columns: [
        localizedLabel(locale, 'Metric', 'المؤشر'),
        localizedLabel(locale, 'Value', 'القيمة')
      ],
      rows: metricRows([
        [localizedLabel(locale, 'Total discounts', 'إجمالي الخصومات'), numberRow(data.discounts.totalDiscountAmount)],
        [localizedLabel(locale, 'Booking discounts', 'خصومات الحجوزات'), numberRow(data.discounts.appointmentDiscountAmount)],
        [localizedLabel(locale, 'Order discounts', 'خصومات الطلبات'), numberRow(data.discounts.orderDiscountAmount)],
        [localizedLabel(locale, 'Average discount', 'متوسط الخصم'), numberRow(data.discounts.averageDiscountAmount)]
      ])
    });
  }

  if (include('refunds') && data.refunds?.rows?.length) {
    tables.push({
      title: localizedLabel(locale, 'Refunds report', 'تقرير الاستردادات'),
      columns: [
        localizedLabel(locale, 'Date', 'التاريخ'),
        localizedLabel(locale, 'Customer', 'العميل'),
        localizedLabel(locale, 'Reference', 'المرجع'),
        localizedLabel(locale, 'Amount', 'المبلغ'),
        localizedLabel(locale, 'Reason', 'السبب'),
        localizedLabel(locale, 'Payment method', 'طريقة الدفع')
      ],
      rows: data.refunds.rows.map((item: any) => [
        item.date ?? '',
        item.customerName ?? item.customer ?? '',
        item.reference ?? item.referenceType ?? '',
        numberRow(item.amount),
        item.reason ?? item.refundReason ?? '',
        item.paymentMethodLabel ?? item.paymentMethod ?? ''
      ])
    });
  }

  if (include('paymentMethods') && data.paymentMethods?.rows?.length) {
    tables.push({
      title: localizedLabel(locale, 'Payment methods', 'طرق الدفع'),
      columns: [
        localizedLabel(locale, 'Method', 'الطريقة'),
        localizedLabel(locale, 'Revenue', 'الإيراد'),
        localizedLabel(locale, 'Transactions', 'العمليات'),
        localizedLabel(locale, 'Share %', 'النسبة %')
      ],
      rows: data.paymentMethods.rows.map((item: any) => [
        item.paymentMethodLabel ?? item.paymentMethod ?? '',
        numberRow(item.revenue ?? item.totalRevenue ?? item.collected ?? 0),
        numberRow(item.transactionCount),
        numberRow(item.share ?? item.percentage ?? 0)
      ])
    });
    if (data.paymentMethods.trend?.length) {
      tables.push({
        title: localizedLabel(locale, 'Payment method trends', 'اتجاهات طرق الدفع'),
        columns: [
          localizedLabel(locale, 'Date', 'التاريخ'),
          localizedLabel(locale, 'Method', 'الطريقة'),
          localizedLabel(locale, 'Revenue', 'الإيراد'),
          localizedLabel(locale, 'Transactions', 'العمليات')
        ],
        rows: data.paymentMethods.trend.map((item: any) => [
          item.date ?? '',
          item.paymentMethodLabel ?? item.paymentMethod ?? '',
          numberRow(item.revenue ?? item.totalRevenue ?? item.collected ?? 0),
          numberRow(item.transactionCount)
        ])
      });
    }
  }

  if (includeAny(['customerSales', 'customerAnalytics']) && data.customerAnalytics?.topCustomers?.length) {
    tables.push({
      title: localizedLabel(locale, 'Customer sales', 'مبيعات العملاء'),
      columns: [
        localizedLabel(locale, 'Customer', 'العميل'),
        localizedLabel(locale, 'Bookings', 'الحجوزات'),
        localizedLabel(locale, 'Completed', 'المكتملة'),
        localizedLabel(locale, 'Revenue', 'الإيراد'),
        localizedLabel(locale, 'Last visit', 'آخر زيارة')
      ],
      rows: data.customerAnalytics.topCustomers.map((item: any) => [
        item.name ?? item.customerName ?? item.id ?? '',
        numberRow(item.bookings),
        numberRow(item.completed),
        numberRow(item.revenue),
        item.lastVisit ?? ''
      ])
    });
  }

  if (include('peakHours') && data.peakHours) {
    tables.push({
      title: localizedLabel(locale, 'Peak hours', 'ساعات الذروة'),
      columns: [
        localizedLabel(locale, 'Metric', 'المؤشر'),
        localizedLabel(locale, 'Value', 'القيمة')
      ],
      rows: metricRows([
        [localizedLabel(locale, 'Peak hours', 'ساعات الذروة'), Array.isArray(data.peakHours.peakHours) ? data.peakHours.peakHours.join(', ') : ''],
        [localizedLabel(locale, 'Busiest days', 'الأيام الأكثر ازدحاماً'), Array.isArray(data.peakHours.busiestDays) ? data.peakHours.busiestDays.join(', ') : '']
      ])
    });
  }

  if (include('appointments')) {
    const appointmentsSummary = data.summary || data.overview || data.financialOverview;
    if (appointmentsSummary) {
      tables.push({
        title: localizedLabel(locale, 'Appointment performance', 'أداء المواعيد'),
        columns: [
          localizedLabel(locale, 'Metric', 'المؤشر'),
          localizedLabel(locale, 'Value', 'القيمة')
        ],
        rows: metricRows([
          [localizedLabel(locale, 'Total bookings', 'إجمالي الحجوزات'), numberRow(appointmentsSummary.totalBookings)],
          [localizedLabel(locale, 'Completed bookings', 'الحجوزات المكتملة'), numberRow(appointmentsSummary.completedBookings)],
          [localizedLabel(locale, 'Cancelled bookings', 'الحجوزات الملغاة'), numberRow(appointmentsSummary.cancelledBookings)],
          [localizedLabel(locale, 'No-show bookings', 'حالات عدم الحضور'), numberRow(appointmentsSummary.noShowBookings)]
        ])
      });
    }
  }

  if (include('sales') && data.summary) {
    tables.push({
      title: localizedLabel(locale, 'Sales summary', 'ملخص المبيعات'),
      columns: [
        localizedLabel(locale, 'Metric', 'المؤشر'),
        localizedLabel(locale, 'Value', 'القيمة')
      ],
      rows: metricRows([
        [localizedLabel(locale, 'Total revenue', 'إجمالي الإيرادات'), numberRow(data.summary.totalRevenue)],
        [localizedLabel(locale, 'Average booking value', 'متوسط قيمة الحجز'), numberRow(data.summary.avgBookingValue)],
        [localizedLabel(locale, 'Completion rate', 'معدل الإكمال'), numberRow(data.summary.completionRate)],
        [localizedLabel(locale, 'Unique customers', 'العملاء الفريدون'), numberRow(data.summary.uniqueCustomers)]
      ])
    });
  }

  if (include('refunds') && data.posClosingSummary) {
    tables.push({
      title: localizedLabel(locale, 'Refunds and collections', 'الاستردادات والتحصيل'),
      columns: [
        localizedLabel(locale, 'Metric', 'المؤشر'),
        localizedLabel(locale, 'Value', 'القيمة')
      ],
      rows: metricRows([
        [localizedLabel(locale, 'Gross collected', 'إجمالي التحصيل'), numberRow(data.posClosingSummary.grossCollected)],
        [localizedLabel(locale, 'Refunds total', 'إجمالي الاستردادات'), numberRow(data.posClosingSummary.refundsTotal)],
        [localizedLabel(locale, 'Net collected', 'صافي التحصيل'), numberRow(data.posClosingSummary.netCollected)],
        [localizedLabel(locale, 'Transactions', 'العمليات'), numberRow(data.posClosingSummary.transactionCount)]
      ])
    });
  }

  return tables;
}
