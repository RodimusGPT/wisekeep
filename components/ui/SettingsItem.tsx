import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/Colors';
import { useAppStore } from '@/store';
import { useTheme } from '@/hooks';
import { getFontSize } from '@/types';

interface SettingsItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress: () => void;
  showChevron?: boolean;
}

export function SettingsItem({
  icon,
  label,
  value,
  onPress,
  showChevron = true,
}: SettingsItemProps) {
  const { colors } = useTheme();
  const textSize = useAppStore((state) => state.settings.textSize);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const { text: textColor, textSecondary: secondaryColor, card: backgroundColor, border: borderColor } = colors;

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor, borderBottomColor: borderColor }]}
      onPress={handlePress}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={`${label}${value ? `, current value: ${value}` : ''}`}
    >
      <Ionicons name={icon} size={24} color={Colors.primary} style={styles.icon} />

      <View style={styles.content}>
        <Text
          style={[
            styles.label,
            { color: textColor, fontSize: getFontSize('body', textSize) },
          ]}
        >
          {label}
        </Text>

        {value && (
          <Text
            style={[
              styles.value,
              { color: secondaryColor, fontSize: getFontSize('body', textSize) },
            ]}
          >
            {value}
          </Text>
        )}
      </View>

      {showChevron && (
        <Ionicons name="chevron-forward" size={24} color={secondaryColor} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    minHeight: 72, // Large touch target
    borderBottomWidth: 1,
  },
  icon: {
    marginRight: 16,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontWeight: '500',
  },
  value: {
    marginLeft: 8,
  },
});
