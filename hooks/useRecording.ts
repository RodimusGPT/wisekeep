import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import {
  useAudioRecorder,
  RecordingPresets,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setIsAudioActiveAsync,
  setAudioModeAsync,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { generateUUID } from '@/utils/uuid';
import { useAppStore } from '@/store';
import { Recording } from '@/types';
import { getChunkDuration, allowsMultiPart } from '@/constants/recording-limits';
import { Alert } from 'react-native';
import { useI18n } from '@/hooks';

// Web-specific types
type WebMediaRecorder = MediaRecorder;
type WebMediaStream = MediaStream;

interface UseRecordingReturn {
  isRecording: boolean;
  duration: number;
  metering: number; // Audio level 0-1
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Recording | null>;
  requestPermission: () => Promise<boolean>;
  hasPermission: boolean;
}

export function useRecording(): UseRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [metering, setMetering] = useState(0);
  const [hasPermission, setHasPermission] = useState(false);

  // Recorder for native platforms (not used on web)
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const webRecorderRef = useRef<WebMediaRecorder | null>(null);
  const webStreamRef = useRef<WebMediaStream | null>(null);
  const webChunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true); // Track component lifecycle for async callbacks
  const blobUrlsRef = useRef<Set<string>>(new Set()); // Track blob URLs for cleanup (web only)

  // Auto-chunking support (invisible to user - chunks combined into one recording)
  const recordingIdRef = useRef<string | null>(null); // ID for current recording session
  const audioChunksRef = useRef<string[]>([]); // Accumulated chunk file paths
  const totalDurationRef = useRef<number>(0); // Total duration across all chunks
  const isAutoChunking = useRef<boolean>(false);
  const lastAutoChunkTime = useRef<number>(0); // Timestamp of last auto-chunk to prevent multiple triggers
  const autoChunkPromise = useRef<Promise<void> | null>(null); // Track ongoing auto-chunk operation

  const { addRecording, settings, setMicrophonePermission, user } = useAppStore();
  const { t } = useI18n();

  // Use ref to capture latest t value to avoid stale closures in intervals
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  // Check permission on mount
  useEffect(() => {
    checkPermission();
  }, []);

  // Periodically check permissions during recording to detect mid-recording revocation
  useEffect(() => {
    if (!isRecording) return;

    const permissionCheckInterval = setInterval(async () => {
      try {
        const { granted } = await getRecordingPermissionsAsync();
        if (!granted) {
          console.warn('[useRecording] Permission revoked mid-recording');
          // Stop recording gracefully
          clearInterval(permissionCheckInterval);
          await stopRecording();
          Alert.alert(
            tRef.current.recordingError,
            tRef.current.microphonePermissionMessage,
            [{ text: tRef.current.confirm }]
          );
        }
      } catch (error) {
        // Permission check errors are non-critical during recording
        // Could be: permission UI shown (iOS), API error, or other temporary issue
        // Fail-open: continue recording rather than interrupt user
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.warn('[useRecording] Permission check failed (non-critical, continuing):', errorMessage);

        // If error specifically indicates permission issue, we could handle it,
        // but for now fail-open is safer to avoid false positives
      }
    }, 5000); // Check every 5 seconds

    return () => {
      clearInterval(permissionCheckInterval);
    };
  }, [isRecording]); // stopRecording is stable, doesn't need to be in deps

  // Memoize chunk duration trigger to avoid re-evaluating effect 100x/sec
  // Only change when duration crosses into/out of trigger window
  const isInChunkWindow = useMemo(() => {
    if (!isRecording || !user) return false;
    const userTier = user.tier || 'free';
    const chunkDuration = getChunkDuration(userTier);
    // Trigger window: ±0.5s around chunk duration
    return duration >= chunkDuration - 0.5 && duration <= chunkDuration + 0.5;
  }, [isRecording, user, duration]);

  // Auto-chunk or stop recording based on duration and tier
  useEffect(() => {
    if (!isRecording || !user || !isInChunkWindow || isAutoChunking.current || autoChunkPromise.current) return;

    const userTier = user.tier || 'free';
    const chunkDuration = getChunkDuration(userTier);
    const canAutoChunk = allowsMultiPart(userTier);

    // Additional debounce check: prevent triggering if we already chunked in last 10 seconds
    const now = Date.now();
    const timeSinceLastChunk = now - lastAutoChunkTime.current;
    const MIN_CHUNK_INTERVAL = 10000; // 10 seconds minimum between chunks

    if (timeSinceLastChunk < MIN_CHUNK_INTERVAL) {
      console.log(`[useRecording] Skipping auto-chunk trigger - only ${(timeSinceLastChunk/1000).toFixed(1)}s since last chunk`);
      return;
    }

    if (canAutoChunk) {
        // VIP: Auto-save chunk and continue recording (invisible to user)
        console.log(`[useRecording] Auto-chunking triggered at ${duration}s, total chunks: ${audioChunksRef.current.length + 1}`);
        // Set flag AND timestamp BEFORE calling to prevent multiple triggers
        isAutoChunking.current = true;
        lastAutoChunkTime.current = now;

        // Create and track promise immediately to prevent race conditions
        const chunkPromise = handleAutoChunk()
          .catch((error) => {
            console.error('[useRecording] Auto-chunk failed:', error);
            isAutoChunking.current = false;
            // Don't reset lastAutoChunkTime - we still want debouncing even on failure
            // Don't stop recording on auto-chunk failure, just log it
          })
          .finally(() => {
            // Only clear if this is still the current promise (prevent race)
            if (autoChunkPromise.current === chunkPromise) {
              autoChunkPromise.current = null;
            }
          });

        // Assign promise immediately after creation (atomic operation)
        autoChunkPromise.current = chunkPromise;
      } else {
        // Normal users: Hard stop at limit
        console.log(`[useRecording] Recording limit reached at ${duration}s, stopping...`);
        stopRecording().then(() => {
          // Guard against executing after unmount
          if (!isMountedRef.current) return;
          Alert.alert(
            tRef.current.recordingComplete,
            tRef.current.recordingLimitReached.replace('{minutes}', Math.floor(chunkDuration / 60).toString()),
            [{ text: tRef.current.confirm }]
          );
        }).catch((error) => {
          // Guard against executing after unmount
          if (!isMountedRef.current) return;
          console.error('[useRecording] Failed to stop recording at limit:', error);
          Alert.alert(
            tRef.current.recordingError,
            tRef.current.recordingStopErrorSaved,
            [{ text: tRef.current.confirm }]
          );
        });
      }
    }
  }, [isInChunkWindow, isRecording, user]); // duration captured in isInChunkWindow memo

  // Handle auto-chunking for VIP users (invisible to user)
  const handleAutoChunk = useCallback(async () => {
    const chunkIndex = audioChunksRef.current.length;
    // Use timestamp-based naming to prevent collision on retry
    const chunkTimestamp = Date.now();
    console.log(`[useRecording] Saving chunk ${chunkIndex + 1}...`);

    try {
      // Calculate chunk duration
      const chunkDuration = Math.floor((chunkTimestamp - startTimeRef.current) / 1000);
      totalDurationRef.current += chunkDuration;

      if (Platform.OS === 'web') {
        // Web: Save current blob, clear for next segment
        if (!webRecorderRef.current || !webRecorderRef.current.state || webRecorderRef.current.state === 'inactive') {
          throw new Error('Web recorder not active');
        }

        // Validate we have data
        if (webChunksRef.current.length === 0) {
          throw new Error('No audio data in current chunk');
        }

        // Create blob from current chunks
        const blob = new Blob(webChunksRef.current, { type: 'audio/webm' });
        if (blob.size === 0) {
          throw new Error('Created blob has zero size');
        }

        const chunkUri = URL.createObjectURL(blob);
        blobUrlsRef.current.add(chunkUri); // Track for cleanup
        audioChunksRef.current.push(chunkUri);

        // Clear chunks for next segment
        webChunksRef.current = [];

        console.log(`[useRecording] Chunk ${chunkIndex + 1} saved (web, ${blob.size} bytes), total duration: ${totalDurationRef.current}s`);
      } else {
        // Native: Stop recorder, move file to chunk location, restart
        if (!recorder || !recorder.isRecording) {
          throw new Error('Recorder not in recording state');
        }

        await recorder.stop();

        const uri = recorder.uri;
        if (!uri) {
          throw new Error('No recording URI after stop');
        }

        // Verify file exists before moving
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (!fileInfo.exists) {
          throw new Error(`Recording file does not exist: ${uri}`);
        }

        // Move to chunk file location (use timestamp to prevent collision on retry)
        const chunkPath = `${FileSystem.documentDirectory}recordings/${recordingIdRef.current}_chunk${chunkTimestamp}.m4a`;

        // Ensure directory exists
        await FileSystem.makeDirectoryAsync(
          `${FileSystem.documentDirectory}recordings/`,
          { intermediates: true }
        ).catch(() => {}); // Ignore if exists

        try {
          await FileSystem.moveAsync({
            from: uri,
            to: chunkPath,
          });
        } catch (moveError) {
          console.error('[useRecording] Failed to move chunk file:', moveError);
          throw new Error(`Failed to move chunk file: ${moveError}`);
        }

        audioChunksRef.current.push(chunkPath);
        console.log(`[useRecording] Chunk ${chunkIndex + 1} saved to ${chunkPath}, total duration: ${totalDurationRef.current}s`);

        // Restart recorder
        await recorder.prepareToRecordAsync();
        recorder.record();

        // Verify recorder restarted
        if (!recorder.isRecording) {
          throw new Error('Failed to restart recorder after chunk');
        }
      }

      // Reset duration timer for next chunk
      startTimeRef.current = Date.now();
      setDuration(0);

      // Only clear flag after successful completion
      isAutoChunking.current = false;
      console.log(`[useRecording] Auto-chunk complete, continuing recording...`);

    } catch (error) {
      console.error('[useRecording] Auto-chunk error:', error);
      isAutoChunking.current = false;

      // On error, stop recording completely and preserve what we have
      setIsRecording(false);

      // Clear timer
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      // Cleanup: Revoke any blob URLs created during this recording session (web only)
      if (Platform.OS === 'web') {
        blobUrlsRef.current.forEach(url => {
          try {
            URL.revokeObjectURL(url);
            console.log('[useRecording] Revoked blob URL on error:', url);
          } catch (revokeError) {
            console.warn('[useRecording] Failed to revoke blob URL:', revokeError);
          }
        });
        blobUrlsRef.current.clear();
      }

      Alert.alert(
        tRef.current.autoChunkError,
        tRef.current.autoChunkErrorPreserved,
        [{ text: tRef.current.confirm }]
      );

      // Don't re-throw - error is already handled and user notified via alert
    }
  }, []); // t is captured via tRef

  const checkPermission = async () => {
    if (Platform.OS === 'web') {
      // Web permission is checked when we actually request the microphone
      setHasPermission(true);
      setMicrophonePermission(true);
      return true;
    }
    const { status } = await getRecordingPermissionsAsync();
    const granted = status === 'granted';
    setHasPermission(granted);
    setMicrophonePermission(granted);
    return granted;
  };

  const requestPermission = async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'web') {
        // Request microphone access on web
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Stop immediately, just checking
        setHasPermission(true);
        setMicrophonePermission(true);
        return true;
      }
      const { status } = await requestRecordingPermissionsAsync();
      const granted = status === 'granted';
      setHasPermission(granted);
      setMicrophonePermission(granted);
      return granted;
    } catch (error) {
      console.error('Error requesting permission:', error);
      return false;
    }
  };

  const startRecording = useCallback(async () => {
    try {
      // Initialize new recording session (not for auto-chunks)
      if (!isAutoChunking.current) {
        recordingIdRef.current = generateUUID();
        audioChunksRef.current = [];
        totalDurationRef.current = 0;
        lastAutoChunkTime.current = 0;
        autoChunkPromise.current = null;
        console.log('[useRecording] Starting new recording session:', recordingIdRef.current);
      } else {
        console.log(`[useRecording] Continuing auto-chunked recording: ${recordingIdRef.current}`);
      }

      // Check/request permission
      if (!hasPermission) {
        const granted = await requestPermission();
        if (!granted) {
          throw new Error('Microphone permission not granted');
        }
      }

      // Web-specific recording using MediaRecorder API
      if (Platform.OS === 'web') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        webStreamRef.current = stream;
        webChunksRef.current = [];

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm',
        });

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            webChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.start(1000); // Collect data every second
        webRecorderRef.current = mediaRecorder;

        // Start duration timer
        startTimeRef.current = Date.now();
        setDuration(0);
        durationIntervalRef.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setDuration(elapsed);
        }, 100);

        setIsRecording(true);
        return;
      }

      // Native recording using expo-audio
      try {
        // Configure audio session for recording (iOS requirement)
        console.log('[useRecording] Configuring audio session...');
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
          interruptionMode: 'doNotMix',
          shouldPlayInBackground: false,
          shouldRouteThroughEarpiece: false,
        });

        // Activate audio session
        await setIsAudioActiveAsync(true);
        console.log('[useRecording] Audio session configured');

        console.log('[useRecording] Preparing to record...');
        await recorder.prepareToRecordAsync();
        console.log('[useRecording] Recorder prepared, starting...');
        recorder.record();

        // Give a brief moment for recording to initialize, then verify
        await new Promise(resolve => setTimeout(resolve, 100));

        console.log('[useRecording] Recording state after start:', {
          isRecording: recorder.isRecording,
          uri: recorder.uri,
          currentTime: recorder.currentTime,
        });

        if (!recorder.isRecording) {
          throw new Error('Recording failed to start - recorder not in recording state');
        }

        console.log('[useRecording] Recording started successfully');
      } catch (recordError) {
        console.error('[useRecording] Failed to prepare/start recorder:', recordError);
        // Provide more specific error message
        throw new Error(`Recording setup failed: ${recordError instanceof Error ? recordError.message : 'Unknown error'}`);
      }

      // Start duration timer (status callback handles updates but we also track start time)
      startTimeRef.current = Date.now();
      setDuration(0);
      durationIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);
      }, 100);

      setIsRecording(true);

      // Haptic feedback
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (hapticError) {
        console.warn('[useRecording] Haptic feedback failed:', hapticError);
        // Non-critical, don't throw
      }

    } catch (error) {
      console.error('Failed to start recording:', error);
      setIsRecording(false);
      throw error;
    }
  }, [hasPermission]);

  const stopRecording = useCallback(async (): Promise<Recording | null> => {
    try {
      // Stop duration timer
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      // Calculate duration of current chunk
      const currentChunkDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);

      // Total duration = accumulated duration + current chunk
      const totalDuration = totalDurationRef.current + currentChunkDuration;

      // Use the recording ID generated at start
      const recordingId = recordingIdRef.current || generateUUID();

      console.log('[useRecording] Stopping recording:', {
        recordingId,
        currentChunkDuration,
        totalAccumulated: totalDurationRef.current,
        totalDuration,
        chunksCount: audioChunksRef.current.length,
      });

      // Web-specific stop recording
      if (Platform.OS === 'web') {
        if (!webRecorderRef.current) {
          return null;
        }

        // Stop the MediaRecorder with timeout
        return new Promise((resolve, reject) => {
          const mediaRecorder = webRecorderRef.current!;

          // Timeout to prevent indefinite hang
          const stopTimeout = setTimeout(() => {
            console.error('[useRecording] MediaRecorder stop timeout');
            // Cleanup on timeout
            if (webStreamRef.current) {
              webStreamRef.current.getTracks().forEach(track => track.stop());
              webStreamRef.current = null;
            }
            reject(new Error('MediaRecorder stop timeout after 5 seconds'));
          }, 5000);

          mediaRecorder.onstop = () => {
            clearTimeout(stopTimeout); // Clear timeout on successful stop
            // Stop all tracks immediately
            if (webStreamRef.current) {
              webStreamRef.current.getTracks().forEach(track => track.stop());
              webStreamRef.current = null;
            }

            // Defer heavy work to avoid blocking the 'stop' event handler
            queueMicrotask(() => {
              // Create blob for final chunk
              const blob = new Blob(webChunksRef.current, { type: 'audio/webm' });
              const finalChunkUri = URL.createObjectURL(blob);
              blobUrlsRef.current.add(finalChunkUri); // Track for cleanup

              // Add final chunk to array
              const allChunks = [...audioChunksRef.current, finalChunkUri];

              // Create recording object with all chunks
              const newRecording: Recording = {
                id: recordingId,
                createdAt: new Date().toISOString(),
                duration: totalDuration,
                audioUri: allChunks[0], // First chunk as primary URI
                status: 'recorded',
                language: settings.language,
                // Include chunks array if this was auto-chunked
                audioChunks: allChunks.length > 1 ? allChunks : undefined,
              };

              console.log('[useRecording] Web recording created:', {
                id: newRecording.id,
                chunks: allChunks.length,
                duration: totalDuration,
              });

              // Add to store
              addRecording(newRecording);

              // Reset state
              webRecorderRef.current = null;
              webChunksRef.current = [];
              audioChunksRef.current = [];
              totalDurationRef.current = 0;
              recordingIdRef.current = null;
              setIsRecording(false);
              setDuration(0);
              setMetering(0);

              resolve(newRecording);
            });
          };

          mediaRecorder.onerror = (event) => {
            reject(new Error('MediaRecorder error'));
          };

          mediaRecorder.stop();
        });
      }

      // Native recording stop using expo-audio
      console.log('[useRecording] Stopping native recording...');
      const recorderCurrentTime = recorder.currentTime;
      console.log('[useRecording] Recorder state before stop:', {
        isRecording: recorder.isRecording,
        uri: recorder.uri,
        currentTime: recorderCurrentTime,
      });

      // Compare wall-clock duration vs recorder's reported time
      console.log('[useRecording] Duration comparison:', {
        currentChunkDuration,
        recorderCurrentTime,
        difference: Math.abs(currentChunkDuration - recorderCurrentTime),
      });

      // Check if recorder is actually recording
      if (!recorder.isRecording) {
        console.warn('[useRecording] Recorder was not in recording state');
        // Still try to stop in case there's partial state
      }

      try {
        await recorder.stop();
        console.log('[useRecording] Recorder stopped successfully');
      } catch (stopError) {
        console.error('[useRecording] Failed to stop recorder:', stopError);
        throw new Error(`Failed to stop recording: ${stopError instanceof Error ? stopError.message : 'Unknown error'}`);
      }

      // Deactivate audio session after stopping
      try {
        await setIsAudioActiveAsync(false);
        console.log('[useRecording] Audio session deactivated');
      } catch (error) {
        console.warn('[useRecording] Failed to deactivate audio session:', error);
        // Non-critical, continue
      }

      const uri = recorder.uri;
      console.log('[useRecording] Recording URI after stop:', uri);

      if (!uri) {
        console.error('[useRecording] No recording URI available after stopping');
        throw new Error('No recording URI - recording may have failed to capture audio');
      }

      // Save final chunk to permanent location
      const chunkIndex = audioChunksRef.current.length;
      const finalChunkPath = `${FileSystem.documentDirectory}recordings/${recordingId}_chunk${chunkIndex}.m4a`;
      console.log('[useRecording] Moving final chunk from:', uri, 'to:', finalChunkPath);

      // Ensure directory exists
      try {
        await FileSystem.makeDirectoryAsync(
          `${FileSystem.documentDirectory}recordings/`,
          { intermediates: true }
        );
      } catch (dirError) {
        console.warn('[useRecording] Directory may already exist:', dirError);
      }

      let finalChunkUri: string;
      try {
        await FileSystem.moveAsync({
          from: uri,
          to: finalChunkPath,
        });
        console.log('[useRecording] Final chunk moved successfully');
        finalChunkUri = finalChunkPath;

        // Verify file size
        const fileInfo = await FileSystem.getInfoAsync(finalChunkPath);
        if (fileInfo.exists && 'size' in fileInfo) {
          const fileSizeMB = (fileInfo.size as number) / 1024 / 1024;
          console.log('[useRecording] Final chunk size:', fileSizeMB.toFixed(2), 'MB');
        }
      } catch (moveError) {
        console.error('[useRecording] Failed to move final chunk:', moveError);
        console.log('[useRecording] Using original URI instead');
        finalChunkUri = uri;
      }

      // Combine all chunks (previous chunks + final chunk)
      const allChunks = [...audioChunksRef.current, finalChunkUri];

      // Create recording object with all chunks
      const newRecording: Recording = {
        id: recordingId,
        createdAt: new Date().toISOString(),
        duration: totalDuration,
        audioUri: allChunks[0], // First chunk as primary URI
        status: 'recorded',
        language: settings.language,
        // Include chunks array if this was auto-chunked
        audioChunks: allChunks.length > 1 ? allChunks : undefined,
      };

      console.log('[useRecording] Native recording created:', {
        id: recordingId,
        chunks: allChunks.length,
        totalDuration,
        currentChunkDuration,
        recorderTime: recorderCurrentTime,
      });

      // Add to store
      addRecording(newRecording);

      // Reset all state
      audioChunksRef.current = [];
      totalDurationRef.current = 0;
      recordingIdRef.current = null;
      setIsRecording(false);
      setDuration(0);
      setMetering(0);

      // Haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      return newRecording;

    } catch (error) {
      console.error('Failed to stop recording:', error);
      setIsRecording(false);
      setDuration(0);
      setMetering(0);
      // Reset auto-chunk state on error to prevent stuck state
      isAutoChunking.current = false;
      autoChunkPromise.current = null;
      throw error;
    }
  }, [addRecording, settings.language]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[useRecording] Component unmounting, cleaning up...');
      isMountedRef.current = false; // Mark component as unmounted

      // Clear duration timer
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      // Web cleanup
      if (Platform.OS === 'web') {
        // Stop recorder
        if (webRecorderRef.current && webRecorderRef.current.state !== 'inactive') {
          try {
            webRecorderRef.current.stop();
          } catch (e) {
            console.warn('[useRecording] Error stopping web recorder:', e);
          }
        }

        // Stop media stream
        if (webStreamRef.current) {
          webStreamRef.current.getTracks().forEach(track => {
            try {
              track.stop();
            } catch (e) {
              console.warn('[useRecording] Error stopping track:', e);
            }
          });
        }

        // Revoke all tracked blob URLs to prevent memory leaks
        blobUrlsRef.current.forEach(url => {
          try {
            URL.revokeObjectURL(url);
          } catch (e) {
            console.warn('[useRecording] Error revoking blob URL:', e);
          }
        });
        blobUrlsRef.current.clear();
      }

      // Native cleanup - check actual recorder state, not component state
      if (Platform.OS !== 'web' && recorder) {
        if (recorder.isRecording) {
          recorder.stop().catch((e) => {
            console.warn('[useRecording] Error stopping recorder on cleanup:', e);
          });
        }
      }

      // Clear all refs to prevent memory leaks and state corruption
      audioChunksRef.current = [];
      totalDurationRef.current = 0;
      recordingIdRef.current = null;
      isAutoChunking.current = false;
      autoChunkPromise.current = null;
      webChunksRef.current = [];
      webRecorderRef.current = null;
      webStreamRef.current = null;
      blobUrlsRef.current.clear();

      console.log('[useRecording] Cleanup complete');
    };
  }, []);

  return {
    isRecording,
    duration,
    metering,
    startRecording,
    stopRecording,
    requestPermission,
    hasPermission,
  };
}
