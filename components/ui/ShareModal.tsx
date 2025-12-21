import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  useColorScheme,
  TouchableWithoutFeedback,
  Platform,
  Alert,
} from 'react-native';
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

  // Cross-platform clipboard copy
  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (Platform.OS === 'web') {
        // Use browser's native Clipboard API on web
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // Use expo-clipboard on native
        await Clipboard.setStringAsync(text);
        return true;
      }
    } catch (error) {
      console.error('Clipboard copy failed:', error);
      return false;
    }
  };

  // Cross-platform alert helper
  const showAlert = (message: string) => {
    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      Alert.alert('', message);
    }
  };

  const handleShareSummary = async () => {
    const text = getSummaryText();
    if (!text) {
      showAlert(t.noSummaryToShare);
      return;
    }
    const success = await copyToClipboard(text);
    if (success) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      onClose();
      showAlert(t.copied);
    } else {
      showAlert(t.failedToCopy);
    }
  };

  const handleShareNotes = async () => {
    const text = getNotesText();
    if (!text) {
      showAlert(t.noNotesToShare);
      return;
    }
    const success = await copyToClipboard(text);
    if (success) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      onClose();
      showAlert(t.copied);
    } else {
      showAlert(t.failedToCopy);
    }
  };

  const handleShareAudio = async () => {
    // Audio file sharing doesn't work on web - local file URIs aren't valid
    if (Platform.OS === 'web') {
      onClose();
      showAlert(t.audioSharingNotAvailableWeb);
      return;
    }

    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable && recording.audioUri) {
        await Sharing.shareAsync(recording.audioUri, {
          mimeType: 'audio/m4a',
          dialogTitle: t.shareAudio,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onClose();
      } else {
        onClose();
        showAlert(t.sharingNotAvailable);
      }
    } catch (error) {
      console.error('Failed to share audio:', error);
      onClose();
      showAlert(t.failedToShareAudio);
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
