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
    const { items, updateItem, totalPrice } = useServiceBookingCart();
    const { isRTL } = useLanguage();
    const { topInset, bottomInset, scrollBottomPadding } = useScreenSafeArea();

    const [loading, setLoading] = useState(true);
    const [selectedMode, setSelectedMode] = useState<SelectionMode>(null);
    const [serviceStaffMap, setServiceStaffMap] = useState<Record<string, Staff[]>>({});
    const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);

    const totalDuration = useMemo(() => {
        return items.reduce((acc, item) => acc + (item.service.duration || 0), 0);
    }, [items]);

    const formatDuration = (minutes: number) => {
        if (minutes < 60) return isRTL ? `${minutes} دقيقة` : `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (mins === 0) return isRTL ? `${hours} ساعة` : `${hours} h`;
        return isRTL ? `${hours} س ${mins} د` : `${hours}h ${mins}m`;
    };

    useEffect(() => {
        if (!tenantId || items.length === 0) {
            if (navigation.isFocused()) navigation.goBack();
            return;
        }

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
                if (map[item.service.id]) return;
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
            items.forEach(item => updateItem(item.id, { staff: null, requestedStaffId: null }));
            setExpandedServiceId(null);
        } else if (mode === 'choose' && items.length > 0) {
            setExpandedServiceId(items[0].id);
        }
    };

    const handleSelectStaff = (itemId: string, staff: Staff | null) => {
        updateItem(itemId, { staff: staff, requestedStaffId: staff ? staff.id : null });
        setExpandedServiceId(null);
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

    const renderStaffAvatar = (staff: Staff, size: number = 48) => {
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

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={[styles.listContent, { paddingBottom: scrollBottomPadding + 140 }]}>
                    {/* Booking Context Pill Card (Stitch aligned) */}
                    <View style={styles.contextPill}>
                        <View style={styles.contextPillRow}>
                            <View style={styles.contextPillIcon}>
                                <AppIcon name="storefront" size={20} color={colors.primary} />
                            </View>
                            <Text style={styles.contextPillText}>
                                {isRTL ? 'تفاصيل الحجز' : 'Booking Details'}
                            </Text>
                        </View>
                        <View style={styles.contextPillDuration}>
                            <AppIcon name="clock" size={14} color={colors.textSecondary} />
                            <Text style={styles.contextPillDurationText}>{formatDuration(totalDuration)}</Text>
                        </View>
                    </View>

                    {/* Professional Mode Segmented Controller */}
                    <View style={styles.segmentedController}>
                        <TouchableOpacity 
                            style={[styles.segmentButton, selectedMode === 'any' && styles.segmentButtonActive]}
                            onPress={() => handleSelectMode('any')}
                        >
                            <AppIcon name="sparkles" size={18} color={selectedMode === 'any' ? colors.primary : colors.textSecondary} />
                            <Text style={[styles.segmentText, selectedMode === 'any' && styles.segmentTextActive]}>
                                {isRTL ? 'أي مختص' : 'Any professional'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.segmentButton, selectedMode === 'choose' && styles.segmentButtonActive]}
                            onPress={() => handleSelectMode('choose')}
                        >
                            <AppIcon name="star" size={18} color={selectedMode === 'choose' ? colors.primary : colors.textSecondary} />
                            <Text style={[styles.segmentText, selectedMode === 'choose' && styles.segmentTextActive]}>
                                {isRTL ? 'اختيار المختصين' : 'Choose professionals'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Per-Service Selection Interface */}
                    {selectedMode === 'choose' && (
                        <View style={styles.perServiceContainer}>
                            {items.map((item, index) => {
                                const isExpanded = expandedServiceId === item.id;
                                const staffList = serviceStaffMap[item.service.id] || [];
                                const selectedStaff = item.staff;

                                return (
                                    <View key={item.id} style={[styles.serviceCard, isExpanded && styles.serviceCardExpanded]}>
                                        <View style={styles.serviceHeader}>
                                            <View style={styles.serviceBadge}>
                                                <Text style={styles.serviceBadgeText}>
                                                    {isRTL ? 'الخدمة' : 'Service'} {index + 1}
                                                </Text>
                                            </View>
                                            <Text style={styles.serviceName}>
                                                {isRTL ? (item.service.name_ar || item.service.name_en) : (item.service.name_en || item.service.name_ar)}
                                            </Text>
                                            <Text style={styles.serviceDuration}>
                                                {formatDuration(item.service.duration)} · {formatRiyal(item.totalPrice, isRTL ? 'ar' : 'en')}
                                            </Text>
                                        </View>

                                        <TouchableOpacity 
                                            style={[styles.dropdownSelector, isExpanded && styles.dropdownSelectorExpanded]}
                                            onPress={() => toggleAccordion(item.id)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.dropdownContent}>
                                                {selectedStaff ? (
                                                    <View style={styles.dropdownStaffInfo}>
                                                        {renderStaffAvatar(selectedStaff, 32)}
                                                        <Text style={styles.dropdownSelectedText} numberOfLines={1}>
                                                            {isRTL ? (selectedStaff.name_ar || selectedStaff.name_en || selectedStaff.name) : (selectedStaff.name_en || selectedStaff.name_ar || selectedStaff.name)}
                                                        </Text>
                                                        <View style={styles.dropdownVerified}>
                                                            <AppIcon name="check" size={16} color={colors.primary} />
                                                        </View>
                                                    </View>
                                                ) : (
                                                    <Text style={styles.dropdownPlaceholderText} numberOfLines={1}>
                                                        {isRTL ? 'اختر المختص' : 'Select a professional'}
                                                    </Text>
                                                )}
                                                <AppIcon name={isExpanded ? 'minus' : 'plus'} size={24} color={colors.textSecondary} />
                                            </View>
                                        </TouchableOpacity>

                                        {isExpanded && (
                                            <View style={styles.expandedList}>
                                                {staffList.map(staff => {
                                                    const isSelected = selectedStaff?.id === staff.id;
                                                    return (
                                                        <TouchableOpacity 
                                                            key={staff.id}
                                                            style={[styles.staffListItem, isSelected && styles.staffListItemSelected]}
                                                            onPress={() => handleSelectStaff(item.id, staff)}
                                                        >
                                                            {renderStaffAvatar(staff, 48)}
                                                            <View style={styles.staffListItemInfo}>
                                                                <Text style={styles.staffListItemName}>
                                                                    {isRTL ? (staff.name_ar || staff.name_en || staff.name) : (staff.name_en || staff.name_ar || staff.name)}
                                                                </Text>
                                                                {(staff.role || staff.specialty || staff.specialization) && (
                                                                    <Text style={styles.staffListItemRole}>
                                                                        {staff.role || staff.specialty || staff.specialization}
                                                                    </Text>
                                                                )}
                                                                {staff.rating !== undefined && (
                                                                    <View style={styles.ratingContainer}>
                                                                        <AppIcon name="star" size={14} color="#F59E0B" />
                                                                        <Text style={styles.ratingText}>{staff.rating.toFixed(1)}</Text>
                                                                    </View>
                                                                )}
                                                            </View>
                                                            <View style={[styles.staffSelectBtn, isSelected && styles.staffSelectBtnActive]}>
                                                                <Text style={[styles.staffSelectBtnText, isSelected && styles.staffSelectBtnTextActive]}>
                                                                    {isSelected ? (isRTL ? 'مختار' : 'Selected') : (isRTL ? 'اختيار' : 'Select')}
                                                                </Text>
                                                            </View>
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
                {(!isContinueEnabled && selectedMode === 'choose') ? (
                    <View style={styles.validationCallout}>
                        <AppIcon name="info" size={16} color="#B45309" />
                        <Text style={styles.validationMessage}>
                            {isRTL ? 'يرجى اختيار مختص لكل خدمة' : 'Please select a professional for all services'}
                        </Text>
                    </View>
                ) : (
                    <View style={styles.bottomBasketInfo}>
                        <Text style={styles.bottomBasketItems}>
                            {items.length} {isRTL ? 'عناصر' : 'items'} · {formatDuration(totalDuration)}
                        </Text>
                        <Text style={styles.bottomBasketTotal}>
                            {formatRiyal(totalPrice, isRTL ? 'ar' : 'en')}
                        </Text>
                    </View>
                )}
                
                <TouchableOpacity
                    style={[styles.continueButton, !isContinueEnabled && styles.continueButtonDisabled]}
                    disabled={!isContinueEnabled}
                    onPress={handleContinue}
                >
                    <Text style={styles.continueButtonText}>{isRTL ? 'المتابعة للوقت' : 'Continue to Date & Time'}</Text>
                    <AppIcon name={isRTL ? 'arrow_back' : 'arrow_forward'} size={20} color="#FFFFFF" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        backgroundColor: 'rgba(255,255,255,0.9)',
    },
    backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text },
    headerRight: { width: 40 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { marginTop: spacing.md, fontSize: 16, color: colors.textSecondary },
    listContent: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
    contextPill: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg,
    },
    contextPillRow: { flexDirection: 'row', alignItems: 'center' },
    contextPillIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
    contextPillText: { fontSize: 15, fontWeight: 'bold', color: colors.text },
    contextPillDuration: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    contextPillDurationText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginLeft: 4 },
    segmentedController: {
        flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 12, padding: 4, marginBottom: spacing.lg
    },
    segmentButton: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 12, borderRadius: 8,
    },
    segmentButtonActive: { backgroundColor: colors.surface, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
    segmentText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginLeft: 6 },
    segmentTextActive: { color: colors.primary },
    perServiceContainer: { gap: spacing.md },
    serviceCard: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
    serviceCardExpanded: { borderColor: colors.primary },
    serviceHeader: { marginBottom: spacing.sm },
    serviceBadge: { alignSelf: 'flex-start', backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginBottom: 8 },
    serviceBadgeText: { fontSize: 10, fontWeight: 'bold', color: colors.textSecondary, textTransform: 'uppercase' },
    serviceName: { fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 4 },
    serviceDuration: { fontSize: 14, color: colors.textSecondary },
    dropdownSelector: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: '#F9FAFB', padding: spacing.sm, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm
    },
    dropdownSelectorExpanded: { borderColor: colors.primary, backgroundColor: '#F8F5FF' },
    dropdownContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 },
    dropdownStaffInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    dropdownSelectedText: { fontSize: 15, fontWeight: '600', color: colors.text, marginLeft: spacing.sm, flex: 1 },
    dropdownPlaceholderText: { fontSize: 15, color: colors.textSecondary, flex: 1 },
    dropdownVerified: { marginLeft: spacing.xs },
    avatarPlaceholder: { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    avatarPlaceholderText: { fontWeight: 'bold', color: colors.textSecondary },
    expandedList: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, gap: spacing.sm },
    staffListItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
    staffListItemSelected: { backgroundColor: '#F8F5FF', borderColor: '#EAE1FA' },
    staffListItemInfo: { flex: 1, marginLeft: spacing.md },
    staffListItemName: { fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 2 },
    staffListItemRole: { fontSize: 13, color: colors.textSecondary },
    ratingContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    ratingText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginLeft: 4 },
    staffSelectBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6' },
    staffSelectBtnActive: { backgroundColor: colors.primary },
    staffSelectBtnText: { fontSize: 13, fontWeight: 'bold', color: colors.text },
    staffSelectBtnTextActive: { color: '#FFFFFF' },
    noStaffText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginVertical: spacing.md },
    bottomBasketContainer: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: 'rgba(255,255,255,0.9)', borderTopWidth: 1, borderTopColor: colors.border,
        paddingHorizontal: spacing.md, paddingTop: spacing.md,
    },
    bottomBasketInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    bottomBasketItems: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
    bottomBasketTotal: { fontSize: 20, fontWeight: 'bold', color: colors.text },
    validationCallout: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', padding: spacing.sm, borderRadius: 8, marginBottom: spacing.sm },
    validationMessage: { color: '#B45309', fontSize: 13, fontWeight: '600', marginLeft: spacing.sm },
    continueButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 16, width: '100%' },
    continueButtonDisabled: { backgroundColor: colors.border },
    continueButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginRight: 8 },
});
