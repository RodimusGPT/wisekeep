import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useAppStore } from '@/store';
import { useI18n } from '@/hooks';
import { getFontSize } from '@/types';

interface SummaryViewProps {
  summary: string[];
  tapNotesHint?: boolean;
}

export function SummaryView({ summary, tapNotesHint = true }: SummaryViewProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const textSize = useAppStore((state) => state.settings.textSize);
  const { t } = useI18n();

  const textColor = isDark ? Colors.textDark : Colors.text;
  const secondaryColor = isDark ? Colors.textSecondaryDark : Colors.textSecondary;
  const bulletColor = Colors.primary;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator
    >
      {summary.map((point, index) => (
        <View key={index} style={styles.point}>
          <View style={styles.bulletContainer}>
            <Ionicons
              name="ellipse"
              size={10}
              color={bulletColor}
              style={styles.bullet}
            />
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
        <Text
          style={[
            styles.hint,
            { color: secondaryColor, fontSize: getFontSize('small', textSize) },
          ]}
        >
          {t.tapNotesForMore}
        </Text>
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
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexGrow: 1,
  },
  point: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingRight: 8,
  },
  bulletContainer: {
    width: 20,
    paddingTop: 4,
  },
  bullet: {
    marginTop: 0,
  },
  text: {
    flex: 1,
    lineHeight: 24,
    fontWeight: '400',
  },
  hint: {
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
    fontStyle: 'italic',
  },
});
