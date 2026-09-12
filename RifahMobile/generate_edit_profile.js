const fs = require('fs');

const content = `import React, { useEffect, useState } from 'react';
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
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { PageHeader } from '../components/ui/PageHeader';
import { useLanguage } from '../contexts/LanguageContext';
import { api, User } from '../api/client';
import { useScreenSafeArea } from '../utils/safeArea';
import { useAppSession } from '../contexts/AppSessionContext';

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
            <View style={[styles.container, styles.centerContent]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <PageHeader title={t('editProfile')} showBack onBack={() => navigation.goBack()} />

            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPadding }]}>
                {error ? (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t('firstName')}</Text>
                    <TextInput
                        style={[styles.input, isRTL && styles.rtlInput]}
                        value={formData.firstName}
                        onChangeText={(text) => setFormData((current) => ({ ...current, firstName: text }))}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t('lastName')}</Text>
                    <TextInput
                        style={[styles.input, isRTL && styles.rtlInput]}
                        value={formData.lastName}
                        onChangeText={(text) => setFormData((current) => ({ ...current, lastName: text }))}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t('dateOfBirth')}</Text>
                    <TextInput
                        style={[styles.input, isRTL && styles.rtlInput]}
                        value={formData.dateOfBirth}
                        onChangeText={(text) => setFormData((current) => ({ ...current, dateOfBirth: text }))}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.textTertiary}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t('gender')}</Text>
                    <View style={styles.genderButtons}>
                        {(['male', 'female', 'other'] as const).map((option) => (
                            <TouchableOpacity
                                key={option}
                                style={[
                                    styles.genderButton,
                                    formData.gender === option && styles.genderButtonSelected,
                                ]}
                                onPress={() => setFormData((current) => ({ ...current, gender: option }))}
                            >
                                <Text
                                    style={[
                                        styles.genderButtonText,
                                        formData.gender === option && styles.genderButtonTextSelected,
                                    ]}
                                >
                                    {t(option)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t('cityLabel')}</Text>
                    <TextInput
                        style={[styles.input, isRTL && styles.rtlInput]}
                        value={formData.addressCity}
                        onChangeText={(text) => setFormData((current) => ({ ...current, addressCity: text }))}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t('streetLabel')}</Text>
                    <TextInput
                        style={[styles.input, isRTL && styles.rtlInput]}
                        value={formData.addressStreet}
                        onChangeText={(text) => setFormData((current) => ({ ...current, addressStreet: text }))}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t('buildingLabel')}</Text>
                    <TextInput
                        style={[styles.input, isRTL && styles.rtlInput]}
                        value={formData.addressBuilding}
                        onChangeText={(text) => setFormData((current) => ({ ...current, addressBuilding: text }))}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t('deliveryPhone')}</Text>
                    <TextInput
                        style={[styles.input, isRTL && styles.rtlInput]}
                        value={formData.addressPhone}
                        onChangeText={(text) => setFormData((current) => ({ ...current, addressPhone: text }))}
                        keyboardType="phone-pad"
                    />
                </View>

                <TouchableOpacity
                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator color={colors.textInverse} />
                    ) : (
                        <Text style={styles.saveButtonText}>{t('saveProfile')}</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    centerContent: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: spacing.lg,
        paddingTop: spacing.xl,
    },
    errorContainer: {
        backgroundColor: colors.error + '11',
        borderWidth: 1,
        borderColor: colors.error,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginBottom: spacing.lg,
    },
    errorText: {
        color: colors.error,
        fontSize: fontSize.sm,
    },
    inputGroup: {
        marginBottom: spacing.lg,
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        borderRadius: 16,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        fontSize: 16,
        color: colors.textPrimary,
        backgroundColor: colors.surface,
        minHeight: 52,
    },
    rtlInput: {
        textAlign: 'right',
    },
    genderButtons: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    genderButton: {
        flex: 1,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        borderRadius: 16,
        paddingVertical: spacing.md,
        alignItems: 'center',
        backgroundColor: colors.surface,
    },
    genderButtonSelected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    genderButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    genderButtonTextSelected: {
        color: colors.textInverse,
    },
    saveButton: {
        backgroundColor: colors.primary,
        borderRadius: 16,
        paddingVertical: spacing.lg,
        alignItems: 'center',
        marginTop: spacing.xl,
        minHeight: 56,
        justifyContent: 'center',
    },
    saveButtonDisabled: {
        opacity: 0.6,
    },
    saveButtonText: {
        color: colors.textInverse,
        fontSize: 16,
        fontWeight: '700',
    },
});
`;
fs.writeFileSync('d:/Waheed/Refah/Bookingsystem/RifahMobile/src/screens/EditProfileScreen.tsx', content);
