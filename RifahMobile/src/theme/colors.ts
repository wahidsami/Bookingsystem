/**
 * Refah Mobile Colors - BarSpa Identity
 */

const barSpa = {
    brandPurple: '#6537C0',
    deepPurple: '#1D035F',
    lightLavender: '#E7DDFC',
    softLavender: '#A379E2',
    white: '#FFFFFF',
    neutrals: {
        900: '#030303',
        800: '#353436',
        500: '#ADACAF',
        100: '#F9F5F0',
        50: '#FEFEFE',
    },
};

const legacyPalette = {
    pink: { 500: '#EC4899', 400: '#F472B6', 600: '#DB2777' },
    green: { 500: '#10B981', 400: '#34D399', 600: '#059669' },
    blue: { 500: '#3B82F6' },
    orange: { 500: '#F59E0B' },
    red: { 500: '#EF4444' },
    slate: {
        900: '#1F2937', 500: '#6B7280', 400: '#9CA3AF',
        300: '#D1D5DB', 200: '#E5E7EB', 50: '#F9FAFB',
    }
};

export const colors = {
    // BarSpa Primary Semantic
    brandPrimary: barSpa.brandPurple,
    brandPrimaryLight: barSpa.softLavender,
    brandPrimaryDark: barSpa.deepPurple,
    brandBackground: barSpa.lightLavender,

    // Semantic surface/background
    background: barSpa.white,
    backgroundMuted: barSpa.neutrals[100],
    surface: barSpa.white,
    surfaceAlt: barSpa.neutrals[50],

    // Semantic text
    textPrimary: barSpa.neutrals[900],
    textSecondary: barSpa.neutrals[800],
    textTertiary: barSpa.neutrals[500],
    textInverse: barSpa.white,

    // Semantic border
    borderSubtle: barSpa.neutrals[100], // For light borders
    borderStrong: barSpa.neutrals[500],

    // Status (retained for functionality)
    success: legacyPalette.green[500],
    warning: legacyPalette.orange[500],
    error: legacyPalette.red[500],
    info: legacyPalette.blue[500],

    // Accent (legacy overrides)
    accent: barSpa.brandPurple,
    accentLight: barSpa.softLavender,
    accentDark: barSpa.deepPurple,
    secondary: legacyPalette.pink[500],
    secondaryLight: legacyPalette.pink[400],
    secondaryDark: legacyPalette.pink[600],

    // Overlay
    overlay: 'rgba(3, 3, 3, 0.5)', // Using BarSpa neutral 900
    overlayLight: 'rgba(3, 3, 3, 0.3)',

    // LEGACY ALIASES (Do not remove, required for un-migrated screens)
    primary: barSpa.brandPurple,
    primaryLight: barSpa.softLavender,
    primaryDark: barSpa.deepPurple,
    backgroundGray: barSpa.neutrals[100],
    text: barSpa.neutrals[900],
    border: barSpa.neutrals[100],
    borderDark: barSpa.neutrals[500],
};

import { typography } from './typography';
import { spacing as spacingTokens } from './spacing';
import { borderRadius as radiusTokens, shadows as shadowsTokens } from './layout';

export const fontSize = typography.fontSize;
export const spacing = spacingTokens;
export const borderRadius = radiusTokens;
export const shadows = shadowsTokens;
