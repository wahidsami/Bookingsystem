import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    Image,
    ActivityIndicator,
} from 'react-native';
import { ThemedText as Text } from '../ThemedText';
import { AppIcon } from '../AppIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatRiyal } from '../../utils/currency';
import { Staff, getImageUrl, getServicePrice } from '../../api/client';
import { ServiceBookingCartItem } from '../../contexts/ServiceBookingCartContext';

export interface BookingStaffSelectorProps {
    items: ServiceBookingCartItem[];
    selectedMode: 'any' | 'choose';
    onModeChange: (mode: 'any' | 'choose') => void;
    eligibleStaffMap: Record<string, Staff[]>;
    onSelectStaff: (itemId: string, staff: Staff | null) => void;
    loadingStaff?: boolean;
}

export function BookingStaffSelector({
    items,
    selectedMode,
    onModeChange,
    eligibleStaffMap,
    onSelectStaff,
    loadingStaff = false,
}: BookingStaffSelectorProps) {
    const { isRTL, language } = useLanguage();
    const [expandedItemId, setExpandedItemId] = useState<string | null>(
        items[0]?.id || null
    );

    const toggleAccordion = (itemId: string) => {
        setExpandedItemId((prev) => (prev === itemId ? null : itemId));
    };

    const renderStaffAvatar = (staff: Staff, size: number = 44) => {
        const imageUrl = getImageUrl(staff.avatar || staff.image);
        if (imageUrl) {
            return (
                <Image
                    source={{ uri: imageUrl }}
                    style={[
                        styles.avatarImage,
                        { width: size, height: size, borderRadius: size / 2 },
                    ]}
                />
            );
        }

        const initial = (staff.name_en || staff.name_ar || staff.name || 'S')
            .charAt(0)
            .toUpperCase();
        return (
            <View
                style={[
                    styles.avatarPlaceholder,
                    { width: size, height: size, borderRadius: size / 2 },
                ]}
            >
                <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Segmented Controller */}
            <View style={styles.modeController}>
                {/* Mode 1: Any Professional */}
                <TouchableOpacity
                    style={[
                        styles.modeButton,
                        isRTL && styles.rowRTL,
                        selectedMode === 'any' && styles.modeButtonActive,
                    ]}
                    onPress={() => onModeChange('any')}
                    activeOpacity={0.8}
                >
                    <View style={styles.modeRadio}>
                        <View
                            style={[
                                styles.modeRadioInner,
                                selectedMode === 'any' &&
                                    styles.modeRadioInnerActive,
                            ]}
                        />
                    </View>
                    <View style={[styles.modeTextContainer, isRTL && styles.alignEnd]}>
                        <View style={[styles.modeTitleRow, isRTL && styles.rowRTL]}>
                            <Text
                                style={[
                                    styles.modeTitle,
                                    selectedMode === 'any' &&
                                        styles.modeTitleActive,
                                    isRTL && { textAlign: 'right' },
                                ]}
                            >
                                {isRTL ? 'أي مقدم خدمة' : 'Any professional'}
                            </Text>
                            {selectedMode === 'any' && (
                                <View style={styles.activePill}>
                                    <Text style={styles.activePillText}>
                                        {isRTL ? 'محدد' : 'Active'}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <Text style={[styles.modeSubtitle, isRTL && { textAlign: 'right' }]}>
                            {isRTL
                                ? 'تعيين تلقائي للمختص المتاح للحصول على أقرب موعد'
                                : 'Assign available specialist automatically for earliest slot'}
                        </Text>
                    </View>
                    <AppIcon
                        name="sparkles"
                        size={20}
                        color={selectedMode === 'any' ? '#6537C0' : '#716B88'}
                    />
                </TouchableOpacity>

                {/* Mode 2: Choose Professionals */}
                <TouchableOpacity
                    style={[
                        styles.modeButton,
                        isRTL && styles.rowRTL,
                        selectedMode === 'choose' && styles.modeButtonActive,
                    ]}
                    onPress={() => onModeChange('choose')}
                    activeOpacity={0.8}
                >
                    <View style={styles.modeRadio}>
                        <View
                            style={[
                                styles.modeRadioInner,
                                selectedMode === 'choose' &&
                                    styles.modeRadioInnerActive,
                            ]}
                        />
                    </View>
                    <View style={[styles.modeTextContainer, isRTL && styles.alignEnd]}>
                        <View style={[styles.modeTitleRow, isRTL && styles.rowRTL]}>
                            <Text
                                style={[
                                    styles.modeTitle,
                                    selectedMode === 'choose' &&
                                        styles.modeTitleActive,
                                    isRTL && { textAlign: 'right' },
                                ]}
                            >
                                {isRTL
                                    ? 'اختيار المختصين'
                                    : 'Choose professionals'}
                            </Text>
                            {selectedMode === 'choose' && (
                                <View style={styles.activePill}>
                                    <Text style={styles.activePillText}>
                                        {isRTL ? 'محدد' : 'Active'}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <Text style={[styles.modeSubtitle, isRTL && { textAlign: 'right' }]}>
                            {isRTL
                                ? 'تحديد مختص محدد لكل خدمة مختارة'
                                : 'Select a dedicated specialist for each service'}
                        </Text>
                    </View>
                    <AppIcon
                        name="star"
                        size={20}
                        color={
                            selectedMode === 'choose' ? '#6537C0' : '#716B88'
                        }
                    />
                </TouchableOpacity>
            </View>

            {/* Per-Service Specialist List (when Choose Mode is Active) */}
            {selectedMode === 'choose' && (
                <View style={styles.servicesSection}>
                    <View style={[styles.sectionHeaderRow, isRTL && styles.rowRTL]}>
                        <Text style={styles.sectionHeading}>
                            {isRTL
                                ? 'تحديد المختص لكل خدمة'
                                : 'Select for each service'}
                        </Text>
                        <Text style={styles.sectionReadyCount}>
                            {items.filter((i) => i.staff !== null).length} /{' '}
                            {items.length} {isRTL ? 'جاهز' : 'ready'}
                        </Text>
                    </View>

                    {items.map((item, idx) => {
                        const serviceName = isRTL
                            ? item.service.name_ar || item.service.name_en
                            : item.service.name_en || item.service.name_ar;
                        const duration = item.service.duration || 30;
                        const price = getServicePrice(item.service, item.variant);
                        const isExpanded = expandedItemId === item.id;
                        const eligibleStaff =
                            eligibleStaffMap[item.service.id] || [];
                        const assignedStaff = item.staff;

                        return (
                            <View key={item.id} style={styles.serviceCard}>
                                {/* Service Accordion Header */}
                                <TouchableOpacity
                                    style={[styles.serviceHeader, isRTL && styles.rowRTL]}
                                    onPress={() => toggleAccordion(item.id)}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.serviceHeaderLeft, isRTL && styles.alignEnd]}>
                                        <Text style={[styles.serviceIndexTag, isRTL && { textAlign: 'right' }]}>
                                            {isRTL
                                                ? `الخدمة ${idx + 1}`
                                                : `Service ${idx + 1}`}
                                        </Text>
                                        <Text
                                            style={[styles.serviceTitle, isRTL && { textAlign: 'right' }]}
                                            numberOfLines={1}
                                        >
                                            {serviceName}
                                        </Text>
                                        <Text style={[styles.serviceMeta, isRTL && { textAlign: 'right' }]}>
                                            {duration}{' '}
                                            {isRTL ? 'دقيقة' : 'min'} •{' '}
                                            {formatRiyal(price, language)}
                                        </Text>
                                    </View>

                                    <View style={[styles.serviceHeaderRight, isRTL && styles.rowRTL]}>
                                        <View style={styles.serviceIconPill}>
                                            <AppIcon
                                                name="sparkles"
                                                size={18}
                                                color="#6537C0"
                                            />
                                        </View>
                                        <AppIcon
                                            name={
                                                isExpanded
                                                    ? 'chevron_left'
                                                    : 'chevron_right'
                                            }
                                            size={20}
                                            color="#716B88"
                                        />
                                    </View>
                                </TouchableOpacity>

                                {/* Assigned Specialist Notice */}
                                <View style={[styles.assignedNotice, isRTL && styles.rowRTL]}>
                                    <AppIcon
                                        name="verified_user"
                                        size={16}
                                        color="#6537C0"
                                    />
                                    <Text
                                        style={[
                                            styles.assignedNoticeText,
                                            {
                                                textAlign: isRTL ? 'right' : 'left',
                                                writingDirection: isRTL ? 'rtl' : 'ltr',
                                            },
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {isRTL
                                            ? 'المختص المحدد: '
                                            : 'Assigned: '}
                                        <Text style={styles.assignedName}>
                                            {assignedStaff
                                                ? isRTL
                                                    ? assignedStaff.name_ar ||
                                                      assignedStaff.name_en ||
                                                      assignedStaff.name
                                                    : assignedStaff.name_en ||
                                                      assignedStaff.name_ar ||
                                                      assignedStaff.name
                                                : isRTL
                                                ? 'لم يتم الاختيار بعد'
                                                : 'Not selected yet'}
                                        </Text>
                                    </Text>
                                </View>

                                {/* Expanded Specialist Options */}
                                {isExpanded && (
                                    <View style={styles.specialistsList}>
                                        {loadingStaff ? (
                                            <View style={styles.loadingBox}>
                                                <ActivityIndicator
                                                    size="small"
                                                    color="#6537C0"
                                                />
                                            </View>
                                        ) : eligibleStaff.length === 0 ? (
                                            <Text style={styles.emptyStaffText}>
                                                {isRTL
                                                    ? 'لا يوجد مختصون متاحون لهذه الخدمة'
                                                    : 'No specialists available for this service'}
                                            </Text>
                                        ) : (
                                            eligibleStaff.map((staff) => {
                                                const isSelected =
                                                    assignedStaff?.id ===
                                                    staff.id;
                                                const staffName = isRTL
                                                    ? staff.name_ar ||
                                                      staff.name_en ||
                                                      staff.name
                                                    : staff.name_en ||
                                                      staff.name_ar ||
                                                      staff.name;
                                                const title =
                                                    staff.specialty ||
                                                    staff.role ||
                                                    (isRTL
                                                        ? 'أخصائية'
                                                        : 'Specialist');

                                                return (
                                                    <TouchableOpacity
                                                        key={staff.id}
                                                        style={[
                                                            styles.specialistRow,
                                                            isRTL && styles.rowRTL,
                                                            isSelected &&
                                                                styles.specialistRowSelected,
                                                        ]}
                                                        onPress={() =>
                                                            onSelectStaff(
                                                                item.id,
                                                                staff
                                                            )
                                                        }
                                                        activeOpacity={0.7}
                                                    >
                                                        <View
                                                            style={
                                                                styles.avatarContainer
                                                            }
                                                        >
                                                            {renderStaffAvatar(
                                                                staff,
                                                                44
                                                            )}
                                                            {isSelected && (
                                                                <View
                                                                    style={
                                                                        styles.checkBadge
                                                                    }
                                                                >
                                                                    <AppIcon
                                                                        name="check"
                                                                        size={10}
                                                                        color="#FFFFFF"
                                                                    />
                                                                </View>
                                                            )}
                                                        </View>

                                                        <View
                                                            style={[
                                                                styles.staffInfo,
                                                                {
                                                                    marginStart: 12,
                                                                    marginEnd: 4,
                                                                },
                                                            ]}
                                                        >
                                                            <View
                                                                style={[
                                                                    styles.nameRow,
                                                                    {
                                                                        flexDirection: isRTL ? 'row-reverse' : 'row',
                                                                    },
                                                                ]}
                                                            >
                                                                <Text
                                                                    style={[
                                                                        styles.staffName,
                                                                        {
                                                                            textAlign: isRTL ? 'right' : 'left',
                                                                            writingDirection: isRTL ? 'rtl' : 'ltr',
                                                                        },
                                                                    ]}
                                                                    numberOfLines={
                                                                        1
                                                                    }
                                                                >
                                                                    {staffName}
                                                                </Text>
                                                                <View
                                                                    style={
                                                                        styles.ratingPill
                                                                    }
                                                                >
                                                                    <AppIcon
                                                                        name="star"
                                                                        size={12}
                                                                        color="#F59E0B"
                                                                    />
                                                                    <Text
                                                                        style={
                                                                            styles.ratingText
                                                                        }
                                                                    >
                                                                        {staff.rating ||
                                                                            '5.0'}
                                                                    </Text>
                                                                </View>
                                                            </View>
                                                            <Text
                                                                style={[
                                                                    styles.staffTitle,
                                                                    {
                                                                        textAlign: isRTL ? 'right' : 'left',
                                                                        writingDirection: isRTL ? 'rtl' : 'ltr',
                                                                    },
                                                                ]}
                                                                numberOfLines={1}
                                                            >
                                                                {title}
                                                            </Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                );
                                            })
                                        )}
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    modeController: {
        backgroundColor: '#FAF9FC',
        borderRadius: 16,
        padding: 6,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        gap: 6,
        marginBottom: 16,
    },
    modeButton: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 14,
        borderRadius: 12,
        backgroundColor: '#FAF9FC',
    },
    modeButtonActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    modeRadio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#E7DDFC',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    modeRadioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: 'transparent',
    },
    modeRadioInnerActive: {
        backgroundColor: '#6537C0',
    },
    modeTextContainer: {
        flex: 1,
        marginHorizontal: 12,
    },
    modeTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    modeTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1D035F',
    },
    modeTitleActive: {
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
    },
    activePill: {
        backgroundColor: '#E7DDFC',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    activePillText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#6537C0',
    },
    modeSubtitle: {
        fontSize: 12,
        color: '#716B88',
        marginTop: 3,
        lineHeight: 16,
    },
    servicesSection: {
        marginTop: 8,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    sectionHeading: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
    },
    sectionReadyCount: {
        fontSize: 12,
        fontWeight: '600',
        color: '#716B88',
    },
    serviceCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        padding: 14,
        marginBottom: 12,
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    serviceHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    serviceHeaderLeft: {
        flex: 1,
        marginRight: 8,
    },
    serviceIndexTag: {
        fontSize: 11,
        fontWeight: '700',
        color: '#6537C0',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    serviceTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1D035F',
        marginTop: 2,
        fontFamily: 'Cairo-Bold',
    },
    serviceMeta: {
        fontSize: 12,
        color: '#716B88',
        marginTop: 2,
    },
    serviceHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    serviceIconPill: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F1ECFD',
        alignItems: 'center',
        justifyContent: 'center',
    },
    assignedNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FAF9FC',
        padding: 8,
        borderRadius: 10,
        marginTop: 10,
        gap: 6,
    },
    assignedNoticeText: {
        fontSize: 12,
        color: '#716B88',
        flex: 1,
    },
    assignedName: {
        fontWeight: '600',
        color: '#1D035F',
    },
    specialistsList: {
        marginTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#FAF9FC',
        paddingTop: 10,
        gap: 8,
    },
    specialistRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 12,
        backgroundColor: '#FAF9FC',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    specialistRowSelected: {
        backgroundColor: '#FFFFFF',
        borderColor: '#6537C0',
        shadowColor: '#6537C0',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    avatarContainer: {
        position: 'relative',
    },
    avatarImage: {
        resizeMode: 'cover',
    },
    avatarPlaceholder: {
        backgroundColor: '#E7DDFC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitial: {
        fontSize: 16,
        fontWeight: '700',
        color: '#6537C0',
    },
    checkBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#6537C0',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
    },
    staffInfo: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    staffName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1D035F',
        flex: 1,
        marginRight: 6,
    },
    ratingPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    ratingText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1D035F',
    },
    staffTitle: {
        fontSize: 12,
        color: '#716B88',
        marginTop: 2,
    },
    loadingBox: {
        padding: 16,
        alignItems: 'center',
    },
    emptyStaffText: {
        fontSize: 12,
        color: '#716B88',
        textAlign: 'center',
        paddingVertical: 12,
    },
    rowRTL: {
        flexDirection: 'row-reverse',
    },
    alignEnd: {
        alignItems: 'flex-end',
    },
});
