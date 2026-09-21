import React, { useEffect, useState } from 'react';
import {
    View, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, Alert, Modal, ScrollView,
    TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { ThemedText as Text } from '../components/ThemedText';
import { AppIcon } from '../components/AppIcon';
import { colors, spacing, fontSize, borderRadius } from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenSafeArea } from '../utils/safeArea';
import { api, UserAddress } from '../api/client';
import { CustomerSubpageHeader } from '../components/ui/CustomerSubpageHeader';
import { usePopup } from '../contexts/PopupContext';

interface FormData {
    title: string;
    street: string;
    city: string;
    building: string;
    floor: string;
    apartment: string;
    phone: string;
    notes: string;
    isDefault: boolean;
}

const EMPTY_FORM: FormData = {
    title: '',
    street: '',
    city: '',
    building: '',
    floor: '',
    apartment: '',
    phone: '',
    notes: '',
    isDefault: false,
};

export function SavedAddressesScreen({ navigation }: any) {
    const { language } = useLanguage();
    const isRTL = language === 'ar';
    const { scrollBottomPadding } = useScreenSafeArea();
    const { confirm, showDialog, showToast } = usePopup();

    const [addresses, setAddresses] = useState<UserAddress[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<FormData>(EMPTY_FORM);

    const loadAddresses = async () => {
        setError(false);
        try {
            let list = await api.getAddresses();
            if (list.length === 0) {
                // Check if user has legacy address in profile
                try {
                    const user = await api.getProfile();
                    if (user.addressStreet || user.addressCity) {
                        const seeded = await api.createAddress({
                            title: isRTL ? 'المنزل' : 'Home',
                            street: user.addressStreet || '',
                            city: user.addressCity || '',
                            building: user.addressBuilding,
                            floor: user.addressFloor,
                            apartment: user.addressApartment,
                            phone: user.addressPhone,
                            notes: user.addressNotes,
                            isDefault: true,
                        });
                        list = [seeded];
                    }
                } catch {
                    // Ignore profile fallback check error
                }
            }
            setAddresses(list);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { loadAddresses(); }, []);

    // --- Open ADD modal ---
    const openAdd = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setModalVisible(true);
    };

    // --- Open EDIT modal ---
    const openEdit = (item: UserAddress) => {
        setEditingId(item.id);
        setForm({
            title: item.title || '',
            street: item.street || '',
            city: item.city || '',
            building: item.building || '',
            floor: item.floor || '',
            apartment: item.apartment || '',
            phone: item.phone || '',
            notes: item.notes || '',
            isDefault: item.isDefault || false,
        });
        setModalVisible(true);
    };

    // --- Save (create or update) ---
    const handleSave = async () => {
        if (!form.street.trim() || !form.city.trim()) {
            Alert.alert(
                isRTL ? 'حقل مطلوب' : 'Required',
                isRTL ? 'الشارع والمدينة مطلوبان' : 'Street and city are required'
            );
            return;
        }
        setSaving(true);
        try {
            const payload = {
                title: form.title.trim() || (isRTL ? 'المنزل' : 'Home'),
                street: form.street.trim(),
                city: form.city.trim(),
                building: form.building.trim() || undefined,
                floor: form.floor.trim() || undefined,
                apartment: form.apartment.trim() || undefined,
                phone: form.phone.trim() || undefined,
                notes: form.notes.trim() || undefined,
                isDefault: form.isDefault,
            };

            if (editingId) {
                await api.updateAddress(editingId, payload);
            } else {
                await api.createAddress(payload);
            }

            setModalVisible(false);
            await loadAddresses();
        } catch {
            Alert.alert('Error', isRTL ? 'فشل حفظ العنوان' : 'Failed to save address');
        } finally {
            setSaving(false);
        }
    };

    // --- Set Default ---
    const handleSetDefault = async (item: UserAddress) => {
        try {
            await api.updateAddress(item.id, { isDefault: true });
            await loadAddresses();
        } catch {
            Alert.alert('Error', isRTL ? 'فشل تعيين العنوان كافتراضي' : 'Failed to set default address');
        }
    };

    // --- Delete ---
    const handleDelete = async (id: string) => {
        const confirmed = await confirm({
            title: isRTL ? 'حذف العنوان' : 'Delete Address',
            message: isRTL ? 'هل أنت متأكد من حذف هذا العنوان؟' : 'Are you sure you want to delete this address?',
            confirmText: isRTL ? 'حذف' : 'Delete',
            cancelText: isRTL ? 'إلغاء' : 'Cancel',
            variant: 'destructive',
        });

        if (!confirmed) return;

        try {
            await api.deleteAddress(id);
            await loadAddresses();
            showToast({
                message: isRTL ? 'تم حذف العنوان بنجاح' : 'Address deleted successfully',
                type: 'success',
            });
        } catch {
            await showDialog({
                title: isRTL ? 'خطأ' : 'Error',
                message: isRTL ? 'فشل حذف العنوان' : 'Failed to delete address',
                variant: 'error',
                confirmText: isRTL ? 'حسنًا' : 'OK',
            });
        }
    };

    const setField = (field: keyof FormData, value: string | boolean) =>
        setForm((prev) => ({ ...prev, [field]: value }));

    const renderAddress = ({ item }: { item: UserAddress }) => (
        <View style={styles.addressCard}>
            <View style={[styles.addressHeader, isRTL && styles.rowReverse]}>
                <View style={[styles.titleRow, isRTL && styles.rowReverse]}>
                    <AppIcon name="location" size={18} color={colors.primary} />
                    <Text style={styles.title}>{item.title}</Text>
                    {item.isDefault && (
                        <View style={styles.defaultBadge}>
                            <Text style={styles.defaultText}>{isRTL ? 'الافتراضي' : 'Default'}</Text>
                        </View>
                    )}
                </View>
                <View style={[styles.actionRow, isRTL && styles.rowReverse]}>
                    {!item.isDefault && (
                        <TouchableOpacity
                            onPress={() => handleSetDefault(item)}
                            style={styles.iconBtn}
                            accessibilityLabel={isRTL ? 'تعيين افتراضي' : 'Set Default'}
                        >
                            <AppIcon name="check" size={18} color="#10B981" />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        onPress={() => openEdit(item)}
                        style={styles.iconBtn}
                        accessibilityLabel={isRTL ? 'تعديل' : 'Edit'}
                    >
                        <AppIcon name="file" size={18} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => handleDelete(item.id)}
                        style={styles.iconBtn}
                        accessibilityLabel={isRTL ? 'حذف' : 'Delete'}
                    >
                        <AppIcon name="delete" size={18} color={colors.error} />
                    </TouchableOpacity>
                </View>
            </View>
            <Text style={[styles.addressText, isRTL && styles.textRTL]}>{item.street}, {item.city}</Text>
            {item.building ? (
                <Text style={[styles.addressText, isRTL && styles.textRTL]}>
                    {isRTL ? `مبنى: ${item.building}` : `Building: ${item.building}`}
                    {item.floor ? (isRTL ? ` | طابق: ${item.floor}` : ` | Floor: ${item.floor}`) : ''}
                    {item.apartment ? (isRTL ? ` | شقة: ${item.apartment}` : ` | Apt: ${item.apartment}`) : ''}
                </Text>
            ) : null}
            {item.phone ? <Text style={[styles.addressText, isRTL && styles.textRTL, { writingDirection: 'ltr' }]}>📞 {item.phone}</Text> : null}
            {item.notes ? <Text style={[styles.notesText, isRTL && styles.textRTL]}>{item.notes}</Text> : null}
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <CustomerSubpageHeader
                title={isRTL ? 'العناوين المحفوظة' : 'Saved Addresses'}
                onBack={() => navigation.goBack()}
                rightAction={
                    <TouchableOpacity
                        style={styles.headerAddBtn}
                        onPress={openAdd}
                        accessibilityLabel={isRTL ? 'إضافة عنوان جديد' : 'Add New Address'}
                    >
                        <AppIcon name="plus" size={18} color="#6537C0" />
                    </TouchableOpacity>
                }
            />

            {/* Body */}
            {loading && !refreshing ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : error ? (
                <View style={styles.emptyContainer}>
                    <AppIcon name="warning" size={48} color={colors.error} />
                    <Text style={styles.emptyText}>{isRTL ? 'حدث خطأ' : 'Failed to load addresses'}</Text>
                    <TouchableOpacity onPress={loadAddresses} style={styles.retryBtn}>
                        <Text style={styles.retryText}>{isRTL ? 'إعادة المحاولة' : 'Retry'}</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={addresses}
                    keyExtractor={(item) => item.id}
                    renderItem={renderAddress}
                    contentContainerStyle={[styles.listContent, { paddingBottom: scrollBottomPadding + 90 }]}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <AppIcon name="location" size={48} color={colors.textSecondary} />
                            <Text style={styles.emptyText}>
                                {isRTL ? 'لا توجد عناوين محفوظة' : 'No saved addresses yet'}
                            </Text>
                            <Text style={styles.emptyHint}>
                                {isRTL ? 'اضغط "+" لإضافة عنوان جديد' : 'Tap "+" to add your first address'}
                            </Text>
                        </View>
                    }
                    onRefresh={() => { setRefreshing(true); loadAddresses(); }}
                    refreshing={refreshing}
                />
            )}

            {/* FAB */}
            <View style={[styles.fabContainer, { paddingBottom: scrollBottomPadding + spacing.md }]}>
                <TouchableOpacity style={[styles.fab, isRTL && styles.rowReverse]} onPress={openAdd} accessibilityLabel={isRTL ? 'إضافة عنوان' : 'Add Address'}>
                    <AppIcon name="plus" size={22} color="#FFF" />
                    <Text style={styles.fabText}>{isRTL ? 'إضافة عنوان جديد' : 'Add New Address'}</Text>
                </TouchableOpacity>
            </View>

            {/* ADD / EDIT Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={styles.modalSheet}>
                        {/* Modal Header */}
                        <View style={[styles.modalHeader, isRTL && styles.rowReverse]}>
                            <Text style={styles.modalTitle}>
                                {editingId
                                    ? (isRTL ? 'تعديل العنوان' : 'Edit Address')
                                    : (isRTL ? 'إضافة عنوان جديد' : 'Add New Address')}
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.iconBtn}>
                                <AppIcon name="close" size={22} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
                            {/* Label */}
                            <Text style={[styles.fieldLabel, isRTL && styles.textRTL]}>{isRTL ? 'التسمية (مثال: المنزل، العمل)' : 'Label (e.g. Home, Work)'}</Text>
                            <TextInput
                                style={[styles.input, isRTL && styles.inputRtl]}
                                value={form.title}
                                onChangeText={(v) => setField('title', v)}
                                placeholder={isRTL ? 'المنزل' : 'Home'}
                                placeholderTextColor="#9CA3AF"
                                textAlign={isRTL ? 'right' : 'left'}
                            />

                            <Text style={[styles.fieldLabel, isRTL && styles.textRTL]}>{isRTL ? 'الشارع *' : 'Street *'}</Text>
                            <TextInput
                                style={[styles.input, isRTL && styles.inputRtl]}
                                value={form.street}
                                onChangeText={(v) => setField('street', v)}
                                placeholder={isRTL ? 'اسم الشارع' : 'Street name'}
                                placeholderTextColor="#9CA3AF"
                                textAlign={isRTL ? 'right' : 'left'}
                            />

                            <Text style={[styles.fieldLabel, isRTL && styles.textRTL]}>{isRTL ? 'المدينة *' : 'City *'}</Text>
                            <TextInput
                                style={[styles.input, isRTL && styles.inputRtl]}
                                value={form.city}
                                onChangeText={(v) => setField('city', v)}
                                placeholder={isRTL ? 'اسم المدينة' : 'City'}
                                placeholderTextColor="#9CA3AF"
                                textAlign={isRTL ? 'right' : 'left'}
                            />

                            <View style={[styles.row, isRTL && styles.rowReverse]}>
                                <View style={styles.flex1}>
                                    <Text style={[styles.fieldLabel, isRTL && styles.textRTL]}>{isRTL ? 'المبنى' : 'Building'}</Text>
                                    <TextInput
                                        style={[styles.input, isRTL && styles.inputRtl]}
                                        value={form.building}
                                        onChangeText={(v) => setField('building', v)}
                                        placeholder={isRTL ? 'رقم المبنى' : 'Building #'}
                                        placeholderTextColor="#9CA3AF"
                                        textAlign={isRTL ? 'right' : 'left'}
                                    />
                                </View>
                                <View style={[styles.flex1, isRTL ? { marginRight: spacing.sm } : { marginLeft: spacing.sm }]}>
                                    <Text style={[styles.fieldLabel, isRTL && styles.textRTL]}>{isRTL ? 'الطابق' : 'Floor'}</Text>
                                    <TextInput
                                        style={[styles.input, isRTL && styles.inputRtl]}
                                        value={form.floor}
                                        onChangeText={(v) => setField('floor', v)}
                                        placeholder={isRTL ? 'الطابق' : 'Floor'}
                                        placeholderTextColor="#9CA3AF"
                                        textAlign={isRTL ? 'right' : 'left'}
                                    />
                                </View>
                            </View>

                            <Text style={[styles.fieldLabel, isRTL && styles.textRTL]}>{isRTL ? 'رقم الشقة / الوحدة' : 'Apartment / Unit'}</Text>
                            <TextInput
                                style={[styles.input, isRTL && styles.inputRtl]}
                                value={form.apartment}
                                onChangeText={(v) => setField('apartment', v)}
                                placeholder={isRTL ? 'رقم الشقة' : 'Apt number'}
                                placeholderTextColor="#9CA3AF"
                                textAlign={isRTL ? 'right' : 'left'}
                            />

                            <Text style={[styles.fieldLabel, isRTL && styles.textRTL]}>{isRTL ? 'رقم الهاتف' : 'Phone'}</Text>
                            <TextInput
                                style={[styles.input, { textAlign: 'left', writingDirection: 'ltr' }]}
                                value={form.phone}
                                onChangeText={(v) => setField('phone', v)}
                                placeholder="+966 5x xxx xxxx"
                                placeholderTextColor="#9CA3AF"
                                keyboardType="phone-pad"
                            />

                            <Text style={[styles.fieldLabel, isRTL && styles.textRTL]}>{isRTL ? 'ملاحظات للتوصيل' : 'Delivery Notes'}</Text>
                            <TextInput
                                style={[styles.input, styles.textArea, isRTL && styles.inputRtl]}
                                value={form.notes}
                                onChangeText={(v) => setField('notes', v)}
                                placeholder={isRTL ? 'أي تعليمات إضافية...' : 'Any extra instructions...'}
                                placeholderTextColor="#9CA3AF"
                                multiline
                                numberOfLines={3}
                                textAlign={isRTL ? 'right' : 'left'}
                            />

                            {/* Set as Default toggle */}
                            <TouchableOpacity
                                style={[styles.defaultToggle, isRTL && styles.rowReverse]}
                                onPress={() => setField('isDefault', !form.isDefault)}
                                accessibilityRole="checkbox"
                            >
                                <View style={[styles.checkbox, form.isDefault && styles.checkboxActive]}>
                                    {form.isDefault && <AppIcon name="check" size={14} color="#FFF" />}
                                </View>
                                <Text style={styles.defaultToggleLabel}>
                                    {isRTL ? 'تعيين كعنوان افتراضي' : 'Set as default address'}
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>

                        {/* Modal Footer */}
                        <View style={[styles.modalFooter, isRTL && styles.rowReverse]}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                                <Text style={styles.cancelText}>{isRTL ? 'إلغاء' : 'Cancel'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                                onPress={handleSave}
                                disabled={saving}
                            >
                                {saving
                                    ? <ActivityIndicator size="small" color="#FFF" />
                                    : <Text style={styles.saveText}>{isRTL ? 'حفظ' : 'Save'}</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAF9FC' },
    rowReverse: { flexDirection: 'row-reverse' },
    textRTL: { textAlign: 'right' },
    headerAddBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F1ECFD',
        borderWidth: 1,
        borderColor: '#E7DDFC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { padding: 16 },
    addressCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    addressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, flex: 1 },
    title: { fontSize: 16, fontWeight: '700', color: '#1D035F', fontFamily: 'Cairo-Bold' },
    defaultBadge: {
        backgroundColor: '#F1ECFD',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    defaultText: { fontSize: 10, fontWeight: '600', color: colors.primary },
    actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    iconBtn: { padding: 4 },
    addressText: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: 2 },
    notesText: { fontSize: fontSize.xs, color: '#9CA3AF', fontStyle: 'italic', marginTop: 4 },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: spacing.md },
    emptyText: { fontSize: fontSize.md, color: colors.textSecondary, fontWeight: '600' },
    emptyHint: { fontSize: fontSize.sm, color: '#9CA3AF' },
    retryBtn: { paddingHorizontal: 24, paddingVertical: 10, backgroundColor: colors.primary, borderRadius: 12 },
    retryText: { color: '#FFF', fontWeight: '600' },
    fabContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: spacing.md,
    },
    fab: {
        backgroundColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md,
        borderRadius: 16,
        gap: spacing.sm,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    fabText: { color: '#FFF', fontSize: fontSize.md, fontWeight: '600' },

    // Modal
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    modalSheet: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '92%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
    modalBody: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
    fieldLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginTop: spacing.sm, marginBottom: 4 },
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        paddingHorizontal: spacing.md,
        paddingVertical: 10,
        fontSize: fontSize.md,
        color: colors.text,
        backgroundColor: '#FAFAFA',
    },
    inputRtl: { textAlign: 'right' },
    textArea: { height: 80, textAlignVertical: 'top' },
    row: { flexDirection: 'row' },
    flex1: { flex: 1 },
    defaultToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.lg,
        marginBottom: spacing.md,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxActive: { backgroundColor: colors.primary },
    defaultToggleLabel: { fontSize: fontSize.md, color: colors.text, fontWeight: '500' },
    modalFooter: {
        flexDirection: 'row',
        gap: spacing.sm,
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
    },
    cancelText: { fontSize: fontSize.md, fontWeight: '600', color: colors.textSecondary },
    saveBtn: {
        flex: 2,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: colors.primary,
        alignItems: 'center',
    },
    saveBtnDisabled: { opacity: 0.6 },
    saveText: { fontSize: fontSize.md, fontWeight: '700', color: '#FFF' },
});
