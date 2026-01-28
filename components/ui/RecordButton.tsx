import React, { useEffect, useRef } from 'react';
import {
  Pressable,
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/Colors';
import { useAppStore } from '@/store';
import { useTheme } from '@/hooks';
import { getFontSize } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BUTTON_SIZE = Math.min(SCREEN_WIDTH * 0.48, 200); // Slightly larger for seniors
const RING_SIZE = BUTTON_SIZE + 16;

interface RecordButtonProps {
  isRecording: boolean;
  onPress: () => void;
  label?: string;
}

export function RecordButton({ isRecording, onPress, label }: RecordButtonProps) {
  const { isDark, colors } = useTheme();
  const textSize = useAppStore((state) => state.settings.textSize);

  // Pulsing animation for recording state
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isRecording) {
      // Button pulse
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 800,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      );
      // Ring pulse (slightly offset)
      const ring = Animated.loop(
        Animated.sequence([
          Animated.timing(ringAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(ringAnim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      );
      pulse.start();
      ring.start();
      return () => {
        pulse.stop();
        ring.stop();
      };
    } else {
      pulseAnim.setValue(1);
      ringAnim.setValue(0);
    }
  }, [isRecording, pulseAnim, ringAnim]);

  const handlePress = () => {
    console.log('RecordButton handlePress called, isRecording:', isRecording);
    // Haptics only work on native
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(
        isRecording
          ? Haptics.ImpactFeedbackStyle.Heavy
          : Haptics.ImpactFeedbackStyle.Medium
      ).catch(() => {});
    }
    onPress();
  };

  const backgroundColor = isRecording
    ? Colors.recordingActive
    : Colors.primary;

  const ringOpacity = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.6],
  });

  const ringScale = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });

  const buttonContent = (
    <View style={styles.buttonContainer}>
      {/* Animated ring for recording state */}
      {isRecording && (
        <Animated.View
          style={[
            styles.recordingRing,
            {
              width: RING_SIZE,
              height: RING_SIZE,
              borderRadius: RING_SIZE / 2,
              borderColor: Colors.recordingActive,
              opacity: ringOpacity,
              transform: [{ scale: ringScale }],
            },
          ]}
        />
      )}

      {/* Outer ring for visual emphasis when not recording */}
      {!isRecording && (
        <View
          style={[
            styles.staticRing,
            {
              width: RING_SIZE,
              height: RING_SIZE,
              borderRadius: RING_SIZE / 2,
              borderColor: isDark ? 'rgba(198, 40, 40, 0.3)' : 'rgba(198, 40, 40, 0.2)',
            },
          ]}
        />
      )}

      <Animated.View
        style={[
          styles.buttonWrapper,
          { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <View
          style={[
            styles.button,
            { backgroundColor },
            isRecording && styles.buttonRecording,
          ]}
        >
          <Ionicons
            name={isRecording ? 'stop' : 'mic'}
            size={BUTTON_SIZE * 0.38}
            color="#FFFFFF"
          />
        </View>
      </Animated.View>
    </View>
  );

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        Platform.OS === 'web' && { cursor: 'pointer' as const },
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
      accessibilityHint={
        isRecording
          ? 'Double tap to stop recording'
          : 'Double tap to start recording'
      }
    >
      {buttonContent}

      {label && (
        <Text
          style={[
            styles.label,
            {
              color: isRecording ? Colors.recordingActive : colors.text,
              fontSize: getFontSize('bodyLarge', textSize),
            },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: RING_SIZE,
    height: RING_SIZE,
  },
  recordingRing: {
    position: 'absolute',
    borderWidth: 4,
  },
  staticRing: {
    position: 'absolute',
    borderWidth: 3,
  },
  buttonWrapper: {
    borderRadius: BUTTON_SIZE / 2,
    // Shadow for depth
    // @ts-ignore - boxShadow is supported on web
    boxShadow: '0px 6px 16px rgba(0, 0, 0, 0.35)',
    elevation: 10, // For Android
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRecording: {
    // Recording state has colored glow
    // @ts-ignore - boxShadow is supported on web
    boxShadow: `0px 6px 20px ${Colors.recordingActive}80`,
  },
  label: {
    marginTop: 24,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});
