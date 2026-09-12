import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View, Image } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { AppIcon } from '../components/AppIcon';
import { colors, spacing, fontSize } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenSafeArea } from '../utils/safeArea';
import { formatRiyal } from '../utils/currency';
import { useServiceBookingCart } from '../contexts/ServiceBookingCartContext';
import { getImageUrl } from '../api/client';

type Participant = { name: string; services: string[]; };
type PaymentSuccessSummary = {
    primaryCustomer?: string; participants?: Participant[]; services?: string[];
    date?: string; time?: string; employee?: string; salon?: string; salonImage?: string;
    subtotal?: number; tax?: number; deposit?: number | null; remaining?: number | null; total?: number;
    paymentMethod?: string;
};

export function PaymentSuccessScreen({ route, navigation }: any) {
    const { isRTL } = useLanguage();
    const { topInset, bottomInset, scrollBottomPadding } = useScreenSafeArea();
    const { clearCart } = useServiceBookingCart();

    const [animationOn, setAnimationOn] = useState(true);

    useEffect(() => {
        clearCart();
        // Simulate celebration animation
        const timer = setTimeout(() => setAnimationOn(false), 2000);
        return () => clearTimeout(timer);
    }, [clearCart]);

    const appointmentId = route.params?.appointmentId || route.params?.bookingId || null;
    const summary: PaymentSuccessSummary = route.params?.paymentSummary || {};
    const participants = Array.isArray(summary.participants) ? summary.participants : [];
    const formattedParticipants = participants.length > 0 ? participants : [{ name: summary.primaryCustomer || (isRTL ? 'أنتِ' : 'You'), services: summary.services || [] }];

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: topInset }]}>
                <View style={styles.headerSpacer} />
                <Text style={styles.headerTitle}>{isRTL ? 'تأكيد الحجز' : 'Booking Confirmation'}</Text>
                <TouchableOpacity style={styles.closeButton} onPress={() => navigation.navigate('TenantScreen')}>
                    <AppIcon name="close" size={24} color={colors.text} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPadding + 140 }]}>
                
                {/* Hero Confirmation Delight State */}
                <View style={styles.heroContainer}>
                    <View style={styles.heroIconWrapper}>
                        <View style={[styles.heroRing, animationOn && styles.heroRingPulsing]} />
                        <View style={styles.heroIconInner}>
                            <AppIcon name="check" size={32} color="#FFFFFF" />
                        </View>
                    </View>
                    <Text style={styles.heroTitle}>{isRTL ? 'تم تأكيد الزيارة' : 'Visit Confirmed'}</Text>
                </View>

                {/* Appointment Details Pass Card */}
                <View style={styles.passCard}>
                    {/* Salon Hero Image */}
                    <View style={styles.passImageContainer}>
                        <Image source={{ uri: summary.salonImage ? getImageUrl(summary.salonImage) : 'https://via.placeholder.com/400x150' }} style={styles.passImage} />
                        <View style={styles.passImageGradient} />
                        <View style={styles.passImageTextContainer}>
                            <Text style={styles.passSalonName}>{summary.salon || 'BarSpa'}</Text>
                            <Text style={styles.passSalonLocation}>{isRTL ? 'الرياض' : 'Al Olaya, Riyadh'}</Text>
                        </View>
                    </View>

                    <View style={styles.passDetails}>
                        {/* Time & Schedule */}
                        <View style={styles.passDateTime}>
                            <View style={styles.passDateCol}>
                                <Text style={styles.passDateLabel}>{isRTL ? 'التاريخ' : 'DATE'}</Text>
                                <Text style={styles.passDateValue}>{summary.date || '-'}</Text>
                            </View>
                            <View style={styles.passDateCol}>
                                <Text style={styles.passDateLabel}>{isRTL ? 'الوقت' : 'TIME'}</Text>
                                <Text style={styles.passDateValue}>{summary.time || '-'}</Text>
                            </View>
                        </View>

                        {/* Treatments List */}
                        <View style={styles.passTreatments}>
                            <Text style={styles.passTreatmentsLabel}>{isRTL ? 'العلاجات' : 'TREATMENTS'}</Text>
                            {formattedParticipants.map((p, idx) => (
                                <View key={idx} style={styles.passTreatmentRow}>
                                    <Text style={styles.passTreatmentService}>{p.services.join(' · ') || (isRTL ? 'خدمة' : 'Service')}</Text>
                                    <Text style={styles.passTreatmentPerson}>مع {summary.employee || (isRTL ? 'أي مختص' : 'Any Professional')}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Guest & Payment Summary */}
                        <View style={styles.passFooter}>
                            <View style={styles.passFooterRow}>
                                <Text style={styles.passFooterLabel}>{isRTL ? 'الضيف' : 'Guest'}</Text>
                                <Text style={styles.passFooterValue}>{formattedParticipants[0]?.name}</Text>
                            </View>
                            <View style={styles.passFooterRow}>
                                <Text style={styles.passFooterLabel}>{isRTL ? 'الدفع' : 'Payment'}</Text>
                                <Text style={styles.passFooterValue}>{summary.paymentMethod || 'Online'}</Text>
                            </View>
                            <View style={styles.passFooterDivider} />
                            <View style={styles.passFooterRow}>
                                <Text style={styles.passFooterTotalLabel}>{isRTL ? 'إجمالي المدفوع' : 'Total Paid'}</Text>
                                <Text style={styles.passFooterTotalValue}>{formatRiyal(Number(summary.total || 0), isRTL ? 'ar' : 'en')}</Text>
                            </View>
                        </View>
                    </View>
                </View>

            </ScrollView>

            <View style={[styles.footer, { paddingBottom: Math.max(bottomInset, spacing.lg) }]}>
                <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'Appointments' } }] })}>
                    <Text style={styles.primaryButtonText}>{isRTL ? 'عرض في مواعيدي' : 'View in My Appointments'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Tabs', params: { screen: 'Home' } }] })}>
                    <Text style={styles.secondaryButtonText}>{isRTL ? 'العودة للرئيسية' : 'Return Home'}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAF9FC' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    headerSpacer: { width: 40 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text },
    closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', borderRadius: 20 },
    content: { padding: spacing.md, alignItems: 'center' },
    heroContainer: { alignItems: 'center', marginVertical: spacing.xl },
    heroIconWrapper: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
    heroRing: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: '#E7DDFC' },
    heroRingPulsing: { opacity: 0.5, transform: [{ scale: 1.2 }] },
    heroIconInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
    heroTitle: { fontSize: 28, fontWeight: '900', color: colors.text },
    passCard: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 24, overflow: 'hidden', shadowColor: '#1D035F', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
    passImageContainer: { width: '100%', height: 160, position: 'relative' },
    passImage: { width: '100%', height: '100%' },
    passImageGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '100%', backgroundColor: 'rgba(0,0,0,0.4)' },
    passImageTextContainer: { position: 'absolute', bottom: spacing.md, left: spacing.md },
    passSalonName: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 2 },
    passSalonLocation: { fontSize: 14, color: '#E5E7EB' },
    passDetails: { padding: spacing.lg },
    passDateTime: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg },
    passDateCol: { flex: 1 },
    passDateLabel: { fontSize: 11, fontWeight: 'bold', color: colors.textSecondary, marginBottom: 4, letterSpacing: 0.5 },
    passDateValue: { fontSize: 16, fontWeight: 'bold', color: colors.text },
    passTreatments: { marginBottom: spacing.lg },
    passTreatmentsLabel: { fontSize: 11, fontWeight: 'bold', color: colors.textSecondary, marginBottom: 8, letterSpacing: 0.5 },
    passTreatmentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
    passTreatmentService: { fontSize: 15, fontWeight: '600', color: colors.text },
    passTreatmentPerson: { fontSize: 14, color: colors.textSecondary },
    passFooter: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: spacing.md, marginTop: spacing.sm },
    passFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
    passFooterLabel: { fontSize: 14, color: colors.textSecondary },
    passFooterValue: { fontSize: 14, fontWeight: '600', color: colors.text },
    passFooterDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
    passFooterTotalLabel: { fontSize: 16, fontWeight: 'bold', color: colors.text },
    passFooterTotalValue: { fontSize: 16, fontWeight: '900', color: colors.primary },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg },
    primaryButton: { backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginBottom: spacing.sm },
    primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
    secondaryButton: { backgroundColor: 'transparent', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
    secondaryButtonText: { color: colors.textSecondary, fontSize: 16, fontWeight: 'bold' },
});
