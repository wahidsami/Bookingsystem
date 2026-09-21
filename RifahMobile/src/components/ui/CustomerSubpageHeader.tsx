import React from 'react';
import { View, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ThemedText as Text } from '../ThemedText';
import { AppIcon } from '../AppIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import { useScreenSafeArea } from '../../utils/safeArea';

export interface CustomerSubpageHeaderProps {
    title: string;
    subtitle?: string;
    onBack?: () => void;
    showBack?: boolean;
    rightAction?: React.ReactNode;
    style?: ViewStyle;
}

export function CustomerSubpageHeader({
    title,
    subtitle,
    onBack,
    showBack = true,
    rightAction,
    style,
}: CustomerSubpageHeaderProps) {
    const { isRTL } = useLanguage();
    const { topInset } = useScreenSafeArea();
    const navigation = useNavigation<any>();

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else if (navigation?.canGoBack && navigation.canGoBack()) {
            navigation.goBack();
        }
    };

    return (
        <View style={[styles.container, { paddingTop: topInset }, style]}>
            <View style={[styles.headerBar, isRTL && styles.headerBarRTL]}>
                {/* Back Button: Left in LTR, Right in RTL */}
                <View style={[styles.sideContainer, isRTL ? styles.sideContainerRTL : styles.sideContainerLTR]}>
                    {showBack ? (
                        <TouchableOpacity
                            style={styles.circleBtn}
                            onPress={handleBack}
                            activeOpacity={0.7}
                            accessibilityLabel={isRTL ? 'رجوع' : 'Go back'}
                            accessibilityRole="button"
                        >
                            <AppIcon
                                name={isRTL ? 'arrow_forward' : 'arrow_back'}
                                size={22}
                                color="#1D035F"
                            />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.spacer} />
                    )}
                </View>

                {/* Center: Title & Optional Subtitle */}
                <View style={styles.centerContainer}>
                    <Text
                        style={[
                            styles.title,
                            isRTL ? styles.titleRTL : styles.titleLTR,
                        ]}
                        numberOfLines={1}
                    >
                        {title}
                    </Text>
                    {Boolean(subtitle) && (
                        <Text style={styles.subtitle} numberOfLines={1}>
                            {subtitle}
                        </Text>
                    )}
                </View>

                {/* Action or Spacer: Right in LTR, Left in RTL */}
                <View style={[styles.sideContainer, isRTL ? styles.sideContainerLTR : styles.sideRight]}>
                    {rightAction || <View style={styles.spacer} />}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E7DDFC',
        zIndex: 10,
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    headerBar: {
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    headerBarRTL: {
        flexDirection: 'row-reverse',
    },
    sideContainer: {
        width: 44,
        justifyContent: 'center',
    },
    sideContainerLTR: {
        alignItems: 'flex-start',
    },
    sideContainerRTL: {
        alignItems: 'flex-end',
    },
    sideRight: {
        alignItems: 'flex-end',
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
    centerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1D035F',
        textAlign: 'center',
    },
    titleRTL: {
        fontFamily: 'Cairo-Bold',
    },
    titleLTR: {
        fontWeight: '700',
    },
    subtitle: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 2,
        fontFamily: 'Cairo-Regular',
    },
    spacer: {
        width: 40,
        height: 40,
    },
});
