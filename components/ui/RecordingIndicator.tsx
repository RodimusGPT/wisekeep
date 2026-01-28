import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useAppStore } from '@/store';
import { useI18n } from '@/hooks';

/**
 * Recording indicator that appears in the iOS status bar area.
 * Similar to iOS's red bar during phone calls or green bar during screen recording.
 * Tapping it navigates back to the recording screen.
 */
export function RecordingIndicator() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const isRecording = useAppStore((state) => state.isRecording);
  const recordingDuration = useAppStore((state) => state.recordingDuration);

  // Pulsing animation for the recording dot
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;

    if (isRecording) {
      try {
        animation = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 0.4,
              duration: 600,
              useNativeDriver: Platform.OS !== 'web',
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 600,
              useNativeDriver: Platform.OS !== 'web',
            }),
          ])
        );
        animation.start(({ finished }) => {
          // Animation completed or stopped - no action needed
          // The finished callback handles edge cases where animation ends unexpectedly
        });
      } catch (error) {
        // Animation setup failed - fallback to static display
        console.warn('[RecordingIndicator] Animation failed:', error);
        pulseAnim.setValue(1);
      }
    } else {
      pulseAnim.setValue(1);
    }

    return () => {
      if (animation) {
        animation.stop();
      }
    };
  }, [isRecording, pulseAnim]);

  // Format duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePress = () => {
    // Navigate to recording tab when tapped
    router.push('/');
  };

  if (!isRecording) {
    return null;
  }

  // On iOS, the status bar area height is in insets.top
  // We fill this entire area with the red recording indicator
  // On web, insets.top is 0, so use a reasonable default
  const statusBarHeight = Platform.OS === 'web' ? 24 : insets.top;

  return (
    <>
      {/* Change status bar text to light when recording */}
      <StatusBar style="light" />

      <TouchableOpacity
        style={[
          styles.container,
          {
            height: statusBarHeight + 20, // Status bar + small content area
            paddingTop: Platform.OS === 'ios' ? statusBarHeight - 14 : 0,
          },
        ]}
        onPress={handlePress}
        activeOpacity={0.8}
        accessibilityLabel={`${t.recording} ${formatDuration(recordingDuration)}`}
        accessibilityRole="button"
      >
        <View style={styles.content}>
          <Animated.View
            style={[
              styles.recordingDot,
              { opacity: pulseAnim },
            ]}
          />
          <Text style={styles.text}>
            {t.recording}
          </Text>
          <Text style={styles.duration}>
            {formatDuration(recordingDuration)}
          </Text>
        </View>
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.recordingActive,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    justifyContent: 'flex-end',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 4,
    gap: 6,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  duration: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
});
