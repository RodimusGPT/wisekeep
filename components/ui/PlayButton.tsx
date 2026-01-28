import React from 'react';
import { TouchableOpacity, StyleSheet, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/hooks';

interface PlayButtonProps {
  isPlaying: boolean;
  onPress: () => void;
  size?: 'normal' | 'large';
  disabled?: boolean;
}

export function PlayButton({ isPlaying, onPress, size = 'large', disabled = false }: PlayButtonProps) {
  const { isDark } = useTheme();

  const handlePress = () => {
    if (disabled) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
    onPress();
  };

  // Larger sizes for senior-friendly touch targets
  const buttonSize = size === 'large' ? 88 : 64;
  const iconSize = size === 'large' ? 40 : 28;
  const ringSize = buttonSize + 8;

  const backgroundColor = disabled
    ? (isDark ? '#424242' : '#E0E0E0')
    : Colors.playback;

  return (
    <View style={styles.container}>
      {/* Outer ring for visual emphasis */}
      <View
        style={[
          styles.ring,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            borderColor: disabled ? 'transparent' : (isPlaying ? Colors.playbackLight : 'rgba(21, 101, 192, 0.3)'),
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.button,
            {
              width: buttonSize,
              height: buttonSize,
              borderRadius: buttonSize / 2,
              backgroundColor,
            },
            isPlaying && styles.buttonPlaying,
          ]}
          onPress={handlePress}
          activeOpacity={disabled ? 1 : 0.7}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause playback' : 'Play recording'}
          accessibilityHint={isPlaying ? 'Double tap to pause' : 'Double tap to play'}
          accessibilityState={{ disabled }}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={iconSize}
            color={disabled ? (isDark ? '#616161' : '#9E9E9E') : '#FFFFFF'}
            style={!isPlaying && { marginLeft: iconSize * 0.1 }} // Visual centering for play icon
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    // @ts-ignore - boxShadow is supported on web
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.25)',
    elevation: 6, // For Android
  },
  buttonPlaying: {
    // @ts-ignore - boxShadow is supported on web
    boxShadow: '0px 4px 12px rgba(21, 101, 192, 0.4)',
  },
});
