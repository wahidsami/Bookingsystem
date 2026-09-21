import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ThemedText as Text } from '../components/ThemedText';
import { UserAvatar } from '../components/UserAvatar';
import { useLanguage } from '../contexts/LanguageContext';
import { api, User } from '../api/client';
import { useAppSession } from '../contexts/AppSessionContext';
import { useScreenSafeArea } from '../utils/safeArea';
import { CustomerSubpageHeader } from '../components/ui/CustomerSubpageHeader';
import { AppIcon } from '../components/AppIcon';

interface ProfileScreenProps {
    navigation: any;
}

export function ProfileScreen({ navigation }: ProfileScreenProps) {
    const { t, isRTL } = useLanguage();
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
            const fileName = `photo.${ext}`;
            const type = asset.mimeType ?? `image/${ext === 'jpg' ? 'jpeg' : ext}`;
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
            <View style={styles.container}>
                <CustomerSubpageHeader title={t('profile')} onBack={() => navigation.goBack()} />
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color="#6537C0" />
                </View>
            </View>
        );
    }

    if (!isAuthenticated) {
        return (
            <View style={styles.container}>
                <CustomerSubpageHeader title={t('profile')} onBack={() => navigation.goBack()} />
                <ScrollView
                    style={styles.content}
                    contentContainerStyle={[styles.guestContent, { paddingBottom: scrollBottomPadding + 24 }]}
                >
                    <View style={styles.guestCard}>
                        <View style={styles.guestAvatarWrap}>
                            <AppIcon name="profile" size={40} color="#6537C0" />
                        </View>
                        <Text style={[styles.guestTitle, isRTL && styles.textRTL]}>{t('notLoggedInTitle')}</Text>
                        <Text style={[styles.guestMessage, isRTL && styles.textRTL]}>{t('notLoggedInProfileMessage')}</Text>
                        <TouchableOpacity style={styles.primaryButton} onPress={showLogin} activeOpacity={0.85}>
                            <Text style={styles.primaryButtonText}>{t('loginButton')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.secondaryButton} onPress={showRegister} activeOpacity={0.85}>
                            <Text style={styles.secondaryButtonText}>{t('registerButton')}</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>
        );
    }

    const currentUser = displayUser;
    const fullName = currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() : '';

    return (
        <View style={styles.container}>
            <CustomerSubpageHeader
                title={t('profile')}
                onBack={() => navigation.goBack()}
                rightAction={
                    <TouchableOpacity
                        style={styles.headerEditBtn}
                        onPress={() => navigation.navigate('EditProfile')}
                        accessibilityLabel={t('editProfile')}
                    >
                        <AppIcon name="user" size={18} color="#6537C0" />
                    </TouchableOpacity>
                }
            />

            <ScrollView
                style={styles.content}
                contentContainerStyle={{
                    paddingTop: 20,
                    paddingHorizontal: 16,
                    paddingBottom: scrollBottomPadding + 24,
                }}
                showsVerticalScrollIndicator={false}
            >
                {/* 1. Avatar Card */}
                <View style={styles.avatarCard}>
                    <View style={styles.avatarWrap}>
                        <UserAvatar
                            firstName={currentUser?.firstName}
                            lastName={currentUser?.lastName}
                            profileImage={currentUser?.profileImage}
                            size={96}
                            backgroundColor="#F1ECFD"
                            textColor="#6537C0"
                        />
                        <TouchableOpacity
                            style={styles.photoBadge}
                            onPress={handleEditPhoto}
                            disabled={uploadLoading}
                            activeOpacity={0.8}
                            accessibilityLabel={t('editPhoto')}
                        >
                            {uploadLoading ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <AppIcon name="image" size={16} color="#FFFFFF" />
                            )}
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.profileName, isRTL && styles.textRTL]}>
                        {fullName || t('profile')}
                    </Text>
                    <Text style={[styles.profileEmail, isRTL && styles.textRTL]}>
                        {currentUser?.email || ''}
                    </Text>

                    {uploadError ? (
                        <View style={styles.errorBanner}>
                            <Text style={styles.errorBannerText}>{uploadError}</Text>
                        </View>
                    ) : null}

                    <TouchableOpacity
                        style={styles.changePhotoBtn}
                        onPress={handleEditPhoto}
                        disabled={uploadLoading}
                        activeOpacity={0.7}
                    >
                        <AppIcon name="image" size={14} color="#6537C0" />
                        <Text style={styles.changePhotoText}>{t('editPhoto')}</Text>
                    </TouchableOpacity>
                </View>

                {/* 2. Account Information Section */}
                <View style={[styles.sectionHeaderRow, isRTL && styles.rowRTL]}>
                    <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
                        {isRTL ? 'معلومات الحساب' : 'Account Information'}
                    </Text>
                </View>

                <View style={styles.infoCard}>
                    <View style={[styles.infoRow, isRTL && styles.rowRTL]}>
                        <View style={styles.infoIconWrap}>
                            <AppIcon name="profile" size={18} color="#6537C0" />
                        </View>
                        <View style={[styles.infoMeta, isRTL && styles.alignRTL]}>
                            <Text style={[styles.infoLabel, isRTL && styles.textRTL]}>{t('fullName')}</Text>
                            <Text style={[styles.infoValue, isRTL && styles.textRTL]}>{fullName || '-'}</Text>
                        </View>
                    </View>

                    <View style={[styles.infoRow, styles.rowDivider, isRTL && styles.rowRTL]}>
                        <View style={styles.infoIconWrap}>
                            <AppIcon name="mail" size={18} color="#6537C0" />
                        </View>
                        <View style={[styles.infoMeta, isRTL && styles.alignRTL]}>
                            <Text style={[styles.infoLabel, isRTL && styles.textRTL]}>{t('email')}</Text>
                            <Text style={[styles.infoValue, isRTL && styles.textRTL]}>{currentUser?.email || '-'}</Text>
                        </View>
                    </View>

                    <View style={[styles.infoRow, styles.rowDivider, isRTL && styles.rowRTL]}>
                        <View style={styles.infoIconWrap}>
                            <AppIcon name="phone" size={18} color="#6537C0" />
                        </View>
                        <View style={[styles.infoMeta, isRTL && styles.alignRTL]}>
                            <Text style={[styles.infoLabel, isRTL && styles.textRTL]}>{t('phone')}</Text>
                            <Text style={[styles.infoValue, isRTL && styles.textRTL]}>{currentUser?.phone || '-'}</Text>
                        </View>
                    </View>

                    {currentUser?.createdAt && (
                        <View style={[styles.infoRow, styles.rowDivider, isRTL && styles.rowRTL]}>
                            <View style={styles.infoIconWrap}>
                                <AppIcon name="clock" size={18} color="#6537C0" />
                            </View>
                            <View style={[styles.infoMeta, isRTL && styles.alignRTL]}>
                                <Text style={[styles.infoLabel, isRTL && styles.textRTL]}>{t('memberSince')}</Text>
                                <Text style={[styles.infoValue, isRTL && styles.textRTL]}>
                                    {new Date(currentUser.createdAt).toLocaleDateString()}
                                </Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* 3. Action CTA */}
                <TouchableOpacity
                    style={[styles.primaryButton, isRTL && styles.rowRTL]}
                    onPress={() => navigation.navigate('EditProfile')}
                    activeOpacity={0.85}
                >
                    <AppIcon name="user" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryButtonText}>{t('editProfile')}</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAF9FC',
    },
    content: {
        flex: 1,
    },
    centerContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowRTL: {
        flexDirection: 'row-reverse',
    },
    alignRTL: {
        alignItems: 'flex-end',
    },
    textRTL: {
        textAlign: 'right',
    },
    headerEditBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F1ECFD',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    // Avatar Card
    avatarCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        padding: 24,
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    avatarWrap: {
        position: 'relative',
        marginBottom: 12,
    },
    photoBadge: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#6537C0',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: '#FFFFFF',
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    profileName: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
        marginBottom: 4,
    },
    profileEmail: {
        fontSize: 13,
        color: '#6B7280',
        fontFamily: 'Cairo-Regular',
        marginBottom: 12,
    },
    changePhotoBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F1ECFD',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    changePhotoText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6537C0',
        fontFamily: 'Cairo-Bold',
    },
    errorBanner: {
        backgroundColor: '#FEE2E2',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginBottom: 10,
    },
    errorBannerText: {
        fontSize: 12,
        color: '#DC2626',
        fontFamily: 'Cairo-Regular',
    },
    // Section Header
    sectionHeaderRow: {
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#7C3AED',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        fontFamily: 'Cairo-Bold',
    },
    // Info Card
    infoCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        paddingHorizontal: 16,
        marginBottom: 24,
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
    },
    rowDivider: {
        borderTopWidth: 1,
        borderTopColor: '#F5F0FF',
    },
    infoIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F1ECFD',
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoMeta: {
        flex: 1,
        marginHorizontal: 12,
    },
    infoLabel: {
        fontSize: 11,
        color: '#6B7280',
        fontFamily: 'Cairo-Regular',
        marginBottom: 2,
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
    },
    // Buttons
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#6537C0',
        borderRadius: 16,
        paddingVertical: 14,
        gap: 8,
        shadowColor: '#6537C0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 3,
    },
    primaryButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
        fontFamily: 'Cairo-Bold',
    },
    secondaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F1ECFD',
        borderRadius: 16,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        marginTop: 10,
    },
    secondaryButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#6537C0',
        fontFamily: 'Cairo-Bold',
    },
    // Guest State
    guestContent: {
        padding: 20,
    },
    guestCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        padding: 24,
        alignItems: 'center',
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    guestAvatarWrap: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#F1ECFD',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    guestTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    guestMessage: {
        fontSize: 13,
        color: '#6B7280',
        fontFamily: 'Cairo-Regular',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 20,
    },
});
