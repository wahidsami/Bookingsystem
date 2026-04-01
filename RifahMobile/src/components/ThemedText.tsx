import React from 'react';
import { StyleSheet, Text as RNText, TextProps, TextStyle } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * ThemedText component that automatically applies Cairo font for Arabic
 * and handles fontWeight properly by mapping to Cairo font variants
 */
export function ThemedText({ style, ...props }: TextProps) {
    const { language } = useLanguage();

    if (language !== 'ar') {
        // For English, use default system font
        return <RNText {...props} style={style} />;
    }

    // For Arabic, handle Cairo font with weight mapping
    const flatStyle = (StyleSheet.flatten(style) || {}) as TextStyle;

    // Map fontWeight to appropriate Cairo font variant
    let fontFamily = 'Cairo-Regular';
    const weight = flatStyle.fontWeight;

    if (weight === 'bold' || weight === '700' || weight === '800' || weight === '900') {
        fontFamily = 'Cairo-Bold';
    } else if (weight === '600') {
        fontFamily = 'Cairo-SemiBold';
    } else if (weight === '500') {
        fontFamily = 'Cairo-Medium';
    } else if (weight === '300' || weight === '200' || weight === '100') {
        fontFamily = 'Cairo-Light';
    }

    // Remove fontWeight from style to prevent conflicts
    const { fontWeight: _, ...styleWithoutWeight } = flatStyle;

    return (
        <RNText
            {...props}
            style={[styleWithoutWeight, { fontFamily }]}
        />
    );
}

/**
 * Bold variant of ThemedText - Explicitly uses bold font
 */
export function ThemedTextBold({ style, ...props }: TextProps) {
    const { language } = useLanguage();

    const fontFamily = language === 'ar' ? 'Cairo-Bold' : undefined;
    const fontWeight: any = language === 'en' ? 'bold' : undefined;

    return (
        <RNText
            {...props}
            style={[{ fontFamily, fontWeight }, style]}
        />
    );
}
