import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Ionicons } from '@expo/vector-icons';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { useAppStore } from '@/store';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/Colors';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const segments = useSegments();
  const { settings } = useAppStore();
  const { initAuth, isAuthLoading } = useAuth();
  const [isMounted, setIsMounted] = useState(false);

  // Track when layout is mounted
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Initialize user authentication when app starts
  // Note: Admin uses a completely separate Supabase client with its own storage,
  // so user auth and admin auth are fully isolated - no need to skip on admin routes
  useEffect(() => {
    console.log('[Layout] Effect running, isMounted:', isMounted);
    if (isMounted) {
      console.log('[Layout] Calling initAuth...');
      initAuth();
    }
  }, [isMounted, initAuth]);

  // Redirect to onboarding if not completed
  useEffect(() => {
    if (!isMounted || isAuthLoading) return;

    const inOnboarding = segments[0] === 'onboarding';

    if (!settings.hasCompletedOnboarding && !inOnboarding) {
      router.replace('/onboarding');
    }
  }, [settings.hasCompletedOnboarding, segments, isMounted, isAuthLoading, router]);

  // Custom theme with WiseKeep colors
  const lightTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: Colors.primary,
      background: Colors.background,
      card: Colors.card,
      text: Colors.text,
      border: Colors.border,
    },
  };

  const darkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: Colors.primaryLight,
      background: Colors.backgroundDark,
      card: Colors.cardDark,
      text: Colors.textDark,
      border: Colors.borderDark,
    },
  };

  return (
    <ThemeProvider value={isDark ? darkTheme : lightTheme}>
      <Stack>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="recording/[id]"
          options={{
            headerTitle: '',
            headerBackTitle: '',
            headerTintColor: Colors.primary,
            headerStyle: {
              backgroundColor: isDark ? Colors.backgroundDark : Colors.background,
            },
            headerLeft: () => (
              <Ionicons
                name="arrow-back"
                size={28}
                color={Colors.primary}
                onPress={() => router.back()}
                style={{ paddingHorizontal: 8, paddingVertical: 4 }}
              />
            ),
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
