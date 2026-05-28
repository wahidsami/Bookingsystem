import React, { useMemo, useState } from 'react';
import { ImageBackground, Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { Booking, SlotItem, bookingNeedsPayment, getBookingOutstandingAmount } from '../api/client';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenSafeArea } from '../utils/safeArea';
import { AppIcon } from '../components/AppIcon';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { api } from '../api/client';
import { getImageUrl } from '../api/client';
import { LinearGradient } from 'expo-linear-gradient';

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

type GroupGuestMeta = {
  fullName: string;
  phone?: string | null;
};

const parseGroupGuestFromNotes = (notes?: string | null): GroupGuestMeta | null => {
  if (!notes) return null;
  const markerPrefix = '[GROUP_GUEST]';
  const lines = `${notes}`.split('\n').map((line) => line.trim()).filter(Boolean);
  const markerLine = lines.find((line) => line.startsWith(markerPrefix));
  if (!markerLine) return null;
  const jsonPart = markerLine.slice(markerPrefix.length).trim();
  if (!jsonPart) return null;
  try {
    const parsed = JSON.parse(jsonPart) as GroupGuestMeta;
    if (!parsed?.fullName || !`${parsed.fullName}`.trim()) return null;
    return { fullName: `${parsed.fullName}`.trim(), phone: parsed.phone ? `${parsed.phone}`.trim() : null };
  } catch {
    return null;
  }
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
  const activeTab = (route?.params?.activeTab as 'upcoming' | 'history' | undefined) || 'upcoming';
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
  const [feedback, setFeedback] = useState<{ visible: boolean; title: string; message: string }>({
    visible: false,
    title: '',
    message: '',
  });

  const representative = group?.items?.[0];
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
          <View style={styles.metricCell}><Text style={styles.metricLabel} numberOfLines={1}>{language === 'ar' ? 'الإجمالي' : 'Total'}</Text><Text style={styles.metricValue} numberOfLines={1}>{group.totalPrice.toFixed(2)} SAR</Text></View>
          <View style={styles.metricCell}><Text style={styles.metricLabel} numberOfLines={1}>{language === 'ar' ? 'المطلوب الآن' : 'Payable Now'}</Text><Text style={styles.metricValue} numberOfLines={1}>{group.payableNowTotal.toFixed(2)} SAR</Text></View>
          <View style={styles.metricCell}><Text style={styles.metricLabel} numberOfLines={1}>{language === 'ar' ? 'أول موعد' : 'First Appt.'}</Text><Text style={styles.metricValueSmall} numberOfLines={1}>{format(new Date(group.startTime), 'd MMM, h:mm a', { locale: language === 'ar' ? ar : enUS })}</Text></View>
          </View>

          {guest ? (
            <View style={styles.guestCard}>
            <Text style={styles.sectionTitle}>{language === 'ar' ? 'بيانات الضيف' : 'Guest Information'}</Text>
            <Text style={styles.guestName}>{guest.fullName}</Text>
            {!!guest.phone && <Text style={styles.guestPhone}>{guest.phone}</Text>}
            </View>
          ) : null}

          <View style={styles.paymentSummaryCard}>
            <Text style={styles.sectionTitle}>{language === 'ar' ? 'ملخص الدفع' : 'Payment Summary'}</Text>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>{language === 'ar' ? 'الإجمالي' : 'Subtotal'}</Text>
              <Text style={styles.paymentValue}>{subtotalAmount.toFixed(2)} SAR</Text>
            </View>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>{language === 'ar' ? 'المدفوع' : 'Paid'}</Text>
              <Text style={styles.paymentValue}>- {paidAmount.toFixed(2)} SAR</Text>
            </View>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentDueLabel}>{language === 'ar' ? 'المطلوب الآن' : 'Payable Now'}</Text>
              <Text style={styles.paymentDueValue}>{Number(group.payableNowTotal || 0).toFixed(2)} SAR</Text>
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
            <Text style={styles.priceText} numberOfLines={1}>{Number(booking.price || 0).toFixed(2)} SAR</Text>

            <View style={styles.actionsWrap}>
              {bookingNeedsPayment(booking.paymentStatus) && !['cancelled', 'completed', 'no_show'].includes(booking.status) && activeTab === 'upcoming' && (
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => navigation.navigate('Payment', {
                    appointmentId: booking.id,
                    amount: getBookingOutstandingAmount(booking),
                    tenantId: booking.tenantId || booking.tenant?.id,
                    paymentChoice: booking.paymentStatus === 'pending' && booking.paymentMethod === 'booking-fee' ? 'booking-fee' : undefined,
                  })}
                >
                  <Text style={styles.primaryBtnText}>{language === 'ar' ? 'ادفع الآن' : 'Pay Now'}</Text>
                </TouchableOpacity>
              )}
              {['confirmed', 'pending'].includes(booking.status) && activeTab === 'upcoming' && (
                <View style={styles.secondaryActions}>
                  {(booking.Service?.allowReschedule || booking.service?.allowReschedule) ? (
                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => openRescheduleChoice(booking)}>
                      <Text style={styles.secondaryBtnText} numberOfLines={1}>{language === 'ar' ? 'إعادة جدولة' : 'Reschedule'}</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setCancelBookingTarget(booking)}>
                    <Text style={styles.cancelBtnText} numberOfLines={1}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Text>
                  </TouchableOpacity>
                </View>
              )}
              {booking.status === 'completed' && activeTab === 'history' && (
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('Review', { appointmentId: booking.id })}>
                  <Text style={styles.secondaryBtnText} numberOfLines={1}>{language === 'ar' ? 'أضف تقييم' : 'Write Review'}</Text>
                </TouchableOpacity>
              )}
            </View>
            </View>
          ))}

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

            <TouchableOpacity
              style={styles.contactBtn}
              onPress={() =>
                showFeedback(
                  language === 'ar' ? 'قريباً' : 'Coming soon',
                  language === 'ar' ? 'التواصل مع المركز سيكون متاحاً قريباً.' : 'Contact center action will be available soon.'
                )
              }
            >
              <Text style={styles.contactBtnText}>{language === 'ar' ? 'التواصل مع المركز' : 'Contact Center'}</Text>
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
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{language === 'ar' ? 'اختر موعداً جديداً' : 'Choose New Slot'}</Text>
            <TextInput value={rescheduleDate} onChangeText={setRescheduleDate} placeholder="YYYY-MM-DD" autoCapitalize="none" style={styles.modalInput} />
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => rescheduleBooking && loadRescheduleSlots(rescheduleBooking, rescheduleKeepProvider, rescheduleDate)}
              disabled={rescheduleSlotsLoading}
            >
              <Text style={styles.secondaryBtnText}>{rescheduleSlotsLoading ? (language === 'ar' ? 'جارٍ التحميل...' : 'Loading...') : (language === 'ar' ? 'عرض المواعيد المتاحة' : 'Load Available Slots')}</Text>
            </TouchableOpacity>
            <View style={{ height: spacing.sm }} />
            <View style={styles.reasonRow}>
              {rescheduleSlots.map((slot) => {
                const label = format(new Date(slot.startTime), 'h:mm a', { locale: language === 'ar' ? ar : enUS });
                const selected = rescheduleSelectedSlot?.startTime === slot.startTime;
                return (
                  <TouchableOpacity key={slot.startTime} style={[styles.reasonChip, selected && styles.reasonChipActive]} onPress={() => setRescheduleSelectedSlot(slot)}>
                    <Text style={[styles.reasonChipText, selected && styles.reasonChipTextActive]}>{label}</Text>
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
          <View style={styles.modalCard}>
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
  heroTitle: { fontSize: 34, fontWeight: '800', color: '#FFFFFF' },
  heroSubTitle: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.9)' },
  contentWrap: { paddingHorizontal: spacing.md, marginTop: -38, gap: spacing.md },
  summaryCard: { borderRadius: 24, borderWidth: 1, borderColor: '#E8DDF8', backgroundColor: '#FFFFFF', padding: spacing.md, marginBottom: spacing.md },
  label: { color: colors.textSecondary, fontSize: 12 },
  bookingNumber: { fontSize: 24, fontWeight: '800', color: colors.text, marginTop: 4 },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm, marginBottom: spacing.sm },
  pill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  statusPill: { backgroundColor: '#E7F6ED' },
  statusPillText: { color: '#1D7E49', fontSize: 12, fontWeight: '700' },
  paymentPill: { backgroundColor: '#EFE7FF' },
  paymentPillText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  metaText: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  metricsGrid: { borderRadius: 20, borderWidth: 1, borderColor: '#E8DDF8', backgroundColor: '#FFFFFF', padding: spacing.md, marginBottom: spacing.md, flexDirection: 'row', flexWrap: 'wrap' },
  metricCell: { width: '50%', paddingVertical: spacing.sm, paddingRight: spacing.sm, minHeight: 56, justifyContent: 'center' },
  metricLabel: { fontSize: 12, color: colors.textSecondary },
  metricValue: { marginTop: 3, fontSize: 15, fontWeight: '800', color: colors.text },
  metricValueSmall: { marginTop: 3, fontSize: 13, fontWeight: '700', color: colors.text },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '800', color: colors.text, marginBottom: spacing.sm, marginTop: spacing.xs },
  guestCard: { borderRadius: 20, backgroundColor: '#F4EEFF', borderWidth: 1, borderColor: '#E6DAFD', padding: spacing.md, marginBottom: spacing.md },
  guestName: { fontSize: 16, color: colors.text, fontWeight: '700' },
  guestPhone: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  paymentSummaryCard: { borderRadius: 20, borderWidth: 1, borderColor: '#E8DDF8', backgroundColor: '#FFFFFF', padding: spacing.md, marginBottom: spacing.md },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  paymentLabel: { color: colors.textSecondary, fontSize: 13 },
  paymentValue: { color: colors.text, fontSize: 13, fontWeight: '700' },
  paymentDueLabel: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  paymentDueValue: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  paymentMethodHint: { marginTop: spacing.xs, color: colors.textSecondary, fontSize: 12 },
  serviceCard: { borderRadius: 20, borderWidth: 1, borderColor: '#E8DDF8', backgroundColor: '#FFFFFF', padding: spacing.md, marginBottom: spacing.md, overflow: 'hidden' },
  serviceIndex: { fontSize: 12, color: colors.primary, fontWeight: '700' },
  serviceName: { marginTop: 2, fontSize: 18, fontWeight: '800', color: colors.text },
  serviceVariant: { marginTop: 2, fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  rowText: { marginTop: 3, fontSize: 13, color: '#4B5072', flexShrink: 1 },
  priceText: { marginTop: spacing.sm, fontSize: 18, color: colors.primary, fontWeight: '800' },
  actionsWrap: { marginTop: spacing.sm, gap: spacing.sm },
  primaryBtn: { minHeight: 48, borderRadius: 14, backgroundColor: '#6D28D9', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700' },
  secondaryActions: { flexDirection: 'row', gap: spacing.sm },
  secondaryBtn: { flex: 1, minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  secondaryBtnText: { color: colors.primary, fontWeight: '700' },
  cancelBtn: { flex: 1, minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.error, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  cancelBtnText: { color: colors.error, fontWeight: '700' },
  primaryActionCard: { borderRadius: 20, borderWidth: 1, borderColor: '#E8DDF8', backgroundColor: '#FFFFFF', padding: spacing.md, marginBottom: spacing.md, gap: spacing.sm },
  secondaryBtnPlaceholder: { flex: 1 },
  contactBtn: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: '#D7DAEA', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  contactBtnText: { color: '#4B5072', fontWeight: '700' },
  policyNote: { marginBottom: spacing.md, borderRadius: 14, borderWidth: 1, borderColor: '#E8EAF4', backgroundColor: '#FFFFFF', padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  policyText: { flex: 1, color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  emptyText: { color: colors.textSecondary, marginBottom: spacing.md, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.5)', justifyContent: 'center' },
  modalCard: { marginHorizontal: spacing.lg, borderRadius: borderRadius.md, backgroundColor: '#FFFFFF', padding: spacing.md },
  modalTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  modalHint: { color: colors.textSecondary, fontSize: 12, marginBottom: spacing.sm },
  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  reasonChip: { borderWidth: 1, borderColor: '#D8C7FA', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FFFFFF' },
  reasonChipActive: { borderColor: colors.primary, backgroundColor: '#F3E8FF' },
  reasonChipText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  reasonChipTextActive: { color: colors.primary },
  modalInput: { borderWidth: 1, borderColor: '#E7DFFA', borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.text, marginBottom: spacing.sm },
  modalErrorText: { color: colors.error, fontSize: 12, marginBottom: spacing.sm, fontWeight: '600' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  modalCancel: { borderWidth: 1, borderColor: '#E7DFFA', borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  modalCancelText: { color: colors.textSecondary, fontWeight: '600' },
  modalSave: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  modalSaveText: { color: colors.textInverse, fontWeight: '700' },
});
