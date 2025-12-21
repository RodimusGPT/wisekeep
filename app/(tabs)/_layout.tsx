import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme, Platform } from 'react-native';

import { Colors } from '@/constants/Colors';
import { useI18n } from '@/hooks';
import { useAppStore } from '@/store';
import { getFontSize } from '@/types';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { t } = useI18n();
  const textSize = useAppStore((state) => state.settings.textSize);

  const tabBarLabelStyle = {
    fontSize: getFontSize('small', textSize),
    fontWeight: '600' as const,
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: isDark ? Colors.tabInactiveDark : Colors.tabInactive,
        tabBarStyle: {
          backgroundColor: isDark ? Colors.backgroundDark : Colors.background,
          borderTopColor: isDark ? Colors.borderDark : Colors.border,
          height: Platform.OS === 'ios' ? 88 : Platform.OS === 'web' ? 80 : 70,
          paddingTop: Platform.OS === 'web' ? 10 : 8,
          paddingBottom: Platform.OS === 'ios' ? 28 : Platform.OS === 'web' ? 12 : 12,
        },
        tabBarLabelStyle,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabRecord,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="mic" size={28} color={color} />
          ),
          tabBarAccessibilityLabel: t.tabRecord,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: t.tabLibrary,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="folder" size={28} color={color} />
          ),
          tabBarAccessibilityLabel: t.tabLibrary,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t.tabSettings,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={28} color={color} />
          ),
          tabBarAccessibilityLabel: t.tabSettings,
        }}
      />
    </Tabs>
  );
}
