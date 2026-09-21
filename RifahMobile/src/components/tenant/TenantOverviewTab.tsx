import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Linking } from 'react-native';
import { ThemedText as Text } from '../ThemedText';
import { AppIcon } from '../AppIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import { Tenant, Staff, getImageUrl } from '../../api/client';
import { TenantReview } from '../../screens/TenantScreen';

export interface TenantOverviewTabProps {
    tenant: Tenant;
    staff: Staff[];
    reviews: TenantReview[];
    avgRating: string | null;
    totalReviews: number;
    onViewAllReviews: () => void;
    onOpenMap?: () => void;
    onContactSocial?: (type: 'whatsapp' | 'instagram' | 'phone' | 'website', value?: string) => void;
}

export function TenantOverviewTab({
    tenant,
    staff,
    reviews,
    avgRating,
    totalReviews,
    onViewAllReviews,
    onOpenMap,
    onContactSocial,
}: TenantOverviewTabProps) {
    const { isRTL } = useLanguage();

    const displayRating = avgRating || '4.9';
    const displayReviewsCount = totalReviews || reviews.length;

    const description = tenant.description || tenant.description_ar || tenant.description_en || (
        isRTL
            ? 'مرحباً بكم في صالوننا، وجهتكم المتميزة للاسترخاء والعناية المتكاملة بالجمال مع نخبة من أمهر المتخصصين.'
            : 'Welcome to our salon, your premier retreat for holistic beauty and rejuvenating treatments with certified specialists.'
    );

    const locationText = [tenant.address, tenant.city, tenant.country].filter(Boolean).join(', ') || (isRTL ? 'الرياض، المملكة العربية السعودية' : 'Riyadh, Saudi Arabia');

    const handleOpenMapPress = () => {
        if (onOpenMap) {
            onOpenMap();
            return;
        }
        if (tenant.googleMapLink) {
            Linking.openURL(tenant.googleMapLink).catch(() => {});
            return;
        }
        if (tenant.coordinates?.lat && tenant.coordinates?.lng) {
            const url = `https://www.google.com/maps/search/?api=1&query=${tenant.coordinates.lat},${tenant.coordinates.lng}`;
            Linking.openURL(url).catch(() => {});
        } else if (tenant.address || tenant.city) {
            const query = encodeURIComponent(`${tenant.name || ''} ${tenant.address || ''} ${tenant.city || ''}`);
            Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`).catch(() => {});
        }
    };

    const handleSocialPress = (type: 'whatsapp' | 'instagram' | 'phone' | 'website') => {
        if (onContactSocial) {
            onContactSocial(type);
            return;
        }
        const phone = tenant.whatsappNumber || tenant.mobile || tenant.phone;
        if (type === 'whatsapp' && phone) {
            const cleanPhone = phone.replace(/[^0-9+]/g, '');
            Linking.openURL(`whatsapp://send?phone=${cleanPhone}`).catch(() => {
                Linking.openURL(`https://wa.me/${cleanPhone}`).catch(() => {});
            });
        } else if (type === 'phone' && phone) {
            Linking.openURL(`tel:${phone}`).catch(() => {});
        } else if (type === 'instagram' && tenant.instagramUrl) {
            Linking.openURL(tenant.instagramUrl).catch(() => {});
        } else if (type === 'website' && tenant.website) {
            Linking.openURL(tenant.website.startsWith('http') ? tenant.website : `https://${tenant.website}`).catch(() => {});
        }
    };

    const recentReviews = reviews.slice(0, 2);

    return (
        <View style={styles.container}>
            {/* 1. About Information Card */}
            <View style={styles.card}>
                <Text style={[styles.sectionTitle, isRTL && styles.titleRTL]}>
                    {isRTL ? 'معلومات عن الصالون' : 'About Information'}
                </Text>
                <Text style={[styles.bodyText, isRTL && styles.textRTL]}>
                    {description}
                </Text>
            </View>

            {/* 2. Team / Specialists Subsection */}
            {staff.length > 0 && (
                <View style={styles.sectionBlock}>
                    <View style={[styles.sectionHeaderRow, isRTL && styles.rowRTL]}>
                        <Text style={[styles.sectionTitle, isRTL && styles.titleRTL]}>
                            {isRTL ? 'فريق العمل' : 'Team'}
                        </Text>
                        <Text style={styles.sectionSubtitle}>
                            {staff.length} {isRTL ? 'أخصائي' : staff.length === 1 ? 'Specialist' : 'Specialists'}
                        </Text>
                    </View>

                    <View style={styles.listContainer}>
                        {staff.map((member) => {
                            const name = isRTL ? member.name_ar || member.name : member.name_en || member.name;
                            const initial = (name || 'S').trim().charAt(0).toUpperCase();
                            const role = member.role || member.specialty || (isRTL ? 'أخصائي تجميل' : 'Beauty Specialist');
                            const staffRating = member.rating ? Number(member.rating).toFixed(1) : '5.0';
                            const rawAvatar = member.avatar || member.image || (member as any).photo;
                            const avatarUri = rawAvatar ? getImageUrl(rawAvatar) || rawAvatar : undefined;

                            return (
                                <View
                                    key={member.id}
                                    style={[styles.providerCard, isRTL && styles.rowRTL]}
                                >
                                    <View style={[styles.providerInfo, isRTL && styles.rowRTL]}>
                                        {avatarUri ? (
                                            <Image
                                                source={{ uri: avatarUri }}
                                                style={styles.avatarImage}
                                            />
                                        ) : (
                                            <View style={styles.avatarPlaceholder}>
                                                <Text style={styles.avatarInitial}>{initial}</Text>
                                            </View>
                                        )}
                                        <View style={styles.providerTextContainer}>
                                            <Text style={[styles.providerName, isRTL ? styles.textRTL : styles.textLTR]}>
                                                {name}
                                            </Text>
                                            <Text style={[styles.providerRole, isRTL ? styles.textRTL : styles.textLTR]}>
                                                {role}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={[styles.ratingBadge, isRTL && styles.rowRTL]}>
                                        <AppIcon name="star" size={14} color="#F59E0B" />
                                        <Text style={styles.ratingBadgeText}>{staffRating}</Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </View>
            )}

            {/* 3. Reviews Subsection Preview */}
            <View style={styles.sectionBlock}>
                <View style={[styles.sectionHeaderRow, isRTL && styles.rowRTL]}>
                    <Text style={[styles.sectionTitle, isRTL && styles.titleRTL]}>
                        {isRTL ? 'التقييمات' : 'Reviews'}
                    </Text>
                    <TouchableOpacity
                        onPress={onViewAllReviews}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Text style={styles.viewAllAction}>
                            {isRTL ? 'عرض الكل' : 'View All'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Rating Summary Banner */}
                <View style={[styles.summaryBanner, isRTL && styles.rowRTL]}>
                    <View style={[styles.ratingDisplayGroup, isRTL && styles.rowRTL]}>
                        <Text style={styles.summaryRatingNumber}>{displayRating}</Text>
                        <View style={[styles.starsRow, isRTL && styles.rowRTL]}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <AppIcon key={star} name="star" size={15} color="#F59E0B" />
                            ))}
                        </View>
                    </View>
                    <Text style={styles.summaryReviewCount}>
                        ({displayReviewsCount} {isRTL ? 'تقييم' : 'reviews'})
                    </Text>
                </View>

                {/* Customer Review Previews */}
                {recentReviews.length > 0 ? (
                    <View style={styles.listContainer}>
                        {recentReviews.map((rev, idx) => {
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
                            const isGeneric = !rawName ||
                                rawName.toLowerCase() === 'verified customer' ||
                                rawName === 'عميل موثّق' ||
                                rawName.toLowerCase() === 'customer' ||
                                rawName === 'عميل';

                            const displayName = isGeneric ? (isRTL ? 'عميل موثّق' : 'Verified Customer') : rawName;

                            return (
                                <View key={rev.id || idx} style={styles.reviewCard}>
                                    <View style={[styles.reviewHeaderRow, isRTL && styles.rowRTL]}>
                                        <View style={[styles.reviewerMeta, isRTL && styles.rowRTL]}>
                                            <Text style={styles.reviewerName}>
                                                {displayName}
                                            </Text>
                                            <Text style={styles.bulletDot}>•</Text>
                                            <Text style={styles.reviewDate}>
                                                {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString() : (isRTL ? 'مؤخراً' : 'Recently')}
                                            </Text>
                                        </View>
                                        <View style={[styles.ratingBadge, isRTL && styles.rowRTL]}>
                                            <AppIcon name="star" size={13} color="#F59E0B" />
                                            <Text style={styles.ratingBadgeText}>
                                                {Number(rev.rating || 5).toFixed(1)}
                                            </Text>
                                        </View>
                                    </View>
                                    {Boolean(rev.comment) && (
                                        <Text style={[styles.reviewComment, isRTL && styles.textRTL]}>
                                            "{rev.comment}"
                                        </Text>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                ) : null}
            </View>

            {/* 4. Location & Contact Card */}
            <View style={styles.card}>
                <View style={[styles.locationRow, isRTL && styles.rowRTL]}>
                    <View style={[styles.locationLeft, isRTL && styles.rowRTL]}>
                        <View style={styles.locationIconBox}>
                            <AppIcon name="location" size={18} color="#6537C0" />
                        </View>
                        <View style={styles.locationTexts}>
                            <Text style={[styles.locationTitle, isRTL && styles.textRTL]} numberOfLines={1}>
                                {locationText}
                            </Text>
                            <Text style={[styles.locationDistance, isRTL && styles.textRTL]}>
                                {tenant.city || (isRTL ? 'الرياض' : 'Riyadh')}
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={handleOpenMapPress}
                        style={[styles.mapButton, isRTL && styles.rowRTL]}
                        activeOpacity={0.8}
                    >
                        <AppIcon name="globe" size={14} color="#6537C0" />
                        <Text style={styles.mapButtonText}>
                            {isRTL ? 'عرض على الخريطة' : 'View on Map'}
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={[styles.connectRow, isRTL && styles.rowRTL]}>
                    <Text style={styles.connectLabel}>
                        {isRTL ? 'تواصل معنا' : 'Connect with us'}
                    </Text>
                    <View style={styles.socialIconsGroup}>
                        {(Boolean(tenant.whatsappNumber) || Boolean(tenant.mobile) || Boolean(tenant.phone)) && (
                            <TouchableOpacity
                                onPress={() => handleSocialPress('whatsapp')}
                                style={styles.socialIconButton}
                                activeOpacity={0.8}
                                accessibilityLabel="WhatsApp"
                            >
                                <AppIcon name="message" size={16} color="#6537C0" />
                            </TouchableOpacity>
                        )}
                        {(Boolean(tenant.phone) || Boolean(tenant.mobile)) && (
                            <TouchableOpacity
                                onPress={() => handleSocialPress('phone')}
                                style={styles.socialIconButton}
                                activeOpacity={0.8}
                                accessibilityLabel="Phone"
                            >
                                <AppIcon name="phone" size={16} color="#6537C0" />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            onPress={() => handleSocialPress('instagram')}
                            style={styles.socialIconButton}
                            activeOpacity={0.8}
                            accessibilityLabel="Instagram"
                        >
                            <AppIcon name="instagram" size={16} color="#6537C0" />
                        </TouchableOpacity>
                        {Boolean(tenant.website) && (
                            <TouchableOpacity
                                onPress={() => handleSocialPress('website')}
                                style={styles.socialIconButton}
                                activeOpacity={0.8}
                                accessibilityLabel="Website"
                            >
                                <AppIcon name="website" size={16} color="#6537C0" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
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
    card: {
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
        gap: 10,
    },
    sectionBlock: {
        gap: 12,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1D035F',
    },
    titleRTL: {
        fontFamily: 'Cairo-Bold',
    },
    sectionSubtitle: {
        fontSize: 13,
        color: '#716B88',
        fontWeight: '500',
    },
    bodyText: {
        fontSize: 14,
        color: '#716B88',
        lineHeight: 22,
    },
    textRTL: {
        textAlign: 'right',
        fontFamily: 'Cairo-Regular',
    },
    textLTR: {
        textAlign: 'left',
        writingDirection: 'ltr',
    },
    rowRTL: {
        flexDirection: 'row-reverse',
    },
    listContainer: {
        gap: 10,
    },
    providerCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    providerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    avatarImage: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    avatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#6537C0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitial: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
    providerTextContainer: {
        flex: 1,
        gap: 2,
    },
    providerName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1D035F',
    },
    providerRole: {
        fontSize: 13,
        color: '#716B88',
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FAF9FC',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    ratingBadgeText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1D035F',
    },
    viewAllAction: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6537C0',
    },
    summaryBanner: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    ratingDisplayGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    summaryRatingNumber: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1D035F',
    },
    starsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    summaryReviewCount: {
        fontSize: 13,
        color: '#716B88',
        fontWeight: '500',
    },
    reviewCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        gap: 6,
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    reviewHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    reviewerMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    reviewerName: {
        fontSize: 14,
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
    reviewComment: {
        fontSize: 14,
        color: '#716B88',
        lineHeight: 20,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    locationLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    locationIconBox: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FAF9FC',
        borderWidth: 1,
        borderColor: '#E7DDFC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    locationTexts: {
        flex: 1,
        gap: 2,
    },
    locationTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1D035F',
    },
    locationDistance: {
        fontSize: 12,
        color: '#716B88',
    },
    mapButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FAF9FC',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    mapButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6537C0',
    },
    connectRow: {
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(231, 221, 252, 0.6)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    connectLabel: {
        fontSize: 13,
        color: '#716B88',
        fontWeight: '500',
    },
    socialIconsGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    socialIconButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FAF9FC',
        borderWidth: 1,
        borderColor: '#E7DDFC',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
