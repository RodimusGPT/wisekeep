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
import * as FileSystem from 'expo-file-system/legacy';
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
  chunkCount: number; // Number of chunks saved (for VIP auto-chunking)
  isChunking: boolean; // True while auto-chunk is in progress
}

export function useRecording(): UseRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [metering, setMetering] = useState(0);
  const [hasPermission, setHasPermission] = useState(false);
  const [chunkCount, setChunkCount] = useState(0); // Tracks saved chunks for UI feedback
  const [isChunking, setIsChunking] = useState(false); // True during auto-chunk save

  // Recorder for native platforms (not used on web)
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const webRecorderRef = useRef<WebMediaRecorder | null>(null);
  const webStreamRef = useRef<WebMediaStream | null>(null);
  const webChunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
  const isStoppingRef = useRef<boolean>(false); // Prevent concurrent stopRecording calls

  const { addRecording, settings, setMicrophonePermission, user, setIsRecording: setGlobalIsRecording, setRecordingDuration: setGlobalDuration } = useAppStore();
  const { t } = useI18n();

  // Sync local recording state to global store for status indicator
  useEffect(() => {
    setGlobalIsRecording(isRecording);
    if (!isRecording) {
      setGlobalDuration(0);
    }
  }, [isRecording, setGlobalIsRecording, setGlobalDuration]);

  // Sync duration to global store
  useEffect(() => {
    if (isRecording) {
      setGlobalDuration(duration);
    }
  }, [duration, isRecording, setGlobalDuration]);

  // Use ref to capture latest t value to avoid stale closures in intervals
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  // Ref for stopRecording to avoid stale closure in permission check interval
  const stopRecordingRef = useRef<() => Promise<Recording | null>>(() => Promise.resolve(null));

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
          // Stop recording gracefully - use ref to get latest stopRecording
          clearInterval(permissionCheckInterval);
          await stopRecordingRef.current();
          if (isMountedRef.current) {
            Alert.alert(
              tRef.current.recordingError,
              tRef.current.microphonePermissionMessage,
              [{ text: tRef.current.confirm }]
            );
          }
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
  }, [isRecording]); // Uses refs for stopRecording and translations

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
        setIsChunking(true); // Show UI indicator

        // Create and track promise immediately to prevent race conditions
        const chunkPromise = handleAutoChunk()
          .catch((error) => {
            console.error('[useRecording] Auto-chunk failed:', error);
            isAutoChunking.current = false;
            setIsChunking(false); // Clear UI indicator on error
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
  }, [isInChunkWindow, isRecording, user]); // duration captured in isInChunkWindow memo

  // Handle auto-chunking for VIP users (invisible to user)
  // Designed to be resilient - tries to continue recording even if chunk save fails
  const handleAutoChunk = useCallback(async () => {
    const chunkIndex = audioChunksRef.current.length;
    const chunkTimestamp = Date.now();
    console.log(`[useRecording] Saving chunk ${chunkIndex + 1}...`);

    // Calculate chunk duration before any operations
    const chunkDuration = Math.floor((chunkTimestamp - startTimeRef.current) / 1000);

    if (Platform.OS === 'web') {
      // WEB: MediaRecorder keeps running, so failures are recoverable
      try {
        if (!webRecorderRef.current || webRecorderRef.current.state === 'inactive') {
          console.warn('[useRecording] Web recorder not active, skipping chunk boundary');
          isAutoChunking.current = false;
          setIsChunking(false);
          return; // Recording continues, will retry at next boundary
        }

        if (webChunksRef.current.length === 0) {
          console.warn('[useRecording] No audio data yet, skipping chunk boundary');
          isAutoChunking.current = false;
          setIsChunking(false);
          return; // Recording continues, data will accumulate
        }

        const blob = new Blob(webChunksRef.current, { type: 'audio/webm' });
        if (blob.size === 0) {
          console.warn('[useRecording] Empty blob, skipping chunk boundary');
          isAutoChunking.current = false;
          setIsChunking(false);
          return; // Recording continues
        }

        const chunkUri = URL.createObjectURL(blob);
        blobUrlsRef.current.add(chunkUri);
        audioChunksRef.current.push(chunkUri);
        totalDurationRef.current += chunkDuration;
        webChunksRef.current = []; // Clear for next segment

        console.log(`[useRecording] Chunk ${chunkIndex + 1} saved (web, ${blob.size} bytes), total: ${totalDurationRef.current}s`);
        startTimeRef.current = Date.now();
        setDuration(0);
        isAutoChunking.current = false;
        setIsChunking(false);
        setChunkCount(prev => prev + 1); // Increment for UI feedback

      } catch (error) {
        console.error('[useRecording] Web chunk save error (continuing):', error);
        isAutoChunking.current = false;
        setIsChunking(false);
        // Don't stop - MediaRecorder is still running, data accumulates
      }

    } else {
      // NATIVE: recorder.stop() is destructive, so we need careful error recovery
      let chunkSaved = false;
      let recorderStopped = false;

      try {
        if (!recorder || !recorder.isRecording) {
          console.warn('[useRecording] Recorder not active, skipping chunk');
          isAutoChunking.current = false;
          setIsChunking(false);
          return;
        }

        // Stop recorder - this is the point of no return
        await recorder.stop();
        recorderStopped = true;

        const uri = recorder.uri;
        if (uri) {
          const fileInfo = await FileSystem.getInfoAsync(uri);
          if (fileInfo.exists) {
            const chunkPath = `${FileSystem.documentDirectory}recordings/${recordingIdRef.current}_chunk${chunkTimestamp}.m4a`;

            await FileSystem.makeDirectoryAsync(
              `${FileSystem.documentDirectory}recordings/`,
              { intermediates: true }
            ).catch(() => {});

            await FileSystem.moveAsync({ from: uri, to: chunkPath });
            audioChunksRef.current.push(chunkPath);
            totalDurationRef.current += chunkDuration;
            chunkSaved = true;
            console.log(`[useRecording] Chunk ${chunkIndex + 1} saved: ${chunkPath}, total: ${totalDurationRef.current}s`);
          }
        }

      } catch (error) {
        console.error('[useRecording] Native chunk save error:', error);
        // Continue to try restarting recorder
      }

      // ALWAYS try to restart recorder if it was stopped
      if (recorderStopped) {
        try {
          // Reconfigure audio session before restarting (required by iOS/Android)
          console.log('[useRecording] Reconfiguring audio session for restart...');
          await setAudioModeAsync({
            allowsRecording: true,
            playsInSilentMode: true,
            interruptionMode: 'doNotMix',
            shouldPlayInBackground: false,
            shouldRouteThroughEarpiece: false,
          });
          await setIsAudioActiveAsync(true);
          console.log('[useRecording] Audio session reconfigured');

          await recorder.prepareToRecordAsync();
          recorder.record();

          if (recorder.isRecording) {
            console.log('[useRecording] Recorder restarted successfully');
            startTimeRef.current = Date.now();
            setDuration(0);
            isAutoChunking.current = false;
            setIsChunking(false);
            setChunkCount(prev => prev + 1);
            return; // Success - recording continues
          }
        } catch (restartError) {
          console.error('[useRecording] Failed to restart recorder:', restartError);
        }

        // Restart failed - this is a fatal error, must stop recording
        console.error('[useRecording] FATAL: Cannot restart recorder, stopping recording');
        isAutoChunking.current = false;
        setIsChunking(false);
        autoChunkPromise.current = null;
        setIsRecording(false);

        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }

        // Preserve what we have
        const savedChunks = [...audioChunksRef.current];
        const savedDuration = totalDurationRef.current;

        if (savedChunks.length > 0 && recordingIdRef.current) {
          const partialRecording: Recording = {
            id: recordingIdRef.current,
            createdAt: new Date().toISOString(),
            duration: savedDuration,
            audioUri: savedChunks[0],
            audioChunks: savedChunks,
            status: 'recorded',
            language: settings.language,
          };
          addRecording(partialRecording);
          console.log('[useRecording] Partial recording saved:', partialRecording.id);
        }

        audioChunksRef.current = [];
        totalDurationRef.current = 0;
        recordingIdRef.current = null;

        if (isMountedRef.current) {
          Alert.alert(
            tRef.current.autoChunkError,
            savedChunks.length > 0
              ? tRef.current.autoChunkErrorPreserved
              : tRef.current.recordingStopError,
            [{ text: tRef.current.confirm }]
          );
        }
      } else {
        // Recorder wasn't stopped, just clear the flag
        isAutoChunking.current = false;
        setIsChunking(false);
      }
    }
  }, [recorder, settings.language, addRecording]);

  const checkPermission = async () => {
    if (Platform.OS === 'web') {
      // Web permission is checked when we actually request the microphone
      if (isMountedRef.current) {
        setHasPermission(true);
        setMicrophonePermission(true);
      }
      return true;
    }
    const { status } = await getRecordingPermissionsAsync();
    const granted = status === 'granted';
    // Only update state if still mounted after async operation
    if (isMountedRef.current) {
      setHasPermission(granted);
      setMicrophonePermission(granted);
    }
    return granted;
  };

  const requestPermission = async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'web') {
        // Request microphone access on web
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Stop immediately, just checking
        if (isMountedRef.current) {
          setHasPermission(true);
          setMicrophonePermission(true);
        }
        return true;
      }
      const { status } = await requestRecordingPermissionsAsync();
      const granted = status === 'granted';
      // Only update state if still mounted after async operation
      if (isMountedRef.current) {
        setHasPermission(granted);
        setMicrophonePermission(granted);
      }
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
        setChunkCount(0); // Reset chunk count for new recording
        setIsChunking(false);
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
  }, [hasPermission, requestPermission]);

  const stopRecording = useCallback(async (): Promise<Recording | null> => {
    // Guard against concurrent stopRecording calls
    if (isStoppingRef.current) {
      console.warn('[useRecording] stopRecording already in progress, ignoring concurrent call');
      return null;
    }
    isStoppingRef.current = true;

    try {
      // Wait for any in-progress auto-chunk to complete before stopping
      // This prevents data loss when user stops during chunk transition
      if (autoChunkPromise.current) {
        console.log('[useRecording] Waiting for auto-chunk to complete before stopping...');
        try {
          await autoChunkPromise.current;
          console.log('[useRecording] Auto-chunk completed, proceeding with stop');
        } catch (chunkError) {
          console.warn('[useRecording] Auto-chunk failed during stop wait:', chunkError);
          // Continue with stop - the chunk error was already handled by handleAutoChunk
        }
      }

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

            // Capture chunks synchronously BEFORE deferring to prevent race conditions
            const chunksSnapshot = [...webChunksRef.current];
            const existingChunksSnapshot = [...audioChunksRef.current];

            // Validate we have audio data
            if (chunksSnapshot.length === 0) {
              reject(new Error('No audio data recorded'));
              return;
            }

            // Defer heavy work to avoid blocking the 'stop' event handler
            queueMicrotask(() => {
              // Create blob for final chunk from captured snapshot
              const blob = new Blob(chunksSnapshot, { type: 'audio/webm' });

              // Validate blob has data
              if (blob.size === 0) {
                reject(new Error('Created blob has zero size'));
                return;
              }
              const finalChunkUri = URL.createObjectURL(blob);
              blobUrlsRef.current.add(finalChunkUri); // Track for cleanup

              // Add final chunk to captured snapshot array (not live ref to prevent race)
              const allChunks = [...existingChunksSnapshot, finalChunkUri];

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
    } finally {
      // Always reset the stopping flag, even if there was an error
      isStoppingRef.current = false;
    }
  }, [addRecording, settings.language]);

  // Keep stopRecording ref updated for use in intervals
  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

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
    chunkCount,
    isChunking,
  };
}
