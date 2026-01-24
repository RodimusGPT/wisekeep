import { useState, useRef, useCallback, useEffect } from 'react';
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

  // Multi-part recording tracking
  const currentPartNumber = useRef<number>(1);
  const parentRecordingId = useRef<string | null>(null);
  const isAutoChunking = useRef<boolean>(false);

  const { addRecording, settings, setMicrophonePermission, user } = useAppStore();

  // Check permission on mount
  useEffect(() => {
    checkPermission();
  }, []);

  // Auto-chunk or stop recording based on duration and tier
  useEffect(() => {
    if (!isRecording || !user) return;

    const userTier = user.tier || 'free';
    const chunkDuration = getChunkDuration(userTier);
    const canAutoChunk = allowsMultiPart(userTier);

    // Check if we've reached the chunk duration
    if (duration >= chunkDuration) {
      if (canAutoChunk) {
        // VIP: Auto-save chunk and continue recording
        console.log(`[useRecording] Auto-chunking: Part ${currentPartNumber.current} complete at ${duration}s`);
        isAutoChunking.current = true;
        handleAutoChunk();
      } else {
        // Normal users: Hard stop at limit
        console.log(`[useRecording] Recording limit reached at ${duration}s, stopping...`);
        stopRecording().then(() => {
          Alert.alert(
            '錄音已完成',
            `錄音已達到 ${Math.floor(chunkDuration / 60)} 分鐘上限。\n\n升級為 VIP 會員即可無限制錄音！`,
            [{ text: '確定' }]
          );
        });
      }
    }
  }, [duration, isRecording, user]);

  // Handle auto-chunking for VIP users
  const handleAutoChunk = useCallback(async () => {
    try {
      console.log(`[useRecording] Saving chunk ${currentPartNumber.current}...`);

      // Stop current recording and save it
      const recording = await stopRecording();

      if (recording) {
        // Set parent ID if this is the first part
        if (currentPartNumber.current === 1) {
          parentRecordingId.current = recording.id;
        }

        currentPartNumber.current += 1;

        // Brief pause to ensure clean state
        await new Promise(resolve => setTimeout(resolve, 500));

        // Continue recording next part
        console.log(`[useRecording] Starting part ${currentPartNumber.current}...`);
        await startRecording();
        isAutoChunking.current = false;
      }
    } catch (error) {
      console.error('[useRecording] Auto-chunk error:', error);
      isAutoChunking.current = false;
      Alert.alert('錄音錯誤', '自動分段失敗，請重新開始錄音。');
    }
  }, []);

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
      // Reset multi-part tracking for new recordings (not auto-chunks)
      if (!isAutoChunking.current) {
        currentPartNumber.current = 1;
        parentRecordingId.current = null;
        console.log('[useRecording] Starting new recording session');
      } else {
        console.log(`[useRecording] Continuing multi-part recording (part ${currentPartNumber.current})`);
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
      // If this is a manual stop (not auto-chunk), we should mark total parts on the parent recording
      const isManualStop = !isAutoChunking.current;
      const isMultiPart = currentPartNumber.current > 1 || parentRecordingId.current;

      // Stop duration timer
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      // Calculate final duration
      const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const recordingId = generateUUID();

      // Web-specific stop recording
      if (Platform.OS === 'web') {
        if (!webRecorderRef.current) {
          return null;
        }

        // Stop the MediaRecorder
        return new Promise((resolve, reject) => {
          const mediaRecorder = webRecorderRef.current!;

          mediaRecorder.onstop = () => {
            // Stop all tracks immediately
            if (webStreamRef.current) {
              webStreamRef.current.getTracks().forEach(track => track.stop());
              webStreamRef.current = null;
            }

            // Defer heavy work to avoid blocking the 'stop' event handler
            // This prevents the "[Violation] 'stop' handler took Xms" warning
            queueMicrotask(() => {
              // Create blob from chunks
              const blob = new Blob(webChunksRef.current, { type: 'audio/webm' });
              const audioUri = URL.createObjectURL(blob);

              // Create recording object
              const newRecording: Recording = {
                id: recordingId,
                createdAt: new Date().toISOString(),
                duration: finalDuration,
                audioUri: audioUri,
                status: 'recorded', // Will be uploaded next, not processing yet
                language: settings.language,
                // Multi-part metadata
                partNumber: currentPartNumber.current > 1 || parentRecordingId.current ? currentPartNumber.current : undefined,
                parentRecordingId: parentRecordingId.current || undefined,
                totalParts: isManualStop && isMultiPart ? currentPartNumber.current : undefined,
              };

              // Add to store
              addRecording(newRecording);

              // Reset state
              webRecorderRef.current = null;
              webChunksRef.current = [];
              setIsRecording(false);
              setDuration(0);
              setMetering(0);

              // Reset multi-part tracking if manual stop
              if (isManualStop) {
                currentPartNumber.current = 1;
                parentRecordingId.current = null;
              }

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
        wallClockDuration: finalDuration,
        recorderCurrentTime: recorderCurrentTime,
        difference: Math.abs(finalDuration - recorderCurrentTime),
      });

      // Prefer recorder's reported time if available and reasonable
      const effectiveDuration = recorderCurrentTime > 0 ? Math.floor(recorderCurrentTime) : finalDuration;

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

      // Move file to permanent location
      const permanentUri = `${FileSystem.documentDirectory}recordings/${recordingId}.m4a`;
      console.log('[useRecording] Moving file from:', uri, 'to:', permanentUri);

      // Ensure directory exists
      try {
        await FileSystem.makeDirectoryAsync(
          `${FileSystem.documentDirectory}recordings/`,
          { intermediates: true }
        );
      } catch (dirError) {
        console.warn('[useRecording] Directory may already exist:', dirError);
        // Directory might already exist, continue
      }

      try {
        await FileSystem.moveAsync({
          from: uri,
          to: permanentUri,
        });
        console.log('[useRecording] File moved successfully');

        // Verify file size after move
        const fileInfo = await FileSystem.getInfoAsync(permanentUri);
        if (fileInfo.exists && 'size' in fileInfo) {
          const fileSizeMB = (fileInfo.size as number) / 1024 / 1024;
          // Estimate expected size: M4A voice ~8KB/s to 16KB/s
          const expectedMinSize = effectiveDuration * 8 * 1024; // 64 kbps
          const expectedMaxSize = effectiveDuration * 16 * 1024; // 128 kbps
          console.log('[useRecording] File verification:', {
            actualSizeBytes: fileInfo.size,
            actualSizeMB: fileSizeMB.toFixed(2),
            expectedMinBytes: expectedMinSize,
            expectedMaxBytes: expectedMaxSize,
            durationSeconds: effectiveDuration,
          });

          if ((fileInfo.size as number) < expectedMinSize * 0.5) {
            console.warn('[useRecording] WARNING: File appears too small for recorded duration!');
          }
        }
      } catch (moveError) {
        console.error('[useRecording] Failed to move file:', moveError);
        // Try to use original URI if move fails
        console.log('[useRecording] Using original URI instead');

        // Create recording with original URI
        const newRecording: Recording = {
          id: recordingId,
          createdAt: new Date().toISOString(),
          duration: effectiveDuration,
          audioUri: uri, // Use original URI
          status: 'recorded',
          language: settings.language,
          // Multi-part metadata
          partNumber: currentPartNumber.current > 1 || parentRecordingId.current ? currentPartNumber.current : undefined,
          parentRecordingId: parentRecordingId.current || undefined,
          totalParts: isManualStop && isMultiPart ? currentPartNumber.current : undefined,
        };

        addRecording(newRecording);
        setIsRecording(false);
        setDuration(0);
        setMetering(0);

        // Reset multi-part tracking if manual stop
        if (isManualStop) {
          currentPartNumber.current = 1;
          parentRecordingId.current = null;
        }

        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return newRecording;
      }

      // Create recording object
      const newRecording: Recording = {
        id: recordingId,
        createdAt: new Date().toISOString(),
        duration: effectiveDuration,
        audioUri: permanentUri,
        status: 'recorded', // Will be uploaded next, not processing yet
        language: settings.language,
        // Multi-part metadata
        partNumber: currentPartNumber.current > 1 || parentRecordingId.current ? currentPartNumber.current : undefined,
        parentRecordingId: parentRecordingId.current || undefined,
        totalParts: isManualStop && isMultiPart ? currentPartNumber.current : undefined,
      };

      console.log('[useRecording] Created recording:', {
        id: recordingId,
        effectiveDuration,
        wallClockDuration: finalDuration,
        recorderTime: recorderCurrentTime,
        partNumber: newRecording.partNumber,
        parentRecordingId: newRecording.parentRecordingId,
        totalParts: newRecording.totalParts,
      });

      // Add to store
      addRecording(newRecording);

      // Reset state
      setIsRecording(false);
      setDuration(0);
      setMetering(0);

      // Reset multi-part tracking if manual stop
      if (isManualStop) {
        currentPartNumber.current = 1;
        parentRecordingId.current = null;
      }

      // Haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      return newRecording;

    } catch (error) {
      console.error('Failed to stop recording:', error);
      setIsRecording(false);
      setDuration(0);
      setMetering(0);
      throw error;
    }
  }, [addRecording, settings.language]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      // Web cleanup
      if (webRecorderRef.current && webRecorderRef.current.state !== 'inactive') {
        webRecorderRef.current.stop();
      }
      if (webStreamRef.current) {
        webStreamRef.current.getTracks().forEach(track => track.stop());
      }
      // Native cleanup
      if (recorder && isRecording) {
        recorder.stop().catch(console.error);
      }
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
