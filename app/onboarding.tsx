import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  useColorScheme,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useAppStore } from '@/store';
import { useI18n, useRecording } from '@/hooks';
import { BigButton } from '@/components/ui';
import { getFontSize } from '@/types';
import { Language } from '@/i18n/translations';

type OnboardingStep = 'language' | 'welcome' | 'permission';

export default function OnboardingScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  const [step, setStep] = useState<OnboardingStep>('language');

  const { t, setLanguage, language } = useI18n();
  const { settings, completeOnboarding, setMicrophonePermission } = useAppStore();
  const { requestPermission, hasPermission } = useRecording();
  const textSize = settings.textSize;

  const backgroundColor = isDark ? Colors.backgroundDark : Colors.background;
  const textColor = isDark ? Colors.textDark : Colors.text;
  const secondaryColor = isDark ? Colors.textSecondaryDark : Colors.textSecondary;

  const handleLanguageSelect = (lang: Language) => {
    setLanguage(lang);
    setStep('welcome');
  };

  const handleContinueToPermission = () => {
    setStep('permission');
  };

  const handleRequestPermission = async () => {
    const granted = await requestPermission();
    setMicrophonePermission(granted);

    if (granted) {
      completeOnboarding();
      router.replace('/(tabs)');
    }
  };

  const handleSkipPermission = () => {
    completeOnboarding();
    router.replace('/(tabs)');
  };

  // Language Selection Step
  if (step === 'language') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <View style={styles.content}>
          <Text
            style={[
              styles.title,
              { color: textColor, fontSize: getFontSize('headerLarge', textSize) },
            ]}
          >
            {t.selectLanguage}
          </Text>

          <View style={styles.languageButtons}>
            <TouchableOpacity
              style={[
                styles.languageButton,
                {
                  backgroundColor: isDark ? Colors.cardDark : Colors.card,
                  borderColor: language === 'zh-TW' ? Colors.primary : Colors.border,
                },
              ]}
              onPress={() => handleLanguageSelect('zh-TW')}
              activeOpacity={0.7}
            >
              <Text style={styles.languageFlag}>🇹🇼</Text>
              <Text
                style={[
                  styles.languageText,
                  { color: textColor, fontSize: getFontSize('header', textSize) },
                ]}
              >
                繁體中文
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.languageButton,
                {
                  backgroundColor: isDark ? Colors.cardDark : Colors.card,
                  borderColor: language === 'en' ? Colors.primary : Colors.border,
                },
              ]}
              onPress={() => handleLanguageSelect('en')}
              activeOpacity={0.7}
            >
              <Text style={styles.languageFlag}>🇺🇸</Text>
              <Text
                style={[
                  styles.languageText,
                  { color: textColor, fontSize: getFontSize('header', textSize) },
                ]}
              >
                English
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Welcome Step
  if (step === 'welcome') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Ionicons name="mic" size={60} color="#FFFFFF" />
            </View>
          </View>

          <Text
            style={[
              styles.title,
              { color: textColor, fontSize: getFontSize('headerLarge', textSize) },
            ]}
          >
            {t.welcome}
          </Text>

          <Text
            style={[
              styles.subtitle,
              { color: secondaryColor, fontSize: getFontSize('bodyLarge', textSize) },
            ]}
          >
            {t.welcomeTagline}
          </Text>

          <Text
            style={[
              styles.tagline,
              { color: Colors.primary, fontSize: getFontSize('body', textSize) },
            ]}
          >
            {t.tagline}
          </Text>

          <View style={styles.buttonContainer}>
            <BigButton
              title={t.continueButton}
              onPress={handleContinueToPermission}
              size="large"
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Permission Step
  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <View style={styles.content}>
        <View style={styles.permissionIcon}>
          <Ionicons name="mic-outline" size={80} color={Colors.primary} />
        </View>

        <Text
          style={[
            styles.title,
            { color: textColor, fontSize: getFontSize('headerLarge', textSize) },
          ]}
        >
          {t.microphonePermissionTitle}
        </Text>

        <Text
          style={[
            styles.permissionMessage,
            { color: secondaryColor, fontSize: getFontSize('bodyLarge', textSize) },
          ]}
        >
          {t.microphonePermissionMessage}
        </Text>

        <View style={styles.buttonContainer}>
          <BigButton
            title={t.grantPermission}
            onPress={handleRequestPermission}
            size="large"
          />

          {/* Allow skip for now */}
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkipPermission}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.skipText,
                { color: secondaryColor, fontSize: getFontSize('body', textSize) },
              ]}
            >
              {t.continueButton}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logoContainer: {
    marginBottom: 40,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 32,
  },
  tagline: {
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 48,
  },
  languageButtons: {
    width: '100%',
    gap: 20,
    marginTop: 40,
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 32,
    borderRadius: 16,
    borderWidth: 3,
    gap: 16,
  },
  languageFlag: {
    fontSize: 40,
  },
  languageText: {
    fontWeight: '600',
  },
  permissionIcon: {
    marginBottom: 32,
  },
  permissionMessage: {
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 48,
  },
  buttonContainer: {
    width: '100%',
    gap: 20,
  },
  skipButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  skipText: {
    fontWeight: '500',
  },
});
