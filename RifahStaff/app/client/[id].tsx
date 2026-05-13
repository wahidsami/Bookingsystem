import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getImageUrl } from '../../src/services/api';
import { getClientSummary, StaffClientSummary } from '../../src/services/clients';
import { formatDateSafe } from '../../src/utils/safeDate';

const formatMoney = (value: number) => `SAR ${Number(value || 0).toFixed(2)}`;

export default function ClientProfileScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [client, setClient] = useState<StaffClientSummary | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            if (!id) {
                setError('Client not found.');
                setLoading(false);
                return;
            }

            try {
                const data = await getClientSummary(id);
                setClient(data);
            } catch (err: any) {
                setError(err?.response?.data?.message || err?.message || 'Failed to load client profile.');
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [id]);

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#8B5ADF" />
                </View>
            </SafeAreaView>
        );
    }

    if (!client) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centerContainer}>
                    <Ionicons name="alert-circle-outline" size={56} color="#d1d5db" />
                    <Text style={styles.emptyTitle}>{error || 'Unable to load client profile.'}</Text>
                    <TouchableOpacity style={styles.backChip} onPress={() => router.back()}>
                        <Text style={styles.backChipText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const avatarUri = getImageUrl(client.customer.profileImage);
    const initial = client.customer.firstName?.charAt(0)?.toUpperCase() || client.customer.lastName?.charAt(0)?.toUpperCase() || 'C';

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <LinearGradient colors={['#8B5ADF', '#683AB7']} style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#ffffff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Client Profile</Text>
                <View style={{ width: 40 }} />
            </LinearGradient>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.profileCard}>
                    <View style={styles.profileTop}>
                        {avatarUri ? (
                            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                        ) : (
                            <View style={styles.avatarFallback}>
                                <Text style={styles.avatarInitial}>{initial}</Text>
                            </View>
                        )}
                        <View style={styles.profileMeta}>
                            <Text style={styles.name}>{client.customer.firstName} {client.customer.lastName}</Text>
                            <Text style={styles.subtleText}>{client.summary.isRepeatClient ? 'Repeat Client' : 'New Client'}</Text>
                            {client.customer.phone ? <Text style={styles.subtleText}>{client.customer.phone}</Text> : null}
                            {client.customer.email ? <Text style={styles.subtleText}>{client.customer.email}</Text> : null}
                        </View>
                    </View>

                    <View style={styles.metricGrid}>
                        <View style={styles.metricCard}>
                            <Text style={styles.metricValue}>{client.summary.totalVisits}</Text>
                            <Text style={styles.metricLabel}>Total Visits</Text>
                        </View>
                        <View style={styles.metricCard}>
                            <Text style={styles.metricValue}>{formatMoney(client.summary.totalSpent)}</Text>
                            <Text style={styles.metricLabel}>Total Spend</Text>
                        </View>
                        <View style={styles.metricCard}>
                            <Text style={styles.metricValue}>{client.summary.loyaltyTier.toUpperCase()}</Text>
                            <Text style={styles.metricLabel}>Tier</Text>
                        </View>
                        <View style={styles.metricCard}>
                            <Text style={styles.metricValue}>{client.summary.loyaltyPoints}</Text>
                            <Text style={styles.metricLabel}>Points</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Client Notes</Text>
                    <Text style={styles.sectionBody}>
                        {client.summary.notes?.trim() || 'No tenant notes saved for this client yet.'}
                    </Text>
                    {client.summary.tags?.length ? (
                        <View style={styles.tagsRow}>
                            {client.summary.tags.map((tag) => (
                                <View key={tag} style={styles.tagChip}>
                                    <Text style={styles.tagChipText}>{tag}</Text>
                                </View>
                            ))}
                        </View>
                    ) : null}
                </View>

                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Visit Signals</Text>
                    <Text style={styles.sectionBody}>
                        Last visit: {client.summary.lastVisit ? formatDateSafe(client.summary.lastVisit, 'MMM d, yyyy h:mm a') : 'No completed visit yet'}
                    </Text>
                    <Text style={styles.sectionBody}>
                        Average booking value: {formatMoney(client.summary.averageBookingValue)}
                    </Text>
                    <Text style={styles.sectionBody}>
                        No-shows: {client.summary.noShowCount} • Cancellations: {client.summary.cancellationCount}
                    </Text>
                </View>

                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Recent Appointments</Text>
                    {client.recentAppointments.length === 0 ? (
                        <Text style={styles.sectionBody}>No appointment history yet.</Text>
                    ) : (
                        client.recentAppointments.map((appointment) => (
                            <View key={appointment.id} style={styles.appointmentRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.appointmentTitle}>
                                        {appointment.service?.name_en || appointment.service?.name_ar || 'Service'}
                                    </Text>
                                    <Text style={styles.appointmentMeta}>
                                        {formatDateSafe(appointment.startTime, 'MMM d, yyyy h:mm a')}
                                    </Text>
                                    {appointment.staff?.name ? (
                                        <Text style={styles.appointmentMeta}>With {appointment.staff.name}</Text>
                                    ) : null}
                                </View>
                                <View style={styles.statusPill}>
                                    <Text style={styles.statusPillText}>
                                        {`${appointment.status || 'pending'}`.toLowerCase() === 'pending'
                                            ? 'Unconfirmed'
                                            : String(appointment.status || 'pending').replace(/_/g, ' ')}
                                    </Text>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f3f4f6',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? 16 : 10,
        paddingBottom: 16,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#ffffff',
    },
    content: {
        padding: 16,
        paddingBottom: 40,
    },
    centerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    emptyTitle: {
        fontSize: 16,
        color: '#4b5563',
        textAlign: 'center',
        marginTop: 12,
    },
    backChip: {
        marginTop: 16,
        backgroundColor: '#ede9fe',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 999,
    },
    backChipText: {
        color: '#6d28d9',
        fontWeight: '700',
    },
    profileCard: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        padding: 18,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    profileTop: {
        flexDirection: 'row',
        marginBottom: 18,
    },
    avatarImage: {
        width: 72,
        height: 72,
        borderRadius: 36,
        marginRight: 14,
    },
    avatarFallback: {
        width: 72,
        height: 72,
        borderRadius: 36,
        marginRight: 14,
        backgroundColor: '#ddd6fe',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitial: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#6d28d9',
    },
    profileMeta: {
        flex: 1,
        justifyContent: 'center',
    },
    name: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 4,
    },
    subtleText: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 2,
    },
    metricGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 10,
    },
    metricCard: {
        width: '48%',
        backgroundColor: '#f8f5ff',
        borderRadius: 14,
        padding: 14,
    },
    metricValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#5b21b6',
        marginBottom: 4,
    },
    metricLabel: {
        fontSize: 12,
        color: '#6b7280',
        textTransform: 'uppercase',
    },
    sectionCard: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        padding: 18,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    sectionBody: {
        fontSize: 14,
        lineHeight: 21,
        color: '#4b5563',
        marginBottom: 8,
    },
    tagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 4,
    },
    tagChip: {
        backgroundColor: '#ede9fe',
        borderRadius: 999,
        paddingVertical: 6,
        paddingHorizontal: 10,
    },
    tagChipText: {
        color: '#6d28d9',
        fontWeight: '600',
        fontSize: 12,
    },
    appointmentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#e5e7eb',
    },
    appointmentTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 4,
    },
    appointmentMeta: {
        fontSize: 13,
        color: '#6b7280',
    },
    statusPill: {
        backgroundColor: '#f3f4f6',
        borderRadius: 999,
        paddingVertical: 6,
        paddingHorizontal: 10,
        marginLeft: 12,
    },
    statusPillText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#4b5563',
        textTransform: 'uppercase',
    },
});
