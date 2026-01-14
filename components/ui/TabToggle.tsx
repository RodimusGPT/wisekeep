import React from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/Colors';
import { useAppStore } from '@/store';
import { useTheme } from '@/hooks';
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
  const { isDark, colors } = useTheme();
  const textSize = useAppStore((state) => state.settings.textSize);

  const handleTabPress = (key: string) => {
    if (key !== activeTab) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onTabChange(key);
    }
  };

  const backgroundColor = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)';
  const activeBackgroundColor = isDark ? colors.card : '#FFFFFF';
  const activeTextColor = colors.text;
  const inactiveTextColor = colors.textTertiary;
  const activeBorderColor = Colors.primary;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;

        return (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              isActive && [
                styles.activeTab,
                { backgroundColor: activeBackgroundColor, borderColor: activeBorderColor },
              ],
            ]}
            onPress={() => handleTabPress(tab.key)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: isActive ? activeTextColor : inactiveTextColor,
                  fontSize: getFontSize('body', textSize),
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
    minHeight: 48, // Senior-friendly: minimum 48px touch target
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeTab: {
    // Shadow for active state depth
    // @ts-ignore - boxShadow supported on web
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 2,
  },
  tabText: {
    fontWeight: '500',
    textAlign: 'center',
  },
  activeTabText: {
    fontWeight: '700',
  },
});
