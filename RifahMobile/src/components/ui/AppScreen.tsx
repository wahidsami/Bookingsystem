import React from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    RefreshControl,
    ViewStyle,
    StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';

export interface AppScreenProps {
    children: React.ReactNode;
    scrollable?: boolean;
    refreshing?: boolean;
    onRefresh?: () => void;
    style?: ViewStyle;
    contentContainerStyle?: ViewStyle;
    backgroundColor?: string;
    edges?: ('top' | 'bottom' | 'left' | 'right')[];
    header?: React.ReactNode;
    footer?: React.ReactNode;
}

export function AppScreen({
    children,
    scrollable = true,
    refreshing = false,
    onRefresh,
    style,
    contentContainerStyle,
    backgroundColor = colors.background,
    edges = ['top', 'bottom'],
    header,
    footer,
}: AppScreenProps) {
    const insets = useSafeAreaInsets();
    const paddingTop = edges.includes('top') ? insets.top : 0;
    const paddingBottom = edges.includes('bottom') ? insets.bottom : 0;

    return (
        <View style={[styles.container, { backgroundColor, paddingTop }, style]}>
            <StatusBar barStyle="dark-content" backgroundColor={backgroundColor} />
            {header}
            {scrollable ? (
                <ScrollView
                    style={styles.flex}
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingBottom: paddingBottom + 16 },
                        contentContainerStyle,
                    ]}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        onRefresh ? (
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                tintColor={colors.brandPrimary}
                                colors={[colors.brandPrimary]}
                            />
                        ) : undefined
                    }
                >
                    {children}
                </ScrollView>
            ) : (
                <View style={[styles.flex, { paddingBottom }, contentContainerStyle]}>
                    {children}
                </View>
            )}
            {footer}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    flex: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
});
