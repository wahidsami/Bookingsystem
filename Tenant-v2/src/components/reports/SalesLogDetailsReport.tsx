import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CreditCard,
  FileText,
  Filter,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  BIActiveFilterSummary,
  BIDataTable,
  BIDetailsDrawer,
  BIKpiCards,
  BIReportFilters,
  BIReportShell,
  BIReportToolbar,
  BIPagination,
} from '../bi';
import {
  buildExportFileName,
  downloadCsv,
  downloadTextFile,
  resolveBIDateRange,
  serializeRowsToCsv,
  useBIColumnPreferences,
  useBISavedViews,
} from '../../lib/bi';
import { useBIReportRefreshSignal } from '../../lib/bi/refreshSignals';
import { tenantApiAdapter } from '../../lib/tenantApiAdapter';
import { createSalesLogDetailsReportDefinition, type SalesLogDetailsReportOptions, type SalesLogDetailsTableRow } from '../../lib/bi/reports/salesLogDetails';
import type { BIDatePresetValue, BIDateRange, BIOption, BIReportFilterValues, BIReportSortState } from '../../lib/bi';
import type { Language } from '../../types';

type SalesLogDetailsPayload = {
  overview?: any;
  revenueLedger?: any;
  paymentLedger?: any;
  refundLedger?: any;
  settlementLedger?: any;
  dateRange?: any;
};

function normalizeText(value: unknown): string {
  return `${value ?? ''}`.trim().toLowerCase();
}

function formatMoney(value: unknown, lang: Language): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Unavailable';
  return `${number.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${lang === 'ar' ? 'ر.س' : 'SAR'}`;
}

function formatDate(value: unknown, lang: Language): string {
  if (!value) return 'Unavailable';
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

function formatText(value: unknown): string {
  if (value === null || value === undefined || value === '' || value === '-') return 'Unavailable';
  return `${value}`;
}

function toOption(label: unknown, value: unknown): BIOption | null {
  const nextLabel = `${label ?? ''}`.trim();
  const nextValue = `${value ?? ''}`.trim();
  if (!nextLabel || !nextValue) return null;
  return { label: nextLabel, value: nextValue };
}

function dedupeOptions(options: BIOption[]) {
  const seen = new Set<string>();
  return options.filter((option) => {
    const value = `${option.value ?? ''}`.trim();
    if (!value) return false;
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function uniqueValues(rows: SalesLogDetailsTableRow[], accessor: (row: SalesLogDetailsTableRow) => string) {
  const seen = new Set<string>();
  const options: BIOption[] = [];
  rows.forEach((row) => {
    const value = `${accessor(row) || ''}`.trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    options.push({ label: value, value });
  });
  return options;
}

function buildPrintHtml({
  title,
  description,
  rows,
  columns,
  lang,
}: {
  title: string;
  description: string;
  rows: SalesLogDetailsTableRow[];
  columns: Array<{ header: ReactNode; accessor: any; format?: (value: unknown, row: SalesLogDetailsTableRow) => ReactNode }>;
  lang: Language;
}) {
  const renderValue = (row: SalesLogDetailsTableRow, column: { accessor: any; format?: (value: unknown, row: SalesLogDetailsTableRow) => ReactNode }) => {
    const rawValue = typeof column.accessor === 'function'
      ? column.accessor(row)
      : row[column.accessor as keyof SalesLogDetailsTableRow];
    const formatted = column.format ? column.format(rawValue, row) : rawValue;
    if (formatted === null || formatted === undefined || formatted === '') return 'Unavailable';
    if (typeof formatted === 'number') return formatted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${formatted}`;
  };

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
          <thead>
            <tr>${columns.map((column) => `<th>${column.header}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                ${columns.map((column) => `<td>${renderValue(row, column)}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;
}

function SectionBlock({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {icon ? <span className="text-slate-500">{icon}</span> : null}
            <h2 className="text-lg font-black tracking-tight text-slate-900">{title}</h2>
          </div>
          {description ? <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  const normalizedValue = value === null || value === undefined || value === '' || value === '-'
    ? 'Unavailable'
    : value;
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-semibold text-slate-900">{normalizedValue}</span>
    </div>
  );
}

function buildSalesLogRows(report: SalesLogDetailsPayload): SalesLogDetailsTableRow[] {
  const revenueRows = Array.isArray(report.revenueLedger?.rows) ? report.revenueLedger.rows : [];

  return revenueRows.flatMap((row: any) => {
    const invoiceItems = Array.isArray(row?.invoiceItems) && row.invoiceItems.length > 0 ? row.invoiceItems : [null];
    return invoiceItems.map((item: any, index: number) => {
      const rawItemType = `${item?.itemType || ''}`.trim().toLowerCase();
      const fallbackItemType = `${row?.entityType || ''}`.trim().toLowerCase() === 'appointment'
        ? 'service'
        : `${row?.entityType || ''}`.trim().toLowerCase() === 'order'
          ? 'product'
          : '';
      const itemType = rawItemType || fallbackItemType || 'Unavailable';
      const itemName = item?.itemNameEn
        || item?.itemNameAr
        || row?.service
        || row?.itemsSold
        || 'Unavailable';
      const quantity = item?.quantity === null || item?.quantity === undefined ? null : Number(item.quantity);
      const unitPrice = item?.unitPrice === null || item?.unitPrice === undefined ? null : Number(item.unitPrice);
      const gross = item?.gross === null || item?.gross === undefined
        ? (item?.lineTotal === null || item?.lineTotal === undefined ? null : Number(item.lineTotal))
        : Number(item.gross);
      const vat = item?.vat === null || item?.vat === undefined ? null : Number(item.vat);
      const net = item?.net === null || item?.net === undefined ? null : Number(item.net);

      return {
        id: `${row?.id || row?.reference || 'row'}:${item?.id || item?.itemRefId || index}`,
        dateTime: row?.date || row?.processedAt || row?.createdAt || '',
        saleNumber: formatText(row?.reference || row?.saleNumber || row?.id || 'Unavailable'),
        appointmentReference: formatText(row?.appointmentReference || row?.bookingReference || row?.bookingNumber || 'Unavailable'),
        invoiceNumber: formatText(row?.invoiceNumber || 'Unavailable'),
        customer: formatText(row?.customer || 'Unavailable'),
        employee: formatText(row?.employee || 'Unavailable'),
        itemType: formatText(itemType),
        itemName: formatText(itemName),
        category: formatText(item?.category || row?.category || 'Unavailable'),
        quantity,
        unitPrice,
        gross,
        discount: item?.discount === null || item?.discount === undefined ? null : Number(item.discount),
        vat,
        net,
        paymentMethod: formatText(row?.paymentMethodLabel || row?.paymentMethod || 'Unavailable'),
        status: formatText(row?.status || 'Unavailable'),
        location: formatText(row?.location || 'Unavailable'),
        sourceRow: row,
        sourceItem: item,
      };
    });
  });
}

function buildSalesLogBackendGaps(rows: SalesLogDetailsTableRow[]) {
  const gaps = new Set<string>();
  if (rows.some((row) => row.itemType === 'Unavailable')) gaps.add('Item Type');
  if (rows.some((row) => row.category === 'Unavailable')) gaps.add('Category');
  if (rows.some((row) => row.discount == null)) gaps.add('Discount');
  if (rows.some((row) => row.net == null)) gaps.add('Net');
  return Array.from(gaps);
}

export default function SalesLogDetailsReport({ lang }: { lang: Language }) {
  const isRtl = lang === 'ar';
  const reportId = 'sales-log-details';
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<SalesLogDetailsPayload>({});
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState<BIDatePresetValue>('last_30_days');
  const [customDateRange, setCustomDateRange] = useState<BIDateRange>({ from: '', to: '' });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<BIReportSortState>({ columnId: 'dateTime', direction: 'desc' });
  const [filterValues, setFilterValues] = useState<BIReportFilterValues>({
    customer: '',
    employee: '',
    category: '',
    itemType: '',
    paymentMethod: '',
    status: '',
    location: '',
  });
  const [drawerRow, setDrawerRow] = useState<SalesLogDetailsTableRow | null>(null);

  useBIReportRefreshSignal(() => setRefreshTick((tick) => tick + 1));

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
        try {
          const range = resolveBIDateRange(datePreset, customDateRange);
          const response = await tenantApiAdapter.getFinancialLedger({
            startDate: range.from,
            endDate: range.to,
            search,
            ...filterValues,
          });
        const payload = (response?.data || response || {}) as SalesLogDetailsPayload;
        if (!cancelled) {
          setReport(payload);
          setPage(1);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load sales log details report.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    }, [customDateRange, datePreset, filterValues, refreshTick, search]);

  const rows = useMemo(() => buildSalesLogRows(report), [report]);
  const reportDefinition = useMemo(() => {
    const customerOptions = dedupeOptions([
      { label: isRtl ? 'جميع العملاء' : 'All Customers', value: '' },
      ...uniqueValues(rows, (row) => row.customer),
    ]);
    const employeeOptions = dedupeOptions([
      { label: isRtl ? 'جميع الموظفين' : 'All Employees', value: '' },
      ...uniqueValues(rows, (row) => row.employee),
    ]);
    const categoryOptions = dedupeOptions([
      { label: isRtl ? 'كل التصنيفات' : 'All Categories', value: '' },
      ...uniqueValues(rows, (row) => row.category),
    ]);
    const itemTypeOptions = dedupeOptions([
      { label: isRtl ? 'كل الأنواع' : 'All Item Types', value: '' },
      ...uniqueValues(rows, (row) => row.itemType),
    ]);
    const paymentMethodOptions = dedupeOptions([
      { label: isRtl ? 'جميع طرق الدفع' : 'All Payment Methods', value: '' },
      ...uniqueValues(rows, (row) => row.paymentMethod),
    ]);
    const statusOptions = dedupeOptions([
      { label: isRtl ? 'جميع الحالات' : 'All Statuses', value: '' },
      ...uniqueValues(rows, (row) => row.status),
    ]);
    const locationOptions = dedupeOptions([
      { label: isRtl ? 'كل المواقع' : 'All Locations', value: '' },
      ...uniqueValues(rows, (row) => row.location),
    ]);

    const options: SalesLogDetailsReportOptions = {
      customers: customerOptions,
      employees: employeeOptions,
      categories: categoryOptions,
      itemTypes: itemTypeOptions,
      paymentMethods: paymentMethodOptions,
      statuses: statusOptions,
      locations: locationOptions,
    };

    return createSalesLogDetailsReportDefinition(options);
  }, [isRtl, rows]);

  useEffect(() => {
    setPageSize(reportDefinition.defaultPageSize || 10);
  }, [reportDefinition.defaultPageSize]);

  const columns = reportDefinition.columns || [];
  const { columnState, visibleColumns, toggleColumn, moveColumn, resetColumns } = useBIColumnPreferences(reportId, columns);
  const { savedViews, saveView, deleteView } = useBISavedViews(reportId);

  const filteredRows = useMemo(() => {
    const q = normalizeText(search);
    const selectedCustomer = normalizeText(filterValues.customer);
    const selectedEmployee = normalizeText(filterValues.employee);
    const selectedCategory = normalizeText(filterValues.category);
    const selectedItemType = normalizeText(filterValues.itemType);
    const selectedPaymentMethod = normalizeText(filterValues.paymentMethod);
    const selectedStatus = normalizeText(filterValues.status);
    const selectedLocation = normalizeText(filterValues.location);

    return rows.filter((row) => {
      if (q) {
        const text = [
          row.dateTime,
          row.saleNumber,
          row.appointmentReference,
          row.invoiceNumber,
          row.customer,
          row.employee,
          row.itemType,
          row.itemName,
          row.category,
          row.paymentMethod,
          row.status,
          row.location,
        ].join(' ').toLowerCase();
        if (!text.includes(q)) return false;
      }

      if (selectedCustomer && normalizeText(row.customer) !== selectedCustomer) return false;
      if (selectedEmployee && normalizeText(row.employee) !== selectedEmployee) return false;
      if (selectedCategory && normalizeText(row.category) !== selectedCategory) return false;
      if (selectedItemType && normalizeText(row.itemType) !== selectedItemType) return false;
      if (selectedPaymentMethod && normalizeText(row.paymentMethod) !== selectedPaymentMethod) return false;
      if (selectedStatus && normalizeText(row.status) !== selectedStatus) return false;
      if (selectedLocation && normalizeText(row.location) !== selectedLocation) return false;

      return true;
    });
  }, [filterValues, rows, search]);

  const totalPages = Math.max(Math.ceil(filteredRows.length / pageSize), 1);
  const paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  const overview = report.overview || {};
  const revenueRows = Array.isArray(report.revenueLedger?.rows) ? report.revenueLedger.rows : [];
  const totalAmount = Number((overview.totalRevenue ?? revenueRows.reduce((sum: number, row: any) => sum + Number(row?.revenue || 0), 0)) || 0);
  const totalVat = Number((overview.totalTax ?? revenueRows.reduce((sum: number, row: any) => sum + Number(row?.tax || 0), 0)) || 0);
  const totalDiscount = Number((overview.totalDiscount ?? revenueRows.reduce((sum: number, row: any) => sum + Number(row?.discount || 0), 0)) || 0);
  const totalRows = rows.length;
  const itemTypes = new Set(rows.map((row) => row.itemType).filter(Boolean));
  const customers = new Set(rows.map((row) => row.customer).filter(Boolean));
  const saleNumbers = new Set(rows.map((row) => row.saleNumber).filter(Boolean));

  const kpiItems = [
    { id: 'sales-log-rows', label: 'Line Items', value: totalRows.toLocaleString(), note: isRtl ? 'الصفوف المفصلة' : 'Detailed rows', icon: <ShoppingBag size={18} /> },
    { id: 'gross', label: 'Gross', value: formatMoney(totalAmount, lang), note: isRtl ? 'الإجمالي الخام' : 'Gross from ledger', icon: <TrendingUp size={18} /> },
    { id: 'vat', label: 'VAT', value: formatMoney(totalVat, lang), note: isRtl ? 'الضريبة' : 'VAT from ledger', icon: <FileText size={18} /> },
    { id: 'discounts', label: 'Discounts', value: formatMoney(totalDiscount, lang), note: isRtl ? 'الخصومات' : 'Discounts from ledger', icon: <Filter size={18} /> },
    { id: 'customers', label: 'Customers', value: customers.size.toLocaleString(), note: isRtl ? 'عملاء مميزون' : 'Unique customers', icon: <Sparkles size={18} /> },
    { id: 'sale-numbers', label: 'Sales', value: saleNumbers.size.toLocaleString(), note: isRtl ? 'أرقام المبيعات' : 'Unique sale numbers', icon: <CreditCard size={18} /> },
    { id: 'item-types', label: 'Item Types', value: itemTypes.size.toLocaleString(), note: isRtl ? 'أنواع العناصر' : 'Unique item types', icon: <Wallet size={18} /> },
  ];

  const backendGaps = useMemo(() => buildSalesLogBackendGaps(rows), [rows]);

  const handleExport = (format: 'csv' | 'excel' | 'pdf' | 'print') => {
    if (format === 'csv') {
      downloadCsv(buildExportFileName(String(reportDefinition.title), 'csv'), serializeRowsToCsv(filteredRows, visibleColumns));
      return;
    }
    if (format === 'excel') {
      downloadTextFile(
        buildExportFileName(String(reportDefinition.title), 'excel'),
        serializeRowsToCsv(filteredRows, visibleColumns),
        'application/vnd.ms-excel;charset=utf-8'
      );
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1280,height=900');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(buildPrintHtml({
      title: String(reportDefinition.title),
      description: String(reportDefinition.description || ''),
      rows: filteredRows,
      columns: visibleColumns,
      lang,
    }));
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
      if (format !== 'print') {
        setTimeout(() => printWindow.close(), 250);
      }
    };
  };

  const tableColumns = useMemo(() => columns.map((column) => {
    if (['unitPrice', 'gross', 'discount', 'vat', 'net'].includes(column.id)) {
      return { ...column, format: (value: unknown) => formatMoney(value, lang) };
    }
    if (column.id === 'quantity') {
      return { ...column, format: (value: unknown) => (value === null || value === undefined || value === '' ? 'Unavailable' : Number(value).toLocaleString()) };
    }
    if (column.id === 'dateTime') {
      return { ...column, format: (value: unknown) => formatDate(value, lang) };
    }
    return column;
  }), [columns, lang]);

  const selectedDrawerInvoiceItems = Array.isArray(drawerRow?.sourceRow?.invoiceItems) && drawerRow?.sourceRow?.invoiceItems.length
    ? drawerRow.sourceRow.invoiceItems
    : drawerRow
      ? [drawerRow.sourceItem || null]
      : [];
  const drawerServiceRows = selectedDrawerInvoiceItems.filter((item: any) => `${item?.itemType || ''}`.toLowerCase() === 'service');
  const drawerProductRows = selectedDrawerInvoiceItems.filter((item: any) => `${item?.itemType || ''}`.toLowerCase() === 'product');
  const drawerPaymentRows = drawerRow ? [drawerRow.sourceRow] : [];
  const drawerDiscountRows = drawerRow ? [drawerRow.sourceRow] : [];
  const drawerTaxRows = drawerRow ? [drawerRow.sourceRow] : [];
  const drawerTimelineRows = drawerRow ? [drawerRow.sourceRow] : [];

  return (
    <BIReportShell
      title={reportDefinition.title}
      description={reportDefinition.description}
      toolbar={
        <div className="space-y-4">
          <BIReportToolbar
            reportTitle={String(reportDefinition.title)}
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            onRefresh={() => setRefreshTick((tick) => tick + 1)}
            rows={filteredRows}
            columns={tableColumns}
            onExport={handleExport}
            onPrint={() => handleExport('print')}
            availableExports={['csv', 'excel', 'pdf', 'print']}
            datePreset={datePreset}
            onDatePresetChange={(preset) => {
              setDatePreset(preset);
              setPage(1);
            }}
            customDateRange={customDateRange}
            onCustomDateRangeChange={(next) => {
              setCustomDateRange(next);
              setPage(1);
            }}
            filtersOpen={filtersOpen}
            onToggleFilters={() => setFiltersOpen((open) => !open)}
            savedViews={savedViews}
            onSaveView={(name) => saveView(name, { search, datePreset, customDateRange, filters: filterValues, page, pageSize, sort })}
            onLoadSavedView={(view) => {
              setSearch(view.query.search);
              setDatePreset(view.query.datePreset);
              setCustomDateRange(view.query.customDateRange);
              setFilterValues(view.query.filters);
              setPage(view.query.page);
              setSort(view.query.sort);
            }}
            onDeleteSavedView={deleteView}
            columnState={columnState}
            onToggleColumn={toggleColumn}
            onMoveColumn={moveColumn}
            onResetColumns={resetColumns}
            summary={
              <BIActiveFilterSummary
                filters={reportDefinition.filters || []}
                values={filterValues}
                searchValue={search}
                onSearchChange={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
                datePreset={datePreset}
                onDatePresetChange={(preset) => {
                  setDatePreset(preset);
                  setPage(1);
                }}
                customDateRange={customDateRange}
                onCustomDateRangeChange={(next) => {
                  setCustomDateRange(next);
                  setPage(1);
                }}
                onFilterValuesChange={(next) => {
                  setFilterValues(next);
                  setPage(1);
                }}
              />
            }
          />

          <BIReportFilters
            open={filtersOpen}
            filters={reportDefinition.filters || []}
            values={filterValues}
            onApply={(next) => {
              setFilterValues(next);
              setPage(1);
            }}
            onReset={() => {
              setFilterValues({
                customer: '',
                employee: '',
                category: '',
                itemType: '',
                paymentMethod: '',
                status: '',
                location: '',
              });
              setPage(1);
            }}
            onClose={() => setFiltersOpen(false)}
          />
        </div>
      }
      kpis={<BIKpiCards items={kpiItems} />}
      table={
        <SectionBlock title="Sales Log Table" description="Detailed operational audit trail of sold items sourced from canonical invoices and the financial ledger." icon={<FileText size={18} />}>
          <BIDataTable<SalesLogDetailsTableRow>
            rows={paginatedRows}
            columns={visibleColumns}
            rowKey={(row) => row.id}
            loading={loading}
            sort={sort}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
            onRowClick={(row) => setDrawerRow(row)}
            emptyState={error ? error : 'No sales log entries found for the selected criteria.'}
          />

          {backendGaps.length ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={16} />
                Backend gaps
              </div>
              <p className="mt-2 leading-6">
                {backendGaps.join(', ')} are not exposed by the current backend payload for every row yet.
              </p>
            </div>
          ) : null}
        </SectionBlock>
      }
      pagination={
        <BIPagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={(next) => {
            setPageSize(next);
            setPage(1);
          }}
          totalItems={filteredRows.length}
        />
      }
      footer={reportDefinition.footer}
    >
      <BIDetailsDrawer<SalesLogDetailsTableRow>
        open={Boolean(drawerRow)}
        title={drawerRow?.saleNumber || String(reportDefinition.title)}
        subtitle={drawerRow?.itemName || undefined}
        row={drawerRow}
        onClose={() => setDrawerRow(null)}
        renderContent={(row) => (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">General</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Date / Time" value={formatDate(row.dateTime, lang)} />
                  <Field label="Sale Number" value={row.saleNumber} />
                  <Field label="Invoice Number" value={row.invoiceNumber} />
                  <Field label="Item Type" value={row.itemType} />
                  <Field label="Item Name" value={row.itemName} />
                  <Field label="Category" value={row.category} />
                  <Field label="Quantity" value={row.quantity == null ? 'Unavailable' : Number(row.quantity).toLocaleString()} />
                  <Field label="Unit Price" value={formatMoney(row.unitPrice, lang)} />
                  <Field label="Gross" value={formatMoney(row.gross, lang)} />
                  <Field label="Discount" value={formatMoney(row.discount, lang)} />
                  <Field label="VAT" value={formatMoney(row.vat, lang)} />
                  <Field label="Net" value={formatMoney(row.net, lang)} />
                  <Field label="Payment Method" value={row.paymentMethod} />
                  <Field label="Status" value={row.status} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Appointment</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Appointment Reference" value={row.appointmentReference} />
                  <Field label="Team Member" value={row.employee} />
                  <Field label="Customer" value={row.customer} />
                  <Field label="Location" value={row.location} />
                  <Field label="Status" value={row.status} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Services</div>
                <div className="mt-3 space-y-3 text-sm">
                  {drawerServiceRows.length ? drawerServiceRows.map((item: any, index: number) => (
                    <div key={item?.id || `${index}`} className="rounded-xl border border-slate-200 bg-white p-3">
                      <Field label="Service" value={item?.itemNameEn || item?.nameEn || item?.nameAr || 'Unavailable'} />
                      <Field label="Category" value={item?.category || 'Unavailable'} />
                      <Field label="Qty" value={item?.quantity == null ? 'Unavailable' : Number(item.quantity).toLocaleString()} />
                      <Field label="Unit Price" value={formatMoney(item?.unitPrice, lang)} />
                      <Field label="Gross" value={formatMoney(item?.gross ?? item?.lineTotal, lang)} />
                      <Field label="VAT" value={formatMoney(item?.vat ?? item?.taxAmount, lang)} />
                    </div>
                  )) : <div className="text-slate-500">Unavailable</div>}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Products</div>
                <div className="mt-3 space-y-3 text-sm">
                  {drawerProductRows.length ? drawerProductRows.map((item: any, index: number) => (
                    <div key={item?.id || `${index}`} className="rounded-xl border border-slate-200 bg-white p-3">
                      <Field label="Product" value={item?.itemNameEn || item?.nameEn || item?.nameAr || 'Unavailable'} />
                      <Field label="Category" value={item?.category || 'Unavailable'} />
                      <Field label="Qty" value={item?.quantity == null ? 'Unavailable' : Number(item.quantity).toLocaleString()} />
                      <Field label="Unit Price" value={formatMoney(item?.unitPrice, lang)} />
                      <Field label="Gross" value={formatMoney(item?.gross ?? item?.lineTotal, lang)} />
                      <Field label="VAT" value={formatMoney(item?.vat ?? item?.taxAmount, lang)} />
                    </div>
                  )) : <div className="text-slate-500">Unavailable</div>}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Payments</div>
                <div className="mt-3 space-y-2 text-sm">
                  {drawerPaymentRows.length ? (
                    <>
                  <Field label="Payment Method" value={row.paymentMethod} />
                  <Field label="Status" value={row.status} />
                  <Field label="Amount Paid" value={formatMoney(row.sourceRow?.amountPaid ?? row.sourceRow?.invoicePaidAmount, lang)} />
                  <Field label="Remaining Balance" value={formatMoney(row.sourceRow?.remainingBalance ?? row.sourceRow?.invoiceDueAmount, lang)} />
                  <Field label="Invoice Status" value={row.sourceRow?.invoiceStatus || 'Unavailable'} />
                    </>
                  ) : <div className="text-slate-500">Unavailable</div>}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Discounts</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="Discount" value={formatMoney(row.discount, lang)} />
                  <Field label="Discount Source" value={row.sourceItem?.discount == null ? 'Unavailable' : 'Invoice Item'} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Taxes</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Field label="VAT" value={formatMoney(row.vat, lang)} />
                  <Field label="Invoice VAT" value={formatMoney(row.sourceRow?.invoiceVatAmount, lang)} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 xl:col-span-2">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Timeline</div>
                <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase text-slate-500">Issued</div>
                    <div className="mt-1 font-semibold text-slate-900">{formatDate(row.sourceRow?.invoiceIssuedAt || row.dateTime, lang)}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase text-slate-500">Processed</div>
                    <div className="mt-1 font-semibold text-slate-900">{formatDate(row.sourceRow?.paidAt || row.dateTime, lang)}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase text-slate-500">Ledger Entry</div>
                    <div className="mt-1 font-semibold text-slate-900">{formatDate(row.dateTime, lang)}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Backend Snapshot</div>
              <pre className="mt-3 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(row.sourceRow || row, null, 2)}</pre>
            </div>
          </div>
        )}
      />
    </BIReportShell>
  );
}
