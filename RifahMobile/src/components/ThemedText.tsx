import React from 'react';
import { StyleSheet, Text as RNText, TextProps, TextStyle } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * ThemedText component that automatically applies Cairo font for Arabic
 * and handles fontWeight properly by mapping to Cairo font variants
 */
export function ThemedText({ style, ...props }: TextProps) {
    const { language } = useLanguage();
    const flatStyle = (StyleSheet.flatten(style) || {}) as TextStyle;

    // Preserve caller's custom fontFamily if provided (e.g. 'SaudiRiyalSymbol' or 'Cairo-Bold')
    let fontFamily = flatStyle.fontFamily;
    if (!fontFamily) {
        fontFamily = 'Cairo-Regular';
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
    }

    const { fontWeight: _, ...styleWithoutWeight } = flatStyle;

    if (language === 'ar') {
        const textAlign = flatStyle.textAlign || 'right';
        return (
            <RNText
                {...props}
                style={[{ writingDirection: 'rtl' }, styleWithoutWeight, { fontFamily, textAlign }]}
            />
        );
    }

    const textAlign = flatStyle.textAlign || 'left';
    return (
        <RNText
            {...props}
            style={[{ writingDirection: 'ltr' }, styleWithoutWeight, { fontFamily, textAlign }]}
        />
    );
}

/**
 * Bold variant of ThemedText - Explicitly uses bold font
 */
export function ThemedTextBold({ style, ...props }: TextProps) {
    const { language } = useLanguage();
    const flatStyle = (StyleSheet.flatten(style) || {}) as TextStyle;

    const fontFamily = flatStyle.fontFamily || 'Cairo-Bold';
    const writingDirection = language === 'ar' ? 'rtl' : 'ltr';
    const textAlign = language === 'ar' ? (flatStyle.textAlign || 'right') : (flatStyle.textAlign || 'left');
    const { fontWeight: _, ...styleWithoutWeight } = flatStyle;

    return (
        <RNText
            {...props}
            style={[styleWithoutWeight, { fontFamily, writingDirection, textAlign }]}
        />
    );
}
