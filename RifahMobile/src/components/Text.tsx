import React from 'react';
import { Text as RNText, TextProps, StyleSheet } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';

export function Text({ style, children, ...props }: TextProps) {
    const { language } = useLanguage();

    // Use Cairo font for Arabic
    const fontFamily = language === 'ar' ? 'Cairo-Regular' : undefined;

    return (
        <RNText style={[{ fontFamily }, style]} {...props}>
            {children}
        </RNText>
    );
}

// Bold text variant
export function TextBold({ style, children, ...props }: TextProps) {
    const { language } = useLanguage();
    const fontFamily = language === 'ar' ? 'Cairo-Bold' : undefined;

    return (
        <RNText style={[{ fontFamily, fontWeight: 'bold' }, style]} {...props}>
            {children}
        </RNText>
    );
}

// Medium weight variant
export function TextMedium({ style, children, ...props }: TextProps) {
    const { language } = useLanguage();
    const fontFamily = language === 'ar' ? 'Cairo-Medium' : undefined;

    return (
        <RNText style={[{ fontFamily, fontWeight: '600' }, style]} {...props}>
            {children}
        </RNText>
    );
}

// SemiBold variant
export function TextSemiBold({ style, children, ...props }: TextProps) {
    const { language } = useLanguage();
    const fontFamily = language === 'ar' ? 'Cairo-SemiBold' : undefined;

    return (
        <RNText style={[{ fontFamily, fontWeight: '700' }, style]} {...props}>
            {children}
        </RNText>
    );
}
