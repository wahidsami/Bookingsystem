import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    View,
    Text,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getMessages, markMessageAsRead, StaffMessage } from '../../src/services/messages';
import { useAuth } from '../../src/context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { useTranslation } from 'react-i18next';

import { useRouter, useFocusEffect } from 'expo-router';
import { usePushNotifications } from '../../src/hooks/usePushNotifications';

export default function MessagesScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const { t } = useTranslation();
    const [messages, setMessages] = useState<StaffMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadMessages = useCallback(async () => {
        try {
            const data = await getMessages();
            setMessages(data);
        } catch (error) {
            console.error('Failed to load messages', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            if (user) loadMessages();
            else setLoading(false);
        }, [user, loadMessages])
    );

    // Also reload if a new notification arrives while staring at the screen
    const { notification } = usePushNotifications();
    useEffect(() => {
        if (notification && user) {
            loadMessages();
        }
    }, [notification, user, loadMessages]);

    const onRefresh = () => {
        setRefreshing(true);
        loadMessages();
    };

    const isUnread = (msg: StaffMessage) => {
        if (!user?.id) return false;
        // msg.readBy is an array of UUIDs
        const readArray = Array.isArray(msg.readBy) ? msg.readBy : [];
        return !readArray.includes(user.id);
    };

    const handlePressMessage = async (msg: StaffMessage) => {
        // Navigate to the detail screen, passing the message data as a stringified param
        router.push({
            pathname: '/message/[id]',
            params: { id: msg.id, message: JSON.stringify(msg) }
        });

        // If it's unread, mark it as read on the backend asynchronously
        if (isUnread(msg)) {
            try {
                await markMessageAsRead(msg.id);

                // Optimistically update local state so the dot disappears instantly
                setMessages(current =>
                    current.map(m => {
                        if (m.id === msg.id && user?.id) {
                            return { ...m, readBy: [...(Array.isArray(m.readBy) ? m.readBy : []), user.id] };
                        }
                        return m;
                    })
                );
            } catch (e) {
                console.error("Failed to mark read", e);
            }
        }
    };

    const renderItem = ({ item }: { item: StaffMessage }) => {
        const unread = isUnread(item);

        return (
            <TouchableOpacity
                style={[
                    styles.messageCard,
                    unread && styles.messageCardUnread,
                ]}
                onPress={() => handlePressMessage(item)}
                activeOpacity={0.7}
            >
                <View style={styles.messageHeader}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                        {/* Pinned Badge */}
                        {item.isPinned && (
                            <Ionicons name="pin" size={16} color="#f59e0b" style={{ marginRight: 6 }} />
                        )}
                        <Text style={[styles.subject, unread && styles.subjectUnread]} numberOfLines={1}>
                            {item.subject || 'Admin Update'}
                        </Text>
                    </View>

                    <Text style={styles.timestamp}>
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </Text>
                </View>

                <Text
                    style={styles.bodyPreview}
                    numberOfLines={2}
                >
                    {item.body}
                </Text>

                {unread && (
                    <View style={styles.unreadDot} />
                )}
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <LinearGradient colors={['#8B5ADF', '#683AB7']} style={styles.header}>
                <Text style={styles.headerTitle}>{t('messages.title')}</Text>
            </LinearGradient>

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#8B5ADF" />
                </View>
            ) : messages.length === 0 ? (
                <View style={styles.centerContainer}>
                    <Ionicons name="mail-open-outline" size={64} color="#d1d5db" />
                    <Text style={styles.emptyTitle}>{t('messages.empty')}</Text>
                </View>
            ) : (
                <FlatList
                    data={messages}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#8B5ADF']} />}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f3f4f6',
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 20 : 10,
        paddingBottom: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#ffffff',
        textAlign: 'center',
    },
    listContent: {
        padding: 16,
        paddingBottom: 40,
    },
    messageCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
        position: 'relative',
        overflow: 'hidden'
    },
    messageCardUnread: {
        borderLeftWidth: 4,
        borderLeftColor: '#8B5ADF',
        backgroundColor: '#f8f5ff',
    },
    messageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    subject: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        flex: 1,
    },
    subjectUnread: {
        fontWeight: 'bold',
        color: '#1f2937',
    },
    timestamp: {
        fontSize: 12,
        color: '#9ca3af',
        marginLeft: 8,
    },
    bodyPreview: {
        fontSize: 14,
        color: '#4b5563',
        lineHeight: 20,
    },
    unreadDot: {
        position: 'absolute',
        top: 16,
        right: 16,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#8B5ADF',
    },
    // Empty State
    centerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#4b5563',
        marginTop: 16,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#9ca3af',
        textAlign: 'center',
    }
});
