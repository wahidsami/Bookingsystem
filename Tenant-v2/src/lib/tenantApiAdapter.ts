import { API_BASE_URL, API_ORIGIN } from './apiConfig';
import { normalizeEmployeeAvatarCollection } from './employeeImage';
import { normalizeServiceCollection, normalizeServiceRecord } from './serviceContract';
import { normalizeProductCollection, normalizeProductRecord } from './productContract';

export { API_BASE_URL, API_ORIGIN } from './apiConfig';

const ACCESS_TOKEN_KEY = 'rifah_tenant_access_token';
const REFRESH_TOKEN_KEY = 'rifah_tenant_refresh_token';
const FETCH_BRIDGE_FLAG = '__tenant_v2_fetch_bridge_installed__';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type TenantApiResponse<T = any> = {
  success?: boolean;
  data?: T;
  message?: string;
  error?: string;
  [key: string]: any;
};

type CustomerListResponse<T = any> = {
  customers: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    [key: string]: any;
  };
};

type NormalizedCustomerStats = Record<string, any>;
type CanonicalCustomerListItem = Record<string, any>;
type CanonicalCustomerProfile = Record<string, any>;
type CanonicalCustomerHistory = Record<string, any>;
type CanonicalCustomerTransaction = Record<string, any>;

function toAbsoluteUrl(input: RequestInfo | URL): URL {
  if (input instanceof URL) {
    return new URL(input.toString(), window.location.origin);
  }

  if (typeof input === 'string') {
    return new URL(input, window.location.origin);
  }

  return new URL(input.url, window.location.origin);
}

function isTenantApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/v1/') || pathname.startsWith('/auth/tenant/');
}

function shouldRetryUnauthorizedRequest(pathname: string): boolean {
  return true;
}

function createJsonResponse(body: any, init: ResponseInit & { headers?: HeadersInit } = {}): Response {
  const headers = new Headers(init.headers || {});
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json; charset=utf-8');
  }
  return new Response(JSON.stringify(body), {
    ...init,
    headers
  });
}

function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function pick<T = any>(value: any, keys: string[]): T | undefined {
  if (!value || typeof value !== 'object') return undefined;
  for (const key of keys) {
    if (value[key] !== undefined) return value[key];
  }
  return undefined;
}

function unwrapPayload(payload: any): any {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  if ('data' in payload && payload.data !== undefined) {
    return payload.data;
  }

  return payload;
}

function toArray(value: any): any[] {
  return Array.isArray(value) ? value : [];
}

function toNumber(value: any, fallback = 0): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toStringValue(value: any, fallback = ''): string {
  if (value === null || value === undefined) {
    return fallback;
  }

  const normalized = `${value}`.trim();
  return normalized.length > 0 ? normalized : fallback;
}

function normalizePersonName(source: any, fallback = 'Guest'): string {
  const firstName = toStringValue(source?.firstName || source?.first_name || '');
  const lastName = toStringValue(source?.lastName || source?.last_name || '');
  return toStringValue(
    source?.name || source?.fullName || source?.displayName || `${firstName} ${lastName}`.trim(),
    fallback
  );
}

function normalizeCustomerListItem(record: any): CanonicalCustomerListItem {
  const firstName = toStringValue(record?.firstName || record?.first_name || '');
  const lastName = toStringValue(record?.lastName || record?.last_name || '');
  const avatar = record?.avatar || record?.photo || record?.profileImage || null;
  const joinedAt = record?.joinedAt || record?.memberSince || record?.createdAt || '';
  const totalProductsPurchased = toNumber(record?.totalProductsPurchased ?? record?.productsPurchased ?? 0);
  const averageBookings = toNumber(record?.averageBookingsPerCustomer ?? record?.avgBookings ?? 0);
  const notes = Array.isArray(record?.notes)
    ? record.notes
    : typeof record?.notes === 'string' && record.notes.trim().length > 0
      ? [record.notes]
      : [];

  return {
    ...record,
    id: record?.id || '',
    firstName,
    lastName,
    name: normalizePersonName(record, 'Guest'),
    nameEn: normalizePersonName(record, 'Guest'),
    nameAr: normalizePersonName(record, 'ضيف'),
    fullName: normalizePersonName(record, 'Guest'),
    avatar,
    photo: avatar,
    profileImage: avatar,
    joinedAt,
    memberSince: record?.memberSince || joinedAt,
    totalBookings: toNumber(record?.totalBookings ?? record?.stats?.totalAppointments ?? 0),
    totalOrders: toNumber(record?.totalOrders ?? 0),
    totalProductsPurchased,
    productsPurchased: totalProductsPurchased,
    totalSpent: toNumber(record?.totalSpent ?? 0),
    lastVisit: record?.lastVisit || '',
    firstVisit: record?.firstVisit || '',
    loyaltyTier: record?.loyaltyTier || '',
    loyaltyPoints: toNumber(record?.loyaltyPoints ?? 0),
    noShowCount: toNumber(record?.noShowCount ?? 0),
    cancellationCount: toNumber(record?.cancellationCount ?? 0),
    avgBookings: averageBookings,
    averageBookingsPerCustomer: averageBookings,
    tags: Array.isArray(record?.tags) ? record.tags : [],
    notes,
    customerType: record?.customerType || record?.type || '',
    isWalkIn: Boolean(record?.isWalkIn),
    gender: record?.gender || '',
    email: record?.email || '',
    phone: record?.phone || ''
  };
}

function normalizeCustomerStatsPayload(payload: any): NormalizedCustomerStats {
  const data = unwrapPayload(payload) || {};
  const averageBookingsPerCustomer = toNumber(data?.averageBookingsPerCustomer ?? data?.avgBookings ?? 0);
  return {
    ...data,
    totalCustomers: toNumber(data?.totalCustomers ?? 0),
    newCustomersThisMonth: toNumber(data?.newCustomersThisMonth ?? data?.newCustomers ?? 0),
    returningCustomers: toNumber(data?.returningCustomers ?? 0),
    returningRate: toNumber(data?.returningRate ?? 0),
    averageBookingsPerCustomer,
    avgBookings: averageBookingsPerCustomer,
    loyaltyTierDistribution: data?.loyaltyTierDistribution || {}
  };
}

function normalizeCustomerTransactionRecord(record: any, sourceHint = ''): CanonicalCustomerTransaction {
  const source = toStringValue(record?.source || sourceHint || 'transaction');
  const paymentMethod = toStringValue(record?.paymentMethod || record?.method || record?.payment_method || '');
  const paymentMethodLabel = toStringValue(record?.paymentMethodLabel || record?.paymentMethod || record?.method || paymentMethod || '—');
  const rawKind = toStringValue(record?.kind || record?.entityType || record?.recordType || record?.type || record?.sourceType || '');
  const canonicalKind = (() => {
    if (['booking_session', 'appointment', 'booking', 'visit', 'session'].includes(rawKind)) return 'booking_session';
    if (['order', 'product_order'].includes(rawKind)) return 'order';
    if (['wallet', 'wallet_ledger'].includes(rawKind)) return 'wallet';
    if (['gift', 'gift_card', 'giftcard'].includes(rawKind)) return 'gift_card';
    if (['refund', 'reversal'].includes(rawKind)) return 'refund';
    if (['payment', 'transaction', 'sale', 'deposit', 'remainder', 'adjustment'].includes(rawKind)) return 'payment';
    if (source === 'wallet') return 'wallet';
    if (source === 'order') return 'order';
    if (source === 'gift_card') return 'gift_card';
    if (source === 'refund') return 'refund';
    return rawKind || 'payment';
  })();

  const appointment = record?.appointment || null;
  const bookingSession = record?.bookingSession || null;
  const order = record?.order || null;
  const processedAt = record?.processedAt || record?.date || record?.createdAt || record?.time || record?.timestamp || '';
  const amount = toNumber(record?.amount ?? record?.totalAmount ?? record?.value ?? record?.price ?? 0);
  const status = toStringValue(record?.status || record?.paymentStatus || 'completed', 'completed').toLowerCase();

  return {
    ...record,
    source,
    sourceType: record?.sourceType || canonicalKind,
    kind: canonicalKind,
    entityType: record?.entityType || canonicalKind,
    recordType: record?.recordType || canonicalKind,
    type: record?.type || canonicalKind,
    paymentStatus: record?.paymentStatus || status,
    normalizedPaymentStatus: record?.normalizedPaymentStatus || record?.paymentStatus || status,
    status,
    statusLabel: record?.statusLabel || status,
    amount,
    totalAmount: toNumber(record?.totalAmount ?? amount),
    currency: record?.currency || 'SAR',
    paymentMethod,
    paymentMethodLabel,
    method: record?.method || paymentMethodLabel,
    methodAr: record?.methodAr || paymentMethodLabel,
    date: processedAt,
    processedAt,
    transactionRef: record?.transactionRef || record?.referenceId || record?.reference || null,
    referenceType: record?.referenceType || null,
    referenceId: record?.referenceId || null,
    notes: record?.notes || '',
    appointment,
    bookingSession,
    order,
    detailPath: record?.detailPath || null
  };
}

function normalizeCustomerHistoryResponse(payload: any): CanonicalCustomerHistory {
  const data = unwrapPayload(payload) || {};
  const historySource = [
    ...toArray(data?.history),
    ...toArray(data?.appointments),
    ...toArray(data?.records),
    ...toArray(data?.items),
    ...toArray(data?.timeline)
  ];

  const historyDeduped = (() => {
    const seen = new Set<string>();
    return historySource.filter((row: any, index: number) => {
      const key = [
        row?.bookingSessionId || row?.details?.bookingSessionId || '',
        row?.bookingReference || row?.details?.bookingReference || '',
        row?.id || '',
        row?.date || row?.startTime || row?.createdAt || '',
        row?.kind || row?.entityType || row?.recordType || row?.type || ''
      ].join('|');
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  })();

  const normalizedHistory = historyDeduped.map((row: any) => {
    const kind = toStringValue(row?.kind || row?.entityType || row?.recordType || row?.type || row?.sourceType || '', '');
    const canonicalKind = kind === 'booking_session' ? 'booking_session'
      : ['appointment', 'booking', 'visit', 'session'].includes(kind) ? 'booking_session'
      : ['order', 'product_order'].includes(kind) ? 'order'
      : ['wallet', 'wallet_ledger'].includes(kind) ? 'wallet'
      : ['gift', 'gift_card', 'giftcard'].includes(kind) ? 'gift_card'
      : ['refund', 'reversal'].includes(kind) ? 'refund'
      : ['payment', 'transaction', 'sale', 'deposit', 'remainder', 'adjustment'].includes(kind) ? 'payment'
      : kind || 'booking_session';
    const normalizedType = canonicalKind === 'booking_session' ? 'appointment' : canonicalKind;
    const services = toArray(row?.details?.services || row?.serviceLines || row?.serviceItems).filter(Boolean);
    const appointmentDate = row?.date || row?.startTime || row?.processedAt || row?.createdAt || '';
    const primaryService = row?.details?.service || row?.service || services[0] || null;
    const serviceVariantName = row?.serviceVariantName || row?.details?.serviceVariantName || row?.serviceVariant?.nameEn || row?.serviceVariant?.name_ar || row?.serviceVariant?.name_ar || '';
    const serviceVariantDescription = row?.serviceVariantDescription || row?.details?.serviceVariantDescription || row?.serviceVariant?.description || '';
    const serviceNameEn = row?.serviceNameEn
      || row?.details?.serviceNameEn
      || row?.service?.name_en
      || row?.service?.name
      || primaryService?.name_en
      || primaryService?.name
      || row?.title
      || '';
    const serviceNameAr = row?.serviceNameAr
      || row?.details?.serviceNameAr
      || row?.service?.name_ar
      || row?.service?.name
      || primaryService?.name_ar
      || primaryService?.name
      || row?.title
      || '';
    const serviceLabelEn = serviceVariantName
      ? `${serviceNameEn} / ${serviceVariantName}`
      : serviceNameEn;
    const serviceLabelAr = serviceVariantName
      ? `${serviceNameAr} / ${serviceVariantName}`
      : serviceNameAr;
    return {
      ...row,
      type: normalizedType,
      kind: canonicalKind,
      entityType: canonicalKind,
      recordType: canonicalKind,
      sourceType: row?.sourceType || canonicalKind,
      date: appointmentDate,
      startTime: row?.startTime || appointmentDate || '',
      status: row?.status || row?.appointmentStatus || row?.bookingStatus || row?.normalizedStatus || row?.details?.status || 'completed',
      appointmentStatus: row?.appointmentStatus || row?.status || 'completed',
      paymentStatus: row?.paymentStatus || row?.normalizedPaymentStatus || 'paid',
      normalizedPaymentStatus: row?.normalizedPaymentStatus || row?.paymentStatus || 'paid',
      amount: toNumber(row?.amount ?? row?.paidAmount ?? row?.totalAmount ?? row?.price ?? 0),
      paidAmount: toNumber(row?.paidAmount ?? row?.amount ?? row?.totalPaid ?? 0),
      totalPaid: toNumber(row?.totalPaid ?? row?.paidAmount ?? row?.amount ?? 0),
      outstandingAmount: toNumber(row?.outstandingAmount ?? row?.remainderAmount ?? 0),
      details: {
        ...(row?.details || {}),
        services,
        service: row?.details?.service || row?.service || null,
        staff: row?.details?.staff || row?.staff || null,
        staffName: row?.details?.staffName || row?.assignedStaffName || row?.staffName || '',
        startTime: row?.details?.startTime || row?.startTime || appointmentDate || '',
        endTime: row?.details?.endTime || row?.endTime || '',
        duration: toNumber(row?.details?.duration ?? row?.duration ?? 0),
        branch: row?.details?.branch || row?.branch || null,
        bookingSessionId: row?.bookingSessionId || row?.details?.bookingSessionId || null,
        bookingReference: row?.bookingReference || row?.details?.bookingReference || null,
        bookingItemCount: toNumber(row?.details?.bookingItemCount ?? row?.bookingItemCount ?? services.length),
        notes: row?.details?.notes || row?.notes || '',
        serviceVariantId: row?.serviceVariantId || row?.details?.serviceVariantId || row?.serviceVariant?.id || null,
        serviceVariantName,
        serviceVariantDescription,
        serviceLabelEn,
        serviceLabelAr,
        serviceLabel: serviceLabelEn,
        serviceLabelArText: serviceLabelAr
      },
      serviceNameEn: serviceLabelEn,
      serviceNameAr: serviceLabelAr,
      serviceVariantId: row?.serviceVariantId || row?.details?.serviceVariantId || row?.serviceVariant?.id || null,
      serviceVariantName,
      serviceVariantDescription,
      serviceLabelEn,
      serviceLabelAr,
      serviceLabel: serviceLabelEn,
      serviceLabelArText: serviceLabelAr,
      assignedStaffName: row?.assignedStaffName || row?.details?.staffName || row?.staff?.name || '',
      bookingSessionId: row?.bookingSessionId || row?.details?.bookingSessionId || null,
      bookingReference: row?.bookingReference || row?.details?.bookingReference || null,
      price: toNumber(row?.price ?? row?.amount ?? row?.totalAmount ?? 0)
    };
  });

  const walletTransactions = toArray(data?.walletTransactions).map((entry: any) => ({
    ...entry,
    type: entry?.type || 'wallet',
    kind: entry?.kind || 'wallet',
    entityType: entry?.entityType || 'wallet',
    sourceType: entry?.sourceType || 'wallet',
    amount: toNumber(entry?.amount ?? 0),
    date: entry?.createdAt || entry?.date || '',
    createdAt: entry?.createdAt || entry?.date || '',
    status: entry?.status || 'completed',
    paymentStatus: entry?.direction === 'credit' ? 'credited' : 'debited'
  }));

  const summary = unwrapPayload(data?.summary) || unwrapPayload(data?.metrics) || {};
  return {
    ...data,
    history: normalizedHistory,
    appointments: normalizedHistory.filter((row: any) => row.kind === 'booking_session'),
    records: normalizedHistory,
    items: normalizedHistory,
    timeline: normalizedHistory,
    walletTransactions,
    transactions: normalizedHistory.filter((row: any) => ['order', 'wallet', 'payment', 'refund', 'gift_card'].includes(row.kind)),
    summary,
    metrics: summary
  };
}

function normalizeCustomerTransactionsResponse(payload: any): any {
  const data = unwrapPayload(payload) || {};
  const transactionsSource = [
    ...toArray(data?.transactions),
    ...toArray(data?.items),
    ...toArray(data?.records)
  ];

  const transactions = transactionsSource.map((row: any) => normalizeCustomerTransactionRecord(row, row?.source || row?.kind || 'transaction'));
  const summary = unwrapPayload(data?.summary) || {};

  return {
    ...data,
    transactions,
    items: transactions,
    records: transactions,
    summary
  };
}

function normalizeCustomerProfileResponse(payload: any): CanonicalCustomerProfile {
  const data = unwrapPayload(payload) || {};
  const customer = data?.customer || data || {};
  const firstName = toStringValue(customer?.firstName || customer?.first_name || '');
  const lastName = toStringValue(customer?.lastName || customer?.last_name || '');
  const name = normalizePersonName(customer, 'Guest');
  const avatar = customer?.avatar || customer?.photo || customer?.profileImage || null;
  const walletLedgerEntries = toArray(customer?.walletLedgerEntries);
  const giftCardTransactions = toArray(customer?.giftCardTransactions);
  const favorites = toArray(customer?.favoriteServices);
  const preferredStaff = toArray(customer?.preferredStaff);
  const recentAppointments = toArray(customer?.recentAppointments);
  const recentOrders = toArray(customer?.recentOrders);
  const allAppointments = toArray(customer?.allAppointments);
  const allOrders = toArray(customer?.allOrders);
  const reviews = toArray(customer?.reviews);
  const notes = Array.isArray(customer?.notes)
    ? customer.notes
    : typeof customer?.notes === 'string' && customer.notes.trim().length > 0
      ? [customer.notes]
      : [];
  const walletSummary = customer?.walletSummary || {};
  const walletBalance = toNumber(customer?.walletBalance || 0);
  const totalBookings = toNumber(customer?.totalBookings ?? recentAppointments.length ?? 0);
  const totalOrders = toNumber(customer?.totalOrders ?? recentOrders.length ?? 0);
  const totalProductsPurchased = toNumber(customer?.totalProductsPurchased ?? customer?.productsPurchased ?? 0);
  const totalSpent = toNumber(customer?.totalSpent ?? 0);
  const averageBookingValue = toNumber(customer?.averageBookingValue ?? customer?.avgTicket ?? 0);
  const spentServices = toNumber(customer?.spentServices ?? recentAppointments.reduce((sum: number, appointment: any) => sum + toNumber(appointment?.totalPaid ?? appointment?.price ?? 0), 0));
  const spentProducts = toNumber(customer?.spentProducts ?? allOrders.reduce((sum: number, order: any) => sum + toNumber(order?.totalAmount ?? 0), 0));
  const futureAppointments = recentAppointments
    .filter((appointment: any) => appointment?.startTime && new Date(appointment.startTime).getTime() > Date.now())
    .sort((a: any, b: any) => new Date(a.startTime || a.date || 0).getTime() - new Date(b.startTime || b.date || 0).getTime());
  const favoredServices = favorites.map((service: any) => service?.name || service?.name_en || service?.nameAr || service?.name_ar || service).filter(Boolean);
  const assignedStylist = preferredStaff[0]?.name || customer?.assignedStylist || '';
  const transactions = normalizeCustomerTransactionsResponse({
    transactions: [
      ...recentOrders.map((order: any) => ({
        id: order.id,
        source: 'order',
        kind: 'order',
        entityType: 'order',
        date: order.createdAt || order.date || '',
        processedAt: order.createdAt || order.date || '',
        amount: toNumber(order.totalAmount ?? order.amount ?? 0),
        currency: 'SAR',
        type: order.paymentStatus || order.status || 'order',
        status: order.status || order.paymentStatus || 'completed',
        paymentStatus: order.paymentStatus || order.status || 'completed',
        paymentMethod: order.paymentMethod || 'order',
        paymentMethodLabel: order.paymentMethod || 'order',
        order
      })),
      ...walletLedgerEntries.map((entry: any) => normalizeCustomerTransactionRecord({
        id: entry.id,
        source: 'wallet',
        kind: 'wallet',
        entityType: 'wallet',
        date: entry.createdAt || entry.date || '',
        processedAt: entry.createdAt || entry.date || '',
        amount: toNumber(entry.amount ?? 0),
        currency: entry.currency || 'SAR',
        type: entry.type || 'wallet',
        status: entry.direction === 'credit' ? 'completed' : 'completed',
        paymentStatus: entry.direction === 'credit' ? 'credited' : 'debited',
        paymentMethod: entry.referenceType || 'wallet',
        paymentMethodLabel: entry.referenceType || 'wallet',
        referenceType: entry.referenceType || null,
        referenceId: entry.referenceId || null
      }, 'wallet')),
      ...giftCardTransactions.map((tx: any) => normalizeCustomerTransactionRecord({
        id: tx.id,
        source: 'gift_card',
        kind: 'gift_card',
        entityType: 'gift_card',
        date: tx.createdAt || '',
        processedAt: tx.createdAt || '',
        amount: toNumber(tx.totalCreditAmount ?? tx.creditAmount ?? tx.purchaseAmount ?? 0),
        currency: 'SAR',
        type: tx.status || 'gift_card',
        status: tx.status || 'completed',
        paymentStatus: tx.status || 'completed',
        paymentMethod: tx.deliveryChannel || 'gift_card',
        paymentMethodLabel: tx.deliveryChannel || 'gift_card',
        transactionRef: tx.id,
        notes: tx.packageTitle || ''
      }, 'gift_card'))
    ]
  }).transactions;

  const profile: CanonicalCustomerProfile = {
    ...customer,
    id: customer?.id || '',
    firstName,
    lastName,
    name,
    nameEn: name,
    nameAr: customer?.nameAr || name,
    fullName: name,
    avatar,
    photo: avatar,
    profileImage: avatar,
    email: customer?.email || '',
    phone: customer?.phone || '',
    gender: customer?.gender || '',
    birthdate: customer?.birthdate || customer?.dateOfBirth || '',
    dateOfBirth: customer?.dateOfBirth || customer?.birthdate || '',
    preferredLanguage: customer?.preferredLanguage || 'ar',
    memberSince: customer?.memberSince || customer?.createdAt || '',
    createdAt: customer?.createdAt || '',
    loyaltyTier: customer?.loyaltyTier || '',
    loyaltyPoints: toNumber(customer?.loyaltyPoints ?? 0),
    walletBalance,
    walletCashback: toNumber(customer?.walletCashback ?? 0),
    walletSummary: {
      currentBalance: walletBalance,
      walletLedgerCount: toNumber(walletSummary?.walletLedgerCount ?? walletLedgerEntries.length),
      sentGiftCardCount: toNumber(walletSummary?.sentGiftCardCount ?? giftCardTransactions.filter((tx: any) => tx?.senderPlatformUserId === customer?.id).length),
      receivedGiftCardCount: toNumber(walletSummary?.receivedGiftCardCount ?? giftCardTransactions.filter((tx: any) => tx?.recipientPlatformUserId === customer?.id).length)
    },
    walletEntriesCount: toNumber(walletSummary?.walletLedgerCount ?? walletLedgerEntries.length),
    giftCardsSent: toNumber(walletSummary?.sentGiftCardCount ?? giftCardTransactions.filter((tx: any) => tx?.senderPlatformUserId === customer?.id).length),
    giftCardsReceived: toNumber(walletSummary?.receivedGiftCardCount ?? giftCardTransactions.filter((tx: any) => tx?.recipientPlatformUserId === customer?.id).length),
    walletLedgerEntries,
    walletLedger: walletLedgerEntries,
    giftCardTransactions,
    giftCards: giftCardTransactions,
    totalBookings,
    appointmentsCount: totalBookings,
    totalOrders,
    totalProductsPurchased,
    productsPurchased: totalProductsPurchased,
    totalSpent,
    spentServices,
    spentProducts,
    averageBookingValue,
    avgTicket: averageBookingValue,
    unpaidBalance: toNumber(customer?.unpaidBalance ?? customer?.outstandingAmount ?? 0),
    firstVisit: customer?.firstVisit || '',
    lastVisit: customer?.lastVisit || '',
    nextVisit: futureAppointments[0]?.startTime || futureAppointments[0]?.date || '',
    noShowCount: toNumber(customer?.noShowCount ?? 0),
    noShowsCount: toNumber(customer?.noShowCount ?? 0),
    cancellationCount: toNumber(customer?.cancellationCount ?? 0),
    favoriteServices: toArray(customer?.favoriteServices),
    favoriteProducts: toArray(customer?.favoriteProducts),
    favServices: favoredServices,
    favServicesAr: favoredServices,
    preferredStaff: preferredStaff,
    assignedStylist,
    assignedStylistAr: customer?.assignedStylistAr || assignedStylist,
    preferredTime: customer?.preferredTime || '',
    preferredDeliveryType: customer?.preferredDeliveryType || '',
    prefDrink: customer?.prefDrink || '',
    prefDrinkAr: customer?.prefDrinkAr || '',
    prefTemp: customer?.prefTemp || '',
    prefTempAr: customer?.prefTempAr || '',
    prefChat: customer?.prefChat || '',
    prefChatAr: customer?.prefChatAr || '',
    allergies: customer?.allergies || '',
    allergiesAr: customer?.allergiesAr || '',
    customerType: customer?.customerType || customer?.type || '',
    isWalkIn: Boolean(customer?.isWalkIn),
    tags: Array.isArray(customer?.tags) ? customer.tags : [],
    notes,
    reviews,
    communication: Array.isArray(customer?.communication) ? customer.communication : [],
    history: Array.isArray(customer?.history) ? customer.history : [],
    appointments: recentAppointments.map((appointment: any) => ({
      id: appointment.id,
      service: appointment?.service?.name_en || appointment?.service?.name || appointment?.serviceName || 'Service',
      serviceAr: appointment?.service?.name_ar || appointment?.service?.name || appointment?.serviceName || 'الخدمة',
      stylist: appointment?.staff?.name || appointment?.assignedStaffName || 'Stylist',
      stylistAr: appointment?.staff?.name || appointment?.assignedStaffName || 'خبير التجميل',
      date: appointment?.date || appointment?.startTime || '',
      time: appointment?.time || '',
      price: toNumber(appointment?.price ?? 0),
      status: appointment?.status || 'completed',
      paymentStatus: appointment?.paymentStatus || 'paid',
      normalizedPaymentStatus: appointment?.normalizedPaymentStatus || appointment?.paymentStatus || 'paid',
      paymentMethod: appointment?.paymentMethod || '',
      bookingSessionId: appointment?.bookingSessionId || null,
      bookingReference: appointment?.bookingReference || null
    })),
    transactions,
    documents: Array.isArray(customer?.documents) ? customer.documents : [],
    reviewsSummary: customer?.reviewsSummary || null,
    allAppointments: allAppointments,
    allOrders: allOrders,
    recentAppointments: recentAppointments,
    recentOrders: recentOrders,
    favoriteServicesCanonical: favoredServices
  };

  return profile;
}

function normalizeCustomerUpdateProfileResponse(payload: any): CanonicalCustomerProfile {
  return normalizeCustomerProfileResponse(payload);
}

function normalizeCustomerNotesResponse(payload: any): any {
  const data = unwrapPayload(payload) || {};
  return {
    ...data,
    notes: Array.isArray(data?.data?.notes) ? data.data.notes : Array.isArray(data?.notes) ? data.notes : [],
    tags: Array.isArray(data?.data?.tags) ? data.data.tags : Array.isArray(data?.tags) ? data.tags : []
  };
}

function translateRequestBody(pathname: string, method: string, body: any): any {
  if (!body || typeof body !== 'object' || body instanceof FormData) {
    return body;
  }

  if (pathname.includes('/tenant/customers') && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    const translated = { ...body };
    if (translated.sortField && !translated.sortBy) translated.sortBy = translated.sortField;
    if (translated.sortDirection && !translated.sortOrder) translated.sortOrder = translated.sortDirection;
    if (translated.pageIndex && !translated.page) translated.page = translated.pageIndex;
    if (translated.pageSize && !translated.limit) translated.limit = translated.pageSize;
    return translated;
  }

  return body;
}

function normalizeResponseForPath(pathname: string, method: string, payload: any): any {
  return payload;
}

class TenantApiAdapter {
  private fetchImpl: FetchLike;

  constructor(fetchImpl?: FetchLike) {
    this.fetchImpl = fetchImpl || window.fetch.bind(window);
  }

  private get baseUrl(): string {
    return API_BASE_URL;
  }

  private getToken(): string | null {
    return this.getAccessToken();
  }

  private async handleResponse(response: Response): Promise<any> {
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(data?.message || data?.error || 'Request failed') as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    return data;
  }

  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  setTokens(accessToken: string, refreshToken?: string | null): void {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
  }

  clearTokens(): void {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  private async refreshAccessToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    const response = await this.fetchImpl(`${API_BASE_URL}/auth/tenant/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    const data = await response.json().catch(() => null);
    if (data?.success && data?.accessToken) {
      this.setTokens(data.accessToken, data.refreshToken || refreshToken);
      return true;
    }

    return false;
  }

  async ensureFreshAuthSession(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return Boolean(this.getAccessToken());
    }

    return this.refreshAccessToken();
  }

  async login(email: string, password: string): Promise<any> {
    const response = await this.fetchImpl(`${API_BASE_URL}/auth/tenant/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    if (data?.success && data?.accessToken && data?.refreshToken) {
      this.setTokens(data.accessToken, data.refreshToken);
    }
    return data;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/tenant/logout', { method: 'POST' });
    } catch {
      // ignore logout failures and clear local session anyway
    } finally {
      this.clearTokens();
    }
  }

  async getSubscriptionPackages(): Promise<any> {
    return this.get('/api/v1/subscriptions/packages');
  }

  async getCurrentSubscription(): Promise<any> {
    return this.get('/api/v1/subscription/current');
  }

  async getTenantBills(): Promise<any> {
    return this.get('/tenant/bills');
  }

  async registerTenant(formData: FormData): Promise<any> {
    const response = await this.request('/auth/tenant/register', {
      method: 'POST',
      body: formData
    });
    return response.json();
  }

  async requestTenantForgotPassword(email: string, locale?: string): Promise<any> {
    return this.post('/auth/tenant/forgot-password', {
      email,
      locale
    });
  }

  async resetTenantPassword(token: string, password: string, confirmPassword?: string): Promise<any> {
    return this.post(`/auth/tenant/reset-password/${encodeURIComponent(token)}`, {
      password,
      confirmPassword: confirmPassword || password
    });
  }

  async getSubscriptionPaymentSession(token?: string): Promise<any> {
    const query = this.buildQueryString({ token });
    return this.get(`/tenant/subscription/payment${query ? `?${query}` : ''}`);
  }

  async submitSubscriptionPayment(success: boolean, token?: string): Promise<any> {
    const payload: Record<string, any> = { success };
    if (token) {
      payload.token = token;
    }
    return this.post('/tenant/subscription/pay', payload);
  }

  async getBillPaymentDetails(token: string): Promise<any> {
    return this.get(`/public/bills/by-token/${encodeURIComponent(token)}`);
  }

  async payBillByToken(
    token: string,
    options?: {
      success?: boolean;
      paymentProvider?: string;
      paymentReference?: string;
      paymentMethod?: string;
      checkoutSessionId?: string;
      gatewayStatus?: string;
      paymentFailureReason?: string;
      idempotencyKey?: string;
    }
  ): Promise<any> {
    const success = options?.success !== false;
    return this.post(`/public/bills/by-token/${encodeURIComponent(token)}/pay`, {
      paymentStatus: success ? 'succeeded' : 'failed',
      paymentProvider: options?.paymentProvider || 'refah_test_gateway',
      paymentReference: options?.paymentReference,
      paymentMethod: options?.paymentMethod || 'test_card',
      checkoutSessionId: options?.checkoutSessionId,
      gatewayStatus: options?.gatewayStatus || (success ? 'authorized' : 'declined'),
      paymentFailureReason: options?.paymentFailureReason,
      idempotencyKey: options?.idempotencyKey
    });
  }

  private buildUrl(input: RequestInfo | URL): URL {
    const url = toAbsoluteUrl(input);
    if (url.pathname.startsWith('/api/v1/')) {
      return new URL(`${API_BASE_URL}${url.pathname.replace(/^\/api\/v1/, '')}${url.search}${url.hash}`);
    }

    if (url.pathname.startsWith('/tenant/')) {
      return new URL(`${API_BASE_URL}${url.pathname}${url.search}${url.hash}`);
    }

    if (url.pathname.startsWith('/auth/tenant/')) {
      return new URL(`${API_BASE_URL}${url.pathname}${url.search}${url.hash}`);
    }

    if (url.pathname.startsWith('/public/')) {
      return new URL(`${API_BASE_URL}${url.pathname}${url.search}${url.hash}`);
    }

    return url;
  }

  private async requestRaw(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const url = this.buildUrl(input);
    const method = (init.method || 'GET').toUpperCase();
    const headers = new Headers(init.headers || {});
    const body = init.body;

    if (!(body instanceof FormData) && body !== undefined && body !== null && !headers.has('content-type')) {
      headers.set('Content-Type', 'application/json');
    }

    const accessToken = this.getAccessToken();
    if (accessToken && isTenantApiPath(url.pathname)) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    const translatedBody = translateRequestBody(url.pathname, method, body);

    let response = await this.fetchImpl(url.toString(), {
      ...init,
      method,
      headers,
      body: translatedBody instanceof FormData || typeof translatedBody === 'string' || translatedBody == null
        ? translatedBody
        : JSON.stringify(translatedBody)
    });

    if (response.status === 401 && isTenantApiPath(url.pathname) && !url.pathname.startsWith('/auth/tenant/') && shouldRetryUnauthorizedRequest(url.pathname)) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        const retryToken = this.getAccessToken();
        if (retryToken) {
          headers.set('Authorization', `Bearer ${retryToken}`);
        }
        response = await this.fetchImpl(url.toString(), {
          ...init,
          method,
          headers,
          body: translatedBody instanceof FormData || typeof translatedBody === 'string' || translatedBody == null
            ? translatedBody
            : JSON.stringify(translatedBody)
        });
      }
    }

    return response;
  }

  async request(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const response = await this.requestRaw(input, init);
    const url = this.buildUrl(input);
    const method = (init.method || 'GET').toUpperCase();

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return response;
    }

    const text = await response.clone().text();
    const parsed = safeJsonParse(text);

    if (!response.ok || (parsed && parsed.success === false)) {
      throw new Error(parsed?.message || parsed?.error || `HTTP Error ${response.status}`);
    }

    if (!parsed) {
      return response;
    }

    const normalized = normalizeResponseForPath(url.pathname, method, parsed);
    if (normalized === parsed) {
      return response;
    }

    return createJsonResponse(normalized, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  }

  async get<T = any>(endpoint: string): Promise<T> {
    const response = await this.request(endpoint, { method: 'GET' });
    return response.json();
  }

  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    const response = await this.request(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
    return response.json();
  }

  async put<T = any>(endpoint: string, data?: any): Promise<T> {
    const response = await this.request(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
    return response.json();
  }

  async patch<T = any>(endpoint: string, data?: any): Promise<T> {
    const response = await this.request(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined
    });
    return response.json();
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    const response = await this.request(endpoint, { method: 'DELETE' });
    return response.json();
  }

  async getProfile(): Promise<any> {
    return this.get('/tenant/profile');
  }

  private buildQueryString(params?: Record<string, any>): string {
    const q = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) return;

      if (Array.isArray(value)) {
        const normalizedArray = value
          .map((item) => (item === undefined || item === null ? '' : String(item).trim()))
          .filter((item) => item.length > 0 && !['all', 'any', 'none', 'select', 'default', '*'].includes(item.toLowerCase()));
        if (normalizedArray.length === 0) return;
        value = normalizedArray.join(',');
      }

      if (typeof value === 'object' && !Array.isArray(value)) {
        if (Object.keys(value).length === 0) return;
        value = JSON.stringify(value);
      }

      const normalized = typeof value === 'string' ? value.trim() : String(value);
      const lower = normalized.toLowerCase();
      if (
        normalized.length === 0 ||
        ['all', 'any', 'none', 'select', 'default', '*'].includes(lower)
      ) {
        return;
      }

      q.set(key, key === 'sortOrder' ? normalized.toUpperCase() : normalized);
    });
    return q.toString();
  }

  async getCustomers(params: Record<string, string | number | undefined>): Promise<CustomerListResponse> {
    const query = this.buildQueryString(params);
    const response = await this.get(`/tenant/customers${query ? `?${query}` : ''}`);
    const payload = unwrapPayload(response) || {};
    const customers = toArray(payload?.customers).map(normalizeCustomerListItem);
    return {
      ...payload,
      customers,
      pagination: payload?.pagination || {
        total: customers.length,
        page: 1,
        limit: customers.length,
        totalPages: 1
      }
    };
  }

  async getCustomer(id: string, params?: Record<string, string | number | undefined>): Promise<any> {
    const query = this.buildQueryString(params);
    const response = await this.get(`/tenant/customers/${id}${query ? `?${query}` : ''}`);
    return normalizeCustomerProfileResponse(response);
  }

  async getCustomerHistory(id: string, params?: Record<string, string | number | undefined>): Promise<any> {
    const query = this.buildQueryString(params);
    const response = await this.get(`/tenant/customers/${id}/history${query ? `?${query}` : ''}`);
    return normalizeCustomerHistoryResponse(response);
  }

  async getCustomerTransactions(id: string, params?: Record<string, string | number | undefined>): Promise<any> {
    const query = this.buildQueryString(params);
    const response = await this.get(`/tenant/customers/${id}/transactions${query ? `?${query}` : ''}`);
    return normalizeCustomerTransactionsResponse(response);
  }

  async getCustomerStats(): Promise<NormalizedCustomerStats> {
    const response = await this.get('/tenant/customers/stats');
    return normalizeCustomerStatsPayload(response);
  }

  async updateCustomerProfile(id: string, data: Record<string, any>): Promise<CanonicalCustomerProfile> {
    const response = await this.patch(`/tenant/customers/${id}/profile`, data);
    return normalizeCustomerUpdateProfileResponse(response);
  }

  async updateCustomerNotes(id: string, data: Record<string, any>): Promise<any> {
    const response = await this.patch(`/tenant/customers/${id}/notes`, data);
    return normalizeCustomerNotesResponse(response);
  }

  async exportCustomers(params: Record<string, string | number | undefined>): Promise<Response> {
    const query = this.buildQueryString(params);
    return this.request(`/tenant/customers/export${query ? `?${query}` : ''}`, { method: 'GET' });
  }

  async getEmployees(): Promise<any> {
    const response = await this.get('/tenant/employees');
    const sourceEmployees = Array.isArray(response?.employees)
      ? response.employees
      : Array.isArray(response?.data?.employees)
        ? response.data.employees
        : Array.isArray(response?.data)
          ? response.data
          : [];
    const employees = normalizeEmployeeAvatarCollection(sourceEmployees);

    if (Array.isArray(response?.employees)) {
      return { ...response, employees };
    }

    if (response?.data && Array.isArray(response.data.employees)) {
      return {
        ...response,
        employees,
        data: {
          ...response.data,
          employees
        }
      };
    }

    if (Array.isArray(response?.data)) {
      return { ...response, employees, data: employees };
    }

    return { ...response, employees };
  }

  async getSubscriptionLimits(): Promise<any> {
    return this.get('/tenant/settings/limits');
  }

  async getEmployeePermissions(id: string): Promise<any> {
    return this.get(`/tenant/employees/${id}/permissions`);
  }

  async updateEmployeePermissions(id: string, permissions: Record<string, boolean>): Promise<any> {
    return this.put(`/tenant/employees/${id}/permissions`, permissions);
  }

  async createEmployee(data: Record<string, any>): Promise<any> {
    if (data instanceof FormData) {
      const response = await fetch(`${this.baseUrl}/tenant/employees`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: data
      });
      return this.handleResponse(response);
    }
    return this.post('/tenant/employees', data);
  }

  async updateEmployee(id: string, data: Record<string, any>): Promise<any> {
    if (data instanceof FormData) {
      const response = await fetch(`${this.baseUrl}/tenant/employees/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: data
      });
      return this.handleResponse(response);
    }
    return this.put(`/tenant/employees/${id}`, data);
  }

  async deleteEmployee(id: string): Promise<any> {
    return this.delete(`/tenant/employees/${id}`);
  }

  // --- Products ---
  async getProducts(): Promise<any> {
    const response = await this.get('/tenant/products');
    return {
      ...response,
      products: normalizeProductCollection(response?.products || [])
    };
  }

  async createProduct(data: any): Promise<any> {
    // Check if data is FormData
    if (data instanceof FormData) {
      const response = await fetch(`${this.baseUrl}/tenant/products`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: data
      });
      return this.handleResponse(response);
    }
    const response = await this.post('/tenant/products', data);
    return {
      ...response,
      product: response?.product ? normalizeProductRecord(response.product) : response?.product
    };
  }

  async updateProduct(id: string, data: any): Promise<any> {
    if (data instanceof FormData) {
      const response = await fetch(`${this.baseUrl}/tenant/products/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: data
      });
      return this.handleResponse(response);
    }
    const response = await this.put(`/tenant/products/${id}`, data);
    return {
      ...response,
      product: response?.product ? normalizeProductRecord(response.product) : response?.product
    };
  }

  async deleteProduct(id: string): Promise<any> {
    return this.delete(`/tenant/products/${id}`);
  }

  async getMessages(): Promise<any> {
    return this.get('/tenant/messages');
  }

  async createMessage(data: Record<string, any>): Promise<any> {
    return this.post('/tenant/messages', data);
  }

  async deleteMessage(id: string): Promise<any> {
    return this.delete(`/tenant/messages/${id}`);
  }

  async getServices(): Promise<any> {
    const response = await this.get('/tenant/services');
    return {
      ...response,
      services: normalizeServiceCollection(response?.services || [])
    };
  }

  async getServiceCategories(): Promise<any> {
    return this.get('/tenant/services/categories');
  }

  async createService(data: any): Promise<any> {
    if (data instanceof FormData) {
      const response = await fetch(`${this.baseUrl}/tenant/services`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: data
      });
      return this.handleResponse(response);
    }
    const response = await this.post('/tenant/services', data);
    return {
      ...response,
      service: response?.service ? normalizeServiceRecord(response.service) : response?.service
    };
  }

  async updateService(id: string, data: any): Promise<any> {
    if (data instanceof FormData) {
      const response = await fetch(`${this.baseUrl}/tenant/services/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: data
      });
      return this.handleResponse(response);
    }
    const response = await this.put(`/tenant/services/${id}`, data);
    return {
      ...response,
      service: response?.service ? normalizeServiceRecord(response.service) : response?.service
    };
  }

  async deleteService(id: string): Promise<any> {
    return this.delete(`/tenant/services/${id}`);
  }

  async getAppointmentsBoard(date: string, params?: Record<string, string | number | undefined>): Promise<any> {
    const query = this.buildQueryString({ date, ...(params || {}) });
    return this.get(`/tenant/appointments/board${query ? `?${query}` : ''}`);
  }

  async getAppointments(params?: Record<string, string | number | undefined>): Promise<any> {
    const query = this.buildQueryString(params);
    return this.get(`/tenant/appointments${query ? `?${query}` : ''}`);
  }

  async getAppointment(id: string): Promise<any> {
    return this.get(`/tenant/appointments/${id}`);
  }

  async createAppointment(data: Record<string, any>): Promise<any> {
    return this.post('/tenant/appointments', data);
  }

  async updateAppointment(id: string, data: Record<string, any>): Promise<any> {
    return this.put(`/tenant/appointments/${id}`, data);
  }

  async patchAppointment(id: string, data: Record<string, any>): Promise<any> {
    return this.patch(`/tenant/appointments/${id}`, data);
  }

  async updateAppointmentStatus(id: string, status: string, notes?: string): Promise<any> {
    return this.patch(`/tenant/appointments/${id}/status`, { status, notes, notifyCustomer: true });
  }

  async reassignAppointmentStaff(id: string, staffId: string): Promise<any> {
    return this.patch(`/tenant/appointments/${id}/reassign-staff`, {
      staffId
    });
  }

  async reassignRescheduleAppointment(
    id: string,
    data: { staffId: string; startTime: string; notifyCustomer?: boolean }
  ): Promise<any> {
    return this.patch(`/tenant/appointments/${id}/reassign-reschedule`, {
      ...data,
      notifyCustomer: data.notifyCustomer ?? true
    });
  }

  async getEmployeeShifts(employeeId: string): Promise<any> {
    return this.get(`/tenant/employees/${employeeId}/shifts`);
  }

  async createEmployeeShift(employeeId: string, shiftData: {
    dayOfWeek?: number | null;
    specificDate?: string | null;
    startTime: string;
    endTime: string;
    isRecurring?: boolean;
    startDate?: string | null;
    endDate?: string | null;
    label?: string;
  }): Promise<any> {
    return this.post(`/tenant/employees/${employeeId}/shifts`, shiftData);
  }

  async updateEmployeeShift(employeeId: string, shiftId: string, shiftData: any): Promise<any> {
    return this.put(`/tenant/employees/${employeeId}/shifts/${shiftId}`, shiftData);
  }

  async deleteEmployeeShift(employeeId: string, shiftId: string): Promise<any> {
    return this.delete(`/tenant/employees/${employeeId}/shifts/${shiftId}`);
  }

  async getEmployeeBreaks(employeeId: string): Promise<any> {
    return this.get(`/tenant/employees/${employeeId}/breaks`);
  }

  async createEmployeeBreak(employeeId: string, breakData: {
    dayOfWeek?: number | null;
    specificDate?: string | null;
    startTime: string;
    endTime: string;
    type?: 'lunch' | 'prayer' | 'cleaning' | 'other';
    label?: string;
    isRecurring?: boolean;
    startDate?: string | null;
    endDate?: string | null;
    referenceDate?: string | null;
  }): Promise<any> {
    return this.post(`/tenant/employees/${employeeId}/breaks`, breakData);
  }

  async updateEmployeeBreak(employeeId: string, breakId: string, breakData: any): Promise<any> {
    return this.put(`/tenant/employees/${employeeId}/breaks/${breakId}`, breakData);
  }

  async deleteEmployeeBreak(employeeId: string, breakId: string): Promise<any> {
    return this.delete(`/tenant/employees/${employeeId}/breaks/${breakId}`);
  }

  async getDashboardStats(): Promise<any> {
    return this.get('/tenant/dashboard/stats');
  }

  async getTodaysAppointments(): Promise<any> {
    return this.get('/tenant/dashboard/todays-appointments');
  }

  async getTenantHeaderNotifications(params: Record<string, string | number | undefined> = {}): Promise<any> {
    const query = this.buildQueryString(params);
    return this.get(`/tenant/header/notifications${query ? `?${query}` : ''}`);
  }

  async markTenantHeaderNotificationRead(id: string): Promise<any> {
    return this.patch(`/tenant/header/notifications/${encodeURIComponent(id)}/read`, {});
  }

  async markAllTenantHeaderNotificationsRead(): Promise<any> {
    return this.patch('/tenant/header/notifications/read-all', {});
  }

  // --- Reports ---
  async getReportsSummary(params: Record<string, string | number | undefined> = {}): Promise<any> {
    const query = this.buildQueryString(params);
    return this.get(`/tenant/reports/summary${query ? `?${query}` : ''}`);
  }

  async getDashboardSummary(params: Record<string, string | number | undefined> = {}): Promise<any> {
    return this.getReportsSummary(params);
  }

  async getFinancialOverview(params: Record<string, string | number | undefined>): Promise<any> {
    const query = this.buildQueryString(params);
    return this.get(`/tenant/financial/overview${query ? `?${query}` : ''}`);
  }

  async getFinancialLedger(params: Record<string, string | number | undefined>): Promise<any> {
    const query = this.buildQueryString(params);
    return this.get(`/tenant/financial/ledger${query ? `?${query}` : ''}`);
  }

  async getDailyRevenue(params: Record<string, string | number | undefined>): Promise<any> {
    const query = this.buildQueryString(params);
    return this.get(`/tenant/financial/daily${query ? `?${query}` : ''}`);
  }

  async getBookingTrends(params: Record<string, string | number | undefined>): Promise<any> {
    const query = this.buildQueryString(params);
    return this.get(`/tenant/reports/booking-trends${query ? `?${query}` : ''}`);
  }

  // --- Support Platform ---
  async getSupportCategories(params: Record<string, string | number | undefined> = {}): Promise<any> {
    const query = this.buildQueryString(params);
    return this.get(`/tenant/support/categories${query ? `?${query}` : ''}`);
  }

  async getSupportTickets(params: Record<string, string | number | undefined> = {}): Promise<any> {
    const query = this.buildQueryString(params);
    return this.get(`/tenant/support/tickets${query ? `?${query}` : ''}`);
  }

  async getSupportTicket(id: string): Promise<any> {
    return this.get(`/tenant/support/tickets/${id}`);
  }

  async createSupportTicket(data: any): Promise<any> {
    if (data instanceof FormData) {
      const response = await this.request('/tenant/support/tickets', {
        method: 'POST',
        body: data
      });
      return response.json();
    }

    return this.post('/tenant/support/tickets', data);
  }

  async replyToSupportTicket(id: string, data: any): Promise<any> {
    if (data instanceof FormData) {
      const response = await this.request(`/tenant/support/tickets/${id}/messages`, {
        method: 'POST',
        body: data
      });
      return response.json();
    }

    return this.post(`/tenant/support/tickets/${id}/messages`, data);
  }

  async uploadSupportTicketAttachments(id: string, data: any): Promise<any> {
    if (data instanceof FormData) {
      const response = await this.request(`/tenant/support/tickets/${id}/attachments`, {
        method: 'POST',
        body: data
      });
      return response.json();
    }

    return this.post(`/tenant/support/tickets/${id}/attachments`, data);
  }

  async assignSupportTicket(id: string, supportAgentId: string): Promise<any> {
    return this.post(`/tenant/support/tickets/${id}/assign`, { supportAgentId });
  }

  async unassignSupportTicket(id: string): Promise<any> {
    return this.post(`/tenant/support/tickets/${id}/unassign`, {});
  }

  async changeSupportTicketStatus(id: string, status: string): Promise<any> {
    return this.post(`/tenant/support/tickets/${id}/status`, { status });
  }

  async changeSupportTicketPriority(id: string, priority: string): Promise<any> {
    return this.post(`/tenant/support/tickets/${id}/priority`, { priority });
  }

  async changeSupportTicketCategory(id: string, supportCategoryId: string | null): Promise<any> {
    return this.post(`/tenant/support/tickets/${id}/category`, { supportCategoryId });
  }

  async reopenSupportTicket(id: string): Promise<any> {
    return this.post(`/tenant/support/tickets/${id}/reopen`, {});
  }

  async closeSupportTicket(id: string): Promise<any> {
    return this.post(`/tenant/support/tickets/${id}/close`, {});
  }

  async markSupportTicketRead(id: string): Promise<any> {
    return this.post(`/tenant/support/tickets/${id}/read`, {});
  }

  async getFullReport(
    startDate: string,
    endDate: string,
    sections: string[] = [],
    params: Record<string, string | number | boolean | undefined | null | object> = {}
  ): Promise<any> {
    const query = this.buildQueryString({ startDate, endDate, sections, ...params });
    return this.get(`/tenant/reports/full${query ? `?${query}` : ''}`);
  }

  async getPeakHoursAnalysis(params: Record<string, string | number | undefined>): Promise<any> {
    const query = this.buildQueryString(params);
    return this.get(`/tenant/reports/peak-hours${query ? `?${query}` : ''}`);
  }

  async getServicePerformance(startDate: string, endDate: string): Promise<any> {
    return this.get(`/tenant/reports/service-performance?startDate=${startDate}&endDate=${endDate}`);
  }

  async getEmployeePerformance(startDate: string, endDate: string): Promise<any> {
    return this.get(`/tenant/reports/employee-performance?startDate=${startDate}&endDate=${endDate}`);
  }

  async getCustomerAnalytics(startDate: string, endDate: string): Promise<any> {
    return this.get(`/tenant/reports/customer-analytics?startDate=${startDate}&endDate=${endDate}`);
  }

  async getRebookingAnalytics(startDate: string, endDate: string): Promise<any> {
    return this.get(`/tenant/reports/rebookings?startDate=${startDate}&endDate=${endDate}`);
  }

  async getProductRevenue(params: Record<string, string | number | undefined>): Promise<any> {
    const query = this.buildQueryString(params);
    return this.get(`/tenant/financial/products${query ? `?${query}` : ''}`);
  }

  async getRefundsReport(startDate: string, endDate: string): Promise<any> {
    return this.get(`/tenant/reports/refunds?startDate=${startDate}&endDate=${endDate}`);
  }

    async getPaymentMethodsReport(
      startDate: string,
      endDate: string,
      params: Record<string, string | number | undefined> = {}
    ): Promise<any> {
      const query = this.buildQueryString({ startDate, endDate, ...params });
      return this.get(`/tenant/reports/payment-methods${query ? `?${query}` : ''}`);
    }

  async getPosClosingSummary(params: Record<string, string | number | undefined>): Promise<any> {
    const query = this.buildQueryString(params);
    return this.get(`/tenant/pos/closing${query ? `?${query}` : ''}`);
  }

  async getAdvancedAnalytics(params: Record<string, string | number | undefined>): Promise<any> {
    const query = this.buildQueryString(params);
    return this.get(`/tenant/reports/advanced-analytics${query ? `?${query}` : ''}`);
  }

  async getSalesOverview(params: Record<string, string | number | undefined>): Promise<any> {
    const query = this.buildQueryString(params);
    return this.get(`/tenant/bi/sales-overview${query ? `?${query}` : ''}`);
  }

  // --- POS & Cart Checkout ---
  async checkoutProducts(payload: any): Promise<any> {
    return this.post('/tenant/cart/products/purchase', payload);
  }

  async checkoutGiftCards(payload: any): Promise<any> {
    return this.post('/tenant/cart/gift-cards/purchase', payload);
  }

  async updateAppointmentPaymentStatus(id: string, payload: any): Promise<any> {
    return this.patch(`/tenant/appointments/${id}/payment`, payload);
  }

  async recordRemainderPayment(id: string, payload: any): Promise<any> {
    return this.post(`/tenant/appointments/${id}/record-payment`, payload);
  }

  async refundAppointment(
    id: string,
    payload: { amount: number; reason?: string; paymentMethod?: string }
  ): Promise<any> {
    return this.post(`/tenant/appointments/${id}/refund`, payload);
  }

  async topUpCustomerWallet(id: string, payload: any): Promise<any> {
    return this.post(`/tenant/customers/${id}/wallet/topup`, payload);
  }
}

export const tenantApiAdapter = new TenantApiAdapter();

export function installTenantApiFetchBridge(onAuthFailure?: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  if ((window as any)[FETCH_BRIDGE_FLAG]) {
    return () => undefined;
  }

  const originalFetch = window.fetch.bind(window);
  const bridgeAdapter = new TenantApiAdapter(originalFetch);

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = toAbsoluteUrl(input);
    if (!isTenantApiPath(url.pathname)) {
      return originalFetch(input as any, init);
    }

    try {
      const response = await bridgeAdapter.request(input, init);

      if (response.status === 401 && onAuthFailure) {
        onAuthFailure();
      }

      return response;
    } catch (error) {
      if (onAuthFailure) {
        onAuthFailure();
      }
      throw error;
    }
  }) as typeof window.fetch;

  (window as any)[FETCH_BRIDGE_FLAG] = true;

  return () => {
    window.fetch = originalFetch;
    (window as any)[FETCH_BRIDGE_FLAG] = false;
  };
}
