/**
 * Admin Panel Layout
 * Completely separate from the main app - no user auth, no device IDs, no app state
 */

import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
