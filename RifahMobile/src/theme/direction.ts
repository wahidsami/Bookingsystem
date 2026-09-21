/**
 * BarSpa Customer App 2.0 — Direction & RTL/LTR Layout Helpers
 * Ensures seamless Arabic-first bidirectional support without breaking existing components.
 */

import { I18nManager, TextStyle, ViewStyle } from 'react-native';

export interface DirectionalStyleProps {
    isRTL: boolean;
}

/**
 * Returns 'right' in RTL and 'left' in LTR (or custom alignment).
 */
export function getTextAlign(isRTL: boolean, align: 'start' | 'end' | 'center' = 'start'): TextStyle['textAlign'] {
    if (align === 'center') return 'center';
    if (align === 'start') return isRTL ? 'right' : 'left';
    return isRTL ? 'left' : 'right';
}

/**
 * Returns flex row direction respecting RTL.
 */
export function getFlexDirection(isRTL: boolean, reverse: boolean = false): ViewStyle['flexDirection'] {
    if (reverse) {
        return isRTL ? 'row' : 'row-reverse';
    }
    return isRTL ? 'row-reverse' : 'row';
}

/**
 * Returns horizontal padding with start/end mapping.
 */
export function getDirectionalPadding(isRTL: boolean, start: number, end: number): ViewStyle {
    return {
        paddingLeft: isRTL ? end : start,
        paddingRight: isRTL ? start : end,
    };
}

/**
 * Returns horizontal margin with start/end mapping.
 */
export function getDirectionalMargin(isRTL: boolean, start: number, end: number): ViewStyle {
    return {
        marginLeft: isRTL ? end : start,
        marginRight: isRTL ? start : end,
    };
}

/**
 * Resolves chevron name for reading direction.
 * 'forward' points to the next screen (Right in LTR, Left in RTL).
 * 'back' points to the previous screen (Left in LTR, Right in RTL).
 */
export function getChevronName(isRTL: boolean, direction: 'forward' | 'back' = 'forward'): 'chevron-right' | 'chevron-left' {
    if (direction === 'forward') {
        return isRTL ? 'chevron-left' : 'chevron-right';
    }
    return isRTL ? 'chevron-right' : 'chevron-left';
}

/**
 * Returns transform to flip icons horizontally in RTL mode.
 */
export function getRtlFlipTransform(isRTL: boolean): ViewStyle {
    return isRTL ? { transform: [{ scaleX: -1 }] } : {};
}

/**
 * Quick inline row helper: returns { flexDirection: 'row-reverse' } if isRTL, else { flexDirection: 'row' }
 */
export function rtlRow(isRTL: boolean): ViewStyle {
    return { flexDirection: isRTL ? 'row-reverse' : 'row' };
}

/**
 * Quick inline text align helper: returns 'right' if isRTL, else 'left'
 */
export function rtlTextAlign(isRTL: boolean): TextStyle['textAlign'] {
    return isRTL ? 'right' : 'left';
}

/**
 * Returns margin applied to the visual start (left in LTR, right in RTL)
 */
export function rtlMarginStart(isRTL: boolean, margin: number): ViewStyle {
    return isRTL ? { marginRight: margin } : { marginLeft: margin };
}

/**
 * Returns margin applied to the visual end (right in LTR, left in RTL)
 */
export function rtlMarginEnd(isRTL: boolean, margin: number): ViewStyle {
    return isRTL ? { marginLeft: margin } : { marginRight: margin };
}

/**
 * Resolves arrow-back icon (e.g. Feather / MaterialCommunityIcons / Ionicons)
 */
export function getArrowBackName(isRTL: boolean): 'arrow-left' | 'arrow-right' {
    return isRTL ? 'arrow-right' : 'arrow-left';
}

/**
 * Standard reusable RTL style presets for components.
 */
export const rtlStyles = {
    rowRTL: {
        flexDirection: 'row-reverse' as const,
    },
    alignRTL: {
        alignItems: 'flex-end' as const,
    },
    textRTL: {
        textAlign: 'right' as const,
        writingDirection: 'rtl' as const,
    },
};
