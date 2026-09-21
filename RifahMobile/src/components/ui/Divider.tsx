import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme';

export interface DividerProps {
    color?: string;
    thickness?: number;
    spacingVertical?: number;
    style?: ViewStyle;
}

export function Divider({
    color = colors.borderSubtle,
    thickness = 1,
    spacingVertical = 12,
    style,
}: DividerProps) {
    return (
        <View
            style={[
                styles.divider,
                {
                    backgroundColor: color,
                    height: thickness,
                    marginVertical: spacingVertical,
                },
                style,
            ]}
        />
    );
}

const styles = StyleSheet.create({
    divider: {
        width: '100%',
    },
});
