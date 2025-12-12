import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  useColorScheme,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { Colors } from '@/constants/Colors';
import { useAppStore } from '@/store';
import { useI18n, useAudioPlayer } from '@/hooks';
import {
  PlayButton,
  SpeedToggle,
  TabToggle,
  NotesView,
  SummaryView,
  BigButton,
  ConfirmDialog,
  ShareModal,
} from '@/components/ui';
import { getFontSize } from '@/types';
import * as FileSystem from 'expo-file-system';

type ViewTab = 'summary' | 'notes';

export default function RecordingDetailScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { t } = useI18n();
  const { settings, recordings, deleteRecording, markFirstRecordingEducationSeen } =
    useAppStore();
  const textSize = settings.textSize;

  const recording = recordings.find((r) => r.id === id);

  const [activeTab, setActiveTab] = useState<ViewTab>('summary');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const {
    isPlaying,
    position,
    playbackSpeed,
    play,
    pause,
    seekTo,
    setSpeed,
    loadAudio,
    unloadAudio,
  } = useAudioPlayer();

  const backgroundColor = isDark ? Colors.backgroundDark : Colors.background;
  const textColor = isDark ? Colors.textDark : Colors.text;
  const secondaryColor = isDark ? Colors.textSecondaryDark : Colors.textSecondary;

  // Load audio when recording changes
  useEffect(() => {
    if (recording?.audioUri) {
      loadAudio(recording.audioUri);
    }

    return () => {
      unloadAudio();
    };
  }, [recording?.audioUri]);

  // Mark first recording education as seen
  useEffect(() => {
    if (!settings.hasSeenFirstRecordingEducation && recording) {
      markFirstRecordingEducationSeen();
    }
  }, []);

  // Handle recording not found
  if (!recording) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <View style={styles.notFoundContainer}>
          <Text
            style={[
              styles.notFoundText,
              { color: textColor, fontSize: getFontSize('body', textSize) },
            ]}
          >
            {t.error}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Format duration
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const handleSpeedChange = (speed: 'normal' | 'slow') => {
    setSpeed(speed);
  };

  const handleNoteLinePress = (timestamp: number) => {
    seekTo(timestamp);
    if (!isPlaying) {
      play();
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);

    // Delete audio file
    try {
      await FileSystem.deleteAsync(recording.audioUri, { idempotent: true });
    } catch (error) {
      console.error('Failed to delete audio file:', error);
    }

    // Delete from store
    deleteRecording(recording.id);

    // Navigate back
    router.back();
  };

  const tabs = [
    { key: 'summary', label: t.summary },
    { key: 'notes', label: t.notes },
  ];

  const hasNotes = recording.notes && recording.notes.length > 0;
  const hasSummary = recording.summary && recording.summary.length > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      {/* Header Info */}
      <View style={styles.headerInfo}>
        <Text
          style={[
            styles.date,
            { color: textColor, fontSize: getFontSize('header', textSize) },
          ]}
        >
          {format(new Date(recording.createdAt), 'yyyy/MM/dd HH:mm')}
        </Text>
        <Text
          style={[
            styles.duration,
            { color: secondaryColor, fontSize: getFontSize('body', textSize) },
          ]}
        >
          {formatDuration(recording.duration)}
        </Text>
      </View>

      {/* Playback Controls */}
      <View style={styles.playbackControls}>
        <PlayButton isPlaying={isPlaying} onPress={handlePlayPause} />

        <View style={styles.speedControlContainer}>
          <SpeedToggle
            speed={playbackSpeed}
            onSpeedChange={handleSpeedChange}
            normalLabel={t.normalSpeed}
            slowLabel={t.slowSpeed}
          />
        </View>
      </View>

      {/* Tab Toggle */}
      {(hasNotes || hasSummary) && (
        <View style={styles.tabContainer}>
          <TabToggle
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={(key) => setActiveTab(key as ViewTab)}
          />
        </View>
      )}

      {/* Content */}
      <View style={styles.contentContainer}>
        {activeTab === 'summary' && hasSummary ? (
          <SummaryView summary={recording.summary!} />
        ) : activeTab === 'notes' && hasNotes ? (
          <NotesView
            notes={recording.notes!}
            onLinePress={handleNoteLinePress}
            currentTimestamp={position}
          />
        ) : (
          <View style={styles.emptyContent}>
            <Text
              style={[
                styles.emptyText,
                { color: secondaryColor, fontSize: getFontSize('body', textSize) },
              ]}
            >
              {recording.status === 'processing_notes' ||
              recording.status === 'processing_summary'
                ? t.processing
                : t.error}
            </Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <BigButton
          title={t.share}
          onPress={() => setShowShareModal(true)}
          variant="primary"
          style={styles.actionButton}
        />
        <BigButton
          title={t.delete}
          onPress={() => setShowDeleteConfirm(true)}
          variant="danger"
          style={styles.actionButton}
        />
      </View>

      {/* Delete Confirmation */}
      <ConfirmDialog
        visible={showDeleteConfirm}
        title={t.confirmDelete}
        message={t.confirmDeleteMessage}
        confirmText={t.confirm}
        cancelText={t.cancel}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />

      {/* Share Modal */}
      <ShareModal
        visible={showShareModal}
        recording={recording}
        onClose={() => setShowShareModal(false)}
        onCopied={() => Alert.alert('', t.copied)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerInfo: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  date: {
    fontWeight: '700',
    marginBottom: 4,
  },
  duration: {},
  playbackControls: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 20,
  },
  speedControlContainer: {
    marginTop: 16,
  },
  tabContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 32,
  },
  actionButton: {
    flex: 1,
  },
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFoundText: {
    textAlign: 'center',
  },
});
