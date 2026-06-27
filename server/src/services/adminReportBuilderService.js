const { Op, Sequelize } = require('sequelize');
const db = require('../models');

const DIMENSIONS = [
  { key: 'employee', label: 'Employee' },
  { key: 'service', label: 'Service' },
  { key: 'customer', label: 'Customer' },
  { key: 'product', label: 'Product' },
  { key: 'payment_method', label: 'Payment Method' },
  { key: 'appointment_status', label: 'Appointment Status' }
];

const METRICS = [
  { key: 'revenue', label: 'Revenue', kind: 'money' },
  { key: 'bookings', label: 'Bookings', kind: 'count' },
  { key: 'discounts', label: 'Discounts', kind: 'money' },
  { key: 'refunds', label: 'Refunds', kind: 'money' },
  { key: 'commissions', label: 'Commissions', kind: 'money' },
  { key: 'quantity_sold', label: 'Quantity Sold', kind: 'count' }
];

const GROUPINGS = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
  { key: 'employee', label: 'Employee' },
  { key: 'service', label: 'Service' }
];

const OUTPUT_TYPES = [
  { key: 'table', label: 'Table' },
  { key: 'chart', label: 'Chart' },
  { key: 'kpi_cards', label: 'KPI Cards' }
];

const DEFAULT_CONFIG = {
  dimensions: [],
  metrics: ['revenue'],
  grouping: 'month',
  outputType: 'table',
  chartType: 'bar',
  filters: {},
  scheduleConfig: {},
  comparisonMode: 'off'
};

const toNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const fullName = (firstName, lastName, fallback = '-') =>
  [firstName, lastName].filter(Boolean).join(' ').trim() || fallback;

const parseDate = (value, endOfDay = false) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    if (endOfDay) date.setHours(23, 59, 59, 999);
    else date.setHours(0, 0, 0, 0);
  }
  return date;
};

const formatBucketKey = (dateValue, grouping = 'day') => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');

  if (grouping === 'year') return `${year}`;
  if (grouping === 'month') return `${year}-${month}`;
  if (grouping === 'week') {
    const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNr = (copy.getUTCDay() + 6) % 7;
    copy.setUTCDate(copy.getUTCDate() - dayNr);
    const weekYear = copy.getUTCFullYear();
    const weekMonth = `${copy.getUTCMonth() + 1}`.padStart(2, '0');
    const weekDay = `${copy.getUTCDate()}`.padStart(2, '0');
    return `${weekYear}-${weekMonth}-${weekDay}`;
  }
  return `${year}-${month}-${day}`;
};

const formatBucketLabel = (bucketKey, grouping = 'day') => {
  if (!bucketKey) return 'Unknown';
  if (grouping === 'year') return bucketKey;
  if (grouping === 'month') return `${bucketKey}-01`;
  return bucketKey;
};

const calcNextRunAt = (scheduleConfig = {}, fromDate = new Date()) => {
  if (!scheduleConfig.enabled) return null;
  const cadence = `${scheduleConfig.cadence || 'daily'}`.toLowerCase();
  const timeOfDay = `${scheduleConfig.timeOfDay || '09:00'}`;
  const [hours, minutes] = timeOfDay.split(':').map((part) => parseInt(part, 10));
  const next = new Date(fromDate);
  next.setSeconds(0, 0);
  next.setHours(Number.isFinite(hours) ? hours : 9, Number.isFinite(minutes) ? minutes : 0, 0, 0);

  if (next <= fromDate) {
    if (cadence === 'weekly') {
      next.setDate(next.getDate() + 7);
    } else if (cadence === 'monthly') {
      next.setMonth(next.getMonth() + 1);
    } else {
      next.setDate(next.getDate() + 1);
    }
  }

  if (cadence === 'weekly' && Number.isInteger(scheduleConfig.dayOfWeek)) {
    while (next.getDay() !== scheduleConfig.dayOfWeek) {
      next.setDate(next.getDate() + 1);
    }
  }

  if (cadence === 'monthly' && Number.isInteger(scheduleConfig.dayOfMonth)) {
    const safeDay = Math.min(Math.max(scheduleConfig.dayOfMonth, 1), 28);
    next.setDate(safeDay);
    if (next <= fromDate) {
      next.setMonth(next.getMonth() + 1);
      next.setDate(safeDay);
    }
  }

  return next;
};

const normalizeSelection = (value, fallback = []) => {
  if (!Array.isArray(value)) return fallback;
  return value.map((item) => `${item}`.trim()).filter(Boolean);
};

const normalizeReportConfig = (input = {}) => {
  const dimensions = normalizeSelection(input.dimensions || input.selectedDimensions || [], DEFAULT_CONFIG.dimensions);
  const metrics = normalizeSelection(input.metrics || input.selectedMetrics || [], DEFAULT_CONFIG.metrics);
  const grouping = `${input.grouping || DEFAULT_CONFIG.grouping}`.trim() || DEFAULT_CONFIG.grouping;
  const outputType = `${input.outputType || DEFAULT_CONFIG.outputType}`.trim();
  const chartType = `${input.chartType || DEFAULT_CONFIG.chartType}`.trim() || DEFAULT_CONFIG.chartType;
  const filters = input.filters && typeof input.filters === 'object' && !Array.isArray(input.filters)
    ? input.filters
    : {};
  const scheduleConfig = input.scheduleConfig && typeof input.scheduleConfig === 'object' && !Array.isArray(input.scheduleConfig)
    ? input.scheduleConfig
    : {};

  return {
    reportType: `${input.reportType || 'custom'}`.trim() || 'custom',
    title: `${input.title || 'Custom Report'}`.trim(),
    description: `${input.description || ''}`.trim() || null,
    dimensions,
    metrics: metrics.length ? metrics : DEFAULT_CONFIG.metrics,
    grouping,
    outputType,
    chartType,
    filters,
    scheduleConfig: {
      enabled: Boolean(scheduleConfig.enabled),
      cadence: `${scheduleConfig.cadence || 'daily'}`.trim(),
      timeOfDay: `${scheduleConfig.timeOfDay || '09:00'}`.trim(),
      dayOfWeek: Number.isInteger(scheduleConfig.dayOfWeek) ? scheduleConfig.dayOfWeek : null,
      dayOfMonth: Number.isInteger(scheduleConfig.dayOfMonth) ? scheduleConfig.dayOfMonth : null,
      recipients: Array.isArray(scheduleConfig.recipients) ? scheduleConfig.recipients.filter(Boolean) : []
    },
    comparisonMode: `${input.comparisonMode || 'off'}`.trim() || 'off',
    compareStartDate: input.compareStartDate || null,
    compareEndDate: input.compareEndDate || null
  };
};

const buildSummarySeed = (metrics) => metrics.reduce((accumulator, metric) => {
  accumulator[metric] = 0;
  return accumulator;
}, {});

const cloneDate = (date) => new Date(date.getTime());

const shiftDateRange = (startDate, endDate, mode) => {
  if (!startDate || !endDate) return null;

  const start = cloneDate(startDate);
  const end = cloneDate(endDate);
  const spanMs = Math.max(end.getTime() - start.getTime(), 0);
  const days = Math.max(Math.round(spanMs / 86400000) + 1, 1);

  const shiftedStart = cloneDate(start);
  const shiftedEnd = cloneDate(end);

  if (mode === 'year_over_year') {
    shiftedStart.setFullYear(shiftedStart.getFullYear() - 1);
    shiftedEnd.setFullYear(shiftedEnd.getFullYear() - 1);
  } else if (mode === 'month_over_month') {
    shiftedStart.setMonth(shiftedStart.getMonth() - 1);
    shiftedEnd.setMonth(shiftedEnd.getMonth() - 1);
  } else {
    shiftedStart.setDate(shiftedStart.getDate() - days);
    shiftedEnd.setDate(shiftedEnd.getDate() - days);
  }

  return { startDate: shiftedStart, endDate: shiftedEnd };
};

const comparisonLabelMap = {
  current_previous: 'Previous Period',
  month_over_month: 'Previous Month',
  year_over_year: 'Previous Year',
  custom_vs_custom: 'Comparison Period'
};

const buildComparisonRange = (config = {}) => {
  const comparisonMode = `${config.comparisonMode || 'off'}`.toLowerCase();
  if (comparisonMode === 'off') return null;

  if (comparisonMode === 'custom_vs_custom') {
    const compareStartDate = parseDate(config.compareStartDate || config.filters?.compareStartDate, false);
    const compareEndDate = parseDate(config.compareEndDate || config.filters?.compareEndDate, true);
    if (!compareStartDate || !compareEndDate) return null;
    return { startDate: compareStartDate, endDate: compareEndDate };
  }

  const currentStart = parseDate(config.filters?.startDate, false) || (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  })();
  const currentEnd = parseDate(config.filters?.endDate, true) || new Date();
  return shiftDateRange(currentStart, currentEnd, comparisonMode);
};

const metricFieldMap = {
  revenue: 'revenue',
  bookings: 'bookings',
  discounts: 'discounts',
  refunds: 'refunds',
  commissions: 'commissions',
  quantity_sold: 'quantitySold'
};

const getMetricLabel = (metricKey) => (METRICS.find((item) => item.key === metricKey)?.label || metricKey);

const getDimensionLabel = (dimensionKey) => (DIMENSIONS.find((item) => item.key === dimensionKey)?.label || dimensionKey);

const buildWhereFilter = (filters = {}) => {
  const where = {};
  const startDate = parseDate(filters.startDate, false);
  const endDate = parseDate(filters.endDate, true);
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt[Op.gte] = startDate;
    if (endDate) where.createdAt[Op.lte] = endDate;
  }
  return where;
};

const getDimensionValue = (fact, dimensionKey) => {
  switch (dimensionKey) {
    case 'employee':
      return fact.employeeName || 'Unassigned';
    case 'service':
      return fact.serviceName || 'N/A';
    case 'customer':
      return fact.customerName || 'Guest';
    case 'product':
      return fact.productName || 'N/A';
    case 'payment_method':
      return fact.paymentMethod || 'N/A';
    case 'appointment_status':
      return fact.appointmentStatus || fact.orderStatus || fact.status || 'N/A';
    case 'day':
    case 'week':
    case 'month':
    case 'year':
      return formatBucketLabel(formatBucketKey(fact.date, dimensionKey), dimensionKey);
    default:
      return fact[dimensionKey] || 'N/A';
  }
};

const deriveGroupValue = (fact, grouping) => {
  if (!grouping) return null;
  if (['day', 'week', 'month', 'year'].includes(grouping)) {
    return formatBucketLabel(formatBucketKey(fact.date, grouping), grouping);
  }

  return getDimensionValue(fact, grouping);
};

async function fetchTransactionFacts(config, opts = {}) {
  const where = {
    status: { [Op.in]: ['completed', 'refunded'] },
    type: { [Op.in]: ['booking', 'product_purchase', 'refund'] },
    ...buildWhereFilter(config.filters)
  };

  const include = [
    {
      model: db.Appointment,
      as: 'appointment',
      attributes: ['id', 'status', 'startTime', 'price', 'rawPrice', 'platformFee', 'tenantRevenue', 'paymentMethod', 'tenantId', 'staffId', 'serviceId', 'platformUserId'],
      required: false,
      include: [
        { model: db.Service, as: 'service', attributes: ['id', 'name_en', 'name_ar', 'category'], required: false },
        { model: db.Staff, as: 'staff', attributes: ['id', 'name'], required: false },
        { model: db.PlatformUser, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email', 'phone'], required: false }
      ]
    },
    {
      model: db.Order,
      as: 'order',
      attributes: ['id', 'orderNumber', 'status', 'paymentMethod', 'paymentStatus', 'platformFee', 'totalAmount', 'subtotal', 'taxAmount', 'shippingFee', 'platformUserId', 'tenantId'],
      required: false,
      include: [
        { model: db.PlatformUser, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email', 'phone'], required: false },
        {
          model: db.OrderItem,
          as: 'items',
          attributes: ['id', 'productId', 'productName', 'productNameAr', 'quantity', 'unitPrice', 'totalPrice'],
          required: false,
          include: [
            { model: db.Product, as: 'product', attributes: ['id', 'name_en', 'name_ar', 'category', 'sku'], required: false }
          ]
        }
      ]
    },
    { model: db.PaymentMethod, as: 'paymentMethod', attributes: ['id', 'name', 'type', 'cardBrand'], required: false },
    { model: db.Tenant, as: 'tenant', attributes: ['id', 'name', 'name_en', 'name_ar'], required: false }
  ];

  const rows = await db.Transaction.findAll({
    where,
    include,
    order: [['createdAt', 'DESC']],
    subQuery: false
  });

  const facts = [];

  for (const transaction of rows || []) {
    const appointment = transaction.appointment || {};
    const service = appointment.service || {};
    const staff = appointment.staff || {};
    const order = transaction.order || {};
    const user = appointment.user || order.user || {};
    const paymentMethod = transaction.paymentMethod?.name || transaction.paymentMethod?.type || appointment.paymentMethod || order.paymentMethod || '-';
    const signedAmount = transaction.type === 'refund' || transaction.status === 'refunded'
      ? -Math.abs(toNumber(transaction.amount))
      : Math.abs(toNumber(transaction.amount));
    const refunds = transaction.type === 'refund' || transaction.status === 'refunded' ? Math.abs(toNumber(transaction.amount)) : 0;
    const commissions = transaction.type === 'refund' || transaction.status === 'refunded'
      ? -Math.abs(toNumber(transaction.platformFee))
      : Math.abs(toNumber(transaction.platformFee));
    const discounts = appointment.rawPrice && appointment.price
      ? Math.max(toNumber(appointment.rawPrice) - toNumber(appointment.price), 0)
      : Math.max((toNumber(order.subtotal) + toNumber(order.taxAmount) + toNumber(order.shippingFee)) - toNumber(order.totalAmount), 0);

    if (opts.productMode && Array.isArray(order.items) && order.items.length > 0) {
      const baseRevenue = order.items.reduce((sum, item) => sum + toNumber(item.totalPrice), 0) || 1;
      const baseDiscount = Math.max((toNumber(order.subtotal) + toNumber(order.taxAmount) + toNumber(order.shippingFee)) - toNumber(order.totalAmount), 0);
      order.items.forEach((item) => {
        const share = toNumber(item.totalPrice) / baseRevenue;
        const productName = item.productName || item.product?.name_en || item.product?.name_ar || 'Product';
        facts.push({
          date: transaction.createdAt,
          tenantId: transaction.tenantId || order.tenantId || appointment.tenantId || null,
          tenantName: transaction.tenant?.name || transaction.tenant?.name_en || transaction.tenant?.name_ar || '-',
          employeeId: appointment.staffId || null,
          employeeName: staff.name || 'Unassigned',
          serviceId: appointment.serviceId || null,
          serviceName: service.name_en || service.name_ar || 'N/A',
          customerId: transaction.platformUserId || order.platformUserId || appointment.platformUserId || null,
          customerName: fullName(user.firstName, user.lastName, 'Guest'),
          productId: item.productId || null,
          productName,
          paymentMethod,
          appointmentStatus: appointment.status || 'N/A',
          orderStatus: order.status || 'N/A',
          status: transaction.status || order.status || appointment.status || 'N/A',
          revenue: signedAmount * share,
          bookings: 0,
          discounts: baseDiscount * share,
          refunds: refunds * share,
          commissions: commissions * share,
          quantitySold: toNumber(item.quantity),
          orderId: order.id,
          transactionId: transaction.id
        });
      });
      continue;
    }

    facts.push({
      date: transaction.createdAt,
      tenantId: transaction.tenantId || order.tenantId || appointment.tenantId || null,
      tenantName: transaction.tenant?.name || transaction.tenant?.name_en || transaction.tenant?.name_ar || '-',
      employeeId: appointment.staffId || null,
      employeeName: staff.name || 'Unassigned',
      serviceId: appointment.serviceId || null,
      serviceName: service.name_en || service.name_ar || 'N/A',
      customerId: transaction.platformUserId || order.platformUserId || appointment.platformUserId || null,
      customerName: fullName(user.firstName, user.lastName, 'Guest'),
      productId: null,
      productName: null,
      paymentMethod,
      appointmentStatus: appointment.status || 'N/A',
      orderStatus: order.status || 'N/A',
      status: transaction.status || order.status || appointment.status || 'N/A',
      revenue: signedAmount,
      bookings: transaction.type === 'booking' ? 1 : 0,
      discounts,
      refunds,
      commissions,
      quantitySold: 0,
      orderId: order.id,
      transactionId: transaction.id
    });
  }

  return facts;
}

function applyBuilderFilters(facts, filters = {}) {
  return facts.filter((fact) => {
    if (filters.employeeId && `${fact.employeeId || ''}` !== `${filters.employeeId}`) return false;
    if (filters.customerId && `${fact.customerId || ''}` !== `${filters.customerId}`) return false;
    if (filters.serviceId && `${fact.serviceId || ''}` !== `${filters.serviceId}`) return false;
    if (filters.status && `${fact.status || ''}` !== `${filters.status}`) return false;
    return true;
  });
}

function aggregateFacts(facts, config) {
  const dimensions = normalizeSelection(config.dimensions);
  const metrics = normalizeSelection(config.metrics, DEFAULT_CONFIG.metrics);
  const grouping = `${config.grouping || DEFAULT_CONFIG.grouping}`.trim();
  const rowsMap = new Map();
  const summary = buildSummarySeed(metrics);

  facts.forEach((fact) => {
    const dimensionValues = dimensions.map((dimension) => ({
      key: dimension,
      label: getDimensionLabel(dimension),
      value: getDimensionValue(fact, dimension)
    }));
    const groupValue = deriveGroupValue(fact, grouping);
    const key = JSON.stringify({
      dimensions: dimensionValues.map((dimension) => dimension.value),
      grouping: groupValue
    });

    const existing = rowsMap.get(key) || {
      dimensions: {},
      grouping: groupValue,
      metrics: buildSummarySeed(metrics),
      recordCount: 0
    };

    dimensionValues.forEach((dimension) => {
      existing.dimensions[dimension.key] = dimension.value;
    });
    existing.recordCount += 1;

    metrics.forEach((metric) => {
      const field = metricFieldMap[metric];
      existing.metrics[metric] = (existing.metrics[metric] || 0) + toNumber(fact[field]);
      summary[metric] += toNumber(fact[field]);
    });

    rowsMap.set(key, existing);
  });

  const rows = Array.from(rowsMap.values()).map((row) => ({
    ...row.dimensions,
    grouping: row.grouping,
    recordCount: row.recordCount,
    ...metrics.reduce((accumulator, metric) => {
      accumulator[metric] = Number(toNumber(row.metrics[metric]).toFixed(2));
      return accumulator;
    }, {})
  }));

  rows.sort((left, right) => {
    if (typeof left.grouping === 'string' && typeof right.grouping === 'string' && left.grouping !== right.grouping) {
      return left.grouping.localeCompare(right.grouping);
    }
    return (right.revenue || 0) - (left.revenue || 0);
  });

  return {
    rows,
    summary: metrics.reduce((accumulator, metric) => {
      accumulator[metric] = Number(summary[metric].toFixed(2));
      return accumulator;
    }, {}),
    totals: {
      rows: rows.length,
      recordCount: rows.reduce((sum, row) => sum + Number(row.recordCount || 0), 0)
    }
  };
}

async function previewReport(config = {}) {
  const normalized = normalizeReportConfig(config);
  const productMode = normalized.dimensions.includes('product');
  const facts = await fetchTransactionFacts(normalized, { productMode });
  const filteredFacts = applyBuilderFilters(facts, normalized.filters);
  const result = aggregateFacts(filteredFacts, normalized);
  const comparisonRange = buildComparisonRange(normalized);
  let comparison = null;

  if (comparisonRange) {
    const comparisonConfig = {
      ...normalized,
      filters: {
        ...normalized.filters,
        startDate: comparisonRange.startDate.toISOString(),
        endDate: comparisonRange.endDate.toISOString()
      },
      comparisonMode: 'off'
    };
    const comparisonFacts = await fetchTransactionFacts(comparisonConfig, { productMode });
    const comparisonFilteredFacts = applyBuilderFilters(comparisonFacts, comparisonConfig.filters);
    const comparisonResult = aggregateFacts(comparisonFilteredFacts, comparisonConfig);
    comparison = {
      label: comparisonLabelMap[normalized.comparisonMode] || 'Comparison Period',
      summary: comparisonResult.summary,
      totals: comparisonResult.totals,
      rows: comparisonResult.rows,
      chart: buildChartPayload(comparisonResult.rows, normalized.metrics, normalized.outputType)
    };
  }

  return {
    config: normalized,
    dimensions: DIMENSIONS,
    metrics: METRICS,
    groupings: GROUPINGS,
    outputTypes: OUTPUT_TYPES,
    rows: result.rows,
    summary: result.summary,
    totals: result.totals,
    chart: buildChartPayload(result.rows, normalized.metrics, normalized.outputType),
    kpis: buildKpiPayload(result.summary, normalized.metrics),
    comparison
  };
}

function buildChartPayload(rows, metrics, outputType) {
  if (outputType !== 'chart' && outputType !== 'kpi_cards') {
    return { labels: [], series: [] };
  }

  const metric = metrics[0] || 'revenue';
  return {
    labels: rows.slice(0, 12).map((row) => row.grouping || row.employee || row.service || row.customer || row.product || 'Group'),
    series: rows.slice(0, 12).map((row) => Number(row[metric] || 0)),
    metric
  };
}

function buildKpiPayload(summary = {}, metrics = []) {
  return metrics.map((metric) => ({
    key: metric,
    label: getMetricLabel(metric),
    value: Number(summary[metric] || 0)
  }));
}

async function listSavedReports() {
  const reports = await db.AdminSavedReport.findAll({
    include: [
      {
        model: db.SuperAdmin,
        as: 'creator',
        attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
        required: false
      }
    ],
    order: [
      ['isFavorite', 'DESC'],
      ['updatedAt', 'DESC'],
      ['createdAt', 'DESC']
    ]
  });

  return reports;
}

function serializeSavedReport(report) {
  if (!report) return null;
  return {
    id: report.id,
    createdByAdminId: report.createdByAdminId,
    creator: report.creator ? {
      id: report.creator.id,
      name: fullName(report.creator.firstName, report.creator.lastName, report.creator.email || null),
      email: report.creator.email || null,
      role: report.creator.role || null
    } : null,
    reportType: report.reportType,
    title: report.title,
    description: report.description,
    dimensions: Array.isArray(report.dimensions) ? report.dimensions : [],
    metrics: Array.isArray(report.metrics) ? report.metrics : [],
    grouping: report.grouping || null,
    filters: report.filters || {},
    outputType: report.outputType || 'table',
    chartType: report.chartType || 'bar',
    reportConfig: report.reportConfig || {},
    scheduleConfig: report.scheduleConfig || {},
    isFavorite: Boolean(report.isFavorite),
    lastRunAt: report.lastRunAt || null,
    nextRunAt: report.nextRunAt || null,
    lastRunResult: report.lastRunResult || {},
    runHistory: Array.isArray(report.runHistory) ? report.runHistory : [],
    duplicatedFromId: report.duplicatedFromId || null,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt
  };
}

module.exports = {
  DIMENSIONS,
  METRICS,
  GROUPINGS,
  OUTPUT_TYPES,
  normalizeReportConfig,
  calcNextRunAt,
  previewReport,
  listSavedReports,
  serializeSavedReport
};
