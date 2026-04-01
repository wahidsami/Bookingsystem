'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { getImageUrl, tenantApi } from '@/lib/api';
import { TenantLayout } from '@/components/TenantLayout';
import {
  BuildingOfficeIcon,
  ClockIcon,
  CalendarDaysIcon,
  BellIcon,
  CreditCardIcon,
  GlobeAltIcon,
  PaintBrushIcon,
  PhotoIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

interface WorkingDay {
  open: string;
  close: string;
  isOpen: boolean;
}

interface WorkingHours {
  sunday: WorkingDay;
  monday: WorkingDay;
  tuesday: WorkingDay;
  wednesday: WorkingDay;
  thursday: WorkingDay;
  friday: WorkingDay;
  saturday: WorkingDay;
}

export default function SettingsPage() {
  const t = useTranslations('Settings');
  const locale = useLocale();
  const isRTL = locale === 'ar';

  const [activeTab, setActiveTab] = useState('business');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Business info
  const [businessInfo, setBusinessInfo] = useState({
    name_en: '',
    name_ar: '',
    businessType: ['salon'] as string[],
    email: '',
    phone: '',
    mobile: '',
    website: '',
    whatsapp: '',
    buildingNumber: '',
    street: '',
    district: '',
    city: '',
    country: 'Saudi Arabia',
    postalCode: '',
    googleMapLink: '',
    description: '',
    descriptionAr: '',
    logo: '',
    coverImage: '',
    // Social Media
    facebookUrl: '',
    instagramUrl: '',
    twitterUrl: '',
    linkedinUrl: '',
    tiktokUrl: '',
    youtubeUrl: '',
    snapchatUrl: '',
    pinterestUrl: '',
  });

  // Working hours
  const [workingHours, setWorkingHours] = useState<WorkingHours>({
    sunday: { open: '09:00', close: '21:00', isOpen: true },
    monday: { open: '09:00', close: '21:00', isOpen: true },
    tuesday: { open: '09:00', close: '21:00', isOpen: true },
    wednesday: { open: '09:00', close: '21:00', isOpen: true },
    thursday: { open: '09:00', close: '21:00', isOpen: true },
    friday: { open: '14:00', close: '21:00', isOpen: true },
    saturday: { open: '09:00', close: '21:00', isOpen: true },
  });

  // Booking settings
  const [bookingSettings, setBookingSettings] = useState({
    autoApproveBookings: true,
    bufferTime: 15,
    maxAdvanceBookingDays: 30,
    cancellationHours: 24,
    cancellationPolicy: '',
  });

  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState({
    enableEmailNotifications: true,
    enableSmsNotifications: false,
    enableWhatsAppNotifications: false,
    enableVoiceAlerts: true,
    remindRemainderToCollect: true,
  });

  // Payment settings
  const [paymentSettings, setPaymentSettings] = useState({
    acceptCash: true,
    acceptCard: true,
    acceptWallet: true,
    defaultDeliveryFee: 0,
  });

  // Localization settings
  const [localizationSettings, setLocalizationSettings] = useState({
    defaultLanguage: 'ar',
    timezone: 'Asia/Riyadh',
    currency: 'SAR',
  });

  // Appearance settings
  const [appearanceSettings, setAppearanceSettings] = useState({
    layoutTemplate: 'default',
    themeColors: {
      primary: '#7C3AED',
      secondary: '#EC4899',
    },
  });

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await tenantApi.getSettings();
      if (response.success) {
        const { business, settings } = response.data;

        // Business info
        setBusinessInfo({
          name_en: business.name_en || '',
          name_ar: business.name_ar || '',
          businessType: Array.isArray(business.businessType) ? business.businessType : (business.businessType ? [business.businessType] : ['salon']),
          email: business.email || '',
          phone: business.phone || '',
          mobile: business.mobile || '',
          website: business.website || '',
          whatsapp: business.whatsapp || '',
          buildingNumber: business.buildingNumber || '',
          street: business.street || '',
          district: business.district || '',
          city: business.city || '',
          country: business.country || 'Saudi Arabia',
          postalCode: business.postalCode || '',
          googleMapLink: business.googleMapLink || '',
          description: business.description || '',
          descriptionAr: business.descriptionAr || '',
          logo: business.logo || '',
          coverImage: business.coverImage || '',
          // Social Media
          facebookUrl: business.facebookUrl || '',
          instagramUrl: business.instagramUrl || '',
          twitterUrl: business.twitterUrl || '',
          linkedinUrl: business.linkedinUrl || '',
          tiktokUrl: business.tiktokUrl || '',
          youtubeUrl: business.youtubeUrl || '',
          snapchatUrl: business.snapchatUrl || '',
          pinterestUrl: business.pinterestUrl || '',
        });

        // Working hours
        if (business.workingHours) {
          setWorkingHours(business.workingHours);
        }

        // Settings
        if (settings) {
          setBookingSettings({
            autoApproveBookings: settings.autoApproveBookings ?? true,
            bufferTime: settings.bufferTime ?? 15,
            maxAdvanceBookingDays: settings.maxAdvanceBookingDays ?? 30,
            cancellationHours: settings.cancellationHours ?? 24,
            cancellationPolicy: settings.cancellationPolicy || '',
          });

          setNotificationSettings({
            enableEmailNotifications: settings.enableEmailNotifications ?? true,
            enableSmsNotifications: settings.enableSmsNotifications ?? false,
            enableWhatsAppNotifications: settings.enableWhatsAppNotifications ?? false,
            enableVoiceAlerts: settings.enableVoiceAlerts ?? true,
            remindRemainderToCollect: (settings.notificationSettings as { remindRemainderToCollect?: boolean } | undefined)?.remindRemainderToCollect !== false,
          });

          setPaymentSettings({
            acceptCash: settings.acceptCash ?? true,
            acceptCard: settings.acceptCard ?? true,
            acceptWallet: settings.acceptWallet ?? true,
            defaultDeliveryFee: settings.defaultDeliveryFee != null ? Number(settings.defaultDeliveryFee) : 0,
          });

          setLocalizationSettings({
            defaultLanguage: settings.defaultLanguage || 'ar',
            timezone: settings.timezone || 'Asia/Riyadh',
            currency: settings.currency || 'SAR',
          });
        }

        if (business.layoutTemplate || business.themeColors) {
          setAppearanceSettings({
            layoutTemplate: business.layoutTemplate || 'default',
            themeColors: business.themeColors || { primary: '#7C3AED', secondary: '#EC4899' },
          });
        }
      }
    } catch (err: any) {
      console.error('Failed to load settings:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const showSuccess = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleSaveBusinessInfo = async () => {
    try {
      setSaving(true);
      await tenantApi.updateBusinessInfo(businessInfo);
      showSuccess(t('businessInfoSaved'));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWorkingHours = async () => {
    try {
      setSaving(true);
      await tenantApi.updateWorkingHours(workingHours);
      showSuccess(t('workingHoursSaved'));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBookingSettings = async () => {
    try {
      setSaving(true);
      await tenantApi.updateBookingSettings(bookingSettings);
      showSuccess(t('bookingSettingsSaved'));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotificationSettings = async () => {
    try {
      setSaving(true);
      await tenantApi.updateNotificationSettings(notificationSettings);
      showSuccess(t('notificationSettingsSaved'));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePaymentSettings = async () => {
    try {
      setSaving(true);
      await tenantApi.updatePaymentSettings(paymentSettings);
      showSuccess(t('paymentSettingsSaved'));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLocalizationSettings = async () => {
    try {
      setSaving(true);
      await tenantApi.updateLocalizationSettings(localizationSettings);
      showSuccess(t('localizationSettingsSaved'));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setSaving(true);
        const response = await tenantApi.uploadLogo(file);
        if (response.success) {
          setBusinessInfo(prev => ({ ...prev, logo: response.data.logo }));
          showSuccess(t('logoUploaded'));
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
    }
  };

  const tabs = [
    { id: 'business', icon: BuildingOfficeIcon, label: t('businessInfo') },
    { id: 'hours', icon: ClockIcon, label: t('workingHours') },
    { id: 'booking', icon: CalendarDaysIcon, label: t('bookingSettings') },
    { id: 'notifications', icon: BellIcon, label: t('notifications') },
    { id: 'payment', icon: CreditCardIcon, label: t('payment') },
    { id: 'localization', icon: GlobeAltIcon, label: t('localization') },
  ];

  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

  if (loading) {
    return (
      <TenantLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout>
      <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {t('title')}
          </h1>
          <p className="text-gray-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {t('subtitle')}
          </p>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <CheckIcon className="w-5 h-5" />
            {success}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Tabs */}
          <div className="lg:w-64 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === tab.id
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                >
                  <tab.icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            {/* Business Info Tab */}
            {activeTab === 'business' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t('businessInfo')}
                </h2>

                {/* Logo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t('logo')}
                  </label>
                  <div className="flex items-center gap-4" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <div className="w-24 h-24 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                      {businessInfo.logo ? (
                        <img src={getImageUrl(businessInfo.logo)} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        <PhotoIcon className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    <label className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 cursor-pointer">
                      {t('uploadLogo')}
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t('nameEn')}
                    </label>
                    <input
                      type="text"
                      value={businessInfo.name_en}
                      onChange={(e) => setBusinessInfo(prev => ({ ...prev, name_en: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t('nameAr')}
                    </label>
                    <input
                      type="text"
                      value={businessInfo.name_ar}
                      onChange={(e) => setBusinessInfo(prev => ({ ...prev, name_ar: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      style={{ textAlign: 'right' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t('email')}
                    </label>
                    <input
                      type="email"
                      value={businessInfo.email}
                      onChange={(e) => setBusinessInfo(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t('phone')}
                    </label>
                    <input
                      type="text"
                      value={businessInfo.phone}
                      onChange={(e) => setBusinessInfo(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t('mobile')}
                    </label>
                    <input
                      type="text"
                      value={businessInfo.mobile}
                      onChange={(e) => setBusinessInfo(prev => ({ ...prev, mobile: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t('city')}
                    </label>
                    <input
                      type="text"
                      value={businessInfo.city}
                      onChange={(e) => setBusinessInfo(prev => ({ ...prev, city: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t('website')}
                    </label>
                    <input
                      type="url"
                      value={businessInfo.website}
                      onChange={(e) => setBusinessInfo(prev => ({ ...prev, website: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                      placeholder="https://example.com"
                    />
                  </div>
                </div>

                {/* Address Section */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-md font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t('address')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        {t('buildingNumber')}
                      </label>
                      <input
                        type="text"
                        value={businessInfo.buildingNumber}
                        onChange={(e) => setBusinessInfo(prev => ({ ...prev, buildingNumber: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        {t('street')}
                      </label>
                      <input
                        type="text"
                        value={businessInfo.street}
                        onChange={(e) => setBusinessInfo(prev => ({ ...prev, street: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        {t('district')}
                      </label>
                      <input
                        type="text"
                        value={businessInfo.district}
                        onChange={(e) => setBusinessInfo(prev => ({ ...prev, district: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        {t('postalCode')}
                      </label>
                      <input
                        type="text"
                        value={businessInfo.postalCode}
                        onChange={(e) => setBusinessInfo(prev => ({ ...prev, postalCode: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        {t('googleMapLink')}
                      </label>
                      <input
                        type="url"
                        value={businessInfo.googleMapLink}
                        onChange={(e) => setBusinessInfo(prev => ({ ...prev, googleMapLink: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                        placeholder="https://maps.google.com/..."
                      />
                    </div>
                  </div>
                  {/* Display Full Address */}
                  {(businessInfo.buildingNumber || businessInfo.street || businessInfo.district || businessInfo.city) && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        {t('fullAddress')}:
                      </p>
                      <p className="text-sm text-gray-600" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        {[
                          businessInfo.buildingNumber,
                          businessInfo.street,
                          businessInfo.district,
                          businessInfo.city,
                          businessInfo.country
                        ].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Social Media Section */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-md font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t('socialMedia')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        WhatsApp {t('number')}
                      </label>
                      <input
                        type="text"
                        value={businessInfo.whatsapp}
                        onChange={(e) => setBusinessInfo(prev => ({ ...prev, whatsapp: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                        placeholder="+966501234567"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        Facebook
                      </label>
                      <input
                        type="url"
                        value={businessInfo.facebookUrl}
                        onChange={(e) => setBusinessInfo(prev => ({ ...prev, facebookUrl: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                        placeholder="https://facebook.com/yourpage"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        Instagram
                      </label>
                      <input
                        type="url"
                        value={businessInfo.instagramUrl}
                        onChange={(e) => setBusinessInfo(prev => ({ ...prev, instagramUrl: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                        placeholder="https://instagram.com/yourprofile"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        Twitter/X
                      </label>
                      <input
                        type="url"
                        value={businessInfo.twitterUrl}
                        onChange={(e) => setBusinessInfo(prev => ({ ...prev, twitterUrl: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                        placeholder="https://twitter.com/yourhandle"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        LinkedIn
                      </label>
                      <input
                        type="url"
                        value={businessInfo.linkedinUrl}
                        onChange={(e) => setBusinessInfo(prev => ({ ...prev, linkedinUrl: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                        placeholder="https://linkedin.com/company/yourcompany"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        TikTok
                      </label>
                      <input
                        type="url"
                        value={businessInfo.tiktokUrl}
                        onChange={(e) => setBusinessInfo(prev => ({ ...prev, tiktokUrl: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                        placeholder="https://tiktok.com/@yourhandle"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        YouTube
                      </label>
                      <input
                        type="url"
                        value={businessInfo.youtubeUrl}
                        onChange={(e) => setBusinessInfo(prev => ({ ...prev, youtubeUrl: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                        placeholder="https://youtube.com/@yourchannel"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        Snapchat
                      </label>
                      <input
                        type="text"
                        value={businessInfo.snapchatUrl}
                        onChange={(e) => setBusinessInfo(prev => ({ ...prev, snapchatUrl: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                        placeholder="@yourusername"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        Pinterest
                      </label>
                      <input
                        type="url"
                        value={businessInfo.pinterestUrl}
                        onChange={(e) => setBusinessInfo(prev => ({ ...prev, pinterestUrl: e.target.value }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                        placeholder="https://pinterest.com/yourprofile"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSaveBusinessInfo}
                  disabled={saving}
                  className="mt-6 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? t('saving') : t('save')}
                </button>
              </div>
            )}

            {/* Working Hours Tab */}
            {activeTab === 'hours' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t('workingHours')}
                </h2>

                <div className="space-y-4">
                  {days.map((day) => (
                    <div key={day} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <div className="w-28">
                        <label className="flex items-center gap-2 cursor-pointer" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                          <input
                            type="checkbox"
                            checked={workingHours[day].isOpen}
                            onChange={(e) => setWorkingHours(prev => ({
                              ...prev,
                              [day]: { ...prev[day], isOpen: e.target.checked }
                            }))}
                            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="font-medium text-gray-700">{t(day)}</span>
                        </label>
                      </div>
                      {workingHours[day].isOpen && (
                        <div className="flex items-center gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                          <input
                            type="time"
                            value={workingHours[day].open}
                            onChange={(e) => setWorkingHours(prev => ({
                              ...prev,
                              [day]: { ...prev[day], open: e.target.value }
                            }))}
                            className="px-3 py-2 border border-gray-300 rounded-lg"
                          />
                          <span className="text-gray-500">{t('to')}</span>
                          <input
                            type="time"
                            value={workingHours[day].close}
                            onChange={(e) => setWorkingHours(prev => ({
                              ...prev,
                              [day]: { ...prev[day], close: e.target.value }
                            }))}
                            className="px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                      )}
                      {!workingHours[day].isOpen && (
                        <span className="text-gray-400">{t('closed')}</span>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleSaveWorkingHours}
                  disabled={saving}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? t('saving') : t('save')}
                </button>
              </div>
            )}

            {/* Booking Settings Tab */}
            {activeTab === 'booking' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t('bookingSettings')}
                </h2>

                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <input
                      type="checkbox"
                      checked={bookingSettings.autoApproveBookings}
                      onChange={(e) => setBookingSettings(prev => ({ ...prev, autoApproveBookings: e.target.checked }))}
                      className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-gray-700">{t('autoApproveBookings')}</span>
                  </label>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t('bufferTime')}
                    </label>
                    <select
                      value={bookingSettings.bufferTime}
                      onChange={(e) => setBookingSettings(prev => ({ ...prev, bufferTime: parseInt(e.target.value) }))}
                      className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    >
                      <option value={0}>0 {t('minutes')}</option>
                      <option value={5}>5 {t('minutes')}</option>
                      <option value={10}>10 {t('minutes')}</option>
                      <option value={15}>15 {t('minutes')}</option>
                      <option value={30}>30 {t('minutes')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t('maxAdvanceBooking')}
                    </label>
                    <select
                      value={bookingSettings.maxAdvanceBookingDays}
                      onChange={(e) => setBookingSettings(prev => ({ ...prev, maxAdvanceBookingDays: parseInt(e.target.value) }))}
                      className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    >
                      <option value={7}>7 {t('days')}</option>
                      <option value={14}>14 {t('days')}</option>
                      <option value={30}>30 {t('days')}</option>
                      <option value={60}>60 {t('days')}</option>
                      <option value={90}>90 {t('days')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t('cancellationHours')}
                    </label>
                    <select
                      value={bookingSettings.cancellationHours}
                      onChange={(e) => setBookingSettings(prev => ({ ...prev, cancellationHours: parseInt(e.target.value) }))}
                      className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    >
                      <option value={1}>1 {t('hour')}</option>
                      <option value={2}>2 {t('hours')}</option>
                      <option value={6}>6 {t('hours')}</option>
                      <option value={12}>12 {t('hours')}</option>
                      <option value={24}>24 {t('hours')}</option>
                      <option value={48}>48 {t('hours')}</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleSaveBookingSettings}
                  disabled={saving}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? t('saving') : t('save')}
                </button>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t('notifications')}
                </h2>

                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <input
                      type="checkbox"
                      checked={notificationSettings.enableEmailNotifications}
                      onChange={(e) => setNotificationSettings(prev => ({ ...prev, enableEmailNotifications: e.target.checked }))}
                      className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-gray-700">{t('emailNotifications')}</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <input
                      type="checkbox"
                      checked={notificationSettings.enableSmsNotifications}
                      onChange={(e) => setNotificationSettings(prev => ({ ...prev, enableSmsNotifications: e.target.checked }))}
                      className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-gray-700">{t('smsNotifications')}</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <input
                      type="checkbox"
                      checked={notificationSettings.enableWhatsAppNotifications}
                      onChange={(e) => setNotificationSettings(prev => ({ ...prev, enableWhatsAppNotifications: e.target.checked }))}
                      className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-gray-700">{t('whatsappNotifications')}</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <input
                      type="checkbox"
                      checked={notificationSettings.enableVoiceAlerts}
                      onChange={(e) => setNotificationSettings(prev => ({ ...prev, enableVoiceAlerts: e.target.checked }))}
                      className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-gray-700">{t('voiceAlerts')}</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <input
                      type="checkbox"
                      checked={notificationSettings.remindRemainderToCollect}
                      onChange={(e) => setNotificationSettings(prev => ({ ...prev, remindRemainderToCollect: e.target.checked }))}
                      className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-gray-700">{t('remindRemainderToCollect')}</span>
                  </label>
                </div>

                <button
                  onClick={handleSaveNotificationSettings}
                  disabled={saving}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? t('saving') : t('save')}
                </button>
              </div>
            )}

            {/* Payment Tab */}
            {activeTab === 'payment' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t('payment')}
                </h2>

                <div className="space-y-4">
                  <h3 className="font-medium text-gray-700" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t('acceptedPaymentMethods')}
                  </h3>

                  <label className="flex items-center gap-3 cursor-pointer" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <input
                      type="checkbox"
                      checked={paymentSettings.acceptCash}
                      onChange={(e) => setPaymentSettings(prev => ({ ...prev, acceptCash: e.target.checked }))}
                      className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-gray-700">{t('cash')}</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <input
                      type="checkbox"
                      checked={paymentSettings.acceptCard}
                      onChange={(e) => setPaymentSettings(prev => ({ ...prev, acceptCard: e.target.checked }))}
                      className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-gray-700">{t('card')}</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <input
                      type="checkbox"
                      checked={paymentSettings.acceptWallet}
                      onChange={(e) => setPaymentSettings(prev => ({ ...prev, acceptWallet: e.target.checked }))}
                      className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-gray-700">{t('wallet')}</span>
                  </label>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <h3 className="font-medium text-gray-700 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? 'رسوم التوصيل الافتراضية (ر.س)' : 'Default delivery fee (SAR)'}
                  </h3>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={paymentSettings.defaultDeliveryFee ?? ''}
                    onChange={(e) => setPaymentSettings(prev => ({ ...prev, defaultDeliveryFee: parseFloat(e.target.value) || 0 }))}
                    className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                    placeholder="0"
                  />
                  <p className="text-sm text-gray-500 mt-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {locale === 'ar' ? 'يُطبق عند اختيار العميل "التوصيل" في سلة المشتريات.' : 'Applied when customer selects "Delivery" at checkout.'}
                  </p>
                </div>

                <button
                  onClick={handleSavePaymentSettings}
                  disabled={saving}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? t('saving') : t('save')}
                </button>
              </div>
            )}

            {/* Localization Tab */}
            {activeTab === 'localization' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t('localization')}
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t('defaultLanguage')}
                    </label>
                    <select
                      value={localizationSettings.defaultLanguage}
                      onChange={(e) => setLocalizationSettings(prev => ({ ...prev, defaultLanguage: e.target.value }))}
                      className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="ar">{t('arabic')}</option>
                      <option value="en">{t('english')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t('timezone')}
                    </label>
                    <select
                      value={localizationSettings.timezone}
                      onChange={(e) => setLocalizationSettings(prev => ({ ...prev, timezone: e.target.value }))}
                      className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="Asia/Riyadh">Asia/Riyadh (UTC+3)</option>
                      <option value="Asia/Dubai">Asia/Dubai (UTC+4)</option>
                      <option value="Asia/Kuwait">Asia/Kuwait (UTC+3)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t('currency')}
                    </label>
                    <select
                      value={localizationSettings.currency}
                      onChange={(e) => setLocalizationSettings(prev => ({ ...prev, currency: e.target.value }))}
                      className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="SAR">{t('sar')}</option>
                      <option value="AED">{t('aed')}</option>
                      <option value="KWD">{t('kwd')}</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleSaveLocalizationSettings}
                  disabled={saving}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? t('saving') : t('save')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </TenantLayout>
  );
}

