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
import { LinearGradient } from 'expo-linear-gradient';
import { AppIcon } from '../components/AppIcon';

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
            <LinearGradient
                colors={['#F5F0FF', '#FFFFFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.header, { paddingTop: spacing.xl + topInset }]}
            >
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <AppIcon name={isRTL ? 'arrow_forward' : 'arrow_back'} size={20} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerTitleWrap}>
                    <Text style={styles.headerTitle}>{initialTitle || t('browseSalons')}</Text>
                    <Text style={styles.headerSubtitle}>{t('findSalon')}</Text>
                </View>
            </LinearGradient>

            <View style={styles.searchContainer}>
                <View style={styles.searchInputWrap}>
                    <AppIcon name="search" size={18} color={colors.textSecondary} />
                    <TextInput
                        style={[styles.searchInput, isRTL && styles.rtlInput]}
                        placeholder={t('searchSalons')}
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>
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
                                activeOpacity={0.92}
                            >
                                {logoUrl ? (
                                    <Image source={{ uri: logoUrl }} style={styles.cardImage} />
                                ) : (
                                    <View style={[styles.cardImage, styles.placeholderImage]}>
                                        <Text style={styles.placeholderText}>{displayName?.charAt(0) || 'T'}</Text>
                                    </View>
                                )}

                                <View style={styles.cardContent}>
                                    <Text style={styles.cardTitle} numberOfLines={1}>{displayName}</Text>
                                    {businessTypes.length > 0 ? (
                                        <View style={styles.businessTypePill}>
                                            <Text style={styles.businessTypePillText}>
                                                {businessTypes.map((type) => type.replace(/_/g, ' ')).join(' • ')}
                                            </Text>
                                        </View>
                                    ) : null}
                                    <View style={styles.cardFooterRow}>
                                        <Text style={styles.cardMeta} numberOfLines={1}>{item.city || (isRTL ? 'الموقع غير محدد' : 'Location not specified')}</Text>
                                        <View style={styles.cardArrowCircle}>
                                            <AppIcon name={isRTL ? 'arrow_back' : 'arrow_forward'} size={16} color={colors.primary} />
                                        </View>
                                    </View>
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
        paddingBottom: spacing.md,
        backgroundColor: colors.surface,
    },
    headerTitleWrap: {
        flex: 1,
    },
    backButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E9E2FA',
    },
    headerTitle: {
        fontSize: 30,
        fontWeight: '800',
        color: '#15163E',
    },
    headerSubtitle: {
        marginTop: 2,
        fontSize: 14,
        color: '#68708F',
    },
    searchContainer: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm,
        paddingBottom: spacing.md,
    },
    searchInputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E8E1FA',
        borderRadius: 18,
        paddingHorizontal: spacing.md,
        shadowColor: '#1A1440',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 1,
    },
    searchInput: {
        flex: 1,
        paddingVertical: spacing.md,
        fontSize: 16,
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
        backgroundColor: '#FFFFFF',
        borderRadius: 22,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#ECE7FA',
        marginBottom: spacing.md,
        shadowColor: '#1B1540',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.07,
        shadowRadius: 14,
        elevation: 2,
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
        gap: 8,
    },
    cardTitle: {
        fontSize: 23,
        fontWeight: '800',
        color: '#171742',
    },
    businessTypePill: {
        alignSelf: 'flex-start',
        backgroundColor: '#F3EEFF',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    businessTypePillText: {
        color: '#514972',
        fontSize: 12,
        fontWeight: '700',
    },
    cardFooterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cardMeta: {
        fontSize: 14,
        color: '#66708F',
        flex: 1,
    },
    cardArrowCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F2EDFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: spacing.sm,
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
