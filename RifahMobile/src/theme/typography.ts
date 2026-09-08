export const typography = {
    // Semantic Targets
    hero: {
        fontSize: 32,
        lineHeight: 40,
        fontWeight: '700' as const,
    },
    pageTitle: {
        fontSize: 24,
        lineHeight: 32,
        fontWeight: '700' as const,
    },
    sectionTitle: {
        fontSize: 20,
        lineHeight: 28,
        fontWeight: '700' as const,
    },
    cardTitle: {
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '600' as const,
    },
    body: {
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '400' as const,
    },
    bodyStrong: {
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '600' as const,
    },
    secondary: {
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '400' as const,
    },
    caption: {
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '400' as const, // or 500
    },
    captionStrong: {
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '500' as const,
    },
    button: {
        fontSize: 15,
        lineHeight: 20,
        fontWeight: '600' as const,
    },
    tab: {
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '600' as const,
    },
    badge: {
        fontSize: 11,
        lineHeight: 14,
        fontWeight: '600' as const,
    },
    
    // Legacy generic aliases (do not remove)
    fontSize: {
        xs: 12,
        sm: 14,
        md: 16,
        lg: 18,
        xl: 20,
        xxl: 24,
        xxxl: 32,
        huge: 48,
    },
    fontWeight: {
        regular: '400' as const,
        medium: '500' as const,
        semibold: '600' as const,
        bold: '700' as const,
    }
};
