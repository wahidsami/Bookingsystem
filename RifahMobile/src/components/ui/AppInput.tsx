import React, { useState } from 'react';
import { View, TextInput, StyleSheet, TextInputProps, TouchableOpacity } from 'react-native';
import { ThemedText } from '../ThemedText';
import { AppIcon } from '../AppIcon';
import { colors, layout, spacing, typography } from '../../theme';
import { useLanguage } from '../../contexts/LanguageContext';

export interface AppInputProps extends TextInputProps {
    label?: string;
    error?: string;
    icon?: React.ComponentProps<typeof AppIcon>['name'];
    onIconPress?: () => void;
    disabled?: boolean;
}

export function AppInput({
    label,
    error,
    icon,
    onIconPress,
    style,
    disabled,
    ...props
}: AppInputProps) {
    const { isRTL } = useLanguage();
    const [isFocused, setIsFocused] = useState(false);

    const hasError = !!error;
    const isDisabled = !!disabled;

    return (
        <View style={styles.container}>
            {label && (
                <ThemedText style={[typography.captionStrong, styles.label, isRTL && styles.textRTL]}>
                    {label}
                </ThemedText>
            )}
            
            <View style={[
                styles.inputContainer,
                isRTL && styles.containerRTL,
                isFocused && styles.inputFocused,
                hasError && styles.inputError,
                isDisabled && styles.inputDisabled,
            ]}>
                <TextInput
                    style={[
                        styles.input,
                        typography.body,
                        isRTL && styles.inputRTL,
                        style
                    ]}
                    placeholderTextColor={colors.textTertiary}
                    onFocus={(e) => {
                        setIsFocused(true);
                        props.onFocus?.(e);
                    }}
                    onBlur={(e) => {
                        setIsFocused(false);
                        props.onBlur?.(e);
                    }}
                    editable={!isDisabled}
                    textAlign={isRTL ? 'right' : 'left'}
                    {...props}
                />
                
                {icon && (
                    <TouchableOpacity 
                        onPress={onIconPress} 
                        disabled={!onIconPress || isDisabled}
                        style={styles.iconContainer}
                    >
                        <AppIcon 
                            name={icon} 
                            size={layout.components.iconSmall} 
                            color={hasError ? colors.error : isFocused ? colors.brandPrimary : colors.textTertiary} 
                        />
                    </TouchableOpacity>
                )}
            </View>

            {hasError && (
                <ThemedText style={[typography.caption, styles.errorText, isRTL && styles.textRTL]}>
                    {error}
                </ThemedText>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginBottom: spacing.md,
    },
    label: {
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        height: layout.components.inputHeight,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        borderRadius: layout.radius.md,
        backgroundColor: colors.surface,
        overflow: 'hidden',
    },
    inputFocused: {
        borderColor: colors.brandPrimary,
    },
    inputError: {
        borderColor: colors.error,
    },
    inputDisabled: {
        backgroundColor: colors.backgroundMuted,
        borderColor: colors.borderSubtle,
    },
    input: {
        flex: 1,
        height: '100%',
        paddingHorizontal: spacing.md,
        color: colors.textPrimary,
    },
    inputRTL: {
        textAlign: 'right',
        writingDirection: 'rtl',
    },
    containerRTL: {
        flexDirection: 'row-reverse',
    },
    textRTL: {
        textAlign: 'right',
        writingDirection: 'rtl',
    },
    iconContainer: {
        paddingHorizontal: spacing.md,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        color: colors.error,
        marginTop: spacing.xs,
    }
});
