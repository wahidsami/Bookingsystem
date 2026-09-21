import React from 'react';
import {
    Modal,
    View,
    StyleSheet,
    TouchableOpacity,
    TouchableWithoutFeedback,
    ActivityIndicator,
} from 'react-native';
import { ThemedText as Text } from '../ThemedText';
import { AppIcon, AppIconProps } from '../AppIcon';
import { colors, spacing } from '../../theme';
import { useLanguage } from '../../contexts/LanguageContext';

export type DialogVariant = 'confirm' | 'destructive' | 'info' | 'success' | 'error' | 'warning';

export interface AppDialogProps {
    visible: boolean;
    title: string;
    message?: string;
    icon?: AppIconProps['name'];
    variant?: DialogVariant;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    showCancel?: boolean;
    loading?: boolean;
    isRTL?: boolean;
}

export function AppDialog({
    visible,
    title,
    message,
    icon,
    variant = 'confirm',
    confirmText,
    cancelText,
    onConfirm,
    onCancel,
    showCancel,
    loading = false,
    isRTL: explicitIsRTL,
}: AppDialogProps) {
    const { isRTL: contextIsRTL } = useLanguage();
    const isRTL = explicitIsRTL !== undefined ? explicitIsRTL : contextIsRTL;
    const isConfirmation = variant === 'confirm' || variant === 'destructive';
    const shouldShowCancel = showCancel !== undefined ? showCancel : isConfirmation;

    // Determine visual tokens based on variant
    const config = getVariantConfig(variant);
    const resolvedIcon = icon || config.icon;

    // Default button labels
    const defaultConfirmLabel = isRTL
        ? (variant === 'destructive' ? 'حذف' : (isConfirmation ? 'تأكيد' : 'حسنًا'))
        : (variant === 'destructive' ? 'Delete' : (isConfirmation ? 'Confirm' : 'OK'));

    const defaultCancelLabel = isRTL ? 'إلغاء' : 'Cancel';

    const finalConfirmText = confirmText || defaultConfirmLabel;
    const finalCancelText = cancelText || defaultCancelLabel;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={() => {
                if (!loading && onCancel) {
                    onCancel();
                }
            }}
        >
            <TouchableWithoutFeedback onPress={() => !loading && onCancel && onCancel()}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.dialogCard}>
                            {/* Icon Badge */}
                            <View style={[styles.iconCircle, { backgroundColor: config.badgeBg, borderColor: config.badgeBorder }]}>
                                <AppIcon name={resolvedIcon} size={26} color={config.iconColor} />
                            </View>

                            {/* Title */}
                            <Text style={[styles.title, isRTL && styles.cairoBold]}>
                                {title}
                            </Text>

                            {/* Message */}
                            {!!message && (
                                <Text style={[styles.message, isRTL && styles.cairoRegular]}>
                                    {message}
                                </Text>
                            )}

                            {/* Action Buttons */}
                            <View style={[styles.actionsRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                                {shouldShowCancel && (
                                    <TouchableOpacity
                                        style={styles.cancelButton}
                                        onPress={onCancel}
                                        disabled={loading}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[styles.cancelButtonText, isRTL && styles.cairoMedium]}>
                                            {finalCancelText}
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                <TouchableOpacity
                                    style={[
                                        styles.confirmButton,
                                        { backgroundColor: config.buttonBg },
                                        !shouldShowCancel && styles.fullWidthButton,
                                    ]}
                                    onPress={onConfirm}
                                    disabled={loading}
                                    activeOpacity={0.85}
                                >
                                    {loading ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <Text style={[styles.confirmButtonText, isRTL && styles.cairoBold]}>
                                            {finalConfirmText}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

function getVariantConfig(variant: DialogVariant): {
    icon: AppIconProps['name'];
    badgeBg: string;
    badgeBorder: string;
    iconColor: string;
    buttonBg: string;
} {
    switch (variant) {
        case 'destructive':
            return {
                icon: 'delete',
                badgeBg: '#FEF2F2',
                badgeBorder: '#FECACA',
                iconColor: '#DC2626',
                buttonBg: '#DC2626',
            };
        case 'error':
            return {
                icon: 'close',
                badgeBg: '#FEF2F2',
                badgeBorder: '#FECACA',
                iconColor: '#DC2626',
                buttonBg: '#DC2626',
            };
        case 'warning':
            return {
                icon: 'warning',
                badgeBg: '#FFFBEB',
                badgeBorder: '#FDE68A',
                iconColor: '#D97706',
                buttonBg: '#D97706',
            };
        case 'success':
            return {
                icon: 'check',
                badgeBg: '#ECFDF5',
                badgeBorder: '#A7F3D0',
                iconColor: '#059669',
                buttonBg: '#059669',
            };
        case 'info':
            return {
                icon: 'info',
                badgeBg: '#F5EEFF',
                badgeBorder: '#E9DDFD',
                iconColor: '#7C3AED',
                buttonBg: '#7C3AED',
            };
        case 'confirm':
        default:
            return {
                icon: 'alert_circle',
                badgeBg: '#F5EEFF',
                badgeBorder: '#E9DDFD',
                iconColor: '#7C3AED',
                buttonBg: '#7C3AED',
            };
    }
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(18, 13, 33, 0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
    },
    dialogCard: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.xl,
        paddingBottom: spacing.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E9DDFD',
        shadowColor: '#2E1065',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
        elevation: 8,
    },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1D035F',
        textAlign: 'center',
        marginBottom: 8,
    },
    message: {
        fontSize: 13,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 20,
        paddingHorizontal: spacing.xs,
    },
    actionsRow: {
        width: '100%',
        gap: 10,
        marginTop: 4,
    },
    cancelButton: {
        flex: 1,
        minHeight: 46,
        borderWidth: 1,
        borderColor: '#E9DDFD',
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.md,
    },
    cancelButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    confirmButton: {
        flex: 1,
        minHeight: 46,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.md,
    },
    fullWidthButton: {
        flex: 1,
        width: '100%',
    },
    confirmButtonText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    cairoBold: {
        fontFamily: 'Cairo-Bold',
    },
    cairoMedium: {
        fontFamily: 'Cairo-Medium',
    },
    cairoRegular: {
        fontFamily: 'Cairo-Regular',
    },
});
