import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, I18nManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface AppHeaderProps {
    title: string;
    showBack?: boolean;
    onBackPress?: () => void;
    rightAction?: React.ReactNode;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ title, showBack = false, onBackPress, rightAction }) => {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const handleBack = () => {
        if (onBackPress) {
            onBackPress();
        } else {
            router.back();
        }
    };

    return (
        <View style={[
            styles.header, 
            { 
                paddingTop: Platform.OS === 'android' ? 8 : 12,
                backgroundColor: isDark ? '#1f2937' : '#ffffff',
                borderBottomColor: isDark ? '#374151' : '#f3f4f6'
            }
        ]}>
            <View style={styles.leftContainer}>
                {showBack && (
                    <TouchableOpacity 
                        onPress={handleBack} 
                        style={styles.backButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons 
                            name="arrow-back" 
                            size={24} 
                            color={isDark ? '#f3f4f6' : '#111827'} 
                            style={{ transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] }}
                        />
                    </TouchableOpacity>
                )}
            </View>
            
            <View style={styles.titleContainer}>
                <Text style={[styles.title, { color: isDark ? '#ffffff' : '#111827' }]} numberOfLines={1}>
                    {title}
                </Text>
            </View>

            <View style={styles.rightContainer}>
                {rightAction}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
    },
    leftContainer: {
        width: 40,
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    titleContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rightContainer: {
        width: 40,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    backButton: {
        padding: 4,
        marginLeft: -4,
    },
    title: {
        fontSize: 17,
        fontWeight: '600',
        fontFamily: 'Cairo_600SemiBold',
    }
});
