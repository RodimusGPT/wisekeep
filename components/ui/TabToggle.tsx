import React from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/Colors';
import { useAppStore } from '@/store';
import { getFontSize } from '@/types';

interface Tab {
  key: string;
  label: string;
}

interface TabToggleProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

export function TabToggle({ tabs, activeTab, onTabChange }: TabToggleProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const textSize = useAppStore((state) => state.settings.textSize);

  const handleTabPress = (key: string) => {
    if (key !== activeTab) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onTabChange(key);
    }
  };

  const backgroundColor = isDark ? Colors.backgroundSecondaryDark : Colors.backgroundSecondary;
  const activeBackgroundColor = Colors.playback; // Blue for playback page controls
  const inactiveTextColor = isDark ? Colors.textDark : Colors.text;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;

        return (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              isActive && { backgroundColor: activeBackgroundColor },
            ]}
            onPress={() => handleTabPress(tab.key)}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: isActive ? '#FFFFFF' : inactiveTextColor,
                  fontSize: getFontSize('button', textSize),
                },
                isActive && styles.activeTabText,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontWeight: '500',
    textAlign: 'center',
  },
  activeTabText: {
    fontWeight: '700',
  },
});
