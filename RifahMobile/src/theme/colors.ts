/**
 * Refah Mobile Single Source of Truth for App Colors.
 *
 * To rebrand or fine-tune visuals, start here first.
 * Keep compatibility aliases (`primary`, `text`, `border`...) so old screens
 * continue to work while we migrate to semantic tokens gradually.
 */
const palette = {
    brand: {
        300: '#A78BFA',
        500: '#8B5CF6',
        600: '#7C3AED',
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
    },
    orange: {
        500: '#F59E0B',
    },
    red: {
        500: '#EF4444',
    },
    slate: {
        900: '#1F2937',
        500: '#6B7280',
        400: '#9CA3AF',
        300: '#D1D5DB',
        200: '#E5E7EB',
        50: '#F9FAFB',
    },
    white: '#FFFFFF',
    black: '#000000',
};

export const colors = {
    // Brand
    brandPrimary: palette.brand[500],
    brandPrimaryLight: palette.brand[300],
    brandPrimaryDark: palette.brand[600],

    // Semantic surface/background
    background: palette.white,
    backgroundMuted: palette.slate[50],
    surface: palette.white,
    surfaceAlt: palette.slate[50],

    // Semantic text
    textPrimary: palette.slate[900],
    textSecondary: palette.slate[500],
    textTertiary: palette.slate[400],
    textInverse: palette.white,

    // Semantic border
    borderSubtle: palette.slate[200],
    borderStrong: palette.slate[300],

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
    overlay: 'rgba(0, 0, 0, 0.5)',
    overlayLight: 'rgba(0, 0, 0, 0.3)',

    // Compatibility aliases (legacy usage across screens)
    primary: palette.brand[500],
    primaryLight: palette.brand[300],
    primaryDark: palette.brand[600],
    backgroundGray: palette.slate[50],
    text: palette.slate[900],
    border: palette.slate[200],
    borderDark: palette.slate[300],
};

export const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40,
};

export const borderRadius = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
};

export const fontSize = {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    huge: 48,
};

export const fontWeight = {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
};

export const shadows = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 4,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
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
