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

  useEffect(() => {
    const handleWalletUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        customerId?: string;
        walletBalance?: number;
        totalSpent?: number;
      }>;

      if (!customEvent.detail || customEvent.detail.customerId !== customerId) {
        return;
      }

      setCustomer((current) => {
        if (!current) return current;

        const nextWalletBalance = Number.isFinite(Number(customEvent.detail.walletBalance))
          ? Number(customEvent.detail.walletBalance)
          : Number(current.walletBalance ?? current.walletSummary?.currentBalance ?? 0);
        const nextTotalSpent = Number.isFinite(Number(customEvent.detail.totalSpent))
          ? Number(customEvent.detail.totalSpent)
          : Number(current.totalSpent || 0);

        return {
          ...current,
          walletBalance: nextWalletBalance,
          totalSpent: nextTotalSpent,
          walletSummary: current.walletSummary
            ? {
                ...current.walletSummary,
                currentBalance: nextWalletBalance
              }
            : current.walletSummary
        };
      });
    };

    window.addEventListener('rifah:customer-wallet-updated', handleWalletUpdate as EventListener);
    return () => {
      window.removeEventListener('rifah:customer-wallet-updated', handleWalletUpdate as EventListener);
    };
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
        <div className="flex min-h-[60vh] items-center justify-center bg-slate-50/60 px-4">
          <div className="rounded-[2rem] border border-slate-200 bg-white px-8 py-7 shadow-xl shadow-slate-950/5">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
            <p className="mt-4 text-sm font-medium text-slate-600">
              {locale === 'ar' ? 'جارٍ تحميل ملف العميل...' : 'Loading customer profile...'}
            </p>
          </div>
        </div>
      </TenantLayout>
    );
  }

  if (error || !customer) {
    return (
      <TenantLayout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
          <p className="mb-4 text-rose-600">{error || t('customerNotFound')}</p>
          <button
            onClick={() => router.back()}
            className="rounded-2xl bg-primary px-4 py-2 text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90"
          >
            {t('goBack')}
          </button>
        </div>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout>
      <div className="relative space-y-8 pb-8" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[260px] bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.10),_transparent_30%),linear-gradient(180deg,_rgba(15,23,42,0.02),_transparent_60%)]" />

        <section className="card overflow-hidden border border-slate-200/80 bg-slate-950 text-white shadow-2xl shadow-slate-950/10">
          <div className="grid gap-6 p-6 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">{t('profile') || 'Profile'}</p>
              <h1 className="text-4xl font-black tracking-tight" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {customer.firstName} {customer.lastName}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-300" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                {t('customerDetails')}
              </p>
              <div className="flex flex-wrap gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                {isWalkInCustomer(customer.firstName, customer.lastName) && (
                  <span className="badge badge-warning">Walk-in</span>
                )}
                <span className="badge badge-info">{t(customer.loyaltyTier)} • {customer.loyaltyPoints} {t('points')}</span>
                {customer.customerType && (
                  <span className="badge badge-success">
                    {customer.customerType === 'both' && (t('both') || 'Both')}
                    {customer.customerType === 'service_only' && (t('servicesOnly') || 'Services Only')}
                    {customer.customerType === 'product_only' && (t('productsOnly') || 'Products Only')}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <button onClick={() => router.back()} className="btn-secondary inline-flex items-center gap-2">
                {isRTL ? <ArrowRightIcon className="h-4 w-4" /> : <ArrowLeftIcon className="h-4 w-4" />}
                {t('goBack') || 'Back'}
              </button>
              <button onClick={() => setEditingProfile(true)} className="btn-primary inline-flex items-center gap-2">
                {t('edit') || 'Edit'}
              </button>
              <Link href={`/${locale}/dashboard/customers/${customer.id}/wallet`} className="btn-secondary inline-flex items-center gap-2">
                {t('wallet') || 'Wallet'}
              </Link>
            </div>
          </div>
        </section>

        {isWalkInCustomer(customer.firstName, customer.lastName) && (
          <div className="card border-amber-200 bg-amber-50 px-5 py-4 text-amber-900">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold">{locale === 'ar' ? 'هذا سجل عميل حضوري' : 'This is a walk-in customer record'}</p>
                <p className="mt-1 text-sm leading-6 text-amber-800">
                  {locale === 'ar'
                    ? 'يمكنك تعديل الاسم والبريد والهاتف وتاريخ الميلاد والجنس واللغة المفضلة من بطاقة الملف.'
                    : 'You can update the name, email, phone, date of birth, gender, and preferred language from the profile card.'}
                </p>
              </div>
              <button onClick={() => setEditingProfile(true)} className="btn-primary">
                {locale === 'ar' ? 'تعديل الآن' : 'Edit now'}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="space-y-6">
            <section className="card border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-950/5">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t('profile') || 'Profile'}</p>
                  <h3 className="mt-2 text-2xl font-bold text-slate-950">
                    {editingProfile ? (t('editProfile') || 'Edit profile') : (t('customerOverview') || 'Customer overview')}
                  </h3>
                </div>
                {!editingProfile && <button onClick={() => setEditingProfile(true)} className="btn-secondary text-sm">{t('edit') || 'Edit'}</button>}
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="relative mb-4 flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-primary/10 ring-4 ring-primary/10">
                  {customer.profileImage ? (
                    <img
                      src={customer.profileImage.startsWith('http') ? customer.profileImage : getImageUrl(customer.profileImage)}
                      alt={`${customer.firstName} ${customer.lastName}`}
                      className="h-28 w-28 rounded-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <span className={`absolute inset-0 hidden items-center justify-center text-3xl font-bold text-primary ${customer.profileImage ? '' : 'flex'}`}>
                    {customer.firstName.charAt(0)}{customer.lastName.charAt(0)}
                  </span>
                </div>

                <div className="flex items-center gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <h2 className="text-2xl font-black text-slate-950">{customer.firstName} {customer.lastName}</h2>
                  {isWalkInCustomer(customer.firstName, customer.lastName) && <span className="badge badge-warning">Walk-in</span>}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <button onClick={() => setEditingProfile(true)} className="btn-primary">{t('profile') || 'Profile'}</button>
                  <Link href={`/${locale}/dashboard/customers/${customer.id}/wallet`} className="btn-secondary">{t('wallet') || 'Wallet'}</Link>
                </div>

                <div className="mt-5 grid w-full grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{locale === 'ar' ? 'الانضمام' : 'Joined'}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">{formatDate(customer.createdAt)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{locale === 'ar' ? 'آخر زيارة' : 'Last visit'}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">{formatDate(customer.lastVisit)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{locale === 'ar' ? 'الحجوزات' : 'Bookings'}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">{customer.totalBookings}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{locale === 'ar' ? 'اللغة' : 'Language'}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">{customer.preferredLanguage ? customer.preferredLanguage.toUpperCase() : '-'}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-slate-200 pt-6">
                {editingProfile ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input type="text" value={profileDraft.firstName} onChange={(e) => setProfileDraft({ ...profileDraft, firstName: e.target.value })} placeholder={t('firstName') || 'First name'} className="input" style={{ textAlign: isRTL ? 'right' : 'left' }} />
                      <input type="text" value={profileDraft.lastName} onChange={(e) => setProfileDraft({ ...profileDraft, lastName: e.target.value })} placeholder={t('lastName') || 'Last name'} className="input" style={{ textAlign: isRTL ? 'right' : 'left' }} />
                      <input type="email" value={profileDraft.email} onChange={(e) => setProfileDraft({ ...profileDraft, email: e.target.value })} placeholder={t('email') || 'Email'} className="input" style={{ textAlign: isRTL ? 'right' : 'left' }} />
                      <input type="tel" value={profileDraft.phone} onChange={(e) => setProfileDraft({ ...profileDraft, phone: e.target.value })} placeholder={t('phone') || 'Mobile'} className="input" style={{ textAlign: isRTL ? 'right' : 'left' }} />
                      <input type="date" value={profileDraft.dateOfBirth} onChange={(e) => setProfileDraft({ ...profileDraft, dateOfBirth: e.target.value })} className="input" style={{ textAlign: isRTL ? 'right' : 'left' }} />
                      <select value={profileDraft.gender} onChange={(e) => setProfileDraft({ ...profileDraft, gender: e.target.value })} className="input bg-white" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        <option value="">{t('gender') || 'Gender'}</option>
                        <option value="male">{t('male') || 'Male'}</option>
                        <option value="female">{t('female') || 'Female'}</option>
                        <option value="other">{t('other') || 'Other'}</option>
                      </select>
                      <input type="text" value={profileDraft.preferredLanguage} onChange={(e) => setProfileDraft({ ...profileDraft, preferredLanguage: e.target.value })} placeholder={t('preferredLanguage') || 'Preferred language'} className="input" style={{ textAlign: isRTL ? 'right' : 'left' }} />
                    </div>
                    <div className="flex gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <button onClick={handleSaveProfile} disabled={saving} className="btn-primary flex-1">{saving ? (t('saving') || 'Saving...') : (t('save') || 'Save')}</button>
                      <button onClick={() => {
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
                      }} className="btn-secondary">{t('cancel') || 'Cancel'}</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customer.email && (
                      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <EnvelopeIcon className="h-5 w-5 text-slate-400" />
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{locale === 'ar' ? 'البريد' : 'Email'}</p>
                          <span className="text-sm font-medium text-slate-800">{customer.email}</span>
                        </div>
                      </div>
                    )}
                    {customer.phone && (
                      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <PhoneIcon className="h-5 w-5 text-slate-400" />
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{locale === 'ar' ? 'الجوال' : 'Phone'}</p>
                          <span className="text-sm font-medium text-slate-800">{customer.phone}</span>
                        </div>
                      </div>
                    )}
                    {customer.gender && (
                      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <UserIcon className="h-5 w-5 text-slate-400" />
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{locale === 'ar' ? 'النوع' : 'Gender'}</p>
                          <span className="text-sm font-medium capitalize text-slate-800">{customer.gender}</span>
                        </div>
                      </div>
                    )}
                    {customer.dateOfBirth && (
                      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <CalendarIcon className="h-5 w-5 text-slate-400" />
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{locale === 'ar' ? 'تاريخ الميلاد' : 'Birth date'}</p>
                          <span className="text-sm font-medium text-slate-800">{formatDate(customer.dateOfBirth)}</span>
                        </div>
                      </div>
                    )}
                    {customer.preferredLanguage && (
                      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <ClockIcon className="h-5 w-5 text-slate-400" />
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{locale === 'ar' ? 'اللغة المفضلة' : 'Preferred language'}</p>
                          <span className="text-sm font-medium uppercase text-slate-800">{customer.preferredLanguage.toUpperCase()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            <section className="card border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-950/5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-slate-950">{t('notesAndTags') || 'Notes & Tags'}</h3>
                {!editingNotes && <button onClick={() => setEditingNotes(true)} className="text-sm font-medium text-primary">{t('edit') || 'Edit'}</button>}
              </div>

              {editingNotes ? (
                <div className="space-y-4">
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('addNotes') || 'Add notes about this customer...'} className="input min-h-32 resize-none" rows={4} style={{ textAlign: isRTL ? 'right' : 'left' }} />
                  <div className="flex flex-wrap gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    {tags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
                        {tag}
                        <button onClick={() => handleRemoveTag(tag)} className="hover:text-primary/80"><XMarkIcon className="h-4 w-4" /></button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <input type="text" value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAddTag()} placeholder={t('addTag') || 'Add tag...'} className="input flex-1" style={{ textAlign: isRTL ? 'right' : 'left' }} />
                    <button onClick={handleAddTag} className="btn-secondary">{t('add') || 'Add'}</button>
                  </div>
                  <div className="flex gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <button onClick={handleSaveNotes} disabled={saving} className="btn-primary flex-1">{saving ? t('saving') || 'Saving...' : t('save') || 'Save'}</button>
                    <button onClick={() => { setEditingNotes(false); setNotes(customer.notes || ''); setTags(customer.tags || []); }} className="btn-secondary">{t('cancel') || 'Cancel'}</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm leading-6 text-slate-600 whitespace-pre-wrap" style={{ textAlign: isRTL ? 'right' : 'left' }}>{notes || t('noNotes') || 'No notes yet.'}</p>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      {tags.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
                          <TagIcon className="h-3 w-3" />{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="card border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-950/5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-slate-950" style={{ textAlign: isRTL ? 'right' : 'left' }}>{t('wallet') || 'Wallet'}</h3>
                <Link href={`/${locale}/dashboard/customers/${customer.id}/wallet`} className="badge badge-success">{t('liveBalance') || 'Live balance'}</Link>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Link href={`/${locale}/dashboard/customers/${customer.id}/wallet`} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">{t('currentBalance') || 'Current balance'}</p>
                  <p className="mt-2 text-2xl font-black text-emerald-700">{formatMoney(customer.walletBalance ?? customer.walletSummary?.currentBalance ?? 0)}</p>
                </Link>
                <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">{t('walletLedger') || 'Wallet entries'}</p>
                  <p className="mt-2 text-2xl font-black text-cyan-700">{customer.walletSummary?.walletLedgerCount || customer.walletLedgerEntries?.length || 0}</p>
                </div>
                <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">{t('giftCardsSent') || 'Gift cards sent'}</p>
                  <p className="mt-2 text-2xl font-black text-violet-700">{customer.walletSummary?.sentGiftCardCount || 0}</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">{t('giftCardsReceived') || 'Gift cards received'}</p>
                  <p className="mt-2 text-2xl font-black text-amber-700">{customer.walletSummary?.receivedGiftCardCount || 0}</p>
                </div>
              </div>

              <div className="mt-4">
                <Link href={`/${locale}/dashboard/customers/${customer.id}/wallet`} className="btn-primary inline-flex items-center justify-center">{locale === 'ar' ? 'فتح سجل المحفظة' : 'Open wallet history'}</Link>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-slate-950" style={{ textAlign: isRTL ? 'right' : 'left' }}>{t('walletHistory') || 'Wallet history'}</h4>
                  {customer.walletLedgerEntries && customer.walletLedgerEntries.length > 0 ? (
                    <div className="space-y-2">
                      {customer.walletLedgerEntries.slice(0, 5).map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                            <p className="text-sm font-semibold text-slate-950">{entry.type.split('_').join(' ')}</p>
                            <p className="text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                          <div className={`text-sm font-bold ${entry.direction === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {entry.direction === 'credit' ? '+' : '-'}{formatMoney(entry.amount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">{t('noWalletHistory') || 'No wallet history yet.'}</p>
                  )}
                </div>

                <div>
                  <h4 className="mb-3 text-sm font-semibold text-slate-950" style={{ textAlign: isRTL ? 'right' : 'left' }}>{t('giftCardHistory') || 'Gift card history'}</h4>
                  {customer.giftCardTransactions && customer.giftCardTransactions.length > 0 ? (
                    <div className="space-y-2">
                      {customer.giftCardTransactions.slice(0, 5).map((tx) => {
                        const isSent = tx.senderPlatformUserId === customerId;
                        return (
                          <div key={tx.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                              <p className="text-sm font-semibold text-slate-950">{tx.packageTitle}</p>
                              <p className="text-xs text-slate-500">{isSent ? (t('sent') || 'Sent') : (t('received') || 'Received')} {' • '}{new Date(tx.createdAt).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-slate-950">{formatMoney(tx.totalCreditAmount)}</div>
                              <div className="text-xs text-slate-500">{tx.status}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">{t('noGiftCardsYet') || 'No gift cards yet.'}</p>
                  )}
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="card border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-950/5">
              <h3 className="mb-4 text-lg font-semibold text-slate-950" style={{ textAlign: isRTL ? 'right' : 'left' }}>{t('statistics') || 'Statistics'}</h3>
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-center">
                  <p className="text-3xl font-black text-cyan-600">{customer.totalBookings}</p>
                  <p className="mt-1 text-sm text-slate-600">{t('totalBookings') || 'Total Bookings'}</p>
                </div>
                {customer.totalOrders !== undefined && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                    <p className="text-3xl font-black text-emerald-600">{customer.totalOrders}</p>
                    <p className="mt-1 text-sm text-slate-600">{t('totalOrders') || 'Total Orders'}</p>
                  </div>
                )}
                <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-center">
                  <p className="text-2xl font-black text-violet-600"><Currency amount={customer.totalSpent} /></p>
                  <p className="mt-1 text-sm text-slate-600">{t('totalSpent') || 'Total Spent'}</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
                  <p className="text-3xl font-black text-amber-600">{customer.completedBookings}</p>
                  <p className="mt-1 text-sm text-slate-600">{t('completed') || 'Completed'}</p>
                </div>
              </div>
            </section>

            <section className="card border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-950/5">
              <h3 className="mb-4 text-lg font-semibold text-slate-950" style={{ textAlign: isRTL ? 'right' : 'left' }}>{t('preferences') || 'Preferences'}</h3>
              <div className="space-y-4">
                {customer.favoriteServices && customer.favoriteServices.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm text-slate-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>{t('favoriteServices') || 'Favorite Services'}</p>
                    <div className="flex flex-wrap gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      {customer.favoriteServices.slice(0, 5).map((service, idx) => (
                        <span key={idx} className="badge badge-info">{service.name} ({service.count})</span>
                      ))}
                    </div>
                  </div>
                )}

                {customer.favoriteProducts && customer.favoriteProducts.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm text-slate-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>{t('favoriteProducts') || 'Favorite Products'}</p>
                    <div className="flex flex-wrap gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      {customer.favoriteProducts.slice(0, 5).map((product, idx) => (
                        <span key={idx} className="badge badge-success">{product.name} ({product.count})</span>
                      ))}
                    </div>
                  </div>
                )}

                {customer.preferredStaff && customer.preferredStaff.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm text-slate-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>{t('preferredStaff') || 'Preferred Staff'}</p>
                    <div className="flex flex-wrap gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      {customer.preferredStaff.slice(0, 3).map((staff, idx) => (
                        <span key={idx} className="badge badge-secondary">{staff.name} ({staff.count})</span>
                      ))}
                    </div>
                  </div>
                )}

                {customer.preferredDeliveryType && (
                  <div>
                    <p className="mb-2 text-sm text-slate-500" style={{ textAlign: isRTL ? 'right' : 'left' }}>{t('preferredDelivery') || 'Preferred Delivery'}</p>
                    <div className="flex items-center gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <span className="text-slate-700">{customer.preferredDeliveryType === 'pickup' ? '🏪 ' + t('pickup') : '🚚 ' + t('delivery')}</span>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        <section className="card border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-950/5">
          <div className="mb-6">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-950" style={{ flexDirection: isRTL ? 'row-reverse' : 'row', textAlign: isRTL ? 'right' : 'left' }}>
              <CalendarIcon className="h-5 w-5" />
              {t('completeHistory') || 'Complete History'}
            </h3>

            <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <button onClick={() => setHistoryTab('all')} className={`rounded-t-2xl px-4 py-3 text-sm font-semibold transition ${historyTab === 'all' ? 'border-b-2 border-primary text-primary' : 'text-slate-500 hover:text-slate-700'}`}>
                {t('all') || 'All'} ({((customer.allAppointments || customer.recentAppointments || []).length + (customer.allOrders || customer.recentOrders || []).length)})
              </button>
              {(customer.allAppointments || customer.recentAppointments || []).length > 0 && (
                <button onClick={() => setHistoryTab('appointments')} className={`rounded-t-2xl px-4 py-3 text-sm font-semibold transition ${historyTab === 'appointments' ? 'border-b-2 border-cyan-500 text-cyan-600' : 'text-slate-500 hover:text-slate-700'}`}>
                  📅 {t('appointments') || 'Appointments'} ({(customer.allAppointments || customer.recentAppointments || []).length})
                </button>
              )}
              <button onClick={() => setHistoryTab('purchases')} className={`rounded-t-2xl px-4 py-3 text-sm font-semibold transition ${historyTab === 'purchases' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}>
                🛍️ {t('purchases') || 'Purchases'} ({(customer.allOrders || customer.recentOrders || []).length})
              </button>
            </div>

            <div className="flex flex-wrap gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <button onClick={() => setHistoryFilter('all')} className={`badge ${historyFilter === 'all' ? 'badge-info' : 'bg-slate-100 text-slate-600'}`}>{t('all') || 'All'}</button>
              <button onClick={() => setHistoryFilter('completed')} className={`badge ${historyFilter === 'completed' ? 'badge-success' : 'bg-slate-100 text-slate-600'}`}>✓ {t('completed') || 'Completed'}</button>
              <button onClick={() => setHistoryFilter('pending')} className={`badge ${historyFilter === 'pending' ? 'badge-warning' : 'bg-slate-100 text-slate-600'}`}>⏳ {t('pending') || 'Pending'}</button>
              <button onClick={() => setHistoryFilter('cancelled')} className={`badge ${historyFilter === 'cancelled' ? 'badge-error' : 'bg-slate-100 text-slate-600'}`}>✗ {t('cancelled') || 'Cancelled'}</button>
            </div>
          </div>

          {(() => {
            let allItems: any[] = [];

            if (historyTab === 'all' || historyTab === 'appointments') {
              const appointments = customer.allAppointments || customer.recentAppointments || [];
              allItems = [...allItems, ...appointments.map((a) => ({ ...a, type: 'appointment', sortDate: a.date }))];
            }

            if (historyTab === 'all' || historyTab === 'purchases') {
              const orders = customer.allOrders || customer.recentOrders || [];
              allItems = [...allItems, ...orders.map((o) => ({ ...o, type: 'order', sortDate: o.date }))];
            }

            if (historyFilter !== 'all') {
              allItems = allItems.filter((item) => {
                if (historyFilter === 'completed') return item.status === 'completed' || item.status === 'delivered';
                if (historyFilter === 'pending') return item.status === 'pending' || item.status === 'confirmed' || item.status === 'processing';
                if (historyFilter === 'cancelled') return item.status === 'cancelled' || item.status === 'refunded';
                return true;
              });
            }

            allItems.sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());

            if (allItems.length === 0) {
              let emptyMessage = t('noHistory') || 'No history found';
              let emptyIcon = <CalendarIcon className="mx-auto mb-4 h-16 w-16 text-slate-300" />;

              if (historyTab === 'purchases') {
                emptyMessage = t('noPurchasesYet') || 'No purchases yet';
                emptyIcon = <span className="mb-4 block text-6xl">🛍️</span>;
              } else if (historyTab === 'appointments') {
                emptyMessage = t('noAppointments') || 'No appointments yet';
                emptyIcon = <span className="mb-4 block text-6xl">📅</span>;
              }

              return (
                <div className="py-12 text-center">
                  {emptyIcon}
                  <p className="text-slate-400">{emptyMessage}</p>
                </div>
              );
            }

            return (
              <div className="max-h-[600px] space-y-3 overflow-y-auto pr-1">
                {allItems.map((item) => (
                  item.type === 'appointment' ? (
                    <div key={`appt-${item.id}`} className="cursor-pointer rounded-[1.5rem] border border-cyan-200 bg-gradient-to-r from-cyan-50 to-white p-4 transition hover:shadow-lg" onClick={() => router.push(`/${locale}/dashboard/appointments/${item.id}`)}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                          <div className="mb-1 flex items-center gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                            <span className="text-xl">📅</span>
                            <p className="font-semibold text-slate-950">{locale === 'ar' ? item.service?.name_ar : item.service?.name_en}</p>
                          </div>
                          <div className="mt-2 flex items-center gap-4 text-sm text-slate-600" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                            {item.staff && <div className="flex items-center gap-1"><UserIcon className="h-4 w-4" /><span>{item.staff.name}</span></div>}
                            <div className="flex items-center gap-1"><ClockIcon className="h-4 w-4" /><span>{formatDateTime(item.date)}</span></div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={`badge ${getStatusColor(item.status)}`}>{t(item.status)}</span>
                          <Currency amount={item.price} className="text-lg font-bold text-cyan-600" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div key={`order-${item.id}`} className="cursor-pointer rounded-[1.5rem] border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-4 transition hover:shadow-lg" onClick={() => { alert(`Order details for ${item.orderNumber} - Coming soon!`); }}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                          <div className="mb-1 flex items-center gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                            <span className="text-xl">🛍️</span>
                            <p className="font-semibold text-slate-950">{t('order') || 'Order'} #{item.orderNumber}</p>
                          </div>
                          {item.items && item.items.length > 0 && (
                            <div className="mt-2">
                              <p className="mb-1 text-sm text-slate-600">{item.items.length} {item.items.length === 1 ? t('item') : t('items')}</p>
                              <div className="flex flex-wrap gap-2">
                                {item.items.slice(0, 3).map((orderItem: any, idx: number) => (
                                  <span key={idx} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{orderItem.productName || orderItem.product?.name_en || 'Product'} × {orderItem.quantity}</span>
                                ))}
                                {item.items.length > 3 && <span className="text-xs text-slate-500">+{item.items.length - 3} more</span>}
                              </div>
                            </div>
                          )}
                          <div className="mt-2 flex items-center gap-4 text-sm text-slate-600">
                            <div className="flex items-center gap-1"><ClockIcon className="h-4 w-4" /><span>{formatDateTime(item.date)}</span></div>
                            {item.deliveryType && <div className="flex items-center gap-1"><span>{item.deliveryType === 'pickup' ? '🏪' : '🚚'}</span><span>{item.deliveryType === 'pickup' ? t('pickup') : t('delivery')}</span></div>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={`badge ${getStatusColor(item.status)}`}>{t(item.status)}</span>
                          <Currency amount={item.totalAmount} className="text-lg font-bold text-emerald-600" />
                        </div>
                      </div>
                    </div>
                  )
                ))}
              </div>
            );
          })()}
        </section>
      </div>
    </TenantLayout>
  );
}
