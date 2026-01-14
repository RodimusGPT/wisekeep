import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/Colors';
import { useAppStore } from '@/store';
import { useI18n, useTheme } from '@/hooks';
import { NoteLine, getFontSize } from '@/types';

interface NotesViewProps {
  notes: NoteLine[];
  onLinePress?: (timestamp: number) => void;
  currentTimestamp?: number; // Current playback position for highlighting
}

export function NotesView({ notes, onLinePress, currentTimestamp }: NotesViewProps) {
  const { colors } = useTheme();
  const textSize = useAppStore((state) => state.settings.textSize);
  const { t } = useI18n();

  // Note: timestamps from Groq are in seconds, not milliseconds
  const formatTimestamp = (seconds: number): string => {
    const totalSeconds = Math.floor(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  const handleLinePress = (timestamp: number) => {
    if (onLinePress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onLinePress(timestamp);
    }
  };

  // Determine if a line is currently playing
  // currentTimestamp is in milliseconds (from player), line.timestamp is in seconds (from Groq)
  const isCurrentLine = (line: NoteLine, index: number): boolean => {
    if (currentTimestamp === undefined) return false;

    const currentSeconds = currentTimestamp / 1000; // Convert ms to seconds
    const nextLine = notes[index + 1];
    const lineStart = line.timestamp;
    const lineEnd = nextLine ? nextLine.timestamp : Infinity;

    return currentSeconds >= lineStart && currentSeconds < lineEnd;
  };

  const { text: textColor, textSecondary: secondaryColor, highlight: highlightBackground, border: borderColor } = colors;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator
    >
      {notes.map((line, index) => {
        const isCurrent = isCurrentLine(line, index);

        return (
          <TouchableOpacity
            key={line.id}
            style={[
              styles.line,
              { borderBottomColor: borderColor },
              isCurrent && [styles.currentLine, { backgroundColor: highlightBackground }],
            ]}
            onPress={() => handleLinePress(line.timestamp)}
            activeOpacity={0.6}
            disabled={!onLinePress}
            accessibilityRole="button"
            accessibilityLabel={`${line.text}. Tap to play from ${formatTimestamp(line.timestamp)}`}
          >
            {/* Timestamp with play indicator */}
            <View style={styles.timestampContainer}>
              {/* Play indicator for current line */}
              {isCurrent ? (
                <Ionicons name="volume-high" size={18} color={Colors.primary} style={styles.playingIcon} />
              ) : onLinePress ? (
                <Ionicons name="play-circle-outline" size={18} color={secondaryColor} style={styles.playIcon} />
              ) : (
                <View style={styles.iconPlaceholder} />
              )}

              <Text
                style={[
                  styles.timestamp,
                  {
                    color: isCurrent ? Colors.primary : secondaryColor,
                    fontSize: getFontSize('body', textSize),
                  },
                  isCurrent && styles.timestampActive,
                ]}
              >
                {formatTimestamp(line.timestamp)}
              </Text>
            </View>

            {/* Content */}
            <View style={styles.content}>
              {/* Speaker label if present */}
              {line.speaker && (
                <Text
                  style={[
                    styles.speaker,
                    {
                      color: Colors.primary,
                      fontSize: getFontSize('body', textSize),
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
                  isCurrent && styles.textActive,
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
        <View style={styles.hintContainer}>
          <Ionicons name="hand-left-outline" size={20} color={secondaryColor} />
          <Text
            style={[
              styles.hint,
              { color: secondaryColor, fontSize: getFontSize('body', textSize) },
            ]}
          >
            {t.tapLineToHear}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 100,
  },
  contentContainer: {
    paddingVertical: 12,
    flexGrow: 1,
  },
  line: {
    flexDirection: 'row',
    minHeight: 56, // Senior-friendly: minimum touch target
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
    borderBottomWidth: 1,
    alignItems: 'flex-start',
  },
  currentLine: {
    borderBottomWidth: 0,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  timestampContainer: {
    minWidth: 90,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timestamp: {
    fontVariant: ['tabular-nums'],
    fontWeight: '500',
  },
  timestampActive: {
    fontWeight: '700',
  },
  playIcon: {
    opacity: 0.6,
  },
  playingIcon: {
    // Active playing indicator
  },
  iconPlaceholder: {
    width: 18,
  },
  content: {
    flex: 1,
    paddingLeft: 8,
  },
  speaker: {
    fontWeight: '700',
    marginBottom: 6,
  },
  text: {
    lineHeight: 28, // Increased line height for readability
  },
  textActive: {
    fontWeight: '600',
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    marginBottom: 24,
    paddingVertical: 12,
  },
  hint: {
    fontStyle: 'italic',
  },
});
