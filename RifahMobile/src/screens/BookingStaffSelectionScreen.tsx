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

type SelectionMode = 'any' | 'choose' | null;

export function BookingStaffSelectionScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<any>>();
    const route = useRoute<any>();
    const { tenantId } = route.params || {};
    const { items, updateItem } = useServiceBookingCart();
    const { isRTL } = useLanguage();
    const { topInset, bottomInset, scrollBottomPadding } = useScreenSafeArea();

    const [loading, setLoading] = useState(true);
    const [selectedMode, setSelectedMode] = useState<SelectionMode>(null);
    const [serviceStaffMap, setServiceStaffMap] = useState<Record<string, Staff[]>>({});
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

        // Initialize mode based on current cart state if not set yet.
        // If all items have a requestedStaffId or staff assigned, it's 'choose'.
        // Otherwise, we default to 'any' initially if they haven't explicitly chosen.
        if (selectedMode === null) {
            const hasAnyExplicitStaff = items.some(item => item.requestedStaffId || item.staff);
            setSelectedMode(hasAnyExplicitStaff ? 'choose' : 'any');
        }

        fetchEligibleStaffPerService();
    }, [tenantId, items.length]);

    const fetchEligibleStaffPerService = async () => {
        try {
            setLoading(true);
            const map: Record<string, Staff[]> = {};
            
            const promises = items.map(async (item) => {
                if (map[item.service.id]) return; // Skip if already fetched
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
            console.error('Failed to load eligible staff:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectMode = (mode: SelectionMode) => {
        setSelectedMode(mode);
        if (mode === 'any') {
            // Explicitly clear staff assignments when Any is selected
            items.forEach(item => {
                updateItem(item.id, { staff: null, requestedStaffId: null });
            });
            setExpandedServiceId(null);
        } else if (mode === 'choose' && items.length > 0) {
            // Auto expand the first item for convenience if they haven't selected one
            setExpandedServiceId(items[0].id);
        }
    };

    const handleSelectStaff = (itemId: string, staff: Staff | null) => {
        updateItem(itemId, {
            staff: staff,
            requestedStaffId: staff ? staff.id : null
        });
        setExpandedServiceId(null); // Close accordion on selection
    };

    const toggleAccordion = (itemId: string) => {
        setExpandedServiceId(prev => prev === itemId ? null : itemId);
    };

    const handleContinue = () => {
        navigation.navigate('BookingDateTimeSelection', { tenantId });
    };

    if (items.length === 0) {
        return (
            <View style={[styles.container, { paddingTop: topInset }]}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <AppIcon name={isRTL ? 'arrow_forward' : 'arrow_back'} size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>
                <View style={styles.emptyState}>
                    <AppIcon name="cart" size={48} color={colors.textSecondary} />
                    <Text style={styles.emptyText}>{isRTL ? 'السلة فارغة' : 'Your basket is empty'}</Text>
                </View>
            </View>
        );
    }

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

    // Determine if continue is allowed
    // Any mode: always allowed
    // Choose mode: every service must have a staff selected
    const isContinueEnabled = selectedMode === 'any' || (selectedMode === 'choose' && items.every(item => item.staff !== null && item.staff !== undefined));

    return (
        <View style={[styles.container, { paddingTop: topInset }]}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <AppIcon name={isRTL ? 'arrow_forward' : 'arrow_back'} size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{isRTL ? 'اختر المختص' : 'Choose a professional'}</Text>
                <View style={styles.headerRight} />
            </View>

            <View style={styles.summaryContainer}>
                <Text style={styles.summaryText}>
                    {items.length} {isRTL ? (items.length === 1 ? 'خدمة' : 'خدمات') : (items.length === 1 ? 'service' : 'services')} · {formatDuration(totalDuration)}
                </Text>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={[styles.listContent, { paddingBottom: scrollBottomPadding + 100 }]}>
                    
                    {/* Any Professional Mode */}
                    <TouchableOpacity 
                        style={[styles.modeCard, selectedMode === 'any' && styles.selectedModeCard]}
                        onPress={() => handleSelectMode('any')}
                    >
                        <View style={styles.modeCardContent}>
                            <View style={[styles.modeInfo, isRTL ? styles.modeInfoRtl : null]}>
                                <Text style={styles.modeName}>
                                    {isRTL ? 'أي مختص' : 'Any professional'}
                                </Text>
                                <Text style={styles.modeDescription}>
                                    {isRTL ? 'سنختار لك أفضل مختص متاح للخدمات التي اخترتها.' : 'We\'ll find the best available professional for your selected services.'}
                                </Text>
                            </View>
                            <View style={[styles.selectionIndicator, selectedMode === 'any' && styles.selectionIndicatorActive]}>
                                {selectedMode === 'any' && <View style={styles.checkDot} />}
                            </View>
                        </View>
                    </TouchableOpacity>

                    {/* Choose Professionals Mode */}
                    <TouchableOpacity 
                        style={[styles.modeCard, selectedMode === 'choose' && styles.selectedModeCard]}
                        onPress={() => handleSelectMode('choose')}
                    >
                        <View style={styles.modeCardContent}>
                            <View style={[styles.modeInfo, isRTL ? styles.modeInfoRtl : null]}>
                                <Text style={styles.modeName}>
                                    {isRTL ? 'اختيار المختصين' : 'Choose professionals'}
                                </Text>
                                <Text style={styles.modeDescription}>
                                    {isRTL ? 'اختر مختصًا لكل خدمة.' : 'Choose a professional for each service.'}
                                </Text>
                            </View>
                            <View style={[styles.selectionIndicator, selectedMode === 'choose' && styles.selectionIndicatorActive]}>
                                {selectedMode === 'choose' && <View style={styles.checkDot} />}
                            </View>
                        </View>
                    </TouchableOpacity>

                    {/* Per-Service Selection Interface */}
                    {selectedMode === 'choose' && (
                        <View style={styles.perServiceContainer}>
                            {items.map(item => {
                                const isExpanded = expandedServiceId === item.id;
                                const staffList = serviceStaffMap[item.service.id] || [];
                                const selectedStaff = item.staff;

                                return (
                                    <View key={item.id} style={[styles.serviceCard, isExpanded && styles.serviceCardExpanded]}>
                                        <View style={styles.serviceHeader}>
                                            <View style={[styles.serviceInfo, isRTL ? styles.serviceInfoRtl : null]}>
                                                <Text style={styles.serviceName}>
                                                    {isRTL ? (item.service.name_ar || item.service.name_en) : (item.service.name_en || item.service.name_ar)}
                                                </Text>
                                                <Text style={styles.serviceDuration}>
                                                    {formatDuration(item.service.duration)} · {formatRiyal(item.totalPrice, isRTL ? 'ar' : 'en')}
                                                </Text>
                                            </View>
                                        </View>

                                        <Text style={[styles.professionalLabel, isRTL ? { textAlign: 'right' } : null]}>
                                            {isRTL ? 'المختص:' : 'Professional:'}
                                        </Text>

                                        <TouchableOpacity 
                                            style={styles.dropdownSelector}
                                            onPress={() => toggleAccordion(item.id)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={[styles.dropdownContent, isRTL ? { flexDirection: 'row-reverse' } : null]}>
                                                {selectedStaff ? (
                                                    <>
                                                        {renderStaffAvatar(selectedStaff, 24)}
                                                        <Text style={[styles.dropdownSelectedText, isRTL ? { marginRight: spacing.sm, textAlign: 'right' } : null]} numberOfLines={1}>
                                                            {isRTL ? (selectedStaff.name_ar || selectedStaff.name_en || selectedStaff.name) : (selectedStaff.name_en || selectedStaff.name_ar || selectedStaff.name)}
                                                        </Text>
                                                    </>
                                                ) : (
                                                    <Text style={[styles.dropdownSelectedText, { color: colors.textSecondary }, isRTL ? { textAlign: 'right' } : null]} numberOfLines={1}>
                                                        {isRTL ? '[ اختر مختصًا ▼ ]' : '[ Choose professional ▼ ]'}
                                                    </Text>
                                                )}
                                            </View>
                                        </TouchableOpacity>

                                        {isExpanded && (
                                            <View style={styles.expandedList}>
                                                {/* Staff Options */}
                                                {staffList.map(staff => {
                                                    const isSelected = selectedStaff?.id === staff.id;
                                                    return (
                                                        <TouchableOpacity 
                                                            key={staff.id}
                                                            style={[styles.staffListItem, isSelected && styles.staffListItemSelected, isRTL ? { flexDirection: 'row-reverse' } : null]}
                                                            onPress={() => handleSelectStaff(item.id, staff)}
                                                        >
                                                            {renderStaffAvatar(staff, 40)}
                                                            <View style={[styles.staffListItemInfo, isRTL ? styles.staffListItemInfoRtl : null]}>
                                                                <Text style={[styles.staffListItemName, isRTL ? { textAlign: 'right' } : null]}>
                                                                    {isRTL ? (staff.name_ar || staff.name_en || staff.name) : (staff.name_en || staff.name_ar || staff.name)}
                                                                </Text>
                                                                {(staff.role || staff.specialty || staff.specialization) && (
                                                                    <Text style={[styles.staffListItemRole, isRTL ? { textAlign: 'right' } : null]}>
                                                                        {staff.role || staff.specialty || staff.specialization}
                                                                    </Text>
                                                                )}
                                                            </View>
                                                            {staff.rating !== undefined && (
                                                                <View style={styles.ratingContainer}>
                                                                    <AppIcon name="star" size={14} color="#FBBF24" />
                                                                    <Text style={styles.ratingText}>{staff.rating.toFixed(1)}</Text>
                                                                </View>
                                                            )}
                                                            {isSelected && (
                                                                <View style={[styles.checkDotWrapper, isRTL ? { marginRight: spacing.sm } : { marginLeft: spacing.sm }]}>
                                                                    <AppIcon name="check" size={16} color={colors.primary} />
                                                                </View>
                                                            )}
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                                {staffList.length === 0 && (
                                                    <Text style={styles.noStaffText}>
                                                        {isRTL ? 'لا يوجد مختصون متاحون.' : 'No professionals available.'}
                                                    </Text>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </ScrollView>
            )}

            {/* Bottom Fixed Button */}
            <View style={[styles.bottomBasketContainer, { paddingBottom: Math.max(bottomInset, spacing.md) }]}>
                {!isContinueEnabled && selectedMode === 'choose' && (
                    <Text style={[styles.validationMessage, isRTL ? { textAlign: 'right' } : null]}>
                        {isRTL ? 'يرجى اختيار مختص لكل خدمة.' : 'Please choose a professional for each service.'}
                    </Text>
                )}
                <TouchableOpacity
                    style={[styles.continueButton, !isContinueEnabled && styles.continueButtonDisabled]}
                    disabled={!isContinueEnabled}
                    onPress={handleContinue}
                >
                    <Text style={styles.continueButtonText}>{isRTL ? 'متابعة' : 'Continue'}</Text>
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
        backgroundColor: colors.surface,
    },
    backButton: {
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
    summaryContainer: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        alignItems: 'center',
    },
    summaryText: {
        fontSize: 14,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        marginTop: spacing.md,
        fontSize: 16,
        color: colors.textSecondary,
    },
    listContent: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.lg,
    },
    modeCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    selectedModeCard: {
        borderColor: colors.primary,
        backgroundColor: '#F9F5FF',
    },
    modeCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    modeInfo: {
        flex: 1,
        paddingRight: spacing.md,
    },
    modeInfoRtl: {
        paddingRight: 0,
        paddingLeft: spacing.md,
    },
    modeName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 4,
    },
    modeDescription: {
        fontSize: 13,
        color: colors.textSecondary,
        lineHeight: 18,
    },
    selectionIndicator: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    selectionIndicatorActive: {
        borderColor: colors.primary,
    },
    checkDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.primary,
    },
    perServiceContainer: {
        marginTop: spacing.md,
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
    },
    serviceHeader: {
        marginBottom: spacing.sm,
    },
    serviceInfo: {
        flex: 1,
    },
    serviceInfoRtl: {
        alignItems: 'flex-end',
    },
    serviceName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 2,
    },
    serviceDuration: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    professionalLabel: {
        fontSize: 13,
        color: colors.text,
        fontWeight: '600',
        marginBottom: spacing.xs,
        marginTop: spacing.sm,
    },
    dropdownSelector: {
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
    },
    dropdownSelectedText: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.text,
        marginLeft: spacing.sm,
        flex: 1,
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
        backgroundColor: '#F9F5FF',
    },
    staffListItemInfo: {
        flex: 1,
        marginLeft: spacing.md,
        marginRight: spacing.sm,
    },
    staffListItemInfoRtl: {
        marginLeft: spacing.sm,
        marginRight: spacing.md,
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
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
    },
    ratingText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textSecondary,
        marginLeft: 4,
    },
    checkDotWrapper: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    noStaffText: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        marginVertical: spacing.md,
    },
    bottomBasketContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 10,
    },
    validationMessage: {
        color: '#DC2626',
        fontSize: 13,
        fontWeight: '500',
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
    continueButton: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        paddingVertical: 14,
        borderRadius: 12,
        width: '100%',
    },
    continueButtonDisabled: {
        backgroundColor: colors.border,
    },
    continueButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
});
