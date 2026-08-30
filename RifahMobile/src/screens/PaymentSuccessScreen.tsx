import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { AppIcon } from '../components/AppIcon';
import { colors, spacing, fontSize } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenSafeArea } from '../utils/safeArea';
import { formatRiyal } from '../utils/currency';
import { useServiceBookingCart } from '../contexts/ServiceBookingCartContext';

type Participant = {
    name: string;
    services: string[];
};

type PaymentSuccessSummary = {
    primaryCustomer?: string;
    participants?: Participant[];
    services?: string[];
    date?: string;
    time?: string;
    employee?: string;
    salon?: string;
    subtotal?: number;
    tax?: number;
    deposit?: number | null;
    remaining?: number | null;
    total?: number;
};

export function PaymentSuccessScreen({ route, navigation }: any) {
    const { isRTL } = useLanguage();
    const { topInset, scrollBottomPadding } = useScreenSafeArea();
    const { clearCart } = useServiceBookingCart();

    useEffect(() => {
        // Only clear the cart on terminal success
        clearCart();
    }, [clearCart]);

    const appointmentId = route.params?.appointmentId || route.params?.bookingId || null;
    const summary: PaymentSuccessSummary = route.params?.paymentSummary || {};
    const participants = Array.isArray(summary.participants) ? summary.participants : [];

    const formattedParticipants = participants.length > 0
        ? participants
        : [{
            name: summary.primaryCustomer || (isRTL ? 'أنتِ' : 'You'),
            services: summary.services || [],
        }];

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPadding + 32 }]}>
                <View style={[styles.heroCard, { marginTop: topInset + spacing.lg }]}>
                    <View style={styles.heroIcon}>
                        <AppIcon name="verified_user" size={30} color={colors.primary} />
                    </View>
                    <Text style={styles.heroTitle}>{isRTL ? 'تم تأكيد الزيارة' : 'Visit Confirmed'}</Text>
                    <Text style={styles.heroSubtitle}>
                        {isRTL
                            ? 'تم حفظ الحجز بنجاح. إليكِ الملخص النهائي.'
                            : 'Your booking has been confirmed. Here is the final summary.'}
                    </Text>
                </View>

                <View style={styles.summaryCard}>
                    <Text style={styles.sectionTitle}>{isRTL ? 'تفاصيل الزيارة' : 'Visit details'}</Text>
                    <View>
                        {summary.date ? (
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>{isRTL ? 'التاريخ' : 'Date'}</Text>
                                <Text style={styles.summaryValue}>{summary.date}</Text>
                            </View>
                        ) : null}
                        {summary.time ? (
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>{isRTL ? 'الوقت' : 'Time'}</Text>
                                <Text style={styles.summaryValue}>{summary.time}</Text>
                            </View>
                        ) : null}
                        {summary.salon ? (
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>{isRTL ? 'الصالون' : 'Salon'}</Text>
                                <Text style={styles.summaryValue}>{summary.salon}</Text>
                            </View>
                        ) : null}
                        {summary.employee ? (
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>{isRTL ? 'الموظف' : 'Employee'}</Text>
                                <Text style={styles.summaryValue}>{summary.employee}</Text>
                            </View>
                        ) : null}
                    </View>
                </View>

                <View style={styles.summaryCard}>
                    <Text style={styles.sectionTitle}>{isRTL ? 'المشاركون' : 'Participants'}</Text>
                    {formattedParticipants.map((participant, index) => (
                        <View key={`${participant.name}-${index}`} style={styles.participantRow}>
                            <View style={styles.participantBadge}>
                                <AppIcon name={index === 0 ? 'verified_user' : 'user'} size={12} color={colors.primary} />
                                <Text style={styles.participantBadgeText}>{participant.name}</Text>
                            </View>
                            <Text style={styles.participantServices}>
                                {participant.services.length > 0
                                    ? participant.services.join(' · ')
                                    : (isRTL ? 'الخدمة الأساسية' : 'Primary service')}
                            </Text>
                        </View>
                    ))}
                </View>

                <View style={styles.summaryCard}>
                    <Text style={styles.sectionTitle}>{isRTL ? 'الملخص المالي' : 'Payment summary'}</Text>
                    <View style={styles.amountRow}>
                        <Text style={styles.amountLabel}>{isRTL ? 'المجموع الفرعي' : 'Subtotal'}</Text>
                        <Text style={styles.amountValue}>{formatRiyal(Number(summary.subtotal || 0), isRTL ? 'ar' : 'en')}</Text>
                    </View>
                    <View style={styles.amountRow}>
                        <Text style={styles.amountLabel}>{isRTL ? 'الضريبة' : 'Tax'}</Text>
                        <Text style={styles.amountValue}>
                            {Number(summary.tax || 0) > 0
                                ? formatRiyal(Number(summary.tax || 0), isRTL ? 'ar' : 'en')
                                : (isRTL ? 'غير متاح' : 'Unavailable')}
                        </Text>
                    </View>
                    {summary.deposit !== undefined ? (
                        <View style={styles.amountRow}>
                            <Text style={styles.amountLabel}>{isRTL ? 'العربون' : 'Deposit'}</Text>
                            <Text style={styles.amountValue}>
                                {summary.deposit === null
                                    ? (isRTL ? 'غير متاح' : 'Unavailable')
                                    : formatRiyal(Number(summary.deposit || 0), isRTL ? 'ar' : 'en')}
                            </Text>
                        </View>
                    ) : null}
                    {summary.remaining !== undefined ? (
                        <View style={styles.amountRow}>
                            <Text style={styles.amountLabel}>{isRTL ? 'المتبقي' : 'Remaining'}</Text>
                            <Text style={styles.amountValue}>
                                {summary.remaining === null
                                    ? (isRTL ? 'غير متاح' : 'Unavailable')
                                    : formatRiyal(Number(summary.remaining || 0), isRTL ? 'ar' : 'en')}
                            </Text>
                        </View>
                    ) : null}
                    <View style={[styles.amountRow, styles.totalRow]}>
                        <Text style={styles.totalLabel}>{isRTL ? 'الإجمالي' : 'Total'}</Text>
                        <Text style={styles.totalValue}>{formatRiyal(Number(summary.total || 0), isRTL ? 'ar' : 'en')}</Text>
                    </View>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => {
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'Tabs', params: { screen: 'Appointments' } }],
                        });
                    }}
                >
                    <Text style={styles.secondaryButtonText}>
                        {isRTL ? 'عرض الموعد' : 'View Appointment'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => {
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'Tabs', params: { screen: 'Home' } }],
                        });
                    }}
                >
                    <Text style={styles.primaryButtonText}>{isRTL ? 'العودة للرئيسية' : 'Return Home'}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F7F4FF',
    },
    content: {
        paddingHorizontal: spacing.lg,
        gap: spacing.lg,
    },
    heroCard: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 30,
        padding: spacing.xl,
        borderWidth: 1,
        borderColor: '#EAE1FA',
        shadowColor: '#241444',
        shadowOpacity: 0.06,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 2,
    },
    heroIcon: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F4EEFF',
        marginBottom: spacing.md,
    },
    heroTitle: {
        fontSize: 30,
        fontWeight: '900',
        color: colors.text,
        textAlign: 'center',
    },
    heroSubtitle: {
        marginTop: 8,
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
    summaryCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        borderWidth: 1,
        borderColor: '#EAE1FA',
        padding: spacing.lg,
        gap: spacing.sm,
    },
    sectionTitle: {
        fontSize: fontSize.xs,
        fontWeight: '900',
        letterSpacing: 0.6,
        color: colors.primary,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: 6,
    },
    summaryLabel: {
        flex: 1,
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        fontWeight: '700',
    },
    summaryValue: {
        flex: 1,
        fontSize: fontSize.sm,
        fontWeight: '900',
        color: colors.text,
        textAlign: 'right',
    },
    participantRow: {
        gap: 6,
        paddingVertical: 6,
    },
    participantBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: '#F8F5FF',
        borderWidth: 1,
        borderColor: '#EAE1FA',
    },
    participantBadgeText: {
        fontSize: fontSize.sm,
        fontWeight: '900',
        color: colors.text,
    },
    participantServices: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        fontWeight: '700',
    },
    amountRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
    },
    amountLabel: {
        flex: 1,
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        fontWeight: '700',
    },
    amountValue: {
        flex: 1,
        fontSize: fontSize.sm,
        fontWeight: '900',
        color: colors.text,
        textAlign: 'right',
    },
    totalRow: {
        borderTopWidth: 1,
        borderTopColor: '#EFE7FB',
        marginTop: 4,
        paddingTop: 12,
    },
    totalLabel: {
        flex: 1,
        fontSize: fontSize.md,
        color: colors.text,
        fontWeight: '900',
    },
    totalValue: {
        flex: 1,
        fontSize: fontSize.md,
        color: colors.primary,
        fontWeight: '900',
        textAlign: 'right',
    },
    footer: {
        flexDirection: 'row',
        gap: spacing.sm,
        padding: spacing.lg,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#EAE1FA',
    },
    secondaryButton: {
        flex: 1,
        minHeight: 52,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#EAE1FA',
    },
    secondaryButtonText: {
        fontSize: fontSize.sm,
        color: colors.text,
        fontWeight: '900',
    },
    primaryButton: {
        flex: 1,
        minHeight: 52,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
    },
    primaryButtonText: {
        fontSize: fontSize.sm,
        color: '#FFFFFF',
        fontWeight: '900',
    },
});
