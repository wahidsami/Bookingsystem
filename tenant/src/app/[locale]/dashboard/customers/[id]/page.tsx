"use client";

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getImageUrl, tenantApi } from '@/lib/api';
import { TenantLayout } from '@/components/TenantLayout';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PhoneIcon,
  EnvelopeIcon,
  CalendarIcon,
  ClockIcon,
  TagIcon,
  DocumentTextIcon,
  StarIcon,
  UserIcon,
  HeartIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { Currency } from '@/components/Currency';

interface CustomerDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  profileImage: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  preferredLanguage: string;
  createdAt: string;
  // Stats
  totalBookings: number;
  totalOrders?: number;
  totalProductsPurchased?: number;
  completedBookings: number;
  totalSpent: number;
  averageBookingValue: number;
  // Dates
  firstVisit: string | null;
  lastVisit: string | null;
  // Behavior
  noShowCount: number;
  cancellationCount: number;
  // Preferences
  favoriteServices: { name: string; count: number }[];
  favoriteProducts?: { name: string; count: number }[];
  preferredStaff: { name: string; count: number }[];
  preferredTime: string;
  preferredDeliveryType?: string;
  // Loyalty
  loyaltyTier: string;
  loyaltyPoints: number;
  walletBalance?: number;
  // Custom
  tags: string[];
  notes: string;
  customerType?: 'service_only' | 'product_only' | 'both' | 'walk_in';
  walletSummary?: {
    currentBalance: number;
    walletLedgerCount: number;
    sentGiftCardCount: number;
    receivedGiftCardCount: number;
  };
  walletLedgerEntries?: {
    id: string;
    type: string;
    direction: 'credit' | 'debit';
    amount: number;
    currency: string;
    balanceBefore: number;
    balanceAfter: number;
    referenceType?: string | null;
    referenceId?: string | null;
    metadata?: Record<string, any>;
    createdAt: string;
  }[];
  giftCardTransactions?: {
    id: string;
    packageTitle: string;
    purchaseAmount: number;
    creditAmount: number;
    bonusAmount: number;
    totalCreditAmount: number;
    status: string;
    deliveryChannel: string;
    senderPlatformUserId?: string | null;
    recipientPlatformUserId?: string | null;
    recipientEmail?: string | null;
    recipientPhone?: string | null;
    deliveryMode?: string | null;
    createdAt: string;
    claimedAt?: string | null;
  }[];
  // Recent
  recentAppointments: any[];
  recentOrders?: any[];
  // All history
  allAppointments?: any[];
  allOrders?: any[];
}

export default function CustomerDetailPage() {
  const t = useTranslations('Customers');
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const isRTL = locale === 'ar';
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    gender: '',
    dateOfBirth: '',
    preferredLanguage: 'en'
  });
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [historyTab, setHistoryTab] = useState<'all' | 'appointments' | 'purchases'>('all');
  const [historyFilter, setHistoryFilter] = useState<string>('all'); // 'all', 'pending', 'completed', 'cancelled', 'paid', 'unpaid'

  const loadCustomer = async () => {
    try {
      setLoading(true);
      const response = await tenantApi.getCustomer(customerId);
      if (response.success) {
        setCustomer(response.data);
        setProfileDraft({
          firstName: response.data.firstName || '',
          lastName: response.data.lastName || '',
          email: response.data.email || '',
          phone: response.data.phone || '',
          gender: response.data.gender || '',
          dateOfBirth: response.data.dateOfBirth || '',
          preferredLanguage: response.data.preferredLanguage || 'en'
        });
        setNotes(response.data.notes || '');
        setTags(response.data.tags || []);
      }
    } catch (err: any) {
      console.error('Failed to load customer:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customerId) {
      loadCustomer();
    }
  }, [customerId]);

  const handleSaveNotes = async () => {
    try {
      setSaving(true);
      await tenantApi.updateCustomerNotes(customerId, { notes, tags });
      setEditingNotes(false);
    } catch (err) {
      console.error('Failed to save notes:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      const response = await tenantApi.updateCustomerProfile(customerId, {
        firstName: profileDraft.firstName.trim(),
        lastName: profileDraft.lastName.trim(),
        email: profileDraft.email.trim(),
        phone: profileDraft.phone.trim(),
        gender: profileDraft.gender || null,
        dateOfBirth: profileDraft.dateOfBirth || null,
        preferredLanguage: profileDraft.preferredLanguage || 'en'
      });
      if (response.success) {
        setEditingProfile(false);
        await loadCustomer();
      }
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const getLoyaltyColor = (tier: string) => {
    switch (tier) {
      case 'platinum': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'gold': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'silver': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-amber-100 text-amber-800 border-amber-200';
    }
  };

  const isWalkInCustomer = (firstName: string, lastName: string) => {
    const normalizedFirst = `${firstName || ''}`.trim().toLowerCase();
    const normalizedLast = `${lastName || ''}`.trim();
    return (normalizedFirst === 'customer' || normalizedFirst === 'عميل') && /^\d{3}$/.test(normalizedLast);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'no_show': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatMoney = (amount?: number | null) => {
    const value = Number(amount || 0);
    return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: 'SAR',
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <TenantLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </TenantLayout>
    );
  }

  if (error || !customer) {
    return (
      <TenantLayout>
        <div className="flex flex-col items-center justify-center h-64">
          <p className="text-red-500 mb-4">{error || t('customerNotFound')}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            {t('goBack')}
          </button>
        </div>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout>
      <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div className="flex items-center gap-4" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50"
          >
            {isRTL ? <ArrowRightIcon className="w-5 h-5" /> : <ArrowLeftIcon className="w-5 h-5" />}
          </button>
          <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
            <div className="flex items-center gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <h1 className="text-2xl font-bold text-gray-900">
                {customer.firstName} {customer.lastName}
              </h1>
              {isWalkInCustomer(customer.firstName, customer.lastName) && (
                <span className="inline-flex px-2 py-1 text-[10px] font-semibold uppercase tracking-wide rounded-full bg-amber-100 text-amber-800">
                  {locale === 'ar' ? 'عميل حضوري' : 'Walk-in'}
                </span>
              )}
            </div>
            <p className="text-gray-500">{t('customerDetails')}</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Customer Info & Notes */}
          <div className="space-y-6">
            {/* Profile Card */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-3 mb-4" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {t('profile') || 'Profile'}
                  </p>
                  <h3 className="text-lg font-semibold text-gray-900 mt-1">
                    {editingProfile ? (t('editProfile') || 'Edit profile') : (t('customerOverview') || 'Customer overview')}
                  </h3>
                </div>
                {!editingProfile && (
                  <button
                    onClick={() => setEditingProfile(true)}
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    {t('edit') || 'Edit'}
                  </button>
                )}
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-primary-100 flex items-center justify-center mb-4 relative overflow-hidden">
                  {customer.profileImage ? (
                    <>
                      <img
                        src={customer.profileImage.startsWith('http') ? customer.profileImage : getImageUrl(customer.profileImage)}
                        alt={`${customer.firstName} ${customer.lastName}`}
                        className="w-24 h-24 rounded-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                      <div className="w-24 h-24 rounded-full bg-primary-100 items-center justify-center hidden">
                        <span className="text-primary-600 font-semibold text-2xl">
                          {customer.firstName.charAt(0)}{customer.lastName.charAt(0)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <span className="text-primary-600 font-semibold text-2xl">
                      {customer.firstName.charAt(0)}{customer.lastName.charAt(0)}
                    </span>
                  )}
                </div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-900">
                      {customer.firstName} {customer.lastName}
                    </h2>
                    {isWalkInCustomer(customer.firstName, customer.lastName) && (
                      <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-full bg-amber-100 text-amber-800">
                        {locale === 'ar' ? 'عميل حضوري' : 'Walk-in'}
                      </span>
                    )}
                  </div>
                <div className="mt-2 flex flex-col items-center gap-2">
                  <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getLoyaltyColor(customer.loyaltyTier)}`}>
                    {t(customer.loyaltyTier)} • {customer.loyaltyPoints} {t('points')}
                  </span>
                  {customer.customerType && (
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${customer.customerType === 'both' ? 'bg-blue-100 text-blue-800' :
                        customer.customerType === 'service_only' ? 'bg-purple-100 text-purple-800' :
                          'bg-green-100 text-green-800'
                      }`}>
                      {customer.customerType === 'both' && '📅🛍️ ' + (t('both') || 'Both')}
                      {customer.customerType === 'service_only' && '📅 ' + (t('servicesOnly') || 'Services Only')}
                      {customer.customerType === 'product_only' && '🛍️ ' + (t('productsOnly') || 'Products Only')}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-6 space-y-4 border-t border-gray-200 pt-6">
                {editingProfile ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={profileDraft.firstName}
                        onChange={(e) => setProfileDraft({ ...profileDraft, firstName: e.target.value })}
                        placeholder={t('firstName') || 'First name'}
                        className="w-full p-3 border border-gray-300 rounded-lg"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                      />
                      <input
                        type="text"
                        value={profileDraft.lastName}
                        onChange={(e) => setProfileDraft({ ...profileDraft, lastName: e.target.value })}
                        placeholder={t('lastName') || 'Last name'}
                        className="w-full p-3 border border-gray-300 rounded-lg"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                      />
                      <input
                        type="email"
                        value={profileDraft.email}
                        onChange={(e) => setProfileDraft({ ...profileDraft, email: e.target.value })}
                        placeholder={t('email') || 'Email'}
                        className="w-full p-3 border border-gray-300 rounded-lg"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                      />
                      <input
                        type="tel"
                        value={profileDraft.phone}
                        onChange={(e) => setProfileDraft({ ...profileDraft, phone: e.target.value })}
                        placeholder={t('phone') || 'Mobile'}
                        className="w-full p-3 border border-gray-300 rounded-lg"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                      />
                      <input
                        type="date"
                        value={profileDraft.dateOfBirth}
                        onChange={(e) => setProfileDraft({ ...profileDraft, dateOfBirth: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-lg"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                      />
                      <select
                        value={profileDraft.gender}
                        onChange={(e) => setProfileDraft({ ...profileDraft, gender: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-lg bg-white"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                      >
                        <option value="">{t('gender') || 'Gender'}</option>
                        <option value="male">{t('male') || 'Male'}</option>
                        <option value="female">{t('female') || 'Female'}</option>
                        <option value="other">{t('other') || 'Other'}</option>
                      </select>
                      <input
                        type="text"
                        value={profileDraft.preferredLanguage}
                        onChange={(e) => setProfileDraft({ ...profileDraft, preferredLanguage: e.target.value })}
                        placeholder={t('preferredLanguage') || 'Preferred language'}
                        className="w-full p-3 border border-gray-300 rounded-lg"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                      />
                    </div>
                    <div className="flex gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <button
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                      >
                        {saving ? (t('saving') || 'Saving...') : (t('save') || 'Save')}
                      </button>
                      <button
                        onClick={() => {
                          setEditingProfile(false);
                          setProfileDraft({
                            firstName: customer.firstName || '',
                            lastName: customer.lastName || '',
                            email: customer.email || '',
                            phone: customer.phone || '',
                            gender: customer.gender || '',
                            dateOfBirth: customer.dateOfBirth || '',
                            preferredLanguage: customer.preferredLanguage || 'en'
                          });
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        {t('cancel') || 'Cancel'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customer.email && (
                      <div className="flex items-center gap-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                        <EnvelopeIcon className="w-5 h-5 text-gray-400" />
                        <span className="text-sm text-gray-600">{customer.email}</span>
                      </div>
                    )}
                    {customer.phone && (
                      <div className="flex items-center gap-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                        <PhoneIcon className="w-5 h-5 text-gray-400" />
                        <span className="text-sm text-gray-600">{customer.phone}</span>
                      </div>
                    )}
                    {customer.gender && (
                      <div className="flex items-center gap-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                        <UserIcon className="w-5 h-5 text-gray-400" />
                        <span className="text-sm text-gray-600 capitalize">{customer.gender}</span>
                      </div>
                    )}
                    {customer.dateOfBirth && (
                      <div className="flex items-center gap-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                        <CalendarIcon className="w-5 h-5 text-gray-400" />
                        <span className="text-sm text-gray-600">{formatDate(customer.dateOfBirth)}</span>
                      </div>
                    )}
                    {customer.preferredLanguage && (
                      <div className="flex items-center gap-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                        <ClockIcon className="w-5 h-5 text-gray-400" />
                        <span className="text-sm text-gray-600">{customer.preferredLanguage.toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Notes & Tags */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <h3 className="text-lg font-semibold text-gray-900">{t('notesAndTags') || 'Notes & Tags'}</h3>
                {!editingNotes && (
                  <button
                    onClick={() => setEditingNotes(true)}
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    {t('edit') || 'Edit'}
                  </button>
                )}
              </div>

              {editingNotes ? (
                <div className="space-y-4">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('addNotes') || 'Add notes about this customer...'}
                    className="w-full p-3 border border-gray-300 rounded-lg resize-none"
                    rows={4}
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                  />
                  <div className="flex gap-2 flex-wrap" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm"
                      >
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-primary-900"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                      placeholder={t('addTag') || 'Add tag...'}
                      className="flex-1 p-2 border border-gray-300 rounded-lg"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    />
                    <button
                      onClick={handleAddTag}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                      {t('add') || 'Add'}
                    </button>
                  </div>
                  <div className="flex gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <button
                      onClick={handleSaveNotes}
                      disabled={saving}
                      className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                    >
                      {saving ? t('saving') || 'Saving...' : t('save') || 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingNotes(false);
                        setNotes(customer.notes || '');
                        setTags(customer.tags || []);
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      {t('cancel') || 'Cancel'}
                    </button>
                  </div>
                </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-gray-600 text-sm whitespace-pre-wrap" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {notes || t('noNotes') || 'No notes yet.'}
                    </p>
                  {tags.length > 0 && (
                    <div className="flex gap-2 flex-wrap" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm"
                        >
                          <TagIcon className="w-3 h-3" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Wallet & Gifts */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <h3 className="text-lg font-semibold text-gray-900" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {t('wallet') || 'Wallet'}
                </h3>
                <Link
                  href={`/${locale}/dashboard/customers/${customer.id}/wallet`}
                  className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition"
                >
                  {t('liveBalance') || 'Live balance'}
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Link
                  href={`/${locale}/dashboard/customers/${customer.id}/wallet`}
                  className="rounded-2xl bg-emerald-50 p-4 border border-emerald-100 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    {t('currentBalance') || 'Current balance'}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-emerald-700">
                    {formatMoney(customer.walletBalance ?? customer.walletSummary?.currentBalance ?? 0)}
                  </p>
                </Link>
                <div className="rounded-2xl bg-blue-50 p-4 border border-blue-100">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                    {t('walletLedger') || 'Wallet entries'}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-blue-700">
                    {customer.walletSummary?.walletLedgerCount || customer.walletLedgerEntries?.length || 0}
                  </p>
                </div>
                <div className="rounded-2xl bg-purple-50 p-4 border border-purple-100">
                  <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
                    {t('giftCardsSent') || 'Gift cards sent'}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-purple-700">
                    {customer.walletSummary?.sentGiftCardCount || 0}
                  </p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-4 border border-amber-100">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    {t('giftCardsReceived') || 'Gift cards received'}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-amber-700">
                    {customer.walletSummary?.receivedGiftCardCount || 0}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <Link
                  href={`/${locale}/dashboard/customers/${customer.id}/wallet`}
                  className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                >
                  {locale === 'ar' ? 'فتح سجل المحفظة' : 'Open wallet history'}
                </Link>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t('walletHistory') || 'Wallet history'}
                  </h4>
                  {customer.walletLedgerEntries && customer.walletLedgerEntries.length > 0 ? (
                    <div className="space-y-2">
                      {customer.walletLedgerEntries.slice(0, 5).map((entry) => (
                        <div key={entry.id} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 flex items-center justify-between gap-3">
                          <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                            <p className="text-sm font-semibold text-gray-900">
                              {entry.type.split('_').join(' ')}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(entry.createdAt).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                          <div className={`text-sm font-bold ${entry.direction === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {entry.direction === 'credit' ? '+' : '-'}{formatMoney(entry.amount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      {t('noWalletHistory') || 'No wallet history yet.'}
                    </p>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    {t('giftCardHistory') || 'Gift card history'}
                  </h4>
                  {customer.giftCardTransactions && customer.giftCardTransactions.length > 0 ? (
                    <div className="space-y-2">
                      {customer.giftCardTransactions.slice(0, 5).map((tx) => {
                        const isSent = tx.senderPlatformUserId === customerId;
                        return (
                          <div key={tx.id} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 flex items-center justify-between gap-3">
                            <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                              <p className="text-sm font-semibold text-gray-900">
                                {tx.packageTitle}
                              </p>
                              <p className="text-xs text-gray-500">
                                {isSent ? (t('sent') || 'Sent') : (t('received') || 'Received')}
                                {' • '}
                                {new Date(tx.createdAt).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-gray-900">
                                {formatMoney(tx.totalCreditAmount)}
                              </div>
                              <div className="text-xs text-gray-500">{tx.status}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      {t('noGiftCardsYet') || 'No gift cards yet.'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Statistics & Preferences */}
          <div className="lg:col-span-2 space-y-6">
            {/* Statistics */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t('statistics') || 'Statistics'}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{customer.totalBookings}</p>
                  <p className="text-sm text-gray-600 mt-1">{t('totalBookings') || 'Total Bookings'}</p>
                </div>
                {customer.totalOrders !== undefined && (
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{customer.totalOrders}</p>
                    <p className="text-sm text-gray-600 mt-1">{t('totalOrders') || 'Total Orders'}</p>
                  </div>
                )}
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">
                    <Currency amount={customer.totalSpent} />
                  </p>
                  <p className="text-sm text-gray-600 mt-1">{t('totalSpent') || 'Total Spent'}</p>
                </div>
                <div className="text-center p-4 bg-amber-50 rounded-lg">
                  <p className="text-2xl font-bold text-amber-600">{customer.completedBookings}</p>
                  <p className="text-sm text-gray-600 mt-1">{t('completed') || 'Completed'}</p>
                </div>
              </div>
            </div>

            {/* Preferences */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t('preferences') || 'Preferences'}
              </h3>
              <div className="space-y-4">
                {/* Favorite Services */}
                {customer.favoriteServices && customer.favoriteServices.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>{t('favoriteServices') || 'Favorite Services'}</p>
                    <div className="flex flex-wrap gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      {customer.favoriteServices.slice(0, 5).map((service, idx) => (
                        <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                          {service.name} ({service.count})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Favorite Products */}
                {customer.favoriteProducts && customer.favoriteProducts.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>{t('favoriteProducts') || 'Favorite Products'}</p>
                    <div className="flex flex-wrap gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      {customer.favoriteProducts.slice(0, 5).map((product, idx) => (
                        <span key={idx} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                          {product.name} ({product.count})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preferred Staff */}
                {customer.preferredStaff && customer.preferredStaff.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>{t('preferredStaff') || 'Preferred Staff'}</p>
                    <div className="flex flex-wrap gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      {customer.preferredStaff.slice(0, 3).map((staff, idx) => (
                        <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                          {staff.name} ({staff.count})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preferred Delivery Type */}
                {customer.preferredDeliveryType && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2" style={{ textAlign: isRTL ? 'right' : 'left' }}>{t('preferredDelivery') || 'Preferred Delivery'}</p>
                    <div className="flex items-center gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <span className="text-gray-700">
                        {customer.preferredDeliveryType === 'pickup' ? '🏪 ' + t('pickup') : '🚚 ' + t('delivery')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Complete History Section */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          {/* Header with Tabs */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row', textAlign: isRTL ? 'right' : 'left' }}>
              <CalendarIcon className="w-5 h-5" />
              {t('completeHistory') || 'Complete History'}
            </h3>

            {/* Tab Navigation */}
            <div className="flex gap-2 mb-4 border-b border-gray-200" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <button
                onClick={() => setHistoryTab('all')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${historyTab === 'all'
                    ? 'border-b-2 border-primary-500 text-primary-600'
                    : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                {t('all') || 'All'} ({((customer.allAppointments || customer.recentAppointments || []).length + (customer.allOrders || customer.recentOrders || []).length)})
              </button>
              {(customer.allAppointments || customer.recentAppointments || []).length > 0 && (
                <button
                  onClick={() => setHistoryTab('appointments')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${historyTab === 'appointments'
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  📅 {t('appointments') || 'Appointments'} ({(customer.allAppointments || customer.recentAppointments || []).length})
                </button>
              )}
              {/* Always show Purchases tab */}
              <button
                onClick={() => setHistoryTab('purchases')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${historyTab === 'purchases'
                    ? 'border-b-2 border-green-500 text-green-600'
                    : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                🛍️ {t('purchases') || 'Purchases'} ({(customer.allOrders || customer.recentOrders || []).length})
              </button>
            </div>

            {/* Status Filter */}
            <div className="flex gap-2 flex-wrap mb-4" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <button
                onClick={() => setHistoryFilter('all')}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${historyFilter === 'all'
                    ? 'bg-primary-100 text-primary-700 border border-primary-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                {t('all') || 'All'}
              </button>
              <button
                onClick={() => setHistoryFilter('completed')}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${historyFilter === 'completed'
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                ✓ {t('completed') || 'Completed'}
              </button>
              <button
                onClick={() => setHistoryFilter('pending')}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${historyFilter === 'pending'
                    ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                ⏳ {t('pending') || 'Pending'}
              </button>
              <button
                onClick={() => setHistoryFilter('cancelled')}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${historyFilter === 'cancelled'
                    ? 'bg-red-100 text-red-700 border border-red-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                ✗ {t('cancelled') || 'Cancelled'}
              </button>
            </div>
          </div>

          {/* History Content */}
          {(() => {
            let allItems: any[] = [];

            if (historyTab === 'all' || historyTab === 'appointments') {
              const appointments = customer.allAppointments || customer.recentAppointments || [];
              allItems = [...allItems, ...appointments.map(a => ({ ...a, type: 'appointment', sortDate: a.date }))];
            }

            if (historyTab === 'all' || historyTab === 'purchases') {
              const orders = customer.allOrders || customer.recentOrders || [];
              allItems = [...allItems, ...orders.map(o => ({ ...o, type: 'order', sortDate: o.date }))];
            }

            // Apply status filter
            if (historyFilter !== 'all') {
              allItems = allItems.filter(item => {
                if (historyFilter === 'completed') {
                  return item.status === 'completed' || item.status === 'delivered';
                } else if (historyFilter === 'pending') {
                  return item.status === 'pending' || item.status === 'confirmed' || item.status === 'processing';
                } else if (historyFilter === 'cancelled') {
                  return item.status === 'cancelled' || item.status === 'refunded';
                }
                return true;
              });
            }

            // Sort by date (most recent first)
            allItems.sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());

            if (allItems.length === 0) {
              // Show specific message based on selected tab
              let emptyMessage = t('noHistory') || 'No history found';
              let emptyIcon = <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />;

              if (historyTab === 'purchases') {
                emptyMessage = t('noPurchasesYet') || 'No purchases yet';
                emptyIcon = <span className="text-6xl mb-4">🛍️</span>;
              } else if (historyTab === 'appointments') {
                emptyMessage = t('noAppointments') || 'No appointments yet';
                emptyIcon = <span className="text-6xl mb-4">📅</span>;
              }

              return (
                <div className="text-center py-12">
                  {emptyIcon}
                  <p className="text-gray-400">{emptyMessage}</p>
                </div>
              );
            }

            return (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {allItems.map((item) => (
                  item.type === 'appointment' ? (
                    <div
                      key={`appt-${item.id}`}
                      className="p-4 border-l-4 border-blue-500 bg-gradient-to-r from-blue-50 to-white rounded-lg hover:shadow-md transition-all cursor-pointer group"
                      onClick={() => router.push(`/${locale}/dashboard/appointments/${item.id}`)}
                    >
                      <div className="flex justify-between items-start mb-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                        <div className="flex-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                          <div className="flex items-center gap-2 mb-1" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                            <span className="text-xl">📅</span>
                            <p className="font-semibold text-gray-900">
                              {locale === 'ar' ? item.service?.name_ar : item.service?.name_en}
                            </p>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                            {item.staff && (
                              <div className="flex items-center gap-1" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                                <UserIcon className="w-4 h-4" />
                                <span>{item.staff.name}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                              <ClockIcon className="w-4 h-4" />
                              <span>{formatDateTime(item.date)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2" style={{ flexDirection: isRTL ? 'row' : 'row-reverse' }}>
                          <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(item.status)}`}>
                            {t(item.status)}
                          </span>
                          <Currency amount={item.price} className="font-bold text-lg text-blue-600" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={`order-${item.id}`}
                      className="p-4 border-l-4 border-green-500 bg-gradient-to-r from-green-50 to-white rounded-lg hover:shadow-md transition-all cursor-pointer group"
                      onClick={() => {
                        alert(`Order details for ${item.orderNumber} - Coming soon!`);
                      }}
                    >
                      <div className="flex justify-between items-start mb-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                        <div className="flex-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                          <div className="flex items-center gap-2 mb-1" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                            <span className="text-xl">🛍️</span>
                            <p className="font-semibold text-gray-900">
                              {t('order') || 'Order'} #{item.orderNumber}
                            </p>
                          </div>
                          {item.items && item.items.length > 0 && (
                            <div className="mt-2">
                              <p className="text-sm text-gray-600 mb-1">
                                {item.items.length} {item.items.length === 1 ? t('item') : t('items')}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {item.items.slice(0, 3).map((orderItem: any, idx: number) => (
                                  <span key={idx} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                    {orderItem.productName || orderItem.product?.name_en || 'Product'} × {orderItem.quantity}
                                  </span>
                                ))}
                                {item.items.length > 3 && (
                                  <span className="text-xs text-gray-500">+{item.items.length - 3} more</span>
                                )}
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                            <div className="flex items-center gap-1" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                              <ClockIcon className="w-4 h-4" />
                              <span>{formatDateTime(item.date)}</span>
                            </div>
                            {item.deliveryType && (
                              <div className="flex items-center gap-1" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                                <span>{item.deliveryType === 'pickup' ? '🏪' : '🚚'}</span>
                                <span>{item.deliveryType === 'pickup' ? t('pickup') : t('delivery')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2" style={{ flexDirection: isRTL ? 'row' : 'row-reverse' }}>
                          <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(item.status)}`}>
                            {t(item.status)}
                          </span>
                          <Currency amount={item.totalAmount} className="font-bold text-lg text-green-600" />
                        </div>
                      </div>
                    </div>
                  )
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    </TenantLayout>
  );
}
