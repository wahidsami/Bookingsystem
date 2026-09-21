import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

export function withSafeArea<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  backgroundColor?: string
) {
  return function SafeAreaWrapper(props: P) {
    return (
      <SafeAreaView 
        style={[styles.container, backgroundColor ? { backgroundColor } : undefined]} 
        edges={['bottom', 'left', 'right']}
      >
        <WrappedComponent {...props} />
      </SafeAreaView>
    );
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background, // Default to app background to avoid white strips
  }
});
