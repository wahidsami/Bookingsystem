/**
 * BarSpa Customer App 2.0 — Centralized Typography
 * Designed with Arabic-first priority utilizing Cairo font family.
 */

export const fontFamilies = {
    regular: 'Cairo-Regular',
    light: 'Cairo-Light',
    medium: 'Cairo-Medium',
    semibold: 'Cairo-SemiBold',
    bold: 'Cairo-Bold',
};

export const typography = {
    fontFamilies,

    // Semantic Targets
    hero: {
        fontFamily: fontFamilies.bold,
        fontSize: 32,
        lineHeight: 40,
        fontWeight: '700' as const,
    },
    display: {
        fontFamily: fontFamilies.bold,
        fontSize: 28,
        lineHeight: 36,
        fontWeight: '700' as const,
    },
    pageTitle: {
        fontFamily: fontFamilies.bold,
        fontSize: 22,
        lineHeight: 30,
        fontWeight: '700' as const,
    },
    sectionTitle: {
        fontFamily: fontFamilies.bold,
        fontSize: 18,
        lineHeight: 26,
        fontWeight: '700' as const,
    },
    cardTitle: {
        fontFamily: fontFamilies.semibold,
        fontSize: 16,
        lineHeight: 22,
        fontWeight: '600' as const,
    },
    cardSubtitle: {
        fontFamily: fontFamilies.regular,
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '400' as const,
    },
    body: {
        fontFamily: fontFamilies.regular,
        fontSize: 15,
        lineHeight: 22,
        fontWeight: '400' as const,
    },
    bodyStrong: {
        fontFamily: fontFamilies.semibold,
        fontSize: 15,
        lineHeight: 22,
        fontWeight: '600' as const,
    },
    secondary: {
        fontFamily: fontFamilies.regular,
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '400' as const,
    },
    caption: {
        fontFamily: fontFamilies.regular,
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '400' as const,
    },
    captionStrong: {
        fontFamily: fontFamilies.medium,
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '500' as const,
    },
    button: {
        fontFamily: fontFamilies.semibold,
        fontSize: 15,
        lineHeight: 20,
        fontWeight: '600' as const,
    },
    buttonCompact: {
        fontFamily: fontFamilies.semibold,
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '600' as const,
    },
    tab: {
        fontFamily: fontFamilies.semibold,
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '600' as const,
    },
    badge: {
        fontFamily: fontFamilies.bold,
        fontSize: 11,
        lineHeight: 14,
        fontWeight: '700' as const,
    },
    price: {
        fontFamily: fontFamilies.bold,
        fontSize: 16,
        lineHeight: 22,
        fontWeight: '700' as const,
    },
    currency: {
        fontFamily: fontFamilies.medium,
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '500' as const,
    },
    
    // Legacy generic aliases
    fontSize: {
        xxs: 10,
        xs: 12,
        sm: 14,
        md: 16,
        lg: 18,
        xl: 20,
        xxl: 24,
        xxxl: 32,
        huge: 40,
    },
    fontWeight: {
        regular: '400' as const,
        medium: '500' as const,
        semibold: '600' as const,
        bold: '700' as const,
    }
};
