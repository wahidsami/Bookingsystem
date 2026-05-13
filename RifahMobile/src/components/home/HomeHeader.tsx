import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { ThemedText as Text } from '../ThemedText';
import { colors, spacing, fontSize } from '../../theme/colors';
import { useLanguage } from '../../contexts/LanguageContext';
import { api, User } from '../../api/client';
import { useAppSession } from '../../contexts/AppSessionContext';
import { useScreenSafeArea } from '../../utils/safeArea';
import { UserAvatar } from '../UserAvatar';
import { AppIcon } from '../AppIcon';

interface HomeHeaderProps {
    navigation: any;
}

export function HomeHeader({ navigation }: HomeHeaderProps) {
    const { t } = useLanguage();
    const { showLogin, isAuthenticated } = useAppSession();
    const { topInset } = useScreenSafeArea();
    const [user, setUser] = useState<User | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);

    const loadUser = useCallback(async () => {
        const userData = await api.getProfile().catch(() => api.getUser());
        setUser(userData);
    }, []);

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
            loadUser();
            loadUnreadCount();
        }, [loadUnreadCount, loadUser])
    );

    useEffect(() => {
        const subscription = Notifications.addNotificationReceivedListener(() => {
            loadUnreadCount();
        });

        return () => {
            subscription.remove();
        };
    }, [loadUnreadCount]);

    const displayName = user ? `${user.firstName} ${user.lastName}` : 'Guest';

    return (
        <View style={[styles.container, { paddingTop: spacing.xl + topInset }]}>
            {/* Left: Avatar */}
            <TouchableOpacity
                onPress={() => (user ? navigation.navigate('Profile') : showLogin())}
                style={styles.avatarTouchable}
            >
                <UserAvatar
                    firstName={user?.firstName}
                    lastName={user?.lastName}
                    profileImage={user?.profileImage}
                    size={48}
                />
            </TouchableOpacity>

            {/* Center: Welcome text */}
            <View style={styles.textContainer}>
                <Text style={styles.welcomeLabel}>{t('welcome')}</Text>
                <Text style={styles.userName} numberOfLines={1}>{displayName}</Text>
            </View>

            {/* Right: Icons */}
            <View style={styles.iconsRow}>
                <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => (isAuthenticated ? navigation.navigate('Notifications') : showLogin())}
                >
                    <AppIcon name="bell" size={20} color={colors.primary} />
                    {unreadCount > 0 ? (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                        </View>
                    ) : null}
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Browse')}>
                    <AppIcon name="search" size={20} color={colors.primary} />
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
        paddingBottom: spacing.md,
        backgroundColor: colors.background,
    },
    avatarTouchable: {
        marginRight: spacing.md,
    },
    textContainer: {
        flex: 1,
    },
    welcomeLabel: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
    },
    userName: {
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.text,
    },
    iconsRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.backgroundGray,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    badge: {
        position: 'absolute',
        top: -2,
        right: -2,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: colors.error,
        paddingHorizontal: 4,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: colors.background,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700',
        lineHeight: 12,
    },
});
