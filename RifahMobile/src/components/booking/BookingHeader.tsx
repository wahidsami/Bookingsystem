import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText as Text } from '../ThemedText';
import { AppIcon } from '../AppIcon';
import { useLanguage } from '../../contexts/LanguageContext';

export interface BookingHeaderProps {
    title: string;
    onBack: () => void;
    onClose?: () => void;
    showClose?: boolean;
}

export function BookingHeader({
    title,
    onBack,
    onClose,
    showClose = true,
}: BookingHeaderProps) {
    const { isRTL } = useLanguage();

    return (
        <View style={[styles.header, isRTL && styles.headerRTL]}>
            <TouchableOpacity
                style={styles.circleBtn}
                onPress={onBack}
                accessibilityLabel={isRTL ? 'رجوع' : 'Go back'}
                accessibilityRole="button"
            >
                <AppIcon
                    name={isRTL ? 'arrow_forward' : 'arrow_back'}
                    size={22}
                    color="#1D035F"
                />
            </TouchableOpacity>

            <Text style={styles.title} numberOfLines={1}>
                {title}
            </Text>

            {showClose && onClose ? (
                <TouchableOpacity
                    style={styles.circleBtn}
                    onPress={onClose}
                    accessibilityLabel={isRTL ? 'إغلاق' : 'Close'}
                    accessibilityRole="button"
                >
                    <AppIcon name="close" size={20} color="#1D035F" />
                </TouchableOpacity>
            ) : (
                <View style={styles.spacer} />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        height: 60,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(250, 249, 252, 0.95)',
        borderBottomWidth: 1,
        borderBottomColor: '#E7DDFC',
    },
    headerRTL: {
        flexDirection: 'row-reverse',
    },
    circleBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E7DDFC',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1D035F',
        textAlign: 'center',
        flex: 1,
        marginHorizontal: 12,
        fontFamily: 'Cairo-Bold',
    },
    spacer: {
        width: 40,
    },
});
