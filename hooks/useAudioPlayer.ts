import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid, AVPlaybackStatus } from 'expo-av';

interface UseAudioPlayerReturn {
  isPlaying: boolean;
  position: number; // Current position in milliseconds
  duration: number; // Total duration in milliseconds
  playbackSpeed: 'normal' | 'slow';
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seekTo: (positionMs: number) => Promise<void>;
  setSpeed: (speed: 'normal' | 'slow') => void;
  loadAudio: (uri: string) => Promise<void>;
  unloadAudio: () => Promise<void>;
}

export function useAudioPlayer(): UseAudioPlayerReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<'normal' | 'slow'>('normal');

  const soundRef = useRef<Audio.Sound | null>(null);

  const loadAudio = useCallback(async (uri: string) => {
    try {
      // Unload any existing sound
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      // Configure audio mode for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        interruptionModeIOS: InterruptionModeIOS.DuckOthers,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false, rate: playbackSpeed === 'slow' ? 0.75 : 1.0 },
        onPlaybackStatusUpdate
      );

      soundRef.current = sound;
    } catch (error) {
      console.error('Failed to load audio:', error);
      throw error;
    }
  }, [playbackSpeed]);

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;

    setPosition(status.positionMillis || 0);
    setDuration(status.durationMillis || 0);
    setIsPlaying(status.isPlaying);

    // Auto-stop at end
    if (status.didJustFinish) {
      setIsPlaying(false);
      setPosition(0);
    }
  };

  const play = useCallback(async () => {
    if (!soundRef.current) return;

    try {
      await soundRef.current.playAsync();
    } catch (error) {
      console.error('Failed to play:', error);
    }
  }, []);

  const pause = useCallback(async () => {
    if (!soundRef.current) return;

    try {
      await soundRef.current.pauseAsync();
    } catch (error) {
      console.error('Failed to pause:', error);
    }
  }, []);

  const seekTo = useCallback(async (positionMs: number) => {
    if (!soundRef.current) return;

    try {
      await soundRef.current.setPositionAsync(positionMs);
    } catch (error) {
      console.error('Failed to seek:', error);
    }
  }, []);

  const setSpeed = useCallback((speed: 'normal' | 'slow') => {
    setPlaybackSpeed(speed);

    if (soundRef.current) {
      soundRef.current.setRateAsync(speed === 'slow' ? 0.75 : 1.0, true);
    }
  }, []);

  const unloadAudio = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      } catch (error) {
        console.error('Failed to unload audio:', error);
      }
    }
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(console.error);
      }
    };
  }, []);

  return {
    isPlaying,
    position,
    duration,
    playbackSpeed,
    play,
    pause,
    seekTo,
    setSpeed,
    loadAudio,
    unloadAudio,
  };
}
