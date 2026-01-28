import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  Alert,
  TouchableOpacity,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { Colors } from '@/constants/Colors';
import { useAppStore } from '@/store';
import { useI18n, useAudioPlayer, useTheme } from '@/hooks';
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
import { getFontSize, Recording, NoteLine, parseNotes, parseSummary } from '@/types';
import { File } from 'expo-file-system/next';
import {
  checkComprehensiveUsage,
  processRecording as processRecordingApi,
  summarizeRecording as summarizeRecordingApi,
  fetchRecordingById,
  deleteAudio,
  deleteAudioChunks,
  hardDeleteRecordingFromDb,
  ComprehensiveUsage,
} from '@/services/supabase';
import { useAuth } from '@/hooks';

type ViewTab = 'summary' | 'notes';

export default function RecordingDetailScreen() {
  const { isDark, colors } = useTheme();
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
  const [usageLoadFailed, setUsageLoadFailed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingRecording, setIsLoadingRecording] = useState(!recording);
  const [isDeleting, setIsDeleting] = useState(false);

  // Spinning animation for processing indicator
  const spinAnim = useRef(new Animated.Value(0)).current;
  const isMountedRef = useRef<boolean>(true);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollAttemptCountRef = useRef<number>(0);
  const POLL_INTERVAL_MS = 2000; // 2 seconds between polls
  const MAX_POLL_ATTEMPTS = 90; // 3 minutes at 2-second intervals

  // Track mount state for async operations
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isProcessing) {
      // Start continuous spinning animation
      const spin = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      spin.start();
      return () => {
        spin.stop();
        spinAnim.setValue(0); // Reset animation value on cleanup
      };
    } else {
      spinAnim.setValue(0);
    }
  }, [isProcessing, spinAnim]);

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

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

  const { background: backgroundColor, text: textColor, textSecondary: secondaryColor } = colors;

  // Stop playback when navigating away from the screen
  // This is important for senior users who might get confused by audio playing in the background
  useFocusEffect(
    useCallback(() => {
      // Screen focused - do nothing (audio continues if it was playing)
      return () => {
        // Screen unfocused (navigating away) - stop playback
        console.log('[Detail] Screen unfocused, pausing audio');
        pause();
      };
    }, [pause])
  );

  // Load audio when recording changes
  // Note: Use audioChunks?.length instead of the array itself to avoid
  // unnecessary re-triggers from reference changes during status updates
  useEffect(() => {
    if (!recording) return;

    console.log('[Detail] Loading recording:', recording.id, 'chunks:', recording.audioChunks?.length || 1);

    loadAudio(recording);

    return () => {
      unloadAudio();
    };
  }, [recording?.id, recording?.audioUri, recording?.audioRemoteUrl, recording?.audioChunks?.length, loadAudio, unloadAudio]);

  // Log when audio loading state changes
  useEffect(() => {
    console.log('[Detail] Audio isLoaded changed:', isLoaded);
  }, [isLoaded]);

  // Mark first recording education as seen
  useEffect(() => {
    if (!settings.hasSeenFirstRecordingEducation && recording) {
      markFirstRecordingEducationSeen();
    }
  }, [settings.hasSeenFirstRecordingEducation, recording, markFirstRecordingEducationSeen]);

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
  }, [id, recording]);

  // Load usage data
  useEffect(() => {
    let cancelled = false;

    const loadUsage = async () => {
      if (user?.id) {
        try {
          setUsageLoadFailed(false);
          const usageData = await checkComprehensiveUsage(user.id);
          // Only update state if not cancelled
          if (!cancelled) {
            setUsage(usageData);
          }
        } catch (error) {
          console.error('Failed to load usage:', error);
          if (!cancelled) {
            setUsageLoadFailed(true);
          }
        }
      }
    };
    loadUsage();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Fetch recording data from database on mount to ensure we have latest notes/summary
  // This also handles the case where the store hasn't hydrated yet after page refresh
  useEffect(() => {
    let cancelled = false;

    const loadRecordingData = async () => {
      if (!id) return;

      setIsLoadingRecording(true);
      try {
        const dbRecording = await fetchRecordingById(id);

        // Check if effect was cancelled (component unmounted or id changed)
        if (cancelled) return;

        if (dbRecording) {
          // Validate and sanitize database response
          const validatedNotes = Array.isArray(dbRecording.notes)
            ? dbRecording.notes.filter((note): note is NoteLine =>
                typeof note === 'object' &&
                note !== null &&
                'id' in note &&
                'timestamp' in note &&
                'text' in note &&
                typeof note.text === 'string'
              )
            : undefined;

          const validatedSummary = Array.isArray(dbRecording.summary)
            ? dbRecording.summary.filter((item): item is string => typeof item === 'string')
            : undefined;

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
              status: dbRecording.status as Recording['status'],
              notes: validatedNotes,
              summary: validatedSummary,
            });
          } else {
            // Otherwise just update it
            updateRecording(id, {
              status: dbRecording.status as Recording['status'],
              notes: validatedNotes,
              summary: validatedSummary,
              audioRemoteUrl: dbRecording.audio_url || undefined,
            });
          }
        }
      } catch (error) {
        console.error('[Detail] Error fetching recording data:', error);
      } finally {
        if (!cancelled) {
          setIsLoadingRecording(false);
        }
      }
    };

    loadRecordingData();

    return () => {
      cancelled = true;
    };
  // recordings excluded intentionally - we only want to fetch on id change, not on store updates
  // addRecording/updateRecording are stable Zustand actions
  }, [id, addRecording, updateRecording]);

  // Poll for processing status updates
  useEffect(() => {
    if (!recording || !id) return;

    const isCurrentlyProcessing =
      recording.status === 'processing_notes' || recording.status === 'processing_summary';

    if (isCurrentlyProcessing) {
      setIsProcessing(true);
      pollAttemptCountRef.current = 0; // Reset counter when starting polling

      // Clear any existing interval before creating a new one
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      const pollInterval = setInterval(async () => {
        // Guard against state update after unmount
        if (!isMountedRef.current) {
          console.log('[RecordingDetail] Component unmounted, stopping polling');
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          return;
        }

        // Check if we've exceeded max poll attempts
        pollAttemptCountRef.current++;
        if (pollAttemptCountRef.current > MAX_POLL_ATTEMPTS) {
          console.log('[RecordingDetail] Max poll attempts reached, stopping polling');
          setIsProcessing(false);
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          return;
        }

        try {
          const dbRecording = await fetchRecordingById(id);

          // Check again after async operation
          if (!isMountedRef.current) return;

          if (dbRecording) {
            // Validate and sanitize database response
            const validatedNotes = Array.isArray(dbRecording.notes)
              ? dbRecording.notes.filter((note): note is NoteLine =>
                  typeof note === 'object' &&
                  note !== null &&
                  'id' in note &&
                  'timestamp' in note &&
                  'text' in note &&
                  typeof note.text === 'string'
                )
              : undefined;

            const validatedSummary = Array.isArray(dbRecording.summary)
              ? dbRecording.summary.filter((item): item is string => typeof item === 'string')
              : undefined;

            // Validate status is a known value before casting
            const validStatuses: Recording['status'][] = [
              'recorded', 'uploading', 'processing_notes', 'processing_summary',
              'notes_ready', 'ready', 'error'
            ];
            const validatedStatus = validStatuses.includes(dbRecording.status as Recording['status'])
              ? (dbRecording.status as Recording['status'])
              : recording?.status || 'recorded';

            updateRecording(id, {
              status: validatedStatus,
              notes: validatedNotes,
              summary: validatedSummary,
            });

            // Stop polling if processing is complete
            if (dbRecording.status === 'ready' || dbRecording.status === 'notes_ready' || dbRecording.status === 'error') {
              setIsProcessing(false);
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
              }
            }
          }
        } catch (error) {
          console.error('Error polling for updates:', error);
        }
      }, POLL_INTERVAL_MS);

      // Store interval in ref
      pollingIntervalRef.current = pollInterval;

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };
    } else {
      setIsProcessing(false);
      // Clear interval if status is not processing
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
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

  // Format duration with bounds checking
  const formatDuration = (seconds: number): string => {
    // Clamp to valid range (0 to ~100 hours max)
    const validSeconds = Math.max(0, Math.min(Math.floor(seconds), 359999));
    const hours = Math.floor(validSeconds / 3600);
    const minutes = Math.floor((validSeconds % 3600) / 60);
    const secs = validSeconds % 60;

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
    const rawPositionMs = (timestamp || 0) * 1000;

    // Clamp position to valid range to handle potentially malformed timestamps from API
    const maxPositionMs = (recording?.duration || 0) * 1000;
    const positionMs = Math.max(0, Math.min(rawPositionMs, maxPositionMs));

    if (rawPositionMs !== positionMs) {
      console.warn('[NotePress] Timestamp out of bounds, clamped:', { raw: rawPositionMs, clamped: positionMs });
    }

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
    // Validate recording ID and user exists before attempting delete
    if (!recording?.id || !user?.id) {
      console.error('[Delete] Cannot delete recording without valid ID or user');
      setShowDeleteConfirm(false);
      return;
    }

    setShowDeleteConfirm(false);
    setIsDeleting(true);

    const recordingId = recording.id;
    const userId = user.id;
    const chunkCount = recording.audioChunks?.length || 0;

    console.log(`[Delete] Starting complete erasure for recording ${recordingId}`);

    try {
      // 1. Delete from Supabase Storage (audio files)
      // This removes the actual audio data from remote storage
      try {
        if (chunkCount > 1) {
          // Multi-chunk recording (VIP long recordings)
          console.log(`[Delete] Deleting ${chunkCount} audio chunks from storage`);
          await deleteAudioChunks(userId, recordingId, chunkCount);
        } else {
          // Single file recording
          console.log('[Delete] Deleting audio file from storage');
          await deleteAudio(userId, recordingId);
        }
        console.log('[Delete] Remote audio deleted successfully');
      } catch (storageError) {
        // Log but continue - local data should still be cleaned up
        console.warn('[Delete] Failed to delete remote audio (may not exist):', storageError);
      }

      // 2. Hard delete from database (removes transcript, summary, all metadata)
      // This is GDPR-compliant complete erasure
      try {
        console.log('[Delete] Hard deleting database record');
        await hardDeleteRecordingFromDb(recordingId);
        console.log('[Delete] Database record deleted successfully');
      } catch (dbError) {
        // Log but continue with local cleanup
        console.warn('[Delete] Failed to delete database record:', dbError);
      }

      // 3. Delete local audio files (native platforms only)
      if (Platform.OS !== 'web') {
        // Delete main audio file
        if (recording.audioUri) {
          try {
            const file = new File(recording.audioUri);
            if (file.exists) {
              file.delete();
              console.log('[Delete] Deleted local audio file');
            }
          } catch (error) {
            console.warn('[Delete] Failed to delete local audio file:', error);
          }
        }

        // Delete chunk files if present
        if (recording.audioChunks && recording.audioChunks.length > 0) {
          for (const chunkPath of recording.audioChunks) {
            try {
              const chunkFile = new File(chunkPath);
              if (chunkFile.exists) {
                chunkFile.delete();
                console.log('[Delete] Deleted local chunk file:', chunkPath);
              }
            } catch (error) {
              console.warn('[Delete] Failed to delete local chunk:', error);
            }
          }
        }
      }

      console.log('[Delete] Complete erasure finished successfully');
    } catch (error) {
      console.error('[Delete] Error during deletion:', error);
      // Still proceed with local cleanup even if remote fails
    } finally {
      // 4. Always remove from local store and navigate back
      // This ensures UI is updated even if remote operations failed
      if (isMountedRef.current) {
        setIsDeleting(false);
      }
      deleteRecording(recordingId);
      router.back();
    }
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

    // CRITICAL: Get the original URL from database, then refresh it
    // The stored URL contains the exact file path; refreshing generates a new valid signed URL
    let audioUrl: string;
    try {
      // First, get the stored URL from database (contains correct file path)
      let storedUrl = recording.audioRemoteUrl;
      if (!storedUrl) {
        console.log('[Transcribe] No local URL, fetching from database...');
        const dbRecording = await fetchRecordingById(recording.id);
        storedUrl = dbRecording?.audio_url ?? undefined;
      }

      if (!storedUrl) {
        console.error('[Transcribe] No audio URL found in database');
        Alert.alert(t.error, t.recordingNotUploaded);
        return;
      }

      console.log('[Transcribe] Stored URL:', storedUrl.substring(0, 80) + '...');

      // Refresh the signed URL (extracts path from stored URL and creates new signed URL)
      const { refreshSignedUrl } = await import('@/services/supabase');
      audioUrl = await refreshSignedUrl(storedUrl);
      console.log('[Transcribe] Fresh audio URL generated:', audioUrl.substring(0, 80) + '...');
    } catch (error) {
      console.error('[Transcribe] Error generating fresh audio URL:', error);
      Alert.alert(t.error, t.failedToGetAudioFile);
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

    // Validate recording duration before making API call
    if (!recording.duration || recording.duration <= 0 || !Number.isFinite(recording.duration)) {
      console.error('[Transcription] Invalid recording duration:', recording.duration);
      Alert.alert(t.error, t.tryAgain);
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
          status: updatedRecording.status as Recording['status'],
          notes: parseNotes(updatedRecording.notes),
          summary: parseSummary(updatedRecording.summary),
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
              const result = await summarizeRecordingApi(
                recording.id,
                user.id,
                settings.language
              );

              // Check mount state after async operation
              if (!isMountedRef.current) return;

              if (!result.success) {
                console.error('Summarization failed:', result.error);
                Alert.alert(t.error, result.error || t.tryAgain);
                updateRecording(recording.id, { status: 'ready' });
                setIsProcessing(false);
                return;
              }

              // Fetch the updated recording to get the summary
              const updatedRecording = await fetchRecordingById(recording.id);

              // Check mount state after second async operation
              if (!isMountedRef.current) return;

              if (updatedRecording) {
                updateRecording(recording.id, {
                  status: updatedRecording.status as Recording['status'],
                  summary: parseSummary(updatedRecording.summary),
                });
              }

              setIsProcessing(false);
            } catch (error) {
              console.error('Summarization error:', error);
              // Only update state if still mounted
              if (!isMountedRef.current) return;
              Alert.alert(t.error, error instanceof Error ? error.message : t.tryAgain);
              updateRecording(recording.id, { status: 'ready' });
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  // Reset stuck processing - allows user to retry
  const handleResetProcessing = useCallback(() => {
    if (!recording) return;

    Alert.alert(
      t.resetProcessing,
      t.resetProcessingMessage,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.reset,
          style: 'destructive',
          onPress: () => {
            console.log('[Recording] Resetting stuck processing for:', recording.id);
            updateRecording(recording.id, { status: 'recorded' });
            setIsProcessing(false);
          },
        },
      ]
    );
  }, [recording, t, updateRecording]);

  const tabs = [
    { key: 'notes', label: t.notes },
    { key: 'summary', label: t.summary },
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
              placeholder={t.addLabel}
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
              {recording.label || t.addLabel}
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
          {(() => {
            const date = new Date(recording.createdAt);
            return isNaN(date.getTime()) ? '--/--/-- --:--' : format(date, 'yyyy/MM/dd HH:mm');
          })()}
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
          <View style={styles.processingContent}>
            <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
              <Ionicons
                name="sync-outline"
                size={48}
                color={Colors.processing}
              />
            </Animated.View>
            <Text
              style={[
                styles.processingText,
                { color: Colors.processing, fontSize: getFontSize('body', textSize) },
              ]}
            >
              {recording.status === 'processing_notes'
                ? t.takingNotes
                : recording.status === 'processing_summary'
                  ? t.findingKeyPoints
                  : t.processing}
            </Text>
            <Text
              style={[
                styles.processingHint,
                { color: secondaryColor, fontSize: getFontSize('small', textSize) },
              ]}
            >
              {t.mayTakeFewMinutes}
            </Text>
            {/* Reset button for stuck processing */}
            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleResetProcessing}
              accessibilityRole="button"
              accessibilityLabel={t.resetProcessing}
            >
              <Text
                style={[
                  styles.resetButtonText,
                  { fontSize: getFontSize('small', textSize) },
                ]}
              >
                {t.processingStuck}
              </Text>
            </TouchableOpacity>
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
        ) : activeTab === 'summary' && hasNotes && !hasSummary ? (
          // Notes exist but no summary - show helpful message
          <View style={styles.emptyContent}>
            <Text
              style={[
                styles.emptyText,
                { color: secondaryColor, fontSize: getFontSize('body', textSize) },
              ]}
            >
              {t.noSummaryYet}
            </Text>
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

        {/* Delete button always available (except during processing or deleting) */}
        {!isProcessing && (
          <BigButton
            title={isDeleting ? t.deleting : t.delete}
            onPress={() => setShowDeleteConfirm(true)}
            variant="danger"
            style={styles.actionButton}
            disabled={isDeleting}
          />
        )}
      </View>

      {/* Transcribe Confirmation */}
      <ConfirmDialog
        visible={showTranscribeConfirm}
        title={t.transcribePromptTitle}
        message={`${t.transcribePromptMessage.replace('{minutes}', Math.max(1, Math.ceil((recording?.duration || 0) / 60)).toString())}\n${t.aiMinutesRemaining.replace('{remaining}', usage?.ai_minutes_remaining === -1 ? t.unlimited : (usage?.ai_minutes_remaining?.toString() || '0'))}`}
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
  processingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  processingText: {
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 8,
  },
  processingHint: {
    textAlign: 'center',
    opacity: 0.7,
  },
  resetButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: 'rgba(183, 28, 28, 0.1)',
  },
  resetButtonText: {
    color: Colors.error,
    textAlign: 'center',
    fontWeight: '500',
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
