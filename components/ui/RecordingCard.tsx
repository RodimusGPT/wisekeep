import React, { useMemo, useCallback } from 'react';
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
import { useI18n, useTheme } from '@/hooks';
import { Recording, getFontSize } from '@/types';
import { format, isToday, isYesterday, differenceInDays } from 'date-fns';

interface RecordingCardProps {
  recording: Recording;
  onPress: () => void;
}

export const RecordingCard = React.memo(({ recording, onPress }: RecordingCardProps) => {
  const { isDark, colors } = useTheme();
  const textSize = useAppStore((state) => state.settings.textSize);
  const { t } = useI18n();

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

  // Memoize formatted time
  const formattedTime = useMemo(() => {
    const date = new Date(recording.createdAt);
    return format(date, 'HH:mm');
  }, [recording.createdAt]);

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
      return firstNote.length > 60
        ? firstNote.substring(0, 60) + '...'
        : firstNote;
    }
    return '';
  }, [recording.notes]);

  // Memoize status info
  const statusInfo = useMemo(() => {
    switch (recording.status) {
      case 'recording':
        return { icon: 'mic', color: Colors.recordingActive, text: '', bgColor: Colors.recordingBackground };
      case 'processing_notes':
      case 'processing_summary':
        return { icon: 'hourglass', color: Colors.processing, text: t.processingStatus, bgColor: isDark ? 'rgba(21, 101, 192, 0.2)' : 'rgba(21, 101, 192, 0.1)' };
      case 'ready':
        return { icon: 'checkmark-circle', color: Colors.success, text: '', bgColor: isDark ? 'rgba(46, 125, 50, 0.2)' : 'rgba(46, 125, 50, 0.1)' };
      case 'error':
        return { icon: 'alert-circle', color: Colors.error, text: t.error, bgColor: isDark ? 'rgba(183, 28, 28, 0.2)' : 'rgba(183, 28, 28, 0.1)' };
      case 'recorded':
        return { icon: 'cloud-upload', color: Colors.textTertiary, text: '', bgColor: 'transparent' };
      default:
        return { icon: 'document', color: Colors.textTertiary, text: '', bgColor: 'transparent' };
    }
  }, [recording.status, t.processingStatus, t.error, isDark]);

  const { card: backgroundColor, text: textColor, textSecondary: secondaryColor, border: borderColor, textTertiary: chevronColor } = colors;

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
      accessibilityHint="Double tap to view recording details"
    >
      <View style={styles.cardContent}>
        {/* Main content */}
        <View style={styles.mainContent}>
          {/* Status badge */}
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
            <Ionicons
              name={statusInfo.icon as any}
              size={24}
              color={statusInfo.color}
            />
          </View>

          {/* Text content */}
          <View style={styles.textContent}>
            {/* Label or date as title */}
            <Text
              style={[
                styles.title,
                { color: textColor, fontSize: getFontSize('bodyLarge', textSize) },
              ]}
              numberOfLines={1}
            >
              {recording.label || formattedDate}
            </Text>

            {/* Date/time row */}
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={16} color={secondaryColor} />
              <Text
                style={[
                  styles.metaText,
                  { color: secondaryColor, fontSize: getFontSize('body', textSize) },
                ]}
              >
                {recording.label ? formattedDate : formattedTime}
              </Text>
              <View style={styles.metaDivider} />
              <Ionicons name="time-outline" size={16} color={secondaryColor} />
              <Text
                style={[
                  styles.metaText,
                  { color: secondaryColor, fontSize: getFontSize('body', textSize) },
                ]}
              >
                {formattedDuration}
              </Text>
            </View>

            {/* Preview text */}
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

            {/* Status text if processing/error */}
            {statusInfo.text ? (
              <View style={styles.statusTextContainer}>
                <Text
                  style={[
                    styles.statusText,
                    { color: statusInfo.color, fontSize: getFontSize('body', textSize) },
                  ]}
                >
                  {statusInfo.text}
                </Text>
              </View>
            ) : null}

            {/* Status indicator - combined notes & summary */}
            {((recording.notes && recording.notes.length > 0) || (recording.summary && recording.summary.length > 0)) && (
              <View style={styles.indicators}>
                <View style={[styles.indicator, { backgroundColor: isDark ? 'rgba(46, 125, 50, 0.2)' : 'rgba(46, 125, 50, 0.1)' }]}>
                  <Ionicons name="document-text" size={18} color={Colors.success} />
                  <Text
                    style={[
                      styles.indicatorText,
                      { color: Colors.success, fontSize: getFontSize('small', textSize) },
                    ]}
                  >
                    {t.summaryReady}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Chevron indicator - shows this is tappable */}
        <View style={styles.chevronContainer}>
          <Ionicons name="chevron-forward" size={24} color={chevronColor} />
        </View>
      </View>
    </TouchableOpacity>
  );
});

RecordingCard.displayName = 'RecordingCard';

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    // Shadow for depth
    // @ts-ignore - boxShadow supported on web
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 2,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  statusBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textContent: {
    flex: 1,
  },
  title: {
    fontWeight: '700',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  metaText: {
    fontWeight: '500',
  },
  metaDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textTertiary,
    marginHorizontal: 4,
  },
  preview: {
    lineHeight: 24,
    marginBottom: 8,
  },
  statusTextContainer: {
    marginBottom: 8,
  },
  statusText: {
    fontWeight: '600',
  },
  indicators: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  indicatorText: {
    fontWeight: '600',
  },
  chevronContainer: {
    paddingLeft: 8,
    justifyContent: 'center',
  },
});
