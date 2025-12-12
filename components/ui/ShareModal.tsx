import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  useColorScheme,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { Colors } from '@/constants/Colors';
import { useAppStore } from '@/store';
import { useI18n } from '@/hooks';
import { Recording, getFontSize } from '@/types';
import { BigButton } from './BigButton';

interface ShareModalProps {
  visible: boolean;
  recording: Recording;
  onClose: () => void;
  onCopied?: () => void;
}

export function ShareModal({ visible, recording, onClose, onCopied }: ShareModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const textSize = useAppStore((state) => state.settings.textSize);
  const { t } = useI18n();

  const backgroundColor = isDark ? Colors.cardDark : Colors.card;
  const textColor = isDark ? Colors.textDark : Colors.text;

  // Generate summary text for sharing
  const getSummaryText = (): string => {
    if (!recording.summary) return '';
    return recording.summary.map((point, i) => `• ${point}`).join('\n');
  };

  // Generate notes text for sharing
  const getNotesText = (): string => {
    if (!recording.notes) return '';
    return recording.notes.map((line) => {
      const speaker = line.speaker ? `[${t.speaker} ${line.speaker}] ` : '';
      return `${speaker}${line.text}`;
    }).join('\n\n');
  };

  const handleShareSummary = async () => {
    try {
      const text = getSummaryText();
      await Clipboard.setStringAsync(text);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onCopied?.();
      onClose();
    } catch (error) {
      console.error('Failed to copy summary:', error);
    }
  };

  const handleShareNotes = async () => {
    try {
      const text = getNotesText();
      await Clipboard.setStringAsync(text);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onCopied?.();
      onClose();
    } catch (error) {
      console.error('Failed to copy notes:', error);
    }
  };

  const handleShareAudio = async () => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(recording.audioUri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      onClose();
    } catch (error) {
      console.error('Failed to share audio:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.modal, { backgroundColor }]}>
              <View style={styles.handle} />

              <Text
                style={[
                  styles.title,
                  { color: textColor, fontSize: getFontSize('header', textSize) },
                ]}
              >
                {t.shareWithFamily}
              </Text>

              <View style={styles.options}>
                {recording.summary && recording.summary.length > 0 && (
                  <BigButton
                    title={t.shareSummary}
                    onPress={handleShareSummary}
                    variant="primary"
                    style={styles.option}
                  />
                )}

                {recording.notes && recording.notes.length > 0 && (
                  <BigButton
                    title={t.shareNotes}
                    onPress={handleShareNotes}
                    variant="secondary"
                    style={styles.option}
                  />
                )}

                <BigButton
                  title={t.shareAudio}
                  onPress={handleShareAudio}
                  variant="secondary"
                  style={styles.option}
                />
              </View>

              <BigButton
                title={t.cancel}
                onPress={onClose}
                variant="secondary"
                style={styles.cancelButton}
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  options: {
    gap: 12,
  },
  option: {
    width: '100%',
  },
  cancelButton: {
    marginTop: 16,
  },
});
