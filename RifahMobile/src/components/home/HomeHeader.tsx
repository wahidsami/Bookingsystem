import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ThemedText as Text } from '../ThemedText';
import { colors, spacing, fontSize } from '../../theme/colors';
import { useLanguage } from '../../contexts/LanguageContext';
import { api, User } from '../../api/client';
import { useAppSession } from '../../contexts/AppSessionContext';
import { useScreenSafeArea } from '../../utils/safeArea';
import { UserAvatar } from '../UserAvatar';

interface HomeHeaderProps {
    navigation: any;
}

export function HomeHeader({ navigation }: HomeHeaderProps) {
    const { t } = useLanguage();
    const { showLogin } = useAppSession();
    const { topInset } = useScreenSafeArea();
    const [user, setUser] = useState<User | null>(null);

    useFocusEffect(
        React.useCallback(() => {
            loadUser();
        }, [])
    );

    const loadUser = async () => {
        const userData = await api.getProfile().catch(() => api.getUser());
        setUser(userData);
    };

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
                <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Browse')}>
                    <Text style={styles.icon}>🔍</Text>
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
    },
    icon: {
        fontSize: 20,
    },
});
