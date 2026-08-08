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
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { api, User } from '../api/client';
import { useScreenSafeArea } from '../utils/safeArea';
import { useAppSession } from '../contexts/AppSessionContext';

interface EditProfileScreenProps {
    navigation: any;
}

export function EditProfileScreen({ navigation }: EditProfileScreenProps) {
    const { t, isRTL } = useLanguage();
    const { topInset, scrollBottomPadding } = useScreenSafeArea();
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
            <View style={[styles.header, { paddingTop: spacing.lg + topInset }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
                    <Text style={styles.headerBackText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('editProfile')}</Text>
                <View style={styles.headerSpacer} />
            </View>

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
        backgroundColor: '#F7F4FF',
    },
    centerContent: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 0,
    },
    headerBack: {
        width: 40,
        alignItems: 'flex-start',
    },
    headerBackText: {
        fontSize: fontSize.xl,
        color: colors.text,
    },
    headerTitle: {
        fontSize: fontSize.lg,
        fontWeight: '700',
        color: colors.text,
    },
    headerSpacer: {
        width: 40,
    },
    content: {
        padding: spacing.lg,
        paddingBottom: spacing.xxl,
    },
    errorContainer: {
        backgroundColor: '#FEE2E2',
        borderWidth: 1,
        borderColor: '#FCA5A5',
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginBottom: spacing.lg,
    },
    errorText: {
        color: colors.error,
        fontSize: fontSize.sm,
    },
    inputGroup: {
        marginBottom: spacing.md,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: '#E9DDFD',
    },
    label: {
        fontSize: fontSize.md,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    input: {
        borderWidth: 1,
        borderColor: '#E9DDFD',
        borderRadius: 14,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        fontSize: fontSize.md,
        color: colors.text,
        backgroundColor: '#FAFAFF',
        minHeight: 48,
    },
    rtlInput: {
        textAlign: 'right',
    },
    genderButtons: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    genderButton: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#DDD6FE',
        borderRadius: 14,
        paddingVertical: spacing.sm,
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    genderButtonSelected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    genderButtonText: {
        fontSize: fontSize.sm,
        color: colors.text,
    },
    genderButtonTextSelected: {
        color: colors.textInverse,
        fontWeight: '700',
    },
    saveButton: {
        backgroundColor: '#7C3AED',
        borderRadius: borderRadius.lg,
        paddingVertical: spacing.md + 2,
        alignItems: 'center',
        marginTop: spacing.md,
        minHeight: 48,
    },
    saveButtonDisabled: {
        opacity: 0.6,
    },
    saveButtonText: {
        color: colors.textInverse,
        fontSize: fontSize.xl,
        fontWeight: '700',
    },
});
