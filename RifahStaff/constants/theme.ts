/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

export const BARSPA_COLORS = {
  royalPurple: '#6537C0',
  deepViolet: '#1D035F',
  lavender: '#A379E2',
  softLilac: '#E7DDFC',
  lilacSurface: '#F6F3FE',
  white: '#FFFFFF',
  cardBorder: '#E7DDFC',
  cardBg: '#FFFFFF',
  textPrimary: '#1D035F',
  textSecondary: '#4B5563',
  textMuted: '#9CA3AF',
  neutralBg: '#FAF8FC',
  neutralSurface: '#F3F4F6',
  // Operational status colors
  status: {
    confirmed: { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' },
    inService: { bg: '#F6F3FE', text: '#6537C0', border: '#E7DDFC' },
    completed: { bg: '#F3F4F6', text: '#4B5563', border: '#E5E7EB' },
    cancelled: { bg: '#FFF1F2', text: '#E11D48', border: '#FECDD3' },
    noShow: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
    pending: { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
  },
} as const;

export const Colors = {
  light: {
    text: '#1D035F',
    background: '#FAF8FC',
    tint: BARSPA_COLORS.royalPurple,
    icon: '#6537C0',
    tabIconDefault: '#9CA3AF',
    tabIconSelected: BARSPA_COLORS.royalPurple,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: BARSPA_COLORS.lavender,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: BARSPA_COLORS.lavender,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
