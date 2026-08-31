import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Clock3,
  Globe,
  Lock,
  Mail,
  MoonStar,
  Phone,
  RefreshCw,
  Save,
  Shield,
  SlidersHorizontal,
  Sparkles,
  SunMedium,
  Users
} from 'lucide-react';
import { tenantApiAdapter } from '../lib/tenantApiAdapter';
import { useTenantAuth, isElevatedDashboardRoleKey } from '../contexts/TenantAuthContext';
import DashboardPreferencesSection from './settings/DashboardPreferencesSection';
import {
  buildWeeklyHoursDisplay,
  getTenantBusinessHours,
  getTenantSchedulerConfig,
  normalizeTimeInput,
  type WorkingHoursDayKey,
  type WorkingHoursDayState
} from '../lib/tenantWorkingHours';

type SettingsWorkspaceProps = {
  lang: 'ar' | 'en';
  darkMode?: boolean;
};

type BookingSettingsForm = {
  autoApproveBookings: boolean;
  bufferTime: number;
  maxAdvanceBookingDays: number;
  cancellationHours: number;
  cancellationPolicy: string;
  slotInterval: number;
  defaultBufferBefore: number;
  defaultBufferAfter: number;
  allowAnyStaff: boolean;
  maxBookingsPerCustomerPerDay: number | null;
  allowWalkInBooking: boolean;
  minimumAdvanceBookingMinutes: number;
};

type NotificationSettingsForm = {
  enableEmailNotifications: boolean;
  enableSmsNotifications: boolean;
  enableWhatsAppNotifications: boolean;
  enableVoiceAlerts: boolean;
  remindRemainderToCollect: boolean;
  appointmentGracePeriodMinutes: number;
  autoMarkNoShowAfterGracePeriod: boolean;
  customerReminderEnabled: boolean;
  customerReminderMinutesBefore: number;
};

type PaymentSettingsForm = {
  acceptCash: boolean;
  acceptCard: boolean;
  acceptWallet: boolean;
  allowServicePayAtCenter: boolean;
  allowServiceFullOnline: boolean;
  allowServiceDeposit: boolean;
  serviceDepositMode: 'fixed' | 'percentage';
  serviceDepositFixedAmount: number;
  serviceDepositPercentage: number;
  allowProductOnline: boolean;
  allowProductPayOnPickup: boolean;
  allowProductCashOnDelivery: boolean;
  defaultDeliveryFee: number;
  payoutBankAccount: string;
};

type LocalizationSettingsForm = {
  defaultLanguage: 'ar' | 'en';
  supportedLanguages: Array<'ar' | 'en'>;
  timezone: string;
  currency: string;
};

type BusinessForm = {
  name_en: string;
  name_ar: string;
  businessType: string;
  email: string;
  phone: string;
  mobile: string;
  website: string;
  whatsapp: string;
  buildingNumber: string;
  street: string;
  district: string;
  city: string;
  country: string;
  googleMapLink: string;
  postalCode: string;
  description: string;
  descriptionAr: string;
  facebookUrl: string;
  instagramUrl: string;
  twitterUrl: string;
  linkedinUrl: string;
  tiktokUrl: string;
  youtubeUrl: string;
  snapchatUrl: string;
  pinterestUrl: string;
};

type DashboardAccount = {
  id: string;
  displayName: string;
  email: string;
  roleKey: string;
  permissions: Record<string, boolean>;
  isActive: boolean;
  passwordResetRequired?: boolean;
  lastLoginAt?: string | null;
};

type AccountForm = {
  displayName: string;
  email: string;
  roleKey: string;
  permissions: Record<string, boolean>;
  isActive: boolean;
};

type SettingsTabKey =
  | 'overview'
  | 'business'
  | 'working-hours'
  | 'booking'
  | 'notifications'
  | 'payment'
  | 'localization'
  | 'accounts'
  | 'security';

const SETTINGS_TABS: Array<{
  key: SettingsTabKey;
  labelEn: string;
  labelAr: string;
}> = [
  { key: 'overview', labelEn: 'Overview', labelAr: 'نظرة عامة' },
  { key: 'business', labelEn: 'Business', labelAr: 'الأعمال' },
  { key: 'working-hours', labelEn: 'Working Hours', labelAr: 'ساعات العمل' },
  { key: 'booking', labelEn: 'Booking', labelAr: 'الحجز' },
  { key: 'notifications', labelEn: 'Notifications', labelAr: 'الإشعارات' },
  { key: 'payment', labelEn: 'Payment', labelAr: 'السداد' },
  { key: 'localization', labelEn: 'Localization', labelAr: 'اللغة والمنطقة' },
  { key: 'accounts', labelEn: 'Team Access', labelAr: 'حسابات الفريق' },
  { key: 'security', labelEn: 'Security', labelAr: 'الأمان' }
];

const BUSINESS_HOUR_KEYS: Array<{ key: WorkingHoursDayKey; labelEn: string; labelAr: string }> = [
  { key: 'sunday', labelEn: 'Sunday', labelAr: 'الأحد' },
  { key: 'monday', labelEn: 'Monday', labelAr: 'الاثنين' },
  { key: 'tuesday', labelEn: 'Tuesday', labelAr: 'الثلاثاء' },
  { key: 'wednesday', labelEn: 'Wednesday', labelAr: 'الأربعاء' },
  { key: 'thursday', labelEn: 'Thursday', labelAr: 'الخميس' },
  { key: 'friday', labelEn: 'Friday', labelAr: 'الجمعة' },
  { key: 'saturday', labelEn: 'Saturday', labelAr: 'السبت' }
];

const ROLE_PRESETS: Array<{ key: string; labelEn: string; labelAr: string }> = [
  { key: 'manager', labelEn: 'General Manager', labelAr: 'مدير عام' },
  { key: 'accountant', labelEn: 'Accountant', labelAr: 'محاسب' },
  { key: 'receptionist', labelEn: 'Receptionist', labelAr: 'استقبال' },
  { key: 'marketing', labelEn: 'Marketing', labelAr: 'تسويق' },
  { key: 'service_provider', labelEn: 'Service Provider', labelAr: 'مقدم خدمة' }
];

const PERMISSION_ITEMS: Array<{ key: string; labelEn: string; labelAr: string }> = [
  { key: 'view_dashboard', labelEn: 'Access dashboard', labelAr: 'الوصول للوحة التحكم' },
  { key: 'view_appointments', labelEn: 'Appointments', labelAr: 'المواعيد' },
  { key: 'view_schedules', labelEn: 'Shifts & schedules', labelAr: 'الشيفتات والجداول' },
  { key: 'view_employees', labelEn: 'Employees', labelAr: 'الموظفون' },
  { key: 'view_customers', labelEn: 'Customers', labelAr: 'العملاء' },
  { key: 'view_services', labelEn: 'Services', labelAr: 'الخدمات' },
  { key: 'view_products', labelEn: 'Products', labelAr: 'المنتجات' },
  { key: 'view_orders', labelEn: 'Orders', labelAr: 'الطلبات' },
  { key: 'view_financial', labelEn: 'Financial', labelAr: 'المالية' },
  { key: 'view_bills', labelEn: 'Bills', labelAr: 'الفواتير' },
  { key: 'view_pos', labelEn: 'POS', labelAr: 'نقطة البيع' },
  { key: 'view_messages', labelEn: 'Messages', labelAr: 'الرسائل' },
  { key: 'view_reviews', labelEn: 'Reviews', labelAr: 'التقييمات' },
  { key: 'view_hot_deals', labelEn: 'Hot deals', labelAr: 'العروض الساخنة' },
  { key: 'view_notifications', labelEn: 'Notifications', labelAr: 'الإشعارات' },
  { key: 'view_payroll', labelEn: 'Payroll', labelAr: 'الرواتب' },
  { key: 'view_subscription', labelEn: 'Subscription', labelAr: 'الاشتراك' },
  { key: 'view_settings', labelEn: 'Settings', labelAr: 'الإعدادات' },
  { key: 'manage_accounts', labelEn: 'Manage accounts', labelAr: 'إدارة الحسابات' }
];

const EMPTY_ACCOUNT_FORM: AccountForm = {
  displayName: '',
  email: '',
  roleKey: 'manager',
  permissions: PERMISSION_ITEMS.reduce((acc, item) => {
    acc[item.key] = item.key === 'view_dashboard';
    return acc;
  }, {} as Record<string, boolean>),
  isActive: true
};

function createBusinessForm(business: Record<string, any> | null | undefined): BusinessForm {
  return {
    name_en: business?.name_en || business?.nameEn || business?.name || '',
    name_ar: business?.name_ar || business?.nameAr || business?.name || '',
    businessType: business?.businessType || '',
    email: business?.email || '',
    phone: business?.phone || '',
    mobile: business?.mobile || '',
    website: business?.website || '',
    whatsapp: business?.whatsapp || '',
    buildingNumber: business?.buildingNumber || '',
    street: business?.street || '',
    district: business?.district || '',
    city: business?.city || '',
    country: business?.country || '',
    googleMapLink: business?.googleMapLink || '',
    postalCode: business?.postalCode || '',
    description: business?.description || '',
    descriptionAr: business?.descriptionAr || '',
    facebookUrl: business?.facebookUrl || '',
    instagramUrl: business?.instagramUrl || '',
    twitterUrl: business?.twitterUrl || '',
    linkedinUrl: business?.linkedinUrl || '',
    tiktokUrl: business?.tiktokUrl || '',
    youtubeUrl: business?.youtubeUrl || '',
    snapchatUrl: business?.snapchatUrl || '',
    pinterestUrl: business?.pinterestUrl || ''
  };
}

function createBookingForm(settings: Record<string, any> | null | undefined): BookingSettingsForm {
  const source = settings?.bookingSettings || settings || {};
  return {
    autoApproveBookings: source.autoApproveBookings !== undefined ? Boolean(source.autoApproveBookings) : true,
    bufferTime: Number(source.bufferTime ?? 15),
    maxAdvanceBookingDays: Number(source.maxAdvanceBookingDays ?? 30),
    cancellationHours: Number(source.cancellationHours ?? 24),
    cancellationPolicy: source.cancellationPolicy || '',
    slotInterval: [5, 10, 15].includes(Number(source.slotInterval)) ? Number(source.slotInterval) : 15,
    defaultBufferBefore: Number(source.defaultBufferBefore ?? 5),
    defaultBufferAfter: Number(source.defaultBufferAfter ?? 5),
    allowAnyStaff: source.allowAnyStaff !== undefined ? Boolean(source.allowAnyStaff) : true,
    maxBookingsPerCustomerPerDay: source.maxBookingsPerCustomerPerDay ?? null,
    allowWalkInBooking: source.allowWalkInBooking !== undefined ? Boolean(source.allowWalkInBooking) : true,
    minimumAdvanceBookingMinutes: Number(source.minimumAdvanceBookingMinutes ?? 15)
  };
}

function createNotificationForm(settings: Record<string, any> | null | undefined): NotificationSettingsForm {
  const source = settings?.notificationSettings || settings || {};
  return {
    enableEmailNotifications: source.enableEmailNotifications !== undefined ? Boolean(source.enableEmailNotifications) : true,
    enableSmsNotifications: source.enableSmsNotifications !== undefined ? Boolean(source.enableSmsNotifications) : false,
    enableWhatsAppNotifications: source.enableWhatsAppNotifications !== undefined ? Boolean(source.enableWhatsAppNotifications) : false,
    enableVoiceAlerts: source.enableVoiceAlerts !== undefined ? Boolean(source.enableVoiceAlerts) : true,
    remindRemainderToCollect: Boolean(source.remindRemainderToCollect),
    appointmentGracePeriodMinutes: Number(source.appointmentGracePeriodMinutes ?? 15),
    autoMarkNoShowAfterGracePeriod: Boolean(source.autoMarkNoShowAfterGracePeriod),
    customerReminderEnabled: Boolean(source.customerReminderEnabled),
    customerReminderMinutesBefore: Number(source.customerReminderMinutesBefore ?? 60)
  };
}

function createPaymentForm(settings: Record<string, any> | null | undefined): PaymentSettingsForm {
  const payment = settings?.paymentSettings || settings || {};
  return {
    acceptCash: payment.acceptCash !== undefined ? Boolean(payment.acceptCash) : true,
    acceptCard: payment.acceptCard !== undefined ? Boolean(payment.acceptCard) : true,
    acceptWallet: payment.acceptWallet !== undefined ? Boolean(payment.acceptWallet) : true,
    allowServicePayAtCenter: payment.allowServicePayAtCenter !== undefined ? Boolean(payment.allowServicePayAtCenter) : true,
    allowServiceFullOnline: payment.allowServiceFullOnline !== undefined ? Boolean(payment.allowServiceFullOnline) : true,
    allowServiceDeposit: payment.allowServiceDeposit !== undefined ? Boolean(payment.allowServiceDeposit) : true,
    serviceDepositMode: payment.serviceDepositMode === 'percentage' ? 'percentage' : 'fixed',
    serviceDepositFixedAmount: Number(payment.serviceDepositFixedAmount ?? 50),
    serviceDepositPercentage: Number(payment.serviceDepositPercentage ?? 50),
    allowProductOnline: payment.allowProductOnline !== undefined ? Boolean(payment.allowProductOnline) : true,
    allowProductPayOnPickup: payment.allowProductPayOnPickup !== undefined ? Boolean(payment.allowProductPayOnPickup) : true,
    allowProductCashOnDelivery: payment.allowProductCashOnDelivery !== undefined ? Boolean(payment.allowProductCashOnDelivery) : true,
    defaultDeliveryFee: Number(payment.defaultDeliveryFee ?? 25),
    payoutBankAccount: typeof payment.payoutBankAccount === 'string' ? payment.payoutBankAccount : JSON.stringify(payment.payoutBankAccount || {}, null, 2)
  };
}

function createLocalizationForm(settings: Record<string, any> | null | undefined): LocalizationSettingsForm {
  const source = settings || {};
  return {
    defaultLanguage: source.defaultLanguage === 'en' ? 'en' : 'ar',
    supportedLanguages: Array.isArray(source.supportedLanguages)
      ? source.supportedLanguages.filter((item: any) => item === 'ar' || item === 'en')
      : ['ar', 'en'],
    timezone: source.timezone || 'Asia/Riyadh',
    currency: source.currency || 'SAR'
  };
}

function createWorkingHoursForm(settings: Record<string, any> | null | undefined, tenant: Record<string, any> | null | undefined) {
  return getTenantBusinessHours(settings, tenant);
}

function sectionBorder(darkMode: boolean) {
  return darkMode ? 'border-zinc-800 bg-zinc-900 text-zinc-100' : 'border-neutral-100 bg-white text-neutral-800';
}

function SectionCard({
  title,
  description,
  icon,
  children,
  actions,
  darkMode
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  darkMode: boolean;
}) {
  return (
    <section className={`rounded-2xl border p-5 md:p-6 shadow-sm ${sectionBorder(darkMode)}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-brand-500">
            {icon}
            <span>{title}</span>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-neutral-400">{description}</p>
        </div>
        {actions}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function SettingsWorkspace({ lang, darkMode = false }: SettingsWorkspaceProps) {
  const isRtl = lang === 'ar';
  const { tenant, tenantSettings, sessionType, permissions, refreshUser, user } = useTenantAuth();
  const canManageAccounts = sessionType === 'tenant_owner' || isElevatedDashboardRoleKey(permissions?.roleKey);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTabKey>('overview');

  const [businessForm, setBusinessForm] = useState<BusinessForm>(() => createBusinessForm(tenant));
  const [workingHoursForm, setWorkingHoursForm] = useState<Record<WorkingHoursDayKey, WorkingHoursDayState>>(() => createWorkingHoursForm(tenantSettings, tenant));
  const [bookingForm, setBookingForm] = useState<BookingSettingsForm>(() => createBookingForm(tenantSettings));
  const [notificationForm, setNotificationForm] = useState<NotificationSettingsForm>(() => createNotificationForm(tenantSettings));
  const [paymentForm, setPaymentForm] = useState<PaymentSettingsForm>(() => createPaymentForm(tenantSettings));
  const [localizationForm, setLocalizationForm] = useState<LocalizationSettingsForm>(() => createLocalizationForm(tenantSettings));
  const [accounts, setAccounts] = useState<DashboardAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountForm, setAccountForm] = useState<AccountForm>(EMPTY_ACCOUNT_FORM);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  const schedulerConfig = useMemo(() => getTenantSchedulerConfig(tenantSettings, tenant), [tenantSettings, tenant]);
  const weekHoursSummary = useMemo(() => buildWeeklyHoursDisplay(tenantSettings, tenant), [tenantSettings, tenant]);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await tenantApiAdapter.get('/tenant/settings');
      const payload = response?.data || response || {};
      const business = payload?.business || {};
      const settings = payload?.settings || {};

      setBusinessForm(createBusinessForm(business));
      setWorkingHoursForm(createWorkingHoursForm(settings, business));
      setBookingForm(createBookingForm(settings));
      setNotificationForm(createNotificationForm(settings));
      setPaymentForm(createPaymentForm(settings));
      setLocalizationForm(createLocalizationForm(settings));

      if (canManageAccounts) {
        setAccountsLoading(true);
        try {
          const accountsResponse = await tenantApiAdapter.get('/tenant/dashboard-accounts');
          const nextAccounts = Array.isArray(accountsResponse?.accounts)
            ? accountsResponse.accounts
            : Array.isArray(accountsResponse?.data?.accounts)
              ? accountsResponse.data.accounts
              : [];
          setAccounts(nextAccounts);
          setAccountsError(null);
        } catch (accountLoadError: any) {
          setAccounts([]);
          setAccountsError(accountLoadError?.message || (isRtl ? 'تعذر تحميل حسابات الفريق.' : 'Failed to load dashboard accounts.'));
        } finally {
          setAccountsLoading(false);
        }
      }
    } catch (loadError: any) {
      setError(loadError?.message || (isRtl ? 'تعذر تحميل الإعدادات.' : 'Failed to load settings.'));
    } finally {
      setLoading(false);
    }
  }, [canManageAccounts, isRtl, tenant, tenantSettings]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const markSaved = async (messageEn: string, messageAr: string) => {
    setSuccess(isRtl ? messageAr : messageEn);
    window.setTimeout(() => setSuccess(null), 3500);
    await refreshUser();
  };

  const saveBusiness = async () => {
    try {
      setSavingSection('business');
      setError(null);
      await tenantApiAdapter.put('/tenant/settings/business', businessForm);
      await markSaved('Business settings saved successfully.', 'تم حفظ الإعدادات العامة بنجاح.');
    } catch (saveError: any) {
      setError(saveError?.message || (isRtl ? 'فشل حفظ الإعدادات العامة.' : 'Failed to save business settings.'));
    } finally {
      setSavingSection(null);
    }
  };

  const saveWorkingHours = async () => {
    try {
      setSavingSection('working-hours');
      setError(null);
      const workingHours = Object.fromEntries(
        Object.entries(workingHoursForm).map(([key, day]) => [
          key,
          {
            isOpen: day.isOpen,
            open: normalizeTimeInput(day.open),
            close: normalizeTimeInput(day.close),
            extendedHoursEnabled: Boolean(day.extendedHoursEnabled),
            extendedClose: normalizeTimeInput(day.extendedClose)
          }
        ])
      );
      await tenantApiAdapter.put('/tenant/settings/working-hours', { workingHours });
      await markSaved('Working hours saved successfully.', 'تم حفظ ساعات العمل بنجاح.');
    } catch (saveError: any) {
      setError(saveError?.message || (isRtl ? 'فشل حفظ ساعات العمل.' : 'Failed to save working hours.'));
    } finally {
      setSavingSection(null);
    }
  };

  const saveBooking = async () => {
    try {
      setSavingSection('booking');
      setError(null);
      await tenantApiAdapter.put('/tenant/settings/booking', {
        ...bookingForm,
        maxBookingsPerCustomerPerDay: bookingForm.maxBookingsPerCustomerPerDay === null ? null : Number(bookingForm.maxBookingsPerCustomerPerDay)
      });
      await markSaved('Booking settings saved successfully.', 'تم حفظ إعدادات الحجز بنجاح.');
    } catch (saveError: any) {
      setError(saveError?.message || (isRtl ? 'فشل حفظ إعدادات الحجز.' : 'Failed to save booking settings.'));
    } finally {
      setSavingSection(null);
    }
  };

  const saveNotifications = async () => {
    try {
      setSavingSection('notifications');
      setError(null);
      await tenantApiAdapter.put('/tenant/settings/notifications', notificationForm);
      await markSaved('Notification settings saved successfully.', 'تم حفظ إعدادات الإشعارات بنجاح.');
    } catch (saveError: any) {
      setError(saveError?.message || (isRtl ? 'فشل حفظ إعدادات الإشعارات.' : 'Failed to save notification settings.'));
    } finally {
      setSavingSection(null);
    }
  };

  const savePayment = async () => {
    try {
      setSavingSection('payment');
      setError(null);
      const payoutBankAccount = paymentForm.payoutBankAccount.trim()
        ? (() => {
            try {
              return JSON.parse(paymentForm.payoutBankAccount);
            } catch {
              return paymentForm.payoutBankAccount;
            }
          })()
        : null;

      await tenantApiAdapter.put('/tenant/settings/payment', {
        paymentSettings: {
          acceptCash: paymentForm.acceptCash,
          acceptCard: paymentForm.acceptCard,
          acceptWallet: paymentForm.acceptWallet,
          allowServicePayAtCenter: paymentForm.allowServicePayAtCenter,
          allowServiceFullOnline: paymentForm.allowServiceFullOnline,
          allowServiceDeposit: paymentForm.allowServiceDeposit,
          serviceDepositMode: paymentForm.serviceDepositMode,
          serviceDepositFixedAmount: paymentForm.serviceDepositFixedAmount,
          serviceDepositPercentage: paymentForm.serviceDepositPercentage,
          allowProductOnline: paymentForm.allowProductOnline,
          allowProductPayOnPickup: paymentForm.allowProductPayOnPickup,
          allowProductCashOnDelivery: paymentForm.allowProductCashOnDelivery,
          defaultDeliveryFee: paymentForm.defaultDeliveryFee
        },
        acceptCash: paymentForm.acceptCash,
        acceptCard: paymentForm.acceptCard,
        acceptWallet: paymentForm.acceptWallet,
        payoutBankAccount
      });
      await markSaved('Payment settings saved successfully.', 'تم حفظ إعدادات السداد بنجاح.');
    } catch (saveError: any) {
      setError(saveError?.message || (isRtl ? 'فشل حفظ إعدادات الدفع.' : 'Failed to save payment settings.'));
    } finally {
      setSavingSection(null);
    }
  };

  const saveLocalization = async () => {
    try {
      setSavingSection('localization');
      setError(null);
      await tenantApiAdapter.put('/tenant/settings/localization', localizationForm);
      await markSaved('Localization settings saved successfully.', 'تم حفظ إعدادات اللغة والمنطقة الزمنية.');
    } catch (saveError: any) {
      setError(saveError?.message || (isRtl ? 'فشل حفظ إعدادات اللغة.' : 'Failed to save localization settings.'));
    } finally {
      setSavingSection(null);
    }
  };

  const resetAccountForm = () => {
    setEditingAccountId(null);
    setAccountForm(EMPTY_ACCOUNT_FORM);
    setGeneratedPassword(null);
  };

  const loadAccounts = useCallback(async () => {
    if (!canManageAccounts) {
      return;
    }

    try {
      setAccountsLoading(true);
      const response = await tenantApiAdapter.get('/tenant/dashboard-accounts');
      const nextAccounts = Array.isArray(response?.accounts)
        ? response.accounts
        : Array.isArray(response?.data?.accounts)
          ? response.data.accounts
          : [];
      setAccounts(nextAccounts);
      setAccountsError(null);
    } catch (accountLoadError: any) {
      setAccounts([]);
      setAccountsError(accountLoadError?.message || (isRtl ? 'تعذر تحميل حسابات الفريق.' : 'Failed to load dashboard accounts.'));
    } finally {
      setAccountsLoading(false);
    }
  }, [canManageAccounts, isRtl]);

  useEffect(() => {
    if (canManageAccounts) {
      void loadAccounts();
    }
  }, [canManageAccounts, loadAccounts]);

  const applyRolePreset = (roleKey: string) => {
    const selectedPreset = roleKey || 'manager';
    setAccountForm((current) => ({
      ...current,
      roleKey: selectedPreset,
      permissions: PERMISSION_ITEMS.reduce((acc, item) => {
        acc[item.key] =
          item.key === 'view_dashboard' ||
          selectedPreset === 'manager' ||
          selectedPreset === 'accountant' && ['view_financial', 'view_bills', 'view_subscription'].includes(item.key) ||
          selectedPreset === 'receptionist' && ['view_appointments', 'view_schedules', 'view_customers', 'view_messages'].includes(item.key) ||
          selectedPreset === 'marketing' && ['view_hot_deals', 'view_notifications', 'view_reviews'].includes(item.key) ||
          selectedPreset === 'service_provider' && ['view_appointments', 'view_schedules', 'view_customers'].includes(item.key)
            ? true
            : current.permissions[item.key] === true;
        return acc;
      }, {} as Record<string, boolean>)
    }));
  };

  const handleSaveAccount = async () => {
    try {
      setSavingSection('accounts');
      setError(null);
      setGeneratedPassword(null);

      const payload = {
        displayName: accountForm.displayName.trim(),
        email: accountForm.email.trim(),
        roleKey: accountForm.roleKey,
        permissions: accountForm.permissions,
        isActive: accountForm.isActive
      };

      const response = editingAccountId
        ? await tenantApiAdapter.put(`/tenant/dashboard-accounts/${editingAccountId}`, payload)
        : await tenantApiAdapter.post('/tenant/dashboard-accounts', payload);

      if (!response?.success) {
        throw new Error(response?.message || (isRtl ? 'تعذر حفظ حساب الفريق.' : 'Failed to save dashboard account.'));
      }

      if (response?.temporaryPassword) {
        setGeneratedPassword(response.temporaryPassword);
      }
      await loadAccounts();
      resetAccountForm();
      await markSaved('Dashboard account saved successfully.', 'تم حفظ حساب الفريق بنجاح.');
    } catch (accountSaveError: any) {
      setError(accountSaveError?.message || (isRtl ? 'تعذر حفظ حساب الفريق.' : 'Failed to save dashboard account.'));
    } finally {
      setSavingSection(null);
    }
  };

  const handleEditAccount = (account: DashboardAccount) => {
    setEditingAccountId(account.id);
    setGeneratedPassword(null);
    setAccountForm({
      displayName: account.displayName || '',
      email: account.email || '',
      roleKey: account.roleKey || 'manager',
      permissions: {
        ...EMPTY_ACCOUNT_FORM.permissions,
        ...(account.permissions || {})
      },
      isActive: account.isActive
    });
  };

  const handleResetAccountPassword = async (accountId: string) => {
    try {
      setSavingSection('accounts');
      setError(null);
      const response = await tenantApiAdapter.patch(`/tenant/dashboard-accounts/${accountId}/reset-password`, {});
      if (response?.temporaryPassword) {
        setGeneratedPassword(response.temporaryPassword);
      }
      await loadAccounts();
      await markSaved('Password reset successfully.', 'تمت إعادة تعيين كلمة المرور بنجاح.');
    } catch (accountSaveError: any) {
      setError(accountSaveError?.message || (isRtl ? 'تعذر إعادة تعيين كلمة المرور.' : 'Failed to reset password.'));
    } finally {
      setSavingSection(null);
    }
  };

  const handleSendInvite = async (accountId: string) => {
    try {
      setSavingSection('accounts');
      setError(null);
      const response = await tenantApiAdapter.post(`/tenant/dashboard-accounts/${accountId}/send-invite`, {});
      if (response?.temporaryPassword) {
        setGeneratedPassword(response.temporaryPassword);
      }
      await loadAccounts();
      await markSaved('Invitation sent successfully.', 'تم إرسال الدعوة بنجاح.');
    } catch (accountSaveError: any) {
      setError(accountSaveError?.message || (isRtl ? 'تعذر إرسال الدعوة.' : 'Failed to send invitation.'));
    } finally {
      setSavingSection(null);
    }
  };

  const handleToggleAccountActive = async (account: DashboardAccount) => {
    try {
      setSavingSection('accounts');
      setError(null);
      await tenantApiAdapter.put(`/tenant/dashboard-accounts/${account.id}`, {
        isActive: !account.isActive
      });
      await loadAccounts();
      await markSaved('Account status updated.', 'تم تحديث حالة الحساب.');
    } catch (accountSaveError: any) {
      setError(accountSaveError?.message || (isRtl ? 'تعذر تحديث حالة الحساب.' : 'Failed to update account status.'));
    } finally {
      setSavingSection(null);
    }
  };

  const handleChangePassword = async (currentPassword: string, newPassword: string, confirmPassword: string) => {
    const response = await tenantApiAdapter.post('/auth/tenant/change-password', {
      currentPassword,
      newPassword,
      confirmPassword
    });

    if (response?.accessToken) {
      tenantApiAdapter.setTokens(response.accessToken, response.refreshToken || null);
    }
    await refreshUser();
    return response;
  };

  if (loading) {
    return (
      <div className={`rounded-3xl border p-8 ${sectionBorder(darkMode)}`}>
        <div className="flex items-center gap-3">
          <RefreshCw size={18} className="animate-spin text-brand-500" />
          <span className="text-sm text-neutral-400">{isRtl ? 'جارٍ تحميل إعدادات المستأجر...' : 'Loading tenant settings...'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={`rounded-2xl border p-5 md:p-6 shadow-sm ${sectionBorder(darkMode)}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-brand-500">
              <SlidersHorizontal size={14} />
              <span>{isRtl ? 'الإعدادات الكانونية للمستأجر' : 'Canonical tenant settings'}</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black">
              {isRtl ? 'إعدادات العمل والهويات والجدولة' : 'Business, hours, booking, and account controls'}
            </h2>
            <p className="max-w-4xl text-sm leading-6 text-neutral-400">
              {isRtl
                ? 'هذا هو المصدر الكانوني لإعدادات المنصة. أي تغيير هنا ينعكس على الجدول، أوقات العمل، الحجز، السداد، اللغة، وحسابات الإدارة.'
                : 'This is the canonical source of tenant configuration. Changes here flow into scheduling, booking, payment, localization, and dashboard access.'}
            </p>
          </div>
          <div className="rounded-2xl border border-brand-500/20 bg-brand-500/10 px-4 py-3 text-sm font-bold text-brand-700">
            {tenant?.name || tenant?.businessName || user?.businessName || (isRtl ? 'المستأجر الحالي' : 'Current tenant')}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-600">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">
          {success}
        </div>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-white/80 p-2 shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/60">
        <div className="flex flex-wrap gap-2">
          {SETTINGS_TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                  active
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                {isRtl ? tab.labelAr : tab.labelEn}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'overview' && (
        <DashboardPreferencesSection lang={lang} darkMode={darkMode} />
      )}

      {activeTab === 'business' && (
      <SectionCard
        title={isRtl ? 'معلومات الأعمال' : 'Business information'}
        description={isRtl
          ? 'الاسم، العنوان، التواصل، والحضور العام الذي يستخدم في الترويسة وصفحة الأعمال.'
          : 'Name, address, contacts, and public business identity used by the shell and public page.'}
        icon={<Building2 size={14} />}
        darkMode={darkMode}
        actions={(
          <button
            type="button"
            onClick={saveBusiness}
            disabled={savingSection === 'business'}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-neutral-500"
          >
            {savingSection === 'business' ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            <span>{isRtl ? 'حفظ' : 'Save'}</span>
          </button>
        )}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[
            ['name_en', isRtl ? 'الاسم بالإنجليزية' : 'Name (English)'],
            ['name_ar', isRtl ? 'الاسم بالعربية' : 'Name (Arabic)'],
            ['businessType', isRtl ? 'نوع النشاط' : 'Business type'],
            ['email', isRtl ? 'البريد الإلكتروني' : 'Email'],
            ['phone', isRtl ? 'الهاتف' : 'Phone'],
            ['mobile', isRtl ? 'الجوال' : 'Mobile'],
            ['website', isRtl ? 'الموقع الإلكتروني' : 'Website'],
            ['whatsapp', isRtl ? 'واتساب' : 'WhatsApp'],
            ['buildingNumber', isRtl ? 'رقم المبنى' : 'Building number'],
            ['street', isRtl ? 'الشارع' : 'Street'],
            ['district', isRtl ? 'الحي' : 'District'],
            ['city', isRtl ? 'المدينة' : 'City'],
            ['country', isRtl ? 'الدولة' : 'Country'],
            ['googleMapLink', isRtl ? 'رابط الخريطة' : 'Google Maps link'],
            ['postalCode', isRtl ? 'الرمز البريدي' : 'Postal code'],
            ['facebookUrl', 'Facebook'],
            ['instagramUrl', 'Instagram'],
            ['twitterUrl', 'X / Twitter'],
            ['linkedinUrl', 'LinkedIn'],
            ['tiktokUrl', 'TikTok'],
            ['youtubeUrl', 'YouTube'],
            ['snapchatUrl', 'Snapchat'],
            ['pinterestUrl', 'Pinterest']
          ].map(([field, label]) => (
            <label key={String(field)} className="space-y-2">
              <span className="block text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">{label}</span>
              <input
                type="text"
                value={(businessForm as any)[field]}
                onChange={(event) => setBusinessForm((current) => ({ ...current, [field as keyof BusinessForm]: event.target.value }))}
                className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-brand-500 ${darkMode ? 'border-zinc-800 bg-zinc-950 text-zinc-100' : 'border-neutral-200 bg-white text-slate-800'}`}
              />
            </label>
          ))}
          <label className="space-y-2 md:col-span-2">
            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">{isRtl ? 'الوصف' : 'Description'}</span>
            <textarea
              value={businessForm.description}
              onChange={(event) => setBusinessForm((current) => ({ ...current, description: event.target.value }))}
              rows={3}
              className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-brand-500 ${darkMode ? 'border-zinc-800 bg-zinc-950 text-zinc-100' : 'border-neutral-200 bg-white text-slate-800'}`}
            />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">{isRtl ? 'الوصف بالعربية' : 'Description (Arabic)'}</span>
            <textarea
              value={businessForm.descriptionAr}
              onChange={(event) => setBusinessForm((current) => ({ ...current, descriptionAr: event.target.value }))}
              rows={3}
              className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-brand-500 ${darkMode ? 'border-zinc-800 bg-zinc-950 text-zinc-100' : 'border-neutral-200 bg-white text-slate-800'}`}
            />
          </label>
        </div>
      </SectionCard>
      )}

      {activeTab === 'working-hours' && (
      <SectionCard
        title={isRtl ? 'ساعات العمل الكانونية' : 'Canonical working hours'}
        description={isRtl
          ? 'هذه القيم تقود الجدول، الساعة الحالية، شبكات الساعات، وأي إنشاء موعد مستقبلي.'
          : 'These values drive scheduler bounds, current time indicators, slot generation, and appointment availability.'}
        icon={<Clock3 size={14} />}
        darkMode={darkMode}
        actions={(
          <button
            type="button"
            onClick={saveWorkingHours}
            disabled={savingSection === 'working-hours'}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-neutral-500"
          >
            {savingSection === 'working-hours' ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            <span>{isRtl ? 'حفظ' : 'Save'}</span>
          </button>
        )}
      >
        <div className="grid grid-cols-1 gap-3">
          {BUSINESS_HOUR_KEYS.map((day) => {
            const current = workingHoursForm[day.key];
            return (
              <div key={day.key} className={`grid grid-cols-1 gap-3 rounded-2xl border p-4 md:grid-cols-[220px_1fr] ${darkMode ? 'border-zinc-800 bg-zinc-950' : 'border-neutral-200 bg-neutral-50'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-black">{isRtl ? day.labelAr : day.labelEn}</div>
                    <div className="text-[11px] text-neutral-400">{current.isOpen ? (isRtl ? 'يوم عمل' : 'Working day') : (isRtl ? 'يوم إجازة' : 'Day off')}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWorkingHoursForm((prev) => ({
                      ...prev,
                      [day.key]: { ...prev[day.key], isOpen: !prev[day.key].isOpen }
                    }))}
                    className={`rounded-full px-3 py-1 text-[11px] font-bold ${current.isOpen ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-500/10 text-slate-500'}`}
                  >
                    {current.isOpen ? (isRtl ? 'مفتوح' : 'Open') : (isRtl ? 'مغلق' : 'Closed')}
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">{isRtl ? 'الفتح' : 'Open'}</span>
                    <input
                      type="time"
                      step={900}
                      value={current.open}
                      disabled={!current.isOpen}
                      onChange={(event) => setWorkingHoursForm((prev) => ({
                        ...prev,
                        [day.key]: { ...prev[day.key], open: normalizeTimeInput(event.target.value) }
                      }))}
                      className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${darkMode ? 'border-zinc-800 bg-zinc-950 text-zinc-100' : 'border-neutral-200 bg-white text-slate-800'} ${!current.isOpen ? 'opacity-50' : ''}`}
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">{isRtl ? 'الإغلاق' : 'Close'}</span>
                    <input
                      type="time"
                      step={900}
                      value={current.close}
                      disabled={!current.isOpen}
                      onChange={(event) => setWorkingHoursForm((prev) => ({
                        ...prev,
                        [day.key]: { ...prev[day.key], close: normalizeTimeInput(event.target.value) }
                      }))}
                      className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${darkMode ? 'border-zinc-800 bg-zinc-950 text-zinc-100' : 'border-neutral-200 bg-white text-slate-800'} ${!current.isOpen ? 'opacity-50' : ''}`}
                    />
                  </label>
                  <div className="md:col-span-2 grid gap-3 rounded-2xl border border-dashed border-slate-200/80 bg-white/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.16em] text-neutral-400">
                          {isRtl ? 'ساعات العمل الممتدة' : 'Extended working hours'}
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          {isRtl
                            ? 'فعّلها عندما يحتاج المركز إلى العمل حتى وقت متأخر في هذا اليوم.'
                            : 'Enable when the center should remain bookable beyond the normal close time for this day.'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setWorkingHoursForm((prev) => ({
                          ...prev,
                          [day.key]: {
                            ...prev[day.key],
                            extendedHoursEnabled: !prev[day.key].extendedHoursEnabled,
                            extendedClose: prev[day.key].extendedClose || prev[day.key].close
                          }
                        }))}
                        className={`rounded-full px-3 py-1 text-[11px] font-bold ${current.extendedHoursEnabled ? 'bg-amber-500/10 text-amber-700' : 'bg-slate-500/10 text-slate-500'}`}
                      >
                        {current.extendedHoursEnabled
                          ? (isRtl ? 'مفعلة' : 'Enabled')
                          : (isRtl ? 'معطلة' : 'Disabled')}
                      </button>
                    </div>
                    <label className="space-y-1.5">
                      <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">
                        {isRtl ? 'الإغلاق الممتد' : 'Extended close'}
                      </span>
                      <input
                        type="time"
                        step={900}
                        value={current.extendedClose || ''}
                        disabled={!current.isOpen || !current.extendedHoursEnabled}
                        onChange={(event) => setWorkingHoursForm((prev) => ({
                          ...prev,
                          [day.key]: { ...prev[day.key], extendedClose: normalizeTimeInput(event.target.value) }
                        }))}
                        className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${darkMode ? 'border-zinc-800 bg-zinc-950 text-zinc-100' : 'border-neutral-200 bg-white text-slate-800'} ${!current.isOpen || !current.extendedHoursEnabled ? 'opacity-50' : ''}`}
                      />
                    </label>
                    <p className="text-[11px] leading-5 text-neutral-400">
                      {isRtl
                        ? 'تُستخدم هذه القيمة كإغلاق فعلي للوحة الجدولة والبحث عن الإتاحة عندما تكون أطول من الإغلاق الطبيعي.'
                        : 'This value becomes the effective closing time for the scheduler and availability search when it is later than the normal close.'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
      )}

      {activeTab === 'booking' && (
      <SectionCard
        title={isRtl ? 'إعدادات الحجز' : 'Booking settings'}
        description={isRtl
          ? 'معدل الشريحة الزمنية، التراكم، الحجز التلقائي، وسياسة الحجز.'
          : 'Slot interval, buffers, approval mode, walk-in booking, and advance rules.'}
        icon={<Sparkles size={14} />}
        darkMode={darkMode}
        actions={(
          <button
            type="button"
            onClick={saveBooking}
            disabled={savingSection === 'booking'}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-neutral-500"
          >
            {savingSection === 'booking' ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            <span>{isRtl ? 'حفظ' : 'Save'}</span>
          </button>
        )}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">{isRtl ? 'معدل الشريحة' : 'Slot interval'}</span>
            <select
              value={bookingForm.slotInterval}
              onChange={(event) => setBookingForm((current) => ({ ...current, slotInterval: Number(event.target.value) }))}
              className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-brand-500 ${darkMode ? 'border-zinc-800 bg-zinc-950 text-zinc-100' : 'border-neutral-200 bg-white text-slate-800'}`}
            >
              {[5, 10, 15].map((value) => <option key={value} value={value}>{value} min</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">{isRtl ? 'السماح لأي موظف' : 'Allow any staff'}</span>
            <input
              type="checkbox"
              checked={bookingForm.allowAnyStaff}
              onChange={(event) => setBookingForm((current) => ({ ...current, allowAnyStaff: event.target.checked }))}
              className="h-4 w-4 rounded border-neutral-300 text-brand-500 focus:ring-brand-500"
            />
          </label>
          <label className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">{isRtl ? 'الحجز الذاتي' : 'Allow walk-in booking'}</span>
            <input
              type="checkbox"
              checked={bookingForm.allowWalkInBooking}
              onChange={(event) => setBookingForm((current) => ({ ...current, allowWalkInBooking: event.target.checked }))}
              className="h-4 w-4 rounded border-neutral-300 text-brand-500 focus:ring-brand-500"
            />
          </label>
          <label className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">{isRtl ? 'الاعتماد التلقائي' : 'Auto approve bookings'}</span>
            <input
              type="checkbox"
              checked={bookingForm.autoApproveBookings}
              onChange={(event) => setBookingForm((current) => ({ ...current, autoApproveBookings: event.target.checked }))}
              className="h-4 w-4 rounded border-neutral-300 text-brand-500 focus:ring-brand-500"
            />
          </label>
          <label className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">{isRtl ? 'تقدم الحجز (دقائق)' : 'Minimum advance booking (minutes)'}</span>
            <input
              type="number"
              min={0}
              value={bookingForm.minimumAdvanceBookingMinutes}
              onChange={(event) => setBookingForm((current) => ({ ...current, minimumAdvanceBookingMinutes: Number(event.target.value || 0) }))}
              className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-brand-500 ${darkMode ? 'border-zinc-800 bg-zinc-950 text-zinc-100' : 'border-neutral-200 bg-white text-slate-800'}`}
            />
          </label>
          <label className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">{isRtl ? 'الهوامش قبل/بعد' : 'Default buffers before/after'}</span>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={0}
                value={bookingForm.defaultBufferBefore}
                onChange={(event) => setBookingForm((current) => ({ ...current, defaultBufferBefore: Number(event.target.value || 0) }))}
                className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-brand-500 ${darkMode ? 'border-zinc-800 bg-zinc-950 text-zinc-100' : 'border-neutral-200 bg-white text-slate-800'}`}
              />
              <input
                type="number"
                min={0}
                value={bookingForm.defaultBufferAfter}
                onChange={(event) => setBookingForm((current) => ({ ...current, defaultBufferAfter: Number(event.target.value || 0) }))}
                className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-brand-500 ${darkMode ? 'border-zinc-800 bg-zinc-950 text-zinc-100' : 'border-neutral-200 bg-white text-slate-800'}`}
              />
            </div>
          </label>
          <label className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">{isRtl ? 'أيام التقدم القصوى' : 'Maximum advance booking days'}</span>
            <input
              type="number"
              min={1}
              value={bookingForm.maxAdvanceBookingDays}
              onChange={(event) => setBookingForm((current) => ({ ...current, maxAdvanceBookingDays: Number(event.target.value || 0) }))}
              className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-brand-500 ${darkMode ? 'border-zinc-800 bg-zinc-950 text-zinc-100' : 'border-neutral-200 bg-white text-slate-800'}`}
            />
          </label>
          <label className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">{isRtl ? 'ساعات الإلغاء' : 'Cancellation hours'}</span>
            <input
              type="number"
              min={0}
              value={bookingForm.cancellationHours}
              onChange={(event) => setBookingForm((current) => ({ ...current, cancellationHours: Number(event.target.value || 0) }))}
              className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-brand-500 ${darkMode ? 'border-zinc-800 bg-zinc-950 text-zinc-100' : 'border-neutral-200 bg-white text-slate-800'}`}
            />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">{isRtl ? 'سياسة الإلغاء' : 'Cancellation policy'}</span>
            <textarea
              rows={3}
              value={bookingForm.cancellationPolicy}
              onChange={(event) => setBookingForm((current) => ({ ...current, cancellationPolicy: event.target.value }))}
              className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-brand-500 ${darkMode ? 'border-zinc-800 bg-zinc-950 text-zinc-100' : 'border-neutral-200 bg-white text-slate-800'}`}
            />
          </label>
        </div>
      </SectionCard>
      )}

      {activeTab === 'notifications' && (
      <SectionCard
        title={isRtl ? 'الإشعارات والتشغيل' : 'Notifications & operations'}
        description={isRtl
          ? 'الرسائل، التذكيرات، وعدم الحضور، وسلوك الإشعارات الداخلية.'
          : 'Email, SMS, WhatsApp, reminders, no-show automation, and internal alert behavior.'}
        icon={<MoonStar size={14} />}
        darkMode={darkMode}
        actions={(
          <button
            type="button"
            onClick={saveNotifications}
            disabled={savingSection === 'notifications'}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-neutral-500"
          >
            {savingSection === 'notifications' ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            <span>{isRtl ? 'حفظ' : 'Save'}</span>
          </button>
        )}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[
            ['enableEmailNotifications', isRtl ? 'تفعيل البريد الإلكتروني' : 'Email notifications'],
            ['enableSmsNotifications', isRtl ? 'تفعيل الرسائل النصية' : 'SMS notifications'],
            ['enableWhatsAppNotifications', isRtl ? 'تفعيل واتساب' : 'WhatsApp notifications'],
            ['enableVoiceAlerts', isRtl ? 'تنبيهات صوتية' : 'Voice alerts'],
            ['remindRemainderToCollect', isRtl ? 'تذكير بتحصيل المتبقي' : 'Remind remainder to collect'],
            ['autoMarkNoShowAfterGracePeriod', isRtl ? 'عدم الحضور تلقائياً' : 'Auto-mark no show'],
            ['customerReminderEnabled', isRtl ? 'تذكير العميل' : 'Customer reminder']
          ].map(([field, label]) => (
            <label key={String(field)} className="flex items-center justify-between gap-4 rounded-2xl border px-4 py-3">
              <span className="text-sm font-semibold">{label}</span>
              <input
                type="checkbox"
                checked={(notificationForm as any)[field]}
                onChange={(event) => setNotificationForm((current) => ({ ...current, [field as keyof NotificationSettingsForm]: event.target.checked }))}
                className="h-4 w-4 rounded border-neutral-300 text-brand-500 focus:ring-brand-500"
              />
            </label>
          ))}
          <label className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">{isRtl ? 'دقائق فترة السماح' : 'Grace period minutes'}</span>
            <input
              type="number"
              min={0}
              value={notificationForm.appointmentGracePeriodMinutes}
              onChange={(event) => setNotificationForm((current) => ({ ...current, appointmentGracePeriodMinutes: Number(event.target.value || 0) }))}
              className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-brand-500 ${darkMode ? 'border-zinc-800 bg-zinc-950 text-zinc-100' : 'border-neutral-200 bg-white text-slate-800'}`}
            />
          </label>
          <label className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">{isRtl ? 'دقائق تذكير العميل' : 'Customer reminder minutes before'}</span>
            <input
              type="number"
              min={0}
              value={notificationForm.customerReminderMinutesBefore}
              onChange={(event) => setNotificationForm((current) => ({ ...current, customerReminderMinutesBefore: Number(event.target.value || 0) }))}
              className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-brand-500 ${darkMode ? 'border-zinc-800 bg-zinc-950 text-zinc-100' : 'border-neutral-200 bg-white text-slate-800'}`}
            />
          </label>
        </div>
      </SectionCard>
      )}

      {activeTab === 'payment' && (
      <SectionCard
        title={isRtl ? 'السداد والفوترة' : 'Payment settings'}
        description={isRtl
          ? 'قنوات السداد المقبولة، الإيداع، والتوصيل ورسومه.'
          : 'Accepted payment channels, deposits, product delivery rules, and payout details.'}
        icon={<SunMedium size={14} />}
        darkMode={darkMode}
        actions={(
          <button
            type="button"
            onClick={savePayment}
            disabled={savingSection === 'payment'}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-neutral-500"
          >
            {savingSection === 'payment' ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            <span>{isRtl ? 'حفظ' : 'Save'}</span>
          </button>
        )}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[
            ['acceptCash', isRtl ? 'نقداً' : 'Cash'],
            ['acceptCard', isRtl ? 'بطاقة' : 'Card'],
            ['acceptWallet', isRtl ? 'المحفظة' : 'Wallet'],
            ['allowServicePayAtCenter', isRtl ? 'السداد في المركز' : 'Pay at salon'],
            ['allowServiceFullOnline', isRtl ? 'سداد الخدمة كامل عبر الإنترنت' : 'Full online service payment'],
            ['allowServiceDeposit', isRtl ? 'إيداع الخدمة' : 'Service deposit'],
            ['allowProductOnline', isRtl ? 'سداد المنتجات أونلاين' : 'Online product payment'],
            ['allowProductPayOnPickup', isRtl ? 'الدفع عند الاستلام' : 'Pay on pickup'],
            ['allowProductCashOnDelivery', isRtl ? 'الدفع عند التسليم' : 'Cash on delivery']
          ].map(([field, label]) => (
            <label key={String(field)} className="flex items-center justify-between gap-4 rounded-2xl border px-4 py-3">
              <span className="text-sm font-semibold">{label}</span>
              <input
                type="checkbox"
                checked={(paymentForm as any)[field]}
                onChange={(event) => setPaymentForm((current) => ({ ...current, [field as keyof PaymentSettingsForm]: event.target.checked }))}
                className="h-4 w-4 rounded border-neutral-300 text-brand-500 focus:ring-brand-500"
              />
            </label>
          ))}
          <label className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">{isRtl ? 'نمط الإيداع' : 'Deposit mode'}</span>
            <select
              value={paymentForm.serviceDepositMode}
              onChange={(event) => setPaymentForm((current) => ({ ...current, serviceDepositMode: event.target.value === 'percentage' ? 'percentage' : 'fixed' }))}
              className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-brand-500 ${darkMode ? 'border-zinc-800 bg-zinc-950 text-zinc-100' : 'border-neutral-200 bg-white text-slate-800'}`}
            >
              <option value="fixed">{isRtl ? 'مبلغ ثابت' : 'Fixed amount'}</option>
              <option value="percentage">{isRtl ? 'نسبة مئوية' : 'Percentage'}</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">{isRtl ? 'قيمة الإيداع الثابت' : 'Fixed deposit amount'}</span>
            <input
              type="number"
              min={0}
              value={paymentForm.serviceDepositFixedAmount}
              onChange={(event) => setPaymentForm((current) => ({ ...current, serviceDepositFixedAmount: Number(event.target.value || 0) }))}
              className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-brand-500 ${darkMode ? 'border-zinc-800 bg-zinc-950 text-zinc-100' : 'border-neutral-200 bg-white text-slate-800'}`}
            />
          </label>
          <label className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">{isRtl ? 'نسبة الإيداع' : 'Deposit percentage'}</span>
            <input
              type="number"
              min={0}
              max={100}
              value={paymentForm.serviceDepositPercentage}
              onChange={(event) => setPaymentForm((current) => ({ ...current, serviceDepositPercentage: Number(event.target.value || 0) }))}
              className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-brand-500 ${darkMode ? 'border-zinc-800 bg-zinc-950 text-zinc-100' : 'border-neutral-200 bg-white text-slate-800'}`}
            />
          </label>
          <label className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">{isRtl ? 'رسوم التوصيل الافتراضية' : 'Default delivery fee'}</span>
            <input
              type="number"
              min={0}
              value={paymentForm.defaultDeliveryFee}
              onChange={(event) => setPaymentForm((current) => ({ ...current, defaultDeliveryFee: Number(event.target.value || 0) }))}
              className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-brand-500 ${darkMode ? 'border-zinc-800 bg-zinc-950 text-zinc-100' : 'border-neutral-200 bg-white text-slate-800'}`}
            />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">{isRtl ? 'حساب البنك / السحب' : 'Payout bank account JSON'}</span>
            <textarea
              rows={4}
              value={paymentForm.payoutBankAccount}
              onChange={(event) => setPaymentForm((current) => ({ ...current, payoutBankAccount: event.target.value }))}
              className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-brand-500 ${darkMode ? 'border-zinc-800 bg-zinc-950 text-zinc-100' : 'border-neutral-200 bg-white text-slate-800'}`}
            />
          </label>
        </div>
      </SectionCard>
      )}

      {activeTab === 'localization' && (
      <SectionCard
        title={isRtl ? 'اللغة والمنطقة' : 'Localization'}
        description={isRtl
          ? 'اللغة الافتراضية واللغات المتاحة والمنطقة الزمنية والعملة.'
          : 'Default language, available languages, time zone, and currency.'}
        icon={<Globe size={14} />}
        darkMode={darkMode}
        actions={(
          <button
            type="button"
            onClick={saveLocalization}
            disabled={savingSection === 'localization'}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-neutral-500"
          >
            {savingSection === 'localization' ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            <span>{isRtl ? 'حفظ' : 'Save'}</span>
          </button>
        )}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">{isRtl ? 'اللغة الافتراضية' : 'Default language'}</span>
            <select
              value={localizationForm.defaultLanguage}
              onChange={(event) => setLocalizationForm((current) => ({ ...current, defaultLanguage: event.target.value === 'en' ? 'en' : 'ar' }))}
              className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-brand-500 ${darkMode ? 'border-zinc-800 bg-zinc-950 text-zinc-100' : 'border-neutral-200 bg-white text-slate-800'}`}
            >
              <option value="ar">Arabic</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">{isRtl ? 'العملة' : 'Currency'}</span>
            <input
              type="text"
              value={localizationForm.currency}
              onChange={(event) => setLocalizationForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
              className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-brand-500 ${darkMode ? 'border-zinc-800 bg-zinc-950 text-zinc-100' : 'border-neutral-200 bg-white text-slate-800'}`}
            />
          </label>
          <label className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">{isRtl ? 'المنطقة الزمنية' : 'Timezone'}</span>
            <input
              type="text"
              value={localizationForm.timezone}
              onChange={(event) => setLocalizationForm((current) => ({ ...current, timezone: event.target.value }))}
              className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-brand-500 ${darkMode ? 'border-zinc-800 bg-zinc-950 text-zinc-100' : 'border-neutral-200 bg-white text-slate-800'}`}
            />
          </label>
          <div className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">{isRtl ? 'اللغات المتاحة' : 'Supported languages'}</span>
            <div className="flex flex-wrap gap-2">
              {(['ar', 'en'] as const).map((code) => (
                <label key={code} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold ${localizationForm.supportedLanguages.includes(code) ? 'border-brand-500 bg-brand-500/10 text-brand-700' : darkMode ? 'border-zinc-800 bg-zinc-950 text-zinc-300' : 'border-neutral-200 bg-white text-slate-600'}`}>
                  <input
                    type="checkbox"
                    checked={localizationForm.supportedLanguages.includes(code)}
                    onChange={(event) => setLocalizationForm((current) => {
                      const next = new Set(current.supportedLanguages);
                      if (event.target.checked) {
                        next.add(code);
                      } else {
                        next.delete(code);
                      }
                      return { ...current, supportedLanguages: Array.from(next) as Array<'ar' | 'en'> };
                    })}
                  />
                  <span>{code.toUpperCase()}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>
      )}

      {activeTab === 'accounts' && (
      <SectionCard
        title={isRtl ? 'حسابات الإدارة والفريق' : 'Team access accounts'}
        description={isRtl
          ? 'إدارة حسابات لوحة التحكم، الأدوار، والصلاحيات دون إنشاء API جديد.'
          : 'Manage dashboard accounts, roles, and permissions using the existing backend.'}
        icon={<Users size={14} />}
        darkMode={darkMode}
        actions={canManageAccounts ? (
          <button
            type="button"
            onClick={() => {
              resetAccountForm();
              void loadAccounts();
            }}
            disabled={savingSection === 'accounts'}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition hover:border-brand-400 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={14} className={savingSection === 'accounts' ? 'animate-spin' : ''} />
            <span>{isRtl ? 'تحديث' : 'Refresh'}</span>
          </button>
        ) : undefined}
      >
        {!canManageAccounts ? (
          <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
            {isRtl ? 'لا تملك صلاحية إدارة حسابات الفريق.' : 'You do not have permission to manage dashboard accounts.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-3">
              {accountsError && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-600">
                  {accountsError}
                </div>
              )}
              {accountsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((row) => (
                    <div key={row} className="h-24 animate-pulse rounded-2xl bg-neutral-100" />
                  ))}
                </div>
              ) : accounts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
                  {isRtl ? 'لا توجد حسابات لوحة تحكم حالياً.' : 'No dashboard accounts yet.'}
                </div>
              ) : (
                accounts.map((account) => (
                  <div key={account.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-black text-slate-900">{account.displayName}</h4>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${account.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                            {account.isActive ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'معطل' : 'Disabled')}
                          </span>
                          {account.passwordResetRequired && (
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-700">
                              {isRtl ? 'يحتاج إعادة كلمة المرور' : 'Reset required'}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-neutral-500">{account.email}</p>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">{account.roleKey}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => handleEditAccount(account)} className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-neutral-50">
                          {isRtl ? 'تعديل' : 'Edit'}
                        </button>
                        <button type="button" onClick={() => handleResetAccountPassword(account.id)} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100">
                          {isRtl ? 'إعادة كلمة المرور' : 'Reset password'}
                        </button>
                        <button type="button" onClick={() => handleSendInvite(account.id)} className="rounded-xl border border-brand-200 bg-brand-500/10 px-3 py-2 text-xs font-bold text-brand-700 hover:bg-brand-500/20">
                          {isRtl ? 'إرسال دعوة' : 'Send invite'}
                        </button>
                        <button type="button" onClick={() => handleToggleAccountActive(account)} className={`rounded-xl px-3 py-2 text-xs font-bold ${account.isActive ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100' : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                          {account.isActive ? (isRtl ? 'تعطيل' : 'Disable') : (isRtl ? 'تفعيل' : 'Enable')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="space-y-1">
                <h4 className="text-base font-black text-slate-900">
                  {editingAccountId ? (isRtl ? 'تعديل الحساب' : 'Edit account') : (isRtl ? 'إنشاء حساب فريق' : 'Create dashboard account')}
                </h4>
                <p className="text-sm text-neutral-500">
                  {isRtl ? 'اختر الدور أو خصص صلاحيات الأقسام هنا.' : 'Choose a role or fine tune section access here.'}
                </p>
              </div>

              {generatedPassword && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <div className="font-bold">{isRtl ? 'كلمة المرور المؤقتة' : 'Temporary password'}</div>
                  <div className="mt-1 break-all font-mono text-base">{generatedPassword}</div>
                </div>
              )}

              <label className="space-y-2 block">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">{isRtl ? 'الاسم' : 'Display name'}</span>
                <input
                  type="text"
                  value={accountForm.displayName}
                  onChange={(event) => setAccountForm((current) => ({ ...current, displayName: event.target.value }))}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-brand-500"
                />
              </label>

              <label className="space-y-2 block">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">{isRtl ? 'البريد الإلكتروني' : 'Email'}</span>
                <input
                  type="email"
                  value={accountForm.email}
                  onChange={(event) => setAccountForm((current) => ({ ...current, email: event.target.value }))}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-brand-500"
                />
              </label>

              <label className="space-y-2 block">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">{isRtl ? 'الدور' : 'Role preset'}</span>
                <select
                  value={accountForm.roleKey}
                  onChange={(event) => applyRolePreset(event.target.value)}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-brand-500"
                >
                  {ROLE_PRESETS.map((preset) => (
                    <option key={preset.key} value={preset.key}>{isRtl ? preset.labelAr : preset.labelEn}</option>
                  ))}
                </select>
              </label>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="mb-3">
                  <h5 className="text-sm font-black text-slate-900">{isRtl ? 'صلاحيات الأقسام' : 'Section permissions'}</h5>
                  <p className="text-xs text-neutral-500">{isRtl ? 'هذه الحسابات لمديري لوحة التحكم والفروع.' : 'These accounts are for dashboard administrators and branch managers.'}</p>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {PERMISSION_ITEMS.map((item) => (
                    <label key={item.key} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2.5">
                      <span className="text-sm font-medium text-slate-700">{isRtl ? item.labelAr : item.labelEn}</span>
                      <input
                        type="checkbox"
                        checked={accountForm.permissions[item.key] === true}
                        onChange={(event) => setAccountForm((current) => ({
                          ...current,
                          permissions: {
                            ...current.permissions,
                            [item.key]: event.target.checked
                          }
                        }))}
                        className="h-4 w-4 rounded border-neutral-300 text-brand-500 focus:ring-brand-500"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={accountForm.isActive}
                  onChange={(event) => setAccountForm((current) => ({ ...current, isActive: event.target.checked }))}
                  className="h-4 w-4 rounded border-neutral-300 text-brand-500 focus:ring-brand-500"
                />
                <span>{isRtl ? 'الحساب مفعل' : 'Account enabled'}</span>
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSaveAccount}
                  disabled={savingSection === 'accounts'}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-neutral-500"
                >
                  {savingSection === 'accounts' ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>{editingAccountId ? (isRtl ? 'حفظ التعديلات' : 'Save changes') : (isRtl ? 'إنشاء الحساب' : 'Create account')}</span>
                </button>
                <button
                  type="button"
                  onClick={resetAccountForm}
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-neutral-50"
                >
                  {isRtl ? 'مسح' : 'Clear'}
                </button>
              </div>
            </div>
          </div>
        )}
      </SectionCard>
      )}

      {activeTab === 'security' && (
      <SectionCard
        title={isRtl ? 'أمان الحساب' : 'Account security'}
        description={isRtl
          ? 'تغيير كلمة المرور للمالك أو الحساب الحالي مع نفس تنفيذ V1.'
          : 'Change the current owner or dashboard account password using the existing V1 endpoint.'}
        icon={<Lock size={14} />}
        darkMode={darkMode}
      >
        <PasswordSecuritySection onSubmit={handleChangePassword} lang={lang} darkMode={darkMode} />
      </SectionCard>
      )}

      {activeTab === 'working-hours' && (
      <SectionCard
        title={isRtl ? 'ملخص ساعات العمل' : 'Working hours snapshot'}
        description={isRtl
          ? 'هذه القيم هي التي يستهلكها الجدول الآن.'
          : 'These values are what the scheduler now consumes.'}
        icon={<CheckCircle2 size={14} />}
        darkMode={darkMode}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {weekHoursSummary.map((day) => (
            <div key={day.key} className={`rounded-2xl border px-4 py-3 ${day.isOpen ? 'border-emerald-200 bg-emerald-500/5' : 'border-neutral-200 bg-neutral-50'}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black">{isRtl ? day.labelAr : day.labelEn}</div>
                  <div className="text-xs text-neutral-400">{day.isOpen ? `${day.open} → ${day.close}` : (isRtl ? 'مغلق' : 'Closed')}</div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${day.isOpen ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-500/10 text-slate-500'}`}>
                  {day.isOpen ? (isRtl ? 'مفتوح' : 'Open') : (isRtl ? 'مغلق' : 'Closed')}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
          {isRtl
            ? `الجدول الحالي سيبدأ عند ${schedulerConfig.startHour.toString().padStart(2, '0')}:00 وينتهي عند ${schedulerConfig.endHour.toString().padStart(2, '0')}:00 مع فاصل ${schedulerConfig.slotMinutes} دقائق.`
            : `Scheduler will now render from ${schedulerConfig.startHour.toString().padStart(2, '0')}:00 to ${schedulerConfig.endHour.toString().padStart(2, '0')}:00 using ${schedulerConfig.slotMinutes}-minute slots.`}
        </div>
      </SectionCard>
      )}
    </div>
  );
}

function PasswordSecuritySection({
  onSubmit,
  lang,
  darkMode = false
}: {
  onSubmit: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<any>;
  lang: 'ar' | 'en';
  darkMode?: boolean;
}) {
  const isRtl = lang === 'ar';
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const reset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      if (!currentPassword || !newPassword || !confirmPassword) {
        throw new Error(isRtl ? 'الرجاء تعبئة جميع الحقول.' : 'Please fill all fields.');
      }
      if (newPassword.length < 8) {
        throw new Error(isRtl ? 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.' : 'New password must be at least 8 characters.');
      }
      if (newPassword !== confirmPassword) {
        throw new Error(isRtl ? 'تأكيد كلمة المرور غير مطابق.' : 'Password confirmation does not match.');
      }

      const response = await onSubmit(currentPassword, newPassword, confirmPassword);
      setSuccess(response?.message || (isRtl ? 'تم تغيير كلمة المرور بنجاح.' : 'Password updated successfully.'));
      reset();
    } catch (submitError: any) {
      setError(submitError?.message || (isRtl ? 'تعذر تغيير كلمة المرور.' : 'Failed to change password.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {error && <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{error}</div>}
      {success && <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">{success}</div>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          ['current', isRtl ? 'كلمة المرور الحالية' : 'Current password', currentPassword, setCurrentPassword],
          ['new', isRtl ? 'كلمة المرور الجديدة' : 'New password', newPassword, setNewPassword],
          ['confirm', isRtl ? 'تأكيد كلمة المرور' : 'Confirm password', confirmPassword, setConfirmPassword]
        ].map(([key, label, value, setter]) => (
          <label key={String(key)} className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">{label as string}</span>
            <input
              type="password"
              value={value as string}
              onChange={(event) => (setter as React.Dispatch<React.SetStateAction<string>>)(event.target.value)}
              className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-brand-500 ${darkMode ? 'border-zinc-800 bg-zinc-950 text-zinc-100' : 'border-neutral-200 bg-white text-slate-800'}`}
            />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-neutral-500"
        >
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <Shield size={14} />}
          <span>{isRtl ? 'تحديث كلمة المرور' : 'Update password'}</span>
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={saving}
          className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-neutral-50"
        >
          {isRtl ? 'مسح' : 'Clear'}
        </button>
      </div>
    </div>
  );
}
