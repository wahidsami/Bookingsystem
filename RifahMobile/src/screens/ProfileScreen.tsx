import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { ThemedText as Text } from '../components/ThemedText';
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
    const { isAuthenticated, showLogin, showRegister } = useAppSession();
    const { topInset, scrollBottomPadding } = useScreenSafeArea();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    useFocusEffect(
        React.useCallback(() => {
            loadUserData();
        }, [isAuthenticated])
    );

    const loadUserData = async () => {
        setLoading(true);
        if (!isAuthenticated) {
            setUser(null);
            setLoading(false);
            return;
        }

        try {
            const userData = await api.getProfile().catch(() => api.getUser());
            setUser(userData);
            if (userData) {
                await api.setUser(userData);
            }
        } catch (error) {
            console.error('Failed to load user data:', error);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const handleEditPhoto = async () => {
        if (!user || uploadLoading) return;
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
            const fileName = `photo.${ext}`;
            const type = asset.mimeType ?? `image/${ext === 'jpg' ? 'jpeg' : ext}`;
            setUploadLoading(true);
            const res = await api.uploadProfilePhoto(uri, fileName, type);
            const updatedUser = { ...user, profileImage: res.profileImage };
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

    if (!user) {
        return (
            <View style={styles.container}>
                <View style={[styles.header, { paddingTop: spacing.xl + topInset }]}>
                    <Text style={styles.headerTitle}>{t('profile')}</Text>
                </View>
                <ScrollView
                    style={styles.content}
                    contentContainerStyle={[styles.guestContent, { paddingBottom: scrollBottomPadding }]}
                >
                    <View style={styles.avatarSection}>
                        <UserAvatar
                            size={100}
                            backgroundColor={`${colors.primary}33`}
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

    const fullName = `${user.firstName} ${user.lastName}`;
    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: spacing.xl + topInset }]}>
                <Text style={styles.headerTitle}>{t('profile')}</Text>
            </View>
            <ScrollView
                style={styles.content}
                contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
            >
                {/* Profile Picture */}
                <View style={styles.avatarSection}>
                    <UserAvatar
                        firstName={user.firstName}
                        lastName={user.lastName}
                        profileImage={user.profileImage}
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
                        <Text style={styles.infoValue}>{user.email}</Text>
                    </View>
                    <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>{t('phone')}</Text>
                        <Text style={styles.infoValue}>{user.phone}</Text>
                    </View>
                    {user.createdAt && (
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>{t('memberSince')}</Text>
                            <Text style={styles.infoValue}>
                                {new Date(user.createdAt).toLocaleDateString()}
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
    header: {
        padding: spacing.xl,
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerTitle: {
        fontSize: fontSize.xxl,
        fontWeight: '700',
        color: colors.text,
    },
    content: {
        flex: 1,
    },
    avatarSection: {
        alignItems: 'center',
        padding: spacing.xl,
        backgroundColor: colors.background,
        marginBottom: spacing.md,
    },
    profileAvatar: {
        marginBottom: spacing.md,
    },
    editButton: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
    },
    editButtonText: {
        fontSize: fontSize.sm,
        color: colors.primary,
        fontWeight: '600',
    },
    infoSection: {
        backgroundColor: colors.background,
        paddingHorizontal: spacing.lg,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: colors.border,
    },
    infoItem: {
        paddingVertical: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    infoLabel: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        marginBottom: 4,
    },
    infoValue: {
        fontSize: fontSize.md,
        color: colors.text,
        fontWeight: '500',
    },
    editProfileButton: {
        backgroundColor: colors.primary,
        marginHorizontal: spacing.lg,
        marginTop: spacing.xl,
        padding: spacing.lg,
        borderRadius: 12,
        alignItems: 'center',
    },
    editProfileText: {
        fontSize: fontSize.md,
        fontWeight: '600',
        color: colors.textInverse,
    },
    centerContent: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
    },
    guestContent: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    guestTitle: {
        fontSize: fontSize.xl,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
    guestMessage: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        lineHeight: 24,
        textAlign: 'center',
        maxWidth: 320,
    },
    guestActionCard: {
        backgroundColor: colors.background,
        marginHorizontal: spacing.lg,
        padding: spacing.lg,
        borderRadius: 16,
        gap: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    secondaryActionButton: {
        borderWidth: 1,
        borderColor: colors.primary,
        padding: spacing.lg,
        borderRadius: 12,
        alignItems: 'center',
    },
    secondaryActionText: {
        fontSize: fontSize.md,
        fontWeight: '600',
        color: colors.primary,
    },
    uploadErrorText: {
        fontSize: fontSize.sm,
        color: colors.error,
        marginBottom: spacing.sm,
    },
});
