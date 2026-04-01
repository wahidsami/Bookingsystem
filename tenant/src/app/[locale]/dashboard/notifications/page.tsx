'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { TenantLayout } from '@/components/TenantLayout';
import { tenantApi } from '@/lib/api';

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  profileImage?: string;
  totalBookings?: number;
  totalSpent?: number;
}

interface ServiceOption {
  id: string;
  name_en: string;
  name_ar: string;
  hasOffer: boolean;
  offerFrom?: string;
  offerTo?: string;
}

export default function NotificationsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const isRTL = locale === 'ar';

  const [usage, setUsage] = useState<{ count: number; limit: number; month: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [sendToAllBooked, setSendToAllBooked] = useState(false);
  const [linkType, setLinkType] = useState<'none' | 'tenant' | 'service'>('tenant');
  const [serviceId, setServiceId] = useState<string>('');
  const [servicesWithOffers, setServicesWithOffers] = useState<ServiceOption[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [historyCampaigns, setHistoryCampaigns] = useState<Array<{ id: string; title: string; bodyTruncated: string; data?: { linkType?: string }; audienceType: string; recipientCount: number; sentAt: string }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPagination, setHistoryPagination] = useState<{ total: number; page: number; totalPages: number } | null>(null);
  const [recipientsModal, setRecipientsModal] = useState<{ campaignId: string; title: string } | null>(null);
  const [recipientsList, setRecipientsList] = useState<Array<{ email?: string; firstName?: string; lastName?: string }>>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);

  // Load usage and customers
  useEffect(() => {
    const load = async () => {
      setLoadError(null);
      try {
        const res = await tenantApi.getPushUsage();
        if (res?.data) setUsage(res.data);
        else setUsage(null);
      } catch (_) {
        setUsage(null);
        setLoadError(locale === 'ar' ? 'تعذر تحميل بيانات الاستخدام. تحقق من اتصالك وحاول مرة أخرى.' : 'Could not load usage. Check your connection and try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [locale]);

  // Load push history
  const loadHistory = async (page = 1) => {
    setHistoryLoading(true);
    try {
      const res = await tenantApi.getPushHistory({ page, limit: 10 });
      if (res.success) {
        setHistoryCampaigns(res.campaigns ?? []);
        setHistoryPagination(res.pagination ?? null);
      }
    } catch (_) {
      setHistoryCampaigns([]);
    } finally {
      setHistoryLoading(false);
    }
  };
  useEffect(() => {
    if (usage != null && usage.limit !== 0) loadHistory();
  }, [usage?.limit]);

  const openRecipients = async (campaignId: string, title: string) => {
    setRecipientsModal({ campaignId, title });
    setRecipientsLoading(true);
    try {
      const res = await tenantApi.getPushHistoryRecipients(campaignId);
      setRecipientsList(res?.recipients ?? []);
    } catch (_) {
      setRecipientsList([]);
    } finally {
      setRecipientsLoading(false);
    }
  };

  // Load services with active offers for "Link to service" dropdown
  useEffect(() => {
    const load = async () => {
      setServicesLoading(true);
      try {
        const res = await tenantApi.getServices({ isActive: true });
        const list = res?.services ?? res?.data?.services ?? [];
        const today = new Date().toISOString().slice(0, 10);
        const withOffers = list.filter((s: ServiceOption) => {
          if (!s.hasOffer) return false;
          const fromOk = !s.offerFrom || s.offerFrom <= today;
          const toOk = !s.offerTo || s.offerTo >= today;
          return fromOk && toOk;
        });
        setServicesWithOffers(withOffers);
      } catch (_) {
        setServicesWithOffers([]);
      } finally {
        setServicesLoading(false);
      }
    };
    load();
  }, []);

  // Load customers when user expands the selection panel
  const loadCustomers = async () => {
    if (customers.length > 0) return; // Already loaded
    
    setCustomersLoading(true);
    try {
      const res = await tenantApi.getCustomers({ limit: 100 });
      if (res?.data?.customers && Array.isArray(res.data.customers)) {
        setCustomers(res.data.customers);
      } else if (res?.data && Array.isArray(res.data)) {
        setCustomers(res.data);
      }
    } catch (e) {
      console.error('Failed to load customers:', e);
    } finally {
      setCustomersLoading(false);
    }
  };

  const handleToggleCustomer = (customerId: string) => {
    setSelectedCustomers(prev => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedCustomers.size === customers.length) {
      setSelectedCustomers(new Set());
    } else {
      setSelectedCustomers(new Set(customers.map(c => c.id)));
    }
  };

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      setMessage({ type: 'error', text: locale === 'ar' ? 'أدخل العنوان والنص' : 'Enter title and message' });
      return;
    }

    if (!sendToAllBooked && selectedCustomers.size === 0) {
      setMessage({ type: 'error', text: locale === 'ar' ? 'اختر على الأقل عميل واحد أو فعّل "إرسال لجميع من حجز"' : 'Select at least one customer or enable "Send to all who have booked"' });
      return;
    }

    setSending(true);
    setMessage(null);
    try {
      const payload: any = sendToAllBooked
        ? { audience: 'all_booked', title: title.trim(), body: body.trim() }
        : { platformUserIds: Array.from(selectedCustomers), title: title.trim(), body: body.trim() };
      payload.linkType = linkType;
      if (linkType === 'service' && serviceId) payload.serviceId = serviceId;
      const res = await tenantApi.sendMarketingPush(payload);
      if (res.success) {
        setMessage({
          type: 'success',
          text: (locale === 'ar' ? 'تم الإرسال إلى ' : 'Sent to ') + (res.data?.sent ?? 0) + (locale === 'ar' ? ' عميل' : ' customer(s)'),
        });
        setTitle('');
        setBody('');
        setSelectedCustomers(new Set());
        const usageRes = await tenantApi.getPushUsage();
        if (usageRes?.data) setUsage(usageRes.data);
        loadHistory(1);
      } else {
        setMessage({ type: 'error', text: (res as any).message || (locale === 'ar' ? 'فشل الإرسال' : 'Send failed') });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.message || (locale === 'ar' ? 'فشل الإرسال' : 'Send failed') });
    } finally {
      setSending(false);
    }
  };

  const limitText = usage
    ? usage.limit === -1
      ? locale === 'ar'
        ? `غير محدود (استخدمت ${usage.count} هذا الشهر)`
        : `Unlimited (used ${usage.count} this month)`
      : locale === 'ar'
        ? `${usage.count} / ${usage.limit} هذا الشهر`
        : `${usage.count} / ${usage.limit} this month`
    : '—';

  return (
    <TenantLayout>
      <div className="p-6 max-w-4xl" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {locale === 'ar' ? 'إشعارات الدفع للعملاء' : 'Customer push notifications'}
        </h1>
        <p className="text-gray-600 mb-6">
          {locale === 'ar'
            ? 'اختر العملاء وأرسل لهم إشعارات (يخصم من حصتك الشهرية).'
            : 'Select customers and send them notifications (counts against your monthly quota).'}
        </p>

        {loading ? (
          <p className="text-gray-500">{locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
        ) : loadError ? (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-amber-800 text-sm">{loadError}</p>
          </div>
        ) : (
          <>
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm font-medium text-gray-700">
                {locale === 'ar' ? 'المستخدم هذا الشهر' : 'Usage this month'}
              </p>
              <p className="text-lg font-semibold text-primary-600 mt-1">{limitText}</p>
            </div>

            {usage != null && usage.limit !== 0 && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Main notification form */}
                  <div className="lg:col-span-2">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {locale === 'ar' ? 'العنوان' : 'Title'}
                        </label>
                        <input
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder={locale === 'ar' ? 'مثال: عرض خاص' : 'e.g. Special offer'}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {locale === 'ar' ? 'الرسالة' : 'Message'}
                        </label>
                        <textarea
                          value={body}
                          onChange={(e) => setBody(e.target.value)}
                          placeholder={locale === 'ar' ? 'نص الإشعار...' : 'Notification text...'}
                          rows={4}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {locale === 'ar' ? 'ربط الإشعار بـ' : 'Link notification to'}
                        </label>
                        <select
                          value={linkType}
                          onChange={(e) => {
                            setLinkType(e.target.value as 'none' | 'tenant' | 'service');
                            if (e.target.value !== 'service') setServiceId('');
                          }}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        >
                          <option value="none">{locale === 'ar' ? 'بدون رابط' : 'None (general announcement)'}</option>
                          <option value="tenant">{locale === 'ar' ? 'صفحة المنشأة' : 'Tenant page'}</option>
                          <option value="service">{locale === 'ar' ? 'خدمة ذات عرض' : 'Service with offer'}</option>
                        </select>
                        {linkType === 'service' && (
                          <select
                            value={serviceId}
                            onChange={(e) => setServiceId(e.target.value)}
                            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                          >
                            <option value="">{locale === 'ar' ? 'اختر الخدمة' : 'Select service'}</option>
                            {servicesWithOffers.map((s) => (
                              <option key={s.id} value={s.id}>
                                {locale === 'ar' ? (s.name_ar || s.name_en) : (s.name_en || s.name_ar)}
                              </option>
                            ))}
                            {!servicesLoading && servicesWithOffers.length === 0 && (
                              <option value="" disabled>{locale === 'ar' ? 'لا توجد خدمات بعروض نشطة' : 'No services with active offers'}</option>
                            )}
                          </select>
                        )}
                      </div>

                      {message && (
                        <div
                          className={`p-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}
                        >
                          {message.text}
                        </div>
                      )}

                      <div className="flex items-center gap-2 mb-3">
                        <input
                          type="checkbox"
                          id="sendToAllBooked"
                          checked={sendToAllBooked}
                          onChange={(e) => setSendToAllBooked(e.target.checked)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <label htmlFor="sendToAllBooked" className="text-sm text-gray-700">
                          {locale === 'ar' ? 'إرسال لجميع من حجز أو طلب من عندك' : 'Send to all customers who have booked or ordered'}
                        </label>
                      </div>

                      <button
                        type="button"
                        onClick={handleSend}
                        disabled={sending || (usage != null && usage.limit !== -1 && usage.count >= usage.limit) || (!sendToAllBooked && selectedCustomers.size === 0)}
                        className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        {sending ? (locale === 'ar' ? 'جاري الإرسال...' : 'Sending...') : locale === 'ar' ? 'إرسال إشعار' : 'Send notification'}
                      </button>
                    </div>
                  </div>

                  {/* Customer selection sidebar */}
                  <div className="lg:col-span-1">
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => {
                          setShowCustomerList(!showCustomerList);
                          if (!showCustomerList) loadCustomers();
                        }}
                        className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-150 font-medium text-sm text-left flex justify-between items-center"
                      >
                        <span>
                          {locale === 'ar' ? 'العملاء' : 'Customers'} ({selectedCustomers.size})
                        </span>
                        <span className="text-lg">{showCustomerList ? '−' : '+'}</span>
                      </button>

                      {showCustomerList && (
                        <div className="max-h-96 overflow-y-auto p-3 bg-white">
                          {customersLoading ? (
                            <p className="text-sm text-gray-500 text-center py-4">
                              {locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}
                            </p>
                          ) : customers.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-4">
                              {locale === 'ar' ? 'لا يوجد عملاء' : 'No customers'}
                            </p>
                          ) : (
                            <>
                              <div className="mb-3 pb-3 border-b">
                                <label className="flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={selectedCustomers.size === customers.length && customers.length > 0}
                                    onChange={handleSelectAll}
                                    className="rounded border-gray-300"
                                  />
                                  <span className="ml-2 text-sm font-medium text-gray-900">
                                    {locale === 'ar' ? 'تحديد الكل' : 'Select all'}
                                  </span>
                                </label>
                              </div>
                              
                              <div className="space-y-2">
                                {customers.map((customer) => (
                                  <label
                                    key={customer.id}
                                    className="flex items-start cursor-pointer hover:bg-gray-50 p-2 rounded"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedCustomers.has(customer.id)}
                                      onChange={() => handleToggleCustomer(customer.id)}
                                      className="rounded border-gray-300 mt-0.5"
                                    />
                                    <div className="ml-2 flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900 truncate">
                                        {customer.firstName} {customer.lastName}
                                      </p>
                                      <p className="text-xs text-gray-500 truncate">{customer.email}</p>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {usage != null && usage.limit === 0 && (
              <p className="text-gray-600">
                {locale === 'ar'
                  ? 'خطتك الحالية لا تتضمن إشعارات دفع. ترقية لاستخدام هذه الميزة.'
                  : 'Your current plan does not include push notifications. Upgrade to use this feature.'}
              </p>
            )}

            {/* Push history */}
            {usage != null && usage.limit !== 0 && (
              <div className="mt-10 border-t border-gray-200 pt-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  {locale === 'ar' ? 'سجل الإشعارات المرسلة' : 'Sent notifications history'}
                </h2>
                {historyLoading ? (
                  <p className="text-gray-500">{locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
                ) : historyCampaigns.length === 0 ? (
                  <p className="text-gray-500">{locale === 'ar' ? 'لم ترسل أي إشعارات بعد.' : 'No notifications sent yet.'}</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{locale === 'ar' ? 'التاريخ' : 'Date'}</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{locale === 'ar' ? 'العنوان' : 'Title'}</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{locale === 'ar' ? 'الرسالة' : 'Message'}</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{locale === 'ar' ? 'الرابط' : 'Link'}</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{locale === 'ar' ? 'الجمهور' : 'Audience'}</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{locale === 'ar' ? 'المستلمون' : 'Recipients'}</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"></th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {historyCampaigns.map((c) => (
                          <tr key={c.id}>
                            <td className="px-4 py-2 text-sm text-gray-600">
                              {new Date(c.sentAt).toLocaleDateString(locale === 'ar' ? 'ar' : 'en', { dateStyle: 'short' })}
                            </td>
                            <td className="px-4 py-2 text-sm font-medium text-gray-900">{c.title}</td>
                            <td className="px-4 py-2 text-sm text-gray-600 max-w-xs truncate">{c.bodyTruncated}</td>
                            <td className="px-4 py-2 text-sm text-gray-600">
                              {c.data?.linkType === 'service' ? (locale === 'ar' ? 'خدمة' : 'Service') : c.data?.linkType === 'none' ? (locale === 'ar' ? 'بدون' : 'None') : (locale === 'ar' ? 'صفحة المنشأة' : 'Tenant')}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600">
                              {c.audienceType === 'all_booked' ? (locale === 'ar' ? 'جميع من حجز' : 'All who booked') : (locale === 'ar' ? 'محدد' : 'Selected')}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600">{c.recipientCount}</td>
                            <td className="px-4 py-2">
                              <button
                                type="button"
                                onClick={() => openRecipients(c.id, c.title)}
                                className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                              >
                                {locale === 'ar' ? 'عرض المستلمين' : 'View recipients'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {historyPagination && historyPagination.totalPages > 1 && (
                  <div className="mt-2 flex justify-between items-center">
                    <p className="text-sm text-gray-600">
                      {locale === 'ar' ? `صفحة ${historyPagination.page} من ${historyPagination.totalPages}` : `Page ${historyPagination.page} of ${historyPagination.totalPages}`}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={historyPagination.page <= 1}
                        onClick={() => loadHistory(historyPagination.page - 1)}
                        className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                      >
                        {locale === 'ar' ? 'السابق' : 'Previous'}
                      </button>
                      <button
                        type="button"
                        disabled={historyPagination.page >= historyPagination.totalPages}
                        onClick={() => loadHistory(historyPagination.page + 1)}
                        className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                      >
                        {locale === 'ar' ? 'التالي' : 'Next'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Recipients modal */}
            {recipientsModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setRecipientsModal(null)}>
                <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
                  <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="font-semibold text-gray-900">{recipientsModal.title} — {locale === 'ar' ? 'المستلمون' : 'Recipients'}</h3>
                    <button type="button" onClick={() => setRecipientsModal(null)} className="text-gray-500 hover:text-gray-700">×</button>
                  </div>
                  <div className="p-4 overflow-y-auto max-h-96">
                    {recipientsLoading ? (
                      <p className="text-gray-500">{locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
                    ) : recipientsList.length === 0 ? (
                      <p className="text-gray-500">{locale === 'ar' ? 'لا يوجد مستلمون' : 'No recipients'}</p>
                    ) : (
                      <ul className="space-y-2">
                        {recipientsList.map((r, i) => (
                          <li key={i} className="text-sm text-gray-700">
                            {[r.firstName, r.lastName].filter(Boolean).join(' ') || r.email || '—'}
                            {r.email && <span className="text-gray-500 ml-1">({r.email})</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </TenantLayout>
  );
}
