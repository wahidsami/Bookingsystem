import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { ThemedText as Text } from '../ThemedText';
import { colors, spacing, fontSize, borderRadius } from '../../theme/colors';
import { useLanguage } from '../../contexts/LanguageContext';
import { api, ServiceCategory } from '../../api/client';
import { SkeletonCard } from './SkeletonCard';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = (width - spacing.lg * 2 - spacing.md * 2) / 3;

interface CategoriesGridProps {
    navigation: any;
}

export function CategoriesGrid({ navigation }: CategoriesGridProps) {
    const { t, isRTL } = useLanguage();
    const [categories, setCategories] = useState<ServiceCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => { loadCategories(); }, []);

    const loadCategories = async () => {
        setLoading(true);
        setError(false);
        try {
            const data = await api.getCategories();
            setCategories(data.slice(0, 6)); // Show 6 (2 rows x 3 cols)
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.grid}>
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <SkeletonCard key={i} variant="category" />
                ))}
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.errorContainer}>
                <TouchableOpacity onPress={loadCategories} style={styles.retryButton}>
                    <Text style={styles.retryText}>{t('retry')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const data = categories.length > 0 ? categories : [
        { id: 'p1', name_en: 'Hair', name_ar: 'شعر', slug: 'hair', icon: '💇', sortOrder: 1, isActive: true },
        { id: 'p2', name_en: 'Nails', name_ar: 'أظافر', slug: 'nails', icon: '💅', sortOrder: 2, isActive: true },
        { id: 'p3', name_en: 'Spa', name_ar: 'سبا', slug: 'spa', icon: '🧖', sortOrder: 3, isActive: true },
        { id: 'p4', name_en: 'Massage', name_ar: 'تدليك', slug: 'massage', icon: '💆', sortOrder: 4, isActive: true },
        { id: 'p5', name_en: 'Makeup', name_ar: 'مكياج', slug: 'makeup', icon: '💄', sortOrder: 5, isActive: true },
        { id: 'p6', name_en: 'Barbering', name_ar: 'حلاقة', slug: 'barbering', icon: '💈', sortOrder: 6, isActive: true },
    ];

    return (
        <View style={styles.grid}>
            {data.map(category => (
                <TouchableOpacity
                    key={category.id}
                    style={styles.item}
                    activeOpacity={0.7}
                    onPress={() => console.log('Category:', category.slug)}
                >
                    <View style={styles.circle}>
                        <Text style={styles.icon}>{category.icon || '📂'}</Text>
                    </View>
                    <Text style={styles.label} numberOfLines={1}>
                        {isRTL ? category.name_ar : category.name_en}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: spacing.lg,
        gap: spacing.md,
    },
    item: {
        width: ITEM_WIDTH,
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    circle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#F3E8FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.xs,
    },
    icon: {
        fontSize: 28,
    },
    label: {
        fontSize: fontSize.xs,
        fontWeight: '600',
        color: colors.text,
        textAlign: 'center',
    },
    errorContainer: {
        alignItems: 'center',
        padding: spacing.md,
    },
    retryButton: {
        backgroundColor: colors.backgroundGray,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
    },
    retryText: {
        color: colors.primary,
        fontWeight: '600',
    },
});
