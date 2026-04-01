/**
 * Centralized Theme & Color System for Refah Mobile
 * Change colors here and they'll reflect everywhere!
 */

export const colors = {
    // Primary Colors
    primary: '#8B5CF6',        // Refah Purple
    primaryLight: '#A78BFA',   // Light Purple
    primaryDark: '#7C3AED',    // Dark Purple

    // Secondary Colors
    secondary: '#EC4899',      // Pink
    secondaryLight: '#F472B6', // Light Pink
    secondaryDark: '#DB2777',  // Dark Pink

    // Accent Colors
    accent: '#10B981',         // Green (for success)
    accentLight: '#34D399',    // Light Green
    accentDark: '#059669',     // Dark Green

    // Neutral Colors
    background: '#FFFFFF',     // White background
    backgroundGray: '#F9FAFB', // Light gray bg
    surface: '#FFFFFF',        // Card/surface white

    // Text Colors
    text: '#1F2937',          // Primary text (dark gray)
    textSecondary: '#6B7280',  // Secondary text (medium gray)
    textTertiary: '#9CA3AF',   // Tertiary text (light gray)
    textInverse: '#FFFFFF',    // White text (on dark bg)

    // Border Colors
    border: '#E5E7EB',        // Light border
    borderDark: '#D1D5DB',    // Medium border

    // Status Colors
    success: '#10B981',       // Green
    warning: '#F59E0B',       // Orange
    error: '#EF4444',         // Red
    info: '#3B82F6',          // Blue

    // Overlay
    overlay: 'rgba(0, 0, 0, 0.5)',
    overlayLight: 'rgba(0, 0, 0, 0.3)',
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
