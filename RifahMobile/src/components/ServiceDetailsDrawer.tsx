import React, { useState } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ScrollView, Dimensions, Alert } from 'react-native';
import { ThemedText as Text } from './ThemedText';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { AppIcon } from './AppIcon';
import { Service, ServiceVariant, Tenant, getServicePrice } from '../api/client';
import { useServiceBookingCart } from '../contexts/ServiceBookingCartContext';
import { formatRiyal } from '../utils/currency';
import { useScreenSafeArea } from '../utils/safeArea';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ServiceDetailsDrawerProps {
    visible: boolean;
    onClose: () => void;
    service: Service | null;
    variant?: ServiceVariant | null;
    tenant: Tenant | null;
    tenantId?: string;
}

export function ServiceDetailsDrawer({ visible, onClose, service, variant, tenant, tenantId }: ServiceDetailsDrawerProps) {
    const { isRTL } = useLanguage();
    const { bottomInset } = useScreenSafeArea();
    const { items, addItem, removeItem } = useServiceBookingCart();
    const [expandedDescription, setExpandedDescription] = useState(false);
    const [selectedVariant, setSelectedVariant] = useState<ServiceVariant | null>(variant || null);

    const isMainBookable = Boolean(
        service &&
        (Number(service.duration) > 0 || Number((service as any).rawDuration) > 0) &&
        getServicePrice(service) !== undefined &&
        getServicePrice(service) !== null &&
        !isNaN(Number(getServicePrice(service)))
    );

    React.useEffect(() => {
        if (variant) {
            setSelectedVariant(variant);
        } else if (isMainBookable) {
            // Default to Main Service (null variant) when valid and independently bookable
            setSelectedVariant(null);
        } else if (service?.variants && service.variants.length > 0) {
            // Main Service is not independently bookable; default to first variant
            setSelectedVariant(service.variants[0]);
        } else {
            setSelectedVariant(null);
        }
    }, [service, variant, visible, isMainBookable]);

    if (!service) return null;

    const getVariantName = (v: ServiceVariant | null | undefined): string => {
        if (!v) return '';
        if (isRTL) {
            return v.name_ar || v.name_en || v.description || '';
        }
        return v.name_en || v.name_ar || v.description || '';
    };

    const variantTitle = getVariantName(selectedVariant);
    const baseServiceName = (isRTL ? service.name_ar || service.name_en : service.name_en || service.name_ar) || '';
    const serviceName = variantTitle
        ? (isRTL ? `\u200F${baseServiceName} \u2014 ${variantTitle}\u200F` : `${baseServiceName} — ${variantTitle}`)
        : baseServiceName;
    const description = (isRTL ? service.description_ar : service.description_en)
        || service.description_en
        || service.description_ar
        || '';
        
    const effectivePrice = getServicePrice(service, selectedVariant);
    
    // Check included services - handle variations in API data structure
    const includedServices = (service as any).includedServices || (service.variants && (service.variants[0] as any)?.includedServices) || [];

    const isOptionInCart = (targetVariant: ServiceVariant | null) => {
        return items.some(item => item.service.id === service.id && (targetVariant ? item.variant?.id === targetVariant.id : !item.variant));
    };

    const isInCart = isOptionInCart(selectedVariant);

    const handleToggleCartItem = (targetVariant: ServiceVariant | null, closeOnAdd: boolean = false) => {
        const existingItem = items.find(
            item => item.service.id === service.id && (targetVariant ? item.variant?.id === targetVariant.id : !item.variant)
        );

        if (existingItem) {
            removeItem(existingItem.id);
        } else {
            const price = getServicePrice(service, targetVariant);
            const result = addItem({
                id: Math.random().toString(36).substring(7),
                tenantId: tenant?.id || tenantId || '',
                tenant: tenant ? { id: tenant.id, name: tenant.name, name_en: tenant.name_en, name_ar: tenant.name_ar, slug: tenant.slug, logo: tenant.logo } : undefined,
                service: service,
                variant: targetVariant || null,
                staff: null,
                requestedStaffId: null,
                staffId: null,
                startTime: '',
                paymentMethod: 'at-center',
                totalPrice: price,
                payableNowAmount: 0
            });
            
            if (!result.success && result.reason === 'different_tenant') {
                Alert.alert(
                    isRTL ? 'تنبيه' : 'Cannot Add Service',
                    isRTL ? 'لا يمكنك إضافة خدمات من مراكز مختلفة في نفس الحجز. يرجى إفراغ السلة أولاً.' : 'You cannot add services from different centers to the same booking. Please clear your basket first.'
                );
                return;
            }
            if (closeOnAdd) {
                onClose();
            }
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <TouchableOpacity style={styles.backdropButton} onPress={onClose} activeOpacity={1} />
                
                <View style={[styles.drawerContainer, { paddingBottom: Math.max(bottomInset, spacing.lg) }]}>
                    {/* Handle */}
                    <View style={styles.handleBar} />
                    
                    {/* Header */}
                    <View style={[styles.headerRow, isRTL ? styles.headerRowRtl : null]}>
                        <Text style={[styles.title, isRTL ? styles.titleRtl : null]} numberOfLines={1}>
                            {serviceName}
                        </Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <AppIcon name="close" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                        {/* Description */}
                        {!!description && (
                            <View style={styles.section}>
                                <Text 
                                    style={[styles.description, isRTL ? styles.descriptionRtl : null]} 
                                    numberOfLines={expandedDescription ? undefined : 3}
                                >
                                    {description}
                                </Text>
                                {description.length > 100 && (
                                    <TouchableOpacity onPress={() => setExpandedDescription(!expandedDescription)}>
                                        <Text style={[styles.readMoreText, isRTL ? styles.readMoreTextRtl : null]}>
                                            {expandedDescription 
                                                ? (isRTL ? 'إخفاء' : 'Show less') 
                                                : (isRTL ? 'قراءة المزيد' : 'Read more')}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        {/* Options Section when service has variants */}
                        {service.variants && service.variants.length > 0 && (
                            <View style={styles.section}>
                                {/* 1. Main Service Option (Rendered only when independently bookable) */}
                                {isMainBookable && (
                                    <>
                                        <View style={[styles.variantsHeaderRow, isRTL ? styles.variantsHeaderRowRtl : null]}>
                                            <Text style={[styles.sectionTitle, isRTL ? styles.sectionTitleRtl : null]}>
                                                {isRTL ? 'الخدمة الأساسية' : 'Main Service'}
                                            </Text>
                                        </View>

                                        {(() => {
                                            const isMainSelected = selectedVariant === null;
                                            const mainPrice = getServicePrice(service);
                                            const isMainInCart = isOptionInCart(null);

                                            return (
                                                <TouchableOpacity
                                                    style={[
                                                        styles.variantCard,
                                                        isMainSelected && styles.variantCardSelected,
                                                        isRTL && styles.variantCardRtl
                                                    ]}
                                                    onPress={() => setSelectedVariant(null)}
                                                    activeOpacity={0.7}
                                                >
                                                    <View style={[
                                                        styles.variantRadio,
                                                        isMainSelected && styles.variantRadioSelected,
                                                        isRTL && styles.variantRadioRtl
                                                    ]}>
                                                        {isMainSelected && <View style={styles.variantRadioInner} />}
                                                    </View>

                                                    <View style={[styles.variantTextCol, isRTL && styles.variantTextColRtl]}>
                                                        <View style={[styles.variantNameRow, isRTL && styles.variantNameRowRtl]}>
                                                            <Text style={[styles.variantName, isMainSelected && styles.variantNameSelected, isRTL && styles.textRtl]}>
                                                                {baseServiceName}
                                                            </Text>
                                                            {isMainInCart && (
                                                                <View style={styles.inCartBadge}>
                                                                    <Text style={styles.inCartBadgeText}>
                                                                        {isRTL ? 'في السلة' : 'In Basket'}
                                                                    </Text>
                                                                </View>
                                                            )}
                                                        </View>
                                                        {!!service.duration && (
                                                            <Text style={[styles.variantDuration, isRTL && styles.textRtl]}>
                                                                {service.duration} {isRTL ? 'دقيقة' : 'min'}
                                                            </Text>
                                                        )}
                                                    </View>

                                                    <View style={[styles.variantActionCol, isRTL && styles.variantActionColRtl]}>
                                                        <Text style={[styles.variantPrice, isMainSelected && styles.variantPriceSelected]}>
                                                            {formatRiyal(mainPrice, isRTL ? 'ar' : 'en')}
                                                        </Text>
                                                        <TouchableOpacity
                                                            style={[styles.inlineAddBtn, isMainInCart && styles.inlineAddBtnRemove]}
                                                            onPress={() => {
                                                                setSelectedVariant(null);
                                                                handleToggleCartItem(null, false);
                                                            }}
                                                            activeOpacity={0.8}
                                                        >
                                                            <Text style={[styles.inlineAddBtnText, isMainInCart && styles.inlineAddBtnTextRemove]}>
                                                                {isMainInCart ? (isRTL ? 'إزالة' : 'Remove') : (isRTL ? 'إضافة' : 'Add')}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })()}
                                    </>
                                )}

                                {/* 2. Available Variant Options */}
                                <View style={[styles.variantsHeaderRow, isMainBookable && { marginTop: spacing.lg }, isRTL ? styles.variantsHeaderRowRtl : null]}>
                                    <Text style={[styles.sectionTitle, isRTL ? styles.sectionTitleRtl : null]}>
                                        {isRTL ? 'الخيارات المتاحة' : 'Available Options'}
                                    </Text>
                                    <Text style={[styles.variantsCount, isRTL ? styles.variantsCountRtl : null]}>
                                        {service.variants.length} {isRTL ? 'خيارات' : 'options'}
                                    </Text>
                                </View>

                                <View style={styles.variantsList}>
                                    {service.variants.map((v) => {
                                        const isSelected = selectedVariant?.id === v.id;
                                        const vName = getVariantName(v);
                                        const vPrice = getServicePrice(service, v);
                                        const isVInCart = isOptionInCart(v);
                                        const vDuration = v.duration || service.duration;

                                        return (
                                            <TouchableOpacity
                                                key={v.id}
                                                style={[
                                                    styles.variantCard,
                                                    isSelected && styles.variantCardSelected,
                                                    isRTL && styles.variantCardRtl
                                                ]}
                                                onPress={() => setSelectedVariant(v)}
                                                activeOpacity={0.7}
                                            >
                                                <View style={[
                                                    styles.variantRadio,
                                                    isSelected && styles.variantRadioSelected,
                                                    isRTL && styles.variantRadioRtl
                                                ]}>
                                                    {isSelected && <View style={styles.variantRadioInner} />}
                                                </View>

                                                <View style={[styles.variantTextCol, isRTL && styles.variantTextColRtl]}>
                                                    <View style={[styles.variantNameRow, isRTL && styles.variantNameRowRtl]}>
                                                        <Text style={[styles.variantName, isSelected && styles.variantNameSelected, isRTL && styles.textRtl]}>
                                                            {vName}
                                                        </Text>
                                                        {isVInCart && (
                                                            <View style={styles.inCartBadge}>
                                                                <Text style={styles.inCartBadgeText}>
                                                                    {isRTL ? 'في السلة' : 'In Basket'}
                                                                </Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    {!!vDuration && (
                                                        <Text style={[styles.variantDuration, isRTL && styles.textRtl]}>
                                                            {vDuration} {isRTL ? 'دقيقة' : 'min'}
                                                        </Text>
                                                    )}
                                                </View>

                                                <View style={[styles.variantActionCol, isRTL && styles.variantActionColRtl]}>
                                                    <Text style={[styles.variantPrice, isSelected && styles.variantPriceSelected]}>
                                                        {formatRiyal(vPrice, isRTL ? 'ar' : 'en')}
                                                    </Text>
                                                    <TouchableOpacity
                                                        style={[styles.inlineAddBtn, isVInCart && styles.inlineAddBtnRemove]}
                                                        onPress={() => {
                                                            setSelectedVariant(v);
                                                            handleToggleCartItem(v, false);
                                                        }}
                                                        activeOpacity={0.8}
                                                    >
                                                        <Text style={[styles.inlineAddBtnText, isVInCart && styles.inlineAddBtnTextRemove]}>
                                                            {isVInCart ? (isRTL ? 'إزالة' : 'Remove') : (isRTL ? 'إضافة' : 'Add')}
                                                        </Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                        {/* Included Services */}
                        {includedServices && includedServices.length > 0 && (
                            <View style={styles.section}>
                                <View style={[styles.includedHeaderRow, isRTL ? styles.includedHeaderRowRtl : null]}>
                                    <Text style={[styles.sectionTitle, isRTL ? styles.sectionTitleRtl : null]}>
                                        {isRTL ? 'ماذا يشمل' : "What's included"}
                                    </Text>
                                    <Text style={[styles.includedCount, isRTL ? styles.includedCountRtl : null]}>
                                        {includedServices.length} {isRTL ? 'خدمات' : 'services'}
                                    </Text>
                                </View>
                                
                                {includedServices.map((inc: any, index: number) => (
                                    <View key={index} style={[styles.includedItem, isRTL ? styles.includedItemRtl : null]}>
                                        <View style={styles.includedItemDot} />
                                        <View style={[styles.includedItemTextCol, isRTL ? styles.includedItemTextColRtl : null]}>
                                            <Text style={[styles.includedItemName, isRTL ? styles.includedItemNameRtl : null]}>
                                                {isRTL ? inc.name_ar || inc.name_en : inc.name_en || inc.name_ar}
                                            </Text>
                                            <Text style={[styles.includedItemDuration, isRTL ? styles.includedItemDurationRtl : null]}>
                                                {inc.duration} {isRTL ? 'دقيقة' : 'min'}
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}
                        
                        <View style={{ height: 20 }} />
                    </ScrollView>

                    {/* Footer / Action */}
                    <View style={[styles.footer, isRTL ? styles.footerRtl : null]}>
                        <View style={[styles.priceCol, isRTL ? styles.priceColRtl : null]}>
                            <Text style={styles.priceLabel}>{isRTL ? 'السعر' : 'Price'}</Text>
                            <Text style={styles.priceValue}>{formatRiyal(effectivePrice, isRTL ? 'ar' : 'en')}</Text>
                        </View>
                        
                        <TouchableOpacity 
                            style={[styles.actionButton, isInCart ? styles.actionButtonRemove : null]} 
                            onPress={() => handleToggleCartItem(selectedVariant, !isInCart)}
                        >
                            <Text style={[styles.actionButtonText, isInCart ? styles.actionButtonTextRemove : null]}>
                                {isInCart 
                                    ? (isRTL ? 'إزالة' : 'Remove')
                                    : (isRTL ? 'إضافة' : 'Add')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(17, 24, 39, 0.4)',
        justifyContent: 'flex-end',
    },
    backdropButton: {
        flex: 1,
    },
    drawerContainer: {
        backgroundColor: '#F7F4FF',
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        paddingTop: spacing.md,
        maxHeight: SCREEN_HEIGHT * 0.85,
        shadowColor: '#2E1065',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 20,
    },
    handleBar: {
        width: 40,
        height: 4,
        backgroundColor: '#E9DDFD',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: spacing.md,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: '#E9DDFD',
    },
    headerRowRtl: {
        flexDirection: 'row-reverse',
    },
    title: {
        fontSize: fontSize.xl,
        fontWeight: '700',
        color: colors.text,
        flex: 1,
        paddingRight: spacing.md,
    },
    titleRtl: {
        textAlign: 'right',
        writingDirection: 'rtl',
        paddingRight: 0,
        paddingLeft: spacing.md,
    },
    closeButton: {
        padding: spacing.xs,
        backgroundColor: '#FFFFFF',
        borderRadius: borderRadius.full,
    },
    scrollContent: {
        padding: spacing.lg,
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.md,
    },
    sectionTitleRtl: {
        textAlign: 'right',
        writingDirection: 'rtl',
    },
    description: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        lineHeight: 24,
    },
    descriptionRtl: {
        textAlign: 'right',
        writingDirection: 'rtl',
    },
    readMoreText: {
        color: colors.primary,
        fontSize: fontSize.sm,
        fontWeight: '600',
        marginTop: spacing.xs,
    },
    readMoreTextRtl: {
        textAlign: 'right',
        writingDirection: 'rtl',
    },
    includedHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    includedHeaderRowRtl: {
        flexDirection: 'row-reverse',
    },
    includedCount: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
    },
    includedCountRtl: {
        textAlign: 'left',
    },
    includedItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: spacing.md,
    },
    includedItemRtl: {
        flexDirection: 'row-reverse',
    },
    includedItemDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.primary,
        marginTop: 8,
        marginRight: spacing.sm,
    },
    includedItemTextCol: {
        flex: 1,
    },
    includedItemTextColRtl: {
        alignItems: 'flex-end',
        marginRight: spacing.sm,
    },
    includedItemName: {
        fontSize: fontSize.md,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 2,
    },
    includedItemNameRtl: {
        textAlign: 'right',
    },
    includedItemDuration: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
    },
    includedItemDurationRtl: {
        textAlign: 'right',
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: '#E9DDFD',
        backgroundColor: '#F7F4FF',
    },
    footerRtl: {
        flexDirection: 'row-reverse',
    },
    priceCol: {
        flex: 1,
    },
    priceColRtl: {
        alignItems: 'flex-end',
    },
    priceLabel: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        marginBottom: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    priceValue: {
        fontSize: fontSize.xl,
        fontWeight: '800',
        color: colors.text,
    },
    actionButton: {
        backgroundColor: '#7C3AED',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        borderRadius: borderRadius.lg,
        minWidth: 140,
        alignItems: 'center',
    },
    actionButtonRemove: {
        backgroundColor: '#FEE2E2',
        borderWidth: 1,
        borderColor: '#F87171',
    },
    actionButtonText: {
        color: '#FFFFFF',
        fontSize: fontSize.md,
        fontWeight: '700',
    },
    actionButtonTextRemove: {
        color: '#DC2626',
    },
    variantsHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    variantsHeaderRowRtl: {
        flexDirection: 'row-reverse',
    },
    variantsCount: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
    },
    variantsCountRtl: {
        textAlign: 'left',
    },
    variantsList: {
        gap: spacing.sm,
    },
    variantCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: '#FFFFFF',
        borderRadius: borderRadius.lg,
        borderWidth: 1.5,
        borderColor: '#E9DDFD',
    },
    variantCardSelected: {
        borderColor: '#7C3AED',
        backgroundColor: '#F5F0FF',
    },
    variantCardRtl: {
        flexDirection: 'row-reverse',
    },
    variantRadio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#CBD5E1',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    variantRadioRtl: {
        marginRight: 0,
        marginLeft: spacing.md,
    },
    variantRadioSelected: {
        borderColor: '#7C3AED',
    },
    variantRadioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#7C3AED',
    },
    variantTextCol: {
        flex: 1,
    },
    variantTextColRtl: {
        alignItems: 'flex-end',
        marginRight: spacing.md,
    },
    variantNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        flexWrap: 'wrap',
    },
    variantNameRowRtl: {
        flexDirection: 'row-reverse',
    },
    variantName: {
        fontSize: fontSize.md,
        fontWeight: '600',
        color: colors.text,
    },
    variantNameSelected: {
        color: '#5B21B6',
        fontWeight: '700',
    },
    variantDuration: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        marginTop: 2,
    },
    variantPrice: {
        fontSize: fontSize.md,
        fontWeight: '700',
        color: colors.text,
    },
    variantPriceSelected: {
        color: '#7C3AED',
        fontWeight: '800',
    },
    inCartBadge: {
        backgroundColor: '#E0E7FF',
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
    },
    inCartBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#4338CA',
    },
    variantActionCol: {
        alignItems: 'flex-end',
        marginLeft: spacing.sm,
        gap: 6,
    },
    variantActionColRtl: {
        alignItems: 'flex-start',
        marginLeft: 0,
        marginRight: spacing.sm,
    },
    inlineAddBtn: {
        backgroundColor: '#7C3AED',
        paddingHorizontal: spacing.sm,
        paddingVertical: 5,
        borderRadius: borderRadius.md,
        minWidth: 54,
        alignItems: 'center',
        justifyContent: 'center',
    },
    inlineAddBtnRemove: {
        backgroundColor: '#FEE2E2',
        borderWidth: 1,
        borderColor: '#F87171',
    },
    inlineAddBtnText: {
        color: '#FFFFFF',
        fontSize: fontSize.xs,
        fontWeight: '700',
    },
    inlineAddBtnTextRemove: {
        color: '#DC2626',
    },
    textRtl: {
        textAlign: 'right',
    },
});
