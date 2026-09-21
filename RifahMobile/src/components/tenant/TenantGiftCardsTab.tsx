import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText as Text } from '../ThemedText';
import { AppIcon } from '../AppIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatRiyal } from '../../utils/currency';

export interface TenantGiftPackage {
    id: string;
    title?: string | null;
    description?: string | null;
    title_en?: string;
    title_ar?: string;
    description_en?: string | null;
    description_ar?: string | null;
    priceAmount: number;
    walletCreditAmount: number;
    bonusAmount?: number;
    discountPercent?: number | string | null;
    expirationPreset?: string | null;
    endsAt?: string | null;
    createdAt?: string | null;
    imageUrl?: string | null;
}

export interface TenantGiftCardsTabProps {
    giftPackages: TenantGiftPackage[];
    onSelectGiftPackage: (pkg: TenantGiftPackage) => void;
    getImageUrl?: (url?: string | null) => string;
}

export function TenantGiftCardsTab({
    giftPackages,
    onSelectGiftPackage,
    getImageUrl,
}: TenantGiftCardsTabProps) {
    const { isRTL } = useLanguage();

    const getLocalizedTitle = (pkg: TenantGiftPackage) => {
        if (isRTL) {
            return pkg.title_ar || pkg.title || pkg.title_en || (isRTL ? 'بطاقة إهداء' : 'Gift Card');
        }
        return pkg.title_en || pkg.title || pkg.title_ar || 'Gift Card';
    };

    return (
        <View style={styles.container}>
            {giftPackages.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                    <AppIcon name="card_giftcard" size={48} color="#A379E2" />
                    <Text style={[styles.emptyStateTitle, isRTL && styles.textRTL]}>
                        {isRTL ? 'لا تتوفر بطاقات إهداء حالياً' : 'No gift cards available right now'}
                    </Text>
                    <Text style={[styles.emptyStateSubtitle, isRTL && styles.textRTL]}>
                        {isRTL
                            ? 'يرجى مراجعة هذه الصفحة لاحقاً للاطلاع على العروض الحصرية'
                            : 'Please check back later for exclusive gift card offerings'}
                    </Text>
                </View>
            ) : (
                <View style={styles.listContainer}>
                    {giftPackages.map((pkg) => {
                        const title = getLocalizedTitle(pkg);
                        const price = Number(pkg.priceAmount || 0).toFixed(0);
                        const imageSource = pkg.imageUrl && getImageUrl ? getImageUrl(pkg.imageUrl) : pkg.imageUrl;

                        return (
                            <View
                                key={pkg.id}
                                style={[styles.giftCard, isRTL && styles.rowRTL]}
                            >
                                <View style={[styles.giftInfoGroup, isRTL && styles.rowRTL]}>
                                    {imageSource ? (
                                        <Image
                                            source={{ uri: imageSource }}
                                            style={styles.thumbnailImage}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <LinearGradient
                                            colors={['#6537C0', '#1D035F']}
                                            style={styles.thumbnailPlaceholder}
                                        >
                                            <AppIcon name="card_giftcard" size={24} color="#FFFFFF" />
                                        </LinearGradient>
                                    )}

                                    <View style={styles.textColumn}>
                                        <Text
                                            style={[styles.giftTitle, isRTL && styles.textRTL]}
                                            numberOfLines={1}
                                        >
                                            {title}
                                        </Text>
                                        <Text style={[styles.giftPrice, isRTL && styles.textRTL]}>
                                            {formatRiyal(price, isRTL ? 'ar' : 'en')}
                                        </Text>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={styles.selectButton}
                                    onPress={() => onSelectGiftPackage(pkg)}
                                    activeOpacity={0.85}
                                >
                                    <Text
                                        style={[
                                            styles.selectButtonText,
                                            isRTL && styles.textRTL,
                                        ]}
                                    >
                                        {isRTL ? 'اختيار' : 'Select'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        );
                    })}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 32,
    },
    listContainer: {
        gap: 12,
    },
    rowRTL: {
        flexDirection: 'row-reverse',
    },
    textRTL: {
        textAlign: 'right',
        fontFamily: 'Cairo-Regular',
    },
    giftCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    giftInfoGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        flex: 1,
        minWidth: 0,
    },
    thumbnailImage: {
        width: 64,
        height: 64,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        backgroundColor: '#FAF9FC',
    },
    thumbnailPlaceholder: {
        width: 64,
        height: 64,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textColumn: {
        flex: 1,
        minWidth: 0,
        gap: 4,
    },
    giftTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1D035F',
    },
    giftPrice: {
        fontSize: 16,
        fontWeight: '700',
        color: '#6537C0',
    },
    currencyText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#716B88',
    },
    selectButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: '#6537C0',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#6537C0',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
        elevation: 2,
    },
    selectButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    emptyStateContainer: {
        paddingVertical: 48,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    emptyStateTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1D035F',
        marginTop: 8,
    },
    emptyStateSubtitle: {
        fontSize: 13,
        color: '#716B88',
        textAlign: 'center',
    },
});
