export const layout = {
    radius: {
        sm: 8,
        md: 12,
        lg: 16,
        xl: 24,
        full: 9999,
        pill: 9999,
    },
    shadows: {
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
    },
    components: {
        buttonHeight: 48,
        buttonCompactHeight: 36,
        inputHeight: 48,
        headerHeight: 56,
        tabHeight: 58,
        iconSize: 24,
        iconSmall: 16,
    }
};

// Legacy alias compatibility
export const borderRadius = layout.radius;
export const shadows = layout.shadows;
