import React, { useEffect, useRef } from 'react';
import {
    View,
    StyleSheet,
    Animated,
    TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText as Text } from '../ThemedText';
import { AppIcon, AppIconProps } from '../AppIcon';
import { spacing } from '../../theme';
import { useLanguage } from '../../contexts/LanguageContext';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface AppToastProps {
    visible: boolean;
    message: string;
    title?: string;
    type?: ToastType;
    duration?: number;
    onDismiss?: () => void;
    isRTL?: boolean;
    position?: 'top' | 'bottom';
}

export function AppToast({
    visible,
    message,
    title,
    type = 'info',
    duration = 3200,
    onDismiss,
    isRTL: explicitIsRTL,
    position = 'top',
}: AppToastProps) {
    const { isRTL: contextIsRTL } = useLanguage();
    const isRTL = explicitIsRTL !== undefined ? explicitIsRTL : contextIsRTL;
    const insets = useSafeAreaInsets();
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const translateYAnim = useRef(new Animated.Value(position === 'top' ? -30 : 30)).current;

    useEffect(() => {
        let timer: any;
        if (visible) {
            Animated.parallel([
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 220,
                    useNativeDriver: true,
                }),
                Animated.spring(translateYAnim, {
                    toValue: 0,
                    tension: 70,
                    friction: 9,
                    useNativeDriver: true,
                }),
            ]).start();

            timer = setTimeout(() => {
                handleDismiss();
            }, duration);
        } else {
            handleDismiss();
        }

        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [visible, duration]);

    const handleDismiss = () => {
        Animated.parallel([
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 180,
                useNativeDriver: true,
            }),
            Animated.timing(translateYAnim, {
                toValue: position === 'top' ? -20 : 20,
                duration: 180,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onDismiss && onDismiss();
        });
    };

    if (!visible) return null;

    const config = getToastConfig(type);

    const verticalStyle = position === 'top'
        ? { top: Math.max(insets.top + 10, 24) }
        : { bottom: Math.max(insets.bottom + 16, 28) };

    return (
        <Animated.View
            style={[
                styles.container,
                verticalStyle,
                {
                    opacity: opacityAnim,
                    transform: [{ translateY: translateYAnim }],
                },
            ]}
            pointerEvents="box-none"
        >
            <TouchableOpacity
                style={[
                    styles.toastCard,
                    { borderLeftColor: isRTL ? '#E9DDFD' : config.borderColor, borderRightColor: isRTL ? config.borderColor : '#E9DDFD' },
                    { flexDirection: isRTL ? 'row-reverse' : 'row' },
                ]}
                activeOpacity={0.9}
                onPress={handleDismiss}
            >
                <View style={[styles.iconBox, { backgroundColor: config.iconBg }]}>
                    <AppIcon name={config.icon} size={18} color={config.iconColor} />
                </View>

                <View style={styles.textContainer}>
                    {!!title && (
                        <Text style={[styles.title, isRTL && styles.cairoBold]}>
                            {title}
                        </Text>
                    )}
                    <Text style={[styles.message, isRTL && styles.cairoMedium]} numberOfLines={2}>
                        {message}
                    </Text>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
}

function getToastConfig(type: ToastType): {
    icon: AppIconProps['name'];
    iconColor: string;
    iconBg: string;
    borderColor: string;
} {
    switch (type) {
        case 'success':
            return {
                icon: 'check',
                iconColor: '#059669',
                iconBg: '#ECFDF5',
                borderColor: '#059669',
            };
        case 'error':
            return {
                icon: 'close',
                iconColor: '#DC2626',
                iconBg: '#FEF2F2',
                borderColor: '#DC2626',
            };
        case 'warning':
            return {
                icon: 'warning',
                iconColor: '#D97706',
                iconBg: '#FFFBEB',
                borderColor: '#D97706',
            };
        case 'info':
        default:
            return {
                icon: 'info',
                iconColor: '#7C3AED',
                iconBg: '#F5EEFF',
                borderColor: '#7C3AED',
            };
    }
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: spacing.lg,
        right: spacing.lg,
        zIndex: 99999,
        alignItems: 'center',
    },
    toastCard: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingHorizontal: spacing.md,
        paddingVertical: 12,
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: '#E9DDFD',
        borderLeftWidth: 4,
        borderRightWidth: 4,
        shadowColor: '#2E1065',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 10,
    },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textContainer: {
        flex: 1,
    },
    title: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1D035F',
        marginBottom: 2,
    },
    message: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1F2937',
        lineHeight: 17,
    },
    cairoBold: {
        fontFamily: 'Cairo-Bold',
    },
    cairoMedium: {
        fontFamily: 'Cairo-Medium',
    },
});
