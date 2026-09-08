import { colors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';
import { layout, borderRadius, shadows } from './layout';

export const theme = {
    colors,
    typography,
    spacing,
    layout,
    
    // Legacy mapping to avoid breaking unchanged screens
    fontSize: typography.fontSize,
    fontWeight: typography.fontWeight,
    borderRadius,
    shadows,
};

// Re-export for direct usage
export { colors, typography, spacing, layout, borderRadius, shadows };
