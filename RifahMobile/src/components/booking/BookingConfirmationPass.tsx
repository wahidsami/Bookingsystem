import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { ThemedText as Text } from '../ThemedText';
import { AppIcon } from '../AppIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatRiyal } from '../../utils/currency';
import { getImageUrl } from '../../api/client';

export interface BookingConfirmationPassProps {
    salonName: string;
    salonAddress?: string;
    salonCoverImage?: string;
    dateFormatted: string;
    timeFormatted: string;
    totalDurationFormatted: string;
    services: Array<{
        name: string;
        duration: number;
        staffName?: string;
        price: number;
    }>;
    guestName?: string;
    guestPhone?: string;
    paymentMethodLabel: string;
    bookingReference?: string;
    totalPrice: number;
    onViewAppointments: () => void;
    onGoHome: () => void;
}

export function BookingConfirmationPass({
    salonName,
    salonAddress,
    salonCoverImage,
    dateFormatted,
    timeFormatted,
    totalDurationFormatted,
    services,
    guestName,
    guestPhone,
    paymentMethodLabel,
    bookingReference,
    totalPrice,
    onViewAppointments,
    onGoHome,
}: BookingConfirmationPassProps) {
    const { isRTL, language } = useLanguage();

    return (
        <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
        >
            {/* 1. Hero Delight State */}
            <View style={styles.heroSection}>
                <View style={styles.pulseOuterRing}>
                    <View style={styles.pulseInnerRing}>
                        <View style={styles.checkCircle}>
                            <AppIcon name="check" size={32} color="#FFFFFF" />
                        </View>
                    </View>
                </View>

                <Text style={styles.heroTitle}>
                    {isRTL ? 'تم تأكيد الزيارة!' : 'Visit Confirmed!'}
                </Text>
                <Text style={styles.heroSubtitle}>
                    {isRTL
                        ? `تم تأكيد حجزك في ${salonName} بنجاح.`
                        : `Your booking at ${salonName} is confirmed.`}
                </Text>

                {bookingReference ? (
                    <View style={[styles.refPill, isRTL && styles.rowReverse]}>
                        <Text style={styles.refPillLabel}>
                            {isRTL ? 'رقم الحجز:' : 'Ref:'}
                        </Text>
                        <Text style={styles.refPillValue}>
                            {bookingReference}
                        </Text>
                    </View>
                ) : null}
            </View>

            {/* 2. Appointment Pass Card */}
            <View style={styles.passCard}>
                {/* Salon Banner */}
                <View style={styles.bannerContainer}>
                    {salonCoverImage ? (
                        <Image
                            source={{ uri: getImageUrl(salonCoverImage) }}
                            style={styles.bannerImage}
                        />
                    ) : (
                        <View style={styles.bannerPlaceholder} />
                    )}
                    <View style={styles.bannerOverlay}>
                        <Text style={[styles.bannerSalonName, isRTL && styles.textRTL]} numberOfLines={1}>
                            {salonName}
                        </Text>
                        {salonAddress ? (
                            <View style={[styles.bannerLocationRow, isRTL && styles.rowReverse]}>
                                <AppIcon
                                    name="location"
                                    size={12}
                                    color="#E7DDFC"
                                />
                                <Text
                                    style={styles.bannerLocationText}
                                    numberOfLines={1}
                                >
                                    {salonAddress}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                </View>

                <View style={styles.passContent}>
                    {/* Time & Schedule Banner */}
                    <View style={[styles.scheduleBanner, isRTL && styles.rowReverse]}>
                        <View style={styles.scheduleIconBox}>
                            <AppIcon
                                name="calendar_today"
                                size={20}
                                color="#FFFFFF"
                            />
                        </View>
                        <View style={[styles.scheduleTextGroup, isRTL && { alignItems: 'flex-end' }]}>
                            <Text
                                style={styles.scheduleDate}
                                numberOfLines={1}
                            >
                                {dateFormatted}
                            </Text>
                            <Text style={styles.scheduleTime}>
                                {timeFormatted} • {totalDurationFormatted}
                            </Text>
                        </View>
                    </View>

                    {/* Booked Treatments */}
                    <View style={styles.treatmentsSection}>
                        <Text style={[styles.sectionLabel, isRTL && styles.textRTL]}>
                            {isRTL ? 'الخدمات المحجوزة' : 'Booked Treatments'}
                        </Text>
                        <View style={styles.treatmentsList}>
                            {services.map((srv, idx) => (
                                <View
                                    key={`${srv.name}-${idx}`}
                                    style={[styles.treatmentRow, isRTL && styles.rowReverse]}
                                >
                                    <View style={styles.treatmentIconBox}>
                                        <AppIcon
                                            name="sparkles"
                                            size={16}
                                            color="#6537C0"
                                        />
                                    </View>
                                    <View style={[styles.treatmentDetails, isRTL ? styles.treatmentDetailsRTL : styles.treatmentDetailsLTR]}>
                                        <Text
                                            style={[styles.treatmentName, isRTL && styles.textRTL]}
                                            numberOfLines={1}
                                        >
                                            {srv.name}
                                        </Text>
                                        <Text style={[styles.treatmentMeta, isRTL && styles.textRTL]}>
                                            {srv.staffName
                                                ? `${srv.staffName} • `
                                                : ''}
                                            {srv.duration}{' '}
                                            {isRTL ? 'دقيقة' : 'min'}
                                        </Text>
                                    </View>
                                    <Text style={styles.treatmentPrice}>
                                        {formatRiyal(srv.price, language)}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Guest & Payment Summary Box */}
                    <View style={styles.summaryBox}>
                        {guestName ? (
                            <View style={[styles.summaryRow, isRTL && styles.rowReverse]}>
                                <Text style={styles.summaryLabel}>
                                    {isRTL ? 'اسم العميل' : 'Guest'}
                                </Text>
                                <Text style={styles.summaryValue}>
                                    {guestName}
                                </Text>
                            </View>
                        ) : null}

                        {guestPhone ? (
                            <View style={[styles.summaryRow, isRTL && styles.rowReverse]}>
                                <Text style={styles.summaryLabel}>
                                    {isRTL ? 'رقم الاتصال' : 'Contact'}
                                </Text>
                                <Text style={styles.summaryValue}>
                                    {guestPhone}
                                </Text>
                            </View>
                        ) : null}

                        <View style={[styles.summaryRow, isRTL && styles.rowReverse]}>
                            <Text style={styles.summaryLabel}>
                                {isRTL ? 'طريقة الدفع' : 'Payment Method'}
                            </Text>
                            <View style={[styles.paymentMethodGroup, isRTL && styles.rowReverse]}>
                                <AppIcon
                                    name="card"
                                    size={14}
                                    color="#6537C0"
                                />
                                <Text style={styles.paymentMethodValue}>
                                    {paymentMethodLabel}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.boxDivider} />

                        <View style={[styles.summaryRow, isRTL && styles.rowReverse]}>
                            <Text style={styles.totalLabel}>
                                {isRTL ? 'المبلغ الإجمالي' : 'Total Amount'}
                            </Text>
                            <Text style={styles.totalValue}>
                                {formatRiyal(totalPrice, language)}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* 3. Action Buttons */}
            <View style={styles.actionsSection}>
                <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={onViewAppointments}
                    activeOpacity={0.8}
                >
                    <Text style={styles.primaryButtonText}>
                        {isRTL ? 'عرض مواعيدي' : 'View Appointments'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={onGoHome}
                    activeOpacity={0.8}
                >
                    <Text style={styles.secondaryButtonText}>
                        {isRTL ? 'العودة للرئيسية' : 'Back to Home'}
                    </Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        flex: 1,
        backgroundColor: '#FAF9FC',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 40,
    },
    heroSection: {
        alignItems: 'center',
        marginBottom: 20,
    },
    pulseOuterRing: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: 'rgba(231, 221, 252, 0.4)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    pulseInnerRing: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(231, 221, 252, 0.7)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkCircle: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: '#6537C0',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#6537C0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    heroTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
        textAlign: 'center',
    },
    heroSubtitle: {
        fontSize: 13,
        color: '#716B88',
        textAlign: 'center',
        marginTop: 4,
        paddingHorizontal: 16,
    },
    refPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        marginTop: 10,
    },
    refPillLabel: {
        fontSize: 11,
        color: '#716B88',
        fontWeight: '500',
    },
    refPillValue: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6537C0',
    },
    passCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E7DDFC',
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
        marginBottom: 20,
    },
    bannerContainer: {
        height: 110,
        position: 'relative',
        backgroundColor: '#413182',
    },
    bannerImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    bannerPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#351F6F',
    },
    bannerOverlay: {
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(29, 3, 95, 0.45)',
        justifyContent: 'flex-end',
        padding: 14,
    },
    bannerSalonName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
        fontFamily: 'Cairo-Bold',
    },
    bannerLocationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    bannerLocationText: {
        fontSize: 11,
        color: '#E7DDFC',
    },
    passContent: {
        padding: 16,
        gap: 16,
    },
    scheduleBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FAF9FC',
        padding: 12,
        borderRadius: 14,
        gap: 12,
    },
    scheduleIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#6537C0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scheduleTextGroup: {
        flex: 1,
    },
    scheduleDate: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
    },
    scheduleTime: {
        fontSize: 12,
        color: '#716B88',
        marginTop: 2,
    },
    treatmentsSection: {
        gap: 8,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#716B88',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    treatmentsList: {
        gap: 8,
    },
    treatmentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FAF9FC',
        padding: 10,
        borderRadius: 12,
    },
    treatmentIconBox: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#F1ECFD',
        alignItems: 'center',
        justifyContent: 'center',
    },
    treatmentDetails: {
        flex: 1,
    },
    treatmentDetailsLTR: {
        marginLeft: 10,
        marginRight: 0,
    },
    treatmentDetailsRTL: {
        marginLeft: 0,
        marginRight: 10,
    },
    treatmentName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1D035F',
    },
    treatmentMeta: {
        fontSize: 11,
        color: '#716B88',
        marginTop: 1,
    },
    treatmentPrice: {
        fontSize: 13,
        fontWeight: '700',
        color: '#6537C0',
        fontFamily: 'Cairo-Bold',
    },
    summaryBox: {
        backgroundColor: '#FAF9FC',
        padding: 14,
        borderRadius: 14,
        gap: 8,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    summaryLabel: {
        fontSize: 12,
        color: '#716B88',
    },
    summaryValue: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1D035F',
    },
    paymentMethodGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    paymentMethodValue: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6537C0',
    },
    boxDivider: {
        height: 1,
        backgroundColor: '#E7DDFC',
        marginVertical: 4,
    },
    totalLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
    },
    totalValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#6537C0',
        fontFamily: 'Cairo-Bold',
    },
    actionsSection: {
        gap: 10,
    },
    primaryButton: {
        backgroundColor: '#6537C0',
        height: 52,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#6537C0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
        fontFamily: 'Cairo-Bold',
    },
    secondaryButton: {
        backgroundColor: '#FFFFFF',
        height: 50,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    secondaryButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#716B88',
        fontFamily: 'Cairo-Bold',
    },
    rowReverse: {
        flexDirection: 'row-reverse',
    },
    textRTL: {
        textAlign: 'right',
        writingDirection: 'rtl',
    },
});
