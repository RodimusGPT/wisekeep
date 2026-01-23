import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { Colors } from '@/constants/Colors';
import { useAppStore } from '@/store';
import { useI18n, useRecording, useAuth, useTheme } from '@/hooks';
import {
  RecordButton,
  Timer,
  AudioWaveform,
  RecordingCard,
  BigButton,
} from '@/components/ui';
import { getFontSize, Recording, NoteLine } from '@/types';
import {
  uploadAudioChunked,
  processRecording as processRecordingApi,
  fetchRecordingById,
  saveRecording as saveRecordingToDb,
  checkComprehensiveUsage,
} from '@/services/supabase';

export default function HomeScreen() {
  const { isDark, colors } = useTheme();
  const router = useRouter();

  const { t } = useI18n();
  const { settings, recordings, setCurrentRecordingId, updateRecording } = useAppStore();
  const { user } = useAuth();
  const textSize = settings.textSize;

  const {
    isRecording,
    duration,
    metering,
    startRecording,
    stopRecording,
    requestPermission,
    hasPermission,
  } = useRecording();

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  // Scroll to top when tab is focused (so record button is visible)
  useFocusEffect(
    useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }, [])
  );

  // Spinning animation for processing indicator
  useEffect(() => {
    if (processingId) {
      // Start spinning animation
      const spin = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: Platform.OS !== 'web',
        })
      );
      spin.start();

      // Start elapsed time counter
      setElapsedTime(0);
      const timer = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);

      return () => {
        spin.stop();
        spinAnim.setValue(0);
        clearInterval(timer);
      };
    }
  }, [processingId]);

  const { background: backgroundColor, text: textColor, textSecondary: secondaryColor } = colors;

  // Memoize recent recordings (last 3)
  const recentRecordings = useMemo(() => recordings.slice(0, 3), [recordings]);

  const handleRecordPress = useCallback(async () => {
    console.log('handleRecordPress called, isRecording:', isRecording);
    try {
      if (isRecording) {
        // Stop recording
        const recording = await stopRecording();

        if (recording) {
          setProcessingId(recording.id);
          setCurrentRecordingId(recording.id);

          // Save recording without processing (new on-demand model)
          await saveRecordingOnly(recording.id, recording.audioUri, recording.duration);
        }
      } else {
        // Start recording - check storage limit first
        if (!user) {
          Alert.alert(t.error, '請先登入');
          return;
        }

        // Check storage limits
        try {
          const usage = await checkComprehensiveUsage(user.id);

          if (!usage.can_record) {
            // Show storage limit alert with upgrade option
            Alert.alert(
              t.storageFull,
              t.storageFullMessage,
              [
                { text: t.cancel, style: 'cancel' },
                { text: t.viewAll, onPress: () => router.push('/(tabs)/library') },
              ]
            );
            return;
          }
        } catch (error) {
          console.error('Error checking storage limits:', error);
          // Allow recording on error (fail open)
        }

        if (!hasPermission) {
          const granted = await requestPermission();
          if (!granted) {
            Alert.alert(
              t.microphonePermissionTitle,
              t.microphonePermissionMessage
            );
            return;
          }
        }
        await startRecording();
      }
    } catch (error) {
      console.error('Recording error:', error);
      Alert.alert(t.error, t.tryAgain);
    }
  }, [isRecording, stopRecording, setCurrentRecordingId, user, hasPermission, requestPermission, startRecording, t, router, settings.language]);

  // Save recording without AI processing (on-demand model)
  const saveRecordingOnly = async (recordingId: string, audioUri: string, durationSeconds: number) => {
    console.log('saveRecordingOnly started for:', recordingId);

    if (!user) {
      console.error('No user logged in');
      updateRecording(recordingId, {
        status: 'ready',
        notes: [{ id: '1', timestamp: 0, text: '請先登入' }],
        summary: ['尚未登入，請稍後重試。'],
      });
      setProcessingId(null);
      return;
    }

    try {
      // Step 1: Read the audio file
      // On iOS/React Native, we pass base64 directly to uploadAudio (Blob doesn't work)
      // On web, we use fetch to get a proper Blob
      console.log('[saveRecordingOnly] Reading audio file from:', audioUri);

      let audioData: Blob | string;

      if (Platform.OS === 'web') {
        // Web: fetch works correctly with blob URLs
        const response = await fetch(audioUri);
        if (!response.ok) {
          throw new Error(`Failed to fetch audio file: ${response.status} ${response.statusText}`);
        }
        audioData = await response.blob();
        console.log('[saveRecordingOnly] Web blob size:', audioData.size);
      } else {
        // iOS/Android: Read file as base64 string - uploadAudio will handle conversion
        // This avoids the broken Blob polyfill in React Native
        audioData = await FileSystem.readAsStringAsync(audioUri, {
          encoding: 'base64', // Use string literal - EncodingType.Base64 may be undefined on iOS
        });
        console.log('[saveRecordingOnly] Native base64 length:', audioData.length);

        if (audioData.length === 0) {
          throw new Error('Audio file is empty - recording may have failed');
        }
      }

      // Step 2: Upload with automatic chunking
      console.log('Uploading audio (with chunking if needed)...');
      const { chunks, needsChunking } = await uploadAudioChunked(
        user.authUserId,
        recordingId,
        audioData,
        durationSeconds
      );
      console.log(`Upload complete: ${chunks.length} chunk(s), chunking ${needsChunking ? 'used' : 'not needed'}`);

      // Step 3: Save recording to database with 'recorded' status (NOT processing)
      console.log('Saving recording to database with recorded status...');
      await saveRecordingToDb({
        id: recordingId,
        user_id: user.id,
        device_id: user.deviceId || 'unknown',
        duration: durationSeconds,
        audio_url: chunks[0].url,
        status: 'recorded', // New status: saved but not yet processed
        language: settings.language,
      });
      console.log('Recording saved successfully');

      // Update local state with remote URL so it's available for transcription
      updateRecording(recordingId, {
        status: 'recorded',
        audioRemoteUrl: chunks[0].url,
        notes: [],
        summary: [],
      });

      setProcessingId(null);

      // Navigate to recording detail screen so user can start processing
      router.push(`/recording/${recordingId}`);

    } catch (error) {
      console.error('Save error:', error);
      updateRecording(recordingId, {
        status: 'ready',
        notes: [{
          id: '1',
          timestamp: 0,
          text: `儲存錯誤: ${error instanceof Error ? error.message : '未知錯誤'}`,
        }],
        summary: ['儲存過程中發生錯誤，請重試。'],
      });
      setProcessingId(null);
    }
  };

  // Process recording with Supabase Edge Function (handles chunking automatically)
  // This will be called from recording detail screen when user clicks Transcribe button
  const processRecording = async (recordingId: string, audioUri: string, durationSeconds: number) => {
    console.log('processRecording started for:', recordingId);

    if (!user) {
      console.error('No user logged in');
      updateRecording(recordingId, {
        status: 'ready',
        notes: [{ id: '1', timestamp: 0, text: '請先登入' }],
        summary: ['尚未登入，請稍後重試。'],
      });
      setProcessingId(null);
      return;
    }

    try {
      // Step 1: Read the audio file
      // On iOS/React Native, we pass base64 directly to uploadAudio (Blob doesn't work)
      // On web, we use fetch to get a proper Blob
      console.log('[processRecording] Reading audio file from:', audioUri);

      let audioData: Blob | string;

      if (Platform.OS === 'web') {
        // Web: fetch works correctly with blob URLs
        const response = await fetch(audioUri);
        if (!response.ok) {
          throw new Error(`Failed to fetch audio file: ${response.status} ${response.statusText}`);
        }
        audioData = await response.blob();
        console.log('[processRecording] Web blob size:', audioData.size);
      } else {
        // iOS/Android: Read file as base64 string - uploadAudio will handle conversion
        // This avoids the broken Blob polyfill in React Native
        audioData = await FileSystem.readAsStringAsync(audioUri, {
          encoding: 'base64', // Use string literal - EncodingType.Base64 may be undefined on iOS
        });
        console.log('[processRecording] Native base64 length:', audioData.length);

        if (audioData.length === 0) {
          throw new Error('Audio file is empty - recording may have failed');
        }
      }

      // Step 2: Upload with automatic chunking
      // Use authUserId for storage paths (matches Supabase Storage RLS policy using auth.uid())
      console.log('Uploading audio (with chunking if needed)...');
      const { chunks, needsChunking } = await uploadAudioChunked(
        user.authUserId,
        recordingId,
        audioData,
        durationSeconds
      );
      console.log(`Upload complete: ${chunks.length} chunk(s), chunking ${needsChunking ? 'used' : 'not needed'}`);

      // Step 3: Save recording to database (so Edge Function can update it)
      console.log('Saving recording to database...');
      await saveRecordingToDb({
        id: recordingId,
        user_id: user.id,
        device_id: user.deviceId || 'unknown',
        duration: durationSeconds,
        audio_url: chunks[0].url, // Main audio URL (first chunk or single file)
        status: 'processing_notes',
        language: settings.language,
      });
      console.log('Recording saved to database');

      // Step 4: Call Edge Function to process
      console.log('Starting transcription and summarization...');
      const result = await processRecordingApi(
        recordingId,
        user.id,
        chunks,
        settings.language,
        durationSeconds
      );

      if (!result.success) {
        throw new Error(result.error || 'Processing failed');
      }

      console.log('Processing started, polling for updates...');

      // Poll for recording updates (more reliable than real-time subscriptions)
      const pollForUpdates = async () => {
        const maxAttempts = 60; // Poll for up to 2 minutes (60 * 2 seconds)
        let attempts = 0;

        const checkStatus = async () => {
          attempts++;
          console.log(`Polling for recording status (attempt ${attempts})...`);

          try {
            const dbRecording = await fetchRecordingById(recordingId);

            if (dbRecording) {
              console.log('Recording status from DB:', dbRecording.status);

              // Update local state with database values
              updateRecording(recordingId, {
                status: dbRecording.status,
                notes: dbRecording.notes as NoteLine[] || [],
                summary: dbRecording.summary as string[] || [],
              });

              // Check if processing is complete
              if (dbRecording.status === 'ready' || dbRecording.status === 'error') {
                console.log('Processing finished with status:', dbRecording.status);
                setProcessingId(null);

                // Navigate to recording detail if first recording
                if (!settings.hasSeenFirstRecordingEducation && recordings.length === 1) {
                  router.push(`/recording/${recordingId}`);
                }
                return; // Stop polling
              }
            }

            // Continue polling if not done and under max attempts
            if (attempts < maxAttempts) {
              setTimeout(checkStatus, 2000); // Poll every 2 seconds
            } else {
              console.log('Polling timeout - stopping');
              setProcessingId(null);
            }
          } catch (error) {
            console.error('Error polling for updates:', error);
            if (attempts < maxAttempts) {
              setTimeout(checkStatus, 2000);
            }
          }
        };

        // Start polling after a short delay (give Edge Function time to start)
        setTimeout(checkStatus, 1000);
      };

      pollForUpdates();

    } catch (error) {
      console.error('Processing error:', error);

      // Update status to show error
      updateRecording(recordingId, {
        status: 'ready',
        notes: [{
          id: '1',
          timestamp: 0,
          text: `處理錯誤: ${error instanceof Error ? error.message : '未知錯誤'}`,
        }],
        summary: ['處理過程中發生錯誤，請重試。'],
      });
      setProcessingId(null);
    }
  };

  const handleRecordingPress = useCallback((recording: Recording) => {
    router.push(`/recording/${recording.id}`);
  }, [router]);

  const handleViewAll = useCallback(() => {
    router.push('/(tabs)/library');
  }, [router]);

  // Recording active view
  if (isRecording) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <View style={styles.recordingView}>
          {/* Recording indicator */}
          <View style={styles.recordingIndicator}>
            <View style={styles.pulsingDot} />
          </View>

          {/* Timer */}
          <Timer seconds={duration} isRecording label={t.recording} />

          {/* Waveform */}
          <View style={styles.waveformContainer}>
            <AudioWaveform metering={metering} isActive />
          </View>

          {/* Stop button */}
          <RecordButton
            isRecording
            onPress={handleRecordPress}
            label={t.tapToStop}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Processing/Saving view
  if (processingId) {
    const processingRecording = recordings.find((r) => r.id === processingId);
    const status = processingRecording?.status;

    // Determine what operation is happening
    const isSaving = !status || status === 'recording' || status === 'recorded';
    const isTranscribing = status === 'processing_notes';
    const isSummarizing = status === 'processing_summary';

    // Format elapsed time as MM:SS
    const formatElapsed = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Interpolate rotation
    const spin = spinAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <View style={styles.processingView}>
          <View style={styles.processingIndicator}>
            <Animated.View
              style={[
                styles.spinner,
                { transform: [{ rotate: spin }] },
              ]}
            />
          </View>

          <Text
            style={[
              styles.processingTitle,
              { color: textColor, fontSize: getFontSize('header', textSize) },
            ]}
          >
            {isSaving ? t.saving : t.processing}
          </Text>

          <Text
            style={[
              styles.processingStep,
              { color: Colors.primary, fontSize: getFontSize('body', textSize) },
            ]}
          >
            {isSaving
              ? t.uploadingAudio
              : isTranscribing
                ? t.takingNotes
                : t.findingKeyPoints}
          </Text>

          <Text
            style={[
              styles.elapsedTime,
              { color: textColor, fontSize: getFontSize('header', textSize) },
            ]}
          >
            {formatElapsed(elapsedTime)}
          </Text>

          {!isSaving && (
            <Text
              style={[
                styles.processingHint,
                { color: secondaryColor, fontSize: getFontSize('body', textSize) },
              ]}
            >
              {t.mayTakeFewMinutes}
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Normal home view
  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text
            style={[
              styles.appName,
              { color: textColor, fontSize: getFontSize('headerLarge', textSize) },
            ]}
          >
            {t.appName}
          </Text>
        </View>

        {/* Record Button */}
        <View style={styles.recordButtonContainer}>
          <RecordButton
            isRecording={false}
            onPress={handleRecordPress}
            label={t.tapToRecord}
          />
        </View>

        {/* Recent Recordings */}
        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="time-outline" size={22} color={Colors.primary} />
              <Text
                style={[
                  styles.sectionTitle,
                  { color: textColor, fontSize: getFontSize('header', textSize) },
                ]}
              >
                {t.recentRecordings}
              </Text>
            </View>

            {recordings.length > 3 && (
              <BigButton
                title={t.viewAll}
                onPress={handleViewAll}
                variant="secondary"
                icon="folder-open-outline"
                style={styles.viewAllButton}
                textStyle={{ fontSize: getFontSize('body', textSize) }}
              />
            )}
          </View>

          {recentRecordings.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: isDark ? Colors.cardDark : Colors.card, borderColor: isDark ? Colors.borderDark : Colors.border }]}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="mic-outline" size={56} color={Colors.primary} />
              </View>
              <Text
                style={[
                  styles.emptyTitle,
                  { color: textColor, fontSize: getFontSize('header', textSize) },
                ]}
              >
                {t.noRecordings}
              </Text>
              <Text
                style={[
                  styles.emptyMessage,
                  { color: secondaryColor, fontSize: getFontSize('body', textSize) },
                ]}
              >
                {t.noRecordingsMessage}
              </Text>
              <View style={styles.emptyHint}>
                <Ionicons name="arrow-up" size={20} color={Colors.primary} />
                <Text
                  style={[
                    styles.emptyHintText,
                    { color: Colors.primary, fontSize: getFontSize('body', textSize) },
                  ]}
                >
                  {t.tapToRecord}
                </Text>
              </View>
            </View>
          ) : (
            recentRecordings.map((recording) => (
              <RecordingCard
                key={recording.id}
                recording={recording}
                onPress={() => handleRecordingPress(recording)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 10,
  },
  appName: {
    fontWeight: '700',
  },
  recordButtonContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  recentSection: {
    marginTop: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontWeight: '700',
  },
  viewAllButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(198, 40, 40, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyMessage: {
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 24,
  },
  emptyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(198, 40, 40, 0.1)',
  },
  emptyHintText: {
    fontWeight: '600',
  },

  // Recording view
  recordingView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  recordingIndicator: {
    marginBottom: 32,
  },
  pulsingDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.recordingActive,
  },
  waveformContainer: {
    marginVertical: 40,
  },

  // Processing view
  processingView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  processingIndicator: {
    marginBottom: 32,
  },
  spinner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 4,
    borderColor: Colors.border,
    borderTopColor: Colors.primary,
  },
  processingTitle: {
    fontWeight: '700',
    marginBottom: 16,
  },
  processingStep: {
    fontWeight: '600',
    marginBottom: 16,
  },
  elapsedTime: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginBottom: 16,
  },
  processingHint: {
    textAlign: 'center',
  },
});
