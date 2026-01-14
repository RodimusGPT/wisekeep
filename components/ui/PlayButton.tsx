import React from 'react';
import { TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/Colors';

interface PlayButtonProps {
  isPlaying: boolean;
  onPress: () => void;
  size?: 'normal' | 'large';
}

export function PlayButton({ isPlaying, onPress, size = 'large' }: PlayButtonProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const buttonSize = size === 'large' ? 80 : 56;
  const iconSize = size === 'large' ? 36 : 24;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          width: buttonSize,
          height: buttonSize,
          borderRadius: buttonSize / 2,
          backgroundColor: Colors.playback, // Blue for playback (distinct from red recording button)
        },
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
    >
      <Ionicons
        name={isPlaying ? 'pause' : 'play'}
        size={iconSize}
        color="#FFFFFF"
        style={!isPlaying && { marginLeft: 4 }} // Visual centering for play icon
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    // @ts-ignore - boxShadow is supported on web
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.2)',
    elevation: 4, // For Android
  },
});
