import React from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';
import { ThemedText } from '../ThemedText';
import { colors, layout, typography } from '../../theme';

export interface AvatarProps {
    uri?: string | null;
    name?: string;
    size?: number;
    ringColor?: string;
    style?: ViewStyle;
}

export function Avatar({
    uri,
    name = '',
    size = layout.components.avatarMd,
    ringColor = colors.brand.border,
    style,
}: AvatarProps) {
    const initial = (name.trim().charAt(0) || '?').toUpperCase();
    const borderRadius = size / 2;

    return (
        <View
            style={[
                styles.container,
                {
                    width: size,
                    height: size,
                    borderRadius,
                    borderColor: ringColor,
                },
                style,
            ]}
        >
            {uri ? (
                <Image
                    source={{ uri }}
                    style={[styles.image, { borderRadius }]}
                    resizeMode="cover"
                />
            ) : (
                <View style={[styles.placeholder, { borderRadius }]}>
                    <ThemedText
                        style={[
                            styles.initial,
                            {
                                fontSize: Math.round(size * 0.42),
                                lineHeight: Math.round(size * 0.52),
                            },
                        ]}
                    >
                        {initial}
                    </ThemedText>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderWidth: 2,
        padding: 1.5,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    placeholder: {
        width: '100%',
        height: '100%',
        backgroundColor: colors.surfaceLavender,
        alignItems: 'center',
        justifyContent: 'center',
    },
    initial: {
        ...typography.cardTitle,
        color: colors.brandPrimary,
        fontWeight: '700',
        textAlign: 'center',
    },
});
