import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Modal,
  TouchableOpacity,
  Pressable,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useAppStore } from '@/store';
import { useI18n, useAuth, usePurchases, useTheme } from '@/hooks';
import { SettingsItem, BigButton } from '@/components/ui';
import { getFontSize, TextSize } from '@/types';
import { Language } from '@/i18n/translations';

export default function SettingsScreen() {
  const { isDark, colors } = useTheme();

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

  const { background: backgroundColor, text: textColor, textSecondary: secondaryColor, card: cardBackground } = colors;

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

  // Get AI processing usage display
  const getAIUsageDisplay = (): string => {
    if (!usage) return '';
    if (usage.isUnlimited) {
      return language === 'zh-TW' ? '無限制' : 'Unlimited';
    }
    return language === 'zh-TW'
      ? `剩餘 ${usage.aiMinutesRemaining.toFixed(1)} 分鐘`
      : `${usage.aiMinutesRemaining.toFixed(1)} min remaining`;
  };

  // Get storage usage display
  const getStorageUsageDisplay = (): string => {
    if (!usage) return '';
    if (usage.storageLimit === -1) {
      return language === 'zh-TW' ? '無限制' : 'Unlimited';
    }
    return language === 'zh-TW'
      ? `剩餘 ${usage.storageRemaining} 個錄音`
      : `${usage.storageRemaining} recordings left`;
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
          </View>

          {/* AI Processing Usage */}
          {usage && (
            <View style={styles.usageSectionContainer}>
              <View style={styles.usageLabelRow}>
                <Ionicons name="flash" size={16} color={Colors.primary} />
                <Text style={[styles.usageLabel, { color: textColor, fontSize: getFontSize('body', textSize) }]}>
                  {language === 'zh-TW' ? 'AI 處理' : 'AI Processing'}
                </Text>
                <Text style={[styles.usageValue, { color: secondaryColor, fontSize: getFontSize('body', textSize) }]}>
                  {getAIUsageDisplay()}
                </Text>
              </View>
              {!usage.isUnlimited && (
                <View style={styles.usageBarContainer}>
                  <View style={styles.usageBarBackground}>
                    <View
                      style={[
                        styles.usageBarFill,
                        { width: `${Math.min(100, (usage.aiMinutesUsed / usage.aiMinutesLimit) * 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={[styles.usageDetails, { color: secondaryColor, fontSize: getFontSize('small', textSize) }]}>
                    {usage.aiMinutesUsed.toFixed(1)} / {usage.aiMinutesLimit} {language === 'zh-TW' ? '分鐘' : 'min'}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Storage Usage */}
          {usage && (
            <View style={styles.usageSectionContainer}>
              <View style={styles.usageLabelRow}>
                <Ionicons name="folder" size={16} color={Colors.primary} />
                <Text style={[styles.usageLabel, { color: textColor, fontSize: getFontSize('body', textSize) }]}>
                  {language === 'zh-TW' ? '儲存空間' : 'Storage'}
                </Text>
                <Text style={[styles.usageValue, { color: secondaryColor, fontSize: getFontSize('body', textSize) }]}>
                  {getStorageUsageDisplay()}
                </Text>
              </View>
              {usage.storageLimit !== -1 && (
                <View style={styles.usageBarContainer}>
                  <View style={styles.usageBarBackground}>
                    <View
                      style={[
                        styles.usageBarFill,
                        { width: `${Math.min(100, (usage.storageUsed / usage.storageLimit) * 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={[styles.usageDetails, { color: secondaryColor, fontSize: getFontSize('small', textSize) }]}>
                    {usage.storageUsed} / {usage.storageLimit} {language === 'zh-TW' ? '個錄音' : 'recordings'}
                  </Text>
                </View>
              )}
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
        <Pressable style={styles.modalOverlay} onPress={() => setShowLanguageModal(false)}>
          <Pressable>
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
          </Pressable>
        </Pressable>
      </Modal>

      {/* Text Size Modal */}
      <Modal
        visible={showTextSizeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTextSizeModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowTextSizeModal(false)}>
          <Pressable>
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
          </Pressable>
        </Pressable>
      </Modal>

      {/* About Modal */}
      <Modal
        visible={showAboutModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAboutModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowAboutModal(false)}>
          <Pressable>
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
          </Pressable>
        </Pressable>
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
    borderRadius: 20,
    padding: 24,
    // Shadow for depth
    // @ts-ignore - boxShadow supported on web
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
    elevation: 4,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.15)',
  },
  usageSectionContainer: {
    marginBottom: 24,
  },
  usageLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  usageLabel: {
    fontWeight: '700',
    flex: 1,
  },
  usageValue: {
    fontWeight: '600',
  },
  tierBadge: {
    backgroundColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
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
    fontSize: 15,
  },
  usageText: {
    fontWeight: '500',
  },
  usageBarContainer: {
    marginBottom: 8,
  },
  usageBarBackground: {
    height: 12,
    backgroundColor: 'rgba(128, 128, 128, 0.15)',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 10,
  },
  usageBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 6,
  },
  usageDetails: {
    textAlign: 'right',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 12,
    gap: 10,
    // Shadow for button
    // @ts-ignore - boxShadow supported on web
    boxShadow: '0px 4px 8px rgba(198, 40, 40, 0.3)',
    elevation: 4,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 12,
  },
  restoreButtonText: {
    fontWeight: '600',
  },
  supportCodeContainer: {
    alignItems: 'center',
    paddingTop: 20,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.15)',
  },
  supportCodeLabel: {
    marginBottom: 6,
  },
  supportCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    borderRadius: 8,
  },
  supportCodeText: {
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 2,
  },
});
