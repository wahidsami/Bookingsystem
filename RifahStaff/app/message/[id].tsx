import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { StaffMessage } from '../../src/services/messages';

export default function MessageDetailScreen() {
    const { id, message: messageStr } = useLocalSearchParams();
    const router = useRouter();
    const { t } = useTranslation();

    let message: StaffMessage | null = null;
    try {
        if (typeof messageStr === 'string') {
            message = JSON.parse(messageStr);
        }
    } catch (e) {
        console.error('Failed to parse message', e);
    }

    if (!message) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <Text>Error loading message.</Text>
                    <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
                        <Text style={{ color: '#8B5ADF' }}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const dateFormatted = format(new Date(message.createdAt), 'MMM d, yyyy • h:mm a');

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            {/* Header */}
            <LinearGradient colors={['#8B5ADF', '#683AB7']} style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#ffffff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('messages.title') || 'Message'}</Text>
                <View style={{ width: 40 }} /> {/* Spacer to align title center */}
            </LinearGradient>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.messageContainer}>
                    {/* Subject and Pinned badge */}
                    <View style={styles.subjectRow}>
                        {message.isPinned && (
                            <Ionicons name="pin" size={20} color="#f59e0b" style={{ marginRight: 8 }} />
                        )}
                        <Text style={styles.subject}>{message.subject || 'Admin Update'}</Text>
                    </View>

                    <Text style={styles.timestamp}>{dateFormatted}</Text>

                    <View style={styles.divider} />

                    <Text style={styles.body}>{message.body}</Text>
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
    },
    messageContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    subjectRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    subject: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1f2937',
        flex: 1,
    },
    timestamp: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 16,
    },
    divider: {
        height: 1,
        backgroundColor: '#e5e7eb',
        marginVertical: 16,
    },
    body: {
        fontSize: 16,
        color: '#374151',
        lineHeight: 24,
    },
    errorContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
