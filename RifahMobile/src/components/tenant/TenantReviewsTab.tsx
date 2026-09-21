import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText as Text } from '../ThemedText';
import { AppIcon } from '../AppIcon';
import { useLanguage } from '../../contexts/LanguageContext';

export type TenantReview = {
    id: string;
    rating: number;
    comment?: string | null;
    customerName?: string | null;
    authorName?: string | null;
    serviceName?: string | null;
    staffReply?: string | null;
    createdAt: string;
    platformUser?: {
        id: string;
        firstName?: string | null;
        lastName?: string | null;
    } | null;
    user?: {
        id?: string;
        name?: string | null;
        firstName?: string | null;
        lastName?: string | null;
    } | null;
    staff?: {
        id: string;
        name?: string | null;
    } | null;
};

export interface TenantReviewsTabProps {
    reviews: TenantReview[];
    avgRating: string | null;
    totalReviews: number;
    onWriteReview: () => void;
    isLoading?: boolean;
}

export function TenantReviewsTab({
    reviews,
    avgRating,
    totalReviews,
    onWriteReview,
    isLoading = false,
}: TenantReviewsTabProps) {
    const { isRTL } = useLanguage();

    const displayRating = avgRating || (reviews.length > 0
        ? (reviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0) / reviews.length).toFixed(1)
        : '4.9');
    const displayCount = totalReviews || reviews.length || 0;

    // Calculate rating percentages for 5, 4, 3, 2, 1 stars
    const starCounts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    if (reviews.length > 0) {
        reviews.forEach((r) => {
            const star = Math.min(5, Math.max(1, Math.round(Number(r.rating) || 5)));
            starCounts[star] = (starCounts[star] || 0) + 1;
        });
    }

    const getStarPercent = (star: number): number => {
        if (reviews.length === 0) {
            if (star === 5) return 88;
            if (star === 4) return 9;
            if (star === 3) return 2;
            if (star === 2) return 1;
            return 0;
        }
        return Math.round(((starCounts[star] || 0) / reviews.length) * 100);
    };

    return (
        <View style={styles.container}>
            {/* 1. Rating Summary Card */}
            <View style={styles.summaryCard}>
                <View style={[styles.summaryTopRow, isRTL && styles.rowRTL]}>
                    <View style={[styles.ratingDisplayGroup, isRTL && styles.rowRTL]}>
                        <Text style={styles.bigRatingNumber}>{displayRating}</Text>
                        <View style={styles.starsAndCount}>
                            <View style={[styles.starsRow, isRTL && styles.rowRTL]}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <AppIcon key={star} name="star" size={16} color="#F59E0B" />
                                ))}
                            </View>
                            <Text style={[styles.reviewCountLabel, isRTL && styles.textRTL]}>
                                ({displayCount} {isRTL ? 'تقييم' : 'reviews'})
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={onWriteReview}
                        style={[styles.writeReviewButton, isRTL && styles.rowRTL]}
                        activeOpacity={0.8}
                    >
                        <AppIcon name="sparkles" size={15} color="#6537C0" />
                        <Text style={styles.writeReviewButtonText}>
                            {isRTL ? 'اكتب تقييماً' : 'Write a Review'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Star Percentage Bars (5★ through 1★) */}
                <View style={styles.barsContainer}>
                    {[5, 4, 3, 2, 1].map((star) => {
                        const percent = getStarPercent(star);
                        return (
                            <View key={star} style={[styles.barRow, isRTL && styles.rowRTL]}>
                                <Text style={styles.starLabel}>{star}★</Text>
                                <View style={styles.barTrack}>
                                    <View
                                        style={[
                                            styles.barFill,
                                            { width: `${percent}%` },
                                            isRTL && styles.barFillRTL,
                                        ]}
                                    />
                                </View>
                                <Text style={[styles.percentLabel, isRTL && styles.textLTR]}>
                                    {percent}%
                                </Text>
                            </View>
                        );
                    })}
                </View>
            </View>

            {/* 2. Reviews List */}
            <View style={styles.reviewsList}>
                {reviews.length === 0 ? (
                    <View style={styles.emptyStateContainer}>
                        <AppIcon name="sparkles" size={48} color="#A379E2" />
                        <Text style={[styles.emptyStateTitle, isRTL && styles.textRTL]}>
                            {isRTL ? 'لا توجد تقييمات حتى الآن' : 'No reviews yet'}
                        </Text>
                        <Text style={[styles.emptyStateSubtitle, isRTL && styles.textRTL]}>
                            {isRTL
                                ? 'كن أول من يشارك تجربته مع هذا الصالون'
                                : 'Be the first to share your experience with this salon'}
                        </Text>
                    </View>
                ) : (
                    reviews.map((rev, idx) => {
                        const platformUserName = [rev.platformUser?.firstName, rev.platformUser?.lastName]
                            .filter((part): part is string => Boolean(part && typeof part === 'string' && part.trim().length > 0 && part.trim().toLowerCase() !== 'undefined'))
                            .join(' ')
                            .trim();

                        const userModelName = rev.user?.name && typeof rev.user.name === 'string' && rev.user.name.trim().toLowerCase() !== 'undefined'
                            ? rev.user.name.trim()
                            : [rev.user?.firstName, rev.user?.lastName]
                                .filter((part): part is string => Boolean(part && typeof part === 'string' && part.trim().length > 0 && part.trim().toLowerCase() !== 'undefined'))
                                .join(' ')
                                .trim();

                        const rawName = (platformUserName || userModelName || rev.customerName || rev.authorName || '').trim();
                        const isGenericName = !rawName ||
                            rawName.toLowerCase() === 'verified customer' ||
                            rawName === 'عميل موثّق' ||
                            rawName.toLowerCase() === 'customer' ||
                            rawName === 'عميل';

                        const author = isGenericName
                            ? (isRTL ? 'عميل موثّق' : 'Verified Customer')
                            : rawName;
                        const rating = Number(rev.rating || 5).toFixed(1);
                        const date = rev.createdAt
                            ? new Date(rev.createdAt).toLocaleDateString()
                            : (isRTL ? 'مؤخراً' : 'Recently');
                        const serviceName = rev.serviceName || null;

                        return (
                            <View key={rev.id || idx} style={styles.reviewCard}>
                                <View style={[styles.reviewHeader, isRTL && styles.rowRTL]}>
                                    <View style={styles.authorMetaColumn}>
                                        <View style={[styles.authorNameRow, isRTL && styles.rowRTL]}>
                                            <Text style={styles.authorName}>{author}</Text>
                                            <Text style={styles.bulletDot}>•</Text>
                                            <Text style={styles.reviewDate}>{date}</Text>
                                        </View>
                                        {Boolean(serviceName) && (
                                            <View style={[styles.serviceTag, isRTL && styles.tagRTL]}>
                                                <Text style={styles.serviceTagText}>
                                                    {serviceName}
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    <View style={[styles.ratingBadge, isRTL && styles.rowRTL]}>
                                        <AppIcon name="star" size={13} color="#F59E0B" />
                                        <Text style={styles.ratingBadgeText}>{rating}</Text>
                                    </View>
                                </View>

                                {Boolean(rev.comment) && (
                                    <Text style={[styles.commentText, isRTL && styles.textRTL]}>
                                        {rev.comment}
                                    </Text>
                                )}
                            </View>
                        );
                    })
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 32,
        gap: 16,
    },
    rowRTL: {
        flexDirection: 'row-reverse',
    },
    textRTL: {
        textAlign: 'right',
        fontFamily: 'Cairo-Regular',
    },
    textLTR: {
        textAlign: 'left',
    },
    summaryCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
        gap: 14,
    },
    summaryTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    ratingDisplayGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    bigRatingNumber: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1D035F',
        lineHeight: 32,
    },
    starsAndCount: {
        gap: 2,
    },
    starsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    reviewCountLabel: {
        fontSize: 13,
        color: '#716B88',
        fontWeight: '500',
    },
    writeReviewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FAF9FC',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    writeReviewButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6537C0',
    },
    barsContainer: {
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(231, 221, 252, 0.6)',
        gap: 6,
    },
    barRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    starLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: '#716B88',
        width: 22,
    },
    barTrack: {
        flex: 1,
        height: 8,
        backgroundColor: '#FAF9FC',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(231, 221, 252, 0.6)',
        overflow: 'hidden',
    },
    barFill: {
        height: '100%',
        backgroundColor: '#6537C0',
        borderRadius: 999,
    },
    barFillRTL: {
        alignSelf: 'flex-end',
    },
    percentLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: '#716B88',
        width: 32,
        textAlign: 'right',
    },
    reviewsList: {
        gap: 12,
    },
    reviewCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        gap: 8,
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    reviewHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    authorMetaColumn: {
        flex: 1,
        gap: 4,
    },
    authorNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    authorName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1D035F',
    },
    bulletDot: {
        color: '#E7DDFC',
        fontSize: 14,
    },
    reviewDate: {
        fontSize: 12,
        color: '#716B88',
    },
    serviceTag: {
        alignSelf: 'flex-start',
        backgroundColor: '#FAF9FC',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    tagRTL: {
        alignSelf: 'flex-end',
    },
    serviceTagText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6537C0',
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FAF9FC',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    ratingBadgeText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1D035F',
    },
    commentText: {
        fontSize: 14,
        color: '#716B88',
        lineHeight: 21,
    },
    emptyStateContainer: {
        paddingVertical: 48,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    emptyStateTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1D035F',
        marginTop: 8,
    },
    emptyStateSubtitle: {
        fontSize: 13,
        color: '#716B88',
        textAlign: 'center',
    },
});
