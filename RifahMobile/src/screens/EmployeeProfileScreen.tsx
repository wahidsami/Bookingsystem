import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { AppIcon } from '../components/AppIcon';
import { api, getImageUrl, Staff } from '../api/client';
import { borderRadius, colors, fontSize, spacing } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenSafeArea } from '../utils/safeArea';

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
  const { topInset, scrollBottomPadding } = useScreenSafeArea();
  const [reviews, setReviews] = useState<StaffReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{ total: number; avgRating: number | null }>({ total: 0, avgRating: null });

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

  const avatarUrl = getImageUrl(provider.avatar || provider.image);
  const initials = provider.name?.charAt(0)?.toUpperCase() || '?';

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topInset + spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <AppIcon name="arrow_back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isRTL ? 'ملف الموظف' : 'Employee Profile'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPadding + spacing.lg }]}>
        <View style={styles.profileCard}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{initials}</Text>
            </View>
          )}
          <Text style={styles.name}>{provider.name}</Text>
          {provider.experience ? (
            <Text style={styles.metaText}>
              {isRTL ? `الخبرة: ${provider.experience}` : `Experience: ${provider.experience}`}
            </Text>
          ) : null}
          <View style={styles.ratingRow}>
            <AppIcon name="star" size={14} color={colors.warning} />
            <Text style={styles.ratingText}>
              {summary.avgRating ? summary.avgRating.toFixed(1) : (provider.rating || 0).toFixed(1)}
            </Text>
            <Text style={styles.reviewsCountText}>
              {summary.total} {isRTL ? 'تقييم' : 'reviews'}
            </Text>
          </View>
          {provider.bio ? <Text style={styles.bioText}>{provider.bio}</Text> : null}
          {Array.isArray(provider.skills) && provider.skills.length > 0 ? (
            <Text style={styles.skillsText}>{provider.skills.join(' • ')}</Text>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>{isRTL ? 'تقييمات العملاء' : 'Customer Reviews'}</Text>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
        ) : reviews.length === 0 ? (
          <Text style={styles.emptyText}>{isRTL ? 'لا توجد تقييمات منشورة بعد.' : 'No published reviews yet.'}</Text>
        ) : (
          reviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewAuthor}>{review.customerName || (isRTL ? 'عميل' : 'Customer')}</Text>
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
                  <Text style={styles.replyLabel}>{isRTL ? 'رد المركز' : 'Center reply'}</Text>
                  <Text style={styles.replyText}>{review.staffReply}</Text>
                </View>
              ) : null}
            </View>
          ))
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
  content: {
    padding: spacing.md
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    marginBottom: spacing.sm
  },
  avatarPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 42,
    marginBottom: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.border
  },
  avatarInitial: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text
  },
  name: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text
  },
  metaText: {
    marginTop: 4,
    fontSize: fontSize.sm,
    color: colors.textSecondary
  },
  ratingRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  ratingText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.text
  },
  reviewsCountText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary
  },
  bioText: {
    marginTop: spacing.md,
    fontSize: fontSize.sm,
    color: colors.text,
    textAlign: 'center'
  },
  skillsText: {
    marginTop: spacing.sm,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center'
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm
  },
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  reviewAuthor: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text
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
    fontSize: fontSize.sm,
    color: colors.text
  },
  replyBox: {
    marginTop: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.primary,
    backgroundColor: colors.backgroundGray,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: borderRadius.sm
  },
  replyLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4
  },
  replyText: {
    fontSize: fontSize.sm,
    color: colors.text
  }
});
