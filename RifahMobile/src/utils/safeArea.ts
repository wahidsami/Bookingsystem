import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useScreenSafeArea() {
    const insets = useSafeAreaInsets();

    return useMemo(() => ({
        topInset: insets.top,
        bottomInset: insets.bottom,
        scrollBottomPadding: Math.max(insets.bottom, 16) + 88,
    }), [insets.bottom, insets.top]);
}
