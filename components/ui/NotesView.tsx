import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/Colors';
import { useAppStore } from '@/store';
import { useI18n } from '@/hooks';
import { NoteLine, getFontSize } from '@/types';

interface NotesViewProps {
  notes: NoteLine[];
  onLinePress?: (timestamp: number) => void;
  currentTimestamp?: number; // Current playback position for highlighting
}

export function NotesView({ notes, onLinePress, currentTimestamp }: NotesViewProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const textSize = useAppStore((state) => state.settings.textSize);
  const { t } = useI18n();

  const formatTimestamp = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  };

  const handleLinePress = (timestamp: number) => {
    if (onLinePress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onLinePress(timestamp);
    }
  };

  // Determine if a line is currently playing
  const isCurrentLine = (line: NoteLine, index: number): boolean => {
    if (currentTimestamp === undefined) return false;

    const nextLine = notes[index + 1];
    const lineStart = line.timestamp;
    const lineEnd = nextLine ? nextLine.timestamp : Infinity;

    return currentTimestamp >= lineStart && currentTimestamp < lineEnd;
  };

  const textColor = isDark ? Colors.textDark : Colors.text;
  const secondaryColor = isDark ? Colors.textSecondaryDark : Colors.textSecondary;
  const highlightBackground = isDark
    ? 'rgba(211, 47, 47, 0.2)'
    : 'rgba(211, 47, 47, 0.1)';

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator>
      {notes.map((line, index) => {
        const isCurrent = isCurrentLine(line, index);

        return (
          <TouchableOpacity
            key={line.id}
            style={[
              styles.line,
              isCurrent && { backgroundColor: highlightBackground },
            ]}
            onPress={() => handleLinePress(line.timestamp)}
            activeOpacity={0.6}
            disabled={!onLinePress}
            accessibilityRole="button"
            accessibilityLabel={`${line.text}. Tap to play from ${formatTimestamp(line.timestamp)}`}
          >
            {/* Timestamp */}
            <Text
              style={[
                styles.timestamp,
                {
                  color: isCurrent ? Colors.primary : secondaryColor,
                  fontSize: getFontSize('small', textSize),
                },
              ]}
            >
              {formatTimestamp(line.timestamp)}
            </Text>

            {/* Content */}
            <View style={styles.content}>
              {/* Speaker label if present */}
              {line.speaker && (
                <Text
                  style={[
                    styles.speaker,
                    {
                      color: Colors.primary,
                      fontSize: getFontSize('small', textSize),
                    },
                  ]}
                >
                  {t.speaker} {line.speaker}
                </Text>
              )}

              {/* Text */}
              <Text
                style={[
                  styles.text,
                  {
                    color: textColor,
                    fontSize: getFontSize('body', textSize),
                  },
                  isCurrent && { fontWeight: '600' },
                ]}
              >
                {line.text}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Hint at bottom */}
      {onLinePress && (
        <Text
          style={[
            styles.hint,
            { color: secondaryColor, fontSize: getFontSize('small', textSize) },
          ]}
        >
          {t.tapLineToHear}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  line: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  timestamp: {
    width: 60,
    fontVariant: ['tabular-nums'],
  },
  content: {
    flex: 1,
  },
  speaker: {
    fontWeight: '600',
    marginBottom: 4,
  },
  text: {
    lineHeight: 28,
  },
  hint: {
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 40,
    fontStyle: 'italic',
  },
});
