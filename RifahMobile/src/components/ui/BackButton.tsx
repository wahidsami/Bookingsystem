import React from 'react';
import { TouchableOpacity, StyleSheet, TouchableOpacityProps } from 'react-native';
import { AppIcon } from '../AppIcon';
import { colors, layout, spacing } from '../../theme';
import { useLanguage } from '../../contexts/LanguageContext';

export interface BackButtonProps extends Omit<TouchableOpacityProps, 'children'> {
    variant?: 'solid' | 'transparent';
    size?: number;
}

export function BackButton({ 
    variant = 'transparent', 
    size = 40,
    style,
    ...props 
}: BackButtonProps) {
    const { isRTL } = useLanguage();
    
    // Auto-flip for RTL if needed, though AppIcon 'arrow-left' might handle it internally
    // but in case it doesn't, we can ensure the icon points right in RTL contexts for back navigation.
    const iconName = isRTL ? 'arrow_forward' : 'arrow_back'; 

    const isSolid = variant === 'solid';

    return (
        <TouchableOpacity
            style={[
                styles.button,
                { 
                    width: size, 
                    height: size, 
                    borderRadius: size / 2,
                    backgroundColor: isSolid ? colors.surface : 'transparent'
                },
                isSolid && layout.shadows.sm,
                style
            ]}
            activeOpacity={0.7}
            {...props}
        >
            <AppIcon 
                name={iconName} 
                size={24} 
                color={isSolid ? colors.textPrimary : colors.textPrimary} 
            />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        justifyContent: 'center',
        alignItems: 'center',
    }
});
