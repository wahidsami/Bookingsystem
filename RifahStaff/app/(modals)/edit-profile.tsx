import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../src/components/AppHeader';
import { useAuth } from '../../src/context/AuthContext';
import { updateMe } from '../../src/services/profile';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';

export default function EditProfileScreen() {
    const { user, updateUser } = useAuth();
    const { t } = useTranslation();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [bio, setBio] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) {
            const names = user.name?.split(' ') || [];
            setFirstName(names[0] || '');
            setLastName(names.slice(1).join(' ') || '');
            setPhone(user.phone || '');
            setBio((user as any).bio || '');
        }
    }, [user]);

    const handleSave = async () => {
        if (!firstName.trim()) {
            Alert.alert(t('common.error'), t('auth.nameRequired', 'First name is required'));
            return;
        }

        setLoading(true);
        try {
            await updateMe({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                phone: phone.trim(),
                bio: bio.trim()
            });
            
            updateUser({
                name: `${firstName.trim()} ${lastName.trim()}`,
                phone: phone.trim(),
                bio: bio.trim()
            } as any);
            
            Alert.alert(t('common.success'), t('profile.updateSuccess', 'Profile updated successfully'), [
                { text: t('common.ok'), onPress: () => router.back() }
            ]);
        } catch (error: any) {
            Alert.alert(t('common.error'), error.message || t('profile.updateError', 'Failed to update profile'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <AppHeader title={t('profile.editProfile', 'Edit Profile')} showBack={true} />
            
            <KeyboardAvoidingView 
                style={{ flex: 1 }} 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>{t('auth.firstName', 'First Name')}</Text>
                        <TextInput
                            style={styles.input}
                            value={firstName}
                            onChangeText={setFirstName}
                            placeholder={t('auth.firstNamePlaceholder', 'Enter first name')}
                            placeholderTextColor="#9ca3af"
                        />
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>{t('auth.lastName', 'Last Name')}</Text>
                        <TextInput
                            style={styles.input}
                            value={lastName}
                            onChangeText={setLastName}
                            placeholder={t('auth.lastNamePlaceholder', 'Enter last name')}
                            placeholderTextColor="#9ca3af"
                        />
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>{t('auth.phone', 'Phone')}</Text>
                        <TextInput
                            style={styles.input}
                            value={phone}
                            onChangeText={setPhone}
                            placeholder={t('auth.phonePlaceholder', 'Enter phone number')}
                            placeholderTextColor="#9ca3af"
                            keyboardType="phone-pad"
                        />
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>{t('profile.bio', 'Bio')}</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={bio}
                            onChangeText={setBio}
                            placeholder={t('profile.bioPlaceholder', 'Tell us about yourself')}
                            placeholderTextColor="#9ca3af"
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                        />
                    </View>
                    
                    <View style={styles.readOnlyInfo}>
                        <Text style={styles.readOnlyText}>{t('profile.readOnlyInfo', 'Email, role, and permissions can only be modified by your administrator.')}</Text>
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity 
                        style={[styles.saveButton, loading && styles.saveButtonDisabled]} 
                        onPress={handleSave}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.saveButtonText}>{t('common.save', 'Save Changes')}</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f3f4f6',
    },
    content: {
        padding: 20,
    },
    formGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: '#111827',
    },
    textArea: {
        height: 100,
    },
    readOnlyInfo: {
        marginTop: 10,
        padding: 16,
        backgroundColor: '#e0e7ff',
        borderRadius: 8,
    },
    readOnlyText: {
        color: '#4338ca',
        fontSize: 13,
        lineHeight: 18,
    },
    footer: {
        padding: 20,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    saveButton: {
        backgroundColor: '#6537C0',
        borderRadius: 8,
        padding: 16,
        alignItems: 'center',
    },
    saveButtonDisabled: {
        opacity: 0.7,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
