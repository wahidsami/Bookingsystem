import type { ReactNode } from 'react';
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

export function buildSalesOverviewRows(data: SalesOverviewPayload): SalesOverviewRow[] {
  const revenueRows = Array.isArray(data.finance?.ledger?.revenueLedger?.rows)
    ? data.finance.ledger.revenueLedger.rows
    : [];

  return revenueRows.map((row: any) => {
    const saleNumber = `${row?.saleNumber || '-'}`.trim() || '-';
    const saleDate = row?.saleDate || '';
    const itemsSold = `${row?.itemsSold || '-'}`.trim() || '-';
    const appointmentReference = `${row?.appointmentReference || 'Unavailable'}`.trim() || 'Unavailable';
    const invoiceNumber = `${row?.invoiceNumber || 'Unavailable'}`.trim() || 'Unavailable';
    const location = `${row?.location || 'Unavailable'}`.trim() || 'Unavailable';
    const amountPaid = row?.amountPaid === null || row?.amountPaid === undefined ? null : Number(row.amountPaid);
    const remainingBalance = row?.remainingBalance === null || row?.remainingBalance === undefined ? null : Number(row.remainingBalance);
    const category = `${row?.category || '-'}`.trim() || '-';
    const grossSales = row?.grossSales ?? null;
    const discount = row?.discount ?? null;
    const vat = row?.vat ?? null;
    const refundAmount = row?.refundAmount ?? 0;
    const netSales = row?.netSales ?? null;
    const paymentMethod = `${row?.paymentMethod || '-'}`.trim() || '-';
    const status = `${row?.status || '-'}`.trim() || '-';

    return {
      id: String(row?.id || saleNumber),
      saleNumber,
      saleDate,
      invoiceNumber,
      customer: `${row?.customer || '-'}`.trim() || '-',
      employee: `${row?.employee || '-'}`.trim() || '-',
      channel: `${row?.channel || '-'}`.trim() || '-',
      items: itemsSold,
      itemsSold,
      grossSales: grossSales === null || grossSales === undefined ? null : Number(grossSales),
      discount: discount === null || discount === undefined ? null : Number(discount),
      vat: vat === null || vat === undefined ? null : Number(vat),
      refundAmount: refundAmount === null || refundAmount === undefined ? 0 : Number(refundAmount),
      netSales: netSales === null || netSales === undefined ? null : Number(netSales),
      paymentMethod,
      status,
      appointmentReference,
      location,
      amountPaid,
      remainingBalance,
      category,
      refundMode: row?.refundMode || null,
      detailPath: row?.detailPath || null,
      notes: row?.notes || null,
      sourceRow: row,
    };
  });
}

export function buildSalesOverviewFilterOptions(report: SalesOverviewPayload, isRtl: boolean) {
  const rows = buildSalesOverviewRows(report);
  const uniqueOptions = (values: unknown[]) => Array.from(
    new Set(values.map((value) => `${value ?? ''}`.trim()).filter(Boolean))
  ).map((value) => ({ label: value, value }));

  const employeeOptions = [
    { label: isRtl ? 'Ø¬Ù…ÙŠØ¹ Ø§Ù„Ù…ÙˆØ¸ÙÙŠÙ†' : 'All Employees', value: '' },
    ...uniqueOptions(rows.map((row) => row.employee))
  ];

  const serviceOptions = [
    { label: isRtl ? 'Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø®Ø¯Ù…Ø§Øª' : 'All Services', value: '' },
    ...uniqueOptions(rows.map((row) => row.itemsSold))
  ];

  const paymentMethodOptions = [
    { label: isRtl ? 'Ø¬Ù…ÙŠØ¹ Ø·Ø±Ù‚ Ø§Ù„Ø¯ÙØ¹' : 'All Payment Methods', value: '' },
    ...uniqueOptions(rows.map((row) => row.paymentMethod))
  ];

  const categoryOptions = [
    { label: isRtl ? 'Ø¬Ù…ÙŠØ¹ Ø§Ù„ØªØµÙ†ÙŠÙØ§Øª' : 'All Categories', value: '' },
    ...uniqueOptions(rows.map((row) => row.category))
  ];

  const statusOptions = [
    { label: isRtl ? 'Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø­Ø§Ù„Ø§Øª' : 'All Statuses', value: '' },
    ...uniqueOptions(rows.map((row) => row.status))
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
  if (rows.some((row) => row.itemsSold === '-')) gaps.add('Items Sold');
  if (rows.some((row) => row.grossSales == null)) gaps.add('Gross Sales');
  if (rows.some((row) => row.netSales == null)) gaps.add('Net Sales');
  if (rows.some((row) => row.refundAmount == null)) gaps.add('Refund Amount');
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
    { label: 'Items Sold', value: row.itemsSold },
    { label: 'Gross Sales', value: row.grossSales == null ? '-' : formatMoney(row.grossSales, lang) },
    { label: 'Discounts', value: row.discount == null ? '-' : formatMoney(row.discount, lang) },
    { label: 'Taxes', value: row.vat == null ? '-' : formatMoney(row.vat, lang) },
    { label: 'Refund Amount', value: row.refundAmount == null ? '-' : formatMoney(row.refundAmount, lang) },
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
