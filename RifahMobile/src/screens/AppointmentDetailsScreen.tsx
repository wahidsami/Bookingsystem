import React, { useMemo, useState } from 'react';
import { Alert, ImageBackground, Linking, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
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
import { LinearGradient } from 'expo-linear-gradient';
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

export function AppointmentDetailsScreen({ route, navigation }: any) {
  const { language } = useLanguage();
  const { topInset, scrollBottomPadding } = useScreenSafeArea();
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
    const candidate = `${tenant?.whatsappNumber || tenant?.mobile || tenant?.phone || ''}`.trim();
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
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: spacing.lg }]}>
        <Text style={styles.emptyText}>{language === 'ar' ? 'تعذر تحميل تفاصيل الموعد.' : 'Unable to load appointment details.'}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Browse')}>
          <Text style={styles.primaryBtnText}>{language === 'ar' ? 'تصفح الخدمات' : 'Browse Services'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: scrollBottomPadding + spacing.lg }}>
        <ImageBackground source={tenantHeroUri ? { uri: tenantHeroUri } : undefined} style={[styles.hero, { paddingTop: topInset + spacing.sm }]} imageStyle={styles.heroImage}>
          <LinearGradient colors={tenantHeroUri ? ['rgba(38,12,89,0.82)', 'rgba(93,47,153,0.35)'] : ['#3B0E74', '#6D28D9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
          <View style={styles.heroTopBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.heroButton}>
              <AppIcon name="arrow_back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.heroButton}>
              <AppIcon name="share" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.heroTitle}>{language === 'ar' ? 'تفاصيل الموعد' : 'Appointment Details'}</Text>
          <Text style={styles.heroSubTitle}>{language === 'ar' ? 'تجربتك الصحية القادمة بانتظارك' : 'Your wellness experience awaits'}</Text>
        </ImageBackground>

        <View style={styles.contentWrap}>
          <View style={styles.summaryCard}>
          <Text style={styles.label}>{language === 'ar' ? 'رقم الحجز' : 'Booking No.'}</Text>
          <Text style={styles.bookingNumber} numberOfLines={1}>{getBookingNumber(representative)}</Text>
          <View style={styles.pillsRow}>
            <View style={[styles.pill, styles.statusPill]}><Text style={styles.statusPillText}>{getStatusText(group.status, language)}</Text></View>
            <View style={[styles.pill, styles.paymentPill]}><Text style={styles.paymentPillText}>{getPaymentStatusText(representative)}</Text></View>
          </View>
          <Text style={styles.metaText}>{group.tenant?.name || '-'}</Text>
          <Text style={styles.metaText}>
            {format(new Date(group.startTime), 'eeee, d MMMM yyyy, h:mm a', { locale: language === 'ar' ? ar : enUS })}
          </Text>
          </View>

          <View style={styles.metricsGrid}>
          <View style={styles.metricCell}><Text style={styles.metricLabel} numberOfLines={1}>{language === 'ar' ? 'الخدمات' : 'Services'}</Text><Text style={styles.metricValue} numberOfLines={1}>{group.items.length}</Text></View>
          <View style={styles.metricCell}><Text style={styles.metricLabel} numberOfLines={1}>{language === 'ar' ? 'الإجمالي' : 'Total'}</Text><Text style={styles.metricValue} numberOfLines={1}>{formatRiyal(group.totalPrice, language)}</Text></View>
          <View style={styles.metricCell}><Text style={styles.metricLabel} numberOfLines={1}>{language === 'ar' ? 'المطلوب الآن' : 'Payable Now'}</Text><Text style={styles.metricValue} numberOfLines={1}>{formatRiyal(group.payableNowTotal, language)}</Text></View>
          <View style={styles.metricCell}><Text style={styles.metricLabel} numberOfLines={1}>{language === 'ar' ? 'أول موعد' : 'First Appt.'}</Text><Text style={styles.metricValueSmall} numberOfLines={1}>{format(new Date(group.startTime), 'd MMM, h:mm a', { locale: language === 'ar' ? ar : enUS })}</Text></View>
          </View>

          {guest ? (
            <View style={styles.guestCard}>
              <Text style={styles.sectionTitle}>{language === 'ar' ? 'بيانات الضيف' : 'Guest Information'}</Text>
              <Text style={styles.guestName}>{guest.fullName}</Text>
              {!!guest.phone && <Text style={styles.guestPhone}>{guest.phone}</Text>}
              {!!guest.email && <Text style={styles.guestPhone}>{guest.email}</Text>}
              {!!guest.birthDate && <Text style={styles.guestPhone}>{guest.birthDate}</Text>}
            </View>
          ) : null}

          <View style={styles.paymentSummaryCard}>
            <Text style={styles.sectionTitle}>{language === 'ar' ? 'ملخص الدفع' : 'Payment Summary'}</Text>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>{language === 'ar' ? 'الإجمالي' : 'Subtotal'}</Text>
              <Text style={styles.paymentValue}>{formatRiyal(subtotalAmount, language)}</Text>
            </View>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>{language === 'ar' ? 'المدفوع' : 'Paid'}</Text>
              <Text style={styles.paymentValue}>- {formatRiyal(paidAmount, language)}</Text>
            </View>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentDueLabel}>{language === 'ar' ? 'المطلوب الآن' : 'Payable Now'}</Text>
              <Text style={styles.paymentDueValue}>{formatRiyal(Number(group.payableNowTotal || 0), language)}</Text>
            </View>
            {!!representative.paymentMethod && (
              <Text style={styles.paymentMethodHint}>
                {language === 'ar' ? 'طريقة الدفع' : 'Payment method'}: {getPaymentMethodLabel(representative.paymentMethod)}
              </Text>
            )}
          </View>

          <Text style={styles.sectionTitle}>{language === 'ar' ? 'الخدمات' : 'Services'}</Text>
          {group.items.map((booking, index) => (
            <View key={booking.id} style={styles.serviceCard}>
            <Text style={styles.serviceIndex}>{language === 'ar' ? `الخدمة ${index + 1}` : `Service ${index + 1}`}</Text>
            <Text style={styles.serviceName} numberOfLines={2}>{getServiceName(booking)}</Text>
            {!!booking.serviceVariantName && <Text style={styles.serviceVariant} numberOfLines={1}>{booking.serviceVariantName}</Text>}
            <Text style={styles.rowText} numberOfLines={2}>{format(new Date(booking.startTime), 'PPP p', { locale: language === 'ar' ? ar : enUS })}</Text>
            <Text style={styles.rowText} numberOfLines={1}>{language === 'ar' ? 'الموظف' : 'Provider'}: {getStaffName(booking)}</Text>
            <Text style={styles.rowText} numberOfLines={1}>{language === 'ar' ? 'الحالة' : 'Status'}: {getStatusText(booking.status, language)}</Text>
            <Text style={styles.rowText} numberOfLines={1}>{language === 'ar' ? 'الدفع' : 'Payment'}: {getPaymentStatusText(booking)}</Text>
            <Text style={styles.priceText} numberOfLines={1}>{formatRiyal(Number(booking.price || 0), language)}</Text>
            </View>
          ))} 

          {appointmentTimeline.length > 0 && (
            <View style={styles.timelineCard}>
              <Text style={styles.sectionTitle}>{language === 'ar' ? 'سجل التغييرات' : 'Activity Timeline'}</Text>
              {appointmentTimeline.slice(0, 8).map((event) => (
                <View key={event.id} style={styles.timelineRow}>
                  <View style={[styles.timelineDot, event.type === 'cancelled' ? styles.timelineDotDanger : styles.timelineDotPrimary]} />
                  <View style={styles.timelineBody}>
                    <Text style={styles.timelineTitle}>{event.title}</Text>
                    <Text style={styles.timelineSub}>{event.subtitle}</Text>
                    <Text style={styles.timelineTime}>
                      {formatTimelineDateTime(event.at, language)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={styles.primaryActionCard}>
            {Number(group.payableNowTotal || 0) > 0.009 && activeTab === 'upcoming' && (
              <TouchableOpacity
                style={styles.primaryBtn}
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
                <Text style={styles.primaryBtnText}>{language === 'ar' ? 'ادفع الآن' : 'Pay Now'}</Text>
              </TouchableOpacity>
            )}

            <View style={styles.secondaryActions}>
              {(representative.Service?.allowReschedule || representative.service?.allowReschedule) &&
              ['confirmed', 'pending'].includes(representative.status) &&
              activeTab === 'upcoming' ? (
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => openRescheduleChoice(representative)}>
                  <Text style={styles.secondaryBtnText} numberOfLines={1}>{language === 'ar' ? 'إعادة جدولة' : 'Reschedule'}</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.secondaryBtnPlaceholder} />
              )}

              {['confirmed', 'pending'].includes(representative.status) && activeTab === 'upcoming' ? (
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setCancelBookingTarget(representative)}>
                  <Text style={styles.cancelBtnText} numberOfLines={1}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.secondaryBtnPlaceholder} />
              )}
            </View>

            {activeTab === 'upcoming' && group?.status !== 'cancelled' ? (
              <TouchableOpacity style={styles.addServiceBtn} onPress={handleAddService}>
                <Text style={styles.addServiceBtnText}>{language === 'ar' ? 'إضافة خدمة' : 'Add service'}</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.contactBtn}
              onPress={handleContactCenter}
            >
              <Text style={styles.contactBtnText}>
                {language === 'ar' ? 'واتساب / الاتصال بالمركز' : 'WhatsApp / Call Center'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.policyNote}>
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
  container: { flex: 1, backgroundColor: '#FAF8FC' },
  hero: { minHeight: 240, paddingHorizontal: spacing.md, paddingBottom: spacing.lg, justifyContent: 'space-between', backgroundColor: '#5B21B6' },
  heroImage: { borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  heroTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  heroTitle: { fontSize: 32, fontWeight: '800', color: '#FFFFFF' },
  heroSubTitle: { fontSize: 12, color: 'rgba(255,255,255,0.9)' },
  contentWrap: { paddingHorizontal: spacing.md, marginTop: -38, gap: spacing.md },
  summaryCard: { borderRadius: 24, borderWidth: 1, borderColor: '#E8DDF8', backgroundColor: '#FFFFFF', padding: spacing.md, marginBottom: spacing.md },
  label: { color: colors.textSecondary, fontSize: 10 },
  bookingNumber: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4 },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm, marginBottom: spacing.sm },
  pill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  statusPill: { backgroundColor: '#E7F6ED' },
  statusPillText: { color: '#1D7E49', fontSize: 10, fontWeight: '700' },
  paymentPill: { backgroundColor: '#EFE7FF' },
  paymentPillText: { color: colors.primary, fontSize: 10, fontWeight: '700' },
  metaText: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  metricsGrid: { borderRadius: 20, borderWidth: 1, borderColor: '#E8DDF8', backgroundColor: '#FFFFFF', padding: spacing.md, marginBottom: spacing.md, flexDirection: 'row', flexWrap: 'wrap' },
  metricCell: { width: '50%', paddingVertical: spacing.sm, paddingRight: spacing.sm, minHeight: 56, justifyContent: 'center' },
  metricLabel: { fontSize: 10, color: colors.textSecondary },
  metricValue: { marginTop: 3, fontSize: 13, fontWeight: '800', color: colors.text },
  metricValueSmall: { marginTop: 3, fontSize: 11, fontWeight: '700', color: colors.text },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: '800', color: colors.text, marginBottom: spacing.sm, marginTop: spacing.xs },
  guestCard: { borderRadius: 20, backgroundColor: '#F4EEFF', borderWidth: 1, borderColor: '#E6DAFD', padding: spacing.md, marginBottom: spacing.md },
  guestName: { fontSize: 14, color: colors.text, fontWeight: '700' },
  guestPhone: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  paymentSummaryCard: { borderRadius: 20, borderWidth: 1, borderColor: '#E8DDF8', backgroundColor: '#FFFFFF', padding: spacing.md, marginBottom: spacing.md },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  paymentLabel: { color: colors.textSecondary, fontSize: 11 },
  paymentValue: { color: colors.text, fontSize: 11, fontWeight: '700' },
  paymentDueLabel: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  paymentDueValue: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  paymentMethodHint: { marginTop: spacing.xs, color: colors.textSecondary, fontSize: 10 },
  timelineCard: { borderRadius: 20, borderWidth: 1, borderColor: '#E8DDF8', backgroundColor: '#FFFFFF', padding: spacing.md, marginBottom: spacing.md },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: '#F2ECFC' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  timelineDotPrimary: { backgroundColor: colors.primary },
  timelineDotDanger: { backgroundColor: colors.error },
  timelineBody: { flex: 1 },
  timelineTitle: { color: colors.text, fontSize: 11, fontWeight: '700' },
  timelineSub: { color: colors.textSecondary, fontSize: 10, marginTop: 2 },
  timelineTime: { color: '#7B7F98', fontSize: 9, marginTop: 2 },
  serviceCard: { borderRadius: 20, borderWidth: 1, borderColor: '#E8DDF8', backgroundColor: '#FFFFFF', padding: spacing.md, marginBottom: spacing.md, overflow: 'hidden' },
  serviceIndex: { fontSize: 10, color: colors.primary, fontWeight: '700' },
  serviceName: { marginTop: 2, fontSize: 16, fontWeight: '800', color: colors.text },
  serviceVariant: { marginTop: 2, fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  rowText: { marginTop: 3, fontSize: 11, color: '#4B5072', flexShrink: 1 },
  priceText: { marginTop: spacing.sm, fontSize: 16, color: colors.primary, fontWeight: '800' },
  actionsWrap: { marginTop: spacing.sm, gap: spacing.sm },
  primaryBtn: { minHeight: 48, borderRadius: 14, backgroundColor: '#6D28D9', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700' },
  secondaryActions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'stretch' },
  secondaryBtn: { flex: 1, minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: spacing.sm },
  secondaryBtnText: { color: colors.primary, fontWeight: '700', fontSize: 12, textAlign: 'center' },
  cancelBtn: { flex: 1, minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.error, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: spacing.sm },
  cancelBtnText: { color: colors.error, fontWeight: '700', fontSize: 12, textAlign: 'center' },
  primaryActionCard: { borderRadius: 20, borderWidth: 1, borderColor: '#E8DDF8', backgroundColor: '#FFFFFF', padding: spacing.md, marginBottom: spacing.md, gap: spacing.sm },
  secondaryBtnPlaceholder: { flex: 1 },
  addServiceBtn: { minHeight: 46, borderRadius: 14, backgroundColor: '#6D28D9', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  addServiceBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  contactBtn: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: '#D7DAEA', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  contactBtnText: { color: '#4B5072', fontWeight: '700' },
  policyNote: { marginBottom: spacing.md, borderRadius: 14, borderWidth: 1, borderColor: '#E8EAF4', backgroundColor: '#FFFFFF', padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  policyText: { flex: 1, color: colors.textSecondary, fontSize: 10, lineHeight: 16 },
  emptyText: { color: colors.textSecondary, marginBottom: spacing.md, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(18, 13, 33, 0.55)', justifyContent: 'center', paddingHorizontal: spacing.sm },
  modalCard: {
    marginHorizontal: spacing.md,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9DDFD',
    padding: spacing.md,
    shadowColor: '#1F123F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
  modalCardLarge: { maxHeight: '72%' },
  modalScrollContent: { paddingBottom: spacing.sm },
  modalTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  modalHint: { color: colors.textSecondary, fontSize: 10, marginBottom: spacing.sm },
  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  reasonChip: { borderWidth: 1, borderColor: '#D8C7FA', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FFFFFF', minWidth: 96 },
  reasonChipActive: { borderColor: colors.primary, backgroundColor: '#F3E8FF' },
  reasonChipText: { color: colors.text, fontSize: 10, fontWeight: '600' },
  reasonChipTextActive: { color: colors.primary },
  reasonChipMeta: { marginTop: 2, color: colors.textSecondary, fontSize: 9, fontWeight: '600' },
  reasonChipMetaActive: { color: colors.primary },
  modalInput: { borderWidth: 1, borderColor: '#E9DDFD', borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: '#FAFAFF', color: colors.text, marginBottom: spacing.sm },
  modalDatePickerButton: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#E9DDFD',
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: '#FAFAFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalDatePickerText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  modalErrorText: { color: colors.error, fontSize: 10, marginBottom: spacing.sm, fontWeight: '600' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, flexWrap: 'wrap' },
  modalCancel: { minWidth: 96, borderWidth: 1, borderColor: '#D8C7FA', borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, alignItems: 'center', backgroundColor: '#F4EEFF' },
  modalCancelText: { color: colors.textSecondary, fontWeight: '600', fontSize: 12 },
  modalSave: { minWidth: 96, backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, alignItems: 'center' },
  modalSaveText: { color: colors.textInverse, fontWeight: '700', fontSize: 12 },
});
