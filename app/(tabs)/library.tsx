import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  useColorScheme,
  FlatList,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useAppStore } from '@/store';
import { useI18n } from '@/hooks';
import { RecordingCard } from '@/components/ui';
import { getFontSize, Recording } from '@/types';

export default function LibraryScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  const { t } = useI18n();
  const { settings, recordings } = useAppStore();
  const textSize = settings.textSize;

  const [searchQuery, setSearchQuery] = useState('');

  const backgroundColor = isDark ? Colors.backgroundDark : Colors.background;
  const textColor = isDark ? Colors.textDark : Colors.text;
  const secondaryColor = isDark ? Colors.textSecondaryDark : Colors.textSecondary;
  const inputBackgroundColor = isDark ? Colors.backgroundSecondaryDark : Colors.backgroundSecondary;
  const borderColor = isDark ? Colors.borderDark : Colors.border;

  // Filter recordings based on search query
  const filteredRecordings = useMemo(() => {
    if (!searchQuery.trim()) {
      return recordings;
    }

    const query = searchQuery.toLowerCase();
    return recordings.filter((recording) => {
      // Search in notes
      if (recording.notes) {
        const notesMatch = recording.notes.some((note) =>
          note.text.toLowerCase().includes(query)
        );
        if (notesMatch) return true;
      }

      // Search in summary
      if (recording.summary) {
        const summaryMatch = recording.summary.some((point) =>
          point.toLowerCase().includes(query)
        );
        if (summaryMatch) return true;
      }

      // Search by date
      const dateMatch = recording.createdAt.toLowerCase().includes(query);
      if (dateMatch) return true;

      return false;
    });
  }, [recordings, searchQuery]);

  const handleRecordingPress = (recording: Recording) => {
    router.push(`/recording/${recording.id}`);
  };

  const renderRecording = ({ item }: { item: Recording }) => (
    <RecordingCard recording={item} onPress={() => handleRecordingPress(item)} />
  );

  const renderEmptyList = () => (
    <View style={styles.emptyState}>
      <Ionicons
        name="folder-open-outline"
        size={64}
        color={secondaryColor}
        style={styles.emptyIcon}
      />
      <Text
        style={[
          styles.emptyTitle,
          { color: secondaryColor, fontSize: getFontSize('body', textSize) },
        ]}
      >
        {searchQuery ? t.search : t.noRecordings}
      </Text>
      <Text
        style={[
          styles.emptyMessage,
          { color: secondaryColor, fontSize: getFontSize('body', textSize) },
        ]}
      >
        {searchQuery ? '' : t.noRecordingsMessage}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text
          style={[
            styles.title,
            { color: textColor, fontSize: getFontSize('headerLarge', textSize) },
          ]}
        >
          {t.myRecordings}
        </Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View
          style={[
            styles.searchInputContainer,
            { backgroundColor: inputBackgroundColor, borderColor },
          ]}
        >
          <Ionicons
            name="search"
            size={24}
            color={secondaryColor}
            style={styles.searchIcon}
          />
          <TextInput
            style={[
              styles.searchInput,
              { color: textColor, fontSize: getFontSize('body', textSize) },
            ]}
            placeholder={t.searchPlaceholder}
            placeholderTextColor={secondaryColor}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            accessibilityLabel={t.search}
          />
        </View>
      </View>

      {/* Recordings List */}
      <FlatList
        data={filteredRecordings}
        renderItem={renderRecording}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyList}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontWeight: '700',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyMessage: {
    textAlign: 'center',
    lineHeight: 28,
    paddingHorizontal: 20,
  },
});
