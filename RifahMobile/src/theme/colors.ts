/**
 * BarSpa Customer App 2.0 — Centralized Design System Colors
 * 
 * Sourced directly from Stitch Customer 2.0 prototypes:
 * - brand.purple: #6537C0
 * - brand.deep:   #1D035F
 * - brand.soft:   #A379E2
 * - brand.lavender: #E7DDFC
 * - brand.bg:     #FAF9FC
 * - brand.surface: #FFFFFF
 * - brand.muted:  #716B88
 * - brand.border: #E7DDFC
 *
 * Fully backward-compatible with legacy aliases so existing screens continue working.
 */

const palette = {
    brand: {
        purple: '#6537C0', // Royal violet
        deep: '#1D035F',   // Midnight purple
        soft: '#A379E2',   // Medium accent purple
        lavender: '#E7DDFC', // Light lavender pill/border
        bg: '#FAF9FC',     // Lavender-tinted canvas
        surface: '#FFFFFF', // Pure white
        muted: '#716B88',  // Muted body text
        border: '#E7DDFC',
        borderLight: 'rgba(231, 221, 252, 0.4)',
        // Legacy numerical mappings
        300: '#E7DDFC',
        500: '#6537C0',
        600: '#1D035F',
    },
    pink: {
        500: '#EC4899',
        400: '#F472B6',
        600: '#DB2777',
    },
    green: {
        500: '#10B981',
        400: '#34D399',
        600: '#059669',
    },
    blue: {
        500: '#3B82F6',
        400: '#60A5FA',
        600: '#2563EB',
    },
    orange: {
        500: '#F59E0B',
        400: '#FBBF24',
        600: '#D97706',
    },
    red: {
        500: '#FF4D4F',
        400: '#F87171',
        600: '#DC2626',
    },
    slate: {
        900: '#1D035F',
        800: '#2D1470',
        500: '#716B88',
        400: '#9CA3AF',
        300: '#D1D5DB',
        200: '#E7DDFC',
        100: '#F4F3F6',
        50: '#FAF9FC',
    },
    white: '#FFFFFF',
    black: '#000000',
};

export const colors = {
    // Stitch 2.0 Brand Namespace
    brand: palette.brand,

    // Brand Core
    brandPrimary: palette.brand.purple,
    brandPrimaryLight: palette.brand.lavender,
    brandPrimaryDark: palette.brand.deep,
    brandPrimarySoft: palette.brand.soft,

    // Semantic Surface & Background
    background: palette.brand.bg,
    backgroundMuted: palette.brand.bg,
    surface: palette.brand.surface,
    surfaceAlt: palette.brand.bg,
    surfaceLavender: palette.brand.lavender,
    surfaceMuted: palette.slate[100],

    // Semantic Text
    textPrimary: palette.brand.deep,
    textSecondary: palette.brand.muted,
    textTertiary: palette.slate[400],
    textInverse: palette.white,

    // Semantic Border
    borderSubtle: palette.brand.border,
    borderStrong: '#D1C4E9',

    // Status
    success: palette.green[500],
    warning: palette.orange[500],
    error: palette.red[500],
    info: palette.blue[500],

    // Accent
    accent: palette.green[500],
    accentLight: palette.green[400],
    accentDark: palette.green[600],
    secondary: palette.pink[500],
    secondaryLight: palette.pink[400],
    secondaryDark: palette.pink[600],

    // Overlay
    overlay: 'rgba(29, 3, 95, 0.5)',
    overlayLight: 'rgba(29, 3, 95, 0.25)',

    // Compatibility aliases (legacy usage across screens)
    primary: palette.brand.purple,
    primaryLight: palette.brand.lavender,
    primaryDark: palette.brand.deep,
    backgroundGray: palette.brand.bg,
    text: palette.brand.deep,
    border: palette.brand.border,
    borderDark: '#D1C4E9',
};

export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    xxxl: 40,
};

export const borderRadius = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    full: 9999,
    pill: 9999,
};

export const fontSize = {
    xxs: 10,
    xs: 12,
    sm: 13,
    md: 15,
    base: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    huge: 40,
};

export const fontWeight = {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
};

export const shadows = {
    sm: {
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 2,
    },
    md: {
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 4,
    },
    lg: {
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 8,
    },
};

export const theme = {
    colors,
    spacing,
    borderRadius,
    fontSize,
    fontWeight,
    shadows,
};
