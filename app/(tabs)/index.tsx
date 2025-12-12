import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  useColorScheme,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useAppStore } from '@/store';
import { useI18n, useRecording } from '@/hooks';
import {
  RecordButton,
  Timer,
  AudioWaveform,
  RecordingCard,
  BigButton,
} from '@/components/ui';
import { getFontSize, Recording } from '@/types';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  const { t } = useI18n();
  const { settings, recordings, setCurrentRecordingId, updateRecording } = useAppStore();
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

  const backgroundColor = isDark ? Colors.backgroundDark : Colors.background;
  const textColor = isDark ? Colors.textDark : Colors.text;
  const secondaryColor = isDark ? Colors.textSecondaryDark : Colors.textSecondary;

  // Get recent recordings (last 3)
  const recentRecordings = recordings.slice(0, 3);

  const handleRecordPress = async () => {
    try {
      if (isRecording) {
        // Stop recording
        const recording = await stopRecording();

        if (recording) {
          setProcessingId(recording.id);
          setCurrentRecordingId(recording.id);

          // Simulate processing (in real app, this would call the API)
          simulateProcessing(recording.id);
        }
      } else {
        // Start recording
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
  };

  // Simulate processing for demo purposes
  // In production, this would be handled by Supabase Edge Functions
  const simulateProcessing = async (recordingId: string) => {
    // Simulate transcription delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Add mock notes
    const mockNotes = [
      {
        id: '1',
        timestamp: 0,
        text: '這是一段示範文字。這是錄音的筆記內容。',
        speaker: '1',
      },
      {
        id: '2',
        timestamp: 5000,
        text: 'This is sample text. These are the notes from the recording.',
        speaker: '1',
      },
      {
        id: '3',
        timestamp: 10000,
        text: '您可以點擊任何一行來聽取該段錄音。',
        speaker: '2',
      },
    ];

    updateRecording(recordingId, {
      status: 'processing_summary',
      notes: mockNotes,
    });

    // Simulate summarization delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Add mock summary
    const mockSummary = [
      '這是錄音的第一個重點摘要。',
      '這是第二個重要的要點。',
      '這是第三個需要記住的事項。',
    ];

    updateRecording(recordingId, {
      status: 'ready',
      summary: mockSummary,
    });

    setProcessingId(null);

    // Check if this is the first recording
    if (!settings.hasSeenFirstRecordingEducation && recordings.length === 1) {
      // Navigate to the recording detail
      router.push(`/recording/${recordingId}`);
    }
  };

  const handleRecordingPress = (recording: Recording) => {
    router.push(`/recording/${recording.id}`);
  };

  const handleViewAll = () => {
    router.push('/(tabs)/library');
  };

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

  // Processing view
  if (processingId) {
    const processingRecording = recordings.find((r) => r.id === processingId);
    const isTranscribing = processingRecording?.status === 'processing_notes';

    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <View style={styles.processingView}>
          <View style={styles.processingIndicator}>
            <View style={styles.spinner} />
          </View>

          <Text
            style={[
              styles.processingTitle,
              { color: textColor, fontSize: getFontSize('header', textSize) },
            ]}
          >
            {t.processing}
          </Text>

          <Text
            style={[
              styles.processingStep,
              { color: Colors.primary, fontSize: getFontSize('body', textSize) },
            ]}
          >
            {isTranscribing ? t.takingNotes : t.findingKeyPoints}
          </Text>

          <Text
            style={[
              styles.processingHint,
              { color: secondaryColor, fontSize: getFontSize('body', textSize) },
            ]}
          >
            {t.mayTakeFewMinutes}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Normal home view
  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <ScrollView
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
            <Text
              style={[
                styles.sectionTitle,
                { color: textColor, fontSize: getFontSize('bodyLarge', textSize) },
              ]}
            >
              {t.recentRecordings}
            </Text>

            {recordings.length > 3 && (
              <BigButton
                title={t.viewAll}
                onPress={handleViewAll}
                variant="secondary"
                style={styles.viewAllButton}
                textStyle={{ fontSize: getFontSize('small', textSize) }}
              />
            )}
          </View>

          {recentRecordings.length === 0 ? (
            <View style={styles.emptyState}>
              <Text
                style={[
                  styles.emptyTitle,
                  { color: secondaryColor, fontSize: getFontSize('body', textSize) },
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
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: '700',
  },
  viewAllButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyMessage: {
    textAlign: 'center',
    lineHeight: 28,
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
    marginBottom: 24,
  },
  processingHint: {
    textAlign: 'center',
  },
});
