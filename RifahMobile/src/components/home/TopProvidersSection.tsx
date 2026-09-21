import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { ThemedText as Text } from '../ThemedText';
import { colors, spacing, fontSize, borderRadius } from '../../theme/colors';
import { useLanguage } from '../../contexts/LanguageContext';
import { api, Staff, getImageUrl } from '../../api/client';
import { SkeletonCard } from './SkeletonCard';

interface TopProvidersSectionProps {
    navigation?: any;
}

export function TopProvidersSection({ navigation }: TopProvidersSectionProps) {
    const { t, isRTL } = useLanguage();
    const [providers, setProviders] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadProviders(); }, []);

    const loadProviders = async () => {
        setLoading(true);
        try {
            const data = await api.getTopProviders();
            setProviders(data.slice(0, 8));
        } catch {
            setProviders([]);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <FlatList
                horizontal
                inverted={isRTL}
                data={[1, 2, 3, 4]}
                renderItem={() => <SkeletonCard variant="provider" />}
                keyExtractor={(_, i) => `sk-${i}`}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
            />
        );
    }

    if (providers.length === 0) {
        return (
            <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>{t('noTopProviders')}</Text>
            </View>
        );
    }

    const renderProvider = ({ item }: { item: Staff }) => {
        const avatarUrl = item.avatar ? getImageUrl(item.avatar) : undefined;
        const initials = item.name?.trim()?.charAt(0)?.toUpperCase() || '?';

        return (
            <TouchableOpacity
                style={[styles.card, isRTL ? styles.cardRTL : styles.cardLTR]}
                activeOpacity={0.75}
                onPress={() => navigation?.navigate('EmployeeProfile', { provider: item })}
            >
                {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                ) : (
                    <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                )}
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <View style={styles.ratingRow}>
                    <Text style={styles.star}>★</Text>
                    <Text style={styles.ratingText}>{item.rating ? item.rating.toFixed(1) : '5.0'}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.sectionContainer}>
            <FlatList
                horizontal
                inverted={isRTL}
                data={providers}
                renderItem={renderProvider}
                keyExtractor={item => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    sectionContainer: {
        backgroundColor: 'transparent',
        paddingVertical: spacing.xs,
        marginBottom: spacing.md,
    },
    listContent: {
        paddingHorizontal: spacing.lg,
    },
    emptyState: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    emptyStateText: {
        color: 'rgba(29, 3, 95, 0.6)',
        fontSize: fontSize.sm,
    },
    card: {
        width: 96,
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 10,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(231, 221, 252, 0.7)',
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    cardLTR: {
        marginRight: spacing.md,
    },
    cardRTL: {
        marginLeft: spacing.md,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginBottom: 8,
    },
    avatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#6537C0',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    avatarText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
    name: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1D035F',
        textAlign: 'center',
        width: '100%',
        marginBottom: 2,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        marginTop: 2,
    },
    star: {
        fontSize: 12,
        color: '#F59E0B',
    },
    ratingText: {
        fontSize: 12,
        color: 'rgba(29, 3, 95, 0.8)',
        fontWeight: '600',
    },
});
