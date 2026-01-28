import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/Colors';
import { useAppStore } from '@/store';
import { useTheme } from '@/hooks';
import { getFontSize } from '@/types';

// Type for Ionicons names
type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface BigButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'playback';
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: 'normal' | 'large';
  icon?: IoniconsName;
}

export function BigButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
  textStyle,
  size = 'normal',
  icon,
}: BigButtonProps) {
  const { isDark } = useTheme();
  const textSize = useAppStore((state) => state.settings.textSize);

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
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

  const getBorderColor = () => {
    if (disabled) {
      return 'transparent';
    }
    if (variant === 'secondary') {
      return isDark ? Colors.borderDark : Colors.border;
    }
    return 'transparent';
  };

  const getTextColor = () => {
    if (disabled) {
      return isDark ? '#616161' : '#9E9E9E';
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
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderWidth: variant === 'secondary' ? 2 : 0,
        },
        style,
      ]}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
    >
      <View style={styles.content}>
        {icon && (
          <Ionicons
            name={icon}
            size={size === 'large' ? 28 : 22}
            color={getTextColor()}
            style={styles.icon}
          />
        )}
        <Text
          style={[
            styles.text,
            { color: getTextColor(), fontSize },
            textStyle,
          ]}
        >
          {title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    // Shadow for depth perception
    // @ts-ignore - boxShadow supported on web
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 2,
  },
  buttonLarge: {
    minHeight: 72,
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderRadius: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 10,
  },
  text: {
    fontWeight: '700',
    textAlign: 'center',
  },
});
