import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, useColorScheme } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/Colors';
import { useAppStore } from '@/store';
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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const textSize = useAppStore((state) => state.settings.textSize);

  const handlePress = (newSpeed: 'normal' | 'slow') => {
    if (newSpeed !== speed) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSpeedChange(newSpeed);
    }
  };

  const backgroundColor = isDark ? Colors.backgroundSecondaryDark : Colors.backgroundSecondary;
  const activeBackgroundColor = isDark ? Colors.cardDark : Colors.card;
  const textColor = isDark ? Colors.textDark : Colors.text;
  const borderColor = isDark ? Colors.borderDark : Colors.border;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <TouchableOpacity
        style={[
          styles.option,
          speed === 'normal' && {
            backgroundColor: activeBackgroundColor,
            borderColor: Colors.primary,
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
              color: speed === 'normal' ? Colors.primary : textColor,
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
            borderColor: Colors.primary,
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
              color: speed === 'slow' ? Colors.primary : textColor,
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
