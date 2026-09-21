import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { ThemedText as Text } from '../ThemedText';
import { AppIcon } from '../AppIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatRiyal } from '../../utils/currency';
import { getImageUrl, SlotItem, Staff, getServicePrice } from '../../api/client';
import { ServiceBookingCartItem } from '../../contexts/ServiceBookingCartContext';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

export interface BookingSummaryCardProps {
    tenant: any;
    items: ServiceBookingCartItem[];
    selectedDate: Date;
    selectedSlot: SlotItem | null;
    totalDurationMinutes: number;
}

export function BookingSummaryCard({
    tenant,
    items,
    selectedDate,
    selectedSlot,
    totalDurationMinutes,
}: BookingSummaryCardProps) {
    const { isRTL, language } = useLanguage();
    const locale = isRTL ? ar : enUS;

    const salonName = isRTL
        ? tenant?.name_ar || tenant?.name_en || tenant?.name
        : tenant?.name_en || tenant?.name_ar || tenant?.name;
    const rating = tenant?.rating || '4.9';
    const reviewCount = tenant?.reviewCount || '128';
    const locationText =
        tenant?.address ||
        tenant?.city ||
        (isRTL ? 'الرياض، المملكة العربية السعودية' : 'Riyadh, Saudi Arabia');

    const formattedDate = format(selectedDate, 'EEEE, d MMMM yyyy', {
        locale,
    });

    const formatSlotTime = (isoString?: string) => {
        if (!isoString) return '';
        try {
            return format(new Date(isoString), 'p', { locale });
        } catch {
            return isoString;
        }
    };

    const startTimeFormatted = formatSlotTime(selectedSlot?.startTime);
    const endTimeFormatted = formatSlotTime(selectedSlot?.endTime);

    const formatDuration = (mins: number) => {
        if (mins < 60) {
            return isRTL ? `${mins} دقيقة` : `${mins} min`;
        }
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        if (m === 0) {
            return isRTL ? `${h} ساعة` : `${h}h`;
        }
        return isRTL ? `${h} س ${m} د` : `${h}h ${m}m`;
    };

    return (
        <View style={styles.container}>
            {/* Micro-Progress Step Indicator */}
            <View style={[styles.progressRow, isRTL && styles.rowRTL]}>
                <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeNumber}>3</Text>
                </View>
                <Text style={styles.stepText}>
                    {isRTL
                        ? 'الخطوة 3 من 3: المراجعة النهائية'
                        : 'Step 3 of 3: Final Review'}
                </Text>
            </View>

            {/* 1. Salon Info Card */}
            <View style={styles.card}>
                <View style={[styles.salonRow, isRTL && styles.rowRTL]}>
                    <View style={styles.logoContainer}>
                        {tenant?.logo ? (
                            <Image
                                source={{ uri: getImageUrl(tenant.logo) }}
                                style={styles.salonLogo}
                            />
                        ) : (
                            <View style={styles.logoPlaceholder}>
                                <AppIcon
                                    name="storefront"
                                    size={24}
                                    color="#6537C0"
                                />
                            </View>
                        )}
                    </View>

                    <View style={[styles.salonDetails, isRTL ? styles.salonDetailsRTL : styles.salonDetailsLTR]}>
                        <View style={[styles.salonTitleRow, isRTL && styles.rowRTL]}>
                            <Text style={[styles.salonName, isRTL && { textAlign: 'right' }]} numberOfLines={1}>
                                {salonName}
                            </Text>
                            <View style={[styles.ratingBadge, isRTL && styles.rowRTL]}>
                                <AppIcon
                                    name="star"
                                    size={12}
                                    color="#F59E0B"
                                />
                                <Text style={styles.ratingText}>{rating}</Text>
                            </View>
                        </View>
                        <Text style={[styles.reviewSub, isRTL && { textAlign: 'right' }]}>
                            {reviewCount}{' '}
                            {isRTL ? 'تقييم تم التحقق منه' : 'verified reviews'}
                        </Text>
                        <View style={[styles.locationRow, isRTL && styles.rowRTL]}>
                            <AppIcon
                                name="location"
                                size={14}
                                color="#6537C0"
                            />
                            <Text style={[styles.locationText, isRTL && { textAlign: 'right' }]} numberOfLines={1}>
                                {locationText}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* 2. Date & Time Schedule Card */}
            <View style={styles.card}>
                <View style={[styles.cardHeader, isRTL && styles.rowRTL]}>
                    <View style={styles.headerIconCircle}>
                        <AppIcon
                            name="calendar_today"
                            size={18}
                            color="#6537C0"
                        />
                    </View>
                    <View style={[styles.headerTextGroup, isRTL && styles.alignEnd]}>
                        <Text style={[styles.cardCaption, isRTL && { textAlign: 'right' }]}>
                            {isRTL ? 'موعد الزيارة' : 'Appointment Schedule'}
                        </Text>
                        <Text style={[styles.cardMainText, isRTL && { textAlign: 'right' }]}>{formattedDate}</Text>
                    </View>
                </View>

                {selectedSlot && (
                    <View style={[styles.schedulePillRow, isRTL && styles.rowRTL]}>
                        <View style={[styles.timeGroup, isRTL && styles.rowRTL]}>
                            <AppIcon
                                name="clock"
                                size={16}
                                color="#6537C0"
                            />
                            <Text style={styles.scheduleTimeText}>
                                {startTimeFormatted}{' '}
                                {endTimeFormatted
                                    ? `– ${endTimeFormatted}`
                                    : ''}
                            </Text>
                        </View>
                        <View style={styles.durationTag}>
                            <Text style={styles.durationTagText}>
                                {formatDuration(totalDurationMinutes)}{' '}
                                {isRTL ? 'إجمالي' : 'total'}
                            </Text>
                        </View>
                    </View>
                )}
            </View>

            {/* 3. Booked Services List */}
            <View style={styles.card}>
                <View style={[styles.cardHeader, isRTL && styles.rowRTL]}>
                    <View style={styles.headerIconCircle}>
                        <AppIcon name="sparkles" size={18} color="#6537C0" />
                    </View>
                    <Text style={[styles.cardTitle, isRTL && { textAlign: 'right' }]}>
                        {isRTL ? 'الخدمات المختارة' : 'Selected Services'} (
                        {items.length})
                    </Text>
                </View>

                <View style={styles.servicesList}>
                    {items.map((item, index) => {
                        const serviceName = isRTL
                            ? item.service.name_ar || item.service.name_en
                            : item.service.name_en || item.service.name_ar;
                        const duration = item.service.duration || 30;
                        const price = getServicePrice(item.service, item.variant);
                        const staff = item.staff;
                        const staffName = staff
                            ? isRTL
                                ? staff.name_ar || staff.name_en || staff.name
                                : staff.name_en || staff.name_ar || staff.name
                            : isRTL
                            ? 'أي مقدم خدمة'
                            : 'Any professional';

                        return (
                            <View
                                key={`${item.id}-${index}`}
                                style={[styles.serviceRow, isRTL && styles.rowRTL]}
                            >
                                <View style={[styles.serviceRowLeft, isRTL ? styles.serviceRowLeftRTL : styles.serviceRowLeftLTR]}>
                                    <Text style={[styles.serviceItemTitle, isRTL && { textAlign: 'right' }]}>
                                        {serviceName}
                                    </Text>
                                    <View style={[styles.serviceMetaRow, isRTL && styles.rowRTL]}>
                                        <View style={[styles.metaItem, isRTL && styles.rowRTL]}>
                                            <AppIcon
                                                name="clock"
                                                size={12}
                                                color="#716B88"
                                            />
                                            <Text style={styles.metaText}>
                                                {duration}{' '}
                                                {isRTL ? 'دقيقة' : 'min'}
                                            </Text>
                                        </View>
                                        <Text style={styles.bullet}>•</Text>
                                        <View style={[styles.metaItem, isRTL && styles.rowRTL]}>
                                            <AppIcon
                                                name="user"
                                                size={12}
                                                color="#6537C0"
                                            />
                                            <Text style={styles.staffMetaText}>
                                                {staffName}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                <Text style={styles.servicePrice}>
                                    {formatRiyal(price, language)}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 14,
    },
    stepBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#6537C0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepBadgeNumber: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    stepText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6537C0',
        fontFamily: 'Cairo-Bold',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        marginBottom: 12,
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    salonRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logoContainer: {
        width: 52,
        height: 52,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E7DDFC',
        backgroundColor: '#FAF9FC',
    },
    salonLogo: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    logoPlaceholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    salonDetails: {
        flex: 1,
        marginLeft: 12,
    },
    salonTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    salonName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
        flex: 1,
        marginRight: 6,
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#FAF9FC',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    ratingText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#1D035F',
    },
    reviewSub: {
        fontSize: 11,
        color: '#716B88',
        marginTop: 2,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
    },
    locationText: {
        fontSize: 12,
        color: '#716B88',
        flex: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    headerIconCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#F1ECFD',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTextGroup: {
        flex: 1,
    },
    cardCaption: {
        fontSize: 10,
        fontWeight: '600',
        color: '#716B88',
        textTransform: 'uppercase',
    },
    cardMainText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1D035F',
        marginTop: 1,
        fontFamily: 'Cairo-Bold',
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
    },
    schedulePillRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FAF9FC',
        padding: 10,
        borderRadius: 12,
        marginTop: 12,
    },
    timeGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    scheduleTimeText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1D035F',
    },
    durationTag: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    durationTagText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#6537C0',
    },
    servicesList: {
        marginTop: 12,
        gap: 8,
    },
    serviceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FAF9FC',
        padding: 12,
        borderRadius: 12,
    },
    serviceRowLeft: {
        flex: 1,
    },
    serviceRowLeftLTR: {
        marginRight: 8,
    },
    serviceRowLeftRTL: {
        marginLeft: 8,
        alignItems: 'flex-end',
    },
    serviceItemTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
    },
    serviceMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    metaText: {
        fontSize: 11,
        color: '#716B88',
    },
    bullet: {
        color: '#CBC3D6',
        fontSize: 10,
    },
    staffMetaText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#6537C0',
    },
    servicePrice: {
        fontSize: 14,
        fontWeight: '700',
        color: '#6537C0',
        fontFamily: 'Cairo-Bold',
    },
    rowRTL: {
        flexDirection: 'row-reverse',
    },
    alignEnd: {
        alignItems: 'flex-end',
    },
    salonDetailsLTR: {
        marginLeft: 12,
    },
    salonDetailsRTL: {
        marginRight: 12,
        alignItems: 'flex-end',
    },
});
