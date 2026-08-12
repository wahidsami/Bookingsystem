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
    variant?: any | null; // using any to avoid import issues if ServiceVariant is not exported here, wait I can import ServiceVariant from client.ts
    tenant: Tenant | null;
    tenantId?: string;
}

export function ServiceDetailsDrawer({ visible, onClose, service, variant, tenant, tenantId }: ServiceDetailsDrawerProps) {
    const { isRTL } = useLanguage();
    const { bottomInset } = useScreenSafeArea();
    const { items, addItem, removeItem } = useServiceBookingCart();
    const [expandedDescription, setExpandedDescription] = useState(false);

    if (!service) return null;

    const serviceName = isRTL 
        ? (variant ? `${service.name_ar} — ${variant.description}` : service.name_ar)
        : (variant ? `${service.name_en} — ${variant.description}` : service.name_en);
    const description = (isRTL ? service.description_ar : service.description_en)
        || service.description_en
        || service.description_ar
        || '';
        
    const effectivePrice = getServicePrice(service, variant);
    
    // Check included services - handle variations in API data structure
    const includedServices = (service as any).includedServices || (service.variants && (service.variants[0] as any)?.includedServices) || [];

    const existingCartItem = items.find(item => item.service.id === service.id && (variant ? item.variant?.id === variant.id : !item.variant));
    const isInCart = !!existingCartItem;

    const handleToggleCart = () => {
        if (isInCart && existingCartItem) {
            removeItem(existingCartItem.id);
        } else {
            const result = addItem({
                id: Math.random().toString(36).substring(7),
                tenantId: tenant?.id || tenantId || '',
                tenant: tenant ? { id: tenant.id, name: tenant.name, name_en: tenant.name_en, name_ar: tenant.name_ar, slug: tenant.slug, logo: tenant.logo } : undefined,
                service: service,
                variant: variant || null,
                staff: null,
                requestedStaffId: null,
                staffId: null,
                startTime: '',
                paymentMethod: 'at-center',
                totalPrice: effectivePrice,
                payableNowAmount: 0
            });
            
            if (!result.success && result.reason === 'different_tenant') {
                Alert.alert(
                    isRTL ? 'تنبيه' : 'Cannot Add Service',
                    isRTL ? 'لا يمكنك إضافة خدمات من مراكز مختلفة في نفس الحجز. يرجى إفراغ السلة أولاً.' : 'You cannot add services from different centers to the same booking. Please clear your basket first.'
                );
            } else {
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
                            onPress={handleToggleCart}
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
        backgroundColor: colors.background,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        paddingTop: spacing.md,
        maxHeight: SCREEN_HEIGHT * 0.85,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 20,
    },
    handleBar: {
        width: 40,
        height: 4,
        backgroundColor: colors.border,
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
        borderBottomColor: colors.border,
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
        paddingRight: 0,
        paddingLeft: spacing.md,
    },
    closeButton: {
        padding: spacing.xs,
        backgroundColor: colors.surface,
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
    },
    description: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        lineHeight: 24,
    },
    descriptionRtl: {
        textAlign: 'right',
    },
    readMoreText: {
        color: colors.primary,
        fontSize: fontSize.sm,
        fontWeight: '600',
        marginTop: spacing.xs,
    },
    readMoreTextRtl: {
        textAlign: 'right',
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
        borderTopColor: colors.border,
        backgroundColor: colors.background,
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
        backgroundColor: colors.primary,
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
});
