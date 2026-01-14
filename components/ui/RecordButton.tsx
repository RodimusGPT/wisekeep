import React, { useEffect, useRef } from 'react';
import {
  Pressable,
  View,
  Text,
  StyleSheet,
  Animated,
  useColorScheme,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/Colors';
import { useAppStore } from '@/store';
import { getFontSize } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BUTTON_SIZE = Math.min(SCREEN_WIDTH * 0.45, 180); // At least 40% of screen width

interface RecordButtonProps {
  isRecording: boolean;
  onPress: () => void;
  label?: string;
}

export function RecordButton({ isRecording, onPress, label }: RecordButtonProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const textSize = useAppStore((state) => state.settings.textSize);

  // Pulsing animation for recording state
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  const handlePress = () => {
    console.log('RecordButton handlePress called, isRecording:', isRecording);
    // Haptics only work on native
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(
        isRecording
          ? Haptics.ImpactFeedbackStyle.Heavy
          : Haptics.ImpactFeedbackStyle.Medium
      );
    }
    onPress();
  };

  const backgroundColor = isRecording
    ? Colors.recordingActive
    : Colors.primary;

  const buttonContent = (
    <>
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
            size={BUTTON_SIZE * 0.4}
            color="#FFFFFF"
          />
        </View>
      </Animated.View>

      {label && (
        <Text
          style={[
            styles.label,
            {
              color: isDark ? Colors.textDark : Colors.text,
              fontSize: getFontSize('body', textSize),
            },
          ]}
        >
          {label}
        </Text>
      )}
    </>
  );

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && { opacity: 0.8 },
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonWrapper: {
    // Shadow for depth
    // @ts-ignore - boxShadow is supported on web
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
    elevation: 8, // For Android
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRecording: {
    // Recording state has slightly different shadow
    // @ts-ignore - boxShadow is supported on web
    boxShadow: `0px 4px 8px ${Colors.recordingActive}80`,
  },
  label: {
    marginTop: 20,
    fontWeight: '500',
    textAlign: 'center',
  },
});
