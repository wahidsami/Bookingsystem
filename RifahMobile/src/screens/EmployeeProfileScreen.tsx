import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { AppIcon } from '../components/AppIcon';
import { api, Booking, getImageUrl, Staff } from '../api/client';
import { colors, fontSize, spacing } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenSafeArea } from '../utils/safeArea';
import { ReviewPromptModal } from '../components/ReviewPromptModal';
import { useAppSession } from '../contexts/AppSessionContext';

type StaffReview = {
  id: string;
  rating: number;
  comment?: string | null;
  customerName?: string | null;
  staffReply?: string | null;
  createdAt: string;
};

export function EmployeeProfileScreen({ route, navigation }: any) {
  const { provider } = route.params;
  const { isRTL } = useLanguage();
  const { isAuthenticated } = useAppSession();
  const tenantName = route?.params?.tenant?.name || route?.params?.tenant?.name_en || route?.params?.tenant?.name_ar;
  const replyLabel = isRTL ? `رد ${tenantName || 'المركز'}` : `${tenantName || 'Center'} reply`;
  const { topInset, scrollBottomPadding } = useScreenSafeArea();
  const [reviews, setReviews] = useState<StaffReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{ total: number; avgRating: number | null }>({ total: 0, avgRating: null });
  const [reviewTargetBooking, setReviewTargetBooking] = useState<Booking | null>(null);
  const [reviewEligibleBookings, setReviewEligibleBookings] = useState<Booking[]>([]);
  const [reviewedAppointmentIds, setReviewedAppointmentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadReviews = async () => {
      try {
        setLoading(true);
        const response = await api.get<{ success: boolean; reviews: StaffReview[]; summary?: { total: number; avgRating: number | null } }>(
          `/public/staff/${provider.id}/reviews?limit=20`
        );
        if (response.success) {
          const nextReviews = response.reviews || [];
          setReviews(nextReviews);
          setSummary({
            total: response.summary?.total || nextReviews.length,
            avgRating: response.summary?.avgRating ?? null
          });
        }
      } catch (error) {
        console.warn('Failed to load staff profile reviews:', error);
      } finally {
        setLoading(false);
      }
    };

    loadReviews();
  }, [provider.id]);

  useEffect(() => {
    const loadReviewEligibility = async () => {
      try {
        if (!isAuthenticated) {
          setReviewEligibleBookings([]);
          setReviewedAppointmentIds(new Set());
          return;
        }

        const [completedBookings, myReviews] = await Promise.all([
          api.getBookings('completed'),
          api.getMyReviews(200).catch(() => []),
        ]);

        const reviewedIds = new Set<string>(
          (myReviews || [])
            .map((review: any) => review?.appointmentId)
            .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
        );

        setReviewedAppointmentIds(reviewedIds);
        setReviewEligibleBookings(completedBookings || []);
      } catch (error) {
        console.warn('Failed to load provider review eligibility:', error);
        setReviewEligibleBookings([]);
      }
    };

    loadReviewEligibility();
  }, [isAuthenticated]);

  const openProviderReviewPrompt = () => {
    const tenantId = provider?.tenantId || route?.params?.tenant?.id;
    const eligibleBooking = reviewEligibleBookings.find((booking) =>
      booking.status === 'completed'
      && booking.staffId === provider.id
      && (!tenantId || booking.tenantId === tenantId)
      && !reviewedAppointmentIds.has(booking.id)
    );

    if (!eligibleBooking) {
      return;
    }

    setReviewTargetBooking(eligibleBooking);
  };

  const hasEligibleBookingForReview = reviewEligibleBookings.some((booking) => {
    const tenantId = provider?.tenantId || route?.params?.tenant?.id;
    return booking.status === 'completed'
      && booking.staffId === provider.id
      && (!tenantId || booking.tenantId === tenantId)
      && !reviewedAppointmentIds.has(booking.id);
  });

  const avatarUrl = getImageUrl(provider.avatar || provider.image);
  const initials = provider.name?.charAt(0)?.toUpperCase() || '?';
  const displayRating = summary.avgRating ? summary.avgRating.toFixed(1) : (provider.rating || 0).toFixed(1);
  const subtitle = provider.specialty || provider.role || (isRTL ? 'مقدم خدمة' : 'Service Provider');

  return (
    <View style={styles.container}>
      <View style={[styles.heroHeader, { paddingTop: topInset + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.glassButton}>
          <AppIcon name={isRTL ? 'arrow_forward' : 'arrow_back'} size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.heroActions}>
          <TouchableOpacity style={styles.glassButton}>
            <AppIcon name="share" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPadding + 120 }]}>
        <View style={styles.profileHeroCard}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{initials}</Text>
            </View>
          )}
          <Text style={styles.name}>{provider.name}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          {provider.experience ? (
            <View style={styles.experiencePill}>
              <AppIcon name="sparkles" size={13} color={colors.primary} />
              <Text style={styles.experienceText}>{isRTL ? `الخبرة: ${provider.experience}` : `Experience: ${provider.experience}`}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statBlock}>
            <Text style={styles.statValue}>{displayRating}</Text>
            <View style={styles.starsRow}>
              {Array.from({ length: 5 }).map((_, index) => (
                <Text key={`overall-star-${index}`} style={[styles.star, index < Math.round(Number(displayRating)) ? styles.starActive : null]}>★</Text>
              ))}
            </View>
            <Text style={styles.statLabel}>{isRTL ? 'متوسط التقييم' : 'Average rating'}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Text style={styles.statValue}>{summary.total}</Text>
            <Text style={styles.statLabel}>{isRTL ? 'إجمالي التقييمات' : 'Total reviews'}</Text>
          </View>
        </View>

        {provider.bio ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{isRTL ? 'نبذة' : 'About'}</Text>
            <Text style={styles.bioText}>{provider.bio}</Text>
          </View>
        ) : null}

        {Array.isArray(provider.skills) && provider.skills.length > 0 ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{isRTL ? 'المهارات' : 'Skills'}</Text>
            <View style={styles.skillsWrap}>
              {provider.skills.map((skill: string, index: number) => (
                <View key={`${skill}-${index}`} style={styles.skillChip}>
                  <Text style={styles.skillChipText}>{skill}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <View style={styles.reviewsHeaderRow}>
            <Text style={styles.sectionTitle}>{isRTL ? 'تقييمات العملاء' : 'Customer Reviews'}</Text>
            {hasEligibleBookingForReview ? (
              <TouchableOpacity style={styles.writeReviewButton} onPress={openProviderReviewPrompt}>
                <AppIcon name="star" size={14} color="#FFFFFF" />
                <Text style={styles.writeReviewButtonText}>{isRTL ? 'إضافة تقييم' : 'Write Review'}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
          ) : reviews.length === 0 ? (
            <Text style={styles.emptyText}>{isRTL ? 'لا توجد تقييمات منشورة بعد.' : 'No published reviews yet.'}</Text>
          ) : (
            reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewAuthor}>
                    {review.customerName && review.customerName.toLowerCase() !== 'valued customer'
                      ? review.customerName
                      : (isRTL ? 'عميل موثّق' : 'Verified Customer')}
                  </Text>
                  <View style={styles.starsRow}>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Text
                        key={`${review.id}-star-${index}`}
                        style={[styles.star, index < Number(review.rating || 0) ? styles.starActive : null]}
                      >
                        ★
                      </Text>
                    ))}
                  </View>
                </View>
                {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
                {review.staffReply ? (
                  <View style={styles.replyBox}>
                    <Text style={styles.replyLabel}>{replyLabel}</Text>
                    <Text style={styles.replyText}>{review.staffReply}</Text>
                  </View>
                ) : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(scrollBottomPadding, 14) }]}>
        <TouchableOpacity style={styles.primaryCta} onPress={() => navigation.goBack()}>
          <Text style={styles.primaryCtaText}>{isRTL ? 'العودة للخدمات' : 'Back to services'}</Text>
        </TouchableOpacity>
      </View>

      <ReviewPromptModal
        visible={!!reviewTargetBooking}
        appointment={reviewTargetBooking}
        onClose={() => setReviewTargetBooking(null)}
        onSuccess={async () => {
          setReviewTargetBooking(null);
          const response = await api.get<{ success: boolean; reviews: StaffReview[]; summary?: { total: number; avgRating: number | null } }>(
            `/public/staff/${provider.id}/reviews?limit=20`
          );
          if (response.success) {
            const nextReviews = response.reviews || [];
            setReviews(nextReviews);
            setSummary({
              total: response.summary?.total || nextReviews.length,
              avgRating: response.summary?.avgRating ?? null
            });
          }
          const myReviews = await api.getMyReviews(200).catch(() => []);
          const reviewedIds = new Set<string>(
            (myReviews || [])
              .map((review: any) => review?.appointmentId)
              .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
          );
          setReviewedAppointmentIds(reviewedIds);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F6FB'
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm
  },
  heroActions: {
    flexDirection: 'row',
    gap: 10
  },
  glassButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF'
  },
  content: {
    padding: spacing.md
  },
  profileHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#ECE6FA',
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: spacing.sm
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDE7FF'
  },
  avatarInitial: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.primary
  },
  name: {
    fontSize: 30,
    fontWeight: '800',
    color: '#15153E'
  },
  subtitle: {
    marginTop: 4,
    fontSize: 16,
    color: '#646B89',
    fontWeight: '600'
  },
  experiencePill: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F3EEFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  experienceText: {
    color: '#4D4B73',
    fontSize: 13,
    fontWeight: '600'
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#ECE6FA',
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md
  },
  statBlock: {
    flex: 1,
    alignItems: 'center'
  },
  statValue: {
    fontSize: 30,
    fontWeight: '800',
    color: '#221A62'
  },
  statLabel: {
    fontSize: 12,
    color: '#767D9D',
    marginTop: 4
  },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#E7E2F6',
    marginHorizontal: 10
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#ECE6FA',
    padding: spacing.md,
    marginBottom: spacing.md
  },
  bioText: {
    marginTop: 4,
    fontSize: 16,
    color: '#4D5576',
    lineHeight: 24
  },
  skillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#171840',
    marginBottom: spacing.sm
  },
  reviewsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs
  },
  writeReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  writeReviewButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  skillChip: {
    borderRadius: 999,
    backgroundColor: '#F3EEFF',
    borderWidth: 1,
    borderColor: '#E4DBFC',
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  skillChipText: {
    color: '#4F4672',
    fontSize: 13,
    fontWeight: '600'
  },
  emptyText: {
    color: '#737A9A',
    fontSize: 14
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EDE9FA',
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#1D1540',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  reviewAuthor: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E1E47'
  },
  starsRow: {
    flexDirection: 'row'
  },
  star: {
    fontSize: fontSize.md,
    color: colors.borderStrong,
    marginLeft: 2
  },
  starActive: {
    color: colors.warning
  },
  reviewComment: {
    fontSize: 15,
    color: '#4F5678',
    lineHeight: 22
  },
  replyBox: {
    marginTop: spacing.sm,
    borderLeftWidth: 2.5,
    borderLeftColor: '#6E34DB',
    backgroundColor: '#F8F4FF',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10
  },
  replyLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4
  },
  replyText: {
    fontSize: fontSize.sm,
    color: '#3F4567'
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 14,
    shadowColor: '#1A1340',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8
  },
  primaryCta: {
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryCtaText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800'
  }
});
