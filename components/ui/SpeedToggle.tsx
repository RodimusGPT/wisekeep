import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/Colors';
import { useAppStore } from '@/store';
import { useTheme } from '@/hooks';
import { getFontSize } from '@/types';

interface SpeedToggleProps {
  speed: 'normal' | 'slow';
  onSpeedChange: (speed: 'normal' | 'slow') => void;
  normalLabel: string;
  slowLabel: string;
}

export function SpeedToggle({
  speed,
  onSpeedChange,
  normalLabel,
  slowLabel,
}: SpeedToggleProps) {
  const { isDark, colors } = useTheme();
  const textSize = useAppStore((state) => state.settings.textSize);

  const handlePress = (newSpeed: 'normal' | 'slow') => {
    if (newSpeed !== speed) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      onSpeedChange(newSpeed);
    }
  };

  // backgroundSecondary not in theme, use direct Colors access
  const backgroundColor = isDark ? Colors.backgroundSecondaryDark : Colors.backgroundSecondary;
  const { card: activeBackgroundColor, text: textColor, border: borderColor } = colors;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <TouchableOpacity
        style={[
          styles.option,
          speed === 'normal' && {
            backgroundColor: activeBackgroundColor,
            borderColor: Colors.playback, // Blue for playback controls
          },
        ]}
        onPress={() => handlePress('normal')}
        activeOpacity={0.7}
        accessibilityRole="radio"
        accessibilityState={{ selected: speed === 'normal' }}
      >
        <Text
          style={[
            styles.optionText,
            {
              color: speed === 'normal' ? Colors.playback : textColor,
              fontSize: getFontSize('body', textSize),
            },
            speed === 'normal' && styles.activeText,
          ]}
        >
          {normalLabel}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.option,
          speed === 'slow' && {
            backgroundColor: activeBackgroundColor,
            borderColor: Colors.playback, // Blue for playback controls
          },
        ]}
        onPress={() => handlePress('slow')}
        activeOpacity={0.7}
        accessibilityRole="radio"
        accessibilityState={{ selected: speed === 'slow' }}
      >
        <Text
          style={[
            styles.optionText,
            {
              color: speed === 'slow' ? Colors.playback : textColor,
              fontSize: getFontSize('body', textSize),
            },
            speed === 'slow' && styles.activeText,
          ]}
        >
          {slowLabel}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  option: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionText: {
    fontWeight: '500',
    textAlign: 'center',
  },
  activeText: {
    fontWeight: '700',
  },
});
