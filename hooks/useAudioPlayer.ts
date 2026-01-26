import { useState, useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import {
  useAudioPlayer as useExpoAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
} from 'expo-audio';
import { Recording } from '@/types';

interface UseAudioPlayerReturn {
  isPlaying: boolean;
  isLoaded: boolean;
  position: number; // Current position in milliseconds across all chunks
  duration: number; // Total duration in milliseconds across all chunks
  playbackSpeed: 'normal' | 'slow';
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seekTo: (positionMs: number) => Promise<void>;
  setSpeed: (speed: 'normal' | 'slow') => void;
  loadAudio: (recording: Recording) => Promise<void>;
  unloadAudio: () => Promise<void>;
}

export function useAudioPlayer(): UseAudioPlayerReturn {
  const [audioSource, setAudioSource] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<'normal' | 'slow'>('normal');

  // Multi-chunk support
  const [audioChunks, setAudioChunks] = useState<string[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [chunkDurations, setChunkDurations] = useState<number[]>([]);
  const totalRecordingDuration = useRef<number>(0); // From Recording.duration
  const wasPlayingBeforeChunkSwitch = useRef<boolean>(false);
  const isSwitchingChunks = useRef<boolean>(false); // Prevent race conditions during chunk switch
  const pendingSeekPosition = useRef<number | null>(null); // Store seek position during chunk load

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

  // Auto-play next chunk when current chunk finishes
  useEffect(() => {
    if (!player || !isLoaded || audioChunks.length === 0 || isSwitchingChunks.current) return;

    // Check if current chunk has finished playing
    const currentChunkDuration = status.duration || 0;
    const currentPosition = status.currentTime || 0;
    const isPlaying = status.playing || false;

    // If chunk finished and there are more chunks, play next one
    // Use 0.2s buffer to catch the end reliably
    if (currentPosition >= currentChunkDuration - 0.2 && currentChunkIndex < audioChunks.length - 1 && isPlaying) {
      console.log(`[AudioPlayer] Chunk ${currentChunkIndex + 1} finished, loading next chunk...`);
      wasPlayingBeforeChunkSwitch.current = true;
      isSwitchingChunks.current = true;

      // Move to next chunk
      setCurrentChunkIndex(prev => prev + 1);
    }
  }, [player, isLoaded, status.currentTime, status.duration, status.playing, currentChunkIndex, audioChunks.length]);

  // Load new chunk when index changes
  useEffect(() => {
    if (audioChunks.length === 0) return;
    // Bounds checking: ensure index is valid
    if (currentChunkIndex < 0 || currentChunkIndex >= audioChunks.length) {
      console.error(`[AudioPlayer] Invalid chunk index: ${currentChunkIndex} (total chunks: ${audioChunks.length})`);
      return;
    }

    const chunkUri = audioChunks[currentChunkIndex];
    console.log(`[AudioPlayer] Loading chunk ${currentChunkIndex + 1}/${audioChunks.length}:`, chunkUri);
    setAudioSource(chunkUri);
  }, [currentChunkIndex, audioChunks]);

  // Resume playing and handle pending seeks after chunk loads
  useEffect(() => {
    if (!isLoaded || !player) return;

    // Handle pending seek first (if user seeked during chunk switch)
    if (pendingSeekPosition.current !== null) {
      const seekPos = pendingSeekPosition.current;
      pendingSeekPosition.current = null;

      console.log('[AudioPlayer] Applying pending seek to:', seekPos.toFixed(2), 'seconds');
      player.seekTo(seekPos).then(() => {
        // After seeking, resume playback if needed
        if (wasPlayingBeforeChunkSwitch.current) {
          console.log('[AudioPlayer] Resuming playback after seek');
          player.play();
          wasPlayingBeforeChunkSwitch.current = false;
        }
        isSwitchingChunks.current = false;
      }).catch((error) => {
        console.error('[AudioPlayer] Seek error:', error);
        isSwitchingChunks.current = false;
      });
    } else if (wasPlayingBeforeChunkSwitch.current) {
      // No pending seek, just resume playback
      console.log('[AudioPlayer] Resuming playback on new chunk');
      player.play();
      wasPlayingBeforeChunkSwitch.current = false;
      isSwitchingChunks.current = false;
    } else if (isSwitchingChunks.current) {
      // Chunk loaded but not playing (manual chunk switch without playback)
      isSwitchingChunks.current = false;
    }
  }, [isLoaded, player]);

  // Store chunk durations when chunks load
  useEffect(() => {
    if (isLoaded && status.duration && currentChunkIndex < chunkDurations.length) {
      // Update duration for current chunk
      const newDurations = [...chunkDurations];
      newDurations[currentChunkIndex] = status.duration;
      setChunkDurations(newDurations);
    }
  }, [isLoaded, status.duration, currentChunkIndex]);

  const loadAudio = useCallback(async (recording: Recording) => {
    try {
      console.log('[AudioPlayer] Loading recording:', recording.id);

      // Prefer remote URL if available (for uploaded recordings)
      // Otherwise use local chunks/URI
      let chunks: string[];

      if (recording.audioRemoteUrl) {
        // Uploaded recording - use remote URL
        console.log('[AudioPlayer] Using remote URL:', recording.audioRemoteUrl.substring(0, 50) + '...');
        chunks = [recording.audioRemoteUrl];
      } else if (recording.audioChunks && recording.audioChunks.length > 0) {
        // Local multi-chunk recording
        console.log('[AudioPlayer] Using local chunks:', recording.audioChunks.length);
        chunks = recording.audioChunks;
      } else {
        // Single local recording
        console.log('[AudioPlayer] Using local URI:', recording.audioUri.substring(0, 50) + '...');
        chunks = [recording.audioUri];
      }

      console.log(`[AudioPlayer] Recording has ${chunks.length} chunk(s)`);

      // Store recording duration and chunks
      totalRecordingDuration.current = recording.duration;
      setAudioChunks(chunks);
      setCurrentChunkIndex(0);
      setChunkDurations(new Array(chunks.length).fill(0));

      // Load first chunk
      setAudioSource(chunks[0]);
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

    try {
      const targetPositionSec = positionMs / 1000;

      // For multi-chunk recordings, find which chunk contains the target position
      if (audioChunks.length > 1) {
        let accumulatedDuration = 0;

        for (let i = 0; i < audioChunks.length; i++) {
          // Use actual chunk duration if available, otherwise estimate equally
          const chunkDuration = chunkDurations[i] > 0
            ? chunkDurations[i]
            : (totalRecordingDuration.current / audioChunks.length);

          if (targetPositionSec < accumulatedDuration + chunkDuration) {
            // Target is in this chunk
            const positionInChunk = targetPositionSec - accumulatedDuration;
            console.log(`[AudioPlayer] Seeking to chunk ${i + 1}, position ${positionInChunk.toFixed(1)}s`);

            // Switch to this chunk if needed
            if (i !== currentChunkIndex) {
              // Validate target chunk exists
              if (i < 0 || i >= audioChunks.length) {
                console.error(`[AudioPlayer] Invalid target chunk index: ${i}`);
                return;
              }

              // Warn if overwriting a pending seek (latest seek wins)
              if (pendingSeekPosition.current !== null && isSwitchingChunks.current) {
                console.warn(`[AudioPlayer] Overwriting pending seek (${pendingSeekPosition.current.toFixed(1)}s) with new seek (${positionInChunk.toFixed(1)}s)`);
              }

              // Save playback state and position for after chunk loads
              wasPlayingBeforeChunkSwitch.current = status.playing || false;
              pendingSeekPosition.current = positionInChunk;
              isSwitchingChunks.current = true;

              // Switch chunk - the seek will happen in the load effect
              setCurrentChunkIndex(i);
            } else {
              // Same chunk, just seek immediately
              if (!isLoaded) {
                console.log('[AudioPlayer] Cannot seek - chunk not loaded yet');
                return;
              }
              await player.seekTo(positionInChunk);
            }
            return;
          }

          accumulatedDuration += chunkDuration;
        }

        // If we got here, target is beyond last chunk - seek to end of last chunk
        const lastChunkIndex = audioChunks.length - 1;
        if (lastChunkIndex < 0) {
          console.error('[AudioPlayer] No chunks available for seeking');
          return;
        }

        const lastChunkDuration = chunkDurations[lastChunkIndex] > 0
          ? chunkDurations[lastChunkIndex]
          : (totalRecordingDuration.current / audioChunks.length);

        if (currentChunkIndex !== lastChunkIndex) {
          // Warn if overwriting a pending seek
          if (pendingSeekPosition.current !== null && isSwitchingChunks.current) {
            console.warn(`[AudioPlayer] Overwriting pending seek with seek to end of last chunk`);
          }

          // Switch to last chunk and seek to its end
          wasPlayingBeforeChunkSwitch.current = status.playing || false;
          pendingSeekPosition.current = lastChunkDuration;
          isSwitchingChunks.current = true;
          setCurrentChunkIndex(lastChunkIndex);
        } else {
          // Already on last chunk, just seek
          if (!isLoaded) {
            console.log('[AudioPlayer] Cannot seek - chunk not loaded yet');
            return;
          }
          await player.seekTo(lastChunkDuration);
        }
      } else {
        // Single chunk - simple seek
        if (!isLoaded) {
          console.log('[AudioPlayer] Cannot seek - audio not loaded yet');
          return;
        }
        console.log('[AudioPlayer] Seeking to:', targetPositionSec, 'seconds');
        await player.seekTo(targetPositionSec);
      }
    } catch (error) {
      console.error('[AudioPlayer] Failed to seek:', error);
    }
  }, [player, isLoaded, audioChunks, chunkDurations, currentChunkIndex, totalRecordingDuration, status.playing]);

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
      setAudioChunks([]);
      setCurrentChunkIndex(0);
      setChunkDurations([]);
      totalRecordingDuration.current = 0;
    } catch (error) {
      console.error('[AudioPlayer] Failed to unload audio:', error);
    }
  }, [player]);

  // Calculate position across all chunks
  const calculateTotalPosition = useCallback(() => {
    if (audioChunks.length <= 1) {
      // Single chunk - return current position
      return (status.currentTime || 0) * 1000;
    }

    // Multi-chunk: add duration of all previous chunks + current position
    let totalPosition = 0;

    for (let i = 0; i < currentChunkIndex; i++) {
      totalPosition += (chunkDurations[i] || 0);
    }

    totalPosition += (status.currentTime || 0);

    return totalPosition * 1000; // Convert to milliseconds
  }, [audioChunks.length, currentChunkIndex, chunkDurations, status.currentTime]);

  // Calculate total duration across all chunks
  const calculateTotalDuration = useCallback(() => {
    if (audioChunks.length <= 1) {
      // Single chunk - return current duration
      return (status.duration || 0) * 1000;
    }

    // Multi-chunk: Use recording's total duration if available
    // Otherwise sum all chunk durations
    if (totalRecordingDuration.current > 0) {
      return totalRecordingDuration.current * 1000;
    }

    // Fallback: sum chunk durations
    const total = chunkDurations.reduce((sum, dur) => sum + dur, 0);
    return total * 1000; // Convert to milliseconds
  }, [audioChunks.length, chunkDurations, status.duration]);

  return {
    isPlaying: status.playing || false,
    isLoaded,
    position: calculateTotalPosition(),
    duration: calculateTotalDuration(),
    playbackSpeed,
    play,
    pause,
    seekTo,
    setSpeed,
    loadAudio,
    unloadAudio,
  };
}
