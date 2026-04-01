import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { ThemedText as Text } from '../ThemedText';
import { colors, spacing, fontSize } from '../../theme/colors';
import { useLanguage } from '../../contexts/LanguageContext';
import { api, User, getImageUrl } from '../../api/client';

interface HomeHeaderProps {
    navigation: any;
}

export function HomeHeader({ navigation }: HomeHeaderProps) {
    const { t } = useLanguage();
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        loadUser();
    }, []);

    const loadUser = async () => {
        const userData = await api.getUser();
        setUser(userData);
    };

    const avatarUri = user?.profileImage ? getImageUrl(user.profileImage) : undefined;
    const initials = user?.firstName?.charAt(0)?.toUpperCase() || 'U';
    const displayName = user ? `${user.firstName} ${user.lastName}` : 'Guest';

    return (
        <View style={styles.container}>
            {/* Left: Avatar */}
            <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.avatarTouchable}>
                {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatar} />
                ) : (
                    <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                )}
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
                <TouchableOpacity style={styles.iconButton} onPress={() => console.log('Notifications')}>
                    <Text style={styles.icon}>🔔</Text>
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
        paddingTop: spacing.xl + 20,
        paddingBottom: spacing.md,
        backgroundColor: colors.background,
    },
    avatarTouchable: {
        marginRight: spacing.md,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    avatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: '#FFF',
        fontSize: fontSize.lg,
        fontWeight: '700',
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
