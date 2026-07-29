import type { ReactNode } from 'react';
import type { BIOption } from '../types';
import type { Language } from '../../../types';
import type { SalesOverviewTableRow } from './salesOverview';

export type SalesOverviewRow = SalesOverviewTableRow & {
  appointmentReference?: string;
  location?: string;
  amountPaid?: number | null;
  remainingBalance?: number | null;
  itemsSold?: string;
  service?: string;
  entityType?: string;
  category?: string;
  refundMode?: string;
  sourceRow?: any;
};

export type SalesOverviewPayload = {
  summary?: any;
  sales?: any;
  customers?: any;
  employees?: any;
  services?: any;
  products?: any;
  payments?: any;
  finance?: any;
  performance?: any;
  executive?: any;
};

function normalizeText(value: unknown): string {
  return `${value ?? ''}`.trim().toLowerCase();
}

function formatMoney(value: unknown, lang: Language): string {
  const number = Number(value);
  const safe = Number.isFinite(number) ? number : 0;
  return `${safe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${lang === 'ar' ? 'Ø±.Ø³' : 'SAR'}`;
}

function formatDate(value: unknown, lang: Language): string {
  if (!value) return '-';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(lang === 'ar' ? 'ar-SA' : undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toOption(label: unknown, value: unknown): BIOption | null {
  const nextLabel = `${label ?? ''}`.trim();
  const nextValue = `${value ?? ''}`.trim();
  if (!nextLabel || !nextValue) return null;
  return { label: nextLabel, value: nextValue };
}

export function buildSalesOverviewRows(data: SalesOverviewPayload): SalesOverviewRow[] {
  const revenueRows = Array.isArray(data.finance?.ledger?.revenueLedger?.rows)
    ? data.finance.ledger.revenueLedger.rows
    : [];
  const refundRows = Array.isArray(data.finance?.ledger?.refundLedger?.rows)
    ? data.finance.ledger.refundLedger.rows
    : [];
  const refundByReference = new Map<string, any>();
  refundRows.forEach((refund: any) => {
    const key = `${refund?.reference || refund?.id || ''}`.trim();
    if (key) refundByReference.set(key, refund);
  });

  const serviceCategoryLookup = new Map<string, string>();
  (data.services?.performance || data.services?.revenue || []).forEach((service: any) => {
    const serviceName = `${service?.name_en || service?.nameEn || service?.name || ''}`.trim().toLowerCase();
    const category = `${service?.category || service?.categoryEn || service?.categoryAr || '-'}`.trim() || '-';
    if (serviceName) serviceCategoryLookup.set(serviceName, category);
  });

  return revenueRows.map((row: any) => {
    const reference = `${row?.reference || row?.saleNumber || row?.id || '-'}`.trim();
    const refund = refundByReference.get(reference) || refundByReference.get(`${row?.id || ''}`.trim()) || null;
    const saleDate = row?.date || row?.processedAt || row?.createdAt || '';
    const items = `${row?.service || row?.entityLabel || row?.items || '-'}`.trim() || '-';
    const appointmentReference = `${row?.appointmentReference || row?.bookingReference || row?.bookingNumber || ''}`.trim() || 'Unavailable';
    const invoiceNumber = `${row?.invoiceNumber || ''}`.trim() || 'Unavailable';
    const location = `${row?.location || row?.tenantLocation || row?.branch || ''}`.trim() || 'Unavailable';
    const amountPaid = row?.amountPaid === null || row?.amountPaid === undefined ? null : Number(row.amountPaid);
    const remainingBalance = row?.remainingBalance === null || row?.remainingBalance === undefined ? null : Number(row.remainingBalance);
    const category = serviceCategoryLookup.get(items.toLowerCase()) || '-';
    const grossSales = row?.grossSales ?? row?.revenue ?? null;
    const discount = row?.discount ?? null;
    const vat = row?.tax ?? null;
    const refundAmount = refund?.amount ?? row?.refund ?? null;
    const netSales = row?.netSales ?? null;
    const paymentMethod = `${row?.paymentMethodLabel || row?.paymentMethod || '-'}`.trim() || '-';
    const status = `${row?.status || '-'}`.trim() || '-';

    return {
      id: String(row?.id || reference),
      saleNumber: reference,
      invoiceNumber,
      saleDate,
      customer: `${row?.customer || '-'}`.trim() || '-',
      employee: `${row?.employee || '-'}`.trim() || '-',
      channel: `${row?.channel || row?.entityType || '-'}`.trim() || '-',
      items,
      itemsSold: `${row?.itemsSold || items || '-'}`.trim() || 'Unavailable',
      grossSales: grossSales === null || grossSales === undefined ? null : Number(grossSales),
      discount: discount === null || discount === undefined ? null : Number(discount),
      vat: vat === null || vat === undefined ? null : Number(vat),
      refund: refundAmount === null || refundAmount === undefined ? null : Number(refundAmount),
      netSales: netSales === null || netSales === undefined ? null : Number(netSales),
      paymentMethod,
      status,
      appointmentReference,
      location,
      amountPaid,
      remainingBalance,
      category,
      refundMode: refund?.refundMode || null,
      detailPath: row?.detailPath || refund?.detailPath || null,
      notes: row?.notes || refund?.reason || null,
      sourceRow: row,
    };
  });
}

export function buildSalesOverviewFilterOptions(report: SalesOverviewPayload, isRtl: boolean) {
  const employeeOptions = [
    { label: isRtl ? 'Ø¬Ù…ÙŠØ¹ Ø§Ù„Ù…ÙˆØ¸ÙÙŠÙ†' : 'All Employees', value: '' },
    ...(report.employees?.performance || report.employees?.revenue || [])
      .map((item: any) => toOption(item.name || item.nameEn || item.nameAr || item.id, item.name || item.nameEn || item.nameAr || item.id))
      .filter(Boolean) as BIOption[]
  ];

  const serviceOptions = [
    { label: isRtl ? 'Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø®Ø¯Ù…Ø§Øª' : 'All Services', value: '' },
    ...(report.services?.performance || report.services?.revenue || [])
      .map((item: any) => toOption(item.name_en || item.nameEn || item.name || item.id, item.name_en || item.nameEn || item.name || item.id))
      .filter(Boolean) as BIOption[]
  ];

  const paymentMethodOptions = [
    { label: isRtl ? 'Ø¬Ù…ÙŠØ¹ Ø·Ø±Ù‚ Ø§Ù„Ø¯ÙØ¹' : 'All Payment Methods', value: '' },
    ...(report.payments?.methods?.rows || [])
      .map((item: any) => toOption(item.paymentMethodLabel || item.paymentMethod || item.id, item.paymentMethod || item.id))
      .filter(Boolean) as BIOption[]
  ];

  const categoryOptions = [
    { label: isRtl ? 'Ø¬Ù…ÙŠØ¹ Ø§Ù„ØªØµÙ†ÙŠÙØ§Øª' : 'All Categories', value: '' },
    ...(report.services?.performance || report.services?.revenue || [])
      .map((item: any) => toOption(item.category || item.categoryEn || item.categoryAr || '-', item.category || item.categoryEn || item.categoryAr || '-'))
      .filter(Boolean) as BIOption[]
  ];

  const statusOptions = [
    { label: isRtl ? 'Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø­Ø§Ù„Ø§Øª' : 'All Statuses', value: '' },
    ...Array.from(
      new Set(
        (buildSalesOverviewRows(report).map((row) => row.status).filter(Boolean) as string[])
          .map((item) => item.trim())
      )
    ).map((value) => ({ label: value, value }))
  ];

  return {
    employees: employeeOptions,
    services: serviceOptions,
    paymentMethods: paymentMethodOptions,
    categories: categoryOptions,
    statuses: statusOptions,
  };
}

export function buildSalesOverviewBackendGaps(rows: SalesOverviewRow[]) {
  const gaps = new Set<string>();
  if (rows.some((row) => row.invoiceNumber === '-' || row.invoiceNumber === row.saleNumber)) gaps.add('Invoice Number');
  if (rows.some((row) => row.channel === '-')) gaps.add('Channel');
  if (rows.some((row) => row.items === '-')) gaps.add('Items');
  if (rows.some((row) => row.grossSales == null)) gaps.add('Gross Sales');
  if (rows.some((row) => row.netSales == null)) gaps.add('Net Sales');
  if (rows.some((row) => row.refund == null)) gaps.add('Refund');
  if (rows.some((row) => row.vat == null)) gaps.add('VAT');
  if (rows.some((row) => row.status === '-' || row.status === 'Unavailable')) gaps.add('Status');
  return Array.from(gaps);
}

export function buildSalesOverviewDrawerPairs(row: SalesOverviewRow | null, lang: Language) {
  if (!row) return [];
  return [
    { label: 'Sale Number', value: row.saleNumber },
    { label: 'Invoice Number', value: row.invoiceNumber },
    { label: 'Sale Date', value: formatDate(row.saleDate, lang) },
    { label: 'Customer', value: row.customer },
    { label: 'Employee', value: row.employee },
    { label: 'Channel', value: row.channel },
    { label: 'Status', value: row.status },
    { label: 'Items', value: row.items },
    { label: 'Gross Sales', value: row.grossSales == null ? '-' : formatMoney(row.grossSales, lang) },
    { label: 'Discounts', value: row.discount == null ? '-' : formatMoney(row.discount, lang) },
    { label: 'Taxes', value: row.vat == null ? '-' : formatMoney(row.vat, lang) },
    { label: 'Refund', value: row.refund == null ? '-' : formatMoney(row.refund, lang) },
    { label: 'Net Sales', value: row.netSales == null ? '-' : formatMoney(row.netSales, lang) },
    { label: 'Payment Method', value: row.paymentMethod },
    { label: 'Notes', value: row.notes || '-' },
  ];
}

export function buildSalesOverviewPrintHtml({
  title,
  description,
  rows,
  columns,
  lang,
}: {
  title: string;
  description: string;
  rows: SalesOverviewRow[];
  columns: any[];
  lang: Language;
}) {
  const thead = columns.map((column) => `<th>${column.header}</th>`).join('');
  const tbody = rows.map((row) => {
    const cells = columns.map((column) => {
      const rawValue = typeof column.accessor === 'function'
        ? column.accessor(row)
        : row[column.accessor as keyof SalesOverviewRow];
      const text = typeof rawValue === 'number'
        ? formatMoney(rawValue, lang)
        : `${rawValue ?? '-'}`;
      return `<td>${text}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; padding: 24px; }
          h1 { margin: 0 0 8px; }
          p { margin: 0 0 16px; color: #475569; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; vertical-align: top; }
          th { background: #f8fafc; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p>${description}</p>
        <table>
          <thead><tr>${thead}</tr></thead>
          <tbody>${tbody}</tbody>
        </table>
      </body>
    </html>
  `;
}
