/**
 * BarSpa Customer App 2.0 — Centralized Layout Tokens
 * Extracted directly from Stitch Customer 2.0 prototypes.
 */

import { borderRadius as radiusTokens, shadows as shadowTokens } from './colors';

export const layout = {
    radius: radiusTokens,
    shadows: shadowTokens,
    components: {
        buttonHeight: 48,
        buttonCompactHeight: 36,
        buttonLargeHeight: 56,
        inputHeight: 50,
        headerHeight: 56,
        tabHeight: 58,
        iconSize: 24,
        iconSmall: 18,
        iconButtonSize: 40,
        iconButtonLargeSize: 44,
        avatarSm: 32,
        avatarMd: 44,
        avatarLg: 64,
        avatarXl: 72,
    },
    gutters: {
        screenMobile: 20,
        cardPadding: 16,
        cardCompactPadding: 12,
        sectionGap: 24,
    }
};

// Legacy aliases
export const borderRadius = layout.radius;
export const shadows = layout.shadows;
