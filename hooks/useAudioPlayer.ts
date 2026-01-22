import { useState, useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import {
  useAudioPlayer as useExpoAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
} from 'expo-audio';

interface UseAudioPlayerReturn {
  isPlaying: boolean;
  isLoaded: boolean;
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
  const [audioSource, setAudioSource] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<'normal' | 'slow'>('normal');

  // Use expo-audio's player hook with the current source
  const player = useExpoAudioPlayer(audioSource ? { uri: audioSource } : null);
  const status = useAudioPlayerStatus(player);

  const isLoaded = status.isLoaded || false;

  // Apply playback speed when player is ready
  useEffect(() => {
    if (player && isLoaded) {
      player.setPlaybackRate(playbackSpeed === 'slow' ? 0.75 : 1.0);
    }
  }, [player, isLoaded, playbackSpeed]);

  const loadAudio = useCallback(async (uri: string) => {
    try {
      console.log('[AudioPlayer] Loading audio:', uri);
      setAudioSource(uri);
    } catch (error) {
      console.error('[AudioPlayer] Failed to load audio:', error);
      throw error;
    }
  }, []);

  const play = useCallback(async () => {
    if (!player) {
      console.log('[AudioPlayer] Cannot play - no player');
      return;
    }
    if (!isLoaded) {
      console.log('[AudioPlayer] Cannot play - audio not loaded yet');
      return;
    }

    try {
      // Configure audio session for playback on iOS
      // This ensures audio plays in silent mode and doesn't interrupt other apps
      if (Platform.OS !== 'web') {
        try {
          await setAudioModeAsync({
            playsInSilentMode: true,
            interruptionMode: 'mixWithOthers',
            allowsRecording: false,
            shouldPlayInBackground: false,
            shouldRouteThroughEarpiece: false,
          });
        } catch (audioModeError) {
          console.warn('[AudioPlayer] Failed to configure audio mode:', audioModeError);
          // Continue playing anyway
        }
      }

      console.log('[AudioPlayer] Playing...');
      player.play();
    } catch (error) {
      console.error('[AudioPlayer] Failed to play:', error);
    }
  }, [player, isLoaded]);

  const pause = useCallback(async () => {
    if (!player) return;

    try {
      player.pause();
    } catch (error) {
      console.error('[AudioPlayer] Failed to pause:', error);
    }
  }, [player]);

  const seekTo = useCallback(async (positionMs: number) => {
    if (!player) {
      console.log('[AudioPlayer] Cannot seek - no player');
      return;
    }
    if (!isLoaded) {
      console.log('[AudioPlayer] Cannot seek - audio not loaded yet');
      return;
    }

    try {
      const positionSec = positionMs / 1000;
      console.log('[AudioPlayer] Seeking to:', positionSec, 'seconds');
      await player.seekTo(positionSec);
      console.log('[AudioPlayer] Seek complete');
    } catch (error) {
      console.error('[AudioPlayer] Failed to seek:', error);
    }
  }, [player, isLoaded]);

  const setSpeed = useCallback((speed: 'normal' | 'slow') => {
    setPlaybackSpeed(speed);
    if (player && isLoaded) {
      player.setPlaybackRate(speed === 'slow' ? 0.75 : 1.0);
    }
  }, [player, isLoaded]);

  const unloadAudio = useCallback(async () => {
    try {
      if (player) {
        player.pause();
      }
      setAudioSource(null);
    } catch (error) {
      console.error('[AudioPlayer] Failed to unload audio:', error);
    }
  }, [player]);

  return {
    isPlaying: status.playing || false,
    isLoaded,
    position: (status.currentTime || 0) * 1000, // Convert to milliseconds
    duration: (status.duration || 0) * 1000, // Convert to milliseconds
    playbackSpeed,
    play,
    pause,
    seekTo,
    setSpeed,
    loadAudio,
    unloadAudio,
  };
}
