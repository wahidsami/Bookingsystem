import React, { useMemo, useState } from 'react';
import { Image, ImageStyle, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { getImageUrl } from '../api/client';
import { colors } from '../theme/colors';

interface UserAvatarProps {
    firstName?: string;
    lastName?: string;
    profileImage?: string | null;
    size?: number;
    backgroundColor?: string;
    textColor?: string;
    style?: StyleProp<ViewStyle>;
}

export function UserAvatar({
    firstName,
    lastName,
    profileImage,
    size = 48,
    backgroundColor = colors.primary,
    textColor = '#FFFFFF',
    style,
}: UserAvatarProps) {
    const [imageFailed, setImageFailed] = useState(false);

    const initials = useMemo(() => {
        const first = `${firstName || ''}`.trim().charAt(0);
        const last = `${lastName || ''}`.trim().charAt(0);
        return `${first}${last}`.trim().toUpperCase() || 'R';
    }, [firstName, lastName]);

    const imageUrl = profileImage ? getImageUrl(profileImage) || profileImage : undefined;
    const showImage = !!imageUrl && !imageFailed;

    return (
        <View
            style={[
                styles.container,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor,
                },
                style,
            ]}
        >
            {showImage ? (
                <Image
                    source={{ uri: imageUrl }}
                    style={[styles.image, { borderRadius: size / 2 } as StyleProp<ImageStyle>]}
                    onError={() => setImageFailed(true)}
                />
            ) : (
                <Text style={[styles.initials, { color: textColor, fontSize: Math.max(14, size * 0.34) }]}>
                    {initials}
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    initials: {
        fontWeight: '700',
    },
});
