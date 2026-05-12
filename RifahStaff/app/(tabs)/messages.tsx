import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    View,
    Text,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Platform,
    TextInput,
    ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getMessages, markMessageAsRead, StaffMessage } from '../../src/services/messages';
import { useAuth } from '../../src/context/AuthContext';
import { useTranslation } from 'react-i18next';

import { useRouter, useFocusEffect } from 'expo-router';
import { canViewMessages } from '../../src/utils/capabilities';
import { formatDistanceToNowSafe, getTimeMsSafe } from '../../src/utils/safeDate';

export default function MessagesScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const { t } = useTranslation();
    const [messages, setMessages] = useState<StaffMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterKey, setFilterKey] = useState<'all' | 'unread' | 'pinned' | 'recent'>('all');
    const messagesAllowed = canViewMessages(user);

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

    const normalizedSearch = searchQuery.trim().toLowerCase();
    const filteredMessages = messages.filter((msg) => {
                const matchesFilter =
                    filterKey === 'all' ? true :
                        filterKey === 'unread' ? isUnread(msg) :
                            filterKey === 'pinned' ? msg.isPinned :
                        Date.now() - getTimeMsSafe(msg.createdAt) <= 1000 * 60 * 60 * 24 * 3;

        if (!matchesFilter) {
            return false;
        }

        if (!normalizedSearch) {
            return true;
        }

        return [
            msg.subject,
            msg.body
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(normalizedSearch);
    });

    const unreadCount = messages.filter((msg) => isUnread(msg)).length;
    const pinnedCount = messages.filter((msg) => msg.isPinned).length;
    const recentCount = messages.filter((msg) => Date.now() - getTimeMsSafe(msg.createdAt) <= 1000 * 60 * 60 * 24 * 3).length;
    const filterOptions: { key: 'all' | 'unread' | 'pinned' | 'recent'; label: string; count: number }[] = [
        { key: 'all', label: 'All', count: messages.length },
        { key: 'unread', label: 'Unread', count: unreadCount },
        { key: 'pinned', label: 'Pinned', count: pinnedCount },
        { key: 'recent', label: 'Recent', count: recentCount },
    ];

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
                        {formatDistanceToNowSafe(item.createdAt)}
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

            {!messagesAllowed ? (
                <View style={styles.centerContainer}>
                    <Ionicons name="lock-closed-outline" size={64} color="#d1d5db" />
                    <Text style={styles.emptyTitle}>Messages are not enabled for this account</Text>
                    <Text style={styles.emptySubtitle}>Messaging will appear here when your tenant enables the feature.</Text>
                </View>
            ) : loading ? (
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
                    data={filteredMessages}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    ListHeaderComponent={(
                        <View>
                            <View style={styles.statsGrid}>
                                <View style={styles.statCard}>
                                    <Text style={styles.statValue}>{messages.length}</Text>
                                    <Text style={styles.statLabel}>Total</Text>
                                </View>
                                <View style={styles.statCard}>
                                    <Text style={styles.statValue}>{unreadCount}</Text>
                                    <Text style={styles.statLabel}>Unread</Text>
                                </View>
                                <View style={styles.statCard}>
                                    <Text style={styles.statValue}>{pinnedCount}</Text>
                                    <Text style={styles.statLabel}>Pinned</Text>
                                </View>
                                <View style={styles.statCard}>
                                    <Text style={styles.statValue}>{recentCount}</Text>
                                    <Text style={styles.statLabel}>Recent</Text>
                                </View>
                            </View>

                            <View style={styles.searchBox}>
                                <Ionicons name="search-outline" size={18} color="#6b7280" style={styles.searchIcon} />
                                <TextInput
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    placeholder="Search subject or message..."
                                    placeholderTextColor="#9ca3af"
                                    style={styles.searchInput}
                                />
                                {searchQuery ? (
                                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                                        <Ionicons name="close-circle" size={18} color="#9ca3af" />
                                    </TouchableOpacity>
                                ) : null}
                            </View>

                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.filterRow}
                            >
                                {filterOptions.map((option) => {
                                    const active = filterKey === option.key;
                                    return (
                                        <TouchableOpacity
                                            key={option.key}
                                            style={[styles.filterChip, active && styles.filterChipActive]}
                                            onPress={() => setFilterKey(option.key)}
                                        >
                                            <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                                                {option.label} ({option.count})
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>

                            <Text style={styles.resultsLabel}>
                                Showing {filteredMessages.length} of {messages.length} messages
                            </Text>
                        </View>
                    )}
                    ListEmptyComponent={(
                        <View style={styles.emptyFilterState}>
                            <Ionicons name="search-outline" size={48} color="#d1d5db" />
                            <Text style={styles.emptyTitle}>No messages match these filters</Text>
                            <Text style={styles.emptySubtitle}>Try a different search or switch the selected inbox filter.</Text>
                        </View>
                    )}
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
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 16,
        gap: 10,
    },
    statCard: {
        width: '48%',
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
    },
    statValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#6d28d9',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#6b7280',
        textTransform: 'uppercase',
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 4,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#1f2937',
        paddingVertical: 10,
    },
    filterRow: {
        paddingBottom: 10,
        gap: 10,
    },
    filterChip: {
        backgroundColor: '#ffffff',
        borderRadius: 999,
        paddingVertical: 9,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    filterChipActive: {
        backgroundColor: '#ede9fe',
        borderColor: '#8B5ADF',
    },
    filterChipText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#4b5563',
    },
    filterChipTextActive: {
        color: '#6d28d9',
    },
    resultsLabel: {
        fontSize: 13,
        color: '#6b7280',
        marginBottom: 14,
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
    emptyFilterState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 36,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#9ca3af',
        textAlign: 'center',
    }
});
