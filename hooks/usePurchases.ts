/**
 * usePurchases.ts
 *
 * RevenueCat integration for WiseKeep mobile subscriptions.
 * Handles in-app purchases for iOS and Android only (not web).
 *
 * Prerequisites:
 * - RevenueCat account setup (https://www.revenuecat.com/)
 * - API keys configured in environment variables
 * - react-native-purchases package installed
 */

import { useCallback, useEffect, useState } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import Purchases, {
  CustomerInfo,
  PurchasesPackage,
  PURCHASES_ERROR_CODE,
  PurchasesError,
  LOG_LEVEL,
} from 'react-native-purchases';

// Configuration
const IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

// Entitlement ID for premium/VIP access
const ENTITLEMENT_ID = 'premium';

// Check if we're on a platform that supports purchases
const isPurchasesSupported = Platform.OS === 'ios' || Platform.OS === 'android';

// Get the appropriate API key for the current platform
const getApiKey = (): string | undefined => {
  if (Platform.OS === 'ios') return IOS_API_KEY;
  if (Platform.OS === 'android') return ANDROID_API_KEY;
  return undefined;
};

/**
 * Type guard for RevenueCat PurchasesError
 */
function isPurchasesError(error: unknown): error is PurchasesError {
  return typeof error === 'object' && error !== null && 'code' in error;
}

/**
 * Structured error type for purchases
 */
export interface PurchasesHookError {
  message: string;
  code?: string;
}

/**
 * Return type for usePurchases hook
 */
export interface UsePurchasesResult {
  // State
  isInitialized: boolean;
  isLoading: boolean;
  isProcessing: boolean;
  error: PurchasesHookError | null;

  // Data
  isPremium: boolean;
  customerInfo: CustomerInfo | null;
  availablePackages: readonly PurchasesPackage[];

  // Actions
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  showPaywall: () => Promise<void>;

  // Platform info
  isPurchasesSupported: boolean;
}

/**
 * Main hook for RevenueCat purchases
 */
export function usePurchases(): UsePurchasesResult {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<PurchasesHookError | null>(null);

  const [isPremium, setIsPremium] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [availablePackages, setAvailablePackages] = useState<readonly PurchasesPackage[]>([]);

  /**
   * Handle errors from RevenueCat
   */
  const handleError = useCallback((err: unknown) => {
    // Ignore user-cancelled purchases
    if (isPurchasesError(err) && err.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      return;
    }

    if (isPurchasesError(err)) {
      setError({ message: err.message, code: String(err.code) });
    } else if (err instanceof Error) {
      setError({ message: err.message });
    } else {
      setError({ message: String(err) });
    }
  }, []);

  /**
   * Check if customer has premium access
   */
  const checkPremiumStatus = useCallback((info: CustomerInfo): boolean => {
    // Check for the specific entitlement
    const entitlement = info.entitlements.active[ENTITLEMENT_ID];
    if (entitlement) return true;

    // Also check if any entitlement is active (fallback)
    return Object.keys(info.entitlements.active).length > 0;
  }, []);

  /**
   * Refresh customer info and subscription status
   */
  const refreshSubscriptionStatus = useCallback(async () => {
    if (!isPurchasesSupported || !isInitialized) return;

    try {
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      setIsPremium(checkPremiumStatus(info));
    } catch (err) {
      console.error('[usePurchases] Error refreshing status:', err);
    }
  }, [isInitialized, checkPremiumStatus]);

  /**
   * Initialize RevenueCat SDK
   */
  useEffect(() => {
    if (!isPurchasesSupported) {
      setIsLoading(false);
      setIsInitialized(false);
      return;
    }

    const apiKey = getApiKey();
    // Strict check - API key must be a non-empty string
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      console.warn('[usePurchases] No API key configured for', Platform.OS);
      setIsLoading(false);
      setIsInitialized(false); // Explicitly set to false
      setError({ message: 'RevenueCat API key not configured', code: 'NO_API_KEY' });
      return;
    }

    const initializePurchases = async () => {
      try {
        // Enable verbose logging in development
        if (__DEV__) {
          Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
        }

        // Configure the SDK with validated API key
        Purchases.configure({ apiKey: apiKey });

        // Get initial customer info and offerings
        const [info, offerings] = await Promise.all([
          Purchases.getCustomerInfo(),
          Purchases.getOfferings(),
        ]);

        setCustomerInfo(info);
        setIsPremium(checkPremiumStatus(info));
        setAvailablePackages(offerings.current?.availablePackages ?? []);
        setIsInitialized(true);

        console.log('[usePurchases] Initialized successfully');
      } catch (err) {
        console.error('[usePurchases] Initialization failed:', err);
        setIsInitialized(false); // Ensure it's false on error
        handleError(err);
      } finally {
        setIsLoading(false);
      }
    };

    initializePurchases();
  }, [checkPremiumStatus, handleError]);

  /**
   * Monitor subscription changes (app foreground, RevenueCat updates)
   */
  useEffect(() => {
    if (!isPurchasesSupported || !isInitialized) return;

    // Refresh on app foreground
    const appStateListener = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        refreshSubscriptionStatus();
      }
    });

    // Listen for RevenueCat customer info updates
    // Note: The listener may return an unsubscribe function depending on version
    let unsubscribeCustomerInfo: (() => void) | undefined;
    try {
      const result = Purchases.addCustomerInfoUpdateListener((info) => {
        setCustomerInfo(info);
        setIsPremium(checkPremiumStatus(info));
      });
      // Some versions return an unsubscribe function
      if (typeof result === 'function') {
        unsubscribeCustomerInfo = result as () => void;
      }
    } catch (err) {
      console.error('[usePurchases] Error adding listener:', err);
    }

    return () => {
      appStateListener.remove();
      // Call the unsubscribe function if available
      unsubscribeCustomerInfo?.();
    };
  }, [isInitialized, refreshSubscriptionStatus, checkPremiumStatus]);

  /**
   * Purchase a package
   */
  const purchasePackage = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    if (!isPurchasesSupported || !isInitialized) {
      setError({ message: 'Purchases not available', code: 'NOT_INITIALIZED' });
      return false;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const { customerInfo: newInfo } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(newInfo);
      const hasPremium = checkPremiumStatus(newInfo);
      setIsPremium(hasPremium);
      return hasPremium;
    } catch (err) {
      handleError(err);
      // Don't return false for cancelled purchases
      if (isPurchasesError(err) && err.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        return false;
      }
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [isInitialized, checkPremiumStatus, handleError]);

  /**
   * Restore previous purchases
   */
  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (!isPurchasesSupported || !isInitialized) {
      setError({ message: 'Purchases not available', code: 'NOT_INITIALIZED' });
      return false;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      const hasPremium = checkPremiumStatus(info);
      setIsPremium(hasPremium);
      return hasPremium;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [isInitialized, checkPremiumStatus, handleError]);

  /**
   * Show the RevenueCat paywall
   */
  const showPaywall = useCallback(async (): Promise<void> => {
    if (!isPurchasesSupported) {
      console.log('[usePurchases] Paywall not available on', Platform.OS);
      return;
    }

    if (!isInitialized) {
      console.warn('[usePurchases] Cannot show paywall - RevenueCat not initialized');
      if (error?.code === 'NO_API_KEY') {
        console.warn('[usePurchases] RevenueCat API key not configured');
      }
      return;
    }

    try {
      // Dynamic import to avoid bundling on web
      const RevenueCatUI = await import('react-native-purchases-ui');
      await RevenueCatUI.default.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: ENTITLEMENT_ID,
      });

      // Refresh status after paywall closes
      await refreshSubscriptionStatus();
    } catch (err) {
      console.error('[usePurchases] Error showing paywall:', err);
      handleError(err);
    }
  }, [isInitialized, error, refreshSubscriptionStatus, handleError]);

  return {
    // State
    isInitialized,
    isLoading,
    isProcessing,
    error,

    // Data
    isPremium,
    customerInfo,
    availablePackages,

    // Actions
    purchasePackage,
    restorePurchases,
    showPaywall,

    // Platform info
    isPurchasesSupported,
  };
}

export default usePurchases;
