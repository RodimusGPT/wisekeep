import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useAppStore } from '@/store';
import { useI18n, useTheme } from '@/hooks';
import { getFontSize } from '@/types';

interface SummaryViewProps {
  summary: string[];
  tapNotesHint?: boolean;
}

export function SummaryView({ summary, tapNotesHint = true }: SummaryViewProps) {
  const { colors } = useTheme();
  const textSize = useAppStore((state) => state.settings.textSize);
  const { t } = useI18n();

  const { text: textColor, textSecondary: secondaryColor, card: cardBackground, border: borderColor } = colors;
  const bulletColor = Colors.primary;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator
    >
      {/* Summary header */}
      <View style={styles.headerContainer}>
        <Ionicons name="list" size={20} color={bulletColor} />
        <Text
          style={[
            styles.headerText,
            { color: bulletColor, fontSize: getFontSize('body', textSize) },
          ]}
        >
          {summary.length} {summary.length === 1 ? 'Key Point' : 'Key Points'}
        </Text>
      </View>

      {summary.map((point, index) => (
        <View
          key={index}
          style={[
            styles.point,
            { backgroundColor: cardBackground, borderColor },
          ]}
        >
          {/* Numbered bullet for easier reference */}
          <View style={[styles.bulletContainer, { backgroundColor: bulletColor }]}>
            <Text style={styles.bulletNumber}>{index + 1}</Text>
          </View>
          <Text
            style={[
              styles.text,
              {
                color: textColor,
                fontSize: getFontSize('body', textSize),
              },
            ]}
          >
            {point}
          </Text>
        </View>
      ))}

      {/* Hint to view notes */}
      {tapNotesHint && (
        <View style={styles.hintContainer}>
          <Ionicons name="document-text-outline" size={20} color={secondaryColor} />
          <Text
            style={[
              styles.hint,
              { color: secondaryColor, fontSize: getFontSize('body', textSize) },
            ]}
          >
            {t.tapNotesForMore}
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
    paddingHorizontal: 4,
    paddingVertical: 12,
    flexGrow: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  headerText: {
    fontWeight: '600',
  },
  point: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    paddingLeft: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  bulletContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    marginTop: 2,
  },
  bulletNumber: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  text: {
    flex: 1,
    lineHeight: 28, // Increased line height for readability
    fontWeight: '400',
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
