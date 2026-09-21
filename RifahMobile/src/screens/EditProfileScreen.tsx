import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { useLanguage } from '../contexts/LanguageContext';
import { api, User } from '../api/client';
import { useScreenSafeArea } from '../utils/safeArea';
import { useAppSession } from '../contexts/AppSessionContext';
import { CustomerSubpageHeader } from '../components/ui/CustomerSubpageHeader';
import { AppIcon } from '../components/AppIcon';

interface EditProfileScreenProps {
    navigation: any;
}

export function EditProfileScreen({ navigation }: EditProfileScreenProps) {
    const { t, isRTL } = useLanguage();
    const { scrollBottomPadding } = useScreenSafeArea();
    const { isAuthenticated, user } = useAppSession();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState<Partial<User>>({
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        gender: '',
        addressCity: '',
        addressStreet: '',
        addressBuilding: '',
        addressPhone: '',
    });

    useEffect(() => {
        if (!isAuthenticated || !user) {
            setError(t('failedToLoadProfile'));
            setLoading(false);
            return;
        }

        setFormData({
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            dateOfBirth: user.dateOfBirth || '',
            gender: user.gender || '',
            addressCity: user.addressCity || '',
            addressStreet: user.addressStreet || '',
            addressBuilding: user.addressBuilding || '',
            addressPhone: user.addressPhone || user.phone || '',
        });
        setLoading(false);
    }, [isAuthenticated, t, user]);

    const handleSave = async () => {
        if (!formData.firstName?.trim() || !formData.lastName?.trim()) {
            setError(t('profileNameRequired'));
            return;
        }

        setError('');
        setSaving(true);

        try {
            const updatedUser = await api.updateProfile({
                firstName: formData.firstName.trim(),
                lastName: formData.lastName.trim(),
                dateOfBirth: formData.dateOfBirth?.trim() || undefined,
                gender: formData.gender || undefined,
                addressCity: formData.addressCity?.trim() || undefined,
                addressStreet: formData.addressStreet?.trim() || undefined,
                addressBuilding: formData.addressBuilding?.trim() || undefined,
                addressPhone: formData.addressPhone?.trim() || undefined,
            });

            await api.setUser(updatedUser);
            navigation.goBack();
        } catch (err: any) {
            setError(err.message || t('profileSaveFailed'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <CustomerSubpageHeader title={t('editProfile')} onBack={() => navigation.goBack()} />
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color="#6537C0" />
                </View>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <CustomerSubpageHeader
                title={t('editProfile')}
                onBack={() => navigation.goBack()}
            />

            <ScrollView
                contentContainerStyle={[
                    styles.content,
                    { paddingBottom: scrollBottomPadding + 24 }
                ]}
                showsVerticalScrollIndicator={false}
            >
                {error ? (
                    <View style={[styles.errorContainer, isRTL && styles.rowRTL]}>
                        <AppIcon name="warning" size={18} color="#DC2626" />
                        <Text style={[styles.errorText, isRTL && styles.textRTL]}>{error}</Text>
                    </View>
                ) : null}

                {/* 1. Basic Information Section */}
                <View style={[styles.sectionHeaderRow, isRTL && styles.rowRTL]}>
                    <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
                        {isRTL ? 'المعلومات الأساسية' : 'Basic Information'}
                    </Text>
                </View>

                <View style={styles.formCard}>
                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, isRTL && styles.textRTL]}>{t('firstName')}</Text>
                        <TextInput
                            style={[styles.input, isRTL && styles.rtlInput]}
                            value={formData.firstName}
                            onChangeText={(text) => setFormData((current) => ({ ...current, firstName: text }))}
                            placeholder={t('firstName')}
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, isRTL && styles.textRTL]}>{t('lastName')}</Text>
                        <TextInput
                            style={[styles.input, isRTL && styles.rtlInput]}
                            value={formData.lastName}
                            onChangeText={(text) => setFormData((current) => ({ ...current, lastName: text }))}
                            placeholder={t('lastName')}
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, isRTL && styles.textRTL]}>{t('dateOfBirth')}</Text>
                        <TextInput
                            style={[styles.input, isRTL && styles.rtlInput]}
                            value={formData.dateOfBirth}
                            onChangeText={(text) => setFormData((current) => ({ ...current, dateOfBirth: text }))}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, isRTL && styles.textRTL]}>{t('gender')}</Text>
                        <View style={[styles.genderRow, isRTL && styles.rowRTL]}>
                            <TouchableOpacity
                                style={[
                                    styles.genderChip,
                                    formData.gender === 'female' && styles.genderChipActive,
                                ]}
                                onPress={() => setFormData((current) => ({ ...current, gender: 'female' }))}
                            >
                                <Text
                                    style={[
                                        styles.genderChipText,
                                        formData.gender === 'female' && styles.genderChipTextActive,
                                    ]}
                                >
                                    {isRTL ? 'أنثى' : 'Female'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.genderChip,
                                    formData.gender === 'male' && styles.genderChipActive,
                                ]}
                                onPress={() => setFormData((current) => ({ ...current, gender: 'male' }))}
                            >
                                <Text
                                    style={[
                                        styles.genderChipText,
                                        formData.gender === 'male' && styles.genderChipTextActive,
                                    ]}
                                >
                                    {isRTL ? 'ذكر' : 'Male'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* 2. Address & Delivery Information */}
                <View style={[styles.sectionHeaderRow, isRTL && styles.rowRTL]}>
                    <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
                        {isRTL ? 'بيانات التوصيل' : 'Delivery Details'}
                    </Text>
                </View>

                <View style={styles.formCard}>
                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, isRTL && styles.textRTL]}>{isRTL ? 'المدينة' : 'City'}</Text>
                        <TextInput
                            style={[styles.input, isRTL && styles.rtlInput]}
                            value={formData.addressCity}
                            onChangeText={(text) => setFormData((current) => ({ ...current, addressCity: text }))}
                            placeholder={isRTL ? 'المدينة' : 'City'}
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, isRTL && styles.textRTL]}>{isRTL ? 'الشارع' : 'Street'}</Text>
                        <TextInput
                            style={[styles.input, isRTL && styles.rtlInput]}
                            value={formData.addressStreet}
                            onChangeText={(text) => setFormData((current) => ({ ...current, addressStreet: text }))}
                            placeholder={isRTL ? 'الشارع' : 'Street'}
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, isRTL && styles.textRTL]}>{isRTL ? 'المبنى' : 'Building'}</Text>
                        <TextInput
                            style={[styles.input, isRTL && styles.rtlInput]}
                            value={formData.addressBuilding}
                            onChangeText={(text) => setFormData((current) => ({ ...current, addressBuilding: text }))}
                            placeholder={isRTL ? 'المبنى' : 'Building'}
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, isRTL && styles.textRTL]}>{isRTL ? 'رقم الهاتف' : 'Phone'}</Text>
                        <TextInput
                            style={[styles.input, { textAlign: 'left', writingDirection: 'ltr' }]}
                            value={formData.addressPhone}
                            onChangeText={(text) => setFormData((current) => ({ ...current, addressPhone: text }))}
                            placeholder={isRTL ? 'رقم الهاتف' : 'Phone'}
                            placeholderTextColor="#9CA3AF"
                            keyboardType="phone-pad"
                        />
                    </View>
                </View>

                {/* 3. Save Button */}
                <TouchableOpacity
                    style={[styles.saveButton, isRTL && styles.rowRTL]}
                    onPress={handleSave}
                    disabled={saving}
                    activeOpacity={0.85}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <>
                            <AppIcon name="check" size={18} color="#FFFFFF" />
                            <Text style={styles.saveButtonText}>{isRTL ? 'حفظ التغييرات' : 'Save Changes'}</Text>
                        </>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAF9FC',
    },
    content: {
        paddingTop: 16,
        paddingHorizontal: 16,
    },
    centerContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowRTL: {
        flexDirection: 'row-reverse',
    },
    textRTL: {
        textAlign: 'right',
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEE2E2',
        borderRadius: 14,
        padding: 12,
        marginBottom: 16,
        gap: 8,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    errorText: {
        flex: 1,
        fontSize: 13,
        color: '#DC2626',
        fontFamily: 'Cairo-Regular',
    },
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
    formCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        padding: 16,
        marginBottom: 20,
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
    },
    inputGroup: {
        marginBottom: 14,
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
        marginBottom: 6,
    },
    input: {
        borderWidth: 1,
        borderColor: '#E7DDFC',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 14,
        color: '#1D035F',
        backgroundColor: '#FAF8FE',
        fontFamily: 'Cairo-Regular',
    },
    rtlInput: {
        textAlign: 'right',
    },
    genderRow: {
        flexDirection: 'row',
        gap: 10,
    },
    genderChip: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        backgroundColor: '#FAF8FE',
    },
    genderChipActive: {
        backgroundColor: '#6537C0',
        borderColor: '#6537C0',
    },
    genderChipText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
        fontFamily: 'Cairo-Bold',
    },
    genderChipTextActive: {
        color: '#FFFFFF',
    },
    saveButton: {
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
        marginBottom: 16,
    },
    saveButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
        fontFamily: 'Cairo-Bold',
    },
});
