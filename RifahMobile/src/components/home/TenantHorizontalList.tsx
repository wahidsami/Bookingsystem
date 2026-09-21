import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { ThemedText as Text } from '../ThemedText';
import { colors, spacing, fontSize, borderRadius } from '../../theme/colors';
import { useLanguage } from '../../contexts/LanguageContext';
import { api, Tenant, getImageUrl } from '../../api/client';
import { SkeletonCard } from './SkeletonCard';

interface TenantHorizontalListProps {
    variant: 'new' | 'trending';
    navigation: any;
}

export function TenantHorizontalList({ variant, navigation }: TenantHorizontalListProps) {
    const { t, isRTL } = useLanguage();
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => { loadTenants(); }, []);

    const loadTenants = async () => {
        setLoading(true);
        setError(false);
        try {
            const data = variant === 'new'
                ? await api.getNewTenants(8)
                : await api.getTrendingTenants(8);
            setTenants(data);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <FlatList
                horizontal
                inverted={isRTL}
                data={[1, 2, 3]}
                renderItem={() => <SkeletonCard variant="tenant" />}
                keyExtractor={(_, i) => `sk-${i}`}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
            />
        );
    }

    if (error) {
        return (
            <View style={styles.errorContainer}>
                <TouchableOpacity onPress={loadTenants} style={styles.retryButton}>
                    <Text style={styles.retryText}>{t('retry')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (tenants.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>{t('noSalonsFound')}</Text>
            </View>
        );
    }

    const renderTenant = ({ item }: { item: Tenant }) => {
        const logoUrl = getImageUrl(item.logo);
        const displayName = isRTL ? (item as any).name_ar || item.name : (item as any).name_en || item.name;
        const businessTypes = Array.isArray((item as any).businessType)
            ? (item as any).businessType.map((t: string) => t.replace(/_/g, ' ')).join(' • ')
            : (item as any).businessType?.replace(/_/g, ' ') || '';
        const initial = (displayName || '?').trim().charAt(0).toLowerCase();

        return (
            <TouchableOpacity
                style={[styles.card, isRTL ? styles.cardRTL : styles.cardLTR]}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('Tenant', { tenantId: item.id, slug: item.slug, tenant: item })}
            >
                {/* Banner / Monogram Container (h-24 = 96px in Stitch) */}
                <View style={styles.coverContainer}>
                    {logoUrl ? (
                        <Image source={{ uri: logoUrl }} style={styles.coverImage} resizeMode="cover" />
                    ) : (
                        <View style={styles.coverPlaceholder}>
                            <Text style={styles.coverLetter}>{initial}</Text>
                        </View>
                    )}
                </View>

                {/* Info */}
                <View style={[styles.infoContainer, isRTL && styles.infoContainerRTL]}>
                    <Text style={[styles.tenantName, { textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
                        {displayName}
                    </Text>
                    <Text style={[styles.metaRow, { textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
                        {businessTypes ? `${businessTypes} • ` : ''}
                        {item.city || (isRTL ? 'الرياض' : 'Riyadh')}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <FlatList
            horizontal
            inverted={isRTL}
            data={tenants}
            renderItem={renderTenant}
            keyExtractor={item => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
        />
    );
}

const styles = StyleSheet.create({
    listContent: {
        paddingHorizontal: spacing.lg,
    },
    card: {
        width: 160,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(231, 221, 252, 0.7)',
        shadowColor: '#6537C0',
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
    infoContainer: {
        paddingHorizontal: 2,
    },
    infoContainerRTL: {
        alignItems: 'flex-end',
    },
    coverContainer: {
        width: '100%',
        height: 96,
        borderRadius: 12,
        backgroundColor: '#FAF9FC',
        borderWidth: 1,
        borderColor: 'rgba(231, 221, 252, 0.5)',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    coverImage: {
        width: '100%',
        height: '100%',
    },
    coverPlaceholder: {
        flex: 1,
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FAF9FC',
    },
    coverLetter: {
        fontSize: 32,
        fontWeight: '700',
        color: '#6537C0',
    },
    tenantName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1D035F',
        lineHeight: 20,
        marginBottom: 2,
    },
    metaRow: {
        fontSize: 12,
        color: 'rgba(29, 3, 95, 0.6)',
        lineHeight: 16,
    },
    errorContainer: {
        alignItems: 'center',
        padding: spacing.md,
    },
    emptyContainer: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    emptyText: {
        color: 'rgba(29, 3, 95, 0.6)',
        fontSize: fontSize.sm,
    },
    retryButton: {
        backgroundColor: '#FAF9FC',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    retryText: {
        color: colors.primary,
        fontWeight: '600',
    },
});
