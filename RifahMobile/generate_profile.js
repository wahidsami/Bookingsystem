const fs = require('fs');

const content = `import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ThemedText as Text } from '../components/ThemedText';
import { PageHeader } from '../components/ui/PageHeader';
import { UserAvatar } from '../components/UserAvatar';
import { colors, spacing, fontSize } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { api, User } from '../api/client';
import { useAppSession } from '../contexts/AppSessionContext';
import { useScreenSafeArea } from '../utils/safeArea';

interface ProfileScreenProps {
    navigation: any;
}

export function ProfileScreen({ navigation }: ProfileScreenProps) {
    const { t } = useLanguage();
    const { isAuthenticated, showLogin, showRegister, user: sessionUser, refreshSession } = useAppSession();
    const { scrollBottomPadding } = useScreenSafeArea();
    const [user, setUser] = useState<User | null>(sessionUser);
    const [loading, setLoading] = useState(false);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    useEffect(() => {
        if (isAuthenticated && !sessionUser) {
            void refreshSession();
        }

        setUser(sessionUser);
        setLoading(false);
    }, [isAuthenticated, refreshSession, sessionUser]);

    const displayUser = user ?? sessionUser;

    const handleEditPhoto = async () => {
        if (!displayUser || uploadLoading) return;
        setUploadError(null);
        try {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
                setUploadError(t('photoLibraryPermissionRequired'));
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
            });
            if (result.canceled) return;
            const asset = result.assets[0];
            const uri = asset.uri;
            const uriParts = uri.split('.');
            const ext = uriParts.length > 1 ? uriParts[uriParts.length - 1] : 'jpg';
            const fileName = \`photo.\${ext}\`;
            const type = asset.mimeType ?? \`image/\${ext === 'jpg' ? 'jpeg' : ext}\`;
            setUploadLoading(true);
            const res = await api.uploadProfilePhoto(uri, fileName, type);
            const updatedUser = { ...displayUser, profileImage: res.profileImage };
            setUser(updatedUser);
            await api.setUser(updatedUser);
        } catch (err: any) {
            console.error('Profile photo upload error:', err);
            setUploadError(err.message || t('profileSaveFailed'));
        } finally {
            setUploadLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!isAuthenticated) {
        return (
            <View style={styles.container}>
                <PageHeader title={t('profile')} showBack onBack={() => navigation.goBack()} />
                <ScrollView
                    style={styles.content}
                    contentContainerStyle={[styles.guestContent, { paddingBottom: scrollBottomPadding }]}
                >
                    <View style={styles.avatarSection}>
                        <UserAvatar
                            size={100}
                            backgroundColor={\`\${colors.primary}33\`}
                            textColor={colors.primary}
                            style={styles.profileAvatar}
                        />
                        <Text style={styles.guestTitle}>{t('notLoggedInTitle')}</Text>
                        <Text style={styles.guestMessage}>{t('notLoggedInProfileMessage')}</Text>
                    </View>

                    <View style={styles.guestActionCard}>
                        <TouchableOpacity style={styles.editProfileButton} onPress={showLogin}>
                            <Text style={styles.editProfileText}>{t('loginButton')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.secondaryActionButton} onPress={showRegister}>
                            <Text style={styles.secondaryActionText}>{t('registerButton')}</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>
        );
    }

    if (isAuthenticated && !displayUser) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    const currentUser = displayUser!;
    const fullName = \`\${currentUser.firstName} \${currentUser.lastName}\`;

    return (
        <View style={styles.container}>
            <PageHeader title={t('profile')} showBack onBack={() => navigation.goBack()} />
            <ScrollView
                style={styles.content}
                contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
            >
                {/* Profile Picture */}
                <View style={styles.avatarSection}>
                    <UserAvatar
                        firstName={currentUser.firstName}
                        lastName={currentUser.lastName}
                        profileImage={currentUser.profileImage}
                        size={100}
                        style={styles.profileAvatar}
                    />
                    {uploadError ? (
                        <Text style={styles.uploadErrorText}>{uploadError}</Text>
                    ) : null}
                    <TouchableOpacity
                        style={styles.editButton}
                        onPress={handleEditPhoto}
                        disabled={uploadLoading}
                    >
                        {uploadLoading ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <Text style={styles.editButtonText}>{t('editPhoto')}</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Profile Info */}
                <View style={styles.infoSection}>
                    <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>{t('fullName')}</Text>
                        <Text style={styles.infoValue}>{fullName}</Text>
                    </View>
                    <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>{t('email')}</Text>
                        <Text style={styles.infoValue}>{currentUser.email}</Text>
                    </View>
                    <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>{t('phone')}</Text>
                        <Text style={styles.infoValue}>{currentUser.phone}</Text>
                    </View>
                    {currentUser.createdAt && (
                        <View style={[styles.infoItem, { borderBottomWidth: 0 }]}>
                            <Text style={styles.infoLabel}>{t('memberSince')}</Text>
                            <Text style={styles.infoValue}>
                                {new Date(currentUser.createdAt).toLocaleDateString()}
                            </Text>
                        </View>
                    )}
                </View>

                <TouchableOpacity
                    style={styles.editProfileButton}
                    onPress={() => navigation.navigate('EditProfile')}
                >
                    <Text style={styles.editProfileText}>{t('editProfile')}</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        flex: 1,
    },
    avatarSection: {
        alignItems: 'center',
        paddingVertical: spacing.xxl,
    },
    profileAvatar: {
        marginBottom: spacing.md,
        shadowColor: colors.brandPrimary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 4,
    },
    editButton: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        borderRadius: 20,
        backgroundColor: colors.surface,
    },
    editButtonText: {
        fontSize: fontSize.sm,
        color: colors.primary,
        fontWeight: '600',
    },
    infoSection: {
        backgroundColor: colors.surface,
        marginHorizontal: spacing.lg,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        shadowColor: colors.brandPrimary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.05,
        shadowRadius: 14,
        elevation: 2,
    },
    infoItem: {
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
    },
    infoLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    infoValue: {
        fontSize: 16,
        color: colors.textPrimary,
        fontWeight: '500',
    },
    editProfileButton: {
        backgroundColor: colors.primary,
        marginHorizontal: spacing.lg,
        marginTop: spacing.xxl,
        padding: spacing.lg,
        borderRadius: 16,
        alignItems: 'center',
    },
    editProfileText: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.textInverse,
    },
    centerContent: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    guestContent: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    guestTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: colors.textPrimary,
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
    guestMessage: {
        fontSize: 16,
        color: colors.textSecondary,
        lineHeight: 24,
        textAlign: 'center',
        maxWidth: 320,
    },
    guestActionCard: {
        backgroundColor: colors.surface,
        marginHorizontal: spacing.lg,
        padding: spacing.lg,
        borderRadius: 16,
        gap: spacing.md,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
    },
    secondaryActionButton: {
        borderWidth: 1,
        borderColor: colors.primary,
        padding: spacing.lg,
        borderRadius: 16,
        alignItems: 'center',
    },
    secondaryActionText: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.primary,
    },
    uploadErrorText: {
        fontSize: 14,
        color: colors.error,
        marginBottom: spacing.sm,
    },
});
`;
fs.writeFileSync('d:/Waheed/Refah/Bookingsystem/RifahMobile/src/screens/ProfileScreen.tsx', content);
