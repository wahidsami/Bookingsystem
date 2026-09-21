import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useScreenSafeArea } from '../../utils/safeArea';
import { colors, layout, spacing } from '../../theme';
import { UserAvatar } from '../UserAvatar';
import { useAppSession } from '../../contexts/AppSessionContext';
import { useLanguage } from '../../contexts/LanguageContext';

export function AccountHeader({ navigation }: { navigation: any }) {
  const { topInset } = useScreenSafeArea();
  const { user, isAuthenticated, showLogin } = useAppSession();
  const { t } = useLanguage();
  const displayName = user ? `${user.firstName} ${user.lastName}` : t('guestTitle');

  const onPressProfile = () => {
    if (!isAuthenticated) {
      showLogin();
      return;
    }
    navigation?.navigate('Profile');
  };

  return (
    <View style={[styles.container, { paddingTop: topInset }] }>
      <Image source={require('../../../assets/barspa_logo.png')} style={styles.logo} resizeMode="contain" />
      <TouchableOpacity onPress={onPressProfile} style={styles.avatarTouchable}>
        <UserAvatar
          firstName={user?.firstName}
          lastName={user?.lastName}
          profileImage={user?.profileImage}
          size={48}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: layout.components.headerHeight,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  logo: {
    height: 32,
    width: 120,
    // width is flexible; keep aspect ratio
  },
  avatarTouchable: {
    // optional padding/margin
  },
});
