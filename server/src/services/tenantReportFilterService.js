const { Op } = require('sequelize');

function normalizeText(value) {
  return `${value ?? ''}`.trim().toLowerCase();
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  const normalized = normalizeText(value);
  if (!normalized) return false;
  return ['true', '1', 'yes', 'on'].includes(normalized);
}

function parseList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean);
  }

  const normalized = normalizeText(value);
  if (!normalized) return [];

  try {
    if ((normalized.startsWith('[') && normalized.endsWith(']')) || (normalized.startsWith('{') && normalized.endsWith('}'))) {
      const parsed = JSON.parse(`${value}`);
      return parseList(parsed);
    }
  } catch {
    // ignore JSON parse fallthrough
  }

  return normalized
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => normalizeText(item))
    .filter((item) => !['all', 'any', 'none', 'select', 'default', '*'].includes(item));
}

function parseRange(value) {
  if (value == null || value === '') {
    return { min: null, max: null };
  }

  let source = value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return { min: null, max: null };
    }

    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        source = JSON.parse(trimmed);
      } catch {
        source = value;
      }
    }
  }

  if (Array.isArray(source)) {
    const [min, max] = source;
    return {
      min: min === undefined || min === null || `${min}`.trim() === '' ? null : Number(min),
      max: max === undefined || max === null || `${max}`.trim() === '' ? null : Number(max)
    };
  }

  if (source && typeof source === 'object') {
    const minValue = source.min ?? source.from ?? source.start ?? source.low ?? source.lower ?? null;
    const maxValue = source.max ?? source.to ?? source.end ?? source.high ?? source.upper ?? null;
    return {
      min: minValue === undefined || minValue === null || `${minValue}`.trim() === '' ? null : Number(minValue),
      max: maxValue === undefined || maxValue === null || `${maxValue}`.trim() === '' ? null : Number(maxValue)
    };
  }

  return { min: null, max: null };
}

function matchesSelection(value, selected) {
  if (!Array.isArray(selected) || selected.length === 0) {
    return true;
  }

  const normalized = normalizeText(value);
  if (!normalized) {
    return false;
  }

  return selected.includes(normalized);
}

function matchesSearch(values, search) {
  const normalizedSearch = normalizeText(search);
  if (!normalizedSearch) {
    return true;
  }

  const haystack = values
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .map((value) => `${value ?? ''}`.trim().toLowerCase())
    .filter(Boolean)
    .join(' ');

  return haystack.includes(normalizedSearch);
}

function matchesRange(value, range) {
  if (!range || (range.min === null && range.max === null)) {
    return true;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return false;
  }

  if (range.min !== null && Number.isFinite(range.min) && numeric < range.min) {
    return false;
  }

  if (range.max !== null && Number.isFinite(range.max) && numeric > range.max) {
    return false;
  }

  return true;
}

function buildReportFilterContext(query = {}) {
  return {
    search: normalizeText(query.search),
    employee: parseList(query.employee),
    customer: parseList(query.customer),
    location: parseList(query.location),
    channel: parseList(query.channel),
    paymentMethod: parseList(query.paymentMethod),
    status: parseList(query.status),
    paymentStatus: parseList(query.paymentStatus),
    orderStatus: parseList(query.orderStatus),
    appointmentStatus: parseList(query.appointmentStatus),
    source: parseList(query.source),
    customerType: parseList(query.customerType),
    discountCategory: parseList(query.discountCategory),
    discountType: parseList(query.discountType),
    taxType: parseList(query.taxType),
    transactionType: parseList(query.transactionType),
    giftCardCode: parseList(query.giftCardCode),
    service: parseList(query.service),
    category: parseList(query.category),
    product: parseList(query.product),
    refundsOnly: parseBoolean(query.refundsOnly),
    amountRange: parseRange(query.amountRange),
    grossSalesRange: parseRange(query.grossSalesRange),
    revenueRange: parseRange(query.revenueRange),
    paymentAmountRange: parseRange(query.paymentAmountRange),
    visitsRange: parseRange(query.visitsRange),
    quantityRange: parseRange(query.quantityRange),
    groupBy: normalizeText(query.groupBy) || 'day'
  };
}

function matchesAnySelection(values, selected) {
  if (!Array.isArray(selected) || selected.length === 0) {
    return true;
  }

  const normalizedValues = values
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .map((value) => normalizeText(value))
    .filter(Boolean);

  if (!normalizedValues.length) {
    return false;
  }

  return normalizedValues.some((value) => selected.includes(value));
}

function getAppointmentFilterValues(appointment = {}) {
  const service = appointment.service || {};
  const user = appointment.user || {};
  const staff = appointment.staff || {};
  const tenant = appointment.tenant || {};

  return {
    searchValues: [
      appointment.bookingNumber,
      appointment.bookingReference,
      appointment.id,
      appointment.status,
      appointment.price,
      appointment.rawPrice,
      appointment.taxAmount,
      appointment.totalPaid,
      service.name_en,
      service.name_ar,
      service.category,
      user.firstName,
      user.lastName,
      user.displayName,
      user.email,
      user.phone,
      staff.name,
      tenant.name,
      tenant.name_en,
      tenant.name_ar,
      tenant.city,
      tenant.address
    ],
    employee: staff.name,
    customer: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.displayName || user.email || user.phone,
    location: tenant.city || tenant.name_en || tenant.name_ar || tenant.name || tenant.address,
    paymentMethod: appointment.bookingSession?.paymentMethod || appointment.paymentMethod || null,
    status: appointment.status,
    service: service.name_en || service.name_ar || service.id,
    category: service.category,
    amount: appointment.price
  };
}

function matchesAppointmentFilters(appointment, filters) {
  const values = getAppointmentFilterValues(appointment);

  if (!matchesSearch(values.searchValues, filters.search)) return false;
  if (!matchesSelection(values.employee, filters.employee)) return false;
  if (!matchesSelection(values.customer, filters.customer)) return false;
  if (!matchesSelection(values.location, filters.location)) return false;
  if (!matchesSelection(values.paymentMethod, filters.paymentMethod)) return false;
  
  const statusFilter = (filters.appointmentStatus && filters.appointmentStatus.length) ? filters.appointmentStatus : filters.status;
  if (!matchesSelection(values.status, statusFilter)) return false;

  if (!matchesSelection(values.service, filters.service)) return false;
  if (!matchesSelection(values.category, filters.category)) return false;
  if (!matchesRange(values.amount, filters.amountRange)) return false;
  if (!matchesRange(values.amount, filters.grossSalesRange)) return false;
  if (!matchesRange(values.amount, filters.revenueRange)) return false;
  if (!matchesRange(values.amount, filters.paymentAmountRange)) return false;

  return true;
}

function getOrderFilterValues(order = {}) {
  const user = order.user || {};
  const tenant = order.tenant || {};
  const orderItems = Array.isArray(order.items) ? order.items : [];
  const itemNames = orderItems.map((item) => item?.product?.name_en || item?.product?.name_ar || item?.product?.name || item?.productId);
  const itemCategories = orderItems.map((item) => item?.product?.category);

  return {
    searchValues: [
      order.orderNumber,
      order.id,
      order.status,
      order.paymentStatus,
      order.paymentMethod,
      order.subtotal,
      order.taxAmount,
      order.shippingFee,
      order.totalAmount,
      user.firstName,
      user.lastName,
      user.displayName,
      user.email,
      user.phone,
      tenant.name,
      tenant.name_en,
      tenant.name_ar,
      tenant.city,
      tenant.address,
      itemNames,
      itemCategories
    ],
    employee: null,
    customer: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.displayName || user.email || user.phone,
    location: tenant.city || tenant.name_en || tenant.name_ar || tenant.name || tenant.address,
    channel: order.channel || order.source || (order?.id ? 'Order' : null),
    paymentMethod: order.paymentMethod,
    status: order.status,
    source: 'order',
    product: itemNames,
    category: itemCategories,
    amount: order.totalAmount
  };
}

function matchesOrderFilters(order, filters) {
  const values = getOrderFilterValues(order);

  if (!matchesSearch(values.searchValues, filters.search)) return false;
  if (!matchesSelection(values.customer, filters.customer)) return false;
  if (!matchesSelection(values.location, filters.location)) return false;
  if (!matchesSelection(values.channel, filters.channel)) return false;
  if (!matchesSelection(values.channel, filters.discountCategory)) return false;
  if (!matchesSelection(values.paymentMethod, filters.paymentMethod)) return false;
  
  const statusFilter = (filters.orderStatus && filters.orderStatus.length) ? filters.orderStatus : filters.status;
  if (!matchesSelection(values.status, statusFilter)) return false;

  if (!matchesSelection(values.source, filters.source)) return false;
  if (!matchesAnySelection(values.product, filters.product)) return false;
  if (!matchesAnySelection(values.category, filters.category)) return false;
  if (!matchesRange(values.amount, filters.amountRange)) return false;
  if (!matchesRange(values.amount, filters.grossSalesRange)) return false;
  if (!matchesRange(values.amount, filters.revenueRange)) return false;
  if (!matchesRange(values.amount, filters.paymentAmountRange)) return false;

  return true;
}

function getTransactionFilterValues(transaction = {}) {
  const appointment = transaction.appointment || {};
  const order = transaction.order || {};
  const user = appointment.user || order.user || {};
  const staff = appointment.staff || transaction.processor || {};
  const tenant = appointment.tenant || order.tenant || {};
  const service = appointment.service || {};
  const orderItems = Array.isArray(order.items) ? order.items : [];
  const productNames = orderItems.map((item) => item?.product?.name_en || item?.product?.name_ar || item?.product?.name || item?.productId);
  const productCategories = orderItems.map((item) => item?.product?.category);

  return {
    searchValues: [
      transaction.transactionRef,
      transaction.id,
      transaction.notes,
      transaction.status,
      transaction.type,
      transaction.paymentMethod,
      transaction.amount,
      appointment.bookingNumber,
      appointment.bookingReference,
      appointment.status,
      appointment.price,
      appointment.rawPrice,
      service.name_en,
      service.name_ar,
      service.category,
      order.orderNumber,
      order.status,
      order.paymentMethod,
      order.totalAmount,
      user.firstName,
      user.lastName,
      user.displayName,
      user.email,
      user.phone,
      staff.name,
      tenant.name,
      tenant.name_en,
      tenant.name_ar,
      tenant.city,
      tenant.address,
      productNames,
      productCategories
    ],
    employee: staff.name,
    customer: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.displayName || user.email || user.phone,
    location: tenant.city || tenant.name_en || tenant.name_ar || tenant.name || tenant.address,
    channel: appointment ? 'Appointment' : (order ? 'Order' : 'Transaction'),
    paymentMethod: transaction.paymentMethod,
    paymentStatus: transaction.status,
    orderStatus: order?.status || null,
    appointmentStatus: appointment?.status || null,
    source: appointment ? 'appointment' : (order ? 'order' : 'transaction'),
    transactionType: transaction.type,
    service: service.name_en || service.name_ar || service.id,
    category: service.category,
    product: productNames,
    amount: transaction.amount
  };
}

const PAYMENT_LIFECYCLE_STATUSES = ['completed', 'refunded', 'failed', 'pending', 'cancelled'];
const ORDER_FULFILLMENT_STATUSES = ['confirmed', 'processing', 'ready_for_pickup', 'shipped', 'delivered'];
const APPOINTMENT_LIFECYCLE_STATUSES = ['in_service', 'no_show'];

function matchesTransactionFilters(transaction, filters) {
  const values = getTransactionFilterValues(transaction);

  if (!matchesSearch(values.searchValues, filters.search)) return false;
  if (!matchesSelection(values.employee, filters.employee)) return false;
  if (!matchesSelection(values.customer, filters.customer)) return false;
  if (!matchesSelection(values.location, filters.location)) return false;
  if (!matchesSelection(values.channel, filters.channel)) return false;
  if (!matchesSelection(values.channel, filters.discountCategory)) return false;
  if (!matchesSelection(values.paymentMethod, filters.paymentMethod)) return false;

  // Domain 1: Payment Status
  const paymentStatusFilter = (filters.paymentStatus && filters.paymentStatus.length)
    ? filters.paymentStatus
    : (filters.status && filters.status.some((s) => PAYMENT_LIFECYCLE_STATUSES.includes(s))
        ? filters.status.filter((s) => PAYMENT_LIFECYCLE_STATUSES.includes(s))
        : []);
  if (paymentStatusFilter.length > 0 && !matchesSelection(values.paymentStatus, paymentStatusFilter)) {
    return false;
  }

  // Domain 2: Order Fulfillment Status
  const orderStatusFilter = (filters.orderStatus && filters.orderStatus.length)
    ? filters.orderStatus
    : (filters.status && filters.status.some((s) => ORDER_FULFILLMENT_STATUSES.includes(s))
        ? filters.status.filter((s) => ORDER_FULFILLMENT_STATUSES.includes(s))
        : []);
  if (orderStatusFilter.length > 0 && transaction.order && !matchesSelection(values.orderStatus, orderStatusFilter)) {
    return false;
  }

  // Domain 3: Appointment Booking Status
  const appointmentStatusFilter = (filters.appointmentStatus && filters.appointmentStatus.length)
    ? filters.appointmentStatus
    : (filters.status && filters.status.some((s) => APPOINTMENT_LIFECYCLE_STATUSES.includes(s))
        ? filters.status.filter((s) => APPOINTMENT_LIFECYCLE_STATUSES.includes(s))
        : []);
  if (appointmentStatusFilter.length > 0 && transaction.appointment && !matchesSelection(values.appointmentStatus, appointmentStatusFilter)) {
    return false;
  }

  if (!matchesSelection(values.source, filters.source)) return false;
  if (!matchesSelection(values.transactionType, filters.transactionType)) return false;
  if (!matchesSelection(values.service, filters.service)) return false;
  if (!matchesSelection(values.category, filters.category)) return false;
  if (!matchesAnySelection(values.product, filters.product)) return false;
  if (!matchesRange(values.amount, filters.amountRange)) return false;
  if (!matchesRange(values.amount, filters.grossSalesRange)) return false;
  if (!matchesRange(values.amount, filters.revenueRange)) return false;
  if (!matchesRange(values.amount, filters.paymentAmountRange)) return false;
  if (filters.refundsOnly && `${transaction.status || ''}`.trim().toLowerCase() !== 'refunded' && `${transaction.type || ''}`.trim().toLowerCase() !== 'refund') return false;

  return true;
}

function matchesGiftCardRowFilters(row, filters) {
  const searchValues = [
    row.giftCardCode,
    row.saleNumber,
    row.purchasedBy,
    row.redeemedBy,
    row.customer,
    row.status,
    row.issueDate,
    row.expiryDate,
    row.invoiceNumber,
    row.location,
    row.employee,
    row.paymentMethod
  ];

  if (!matchesSearch(searchValues, filters.search)) return false;
  if (!matchesSelection(row.status, filters.status)) return false;
  if (!matchesSelection(row.customer, filters.customer)) return false;
  if (!matchesSelection(row.employee, filters.employee)) return false;
  if (!matchesSelection(row.location, filters.location)) return false;
  if (!matchesSelection(row.giftCardCode, filters.giftCardCode)) return false;

  return true;
}

module.exports = {
  buildReportFilterContext,
  matchesAppointmentFilters,
  matchesOrderFilters,
  matchesTransactionFilters,
  matchesGiftCardRowFilters,
  matchesSearch,
  matchesRange,
  matchesSelection,
  matchesAnySelection,
  normalizeText
};
