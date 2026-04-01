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

interface EditProfileScreenProps {
    navigation: any;
}

export function EditProfileScreen({ navigation }: EditProfileScreenProps) {
    const { t, isRTL } = useLanguage();
    const [loading, setLoading] = useState(true);
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
        const loadProfile = async () => {
            try {
                const user = await api.getProfile().catch(() => api.getUser());
                if (!user) {
                    setError(t('failedToLoadProfile'));
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
            } catch (err: any) {
                setError(err.message || t('failedToLoadProfile'));
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, [t]);

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
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
                    <Text style={styles.headerBackText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('editProfile')}</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
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
        backgroundColor: colors.background,
    },
    centerContent: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 56 : 24,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
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
        color: '#DC2626',
        fontSize: fontSize.sm,
    },
    inputGroup: {
        marginBottom: spacing.md,
    },
    label: {
        fontSize: fontSize.md,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        fontSize: fontSize.md,
        color: colors.text,
        backgroundColor: '#FFFFFF',
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
        borderColor: colors.border,
        borderRadius: borderRadius.md,
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
        backgroundColor: colors.primary,
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
