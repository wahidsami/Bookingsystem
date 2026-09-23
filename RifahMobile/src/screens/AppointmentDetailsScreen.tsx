import React, { useMemo, useState } from 'react';
import { Alert, Linking, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View, Image } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { Booking, SlotItem, bookingNeedsPayment, getBookingOutstandingAmount } from '../api/client';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenSafeArea } from '../utils/safeArea';
import { AppIcon } from '../components/AppIcon';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { formatRiyal } from '../utils/currency';
import { api } from '../api/client';
import { getImageUrl } from '../api/client';
import { CustomerSubpageHeader } from '../components/ui/CustomerSubpageHeader';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { parseGroupGuestFromNotes } from '../utils/groupGuest';

type BookingGroup = {
  key: string;
  bookingReference?: string | null;
  bookingSessionId?: string | null;
  tenant?: Booking['tenant'];
  items: Booking[];
  status: Booking['status'];
  startTime: string;
  totalPrice: number;
  payableNowTotal: number;
};

type AppointmentAuditEvent = {
  id: string;
  type: 'rescheduled' | 'cancelled';
  at: string;
  title: string;
  subtitle: string;
};

const extractAuditJsonEntries = (notes: string | null | undefined, marker: string): any[] => {
  const text = `${notes || ''}`;
  if (!text.includes(marker)) return [];
  const pattern = new RegExp(`\\${marker}\\s*(\\{.*\\})`, 'g');
  const entries: any[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && typeof parsed === 'object') entries.push(parsed);
    } catch {
      // ignore malformed entries
    }
  }
  return entries;
};

const formatTimelineDateTime = (value: string, language: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return language === 'ar' ? 'وقت غير متوفر' : 'Time unavailable';
  }
  return format(parsed, 'PPP p', { locale: language === 'ar' ? ar : enUS });
};

const getStatusText = (status: string, language?: string) => {
  if (language === 'ar') {
    switch (status) {
      case 'pending': return 'محجوز';
      case 'confirmed': return 'مؤكد';
      case 'checked_in': return 'تم الوصول';
      case 'in_service': return 'الخدمة جارية';
      case 'completed': return 'مكتمل';
      case 'cancelled': return 'ملغي';
      case 'no_show': return 'لم يحضر';
      default: return status;
    }
  }
  switch (status) {
    case 'pending': return 'Booked';
    case 'confirmed': return 'Confirmed';
    case 'checked_in': return 'Checked In';
    case 'in_service': return 'In Service';
    case 'completed': return 'Completed';
    case 'cancelled': return 'Cancelled';
    case 'no_show': return 'No Show';
    default: return status;
  }
};

const getStatusBgColor = (status: string) => {
  const s = String(status || '').toLowerCase();
  if (['confirmed', 'checked_in', 'checkedin'].includes(s)) return '#ECFDF5';
  if (['pending'].includes(s)) return '#FFFBEB';
  if (['in_service', 'inservice', 'completed'].includes(s)) return '#EFF6FF';
  if (['cancelled', 'no_show', 'noshow'].includes(s)) return '#FEF2F2';
  return '#F3F4F6';
};

const getStatusTextColor = (status: string) => {
  const s = String(status || '').toLowerCase();
  if (['confirmed', 'checked_in', 'checkedin'].includes(s)) return '#059669';
  if (['pending'].includes(s)) return '#D97706';
  if (['in_service', 'inservice', 'completed'].includes(s)) return '#2563EB';
  if (['cancelled', 'no_show', 'noshow'].includes(s)) return '#DC2626';
  return '#6B7280';
};

export function AppointmentDetailsScreen({ route, navigation }: any) {
  const { language, isRTL } = useLanguage();
  const { scrollBottomPadding } = useScreenSafeArea();
  const initialGroup = route?.params?.bookingGroup as BookingGroup | undefined;
  const activeTab = (route?.params?.activeTab as 'upcoming' | 'completed' | 'no_show' | 'cancelled' | undefined) || 'upcoming';
  const [group] = useState<BookingGroup | null>(initialGroup || null);
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);
  const [cancelBookingTarget, setCancelBookingTarget] = useState<Booking | null>(null);
  const [cancelReasonCode, setCancelReasonCode] = useState<string>('time_conflict');
  const [cancelReasonText, setCancelReasonText] = useState('');
  const [cancelReasonError, setCancelReasonError] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);
  const [rescheduleChoiceOpen, setRescheduleChoiceOpen] = useState(false);
  const [rescheduleKeepProvider, setRescheduleKeepProvider] = useState(true);
  const [rescheduleSlotsLoading, setRescheduleSlotsLoading] = useState(false);
  const [rescheduleSlots, setRescheduleSlots] = useState<SlotItem[]>([]);
  const [rescheduleSelectedSlot, setRescheduleSelectedSlot] = useState<SlotItem | null>(null);
  const [rescheduleError, setRescheduleError] = useState('');
  const [reschedulePickerVisible, setReschedulePickerVisible] = useState(false);
  const [feedback, setFeedback] = useState<{ visible: boolean; title: string; message: string }>({
    visible: false,
    title: '',
    message: '',
  });

  const representative = group?.items?.[0];
  const bookingSessionId = group?.bookingSessionId || representative?.bookingSessionId || null;
  const bookingReference = group?.bookingReference || representative?.bookingReference || null;
  const guest = useMemo(() => parseGroupGuestFromNotes(representative?.notes), [representative?.notes]);
  const subtotalAmount = useMemo(
    () => group?.items?.reduce((sum, item) => sum + Number(item.price || 0), 0) || 0,
    [group?.items]
  );
  const paidAmount = useMemo(
    () => Math.max(0, subtotalAmount - Number(group?.payableNowTotal || 0)),
    [subtotalAmount, group?.payableNowTotal]
  );
  const tenantHeroUri = useMemo(() => {
    if (!group?.tenant) return null;
    const candidate = (group.tenant as any).coverImage || (group.tenant as any).bannerImage || (group.tenant as any).image || (group.tenant as any).logo;
    if (!candidate) return null;
    return getImageUrl(candidate);
  }, [group?.tenant]);
  const appointmentTimeline = useMemo<AppointmentAuditEvent[]>(() => {
    const events: AppointmentAuditEvent[] = [];
    for (const booking of group?.items || []) {
      const notes = booking.notes || '';
      const rescheduleEntries = extractAuditJsonEntries(notes, '[RESCHEDULE_AUDIT]');
      for (const entry of rescheduleEntries) {
        const at = `${entry?.at || (booking as any)?.updatedAt || booking.startTime || ''}`;
        const from = entry?.fromStartTime ? format(new Date(entry.fromStartTime), 'PPP p', { locale: language === 'ar' ? ar : enUS }) : '-';
        const to = entry?.toStartTime ? format(new Date(entry.toStartTime), 'PPP p', { locale: language === 'ar' ? ar : enUS }) : '-';
        events.push({
          id: `rescheduled-${booking.id}-${at}-${from}-${to}`,
          type: 'rescheduled',
          at,
          title: language === 'ar' ? 'تمت إعادة الجدولة' : 'Rescheduled',
          subtitle: language === 'ar' ? `من ${from} إلى ${to}` : `From ${from} to ${to}`,
        });
      }

      const cancelEntries = extractAuditJsonEntries(notes, '[CANCELLATION_AUDIT]');
      for (const entry of cancelEntries) {
        const at = `${entry?.at || (booking as any)?.updatedAt || booking.startTime || ''}`;
        const reason = `${entry?.reasonText || entry?.reasonCode || ''}`.trim();
        events.push({
          id: `cancelled-${booking.id}-${at}-${reason}`,
          type: 'cancelled',
          at,
          title: language === 'ar' ? 'تم إلغاء الموعد' : 'Cancelled',
          subtitle: reason
            ? (language === 'ar' ? `السبب: ${reason}` : `Reason: ${reason}`)
            : (language === 'ar' ? 'بدون سبب' : 'No reason provided'),
        });
      }
    }

    return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [group?.items, language]);

  const getBookingNumber = (booking: Booking) =>
    booking.bookingNumber || booking.bookingReference || booking.id.slice(0, 8).toUpperCase();

  const getServiceName = (booking: Booking) => {
    const service = booking.Service || booking.service;
    return language === 'ar'
      ? service?.name_ar || service?.name_en || '-'
      : service?.name_en || service?.name_ar || '-';
  };

  const getStaffName = (booking: Booking) => booking.Staff?.name || booking.staff?.name || '-';

  const getPaymentStatusText = (booking: Booking) => {
    const paymentStatus = booking.paymentStatus;
    const outstandingAmount = getBookingOutstandingAmount(booking);
    const normalizedPaymentStatus = (() => {
      const raw = `${paymentStatus || ''}`.trim().toLowerCase();
      if ((raw === 'fully_paid' || raw === 'paid') && outstandingAmount > 0.009) return 'deposit_paid';
      if (raw === 'deposit_paid' && outstandingAmount <= 0.009) return 'fully_paid';
      return raw || 'pending';
    })();
    if (language === 'ar') {
      switch (normalizedPaymentStatus) {
        case 'pending': return 'بانتظار الدفع';
        case 'deposit_paid': return 'عربون مدفوع';
        case 'fully_paid':
        case 'paid': return 'مدفوع بالكامل';
        case 'refunded': return 'مسترد';
        case 'partially_refunded': return 'مسترد جزئياً';
        default: return paymentStatus || '-';
      }
    }
    switch (normalizedPaymentStatus) {
      case 'pending': return 'Pending';
      case 'deposit_paid': return 'Deposit Paid';
      case 'fully_paid':
      case 'paid': return 'Fully Paid';
      case 'refunded': return 'Refunded';
      case 'partially_refunded': return 'Partially Refunded';
      default: return paymentStatus || '-';
    }
  };

  const getPaymentMethodLabel = (paymentMethod?: string | null) => {
    const key = `${paymentMethod || ''}`.trim().toLowerCase();
    if (language === 'ar') {
      if (key === 'at-center') return 'الدفع عند المركز';
      if (key === 'online-full') return 'الدفع عبر الإنترنت';
      if (key === 'booking-fee') return 'عربون الحجز';
      return paymentMethod || '-';
    }
    if (key === 'at-center') return 'Pay at center';
    if (key === 'online-full') return 'Pay online';
    if (key === 'booking-fee') return 'Booking fee';
    return paymentMethod || '-';
  };

  const showFeedback = (title: string, message: string) => {
    setFeedback({ visible: true, title, message });
  };

  const getCenterPhoneNumber = (booking?: Booking | null) => {
    const tenant = booking?.tenant;
    const candidate = `${tenant?.whatsappNumber || (tenant as any)?.whatsapp || tenant?.mobile || tenant?.phone || ''}`.trim();
    return candidate || '';
  };

  const handleContactCenter = async () => {
    const phone = getCenterPhoneNumber(representative);
    if (!phone) {
      showFeedback(
        language === 'ar' ? 'رقم غير متوفر' : 'Number unavailable',
        language === 'ar'
          ? 'لم يتم توفير رقم المركز لهذا الموعد.'
          : 'The center phone number is not available for this appointment.'
      );
      return;
    }

    const normalizedPhone = phone.replace(/\s+/g, '');
    const whatsappUrl = `https://wa.me/${normalizedPhone.replace(/[^0-9]/g, '')}`;
    const telUrl = `tel:${normalizedPhone}`;
    try {
      const canOpenWhatsApp = await Linking.canOpenURL(whatsappUrl);
      if (canOpenWhatsApp) {
        await Linking.openURL(whatsappUrl);
        return;
      }
      const canOpenDialer = await Linking.canOpenURL(telUrl);
      if (canOpenDialer) {
        await Linking.openURL(telUrl);
        return;
      }
      throw new Error('No supported contact app available');
    } catch (error) {
      Alert.alert(
        language === 'ar' ? 'تعذر الاتصال' : 'Call unavailable',
        language === 'ar'
          ? `تعذر فتح واتساب أو تطبيق الاتصال للرقم ${phone}.`
          : `Could not open WhatsApp or the phone dialer for ${phone}.`
      );
    }
  };

  const handleAddService = () => {
    const tenant = representative?.tenant || group?.tenant || null;
    if (!tenant?.id) {
      showFeedback(
        language === 'ar' ? 'المنشأة غير متاحة' : 'Center unavailable',
        language === 'ar' ? 'تعذر فتح صفحة الخدمات لهذا الموعد.' : 'Could not open the services page for this appointment.'
      );
      return;
    }

    navigation.navigate('Tenant', {
      tenantId: tenant.id,
      tenant,
      slug: tenant.slug,
      initialTab: 'services',
      bookingSessionId,
      bookingReference,
    });
  };

  const handleCancelSubmit = async () => {
    if (!cancelBookingTarget || cancelSubmitting) return;
    if (cancelReasonCode === 'other' && !cancelReasonText.trim()) {
      setCancelReasonError(language === 'ar' ? 'يرجى كتابة سبب الإلغاء.' : 'Please write cancellation reason.');
      return;
    }
    try {
      setCancelSubmitting(true);
      setCancelReasonError('');
      await api.cancelBooking(cancelBookingTarget.id, {
        reasonCode: cancelReasonCode || undefined,
        reasonText: cancelReasonText.trim() || undefined,
      });
      setCancelBookingTarget(null);
      setCancelReasonText('');
      showFeedback(language === 'ar' ? 'تم' : 'Done', language === 'ar' ? 'تم إلغاء الموعد.' : 'Booking cancelled.');
      navigation.goBack();
    } catch (error: any) {
      showFeedback(language === 'ar' ? 'خطأ' : 'Error', error?.message || 'Failed to cancel');
    } finally {
      setCancelSubmitting(false);
    }
  };

  const openRescheduleChoice = (booking: Booking) => {
    const baseDate = new Date(booking.startTime);
    const yyyy = baseDate.getFullYear();
    const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
    const dd = String(baseDate.getDate()).padStart(2, '0');
    setRescheduleDate(`${yyyy}-${mm}-${dd}`);
    setRescheduleSlots([]);
    setRescheduleSelectedSlot(null);
    setRescheduleError('');
    setRescheduleBooking(booking);
    setRescheduleChoiceOpen(true);
  };

  const parseRescheduleDate = (value: string) => {
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return new Date();
    return parsed;
  };

  const handleRescheduleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setReschedulePickerVisible(false);
    }
    if (event.type === 'dismissed' || !selectedDate) return;
    const yyyy = selectedDate.getFullYear();
    const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(selectedDate.getDate()).padStart(2, '0');
    setRescheduleDate(`${yyyy}-${mm}-${dd}`);
  };

  const loadRescheduleSlots = async (booking: Booking, keepProvider: boolean, dateValue: string) => {
    const tenantId = booking.tenantId || booking.tenant?.id || group?.tenant?.id;
    const serviceId = booking.serviceId || booking.service?.id || booking.Service?.id;
    if (!tenantId || !serviceId || !dateValue) return;
    try {
      setRescheduleSlotsLoading(true);
      setRescheduleSelectedSlot(null);
      setRescheduleError('');
      const response = await api.post<{ slots: SlotItem[] }>('/bookings/search', {
        tenantId,
        serviceId,
        date: dateValue,
        staffId: keepProvider ? (booking.staffId || booking.Staff?.id || booking.staff?.id) : undefined,
        variantId: booking.serviceVariantId || undefined,
      });
      const available = (response.slots || []).filter((slot) => !!slot?.available);
      setRescheduleSlots(available);
      if (available.length === 0) {
        setRescheduleError(language === 'ar' ? 'لا توجد مواعيد متاحة لهذا اليوم.' : 'No available slots for this date.');
      }
    } catch (error: any) {
      setRescheduleError(error?.message || (language === 'ar' ? 'تعذر تحميل المواعيد المتاحة.' : 'Could not load available slots.'));
    } finally {
      setRescheduleSlotsLoading(false);
    }
  };

  const navigateToRescheduleFlow = async (useSameProvider: boolean) => {
    if (!rescheduleBooking) return;
    setRescheduleKeepProvider(useSameProvider);
    setRescheduleChoiceOpen(false);
    await loadRescheduleSlots(rescheduleBooking, useSameProvider, rescheduleDate);
  };

  const submitReschedule = async () => {
    if (!rescheduleBooking || !rescheduleSelectedSlot?.startTime || rescheduleSubmitting) return;
    try {
      setRescheduleSubmitting(true);
      const dateTime = new Date(rescheduleSelectedSlot.startTime);
      if (Number.isNaN(dateTime.getTime())) throw new Error(language === 'ar' ? 'تاريخ/وقت غير صالح' : 'Invalid date/time');
      await api.rescheduleBooking(rescheduleBooking.id, {
        startTime: dateTime.toISOString(),
        staffId: rescheduleKeepProvider
          ? (rescheduleBooking.staffId || rescheduleBooking.Staff?.id || rescheduleBooking.staff?.id)
          : (rescheduleSelectedSlot.staffId || rescheduleBooking.staffId),
      });
      setRescheduleBooking(null);
      setRescheduleSlots([]);
      setRescheduleSelectedSlot(null);
      showFeedback(language === 'ar' ? 'تم' : 'Done', language === 'ar' ? 'تمت إعادة الجدولة بنجاح.' : 'Appointment rescheduled successfully');
      navigation.goBack();
    } catch (error: any) {
      showFeedback(language === 'ar' ? 'خطأ' : 'Error', error?.message || (language === 'ar' ? 'تعذرت إعادة الجدولة' : 'Failed to reschedule'));
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  if (!group || !representative) {
    return (
      <View style={[styles.container, { flex: 1 }]}>
        <CustomerSubpageHeader
          title={language === 'ar' ? 'تفاصيل الموعد' : 'Appointment Details'}
          onBack={() => navigation.goBack()}
        />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{language === 'ar' ? 'تعذر تحميل تفاصيل الموعد.' : 'Unable to load appointment details.'}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Browse')}>
            <Text style={styles.primaryBtnText}>{language === 'ar' ? 'تصفح الخدمات' : 'Browse Services'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomerSubpageHeader
        title={language === 'ar' ? 'تفاصيل الموعد' : 'Appointment Details'}
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrap}>
          {/* Summary Card */}
          <View style={styles.summaryCard}>
            <View style={[styles.summaryTopRow, isRTL && styles.rowReverse]}>
              {tenantHeroUri ? (
                <Image source={{ uri: tenantHeroUri }} style={styles.salonThumb} resizeMode="cover" />
              ) : (
                <View style={styles.salonThumbPlaceholder}>
                  <AppIcon name="storefront" size={20} color="#7C3AED" />
                </View>
              )}
              <View style={[styles.summaryTopInfo, isRTL && styles.alignEnd]}>
                <Text style={[styles.salonName, isRTL && styles.textRTL]} numberOfLines={1}>
                  {group.tenant?.name || representative.tenant?.name || '-'}
                </Text>
                {((group.tenant as any)?.city || (group.tenant as any)?.address) && (
                  <View style={[styles.locationRow, isRTL && styles.rowReverse]}>
                    <AppIcon name="location" size={12} color={colors.textSecondary} />
                    <Text style={[styles.locationText, isRTL && styles.textRTL]} numberOfLines={1}>
                      {[(group.tenant as any)?.city, (group.tenant as any)?.address].filter(Boolean).join(' - ')}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.refBadge}>
                <Text style={styles.refBadgeLabel}>{language === 'ar' ? 'رقم الحجز' : 'Ref'}</Text>
                <Text style={styles.refBadgeText} numberOfLines={1}>
                  #{getBookingNumber(representative)}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={[styles.appointmentTimeRow, isRTL && styles.rowReverse]}>
              <View style={styles.timeIconWrap}>
                <AppIcon name="event" size={18} color="#7C3AED" />
              </View>
              <View style={[styles.timeInfoWrap, isRTL && styles.alignEnd]}>
                <Text style={[styles.appointmentDateText, isRTL && styles.textRTL]}>
                  {format(new Date(group.startTime), 'eeee, d MMMM yyyy', { locale: language === 'ar' ? ar : enUS })}
                </Text>
                <Text style={[styles.appointmentTimeText, isRTL && styles.textRTL]}>
                  {format(new Date(group.startTime), 'h:mm a', { locale: language === 'ar' ? ar : enUS })}
                </Text>
              </View>
              <View style={[styles.pillsContainer, isRTL && styles.alignStart]}>
                <View style={[styles.statusChip, { backgroundColor: getStatusBgColor(group.status) }]}>
                  <Text style={[styles.statusChipText, { color: getStatusTextColor(group.status) }]}>
                    {getStatusText(group.status, language)}
                  </Text>
                </View>
                <View style={styles.paymentChip}>
                  <Text style={styles.paymentChipText}>
                    {getPaymentStatusText(representative)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Metrics Grid */}
          <View style={[styles.metricsGrid, isRTL && styles.rowReverse]}>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>{language === 'ar' ? 'الخدمات' : 'Services'}</Text>
              <Text style={styles.metricValue}>{group.items.length}</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>{language === 'ar' ? 'الإجمالي' : 'Total'}</Text>
              <Text style={styles.metricValue}>{formatRiyal(group.totalPrice, language)}</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>{language === 'ar' ? 'المطلوب الآن' : 'Payable Now'}</Text>
              <Text style={[styles.metricValue, { color: Number(group.payableNowTotal || 0) > 0.009 ? '#7C3AED' : colors.text }]}>
                {formatRiyal(group.payableNowTotal, language)}
              </Text>
            </View>
          </View>

          {/* Guest Card */}
          {guest ? (
            <View style={styles.guestCard}>
              <View style={[styles.cardHeaderRow, isRTL && styles.rowReverse]}>
                <AppIcon name="user" size={16} color="#7C3AED" />
                <Text style={[styles.sectionTitleSmall, isRTL && styles.textRTL]}>{language === 'ar' ? 'بيانات الضيف' : 'Guest Information'}</Text>
              </View>
              <Text style={[styles.guestName, isRTL && styles.textRTL]}>{guest.fullName}</Text>
              {!!guest.phone && (
                <View style={[styles.guestDetailRow, isRTL && styles.rowReverse]}>
                  <AppIcon name="phone" size={13} color={colors.textSecondary} />
                  <Text style={styles.guestPhone}>{guest.phone}</Text>
                </View>
              )}
              {!!guest.email && (
                <View style={[styles.guestDetailRow, isRTL && styles.rowReverse]}>
                  <AppIcon name="mail" size={13} color={colors.textSecondary} />
                  <Text style={styles.guestPhone}>{guest.email}</Text>
                </View>
              )}
              {!!guest.birthDate && (
                <View style={[styles.guestDetailRow, isRTL && styles.rowReverse]}>
                  <AppIcon name="event" size={13} color={colors.textSecondary} />
                  <Text style={styles.guestPhone}>{guest.birthDate}</Text>
                </View>
              )}
            </View>
          ) : null}

          {/* Services Section */}
          <View style={[styles.servicesHeaderRow, isRTL && styles.rowReverse]}>
            <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>{language === 'ar' ? 'الخدمات المحجوزة' : 'Booked Services'}</Text>
            {group.items.length > 1 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{group.items.length} {language === 'ar' ? 'خدمات' : 'services'}</Text>
              </View>
            )}
          </View>

          {group.items.map((booking, index) => (
            <View key={booking.id} style={styles.serviceCard}>
              <View style={[styles.serviceHeaderRow, isRTL && styles.rowReverse]}>
                <View style={styles.serviceIndexPill}>
                  <Text style={styles.serviceIndexText}>
                    {language === 'ar' ? `خدمة ${index + 1}` : `Service ${index + 1}`}
                  </Text>
                </View>
                <Text style={styles.servicePriceText}>{formatRiyal(Number(booking.price || 0), language)}</Text>
              </View>

              <Text style={[styles.serviceName, isRTL && styles.textRTL]}>{getServiceName(booking)}</Text>
              {!!booking.serviceVariantName && (
                <Text style={[styles.serviceVariant, isRTL && styles.textRTL]}>{booking.serviceVariantName}</Text>
              )}

              <View style={styles.serviceMetaGrid}>
                <View style={[styles.serviceMetaRow, isRTL && styles.rowReverse]}>
                  <AppIcon name="clock" size={14} color="#6B7280" />
                  <Text style={[styles.serviceMetaText, isRTL && styles.textRTL]}>
                    {format(new Date(booking.startTime), 'PPP p', { locale: language === 'ar' ? ar : enUS })}
                  </Text>
                </View>
                <View style={[styles.serviceMetaRow, isRTL && styles.rowReverse]}>
                  <AppIcon name="user" size={14} color="#6B7280" />
                  <Text style={[styles.serviceMetaText, isRTL && styles.textRTL]}>
                    {language === 'ar' ? 'المقدم: ' : 'Provider: '}{getStaffName(booking)}
                  </Text>
                </View>
              </View>

              <View style={[styles.serviceChipsRow, isRTL && styles.rowReverse]}>
                <View style={[styles.statusChipMini, { backgroundColor: getStatusBgColor(booking.status) }]}>
                  <Text style={[styles.statusChipMiniText, { color: getStatusTextColor(booking.status) }]}>
                    {getStatusText(booking.status, language)}
                  </Text>
                </View>
                <View style={styles.paymentChipMini}>
                  <Text style={styles.paymentChipMiniText}>
                    {getPaymentStatusText(booking)}
                  </Text>
                </View>
              </View>
            </View>
          ))}

          {/* Payment Summary */}
          <View style={styles.paymentSummaryCard}>
            <Text style={[styles.sectionTitleSmall, isRTL && styles.textRTL]}>{language === 'ar' ? 'ملخص الدفع' : 'Payment Summary'}</Text>
            <View style={[styles.paymentRow, isRTL && styles.rowReverse]}>
              <Text style={styles.paymentLabel}>{language === 'ar' ? 'الإجمالي' : 'Subtotal'}</Text>
              <Text style={styles.paymentValue}>{formatRiyal(subtotalAmount, language)}</Text>
            </View>
            <View style={[styles.paymentRow, isRTL && styles.rowReverse]}>
              <Text style={styles.paymentLabel}>{language === 'ar' ? 'المدفوع' : 'Paid'}</Text>
              <Text style={styles.paymentValue}>- {formatRiyal(paidAmount, language)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={[styles.paymentRow, isRTL && styles.rowReverse]}>
              <Text style={styles.paymentDueLabel}>{language === 'ar' ? 'المطلوب الآن' : 'Payable Now'}</Text>
              <Text style={styles.paymentDueValue}>{formatRiyal(Number(group.payableNowTotal || 0), language)}</Text>
            </View>
            {!!representative.paymentMethod && (
              <View style={[styles.paymentMethodRow, isRTL && styles.rowReverse]}>
                <AppIcon name="card" size={13} color={colors.textSecondary} />
                <Text style={styles.paymentMethodHint}>
                  {language === 'ar' ? 'طريقة الدفع' : 'Payment method'}: {getPaymentMethodLabel(representative.paymentMethod)}
                </Text>
              </View>
            )}
          </View>

          {/* Activity Timeline */}
          {appointmentTimeline.length > 0 && (
            <View style={styles.timelineCard}>
              <Text style={[styles.sectionTitleSmall, isRTL && styles.textRTL]}>{language === 'ar' ? 'سجل التغييرات' : 'Activity Timeline'}</Text>
              {appointmentTimeline.slice(0, 8).map((event) => (
                <View key={event.id} style={[styles.timelineRow, isRTL && styles.rowReverse]}>
                  <View style={[styles.timelineDot, event.type === 'cancelled' ? styles.timelineDotDanger : styles.timelineDotPrimary]} />
                  <View style={[styles.timelineBody, isRTL && styles.alignEnd]}>
                    <View style={[styles.timelineHeaderRow, isRTL && styles.rowReverse]}>
                      <Text style={[styles.timelineTitle, isRTL && styles.textRTL]}>{event.title}</Text>
                      <Text style={styles.timelineTime}>{event.at}</Text>
                    </View>
                    <Text style={[styles.timelineSub, isRTL && styles.textRTL]}>{event.subtitle}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Actions Card */}
          <View style={styles.primaryActionCard}>
            {Number(group.payableNowTotal || 0) > 0.009 && activeTab === 'upcoming' && (
              <TouchableOpacity
                style={[styles.primaryBtn, isRTL && styles.rowReverse]}
                onPress={() =>
                  navigation.navigate('Payment', {
                    appointmentId: representative.id,
                    amount: Number(group.payableNowTotal || 0),
                    tenantId: representative.tenantId || representative.tenant?.id,
                    paymentChoice:
                      representative.paymentStatus === 'pending' && representative.paymentMethod === 'booking-fee'
                        ? 'booking-fee'
                        : undefined,
                    paymentSummary: {
                      primaryCustomer: guest?.fullName || representative.customerName || representative.customer?.name || representative.customer?.fullName || representative.customer?.firstName || representative.customer?.email || (language === 'ar' ? 'العميل الأساسي' : 'Primary customer'),
                      participants: [
                        {
                          name: guest?.fullName || representative.customerName || representative.customer?.name || representative.customer?.fullName || representative.customer?.firstName || (language === 'ar' ? 'أنتِ' : 'You'),
                          services: group.items.map((item) => getServiceName(item)),
                        },
                      ],
                      services: group.items.map((item) => getServiceName(item)),
                      date: format(new Date(representative.startTime), 'PPP', { locale: language === 'ar' ? ar : enUS }),
                      time: format(new Date(representative.startTime), 'p', { locale: language === 'ar' ? ar : enUS }),
                      employee: getStaffName(representative),
                      salon: group.tenant?.name || representative.tenant?.name || representative.tenantName || (language === 'ar' ? 'الصالون' : 'Salon'),
                      subtotal: subtotalAmount,
                      tax: null,
                      deposit: representative.paymentMethod === 'booking-fee'
                        ? Number(group.payableNowTotal || 0)
                        : null,
                      remaining: representative.paymentMethod === 'booking-fee'
                        ? Math.max(0, subtotalAmount - Number(group.payableNowTotal || 0))
                        : 0,
                      total: subtotalAmount,
                    },
                  })
                }
              >
                <AppIcon name="card" size={18} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>{language === 'ar' ? 'ادفع الآن' : 'Pay Now'}</Text>
              </TouchableOpacity>
            )}

            <View style={[styles.secondaryActions, isRTL && styles.rowReverse]}>
              {(representative.Service?.allowReschedule || representative.service?.allowReschedule) &&
              ['confirmed', 'pending'].includes(representative.status) &&
              activeTab === 'upcoming' ? (
                <TouchableOpacity style={[styles.secondaryBtn, isRTL && styles.rowReverse]} onPress={() => openRescheduleChoice(representative)}>
                  <AppIcon name="refresh" size={16} color="#7C3AED" />
                  <Text style={styles.secondaryBtnText} numberOfLines={1}>{language === 'ar' ? 'إعادة جدولة' : 'Reschedule'}</Text>
                </TouchableOpacity>
              ) : null}

              {['confirmed', 'pending'].includes(representative.status) && activeTab === 'upcoming' ? (
                <TouchableOpacity style={[styles.cancelBtn, isRTL && styles.rowReverse]} onPress={() => setCancelBookingTarget(representative)}>
                  <AppIcon name="close" size={16} color="#DC2626" />
                  <Text style={styles.cancelBtnText} numberOfLines={1}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {activeTab === 'upcoming' && group?.status !== 'cancelled' ? (
              <TouchableOpacity style={[styles.addServiceBtn, isRTL && styles.rowReverse]} onPress={handleAddService}>
                <AppIcon name="plus" size={16} color="#7C3AED" />
                <Text style={styles.addServiceBtnText}>{language === 'ar' ? 'إضافة خدمة' : 'Add service'}</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.contactBtn, isRTL && styles.rowReverse]}
              onPress={handleContactCenter}
            >
              <AppIcon name="message" size={16} color="#4B5563" />
              <Text style={styles.contactBtnText}>
                {language === 'ar' ? 'واتساب / الاتصال بالمركز' : 'WhatsApp / Call Center'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Policy Note */}
          <View style={[styles.policyNote, isRTL && styles.rowReverse]}>
            <AppIcon name="info" size={16} color={colors.textSecondary} />
            <Text style={styles.policyText}>
              {language === 'ar'
                ? 'يمكنك تعديل الموعد أو إلغاؤه بحسب سياسة المركز.'
                : 'You can change or cancel your appointment based on center policy.'}
            </Text>
          </View>
        </View>
      </ScrollView>

      <Modal visible={!!rescheduleBooking && !rescheduleChoiceOpen} transparent animationType="fade" onRequestClose={() => !rescheduleSubmitting && setRescheduleBooking(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.modalCardLarge]}>
            <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>{language === 'ar' ? 'اختر موعداً جديداً' : 'Choose New Slot'}</Text>
            <TouchableOpacity style={styles.modalDatePickerButton} onPress={() => setReschedulePickerVisible(true)} activeOpacity={0.9}>
              <Text style={styles.modalDatePickerText}>{rescheduleDate || (language === 'ar' ? 'اختر التاريخ' : 'Pick a date')}</Text>
              <AppIcon name="event" size={18} color={colors.primary} />
            </TouchableOpacity>
            {reschedulePickerVisible && (
              <DateTimePicker
                value={parseRescheduleDate(rescheduleDate)}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleRescheduleDateChange}
                minimumDate={new Date()}
              />
            )}
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => rescheduleBooking && loadRescheduleSlots(rescheduleBooking, rescheduleKeepProvider, rescheduleDate)}
              disabled={rescheduleSlotsLoading}
            >
              <Text style={styles.secondaryBtnText}>{rescheduleSlotsLoading ? (language === 'ar' ? 'جارٍ التحميل...' : 'Loading...') : (language === 'ar' ? 'عرض المواعيد المتاحة' : 'Load Available Slots')}</Text>
            </TouchableOpacity>
            <View style={{ height: spacing.sm }} />
            {!rescheduleKeepProvider ? (
              <Text style={styles.modalHint}>
                {language === 'ar' ? 'اختر الوقت ومقدم الخدمة المناسب.' : 'Pick the best time and provider.'}
              </Text>
            ) : null}
            <View style={styles.reasonRow}>
              {rescheduleSlots.map((slot) => {
                const label = format(new Date(slot.startTime), 'h:mm a', { locale: language === 'ar' ? ar : enUS });
                const selected = rescheduleSelectedSlot?.startTime === slot.startTime;
                return (
                  <TouchableOpacity key={slot.startTime} style={[styles.reasonChip, selected && styles.reasonChipActive]} onPress={() => setRescheduleSelectedSlot(slot)}>
                    <Text style={[styles.reasonChipText, selected && styles.reasonChipTextActive]}>{label}</Text>
                    {!rescheduleKeepProvider && !!slot.staffName ? (
                      <Text style={[styles.reasonChipMeta, selected && styles.reasonChipMetaActive]} numberOfLines={1}>
                        {slot.staffName}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
              {!rescheduleSlotsLoading && rescheduleSlots.length === 0 && (
                <Text style={styles.modalErrorText}>{rescheduleError || (language === 'ar' ? 'لا توجد مواعيد متاحة لهذا اليوم.' : 'No available slots for this date.')}</Text>
              )}
            </View>
            {!!rescheduleError && rescheduleSlots.length > 0 && <Text style={styles.modalErrorText}>{rescheduleError}</Text>}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setRescheduleBooking(null)} disabled={rescheduleSubmitting}>
                <Text style={styles.modalCancelText}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={submitReschedule} disabled={rescheduleSubmitting || !rescheduleSelectedSlot}>
                <Text style={styles.modalSaveText}>{rescheduleSubmitting ? (language === 'ar' ? 'جارٍ الحفظ...' : 'Saving...') : (language === 'ar' ? 'تأكيد' : 'Confirm')}</Text>
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!cancelBookingTarget} transparent animationType="fade" onRequestClose={() => !cancelSubmitting && setCancelBookingTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{language === 'ar' ? 'سبب الإلغاء' : 'Cancellation Reason'}</Text>
            <View style={styles.reasonRow}>
              {[
                { id: 'time_conflict', en: 'Time conflict', ar: 'تعارض وقت' },
                { id: 'changed_mind', en: 'Changed mind', ar: 'تغيير رأي' },
                { id: 'provider_pref', en: 'Provider preference', ar: 'تفضيل مقدم الخدمة' },
                { id: 'other', en: 'Other', ar: 'أخرى' },
              ].map((r) => (
                <TouchableOpacity key={r.id} style={[styles.reasonChip, cancelReasonCode === r.id && styles.reasonChipActive]} onPress={() => setCancelReasonCode(r.id)}>
                  <Text style={[styles.reasonChipText, cancelReasonCode === r.id && styles.reasonChipTextActive]}>{language === 'ar' ? r.ar : r.en}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {cancelReasonCode === 'other' && (
              <TextInput
                value={cancelReasonText}
                onChangeText={setCancelReasonText}
                placeholder={language === 'ar' ? 'اكتب سبب الإلغاء' : 'Write cancellation reason'}
                style={styles.modalInput}
                multiline
              />
            )}
            {!!cancelReasonError && <Text style={styles.modalErrorText}>{cancelReasonError}</Text>}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setCancelBookingTarget(null)} disabled={cancelSubmitting}>
                <Text style={styles.modalCancelText}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={handleCancelSubmit} disabled={cancelSubmitting}>
                <Text style={styles.modalSaveText}>{cancelSubmitting ? (language === 'ar' ? 'جارٍ الإلغاء...' : 'Cancelling...') : (language === 'ar' ? 'تأكيد الإلغاء' : 'Confirm Cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={rescheduleChoiceOpen} transparent animationType="fade" onRequestClose={() => setRescheduleChoiceOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.modalCardLarge]}>
            <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>{language === 'ar' ? 'إعادة الجدولة' : 'Reschedule Options'}</Text>
            <Text style={styles.modalHint}>{language === 'ar' ? 'اختر طريقة إعادة الجدولة لعرض المواعيد المتاحة الفعلية.' : 'Choose how to reschedule to view real available slots.'}</Text>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigateToRescheduleFlow(true)}>
              <Text style={styles.secondaryBtnText}>{language === 'ar' ? 'نفس مقدم الخدمة' : 'Keep same provider'}</Text>
            </TouchableOpacity>
            <View style={{ height: spacing.sm }} />
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigateToRescheduleFlow(false)}>
              <Text style={styles.secondaryBtnText}>{language === 'ar' ? 'تغيير مقدم الخدمة' : 'Change provider'}</Text>
            </TouchableOpacity>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setRescheduleChoiceOpen(false)}>
                <Text style={styles.modalCancelText}>{language === 'ar' ? 'إغلاق' : 'Close'}</Text>
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={feedback.visible} transparent animationType="fade" onRequestClose={() => setFeedback((prev) => ({ ...prev, visible: false }))}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{feedback.title}</Text>
            <Text style={styles.modalHint}>{feedback.message}</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSave} onPress={() => setFeedback((prev) => ({ ...prev, visible: false }))}>
                <Text style={styles.modalSaveText}>{language === 'ar' ? 'حسناً' : 'OK'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FC' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  scrollContent: { paddingTop: spacing.md },
  contentWrap: { paddingHorizontal: spacing.md, gap: spacing.md },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8ECF2',
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  salonThumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8ECF2',
  },
  salonThumbPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F3EEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTopInfo: {
    flex: 1,
  },
  salonName: {
    fontFamily: 'Cairo-Bold',
    fontSize: 16,
    color: colors.text,
    fontWeight: '700',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  locationText: {
    fontFamily: 'Cairo-Regular',
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1,
  },
  refBadge: {
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    alignItems: 'center',
  },
  refBadgeLabel: {
    fontFamily: 'Cairo-Regular',
    fontSize: 9,
    color: '#7C3AED',
  },
  refBadgeText: {
    fontFamily: 'Cairo-Bold',
    fontSize: 12,
    color: '#7C3AED',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: spacing.sm,
  },
  appointmentTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timeIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F3EEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeInfoWrap: {
    flex: 1,
  },
  appointmentDateText: {
    fontFamily: 'Cairo-SemiBold',
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  appointmentTimeText: {
    fontFamily: 'Cairo-Bold',
    fontSize: 14,
    color: '#7C3AED',
    fontWeight: '700',
    marginTop: 1,
  },
  pillsContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusChipText: {
    fontFamily: 'Cairo-Bold',
    fontSize: 11,
    fontWeight: '700',
  },
  paymentChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#F3EEFF',
  },
  paymentChipText: {
    fontFamily: 'Cairo-Medium',
    fontSize: 10,
    color: '#7C3AED',
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8ECF2',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  metricCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  metricDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#F1F5F9',
  },
  metricLabel: {
    fontFamily: 'Cairo-Regular',
    fontSize: 10,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  metricValue: {
    fontFamily: 'Cairo-Bold',
    fontSize: 13,
    color: colors.text,
    fontWeight: '700',
  },
  guestCard: {
    backgroundColor: '#FAF9FE',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EDE9FE',
    padding: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  guestName: {
    fontFamily: 'Cairo-Bold',
    fontSize: 14,
    color: colors.text,
    fontWeight: '700',
  },
  guestDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 4,
  },
  guestPhone: {
    fontFamily: 'Cairo-Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  servicesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontFamily: 'Cairo-Bold',
    fontSize: 17,
    color: colors.text,
    fontWeight: '700',
  },
  sectionTitleSmall: {
    fontFamily: 'Cairo-Bold',
    fontSize: 14,
    color: colors.text,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  countBadge: {
    backgroundColor: '#F3EEFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  countBadgeText: {
    fontFamily: 'Cairo-Bold',
    fontSize: 11,
    color: '#7C3AED',
    fontWeight: '700',
  },
  serviceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E8ECF2',
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  serviceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  serviceIndexPill: {
    backgroundColor: '#F3EEFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  serviceIndexText: {
    fontFamily: 'Cairo-Bold',
    fontSize: 10,
    color: '#7C3AED',
    fontWeight: '700',
  },
  servicePriceText: {
    fontFamily: 'Cairo-Bold',
    fontSize: 15,
    color: '#7C3AED',
    fontWeight: '700',
  },
  serviceName: {
    fontFamily: 'Cairo-Bold',
    fontSize: 15,
    color: colors.text,
    fontWeight: '700',
  },
  serviceVariant: {
    fontFamily: 'Cairo-Regular',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  serviceMetaGrid: {
    marginTop: spacing.sm,
    gap: 4,
  },
  serviceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  serviceMetaText: {
    fontFamily: 'Cairo-Regular',
    fontSize: 12,
    color: '#4B5563',
  },
  serviceChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  statusChipMini: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusChipMiniText: {
    fontFamily: 'Cairo-Bold',
    fontSize: 10,
    fontWeight: '700',
  },
  paymentChipMini: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  paymentChipMiniText: {
    fontFamily: 'Cairo-Regular',
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
  },
  paymentSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E8ECF2',
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  paymentLabel: {
    fontFamily: 'Cairo-Regular',
    color: colors.textSecondary,
    fontSize: 12,
  },
  paymentValue: {
    fontFamily: 'Cairo-SemiBold',
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  paymentDueLabel: {
    fontFamily: 'Cairo-Bold',
    color: '#7C3AED',
    fontSize: 13,
    fontWeight: '700',
  },
  paymentDueValue: {
    fontFamily: 'Cairo-Bold',
    color: '#7C3AED',
    fontSize: 15,
    fontWeight: '800',
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
  },
  paymentMethodHint: {
    fontFamily: 'Cairo-Regular',
    color: colors.textSecondary,
    fontSize: 11,
  },
  timelineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E8ECF2',
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  timelineDotPrimary: { backgroundColor: '#7C3AED' },
  timelineDotDanger: { backgroundColor: colors.error },
  timelineBody: { flex: 1 },
  timelineTitle: { fontFamily: 'Cairo-SemiBold', color: colors.text, fontSize: 12, fontWeight: '600' },
  timelineSub: { fontFamily: 'Cairo-Regular', color: colors.textSecondary, fontSize: 11, marginTop: 1 },
  timelineTime: { fontFamily: 'Cairo-Regular', color: '#9CA3AF', fontSize: 10, marginTop: 1 },
  timelineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  primaryActionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E8ECF2',
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  primaryBtn: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#7C3AED',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  primaryBtnText: { fontFamily: 'Cairo-Bold', color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  secondaryActions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'stretch' },
  secondaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#7C3AED',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FAF5FF',
    paddingHorizontal: spacing.sm,
  },
  secondaryBtnText: { fontFamily: 'Cairo-Bold', color: '#7C3AED', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  cancelBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: spacing.sm,
  },
  cancelBtnText: { fontFamily: 'Cairo-Bold', color: '#DC2626', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  addServiceBtn: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E9DDFD',
    backgroundColor: '#FBF9FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
  },
  addServiceBtnText: { fontFamily: 'Cairo-Bold', color: '#7C3AED', fontWeight: '700', fontSize: 13 },
  contactBtn: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
  },
  contactBtnText: { fontFamily: 'Cairo-SemiBold', color: '#4B5563', fontWeight: '600', fontSize: 13 },
  policyNote: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  policyText: { flex: 1, fontFamily: 'Cairo-Regular', color: colors.textSecondary, fontSize: 11, lineHeight: 17 },
  emptyText: { fontFamily: 'Cairo-Medium', color: colors.textSecondary, marginBottom: spacing.md, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(18, 13, 33, 0.55)', justifyContent: 'center', paddingHorizontal: spacing.sm },
  modalCard: {
    marginHorizontal: spacing.md,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9DDFD',
    padding: spacing.md,
    shadowColor: '#2E1065',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 8,
  },
  modalCardLarge: { maxHeight: '72%' },
  modalScrollContent: { paddingBottom: spacing.sm },
  modalTitle: { fontFamily: 'Cairo-Bold', fontSize: fontSize.sm, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  modalHint: { fontFamily: 'Cairo-Regular', color: colors.textSecondary, fontSize: 11, marginBottom: spacing.sm },
  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  reasonChip: { borderWidth: 1, borderColor: '#E9DDFD', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FFFFFF', minWidth: 96 },
  reasonChipActive: { borderColor: '#7C3AED', backgroundColor: '#F5EEFF' },
  reasonChipText: { fontFamily: 'Cairo-Regular', color: colors.text, fontSize: 11, fontWeight: '600' },
  reasonChipTextActive: { color: '#7C3AED', fontFamily: 'Cairo-Bold' },
  reasonChipMeta: { marginTop: 2, fontFamily: 'Cairo-Regular', color: colors.textSecondary, fontSize: 9, fontWeight: '600' },
  reasonChipMetaActive: { color: '#7C3AED' },
  modalInput: { borderWidth: 1, borderColor: '#E9DDFD', borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: '#F7F4FF', color: colors.text, marginBottom: spacing.sm, fontFamily: 'Cairo-Regular' },
  modalDatePickerButton: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#E9DDFD',
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: '#F7F4FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalDatePickerText: {
    color: colors.text,
    fontSize: 14,
    fontFamily: 'Cairo-SemiBold',
    fontWeight: '600',
  },
  modalErrorText: { fontFamily: 'Cairo-Regular', color: colors.error, fontSize: 11, marginBottom: spacing.sm, fontWeight: '600' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, flexWrap: 'wrap' },
  modalCancel: { minWidth: 96, borderWidth: 1, borderColor: '#E9DDFD', borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, alignItems: 'center', backgroundColor: '#FFFFFF' },
  modalCancelText: { fontFamily: 'Cairo-SemiBold', color: colors.textSecondary, fontWeight: '600', fontSize: 12 },
  modalSave: { minWidth: 96, backgroundColor: '#7C3AED', borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, alignItems: 'center' },
  modalSaveText: { fontFamily: 'Cairo-Bold', color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  rowReverse: { flexDirection: 'row-reverse' },
  alignEnd: { alignItems: 'flex-end' },
  alignStart: { alignItems: 'flex-start' },
  textRTL: { textAlign: 'right' },
});
