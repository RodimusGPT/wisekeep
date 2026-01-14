import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import {
  useAudioRecorder,
  RecordingOptions,
  RecordingPresets,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  RecorderState
} from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { generateUUID } from '@/utils/uuid';
import { useAppStore } from '@/store';
import { Recording } from '@/types';

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

  const { addRecording, settings, setMicrophonePermission } = useAppStore();

  // Check permission on mount
  useEffect(() => {
    checkPermission();
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
      // Prepare and start recording
      await recorder.prepareToRecordAsync();
      recorder.record();

      // Start duration timer (status callback handles updates but we also track start time)
      startTimeRef.current = Date.now();
      setDuration(0);
      durationIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);
      }, 100);

      setIsRecording(true);

      // Haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    } catch (error) {
      console.error('Failed to start recording:', error);
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
            // Stop all tracks
            if (webStreamRef.current) {
              webStreamRef.current.getTracks().forEach(track => track.stop());
              webStreamRef.current = null;
            }

            // Create blob from chunks
            const blob = new Blob(webChunksRef.current, { type: 'audio/webm' });
            const audioUri = URL.createObjectURL(blob);

            // Create recording object
            const newRecording: Recording = {
              id: recordingId,
              createdAt: new Date().toISOString(),
              duration: finalDuration,
              audioUri: audioUri,
              status: 'processing_notes',
              language: settings.language,
            };

            // Add to store
            addRecording(newRecording);

            // Reset state
            webRecorderRef.current = null;
            webChunksRef.current = [];
            setIsRecording(false);
            setDuration(0);
            setMetering(0);

            resolve(newRecording);
          };

          mediaRecorder.onerror = (event) => {
            reject(new Error('MediaRecorder error'));
          };

          mediaRecorder.stop();
        });
      }

      // Native recording stop using expo-audio
      if (!recorder) {
        return null;
      }

      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        throw new Error('No recording URI');
      }

      // Move file to permanent location
      const permanentUri = `${FileSystem.documentDirectory}recordings/${recordingId}.m4a`;

      // Ensure directory exists
      await FileSystem.makeDirectoryAsync(
        `${FileSystem.documentDirectory}recordings/`,
        { intermediates: true }
      );

      await FileSystem.moveAsync({
        from: uri,
        to: permanentUri,
      });

      // Create recording object
      const newRecording: Recording = {
        id: recordingId,
        createdAt: new Date().toISOString(),
        duration: finalDuration,
        audioUri: permanentUri,
        status: 'processing_notes',
        language: settings.language,
      };

      // Add to store
      addRecording(newRecording);

      // Reset state
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
