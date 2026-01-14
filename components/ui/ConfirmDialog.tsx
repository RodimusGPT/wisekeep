import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/Colors';
import { useAppStore } from '@/store';
import { useTheme } from '@/hooks';
import { getFontSize } from '@/types';
import { BigButton } from './BigButton';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'primary';
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  variant = 'danger',
}: ConfirmDialogProps) {
  const { colors } = useTheme();
  const textSize = useAppStore((state) => state.settings.textSize);

  const { card: backgroundColor, text: textColor, textSecondary: secondaryColor } = colors;

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onConfirm();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable>
          <View style={[styles.dialog, { backgroundColor }]}>
            <Text
              style={[
                styles.title,
                { color: textColor, fontSize: getFontSize('header', textSize) },
              ]}
            >
              {title}
            </Text>

            <Text
              style={[
                styles.message,
                { color: secondaryColor, fontSize: getFontSize('body', textSize) },
              ]}
            >
              {message}
            </Text>

            <View style={styles.buttons}>
              <BigButton
                title={cancelText}
                onPress={onCancel}
                variant="secondary"
                style={styles.button}
              />
              <BigButton
                title={confirmText}
                onPress={handleConfirm}
                variant={variant}
                style={styles.button}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 24,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
  },
});
