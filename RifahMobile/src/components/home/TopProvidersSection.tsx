import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Image, Modal, ScrollView } from 'react-native';
import { ThemedText as Text } from '../ThemedText';
import { colors, spacing, fontSize, borderRadius } from '../../theme/colors';
import { useLanguage } from '../../contexts/LanguageContext';
import { api, Staff, getImageUrl } from '../../api/client';
import { SkeletonCard } from './SkeletonCard';
import { Ionicons } from '@expo/vector-icons';

export function TopProvidersSection() {
    const { t } = useLanguage();
    const [providers, setProviders] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedProvider, setSelectedProvider] = useState<Staff | null>(null);

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
        const initials = item.name?.charAt(0)?.toUpperCase() || '?';

        return (
            <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => setSelectedProvider(item)}>
                {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                ) : (
                    <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                )}
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <View style={styles.ratingRow}>
                    <Text style={styles.star}>⭐</Text>
                    <Text style={styles.ratingText}>{item.rating?.toFixed(1) || '—'}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.sectionContainer}>
            <FlatList
                horizontal
                data={providers}
                renderItem={renderProvider}
                keyExtractor={item => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
            />

            <Modal
                visible={!!selectedProvider}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedProvider(null)}
            >
                <View style={styles.modalBackdrop}>
                    <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setSelectedProvider(null)} />
                    {selectedProvider ? (
                        <View style={styles.modalCard}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>{selectedProvider.name}</Text>
                                <TouchableOpacity onPress={() => setSelectedProvider(null)} style={styles.modalClose}>
                                    <Ionicons name="close" size={22} color={colors.text} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.modalRatingRow}>
                                <View style={styles.modalRatingBadge}>
                                    <Ionicons name="star" size={16} color="#D97706" />
                                    <Text style={styles.modalRatingText}>{(selectedProvider.rating || 0).toFixed(1)}</Text>
                                </View>
                                {selectedProvider.experience ? (
                                    <Text style={styles.modalMetaText}>
                                        {selectedProvider.experience}
                                    </Text>
                                ) : null}
                            </View>

                            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
                                <Text style={styles.modalSectionTitle}>
                                    {t('bio' as any) || 'Bio'}
                                </Text>
                                <Text style={styles.modalBody}>
                                    {selectedProvider.bio || (t('noDetails' as any) || 'More details will appear here when available.')}
                                </Text>

                                {Array.isArray(selectedProvider.skills) && selectedProvider.skills.length > 0 ? (
                                    <>
                                        <Text style={styles.modalSectionTitle}>
                                            {t('skills' as any) || 'Skills'}
                                        </Text>
                                        <View style={styles.skillWrap}>
                                            {selectedProvider.skills.map((skill) => (
                                                <View key={skill} style={styles.skillChip}>
                                                    <Text style={styles.skillChipText}>{skill}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </>
                                ) : null}
                            </ScrollView>
                        </View>
                    ) : null}
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    sectionContainer: {
        backgroundColor: colors.backgroundGray,
        paddingVertical: spacing.md,
        marginBottom: spacing.xl,
    },
    listContent: {
        paddingHorizontal: spacing.lg,
    },
    emptyState: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    emptyStateText: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
    },
    card: {
        width: 100,
        alignItems: 'center',
        marginRight: spacing.md,
        backgroundColor: '#FFF',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        marginBottom: spacing.xs,
    },
    avatarPlaceholder: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.xs,
    },
    avatarText: {
        color: '#FFF',
        fontSize: fontSize.lg,
        fontWeight: '700',
    },
    name: {
        fontSize: fontSize.xs,
        fontWeight: '600',
        color: colors.text,
        textAlign: 'center',
        marginBottom: 2,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    star: {
        fontSize: 12,
    },
    ratingText: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
    },
    modalCard: {
        backgroundColor: '#FFF',
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        maxHeight: '80%',
        gap: spacing.md,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
    },
    modalTitle: {
        flex: 1,
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.text,
    },
    modalClose: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.backgroundGray,
    },
    modalRatingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
        flexWrap: 'wrap',
    },
    modalRatingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
        borderRadius: borderRadius.full,
        backgroundColor: '#FEF3C7',
    },
    modalRatingText: {
        fontSize: fontSize.sm,
        fontWeight: '700',
        color: '#92400E',
    },
    modalMetaText: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    modalScroll: {
        maxHeight: 320,
    },
    modalScrollContent: {
        gap: spacing.md,
        paddingBottom: spacing.sm,
    },
    modalSectionTitle: {
        fontSize: fontSize.md,
        fontWeight: '700',
        color: colors.text,
    },
    modalBody: {
        fontSize: fontSize.sm,
        lineHeight: 22,
        color: colors.textSecondary,
    },
    skillWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    skillChip: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
        borderRadius: borderRadius.full,
        backgroundColor: colors.backgroundGray,
    },
    skillChipText: {
        fontSize: fontSize.xs,
        color: colors.primaryDark,
        fontWeight: '600',
    },
});
