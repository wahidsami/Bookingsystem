import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { api, Tenant, getImageUrl } from '../api/client';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenSafeArea } from '../utils/safeArea';

export function BrowseScreen({ route, navigation }: any) {
    const { t, isRTL } = useLanguage();
    const { topInset, scrollBottomPadding } = useScreenSafeArea();
    const initialCategory = route.params?.category as string | undefined;
    const initialTitle = route.params?.title as string | undefined;
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => {
        loadTenants();
    }, []);

    const loadTenants = async () => {
        try {
            setLoading(true);
            const data = await api.getTenants();
            setTenants(data);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const filteredTenants = tenants.filter((tenant) => {
        const displayName = isRTL ? tenant.name_ar || tenant.name : tenant.name_en || tenant.name;
        const businessTypes = Array.isArray(tenant.businessType) ? tenant.businessType : tenant.businessType ? [tenant.businessType] : [];
        const matchesCategory = !initialCategory || businessTypes.includes(initialCategory);
        const matchesSearch = !search.trim()
            || displayName?.toLowerCase().includes(search.trim().toLowerCase())
            || tenant.city?.toLowerCase().includes(search.trim().toLowerCase())
            || businessTypes.some((type) => type.toLowerCase().includes(search.trim().toLowerCase()));

        return matchesCategory && matchesSearch;
    });

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: spacing.xl + topInset }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{initialTitle || t('browseSalons')}</Text>
            </View>

            <View style={styles.searchContainer}>
                <TextInput
                    style={[styles.searchInput, isRTL && styles.rtlInput]}
                    placeholder={t('searchSalons')}
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            {loading ? (
                <View style={styles.centerState}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={filteredTenants}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={[
                        filteredTenants.length === 0 ? styles.emptyList : styles.listContent,
                        { paddingBottom: scrollBottomPadding }
                    ]}
                    onRefresh={() => {
                        setRefreshing(true);
                        loadTenants();
                    }}
                    refreshing={refreshing}
                    renderItem={({ item }) => {
                        const displayName = isRTL ? item.name_ar || item.name : item.name_en || item.name;
                        const businessTypes = Array.isArray(item.businessType) ? item.businessType : item.businessType ? [item.businessType] : [];
                        const logoUrl = getImageUrl(item.logo || item.coverImage);

                        return (
                            <TouchableOpacity
                                style={styles.card}
                                onPress={() => navigation.navigate('Tenant', { tenantId: item.id, slug: item.slug, tenant: item })}
                            >
                                {logoUrl ? (
                                    <Image source={{ uri: logoUrl }} style={styles.cardImage} />
                                ) : (
                                    <View style={[styles.cardImage, styles.placeholderImage]}>
                                        <Text style={styles.placeholderText}>{displayName?.charAt(0) || 'T'}</Text>
                                    </View>
                                )}

                                <View style={styles.cardContent}>
                                    <Text style={styles.cardTitle}>{displayName}</Text>
                                    <Text style={styles.cardMeta}>
                                        {businessTypes.map((type) => type.replace(/_/g, ' ')).join(' • ')}
                                    </Text>
                                    <Text style={styles.cardMeta}>{item.city || ''}</Text>
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                    ListEmptyComponent={
                        <View style={styles.centerState}>
                            <Text style={styles.emptyText}>{t('noSalonsFound')}</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.lg,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        padding: spacing.xs,
    },
    backButtonText: {
        fontSize: fontSize.xl,
        fontWeight: '700',
        color: colors.text,
    },
    headerTitle: {
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.text,
    },
    searchContainer: {
        padding: spacing.lg,
    },
    searchInput: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.lg,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        fontSize: fontSize.md,
    },
    rtlInput: {
        textAlign: 'right',
    },
    listContent: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.xl,
        gap: spacing.md,
    },
    emptyList: {
        flexGrow: 1,
        paddingBottom: spacing.xl,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.md,
    },
    cardImage: {
        width: '100%',
        height: 160,
    },
    placeholderImage: {
        backgroundColor: colors.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholderText: {
        fontSize: 42,
        fontWeight: '700',
        color: colors.primary,
    },
    cardContent: {
        padding: spacing.md,
        gap: 4,
    },
    cardTitle: {
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.text,
    },
    cardMeta: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
    },
    centerState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    emptyText: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        textAlign: 'center',
    },
});
