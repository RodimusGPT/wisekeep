import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  useColorScheme,
  Alert,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import { File } from 'expo-file-system/next';
import {
  checkComprehensiveUsage,
  processRecording as processRecordingApi,
  fetchRecordingById,
  ComprehensiveUsage,
} from '@/services/supabase';
import { useAuth } from '@/hooks';

type ViewTab = 'summary' | 'notes';

export default function RecordingDetailScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { t } = useI18n();
  const { settings, recordings, addRecording, deleteRecording, updateRecording, markFirstRecordingEducationSeen } =
    useAppStore();
  const { user } = useAuth();
  const textSize = settings.textSize;

  const recording = recordings.find((r) => r.id === id);

  // Tab state - will be set by useEffect based on recording content
  const [activeTab, setActiveTab] = useState<ViewTab>('summary');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showTranscribeConfirm, setShowTranscribeConfirm] = useState(false);
  const [transcribeAudioUrl, setTranscribeAudioUrl] = useState<string | null>(null);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelText, setLabelText] = useState(recording?.label || '');
  const [usage, setUsage] = useState<ComprehensiveUsage | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingRecording, setIsLoadingRecording] = useState(!recording);

  const {
    isPlaying,
    isLoaded,
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
    // Prefer remote URL if available (for uploaded recordings), otherwise use local URI
    const audioSource = recording?.audioRemoteUrl || recording?.audioUri;

    console.log('[Detail] Audio source:', audioSource ? audioSource.substring(0, 50) + '...' : 'none');

    if (audioSource) {
      loadAudio(audioSource);
    }

    return () => {
      unloadAudio();
    };
  }, [recording?.audioUri, recording?.audioRemoteUrl]);

  // Log when audio loading state changes
  useEffect(() => {
    console.log('[Detail] Audio isLoaded changed:', isLoaded);
  }, [isLoaded]);

  // Mark first recording education as seen
  useEffect(() => {
    if (!settings.hasSeenFirstRecordingEducation && recording) {
      markFirstRecordingEducationSeen();
    }
  }, []);

  // Track which recording we've set the initial tab for
  const tabSetForIdRef = React.useRef<string | null>(null);

  // Set correct tab when navigating or when recording data becomes available
  useEffect(() => {
    // Reset tracking if we're viewing a different recording
    if (tabSetForIdRef.current !== null && tabSetForIdRef.current !== id) {
      tabSetForIdRef.current = null;
    }

    // Skip if we've already set the tab for this recording
    if (tabSetForIdRef.current === id) return;

    // Wait for recording data
    if (!recording) return;

    const hasNotes = !!(recording.notes && recording.notes.length > 0);

    // Default to Notes tab when notes are available (more detailed view)
    // Users can switch to Summary tab if they prefer the overview
    const newTab = hasNotes ? 'notes' : 'summary';

    console.log('[Tab] Setting tab for:', id, 'hasNotes:', hasNotes, '-> tab:', newTab);

    setActiveTab(newTab);
    tabSetForIdRef.current = id;
  }, [id, recording?.notes?.length, recording?.summary?.length]);

  // Load usage data
  useEffect(() => {
    const loadUsage = async () => {
      if (user?.id) {
        try {
          const usageData = await checkComprehensiveUsage(user.id);
          setUsage(usageData);
        } catch (error) {
          console.error('Failed to load usage:', error);
        }
      }
    };
    loadUsage();
  }, [user?.id]);

  // Fetch recording data from database on mount to ensure we have latest notes/summary
  // This also handles the case where the store hasn't hydrated yet after page refresh
  useEffect(() => {
    const loadRecordingData = async () => {
      if (!id) return;

      setIsLoadingRecording(true);
      try {
        const dbRecording = await fetchRecordingById(id);
        if (dbRecording) {
          // If recording doesn't exist in store, add it
          const existingRecording = recordings.find((r) => r.id === id);
          if (!existingRecording) {
            addRecording({
              id: dbRecording.id,
              label: dbRecording.label || undefined,
              createdAt: dbRecording.created_at,
              duration: dbRecording.duration || 0,
              audioUri: dbRecording.audio_url || '',
              audioRemoteUrl: dbRecording.audio_url || undefined,
              status: dbRecording.status as any,
              notes: dbRecording.notes as any,
              summary: dbRecording.summary as any,
            });
          } else {
            // Otherwise just update it
            updateRecording(id, {
              status: dbRecording.status as any,
              notes: dbRecording.notes as any,
              summary: dbRecording.summary as any,
              audioRemoteUrl: dbRecording.audio_url || undefined,
            });
          }
        }
      } catch (error) {
        console.error('[Detail] Error fetching recording data:', error);
      } finally {
        setIsLoadingRecording(false);
      }
    };

    loadRecordingData();
  }, [id]);

  // Poll for processing status updates
  useEffect(() => {
    if (!recording || !id) return;

    const isCurrentlyProcessing =
      recording.status === 'processing_notes' || recording.status === 'processing_summary';

    if (isCurrentlyProcessing) {
      setIsProcessing(true);

      const pollInterval = setInterval(async () => {
        try {
          const dbRecording = await fetchRecordingById(id);
          if (dbRecording) {
            updateRecording(id, {
              status: dbRecording.status as any,
              notes: dbRecording.notes as any,
              summary: dbRecording.summary as any,
            });

            // Stop polling if processing is complete
            if (dbRecording.status === 'ready' || dbRecording.status === 'notes_ready' || dbRecording.status === 'error') {
              setIsProcessing(false);
              clearInterval(pollInterval);
            }
          }
        } catch (error) {
          console.error('Error polling for updates:', error);
        }
      }, 2000);

      return () => clearInterval(pollInterval);
    } else {
      setIsProcessing(false);
    }
  }, [recording?.status, id]);

  // Handle recording not found or loading
  if (!recording) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <View style={styles.notFoundContainer}>
          <Text
            style={[
              styles.notFoundText,
              { color: isLoadingRecording ? secondaryColor : textColor, fontSize: getFontSize('body', textSize) },
            ]}
          >
            {isLoadingRecording ? t.processing : t.error}
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

  const handleNoteLinePress = async (timestamp: number) => {
    // Timestamps from Groq are in seconds, but seekTo expects milliseconds
    const positionMs = (timestamp || 0) * 1000;

    console.log('[NotePress] Pressed timestamp:', timestamp, 'seconds, isLoaded:', isLoaded);

    if (!isLoaded) {
      console.log('[NotePress] Audio not loaded yet, cannot seek');
      return;
    }

    // Seek first, then play
    try {
      await seekTo(positionMs);

      if (!isPlaying) {
        await play();
      }
    } catch (error) {
      console.error('[NotePress] Error during seek/play:', error);
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);

    // Delete audio file (only on native - blob URLs on web are garbage collected)
    if (Platform.OS !== 'web' && recording.audioUri) {
      try {
        const file = new File(recording.audioUri);
        if (file.exists) {
          file.delete();
        }
      } catch (error) {
        console.error('Failed to delete audio file:', error);
      }
    }

    // Delete from store
    deleteRecording(recording.id);

    // Navigate back
    router.back();
  };

  const handleSaveLabel = () => {
    if (recording) {
      updateRecording(recording.id, { label: labelText.trim() || undefined });
    }
    setIsEditingLabel(false);
  };

  const handleTranscribe = async () => {
    console.log('[Transcribe] handleTranscribe called');
    if (!recording || !user) {
      console.log('[Transcribe] Missing recording or user:', { hasRecording: !!recording, hasUser: !!user });
      return;
    }

    // Get the audio URL - either from local state or fetch from database
    let audioUrl = recording.audioRemoteUrl;
    console.log('[Transcribe] Audio URL from state:', audioUrl);

    if (!audioUrl) {
      try {
        const dbRecording = await fetchRecordingById(recording.id);
        if (dbRecording?.audio_url) {
          audioUrl = dbRecording.audio_url;
          // Update local state so we don't need to fetch again
          updateRecording(recording.id, { audioRemoteUrl: audioUrl });
        }
      } catch (error) {
        console.error('Error fetching audio URL from database:', error);
      }
    }

    if (!audioUrl) {
      Alert.alert(t.error, '錄音尚未上傳完成，請稍後再試');
      return;
    }

    // Get current usage data - either from state or fetch it
    let currentUsage = usage;
    if (!currentUsage) {
      try {
        currentUsage = await checkComprehensiveUsage(user.id);
        setUsage(currentUsage);
      } catch (error) {
        console.error('Error loading usage:', error);
        Alert.alert(t.error, t.tryAgain);
        return;
      }
    }

    // Check AI processing limits
    if (!currentUsage.can_process) {
      const remaining = currentUsage.ai_minutes_remaining || 0;
      Alert.alert(
        t.error,
        t.aiMinutesRemaining.replace('{remaining}', remaining.toString()),
        [
          { text: t.cancel, style: 'cancel' },
          { text: t.upgradeToPremium, onPress: () => router.push('/(tabs)/settings') },
        ]
      );
      return;
    }

    // Store the audio URL and show confirmation dialog
    setTranscribeAudioUrl(audioUrl);
    setShowTranscribeConfirm(true);
  };

  // Actually perform the transcription after user confirms
  const performTranscription = async () => {
    console.log('[Transcription] performTranscription started');
    if (!recording || !user || !transcribeAudioUrl) {
      console.log('[Transcription] Missing data:', {
        hasRecording: !!recording,
        hasUser: !!user,
        hasAudioUrl: !!transcribeAudioUrl
      });
      return;
    }

    setShowTranscribeConfirm(false);
    console.log('[Transcription] Starting transcription for recording:', recording.id);

    try {
      setIsProcessing(true);
      updateRecording(recording.id, { status: 'processing_notes' });

      // Call the processing API (transcribe only)
      // Note: API expects startTime/endTime, not duration
      const result = await processRecordingApi(
        recording.id,
        user.id,
        [{ url: transcribeAudioUrl, index: 0, startTime: 0, endTime: recording.duration }],
        settings.language,
        recording.duration
      );

      if (!result.success) {
        // API returned error - show detailed error message
        const stepInfo = result.step ? ` (step: ${result.step})` : '';
        console.error('Transcription failed:', result.error, stepInfo);
        Alert.alert(t.error, `${result.error || t.tryAgain}${stepInfo}`);
        updateRecording(recording.id, { status: 'recorded' });
        setIsProcessing(false);
        return;
      }

      // Refresh usage
      const newUsage = await checkComprehensiveUsage(user.id);
      setUsage(newUsage);

      // Fetch the updated recording to get notes and summary
      // This is necessary for fast-completing transcriptions where polling doesn't trigger
      console.log('[Transcription] Fetching updated recording data...');
      const updatedRecording = await fetchRecordingById(recording.id);
      if (updatedRecording) {
        console.log('[Transcription] Updated recording:', {
          status: updatedRecording.status,
          hasNotes: !!updatedRecording.notes,
          hasSummary: !!updatedRecording.summary,
          notesLength: Array.isArray(updatedRecording.notes) ? updatedRecording.notes.length : 0,
          summaryLength: Array.isArray(updatedRecording.summary) ? updatedRecording.summary.length : 0,
        });
        updateRecording(recording.id, {
          status: updatedRecording.status as any,
          notes: updatedRecording.notes as any,
          summary: updatedRecording.summary as any,
        });
      } else {
        console.log('[Transcription] No updated recording found!');
      }

      setIsProcessing(false);
    } catch (error) {
      console.error('Transcription error:', error);
      Alert.alert(t.error, error instanceof Error ? error.message : t.tryAgain);
      updateRecording(recording.id, { status: 'recorded' });
      setIsProcessing(false);
    }
  };

  const handleSummarize = async () => {
    if (!recording || !user) return;

    // Check if notes exist
    if (!recording.notes || recording.notes.length === 0) {
      Alert.alert(t.error, t.recordingSaved);
      return;
    }

    // Summarization is free, no need to check limits
    Alert.alert(
      t.summarizePromptTitle,
      t.summarizePromptMessage,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.confirm,
          onPress: async () => {
            try {
              setIsProcessing(true);
              updateRecording(recording.id, { status: 'processing_summary' });

              // Call the summarization API
              // Note: We need to create a new Edge Function for summarization only
              // For now, we'll call the same processRecording API
              // TODO: Create a separate summarize-only Edge Function

              // Refresh usage
              const newUsage = await checkComprehensiveUsage(user.id);
              setUsage(newUsage);
            } catch (error) {
              console.error('Summarization error:', error);
              Alert.alert(t.error, error instanceof Error ? error.message : t.tryAgain);
              updateRecording(recording.id, { status: 'notes_ready' });
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  const tabs = [
    { key: 'summary', label: t.summary },
    { key: 'notes', label: t.notes },
  ];

  const hasNotes = recording.notes && recording.notes.length > 0;
  const hasSummary = recording.summary && recording.summary.length > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      {/* Label (editable) */}
      <View style={styles.labelContainer}>
        {isEditingLabel ? (
          <View style={styles.labelEditRow}>
            <TextInput
              style={[
                styles.labelInput,
                {
                  color: textColor,
                  backgroundColor: isDark ? Colors.cardDark : Colors.card,
                  borderColor: Colors.primary,
                  fontSize: getFontSize('body', textSize),
                },
              ]}
              value={labelText}
              onChangeText={setLabelText}
              placeholder={t.addLabel || '添加標籤...'}
              placeholderTextColor={secondaryColor}
              autoFocus
              onBlur={handleSaveLabel}
              onSubmitEditing={handleSaveLabel}
            />
            <TouchableOpacity onPress={handleSaveLabel} style={styles.saveButton}>
              <Ionicons name="checkmark" size={28} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.labelTouchable}
            onPress={() => setIsEditingLabel(true)}
          >
            <Text
              style={[
                styles.labelText,
                {
                  color: recording.label ? textColor : secondaryColor,
                  fontSize: getFontSize('body', textSize),
                },
              ]}
              numberOfLines={1}
            >
              {recording.label || (t.addLabel || '點擊添加標籤')}
            </Text>
            <Ionicons
              name="pencil"
              size={20}
              color={secondaryColor}
              style={styles.editIcon}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Header Info */}
      <View style={styles.headerInfo}>
        <Text
          style={[
            styles.date,
            { color: textColor, fontSize: getFontSize('body', textSize) },
          ]}
        >
          {format(new Date(recording.createdAt), 'yyyy/MM/dd HH:mm')}
        </Text>
        <Text
          style={[
            styles.duration,
            { color: secondaryColor, fontSize: getFontSize('small', textSize) },
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
        {isProcessing ? (
          <View style={styles.emptyContent}>
            <Text
              style={[
                styles.emptyText,
                { color: secondaryColor, fontSize: getFontSize('body', textSize) },
              ]}
            >
              {recording.status === 'processing_notes'
                ? t.takingNotes
                : recording.status === 'processing_summary'
                  ? t.findingKeyPoints
                  : t.processing}
            </Text>
          </View>
        ) : recording.status === 'recorded' ? (
          <View style={styles.emptyContent}>
            <Text
              style={[
                styles.emptyText,
                { color: secondaryColor, fontSize: getFontSize('body', textSize) },
              ]}
            >
              {t.recordingSaved}
            </Text>
          </View>
        ) : activeTab === 'summary' && hasSummary ? (
          <View style={styles.viewWrapper}>
            <SummaryView summary={recording.summary!} />
          </View>
        ) : activeTab === 'notes' && hasNotes ? (
          <View style={styles.viewWrapper}>
            <NotesView
              notes={recording.notes!}
              onLinePress={handleNoteLinePress}
              currentTimestamp={position}
            />
          </View>
        ) : (
          <View style={styles.emptyContent}>
            <Text
              style={[
                styles.emptyText,
                { color: secondaryColor, fontSize: getFontSize('body', textSize) },
              ]}
            >
              {t.error}
            </Text>
          </View>
        )}
      </View>

      {/* Processing/Action Buttons */}
      <View style={styles.actionButtons}>
        {recording.status === 'recorded' && !isProcessing && (
          <BigButton
            title={t.transcribe}
            onPress={handleTranscribe}
            variant="primary"
            style={styles.actionButton}
          />
        )}

        {(recording.status === 'notes_ready' || hasNotes) && !hasSummary && !isProcessing && (
          <BigButton
            title={t.summarize}
            onPress={handleSummarize}
            variant="primary"
            style={styles.actionButton}
          />
        )}

        {(recording.status === 'ready' || (hasNotes && hasSummary)) && (
          <BigButton
            title={t.share}
            onPress={() => setShowShareModal(true)}
            variant="playback"
            style={styles.actionButton}
          />
        )}

        {/* Delete button always available (except during processing) */}
        {!isProcessing && (
          <BigButton
            title={t.delete}
            onPress={() => setShowDeleteConfirm(true)}
            variant="danger"
            style={styles.actionButton}
          />
        )}
      </View>

      {/* Transcribe Confirmation */}
      <ConfirmDialog
        visible={showTranscribeConfirm}
        title={t.transcribePromptTitle}
        message={`${t.transcribePromptMessage.replace('{minutes}', Math.ceil((recording?.duration || 0) / 60).toString())}\n${t.aiMinutesRemaining.replace('{remaining}', usage?.ai_minutes_remaining === -1 ? t.unlimited : (usage?.ai_minutes_remaining?.toString() || '0'))}`}
        confirmText={t.confirm}
        cancelText={t.cancel}
        onConfirm={performTranscription}
        onCancel={() => setShowTranscribeConfirm(false)}
        variant="primary"
      />

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
  labelContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  labelEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  labelInput: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontWeight: '600',
    minHeight: 48, // Senior-friendly touch target
  },
  saveButton: {
    padding: 12,
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    minHeight: 48, // Senior-friendly touch target
  },
  labelText: {
    fontWeight: '600',
  },
  editIcon: {
    marginLeft: 10,
  },
  headerInfo: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 20,
  },
  date: {
    fontWeight: '700',
    marginBottom: 4,
  },
  duration: {
    fontWeight: '500',
  },
  playbackControls: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 16,
  },
  speedControlContainer: {
    marginTop: 8,
  },
  tabContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 12,
    minHeight: 200, // Ensure minimum height
  },
  viewWrapper: {
    flex: 1,
    minHeight: 200, // Ensure minimum height
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    textAlign: 'center',
    lineHeight: 28,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  actionButton: {
    flex: 1,
    minWidth: 120, // Ensure buttons don't get too narrow
  },
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  notFoundText: {
    textAlign: 'center',
    lineHeight: 28,
  },
});
