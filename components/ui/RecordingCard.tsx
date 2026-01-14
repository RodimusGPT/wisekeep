import React, { useMemo, useCallback } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/Colors';
import { useAppStore } from '@/store';
import { useI18n } from '@/hooks';
import { Recording, getFontSize } from '@/types';
import { format, isToday, isYesterday, differenceInDays } from 'date-fns';

interface RecordingCardProps {
  recording: Recording;
  onPress: () => void;
}

export const RecordingCard = React.memo(({ recording, onPress }: RecordingCardProps) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const textSize = useAppStore((state) => state.settings.textSize);
  const { t } = useI18n();

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  // Memoize formatted date
  const formattedDate = useMemo(() => {
    const date = new Date(recording.createdAt);

    if (isToday(date)) {
      return t.today;
    }
    if (isYesterday(date)) {
      return t.yesterday;
    }

    const daysAgo = differenceInDays(new Date(), date);
    if (daysAgo < 7) {
      return `${daysAgo} ${t.daysAgo}`;
    }

    return format(date, 'yyyy/MM/dd');
  }, [recording.createdAt, t.today, t.yesterday, t.daysAgo]);

  // Memoize formatted duration
  const formattedDuration = useMemo(() => {
    const seconds = recording.duration;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours} ${t.hours} ${minutes} ${t.minutes}`;
    }
    if (minutes > 0) {
      return `${minutes} ${t.minutes}`;
    }
    return `${seconds} ${t.seconds}`;
  }, [recording.duration, t.hours, t.minutes, t.seconds]);

  // Memoize preview text
  const preview = useMemo(() => {
    if (recording.notes && recording.notes.length > 0) {
      const firstNote = recording.notes[0].text;
      return firstNote.length > 50
        ? firstNote.substring(0, 50) + '...'
        : firstNote;
    }
    return '';
  }, [recording.notes]);

  // Memoize status info
  const statusInfo = useMemo(() => {
    switch (recording.status) {
      case 'recording':
        return { icon: 'mic', color: Colors.recordingActive, text: '' };
      case 'processing_notes':
      case 'processing_summary':
        return { icon: 'hourglass', color: Colors.processing, text: t.processingStatus };
      case 'ready':
        return { icon: 'checkmark-circle', color: Colors.success, text: '' };
      case 'error':
        return { icon: 'alert-circle', color: Colors.error, text: t.error };
      default:
        return { icon: 'document', color: Colors.textTertiary, text: '' };
    }
  }, [recording.status, t.processingStatus, t.error]);
  const backgroundColor = isDark ? Colors.cardDark : Colors.card;
  const textColor = isDark ? Colors.textDark : Colors.text;
  const secondaryColor = isDark ? Colors.textSecondaryDark : Colors.textSecondary;
  const borderColor = isDark ? Colors.borderDark : Colors.border;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor,
          borderColor,
        },
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${recording.label || 'Recording'} from ${formattedDate}, ${formattedDuration}`}
    >
      {/* Label if exists */}
      {recording.label && (
        <Text
          style={[
            styles.label,
            { color: textColor, fontSize: getFontSize('bodyLarge', textSize) },
          ]}
          numberOfLines={1}
        >
          {recording.label}
        </Text>
      )}

      <View style={styles.header}>
        <Text
          style={[
            styles.date,
            { color: secondaryColor, fontSize: getFontSize('body', textSize) },
          ]}
        >
          {formattedDate}
        </Text>
        <View style={styles.statusContainer}>
          <Ionicons
            name={statusInfo.icon as any}
            size={20}
            color={statusInfo.color}
          />
          {statusInfo.text ? (
            <Text
              style={[
                styles.statusText,
                { color: statusInfo.color, fontSize: getFontSize('small', textSize) },
              ]}
            >
              {statusInfo.text}
            </Text>
          ) : null}
        </View>
      </View>

      <Text
        style={[
          styles.duration,
          { color: secondaryColor, fontSize: getFontSize('body', textSize) },
        ]}
      >
        {formattedDuration}
      </Text>

      {preview ? (
        <Text
          style={[
            styles.preview,
            { color: secondaryColor, fontSize: getFontSize('body', textSize) },
          ]}
          numberOfLines={2}
        >
          {preview}
        </Text>
      ) : null}

      {/* Status indicators */}
      <View style={styles.indicators}>
        {recording.notes && recording.notes.length > 0 && (
          <View style={styles.indicator}>
            <Ionicons name="checkmark" size={16} color={Colors.success} />
            <Text
              style={[
                styles.indicatorText,
                { color: Colors.success, fontSize: getFontSize('small', textSize) },
              ]}
            >
              {t.notesReady}
            </Text>
          </View>
        )}
        {recording.summary && recording.summary.length > 0 && (
          <View style={styles.indicator}>
            <Ionicons name="checkmark" size={16} color={Colors.success} />
            <Text
              style={[
                styles.indicatorText,
                { color: Colors.success, fontSize: getFontSize('small', textSize) },
              ]}
            >
              {t.summaryReady}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

RecordingCard.displayName = 'RecordingCard';

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  label: {
    fontWeight: '700',
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  date: {
    fontWeight: '700',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontWeight: '500',
  },
  duration: {
    marginBottom: 8,
  },
  preview: {
    marginTop: 4,
    lineHeight: 24,
  },
  indicators: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  indicatorText: {
    fontWeight: '500',
  },
});
