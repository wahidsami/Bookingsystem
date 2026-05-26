import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { api, Booking } from '../api/client';
import { AppIcon } from '../components/AppIcon';
import { borderRadius, colors, fontSize, spacing } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenSafeArea } from '../utils/safeArea';

export function ReviewScreen({ route, navigation }: any) {
  const { appointmentId } = route.params || {};
  const { isRTL } = useLanguage();
  const { topInset, scrollBottomPadding } = useScreenSafeArea();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [appointment, setAppointment] = useState<Booking | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  useEffect(() => {
    const loadAppointment = async () => {
      if (!appointmentId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const booking = await api.getBooking(String(appointmentId));
        setAppointment(booking);
      } catch (error: any) {
        Alert.alert(
          isRTL ? 'خطأ' : 'Error',
          error?.message || (isRTL ? 'تعذر تحميل بيانات الموعد.' : 'Failed to load appointment details.')
        );
      } finally {
        setLoading(false);
      }
    };
    loadAppointment();
  }, [appointmentId, isRTL]);

  const handleSubmit = async () => {
    if (!appointment) return;
    if (rating <= 0) {
      Alert.alert(isRTL ? 'تنبيه' : 'Notice', isRTL ? 'يرجى اختيار تقييم.' : 'Please select a rating.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        tenantId: appointment.tenantId,
        staffId: appointment.staffId,
        appointmentId: appointment.id,
        rating,
        comment,
        customerName:
          (appointment as any).user?.firstName ||
          (appointment as any).legacyCustomer?.firstName ||
          'Valued Customer'
      };

      const response = await api.post<{ success: boolean; message?: string }>('/users/reviews', payload);
      if (!response.success) {
        Alert.alert(isRTL ? 'خطأ' : 'Error', response.message || (isRTL ? 'فشل إرسال التقييم.' : 'Failed to submit review.'));
        return;
      }

      Alert.alert(isRTL ? 'شكراً لك' : 'Thank you', isRTL ? 'تم إرسال تقييمك بنجاح.' : 'Your review was submitted successfully.', [
        {
          text: isRTL ? 'حسنًا' : 'OK',
          onPress: () => navigation.goBack()
        }
      ]);
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message || error?.message || 'Failed to submit review.';
      const duplicate = `${backendMessage}`.toLowerCase().includes('already submitted a review');
      if (duplicate) {
        Alert.alert(isRTL ? 'معلومة' : 'Info', isRTL ? 'تم إرسال تقييم لهذا الموعد من قبل.' : 'You already reviewed this appointment.', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
        return;
      }
      Alert.alert(isRTL ? 'خطأ' : 'Error', backendMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topInset + spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <AppIcon name="arrow_back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isRTL ? 'تقييم الموعد' : 'Appointment Review'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: scrollBottomPadding + spacing.lg }}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
        ) : !appointment ? (
          <Text style={styles.emptyText}>{isRTL ? 'تعذر تحميل بيانات الموعد.' : 'Unable to load appointment details.'}</Text>
        ) : (
          <View style={styles.card}>
            <Text style={styles.title}>{isRTL ? 'كيف كانت تجربتك؟' : 'How was your experience?'}</Text>
            <Text style={styles.subtitle}>
              {isRTL
                ? `قيّم الخدمة مع ${appointment.Staff?.name || appointment.staff?.name || '-'} في ${appointment.tenant?.name || '-'}`
                : `Rate your service with ${appointment.Staff?.name || appointment.staff?.name || '-'} at ${appointment.tenant?.name || '-'}`}
            </Text>

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRating(star)} style={{ padding: 2 }}>
                  <AppIcon name="star" size={38} color={star <= rating ? colors.warning : colors.borderStrong} />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.input}
              multiline
              numberOfLines={4}
              value={comment}
              onChangeText={setComment}
              textAlignVertical="top"
              placeholder={isRTL ? 'اكتب تعليقك (اختياري)' : 'Write your feedback (optional)'}
            />

            <TouchableOpacity style={[styles.submitButton, submitting ? { opacity: 0.7 } : null]} onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.submitText}>{isRTL ? 'إرسال التقييم' : 'Submit Review'}</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundGray
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text
  },
  headerSpacer: {
    width: 36
  },
  emptyText: {
    marginTop: spacing.lg,
    color: colors.textSecondary,
    fontSize: fontSize.sm
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text
  },
  subtitle: {
    marginTop: 6,
    fontSize: fontSize.sm,
    color: colors.textSecondary
  },
  starsRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs
  },
  input: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundGray,
    borderRadius: borderRadius.md,
    minHeight: 110,
    padding: spacing.md,
    fontSize: fontSize.sm,
    color: colors.text
  },
  submitButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center'
  },
  submitText: {
    color: colors.textInverse,
    fontSize: fontSize.md,
    fontWeight: '700'
  }
});
