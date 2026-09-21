import React from 'react';
import {
    Modal,
    View,
    StyleSheet,
    TouchableOpacity,
    TouchableWithoutFeedback,
    ViewStyle,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, spacing } from '../../theme';

export interface ModalContainerProps {
    visible: boolean;
    onClose: () => void;
    children: React.ReactNode;
    style?: ViewStyle;
    contentStyle?: ViewStyle;
    showGrabber?: boolean;
}

export function ModalContainer({
    visible,
    onClose,
    children,
    style,
    contentStyle,
    showGrabber = true,
}: ModalContainerProps) {
    const insets = useSafeAreaInsets();
    const bottomPadding = Math.max(insets.bottom, 16);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.overlay}
            >
                <TouchableWithoutFeedback onPress={onClose}>
                    <View style={styles.backdrop} />
                </TouchableWithoutFeedback>

                <View
                    style={[
                        styles.sheet,
                        { paddingBottom: bottomPadding },
                        contentStyle,
                    ]}
                >
                    {showGrabber ? (
                        <View style={styles.grabberContainer}>
                            <View style={styles.grabber} />
                        </View>
                    ) : null}
                    {children}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: colors.overlay,
    },
    backdrop: {
        flex: 1,
    },
    sheet: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: layout.radius.xxl,
        borderTopRightRadius: layout.radius.xxl,
        paddingTop: spacing.md,
        paddingHorizontal: spacing.lg,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: colors.borderSubtle,
        ...layout.shadows.lg,
    },
    grabberContainer: {
        alignItems: 'center',
        paddingBottom: spacing.md,
    },
    grabber: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.borderSubtle,
    },
});
