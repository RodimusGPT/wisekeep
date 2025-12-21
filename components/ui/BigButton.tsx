import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  useColorScheme,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/Colors';
import { useAppStore } from '@/store';
import { getFontSize } from '@/types';

interface BigButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'playback';
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: 'normal' | 'large';
}

export function BigButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
  textStyle,
  size = 'normal',
}: BigButtonProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const textSize = useAppStore((state) => state.settings.textSize);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const getBackgroundColor = () => {
    if (disabled) {
      return isDark ? '#424242' : '#E0E0E0';
    }
    switch (variant) {
      case 'primary':
        return Colors.primary;
      case 'playback':
        return Colors.playback; // Blue for playback-related actions
      case 'secondary':
        return isDark ? Colors.backgroundSecondaryDark : Colors.backgroundSecondary;
      case 'danger':
        return Colors.error;
      case 'success':
        return Colors.success;
      default:
        return Colors.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) {
      return isDark ? '#757575' : '#9E9E9E';
    }
    if (variant === 'secondary') {
      return isDark ? Colors.textDark : Colors.text;
    }
    return '#FFFFFF';
  };

  const fontSize = getFontSize(size === 'large' ? 'header' : 'button', textSize);

  return (
    <TouchableOpacity
      style={[
        styles.button,
        size === 'large' && styles.buttonLarge,
        { backgroundColor: getBackgroundColor() },
        style,
      ]}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Text
        style={[
          styles.text,
          { color: getTextColor(), fontSize },
          textStyle,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLarge: {
    minHeight: 72,
    paddingHorizontal: 40,
    paddingVertical: 20,
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
});
