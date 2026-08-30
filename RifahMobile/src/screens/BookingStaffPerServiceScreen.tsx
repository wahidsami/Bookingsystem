import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useServiceBookingCart, ServiceBookingCartItem } from '../contexts/ServiceBookingCartContext';
import { api, Staff, getImageUrl, normalizeStaff } from '../api/client';
import { colors, spacing } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { AppIcon } from '../components/AppIcon';
import { useScreenSafeArea } from '../utils/safeArea';
import { formatRiyal } from '../utils/currency';

export function BookingStaffPerServiceScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<any>>();
    const route = useRoute<any>();
    const { tenantId } = route.params || {};
    const { items, updateItem, totalPrice } = useServiceBookingCart();
    const { isRTL } = useLanguage();
    const { topInset, bottomInset, scrollBottomPadding } = useScreenSafeArea();

    const [serviceStaffMap, setServiceStaffMap] = useState<Record<string, Staff[]>>({});
    const [loading, setLoading] = useState(true);
    const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);

    // Compute total duration
    const totalDuration = useMemo(() => {
        return items.reduce((acc, item) => acc + (item.service.duration || 0), 0);
    }, [items]);

    const formatDuration = (minutes: number) => {
        if (minutes < 60) {
            return isRTL ? `${minutes} دقيقة` : `${minutes} min`;
        }
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (mins === 0) {
            return isRTL ? `${hours} ساعة` : `${hours} h`;
        }
        return isRTL ? `${hours} س ${mins} د` : `${hours}h ${mins}m`;
    };

    useEffect(() => {
        if (!tenantId || items.length === 0) {
            if (navigation.isFocused()) {
                navigation.goBack();
            }
            return;
        }

        // Initialize all items to "Any professional" if they don't have one selected yet.
        // Doing this once on mount ensures the "Continue" button is enabled by default.
        items.forEach(item => {
            if (item.staff === undefined) {
                updateItem(item.id, { staff: null, requestedStaffId: null, staffId: null });
            }
        });

        fetchEligibleStaffPerService();
    }, [tenantId]);

    const fetchEligibleStaffPerService = async () => {
        try {
            setLoading(true);
            const map: Record<string, Staff[]> = {};
            
            const promises = items.map(async (item) => {
                if (map[item.service.id]) return; // Skip if already fetched this service ID
                const response = await api.get<{ success: boolean; staff: Staff[] }>(`/public/tenant/${tenantId}/services/${item.service.id}/staff`);
                if (response.success) {
                    map[item.service.id] = (response.staff || []).map(normalizeStaff);
                } else {
                    map[item.service.id] = [];
                }
            });
            
            await Promise.all(promises);
            setServiceStaffMap(map);
        } catch (error) {
            console.error('Failed to load eligible staff per service:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectStaff = (itemId: string, staff: Staff | null) => {
        updateItem(itemId, {
            staff: staff,
            requestedStaffId: staff ? staff.id : null,
            staffId: staff ? staff.id : null
        });
        setExpandedServiceId(null);
    };

    const toggleAccordion = (itemId: string) => {
        setExpandedServiceId(prev => prev === itemId ? null : itemId);
    };

    const handleContinue = () => {
        navigation.navigate('BookingDateTimeSelection', { tenantId });
    };

    const renderStaffAvatar = (staff: Staff, size: number = 40) => {
        const imageUrl = getImageUrl(staff.avatar || staff.image);
        if (imageUrl) {
            return <Image source={{ uri: imageUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
        }
        return (
            <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
                <Text style={[styles.avatarPlaceholderText, { fontSize: size * 0.4 }]}>
                    {((staff.name_en || staff.name || 'P').charAt(0)).toUpperCase()}
                </Text>
            </View>
        );
    };

    const renderServiceCard = (item: ServiceBookingCartItem) => {
        const isExpanded = expandedServiceId === item.id;
        const staffList = serviceStaffMap[item.service.id] || [];
        const selectedStaff = item.staff;

        return (
            <View key={item.id} style={[styles.serviceCard, isExpanded && styles.serviceCardExpanded]}>
                <View style={styles.serviceHeader}>
                    <View style={styles.serviceInfo}>
                        <Text style={styles.serviceName}>
                            {isRTL ? (item.service.name_ar || item.service.name_en) : (item.service.name_en || item.service.name_ar)}
                        </Text>
                        <Text style={styles.serviceDuration}>
                            {formatDuration(item.service.duration)}
                        </Text>
                    </View>
                </View>

                <TouchableOpacity 
                    style={styles.dropdownSelector}
                    onPress={() => toggleAccordion(item.id)}
                    activeOpacity={0.7}
                >
                    <View style={styles.dropdownContent}>
                        {selectedStaff ? (
                            <>
                                {renderStaffAvatar(selectedStaff, 24)}
                                <Text style={styles.dropdownSelectedText} numberOfLines={1}>
                                    {isRTL ? (selectedStaff.name_ar || selectedStaff.name_en || selectedStaff.name) : (selectedStaff.name_en || selectedStaff.name_ar || selectedStaff.name)}
                                </Text>
                            </>
                        ) : (
                            <>
                                <View style={styles.anyAvatarSmall}>
                                    <AppIcon name="user" size={14} color={colors.primary} />
                                </View>
                                <Text style={styles.dropdownSelectedText} numberOfLines={1}>
                                    {isRTL ? 'أي مقدم خدمة متاح' : 'Any professional'}
                                </Text>
                            </>
                        )}
                    </View>
                    <AppIcon name={isExpanded ? 'minus' : 'plus'} size={20} color={colors.textSecondary} />
                </TouchableOpacity>

                {isExpanded && (
                    <View style={styles.expandedList}>
                        {/* Any Professional Option */}
                        <TouchableOpacity 
                            style={[styles.staffListItem, !selectedStaff && styles.staffListItemSelected]}
                            onPress={() => handleSelectStaff(item.id, null)}
                        >
                            <View style={styles.anyAvatarSmall}>
                                <AppIcon name="user" size={20} color={colors.primary} />
                            </View>
                            <View style={[styles.staffListItemInfo, isRTL ? styles.staffListItemInfoRtl : null]}>
                                <Text style={styles.staffListItemName}>
                                    {isRTL ? 'أي مقدم خدمة متاح' : 'Any professional'}
                                </Text>
                                <Text style={styles.staffListItemRole}>
                                    {isRTL ? 'أقصى توفر' : 'Maximum availability'}
                                </Text>
                            </View>
                            {!selectedStaff && <View style={styles.checkDot} />}
                        </TouchableOpacity>

                        {/* Staff Options */}
                        {staffList.map(staff => {
                            const isSelected = selectedStaff?.id === staff.id;
                            return (
                                <TouchableOpacity 
                                    key={staff.id}
                                    style={[styles.staffListItem, isSelected && styles.staffListItemSelected]}
                                    onPress={() => handleSelectStaff(item.id, staff)}
                                >
                                    {renderStaffAvatar(staff, 40)}
                                    <View style={[styles.staffListItemInfo, isRTL ? styles.staffListItemInfoRtl : null]}>
                                        <Text style={styles.staffListItemName}>
                                            {isRTL ? (staff.name_ar || staff.name_en || staff.name) : (staff.name_en || staff.name_ar || staff.name)}
                                        </Text>
                                        <Text style={styles.staffListItemRole}>
                                            {staff.role || staff.specialty || staff.specialization || (isRTL ? 'مقدم خدمة' : 'Professional')}
                                        </Text>
                                    </View>
                                    {isSelected && <View style={styles.checkDot} />}
                                </TouchableOpacity>
                            );
                        })}
                        {staffList.length === 0 && (
                            <Text style={styles.noStaffText}>
                                {isRTL ? 'لا يوجد مقدمو خدمة متاحون.' : 'No professionals available for this service.'}
                            </Text>
                        )}
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: topInset }]}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <AppIcon name={isRTL ? 'arrow_forward' : 'arrow_back'} size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{isRTL ? 'اختر مقدم الخدمة' : 'Select professional'}</Text>
                <View style={styles.headerRight}>
                    <TouchableOpacity style={styles.closeButton} onPress={() => navigation.navigate('TenantScreen', { tenantId })}>
                        <AppIcon name="close" size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={[styles.listContent, { paddingBottom: scrollBottomPadding + 100 }]}>
                    <Text style={styles.sectionDescription}>
                        {isRTL ? 'اختر مقدم الخدمة المفضل لكل خدمة على حدة.' : 'Choose your preferred professional for each service.'}
                    </Text>
                    {items.map(renderServiceCard)}
                </ScrollView>
            )}

            {/* Bottom Fixed Basket */}
            <View style={[styles.bottomBasketContainer, { paddingBottom: Math.max(bottomInset, spacing.md) }]}>
                <View style={styles.bottomBasketLeft}>
                    <Text style={styles.bottomBasketPrice}>
                        {formatRiyal(totalPrice, isRTL ? 'ar' : 'en')}
                    </Text>
                    <Text style={styles.bottomBasketDetails}>
                        {items.length} {isRTL ? 'خدمة' : 'service(s)'} • {formatDuration(totalDuration)}
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.bottomBasketButton}
                    onPress={handleContinue}
                >
                    <Text style={styles.bottomBasketButtonText}>{isRTL ? 'متابعة' : 'Continue'}</Text>
                    <AppIcon name={isRTL ? 'arrow_back' : 'arrow_forward'} size={20} color="#FFFFFF" />
                </TouchableOpacity>
            </View>
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
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
    },
    headerRight: {
        width: 40,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.lg,
    },
    sectionDescription: {
        fontSize: 15,
        color: colors.textSecondary,
        marginBottom: spacing.lg,
        lineHeight: 22,
    },
    serviceCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    serviceCardExpanded: {
        borderColor: colors.primary,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    serviceHeader: {
        marginBottom: spacing.md,
    },
    serviceInfo: {
        flex: 1,
    },
    serviceName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 4,
    },
    serviceDuration: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    dropdownSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.backgroundGray || '#F9FAFB',
        padding: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
    },
    dropdownContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: spacing.sm,
    },
    dropdownSelectedText: {
        fontSize: 15,
        fontWeight: '500',
        color: colors.text,
        marginLeft: spacing.sm,
        flex: 1,
    },
    anyAvatarSmall: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#E9D5FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarPlaceholder: {
        backgroundColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    avatarPlaceholderText: {
        fontWeight: 'bold',
        color: colors.textSecondary,
    },
    expandedList: {
        marginTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: spacing.sm,
    },
    staffListItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderRadius: 8,
        paddingHorizontal: spacing.sm,
    },
    staffListItemSelected: {
        backgroundColor: '#F3E8FF',
    },
    staffListItemInfo: {
        flex: 1,
        marginLeft: spacing.md,
        marginRight: spacing.sm,
    },
    staffListItemInfoRtl: {
        marginLeft: spacing.sm,
        marginRight: spacing.md,
        alignItems: 'flex-start',
    },
    staffListItemName: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 2,
    },
    staffListItemRole: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    noStaffText: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        marginVertical: spacing.md,
    },
    checkDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.primary,
    },
    bottomBasketContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 10,
    },
    bottomBasketLeft: {
        flex: 1,
    },
    bottomBasketPrice: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 2,
    },
    bottomBasketDetails: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    bottomBasketButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.lg,
        paddingVertical: 12,
        borderRadius: 8,
    },
    bottomBasketButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        marginRight: spacing.sm,
    },
});
