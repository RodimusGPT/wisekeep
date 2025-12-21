import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  useColorScheme,
  ScrollView,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useAppStore } from '@/store';
import { useI18n, useAuth, usePurchases } from '@/hooks';
import { SettingsItem, BigButton } from '@/components/ui';
import { getFontSize, TextSize } from '@/types';
import { Language } from '@/i18n/translations';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { t, language, setLanguage } = useI18n();
  const { settings, setTextSize } = useAppStore();
  const { user, usage, getRemainingMinutes } = useAuth();
  const {
    isPurchasesSupported,
    isProcessing: isPurchaseProcessing,
    showPaywall,
    restorePurchases,
    isPremium,
  } = usePurchases();
  const textSize = settings.textSize;

  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showTextSizeModal, setShowTextSizeModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);

  const backgroundColor = isDark ? Colors.backgroundDark : Colors.background;
  const textColor = isDark ? Colors.textDark : Colors.text;
  const secondaryColor = isDark ? Colors.textSecondaryDark : Colors.textSecondary;
  const cardBackground = isDark ? Colors.cardDark : Colors.card;

  // Get support code from user profile (stored in database)
  const supportCode = user?.supportCode ?? null;

  // Copy support code to clipboard
  const handleCopySupportCode = async () => {
    if (!supportCode) return;
    try {
      await Clipboard.setStringAsync(supportCode);
      Alert.alert('', t.codeCopied);
    } catch (error) {
      console.error('Failed to copy support code:', error);
    }
  };

  // Language display text
  const getLanguageDisplay = (lang: Language): string => {
    return lang === 'zh-TW' ? '繁體中文' : 'English';
  };

  // Text size display text
  const getTextSizeDisplay = (size: TextSize): string => {
    switch (size) {
      case 'small':
        return t.textSizeSmall;
      case 'medium':
        return t.textSizeMedium;
      case 'large':
        return t.textSizeLarge;
    }
  };

  const handleLanguageSelect = (lang: Language) => {
    setLanguage(lang);
    setShowLanguageModal(false);
  };

  const handleTextSizeSelect = (size: TextSize) => {
    setTextSize(size);
    setShowTextSizeModal(false);
  };

  // Handle upgrade button press
  const handleUpgrade = async () => {
    try {
      await showPaywall();
    } catch (error) {
      console.error('Error showing paywall:', error);
      Alert.alert(
        language === 'zh-TW' ? '錯誤' : 'Error',
        t.purchaseFailed
      );
    }
  };

  // Handle restore purchases
  const handleRestorePurchases = async () => {
    try {
      const restored = await restorePurchases();
      Alert.alert(
        '',
        restored ? t.purchaseRestored : t.noPurchasesToRestore
      );
    } catch (error) {
      console.error('Error restoring purchases:', error);
      Alert.alert(
        language === 'zh-TW' ? '錯誤' : 'Error',
        t.purchaseFailed
      );
    }
  };

  // Get tier display text
  const getTierDisplay = (): string => {
    if (!user) return language === 'zh-TW' ? '載入中...' : 'Loading...';
    switch (user.tier) {
      case 'vip':
        return 'VIP';
      case 'premium':
        return language === 'zh-TW' ? '高級會員' : 'Premium';
      default:
        return language === 'zh-TW' ? '免費版' : 'Free';
    }
  };

  // Get usage display text
  const getUsageDisplay = (): string => {
    if (!usage) return '';
    if (usage.isUnlimited) {
      return language === 'zh-TW' ? '無限制' : 'Unlimited';
    }
    const remaining = getRemainingMinutes();
    return language === 'zh-TW'
      ? `剩餘 ${remaining.toFixed(1)} 分鐘`
      : `${remaining.toFixed(1)} min remaining`;
  };

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
          {t.settings}
        </Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Subscription Section */}
        <View style={[styles.subscriptionCard, { backgroundColor: cardBackground }]}>
          <View style={styles.subscriptionHeader}>
            <View style={[
              styles.tierBadge,
              user?.tier === 'vip' && styles.tierBadgeVip,
              user?.tier === 'premium' && styles.tierBadgePremium,
            ]}>
              <Text style={styles.tierBadgeText}>{getTierDisplay()}</Text>
            </View>
            <Text style={[styles.usageText, { color: secondaryColor, fontSize: getFontSize('body', textSize) }]}>
              {getUsageDisplay()}
            </Text>
          </View>

          {/* Show usage bar for free tier */}
          {usage && !usage.isUnlimited && (
            <View style={styles.usageBarContainer}>
              <View style={styles.usageBarBackground}>
                <View
                  style={[
                    styles.usageBarFill,
                    { width: `${Math.min(100, (usage.minutesUsed / usage.minutesLimit) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={[styles.usageDetails, { color: secondaryColor, fontSize: getFontSize('small', textSize) }]}>
                {usage.minutesUsed.toFixed(1)} / {usage.minutesLimit} {language === 'zh-TW' ? '分鐘' : 'min'}
              </Text>
            </View>
          )}

          {/* Upgrade button - only show on mobile for free tier users */}
          {isPurchasesSupported && !isPremium && user?.tier === 'free' && (
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={handleUpgrade}
              disabled={isPurchaseProcessing}
            >
              {isPurchaseProcessing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="star" size={20} color="#FFFFFF" />
                  <Text style={[styles.upgradeButtonText, { fontSize: getFontSize('body', textSize) }]}>
                    {t.upgradeToPremium}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Restore purchases button - only show on mobile */}
          {isPurchasesSupported && (
            <TouchableOpacity
              style={styles.restoreButton}
              onPress={handleRestorePurchases}
              disabled={isPurchaseProcessing}
            >
              <Text style={[styles.restoreButtonText, { color: Colors.primary, fontSize: getFontSize('small', textSize) }]}>
                {t.restorePurchases}
              </Text>
            </TouchableOpacity>
          )}

          {/* Support Code - tap to copy */}
          {supportCode && (
            <TouchableOpacity
              style={styles.supportCodeContainer}
              onPress={handleCopySupportCode}
              activeOpacity={0.7}
            >
              <Text style={[styles.supportCodeLabel, { color: secondaryColor, fontSize: getFontSize('small', textSize) }]}>
                {t.supportCode}
              </Text>
              <View style={styles.supportCodeRow}>
                <Text style={[styles.supportCodeText, { color: textColor, fontSize: getFontSize('body', textSize) }]}>
                  {supportCode}
                </Text>
                <Ionicons name="copy-outline" size={16} color={secondaryColor} />
              </View>
            </TouchableOpacity>
          )}

        </View>

        {/* Language */}
        <SettingsItem
          icon="language"
          label={t.language}
          value={getLanguageDisplay(language)}
          onPress={() => setShowLanguageModal(true)}
        />

        {/* Text Size */}
        <SettingsItem
          icon="text"
          label={t.textSize}
          value={getTextSizeDisplay(textSize)}
          onPress={() => setShowTextSizeModal(true)}
        />

        {/* Help */}
        <SettingsItem
          icon="help-circle"
          label={t.help}
          onPress={() => {}}
        />

        {/* About */}
        <SettingsItem
          icon="information-circle"
          label={t.about}
          onPress={() => setShowAboutModal(true)}
        />
      </ScrollView>

      {/* Language Modal */}
      <Modal
        visible={showLanguageModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowLanguageModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, { backgroundColor: cardBackground }]}>
                <View style={styles.modalHandle} />
                <Text
                  style={[
                    styles.modalTitle,
                    { color: textColor, fontSize: getFontSize('header', textSize) },
                  ]}
                >
                  {t.language}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    language === 'zh-TW' && styles.optionButtonActive,
                  ]}
                  onPress={() => handleLanguageSelect('zh-TW')}
                >
                  <Text style={styles.optionFlag}>🇹🇼</Text>
                  <Text
                    style={[
                      styles.optionText,
                      { color: textColor, fontSize: getFontSize('body', textSize) },
                    ]}
                  >
                    繁體中文
                  </Text>
                  {language === 'zh-TW' && (
                    <Ionicons name="checkmark" size={24} color={Colors.primary} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    language === 'en' && styles.optionButtonActive,
                  ]}
                  onPress={() => handleLanguageSelect('en')}
                >
                  <Text style={styles.optionFlag}>🇺🇸</Text>
                  <Text
                    style={[
                      styles.optionText,
                      { color: textColor, fontSize: getFontSize('body', textSize) },
                    ]}
                  >
                    English
                  </Text>
                  {language === 'en' && (
                    <Ionicons name="checkmark" size={24} color={Colors.primary} />
                  )}
                </TouchableOpacity>

                <BigButton
                  title={t.cancel}
                  onPress={() => setShowLanguageModal(false)}
                  variant="secondary"
                  style={styles.cancelButton}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Text Size Modal */}
      <Modal
        visible={showTextSizeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTextSizeModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowTextSizeModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, { backgroundColor: cardBackground }]}>
                <View style={styles.modalHandle} />
                <Text
                  style={[
                    styles.modalTitle,
                    { color: textColor, fontSize: getFontSize('header', textSize) },
                  ]}
                >
                  {t.textSize}
                </Text>

                {/* Text Size Preview */}
                <View style={styles.previewContainer}>
                  <Text
                    style={[
                      styles.previewText,
                      { color: secondaryColor, fontSize: getFontSize('body', textSize) },
                    ]}
                  >
                    {t.tagline}
                  </Text>
                </View>

                {(['small', 'medium', 'large'] as TextSize[]).map((size) => (
                  <TouchableOpacity
                    key={size}
                    style={[
                      styles.optionButton,
                      textSize === size && styles.optionButtonActive,
                    ]}
                    onPress={() => handleTextSizeSelect(size)}
                  >
                    <Text
                      style={[
                        styles.sizePreviewText,
                        {
                          color: textColor,
                          fontSize: getFontSize('body', size),
                        },
                      ]}
                    >
                      {getTextSizeDisplay(size)}
                    </Text>
                    {textSize === size && (
                      <Ionicons name="checkmark" size={24} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}

                <BigButton
                  title={t.cancel}
                  onPress={() => setShowTextSizeModal(false)}
                  variant="secondary"
                  style={styles.cancelButton}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* About Modal */}
      <Modal
        visible={showAboutModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAboutModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowAboutModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, { backgroundColor: cardBackground }]}>
                <View style={styles.modalHandle} />

                {/* Logo */}
                <View style={styles.aboutLogo}>
                  <Ionicons name="mic" size={48} color="#FFFFFF" />
                </View>

                <Text
                  style={[
                    styles.aboutAppName,
                    { color: textColor, fontSize: getFontSize('headerLarge', textSize) },
                  ]}
                >
                  {t.appName}
                </Text>

                <Text
                  style={[
                    styles.aboutTagline,
                    { color: Colors.primary, fontSize: getFontSize('body', textSize) },
                  ]}
                >
                  {t.tagline}
                </Text>

                <Text
                  style={[
                    styles.aboutVersion,
                    { color: secondaryColor, fontSize: getFontSize('small', textSize) },
                  ]}
                >
                  {t.version} 1.0.0
                </Text>

                <Text
                  style={[
                    styles.aboutDescription,
                    { color: secondaryColor, fontSize: getFontSize('body', textSize) },
                  ]}
                >
                  {t.welcomeTagline}
                </Text>

                <BigButton
                  title={t.cancel}
                  onPress={() => setShowAboutModal(false)}
                  variant="secondary"
                  style={styles.cancelButton}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

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
  scrollView: {
    flex: 1,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  optionButtonActive: {
    backgroundColor: 'rgba(211, 47, 47, 0.1)',
  },
  optionFlag: {
    fontSize: 32,
    marginRight: 16,
  },
  optionText: {
    flex: 1,
    fontWeight: '500',
  },
  sizePreviewText: {
    flex: 1,
    fontWeight: '500',
  },
  cancelButton: {
    marginTop: 16,
  },

  // Text size preview
  previewContainer: {
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  previewText: {
    fontStyle: 'italic',
  },

  // About modal
  aboutLogo: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  aboutAppName: {
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  aboutTagline: {
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  aboutVersion: {
    textAlign: 'center',
    marginBottom: 24,
  },
  aboutDescription: {
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 24,
  },

  // Subscription card
  subscriptionCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 16,
    padding: 20,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tierBadge: {
    backgroundColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  tierBadgeVip: {
    backgroundColor: '#FFD700',
  },
  tierBadgePremium: {
    backgroundColor: Colors.primary,
  },
  tierBadgeText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 14,
  },
  usageText: {
    fontWeight: '500',
  },
  usageBarContainer: {
    marginBottom: 16,
  },
  usageBarBackground: {
    height: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  usageBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  usageDetails: {
    textAlign: 'right',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  restoreButtonText: {
    fontWeight: '500',
  },
  supportCodeContainer: {
    alignItems: 'center',
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  supportCodeLabel: {
    marginBottom: 4,
  },
  supportCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  supportCodeText: {
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
  },
});
