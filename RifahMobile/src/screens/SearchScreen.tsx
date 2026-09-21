import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText as Text } from '../components/ThemedText';
import { AppIcon } from '../components/AppIcon';
import { AppInput } from '../components/ui/AppInput';
import { api, Tenant, getImageUrl } from '../api/client';
import { colors, spacing, layout } from '../theme';
import { useLanguage } from '../contexts/LanguageContext';

interface SearchScreenProps {
    navigation: any;
    route?: {
        params?: {
            query?: string;
        };
    };
}

/**
 * Thin Canonical Search Screen for Customer App 2.0
 * 
 * Sits at the canonical 'Search' route.
 * Reuses existing verified `api.getTenants()` logic to filter salons
 * while preserving screen space for future Phase 4/5 modern Stitch search implementation.
 */
export function SearchScreen({ navigation, route }: SearchScreenProps) {
    const { isRTL, language } = useLanguage();
    const insets = useSafeAreaInsets();
    const [query, setQuery] = useState(route?.params?.query || '');
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        api.getTenants()
            .then((data) => {
                if (isMounted) {
                    setTenants(data || []);
                    setLoading(false);
                }
            })
            .catch(() => {
                if (isMounted) {
                    setTenants([]);
                    setLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, []);

    const filteredTenants = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return tenants;

        return tenants.filter((tenant) => {
            const name = (tenant.name || '').toLowerCase();
            const nameAr = ((tenant as any).name_ar || '').toLowerCase();
            const nameEn = ((tenant as any).name_en || '').toLowerCase();
            const city = (tenant.city || '').toLowerCase();
            return name.includes(q) || nameAr.includes(q) || nameEn.includes(q) || city.includes(q);
        });
    }, [query, tenants]);

    const handleSelectTenant = (item: Tenant) => {
        navigation.navigate('Tenant', {
            tenantId: item.id,
            slug: item.slug,
            tenant: item,
        });
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header: Back button + Search bar */}
            <View style={[styles.header, isRTL && styles.rowRTL]}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                >
                    <AppIcon
                        name={isRTL ? 'chevron_right' : 'chevron_left'}
                        size={22}
                        color={colors.brandPrimaryDark}
                    />
                </TouchableOpacity>

                <View style={styles.inputWrapper}>
                    <AppInput
                        value={query}
                        onChangeText={setQuery}
                        placeholder={language === 'ar' ? 'ابحث عن صالون أو مركز...' : 'Search salons or spas...'}
                        icon="search"
                        autoFocus
                        style={styles.input}
                    />
                </View>
            </View>

            {/* Results / Loading / Empty */}
            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.brandPrimary} />
                </View>
            ) : (
                <FlatList
                    data={filteredTenants}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => {
                        const displayName = isRTL
                            ? (item as any).name_ar || item.name
                            : (item as any).name_en || item.name;
                        const logoUrl = item.logo ? getImageUrl(item.logo) : null;

                        return (
                            <TouchableOpacity
                                style={[styles.tenantItem, isRTL && styles.rowRTL]}
                                onPress={() => handleSelectTenant(item)}
                                activeOpacity={0.7}
                            >
                                {logoUrl ? (
                                    <Image source={{ uri: logoUrl }} style={styles.tenantLogo} resizeMode="cover" />
                                ) : (
                                    <View style={styles.logoPlaceholder}>
                                        <AppIcon name="storefront" size={20} color={colors.brandPrimary} />
                                    </View>
                                )}

                                <View style={[styles.tenantInfo, isRTL && { alignItems: 'flex-end' }]}>
                                    <Text style={[styles.tenantName, isRTL && styles.rtlText]} numberOfLines={1}>
                                        {displayName}
                                    </Text>
                                    {item.city ? (
                                        <Text style={[styles.tenantCity, isRTL && styles.rtlText]} numberOfLines={1}>
                                            {item.city}
                                        </Text>
                                    ) : null}
                                </View>

                                <AppIcon
                                    name={isRTL ? 'chevron_left' : 'chevron_right'}
                                    size={18}
                                    color={colors.textTertiary}
                                />
                            </TouchableOpacity>
                        );
                    }}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <AppIcon name="search" size={36} color={colors.textTertiary} />
                            <Text style={styles.emptyText}>
                                {language === 'ar' ? 'لم يتم العثور على صالونات' : 'No salons found'}
                            </Text>
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
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        gap: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
        backgroundColor: colors.surface,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: layout.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceLavender,
    },
    inputWrapper: {
        flex: 1,
    },
    input: {
        marginBottom: 0,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: {
        padding: spacing.md,
    },
    tenantItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: layout.radius.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
    },
    tenantLogo: {
        width: 44,
        height: 44,
        borderRadius: layout.radius.sm,
        backgroundColor: colors.surfaceLavender,
    },
    logoPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: layout.radius.sm,
        backgroundColor: colors.surfaceLavender,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tenantInfo: {
        flex: 1,
        marginHorizontal: spacing.md,
    },
    tenantName: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 2,
    },
    tenantCity: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
        gap: spacing.sm,
    },
    emptyText: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    rowRTL: {
        flexDirection: 'row-reverse',
    },
    rtlText: {
        textAlign: 'right',
        writingDirection: 'rtl',
    },
});
