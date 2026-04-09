import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Modal, FlatList, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../src/context/LanguageContext';
import { getImageUrl } from '../../src/services/api';

const SUPPORTED_LANGUAGES = [
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
    { code: 'ur', name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰' },
    { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳' },
    { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳' },
    { code: 'tl', name: 'Filipino', nativeName: 'Tagalog', flag: '🇵🇭' },
    { code: 'th', name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭' },
];

export default function ProfileScreen() {
    const { user, signOut } = useAuth();
    const { language, setLanguage, isRTL } = useLanguage();
    const { t } = useTranslation();
    const [showLangModal, setShowLangModal] = useState(false);
    const [isChangingLang, setIsChangingLang] = useState(false);

    const currentLangObj = SUPPORTED_LANGUAGES.find(l => l.code === language) || SUPPORTED_LANGUAGES[0];

    const handleLanguageSelect = async (code: string) => {
        setIsChangingLang(true);
        try {
            await setLanguage(code);
            setShowLangModal(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsChangingLang(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <LinearGradient
                colors={['#8B5ADF', '#683AB7']}
                style={styles.header}
            >
                <Text style={styles.headerTitle}>{t('profile.title')}</Text>
            </LinearGradient>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.profileCard}>
                    <View style={styles.avatarContainer}>
                        {user?.photo ? (
                            <Image
                                source={{ uri: getImageUrl(user.photo) }}
                                style={styles.avatarImage}
                            />
                        ) : (
                            <Ionicons name="person" size={40} color="#8B5ADF" />
                        )}
                    </View>
                    <Text style={styles.name}>{user?.name}</Text>
                    <Text style={styles.email}>{user?.email}</Text>

                    {user?.tenant && (
                        <View style={styles.tenantBadge}>
                            <Ionicons name="business" size={14} color="#6b7280" style={{ marginHorizontal: 6 }} />
                            <Text style={styles.tenantText}>{user.tenant.name_en || user.tenant.name_ar}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('profile.settings')}</Text>

                    <TouchableOpacity style={styles.menuItem}>
                        <View style={styles.menuItemLeft}>
                            <Ionicons name="lock-closed-outline" size={24} color="#4b5563" />
                            <Text style={styles.menuItemText}>{t('auth.changePassword')}</Text>
                        </View>
                        <Ionicons name={language === 'ar' || language === 'ur' ? 'chevron-back' : 'chevron-forward'} size={20} color="#9ca3af" />
                    </TouchableOpacity>

                    <View style={styles.divider} />

                    <TouchableOpacity style={styles.menuItem} onPress={() => setShowLangModal(true)}>
                        <View style={styles.menuItemLeft}>
                            <Ionicons name="language-outline" size={24} color="#4b5563" />
                            <Text style={styles.menuItemText}>{t('profile.language')} ({currentLangObj.nativeName})</Text>
                        </View>
                        <Ionicons name={language === 'ar' || language === 'ur' ? 'chevron-back' : 'chevron-forward'} size={20} color="#9ca3af" />
                    </TouchableOpacity>

                    <View style={styles.divider} />

                    <TouchableOpacity style={styles.menuItem}>
                        <View style={styles.menuItemLeft}>
                            <Ionicons name="notifications-outline" size={24} color="#4b5563" />
                            <Text style={styles.menuItemText}>Notifications</Text>
                        </View>
                        <Ionicons name={language === 'ar' || language === 'ur' ? 'chevron-back' : 'chevron-forward'} size={20} color="#9ca3af" />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
                    <Ionicons name="log-out-outline" size={20} color="#ef4444" style={{ marginHorizontal: 8 }} />
                    <Text style={styles.logoutText}>{t('profile.logout')}</Text>
                </TouchableOpacity>

                <Text style={styles.versionText}>RefahStaff v1.0.0</Text>
            </ScrollView>

            <Modal visible={showLangModal} animationType="slide" transparent={true} onRequestClose={() => setShowLangModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('profile.chooseLanguage')}</Text>
                            <TouchableOpacity onPress={() => setShowLangModal(false)}>
                                <Ionicons name="close" size={24} color="#4b5563" />
                            </TouchableOpacity>
                        </View>

                        {isChangingLang ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#8B5ADF" />
                                <Text style={styles.loadingText}>{t('common.loading')}</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={SUPPORTED_LANGUAGES}
                                keyExtractor={(item) => item.code}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[styles.langItem, language === item.code && styles.langItemActive]}
                                        onPress={() => handleLanguageSelect(item.code)}
                                    >
                                        <Text style={styles.langFlag}>{item.flag}</Text>
                                        <View style={styles.langTextContainer}>
                                            <Text
                                                style={[
                                                    styles.langNative,
                                                    language === item.code && styles.langTextActive,
                                                    (['ar', 'ur'].includes(item.code) && isRTL) && { fontFamily: 'Cairo_600SemiBold' }
                                                ]}
                                            >
                                                {item.nativeName}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.langEnglish,
                                                    (['ar', 'ur'].includes(item.code) && isRTL) && { fontFamily: 'Cairo_600SemiBold' }
                                                ]}
                                            >
                                                {item.name}
                                            </Text>
                                        </View>
                                        {language === item.code && (
                                            <Ionicons name="checkmark-circle" size={24} color="#8B5ADF" />
                                        )}
                                    </TouchableOpacity>
                                )}
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f3f4f6',
    },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#ffffff',
    },
    content: {
        padding: 20,
    },
    profileCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
        marginTop: -40, // Pull up into the header slightly
    },
    avatarContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#f3f4f6',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 3,
        borderColor: '#ffffff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    name: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 4,
    },
    email: {
        fontSize: 15,
        color: '#6b7280',
        marginBottom: 12,
    },
    tenantBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    tenantText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#4b5563',
    },
    section: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        paddingHorizontal: 16,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#9ca3af',
        textTransform: 'uppercase',
        marginTop: 20,
        marginBottom: 8,
        paddingHorizontal: 8,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 8,
    },
    menuItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    menuItemText: {
        fontSize: 16,
        color: '#374151',
        marginLeft: 16,
    },
    divider: {
        height: 1,
        backgroundColor: '#f3f4f6',
        marginLeft: 48,
    },
    logoutButton: {
        flexDirection: 'row',
        backgroundColor: '#fee2e2',
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    logoutText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#ef4444',
    },
    versionText: {
        textAlign: 'center',
        color: '#9ca3af',
        fontSize: 13,
        marginBottom: 20,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    langItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    langItemActive: {
        backgroundColor: '#f5f3ff',
        borderRadius: 12,
        paddingHorizontal: 12,
        borderBottomWidth: 0,
        marginVertical: 4,
    },
    langFlag: {
        fontSize: 24,
        marginHorizontal: 12,
    },
    langTextContainer: {
        flex: 1,
    },
    langNative: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#374151',
    },
    langEnglish: {
        fontSize: 13,
        color: '#6b7280',
    },
    langTextActive: {
        color: '#8B5ADF',
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        color: '#6b7280',
        fontSize: 16,
    }
});
