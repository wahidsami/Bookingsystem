'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { TenantLayout } from '@/components/TenantLayout';
import { getImageUrl, tenantApi } from '@/lib/api';

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface ServiceOption {
  id: string;
  name_en: string;
  name_ar: string;
  hasOffer: boolean;
  offerFrom?: string;
  offerTo?: string;
}

interface PushRecipientDebug {
  platformUserId: string;
  success: boolean;
  skipped: boolean;
  reason?: string | null;
  error?: string | null;
  deviceCount: number;
  tokenCount: number;
  invalidTokenCount: number;
  expoStatuses: string[];
}

interface PushDebugPayload {
  requestedRecipients: number;
  attemptedRecipients: number;
  sentRecipients: number;
  skippedRecipients: number;
  failedRecipients: number;
  skippedReasons: Record<string, number>;
  usageBeforeSend?: number;
  usageLimit?: number;
  recipientResults: PushRecipientDebug[];
}

interface PushSendResponse {
  success: boolean;
  message?: string;
  data?: { sent: number };
  debug?: PushDebugPayload;
  status?: number;
}

interface PushDebugState {
  startedAt: string;
  finishedAt?: string;
  status: 'sending' | 'success' | 'error';
  requestPayload: {
    audience?: string;
    platformUserIds?: string[];
    title: string;
    body: string;
    linkType?: 'none' | 'tenant' | 'service';
    serviceId?: string;
    imageUrl?: string;
  };
  response?: PushSendResponse;
  error?: string;
}

export default function NotificationsPage() {
  const locale = useLocale();
  const isRTL = locale === 'ar';

  const copy = useMemo(() => {
    if (locale === 'ar') {
      return {
        title: 'اشعارات العملاء',
        subtitle: 'اختر العملاء وارسل الاشعار، ثم افتح نافذة التشخيص لرؤية ما حدث بالتفصيل.',
        loading: 'جاري التحميل...',
        usageError: 'تعذر تحميل بيانات الاستخدام. تحقق من الاتصال ثم حاول مرة اخرى.',
        usageThisMonth: 'الاستخدام هذا الشهر',
        usageUnlimited: (count: number) => `غير محدود (المستخدم ${count} هذا الشهر)`,
        usageLimited: (count: number, limit: number) => `${count} / ${limit} هذا الشهر`,
        formTitle: 'العنوان',
        formBody: 'الرسالة',
        formLink: 'ربط الاشعار',
        formImage: 'صورة الاشعار',
        uploadImage: 'رفع صورة',
        changeImage: 'تغيير الصورة',
        removeImage: 'حذف الصورة',
        imageUploadFailed: 'فشل رفع الصورة',
        titlePlaceholder: 'مثال: عرض خاص',
        bodyPlaceholder: 'اكتب نص الاشعار...',
        linkNone: 'بدون رابط',
        linkTenant: 'صفحة المنشاة',
        linkService: 'خدمة مع عرض',
        selectService: 'اختر الخدمة',
        noOfferedServices: 'لا توجد خدمات بعروض نشطة',
        sendToAll: 'ارسال الى جميع العملاء الذين لديهم حجز او طلب',
        send: 'ارسال اشعار',
        sending: 'جاري الارسال...',
        openDebug: 'فتح نافذة التشخيص',
        lastAttempt: 'اخر محاولة ارسال',
        attemptRunning: 'طلب الارسال قيد التنفيذ',
        attemptDone: 'اكتملت المحاولة',
        attemptFailed: 'انتهت المحاولة بخطأ',
        viewDetails: 'عرض التفاصيل',
        customers: 'العملاء',
        selectAll: 'تحديد الكل',
        noCustomers: 'لا يوجد عملاء',
        selectCustomerError: 'اختر عميلا واحدا على الاقل او فعل الارسال للجميع.',
        emptyMessageError: 'ادخل العنوان والرسالة.',
        sendFailed: 'فشل الارسال',
        sentTo: (count: number) => `تم الارسال الى ${count} عميل`,
        historyTitle: 'سجل الاشعارات المرسلة',
        noHistory: 'لا توجد اشعارات مرسلة حتى الان.',
        date: 'التاريخ',
        historyTitleCol: 'العنوان',
        historyMessage: 'الرسالة',
        historyLink: 'الرابط',
        historyAudience: 'الجمهور',
        historyRecipients: 'المستلمون',
        linkLabelService: 'خدمة',
        linkLabelNone: 'بدون',
        linkLabelTenant: 'منشاة',
        audienceAll: 'الكل',
        audienceSelected: 'محدد',
        viewRecipients: 'عرض المستلمين',
        previous: 'السابق',
        next: 'التالي',
        pageOf: (page: number, total: number) => `صفحة ${page} من ${total}`,
        recipients: 'المستلمون',
        noRecipients: 'لا يوجد مستلمون',
        noPushAccess: 'خطتك الحالية لا تتضمن اشعارات العملاء. قم بالترقية لاستخدام هذه الميزة.',
        debugWindow: 'نافذة تشخيص اشعارات العملاء',
        status: 'الحالة',
        started: 'بدأ في',
        finished: 'انتهى في',
        serverMessage: 'رسالة الخادم',
        requested: 'المطلوب',
        attempted: 'تمت المحاولة',
        sent: 'تم الارسال',
        skipped: 'تم التجاوز',
        failed: 'فشل',
        skippedReasons: 'اسباب التجاوز',
        requestPayload: 'الطلب المرسل',
        serverResponse: 'استجابة الخادم',
        recipientResults: 'نتائج العملاء',
        user: 'المستخدم',
        success: 'نجاح',
        reason: 'السبب',
        devices: 'الاجهزة',
        tokens: 'الرموز',
        invalid: 'غير صالح',
        expo: 'Expo',
      };
    }

    return {
      title: 'Customer push notifications',
      subtitle: 'Select customers, send the notification, and inspect a full debug record for every send attempt.',
      loading: 'Loading...',
      usageError: 'Could not load usage. Check your connection and try again.',
      usageThisMonth: 'Usage this month',
      usageUnlimited: (count: number) => `Unlimited (used ${count} this month)`,
      usageLimited: (count: number, limit: number) => `${count} / ${limit} this month`,
      formTitle: 'Title',
      formBody: 'Message',
      formLink: 'Link notification to',
      formImage: 'Notification image',
      uploadImage: 'Upload image',
      changeImage: 'Change image',
      removeImage: 'Remove image',
      imageUploadFailed: 'Image upload failed',
      titlePlaceholder: 'e.g. Special offer',
      bodyPlaceholder: 'Write the notification text...',
      linkNone: 'None',
      linkTenant: 'Tenant page',
      linkService: 'Service with offer',
      selectService: 'Select service',
      noOfferedServices: 'No services with active offers',
      sendToAll: 'Send to all customers who have booked or ordered',
      send: 'Send notification',
      sending: 'Sending...',
      openDebug: 'Open debug window',
      lastAttempt: 'Last send attempt',
      attemptRunning: 'Send request in progress',
      attemptDone: 'Attempt completed',
      attemptFailed: 'Attempt ended with an error',
      viewDetails: 'View details',
      customers: 'Customers',
      selectAll: 'Select all',
      noCustomers: 'No customers',
      selectCustomerError: 'Select at least one customer or enable send to all.',
      emptyMessageError: 'Enter both title and message.',
      sendFailed: 'Send failed',
      sentTo: (count: number) => `Sent to ${count} customer(s)`,
      historyTitle: 'Sent notifications history',
      noHistory: 'No notifications sent yet.',
      date: 'Date',
      historyTitleCol: 'Title',
      historyMessage: 'Message',
      historyLink: 'Link',
      historyAudience: 'Audience',
      historyRecipients: 'Recipients',
      linkLabelService: 'Service',
      linkLabelNone: 'None',
      linkLabelTenant: 'Tenant',
      audienceAll: 'All who booked',
      audienceSelected: 'Selected',
      viewRecipients: 'View recipients',
      previous: 'Previous',
      next: 'Next',
      pageOf: (page: number, total: number) => `Page ${page} of ${total}`,
      recipients: 'Recipients',
      noRecipients: 'No recipients',
      noPushAccess: 'Your current plan does not include push notifications. Upgrade to use this feature.',
      debugWindow: 'Customer push debug window',
      status: 'Status',
      started: 'Started',
      finished: 'Finished',
      serverMessage: 'Server message',
      requested: 'Requested',
      attempted: 'Attempted',
      sent: 'Sent',
      skipped: 'Skipped',
      failed: 'Failed',
      skippedReasons: 'Skipped reasons',
      requestPayload: 'Request payload',
      serverResponse: 'Server response',
      recipientResults: 'Recipient results',
      user: 'User',
      success: 'Success',
      reason: 'Reason',
      devices: 'Devices',
      tokens: 'Tokens',
      invalid: 'Invalid',
      expo: 'Expo',
    };
  }, [locale]);

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
  const [serviceId, setServiceId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [servicesWithOffers, setServicesWithOffers] = useState<ServiceOption[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [historyCampaigns, setHistoryCampaigns] = useState<Array<{ id: string; title: string; bodyTruncated: string; data?: { linkType?: string }; audienceType: string; recipientCount: number; sentAt: string }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPagination, setHistoryPagination] = useState<{ total: number; page: number; totalPages: number } | null>(null);
  const [recipientsModal, setRecipientsModal] = useState<{ campaignId: string; title: string } | null>(null);
  const [recipientsList, setRecipientsList] = useState<Array<{ email?: string; firstName?: string; lastName?: string }>>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [pushDebug, setPushDebug] = useState<PushDebugState | null>(null);
  const [showDebugModal, setShowDebugModal] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoadError(null);
      try {
        const res = await tenantApi.getPushUsage();
        setUsage(res?.data || null);
      } catch (_) {
        setUsage(null);
        setLoadError(copy.usageError);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [copy.usageError]);

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
    if (usage != null && usage.limit !== 0) {
      loadHistory();
    }
  }, [usage?.limit]);

  useEffect(() => {
    const load = async () => {
      setServicesLoading(true);
      try {
        const res = await tenantApi.getServices({ isActive: true });
        const list = res?.services ?? res?.data?.services ?? [];
        const today = new Date().toISOString().slice(0, 10);
        const withOffers = list.filter((service: ServiceOption) => {
          if (!service.hasOffer) return false;
          const fromOk = !service.offerFrom || service.offerFrom <= today;
          const toOk = !service.offerTo || service.offerTo >= today;
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

  const loadCustomers = async () => {
    if (customers.length > 0) return;

    setCustomersLoading(true);
    try {
      const res = await tenantApi.getCustomers({ limit: 100 });
      if (res?.data?.customers && Array.isArray(res.data.customers)) {
        setCustomers(res.data.customers);
      } else if (res?.data && Array.isArray(res.data)) {
        setCustomers(res.data);
      } else {
        setCustomers([]);
      }
    } catch (error) {
      console.error('Failed to load customers:', error);
      setCustomers([]);
    } finally {
      setCustomersLoading(false);
    }
  };

  const openRecipients = async (campaignId: string, campaignTitle: string) => {
    setRecipientsModal({ campaignId, title: campaignTitle });
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

  const handleToggleCustomer = (customerId: string) => {
    setSelectedCustomers((prev) => {
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
      setSelectedCustomers(new Set(customers.map((customer) => customer.id)));
    }
  };

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      setMessage({ type: 'error', text: copy.emptyMessageError });
      return;
    }

    if (!sendToAllBooked && selectedCustomers.size === 0) {
      setMessage({ type: 'error', text: copy.selectCustomerError });
      return;
    }

    const payload: PushDebugState['requestPayload'] = sendToAllBooked
      ? { audience: 'all_booked', title: title.trim(), body: body.trim() }
      : { platformUserIds: Array.from(selectedCustomers), title: title.trim(), body: body.trim() };

    payload.linkType = linkType;
    if (linkType === 'service' && serviceId) {
      payload.serviceId = serviceId;
    }
    if (imageUrl) {
      payload.imageUrl = imageUrl;
    }

    const startedAt = new Date().toISOString();
    setPushDebug({
      startedAt,
      status: 'sending',
      requestPayload: payload,
    });
    setShowDebugModal(true);
    setSending(true);
    setMessage(null);

    try {
      const res = await tenantApi.sendMarketingPush(payload);
      setPushDebug({
        startedAt,
        finishedAt: new Date().toISOString(),
        status: res.success ? 'success' : 'error',
        requestPayload: payload,
        response: res,
      });

      if (res.success) {
        const recipientCount = res.debug?.requestedRecipients ?? res.data?.sent ?? 0;
        setMessage({ type: 'success', text: copy.sentTo(recipientCount) });
        setTitle('');
        setBody('');
        setImageUrl('');
        setSelectedCustomers(new Set());
        const usageRes = await tenantApi.getPushUsage();
        if (usageRes?.data) {
          setUsage(usageRes.data);
        }
        loadHistory(1);
      } else {
        setMessage({ type: 'error', text: res.message || copy.sendFailed });
      }
    } catch (error: any) {
      setPushDebug({
        startedAt,
        finishedAt: new Date().toISOString(),
        status: 'error',
        requestPayload: payload,
        error: error?.message || copy.sendFailed,
      });
      setMessage({ type: 'error', text: error?.message || copy.sendFailed });
    } finally {
      setSending(false);
    }
  };

  const limitText = usage
    ? usage.limit === -1
      ? copy.usageUnlimited(usage.count)
      : copy.usageLimited(usage.count, usage.limit)
    : '-';

  const formatDateTime = (value?: string) => {
    if (!value) return '-';
    try {
      return new Date(value).toLocaleString(locale === 'ar' ? 'ar' : 'en');
    } catch {
      return value;
    }
  };

  const handleImageSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setImageUploading(true);
    setMessage(null);
    try {
      const res = await tenantApi.uploadMarketingPushImage(file);
      if (res.success && res.data?.imageUrl) {
        setImageUrl(res.data.imageUrl);
      } else {
        setMessage({ type: 'error', text: res.message || copy.imageUploadFailed });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || copy.imageUploadFailed });
    } finally {
      setImageUploading(false);
      event.target.value = '';
    }
  };

  const debugSummary = pushDebug?.response?.debug;

  return (
    <TenantLayout>
      <div className="p-6 max-w-6xl" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{copy.title}</h1>
        <p className="text-gray-600 mb-6">{copy.subtitle}</p>

        {loading ? (
          <p className="text-gray-500">{copy.loading}</p>
        ) : loadError ? (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-amber-800 text-sm">{loadError}</p>
          </div>
        ) : (
          <>
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm font-medium text-gray-700">{copy.usageThisMonth}</p>
              <p className="text-lg font-semibold text-primary-600 mt-1">{limitText}</p>
            </div>

            {usage != null && usage.limit !== 0 && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{copy.formTitle}</label>
                        <input
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder={copy.titlePlaceholder}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{copy.formBody}</label>
                        <textarea
                          value={body}
                          onChange={(e) => setBody(e.target.value)}
                          placeholder={copy.bodyPlaceholder}
                          rows={4}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{copy.formLink}</label>
                        <select
                          value={linkType}
                          onChange={(e) => {
                            setLinkType(e.target.value as 'none' | 'tenant' | 'service');
                            if (e.target.value !== 'service') {
                              setServiceId('');
                            }
                          }}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        >
                          <option value="none">{copy.linkNone}</option>
                          <option value="tenant">{copy.linkTenant}</option>
                          <option value="service">{copy.linkService}</option>
                        </select>

                        {linkType === 'service' && (
                          <select
                            value={serviceId}
                            onChange={(e) => setServiceId(e.target.value)}
                            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                          >
                            <option value="">{copy.selectService}</option>
                            {servicesWithOffers.map((service) => (
                              <option key={service.id} value={service.id}>
                                {locale === 'ar' ? (service.name_ar || service.name_en) : (service.name_en || service.name_ar)}
                              </option>
                            ))}
                            {!servicesLoading && servicesWithOffers.length === 0 && (
                              <option value="" disabled>{copy.noOfferedServices}</option>
                            )}
                          </select>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{copy.formImage}</label>
                        {imageUrl ? (
                          <div className="space-y-3">
                            <img
                              src={getImageUrl(imageUrl)}
                              alt="Notification"
                              className="w-full max-w-md h-48 object-cover rounded-xl border border-gray-200"
                            />
                            <div className="flex gap-3">
                              <label className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50">
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageSelected} />
                                {imageUploading ? copy.sending : copy.changeImage}
                              </label>
                              <button
                                type="button"
                                onClick={() => setImageUrl('')}
                                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                              >
                                {copy.removeImage}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <label className="inline-flex items-center justify-center rounded-lg border border-dashed border-gray-300 px-4 py-6 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50 w-full max-w-md">
                            <input type="file" accept="image/*" className="hidden" onChange={handleImageSelected} />
                            {imageUploading ? copy.sending : copy.uploadImage}
                          </label>
                        )}
                      </div>

                      {message && (
                        <div className={`p-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                          {message.text}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="sendToAllBooked"
                          checked={sendToAllBooked}
                          onChange={(e) => setSendToAllBooked(e.target.checked)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <label htmlFor="sendToAllBooked" className="text-sm text-gray-700">
                          {copy.sendToAll}
                        </label>
                      </div>

                      <button
                        type="button"
                        onClick={handleSend}
                        disabled={sending || (usage != null && usage.limit !== -1 && usage.count >= usage.limit) || (!sendToAllBooked && selectedCustomers.size === 0)}
                        className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        {sending ? copy.sending : copy.send}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowDebugModal(true)}
                        disabled={!pushDebug}
                        className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        {copy.openDebug}
                      </button>
                    </div>
                  </div>

                  <div className="lg:col-span-1">
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setShowCustomerList(!showCustomerList);
                          if (!showCustomerList) {
                            loadCustomers();
                          }
                        }}
                        className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-150 font-medium text-sm text-left flex justify-between items-center"
                      >
                        <span>{copy.customers} ({selectedCustomers.size})</span>
                        <span className="text-lg">{showCustomerList ? '-' : '+'}</span>
                      </button>

                      {showCustomerList && (
                        <div className="max-h-96 overflow-y-auto p-3 bg-white">
                          {customersLoading ? (
                            <p className="text-sm text-gray-500 text-center py-4">{copy.loading}</p>
                          ) : customers.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-4">{copy.noCustomers}</p>
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
                                  <span className="ml-2 text-sm font-medium text-gray-900">{copy.selectAll}</span>
                                </label>
                              </div>

                              <div className="space-y-2">
                                {customers.map((customer) => (
                                  <label key={customer.id} className="flex items-start cursor-pointer hover:bg-gray-50 p-2 rounded">
                                    <input
                                      type="checkbox"
                                      checked={selectedCustomers.has(customer.id)}
                                      onChange={() => handleToggleCustomer(customer.id)}
                                      className="rounded border-gray-300 mt-0.5"
                                    />
                                    <div className="ml-2 flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900 truncate">{customer.firstName} {customer.lastName}</p>
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

                {pushDebug && (
                  <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-900">{copy.lastAttempt}</h2>
                        <p className="text-xs text-slate-600 mt-1">
                          {pushDebug.status === 'sending' ? copy.attemptRunning : pushDebug.status === 'success' ? copy.attemptDone : copy.attemptFailed}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowDebugModal(true)}
                        className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-white text-sm font-medium"
                      >
                        {copy.viewDetails}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {usage != null && usage.limit === 0 && (
              <p className="text-gray-600">{copy.noPushAccess}</p>
            )}

            {usage != null && usage.limit !== 0 && (
              <div className="mt-10 border-t border-gray-200 pt-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{copy.historyTitle}</h2>
                {historyLoading ? (
                  <p className="text-gray-500">{copy.loading}</p>
                ) : historyCampaigns.length === 0 ? (
                  <p className="text-gray-500">{copy.noHistory}</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{copy.date}</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{copy.historyTitleCol}</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{copy.historyMessage}</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{copy.historyLink}</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{copy.historyAudience}</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{copy.historyRecipients}</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"></th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {historyCampaigns.map((campaign) => (
                          <tr key={campaign.id}>
                            <td className="px-4 py-2 text-sm text-gray-600">{new Date(campaign.sentAt).toLocaleDateString(locale === 'ar' ? 'ar' : 'en', { dateStyle: 'short' })}</td>
                            <td className="px-4 py-2 text-sm font-medium text-gray-900">{campaign.title}</td>
                            <td className="px-4 py-2 text-sm text-gray-600 max-w-xs truncate">{campaign.bodyTruncated}</td>
                            <td className="px-4 py-2 text-sm text-gray-600">
                              {campaign.data?.linkType === 'service' ? copy.linkLabelService : campaign.data?.linkType === 'none' ? copy.linkLabelNone : copy.linkLabelTenant}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600">{campaign.audienceType === 'all_booked' ? copy.audienceAll : copy.audienceSelected}</td>
                            <td className="px-4 py-2 text-sm text-gray-600">{campaign.recipientCount}</td>
                            <td className="px-4 py-2">
                              <button
                                type="button"
                                onClick={() => openRecipients(campaign.id, campaign.title)}
                                className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                              >
                                {copy.viewRecipients}
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
                    <p className="text-sm text-gray-600">{copy.pageOf(historyPagination.page, historyPagination.totalPages)}</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={historyPagination.page <= 1}
                        onClick={() => loadHistory(historyPagination.page - 1)}
                        className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                      >
                        {copy.previous}
                      </button>
                      <button
                        type="button"
                        disabled={historyPagination.page >= historyPagination.totalPages}
                        onClick={() => loadHistory(historyPagination.page + 1)}
                        className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                      >
                        {copy.next}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {recipientsModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setRecipientsModal(null)}>
                <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
                  <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="font-semibold text-gray-900">{recipientsModal.title} - {copy.recipients}</h3>
                    <button type="button" onClick={() => setRecipientsModal(null)} className="text-gray-500 hover:text-gray-700">x</button>
                  </div>
                  <div className="p-4 overflow-y-auto max-h-96">
                    {recipientsLoading ? (
                      <p className="text-gray-500">{copy.loading}</p>
                    ) : recipientsList.length === 0 ? (
                      <p className="text-gray-500">{copy.noRecipients}</p>
                    ) : (
                      <ul className="space-y-2">
                        {recipientsList.map((recipient, index) => (
                          <li key={`${recipient.email || 'recipient'}-${index}`} className="text-sm text-gray-700">
                            {[recipient.firstName, recipient.lastName].filter(Boolean).join(' ') || recipient.email || '-'}
                            {recipient.email && <span className="text-gray-500 ml-1">({recipient.email})</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}

            {showDebugModal && pushDebug && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDebugModal(false)}>
                <div className="bg-white rounded-lg max-w-6xl w-full max-h-[85vh] overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
                  <div className="p-4 border-b flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-gray-900">{copy.debugWindow}</h3>
                      <p className="text-xs text-gray-500 mt-1">{pushDebug.response?.status ? `HTTP ${pushDebug.response.status}` : ''}</p>
                    </div>
                    <button type="button" onClick={() => setShowDebugModal(false)} className="text-gray-500 hover:text-gray-700">x</button>
                  </div>

                  <div className="p-4 overflow-y-auto max-h-[calc(85vh-72px)] space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="rounded-lg border border-gray-200 p-3">
                        <p className="text-xs text-gray-500">{copy.status}</p>
                        <p className="text-sm font-semibold text-gray-900 mt-1">{pushDebug.status}</p>
                      </div>
                      <div className="rounded-lg border border-gray-200 p-3">
                        <p className="text-xs text-gray-500">{copy.started}</p>
                        <p className="text-sm font-semibold text-gray-900 mt-1">{formatDateTime(pushDebug.startedAt)}</p>
                      </div>
                      <div className="rounded-lg border border-gray-200 p-3">
                        <p className="text-xs text-gray-500">{copy.finished}</p>
                        <p className="text-sm font-semibold text-gray-900 mt-1">{formatDateTime(pushDebug.finishedAt)}</p>
                      </div>
                      <div className="rounded-lg border border-gray-200 p-3">
                        <p className="text-xs text-gray-500">{copy.serverMessage}</p>
                        <p className="text-sm font-semibold text-gray-900 mt-1">{pushDebug.response?.message || pushDebug.error || '-'}</p>
                      </div>
                    </div>

                    {debugSummary && (
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                        <div className="rounded-lg border border-gray-200 p-3">
                          <p className="text-xs text-gray-500">{copy.requested}</p>
                          <p className="text-sm font-semibold text-gray-900 mt-1">{debugSummary.requestedRecipients}</p>
                        </div>
                        <div className="rounded-lg border border-gray-200 p-3">
                          <p className="text-xs text-gray-500">{copy.attempted}</p>
                          <p className="text-sm font-semibold text-gray-900 mt-1">{debugSummary.attemptedRecipients}</p>
                        </div>
                        <div className="rounded-lg border border-gray-200 p-3">
                          <p className="text-xs text-gray-500">{copy.sent}</p>
                          <p className="text-sm font-semibold text-emerald-700 mt-1">{debugSummary.sentRecipients}</p>
                        </div>
                        <div className="rounded-lg border border-gray-200 p-3">
                          <p className="text-xs text-gray-500">{copy.skipped}</p>
                          <p className="text-sm font-semibold text-amber-700 mt-1">{debugSummary.skippedRecipients}</p>
                        </div>
                        <div className="rounded-lg border border-gray-200 p-3">
                          <p className="text-xs text-gray-500">{copy.failed}</p>
                          <p className="text-sm font-semibold text-red-700 mt-1">{debugSummary.failedRecipients}</p>
                        </div>
                      </div>
                    )}

                    {debugSummary && Object.keys(debugSummary.skippedReasons || {}).length > 0 && (
                      <div className="rounded-lg border border-gray-200 p-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3">{copy.skippedReasons}</h4>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(debugSummary.skippedReasons).map(([reason, count]) => (
                            <span key={reason} className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 border border-amber-200">
                              {reason}: {count}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <div className="rounded-lg border border-gray-200 p-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3">{copy.requestPayload}</h4>
                        <pre className="text-xs bg-slate-950 text-slate-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(pushDebug.requestPayload, null, 2)}</pre>
                      </div>
                      <div className="rounded-lg border border-gray-200 p-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3">{copy.serverResponse}</h4>
                        <pre className="text-xs bg-slate-950 text-slate-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(pushDebug.response || { error: pushDebug.error }, null, 2)}</pre>
                      </div>
                    </div>

                    {debugSummary?.recipientResults?.length ? (
                      <div className="rounded-lg border border-gray-200 overflow-hidden">
                        <div className="px-4 py-3 border-b bg-gray-50">
                          <h4 className="text-sm font-semibold text-gray-900">{copy.recipientResults}</h4>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-white">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{copy.user}</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{copy.success}</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{copy.reason}</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{copy.devices}</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{copy.tokens}</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{copy.invalid}</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{copy.expo}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                              {debugSummary.recipientResults.map((item) => (
                                <tr key={`${item.platformUserId}-${item.reason || 'ok'}`}>
                                  <td className="px-4 py-2 text-xs text-gray-700">{item.platformUserId}</td>
                                  <td className="px-4 py-2 text-xs text-gray-700">{item.success ? 'yes' : 'no'}</td>
                                  <td className="px-4 py-2 text-xs text-gray-700">{item.reason || item.error || '-'}</td>
                                  <td className="px-4 py-2 text-xs text-gray-700">{item.deviceCount}</td>
                                  <td className="px-4 py-2 text-xs text-gray-700">{item.tokenCount}</td>
                                  <td className="px-4 py-2 text-xs text-gray-700">{item.invalidTokenCount}</td>
                                  <td className="px-4 py-2 text-xs text-gray-700">{item.expoStatuses.join(', ') || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}
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
