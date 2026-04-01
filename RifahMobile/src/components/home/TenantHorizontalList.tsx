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

    const data = tenants.length > 0 ? tenants : [
        { id: 'p1', name: 'Salon Name', slug: '', status: 'active', plan: '', city: 'Riyadh' },
        { id: 'p2', name: 'Spa Center', slug: '', status: 'active', plan: '', city: 'Jeddah' },
        { id: 'p3', name: 'Beauty Hub', slug: '', status: 'active', plan: '', city: 'Dammam' },
    ] as Tenant[];

    const renderTenant = ({ item }: { item: Tenant }) => {
        const logoUrl = getImageUrl(item.logo);
        const displayName = isRTL ? (item as any).name_ar || item.name : (item as any).name_en || item.name;
        const businessTypes = Array.isArray((item as any).businessType)
            ? (item as any).businessType.map((t: string) => t.replace('_', ' ')).join(' • ')
            : (item as any).businessType?.replace('_', ' ') || '';

        return (
            <TouchableOpacity
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('Tenant', { tenantId: item.id, slug: item.slug, tenant: item })}
            >
                {/* Cover image */}
                <View style={styles.coverContainer}>
                    {logoUrl ? (
                        <Image source={{ uri: logoUrl }} style={styles.coverImage} resizeMode="cover" />
                    ) : (
                        <View style={styles.coverPlaceholder}>
                            <Text style={styles.coverLetter}>{(displayName || '?').charAt(0)}</Text>
                        </View>
                    )}
                </View>

                {/* Info */}
                <View style={styles.infoContainer}>
                    <Text style={styles.tenantName} numberOfLines={1}>{displayName}</Text>
                    <Text style={styles.metaRow} numberOfLines={1}>
                        {businessTypes ? `${businessTypes} • ` : ''}
                        {item.city || ''}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <FlatList
            horizontal
            data={data}
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
        width: 200,
        backgroundColor: '#FFF',
        borderRadius: borderRadius.xl,
        marginRight: spacing.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
    },
    coverContainer: {
        height: 120,
        backgroundColor: '#F3E8FF',
    },
    coverImage: {
        width: '100%',
        height: '100%',
    },
    coverPlaceholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F3E8FF',
    },
    coverLetter: {
        fontSize: 40,
        fontWeight: '700',
        color: colors.primary,
    },
    infoContainer: {
        padding: spacing.sm,
    },
    tenantName: {
        fontSize: fontSize.md,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 2,
    },
    metaRow: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
    },
    errorContainer: {
        alignItems: 'center',
        padding: spacing.md,
    },
    retryButton: {
        backgroundColor: colors.backgroundGray,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
    },
    retryText: {
        color: colors.primary,
        fontWeight: '600',
    },
});
