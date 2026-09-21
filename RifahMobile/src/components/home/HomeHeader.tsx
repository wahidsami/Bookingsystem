import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { ThemedText as Text } from '../ThemedText';
import { colors, spacing, fontSize } from '../../theme/colors';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAppSession } from '../../contexts/AppSessionContext';
import { useScreenSafeArea } from '../../utils/safeArea';
import { UserAvatar } from '../UserAvatar';
import { AppIcon } from '../AppIcon';
import { api } from '../../api/client';

interface HomeHeaderProps {
    navigation: any;
}

export function HomeHeader({ navigation }: HomeHeaderProps) {
    const { t, isRTL } = useLanguage();
    const { isAuthenticated, showLogin, user } = useAppSession();
    const { topInset } = useScreenSafeArea();
    const [unreadCount, setUnreadCount] = useState(0);

    const loadUnreadCount = useCallback(async () => {
        if (!isAuthenticated) {
            setUnreadCount(0);
            return;
        }

        try {
            const response = await api.getNotifications(1, 1);
            setUnreadCount(response.unreadCount || 0);
        } catch (error) {
            console.warn('Failed to load notification count:', error);
            setUnreadCount(0);
        }
    }, [isAuthenticated]);

    useFocusEffect(
        useCallback(() => {
            loadUnreadCount();
        }, [loadUnreadCount])
    );

    useEffect(() => {
        const subscription = Notifications.addNotificationReceivedListener(() => {
            loadUnreadCount();
        });

        return () => {
            subscription.remove();
        };
    }, [loadUnreadCount]);

    const displayName = user ? `${user.firstName} ${user.lastName}` : (isRTL ? 'زائر' : 'Guest');

    return (
        <View style={[styles.container, isRTL && styles.containerRTL, { paddingTop: spacing.md + topInset }]}>
            {/* Left/Right based on RTL: Avatar with Stitch ring */}
            <TouchableOpacity
                onPress={() => {
                    if (!isAuthenticated) {
                        showLogin();
                        return;
                    }

                    navigation.navigate('Profile');
                }}
                style={[styles.avatarTouchable, isRTL && styles.avatarTouchableRTL]}
                activeOpacity={0.8}
            >
                <View style={styles.avatarRing}>
                    <UserAvatar
                        firstName={user?.firstName}
                        lastName={user?.lastName}
                        profileImage={user?.profileImage}
                        size={40}
                    />
                </View>
            </TouchableOpacity>

            {/* Center: Welcome text */}
            <View style={[styles.textContainer, isRTL && styles.textContainerRTL]}>
                <Text style={styles.welcomeLabel}>{t('welcome')}</Text>
                <Text style={styles.userName} numberOfLines={1}>{displayName}</Text>
            </View>

            {/* Actions (Notification & Search) */}
            <View style={[styles.iconsRow, isRTL && styles.iconsRowRTL]}>
                <TouchableOpacity
                    style={styles.iconButton}
                    activeOpacity={0.7}
                    onPress={() => {
                        if (!isAuthenticated) {
                            showLogin();
                            return;
                        }

                        navigation.navigate('Notifications');
                    }}
                >
                    <AppIcon name="bell" size={19} color="#1D035F" />
                    {unreadCount > 0 ? (
                        <View style={[styles.badge, isRTL && styles.badgeRTL]}>
                            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                        </View>
                    ) : null}
                </TouchableOpacity>
                <TouchableOpacity 
                    style={styles.iconButton} 
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('Search')}
                >
                    <AppIcon name="search" size={19} color="#1D035F" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.sm,
        backgroundColor: '#FAF9FC',
    },
    containerRTL: {
        flexDirection: 'row-reverse',
    },
    avatarTouchable: {
        marginRight: spacing.sm,
    },
    avatarTouchableRTL: {
        marginRight: 0,
        marginLeft: spacing.sm,
    },
    avatarRing: {
        padding: 2,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: 'rgba(101, 55, 192, 0.25)',
        backgroundColor: '#FFFFFF',
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    textContainerRTL: {
        alignItems: 'flex-end',
    },
    welcomeLabel: {
        fontSize: 13,
        color: 'rgba(29, 3, 95, 0.65)',
        lineHeight: 16,
    },
    userName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1D035F',
        letterSpacing: -0.2,
    },
    iconsRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    iconsRowRTL: {
        flexDirection: 'row-reverse',
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(231, 221, 252, 0.6)',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    badge: {
        position: 'absolute',
        top: -3,
        right: -3,
        minWidth: 17,
        height: 17,
        borderRadius: 8.5,
        backgroundColor: '#FF4D4F',
        paddingHorizontal: 3,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FAF9FC',
    },
    badgeRTL: {
        right: undefined,
        left: -3,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700',
        lineHeight: 12,
    },
});
