import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  useColorScheme,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { Colors } from '@/constants/Colors';

import { useAppStore } from '@/store';
import { useI18n } from '@/hooks';
import { Recording, getFontSize } from '@/types';
import { BigButton } from './BigButton';

// Cache for converted MP3 files (persists for browser session)
const mp3Cache = new Map<string, Blob>();

// Convert WebM audio to MP3 for better compatibility
async function convertToMp3(recordingId: string, audioUrl: string): Promise<Blob> {
  // Check cache first
  const cached = mp3Cache.get(recordingId);
  if (cached) {
    console.log('[MP3] Using cached MP3 for:', recordingId);
    return cached;
  }

  console.log('[MP3] Converting to MP3:', recordingId);
  // Dynamically import lamejs (using maintained fork for better bundler compatibility)
  const { Mp3Encoder } = await import('@breezystack/lamejs');

  // Fetch the audio file
  const response = await fetch(audioUrl);
  if (!response.ok) throw new Error('Failed to fetch audio');
  const arrayBuffer = await response.arrayBuffer();

  // Decode the audio using Web Audio API
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Get audio data
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const samples = audioBuffer.getChannelData(0); // Get mono channel

  // Convert Float32Array to Int16Array for lamejs
  const int16Samples = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    int16Samples[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  // Create MP3 encoder (mono, sample rate, 128kbps)
  const mp3Encoder = new Mp3Encoder(1, sampleRate, 128);

  // Encode in chunks
  const mp3Data: Uint8Array[] = [];
  const chunkSize = 1152; // Must be multiple of 576 for lamejs

  for (let i = 0; i < int16Samples.length; i += chunkSize) {
    const chunk = int16Samples.subarray(i, i + chunkSize);
    const mp3Chunk = mp3Encoder.encodeBuffer(chunk);
    if (mp3Chunk.length > 0) {
      // Convert Int8Array to Uint8Array for Blob compatibility
      mp3Data.push(new Uint8Array(mp3Chunk));
    }
  }

  // Flush the encoder
  const finalChunk = mp3Encoder.flush();
  if (finalChunk.length > 0) {
    mp3Data.push(new Uint8Array(finalChunk));
  }

  // Close audio context
  await audioContext.close();

  // Create MP3 blob - cast to BlobPart[] for TypeScript compatibility
  const mp3Blob = new Blob(mp3Data as BlobPart[], { type: 'audio/mp3' });

  // Cache for future shares
  mp3Cache.set(recordingId, mp3Blob);
  console.log('[MP3] Cached MP3 for:', recordingId);

  return mp3Blob;
}

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

  // State for in-app alert dialog
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const backgroundColor = isDark ? Colors.cardDark : Colors.card;
  const textColor = isDark ? Colors.textDark : Colors.text;
  const secondaryColor = isDark ? Colors.textSecondaryDark : Colors.textSecondary;

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

  // Show in-app alert dialog instead of browser popup
  const showAlert = (message: string, closeAfter: boolean = false) => {
    if (closeAfter) {
      onClose();
    }
    setAlertMessage(message);
  };

  const dismissAlert = () => {
    setAlertMessage(null);
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
      showAlert(t.copied, true);
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
      showAlert(t.copied, true);
    } else {
      showAlert(t.failedToCopy);
    }
  };

  const [isConverting, setIsConverting] = useState(false);

  const handleShareAudio = async () => {
    // On web, convert to MP3 and download as local file
    // This prevents bandwidth costs if they forward to a large group
    if (Platform.OS === 'web') {
      const audioUrl = recording.audioRemoteUrl || recording.audioUri;

      if (audioUrl && audioUrl.startsWith('http')) {
        try {
          setIsConverting(true);

          // Convert webm to MP3 for better compatibility (cached per recording)
          const mp3Blob = await convertToMp3(recording.id, audioUrl);

          // Create a local blob URL (not shareable externally)
          const blobUrl = URL.createObjectURL(mp3Blob);

          // Trigger download
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = `recording-${recording.id}.mp3`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          // Clean up the blob URL immediately
          URL.revokeObjectURL(blobUrl);

          setIsConverting(false);
          onClose();
        } catch (error) {
          console.error('Failed to download audio:', error);
          setIsConverting(false);
          showAlert(t.failedToShareAudio, true);
        }
      } else {
        showAlert(t.audioSharingNotAvailableWeb, true);
      }
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
        showAlert(t.sharingNotAvailable, true);
      }
    } catch (error) {
      console.error('Failed to share audio:', error);
      showAlert(t.failedToShareAudio, true);
    }
  };

  return (
    <>
      {/* Share options modal */}
      <Modal
        visible={visible && !alertMessage}
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
                    title={
                      isConverting
                        ? t.convertingAudio
                        : Platform.OS === 'web'
                          ? t.downloadAudio
                          : t.shareAudio
                    }
                    onPress={handleShareAudio}
                    variant="secondary"
                    style={styles.option}
                    disabled={isConverting}
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

      {/* In-app alert dialog */}
      <Modal
        visible={!!alertMessage}
        transparent
        animationType="fade"
        onRequestClose={dismissAlert}
      >
        <TouchableWithoutFeedback onPress={dismissAlert}>
          <View style={styles.alertOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.alertDialog, { backgroundColor }]}>
                <Text
                  style={[
                    styles.alertMessage,
                    { color: textColor, fontSize: getFontSize('body', textSize) },
                  ]}
                >
                  {alertMessage}
                </Text>

                <BigButton
                  title="OK"
                  onPress={dismissAlert}
                  variant="primary"
                  style={styles.alertButton}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
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
  // Alert dialog styles
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  alertDialog: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  alertMessage: {
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 24,
    fontWeight: '500',
  },
  alertButton: {
    minWidth: 120,
  },
});
