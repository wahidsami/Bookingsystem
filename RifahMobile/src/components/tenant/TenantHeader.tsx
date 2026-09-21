import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText as Text } from '../ThemedText';
import { AppIcon } from '../AppIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import { useScreenSafeArea } from '../../utils/safeArea';
import { Tenant } from '../../api/client';

export interface TenantHeaderProps {
    tenant: Tenant;
    coverUri: string;
    logoUri: string;
    rating: string | null;
    hoursStatus: string;
    isOpen: boolean;
    businessLabel: string;
    serviceCartItemCount?: number;
    cartItemCount?: number;
    onBack: () => void;
    onCartPress: () => void;
}

export function TenantHeader({
    tenant,
    coverUri,
    logoUri,
    rating,
    hoursStatus,
    isOpen,
    businessLabel,
    serviceCartItemCount = 0,
    cartItemCount,
    onBack,
    onCartPress,
}: TenantHeaderProps) {
    const { isRTL } = useLanguage();
    const { topInset } = useScreenSafeArea();
    const effectiveCartCount = cartItemCount !== undefined ? cartItemCount : serviceCartItemCount;

    const locationLabel = [tenant.city, tenant.country].filter(Boolean).join(', ');
    const initialLetter = (tenant.name || 'S').trim().charAt(0).toUpperCase();

    return (
        <View style={styles.headerContainer}>
            {/* 1. Cover Image (148px) with subtle dark gradient vignette */}
            <View style={styles.coverWrapper}>
                <ImageBackground
                    source={{ uri: coverUri }}
                    style={styles.coverImage}
                    resizeMode="cover"
                >
                    <LinearGradient
                        colors={['rgba(0, 0, 0, 0.45)', 'transparent', 'rgba(0, 0, 0, 0.25)']}
                        style={styles.coverGradient}
                    >
                        <View style={[styles.topActionsRow, isRTL && styles.rowReverse, { paddingTop: Math.max(topInset, 12) }]}>
                            {/* 40x40 Circular Blurred/Solid Back Button: Left in LTR, Right in RTL */}
                            <TouchableOpacity
                                onPress={onBack}
                                style={styles.circularActionButton}
                                activeOpacity={0.85}
                                accessibilityLabel="Back"
                            >
                                <AppIcon
                                    name={isRTL ? 'arrow_forward' : 'arrow_back'}
                                    size={20}
                                    color="#1D035F"
                                />
                            </TouchableOpacity>

                            {/* 40x40 Circular Cart Button: Right in LTR, Left in RTL */}
                            <TouchableOpacity
                                onPress={onCartPress}
                                style={styles.circularActionButton}
                                activeOpacity={0.85}
                                accessibilityLabel="Cart"
                            >
                                <AppIcon name="cart" size={20} color="#1D035F" />
                                {effectiveCartCount > 0 && (
                                    <View style={[styles.cartBadge, isRTL && styles.cartBadgeRTL]}>
                                        <Text style={styles.cartBadgeText}>
                                            {effectiveCartCount > 9 ? '9+' : effectiveCartCount}
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>
                </ImageBackground>
            </View>

            {/* 2. Tenant Identity Section (Overlapping Logo & Metadata) */}
            <View style={styles.identityContainer}>
                {/* Logo & Status Badges Row */}
                <View style={[styles.logoAndBadgesRow, isRTL && styles.rowReverse]}>
                    {/* Elevated Logo: 72x72 rounded-2xl with #E7DDFC border overlapping -mt-9 */}
                    <View style={styles.logoContainer}>
                        {logoUri ? (
                            <Image
                                source={{ uri: logoUri }}
                                style={styles.logoImage}
                                resizeMode="cover"
                            />
                        ) : (
                            <LinearGradient
                                colors={['#6537C0', '#1D035F']}
                                style={styles.logoFallback}
                            >
                                <Text style={styles.logoMonogram}>{initialLetter}</Text>
                            </LinearGradient>
                        )}
                    </View>

                    {/* Status & Rating Badges */}
                    <View style={[styles.badgesRow, isRTL && styles.rowReverse]}>
                        {/* Open/Closed Badge */}
                        <View style={[styles.statusBadge, isRTL && styles.rowReverse]}>
                            <View
                                style={[
                                    styles.statusDot,
                                    isRTL ? styles.statusDotRTL : styles.statusDotLTR,
                                    { backgroundColor: isOpen ? '#10B981' : '#9CA3AF' },
                                ]}
                            />
                            <Text style={styles.statusBadgeText}>
                                {isOpen ? (isRTL ? 'مفتوح الآن' : 'Open Now') : hoursStatus}
                            </Text>
                        </View>

                        {/* Rating Badge */}
                        {rating ? (
                            <View style={[styles.ratingBadge, isRTL && styles.rowReverse]}>
                                <AppIcon name="star" size={15} color="#F59E0B" />
                                <Text style={styles.ratingBadgeText}>{rating}</Text>
                            </View>
                        ) : null}
                    </View>
                </View>

                {/* Tenant Name: 20px bold #1D035F */}
                <Text style={[styles.tenantName, isRTL && styles.textRTL]} numberOfLines={1}>
                    {tenant.name}
                </Text>

                {/* Category & City Subtitle */}
                <View style={[styles.subtitleRow, isRTL && styles.rowReverse]}>
                    {businessLabel ? (
                        <Text style={[styles.subtitleText, isRTL && styles.textRTL]}>{businessLabel}</Text>
                    ) : null}
                    {businessLabel && locationLabel ? (
                        <Text style={styles.subtitleBullet}>•</Text>
                    ) : null}
                    {locationLabel ? (
                        <Text style={[styles.subtitleText, isRTL && styles.textRTL]}>{locationLabel}</Text>
                    ) : null}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    headerContainer: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E7DDFC',
    },
    coverWrapper: {
        width: '100%',
        height: 148,
        backgroundColor: '#1D035F',
        overflow: 'hidden',
    },
    coverImage: {
        width: '100%',
        height: '100%',
    },
    coverGradient: {
        flex: 1,
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    topActionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    circularActionButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderWidth: 1,
        borderColor: '#E7DDFC',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
        elevation: 3,
    },
    cartBadge: {
        position: 'absolute',
        top: -3,
        right: -3,
        backgroundColor: '#FF4D4F',
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
    },
    cartBadgeRTL: {
        right: undefined,
        left: -3,
    },
    cartBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    identityContainer: {
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    logoAndBadgesRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginTop: -36, // -mt-9 in Stitch (overlaps cover)
        marginBottom: 10,
    },
    logoContainer: {
        width: 72,
        height: 72,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        padding: 5,
        borderWidth: 1,
        borderColor: '#E7DDFC',
        shadowColor: '#1D035F',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 4,
        zIndex: 10,
    },
    logoImage: {
        width: '100%',
        height: '100%',
        borderRadius: 12,
    },
    logoFallback: {
        width: '100%',
        height: '100%',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoMonogram: {
        color: '#FFFFFF',
        fontSize: 28,
        fontWeight: 'bold',
        fontFamily: 'Cairo-Bold',
    },
    badgesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingBottom: 4,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 4.5,
        borderRadius: 999,
        backgroundColor: 'rgba(231, 221, 252, 0.6)',
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    statusDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
    },
    statusDotLTR: {
        marginRight: 6,
    },
    statusDotRTL: {
        marginLeft: 6,
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1D035F',
        fontFamily: 'Cairo-SemiBold',
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 9,
        paddingVertical: 4.5,
        borderRadius: 999,
        backgroundColor: '#FAF9FC',
        borderWidth: 1,
        borderColor: '#E7DDFC',
    },
    ratingBadgeText: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
    },
    tenantName: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1D035F',
        fontFamily: 'Cairo-Bold',
        letterSpacing: -0.3,
        marginTop: 2,
    },
    subtitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 3,
    },
    subtitleText: {
        fontSize: 13.5,
        color: '#716B88',
        fontFamily: 'Cairo-Regular',
    },
    subtitleBullet: {
        color: '#E7DDFC',
        fontSize: 12,
    },
    rowReverse: {
        flexDirection: 'row-reverse',
    },
    textRTL: {
        textAlign: 'right',
        writingDirection: 'rtl',
    },
});
