import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from './colors';
import { typography, fontFamilies } from './typography';
import { layout } from './layout';
import * as direction from './direction';

export const theme = {
    colors,
    typography,
    fontFamilies,
    spacing,
    layout,
    borderRadius,
    shadows,
    direction,
    
    // Legacy mapping
    fontSize: typography.fontSize,
    fontWeight: typography.fontWeight,
};

// Re-export for direct usage
export { colors, typography, fontFamilies, spacing, layout, borderRadius, shadows, direction };
