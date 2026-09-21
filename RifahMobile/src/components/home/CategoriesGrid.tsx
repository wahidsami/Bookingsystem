import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { ThemedText as Text } from '../ThemedText';
import { colors, spacing, fontSize, borderRadius } from '../../theme/colors';
import { useLanguage } from '../../contexts/LanguageContext';
import { api, ServiceCategory } from '../../api/client';
import { SkeletonCard } from './SkeletonCard';
import { AppIcon } from '../AppIcon';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = (width - spacing.lg * 2) / 4;

interface CategoriesGridProps {
    navigation: any;
}

function getCategoryIcon(slug?: string, name?: string): any {
    const s = (slug || name || '').toLowerCase();
    if (s.includes('barber')) return 'user';
    if (s.includes('beauty')) return 'sparkles';
    if (s.includes('salon')) return 'sparkles';
    if (s.includes('spa')) return 'sparkles';
    if (s.includes('massage')) return 'sparkles';
    if (s.includes('nail')) return 'star';
    if (s.includes('hair')) return 'sparkles';
    if (s.includes('skin') || s.includes('care')) return 'sparkles';
    return 'folder';
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
            // Render the actual categories returned by the backend in a 4-column grid
            setCategories(data);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.grid}>
                {[1, 2, 3, 4].map(i => (
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

    if (categories.length === 0) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.emptyText}>{t('noCategoriesAvailable')}</Text>
            </View>
        );
    }

    return (
        <View style={[styles.grid, isRTL && styles.gridRTL]}>
            {categories.map(category => {
                const iconName = getCategoryIcon(category.slug, category.name_en);
                const categoryTitle = isRTL ? category.name_ar || category.name_en : category.name_en || category.name_ar;

                return (
                    <TouchableOpacity
                        key={category.id}
                        style={styles.item}
                        activeOpacity={0.75}
                        onPress={() =>
                            navigation.navigate('Browse', {
                                category: category.slug,
                                title: categoryTitle,
                            })
                        }
                    >
                        {/* Stitch 56x56 rounded-2xl square icon container */}
                        <View style={styles.squareContainer}>
                            <AppIcon name={iconName} size={24} color="#6537C0" />
                        </View>
                        <Text style={styles.label} numberOfLines={1}>
                            {categoryTitle}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: spacing.lg,
    },
    gridRTL: {
        flexDirection: 'row-reverse',
    },
    item: {
        width: ITEM_WIDTH,
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    squareContainer: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: '#FAF9FC',
        borderWidth: 1,
        borderColor: '#E7DDFC',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    label: {
        fontSize: 12,
        fontWeight: '500',
        color: '#1D035F',
        textAlign: 'center',
        paddingHorizontal: 2,
    },
    errorContainer: {
        alignItems: 'center',
        padding: spacing.md,
    },
    emptyText: {
        color: 'rgba(29, 3, 95, 0.6)',
        fontSize: fontSize.sm,
    },
    retryButton: {
        backgroundColor: '#FAF9FC',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    retryText: {
        color: colors.primary,
        fontWeight: '600',
    },
});
