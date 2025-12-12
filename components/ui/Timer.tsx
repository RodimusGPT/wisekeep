import React from 'react';
import { Text, StyleSheet, View, useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useAppStore } from '@/store';
import { getFontSize } from '@/types';

interface TimerProps {
  seconds: number;
  isRecording?: boolean;
  label?: string;
}

export function Timer({ seconds, isRecording = false, label }: TimerProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const textSize = useAppStore((state) => state.settings.textSize);

  // Format time as HH:MM:SS or MM:SS
  const formatTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    return `${minutes.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  const textColor = isRecording
    ? Colors.recordingActive
    : isDark
    ? Colors.textDark
    : Colors.text;

  return (
    <View style={styles.container}>
      {label && (
        <Text
          style={[
            styles.label,
            {
              color: textColor,
              fontSize: getFontSize('body', textSize),
            },
          ]}
        >
          {label}
        </Text>
      )}
      <Text
        style={[
          styles.time,
          {
            color: textColor,
            fontSize: getFontSize('timer', textSize),
          },
        ]}
        accessibilityLabel={`Duration: ${formatTime(seconds)}`}
      >
        {formatTime(seconds)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  label: {
    fontWeight: '500',
    marginBottom: 8,
  },
  time: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'], // Ensures consistent number widths
    letterSpacing: 2,
  },
});
