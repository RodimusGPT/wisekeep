// Authentication hook for WiseKeep
// Handles anonymous auth, user profile, and usage tracking

import { useEffect, useCallback, useRef } from 'react';
import { useAppStore, UserProfile, UsageInfo, AppConfig } from '@/store';
import {
  signInAnonymously,
  ensureUserProfile,
  checkComprehensiveUsage,
  getAppConfig,
  redeemInviteCode as redeemCode,
  supabase,
} from '@/services/supabase';

export function useAuth() {
  const {
    user,
    isAuthLoading,
    usage,
    appConfig,
    deviceId,
    setUser,
    setAuthLoading,
    setUsage,
    setAppConfig,
    updateUserTier,
    initDeviceId,
  } = useAppStore();

  // Track mount state for async operations
  const isMountedRef = useRef(true);

  // Set up mount tracking
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Initialize authentication on app start
  const initAuth = useCallback(async () => {
    console.log('[Auth] initAuth started');
    try {
      setAuthLoading(true);

      // Ensure we have a device ID
      console.log('[Auth] Getting device ID...');
      const currentDeviceId = await initDeviceId();
      console.log('[Auth] Device ID:', currentDeviceId);

      // Sign in anonymously (or restore session)
      console.log('[Auth] Signing in anonymously...');
      const { userId: authUserId } = await signInAnonymously();
      console.log('[Auth] Auth user ID:', authUserId);

      // Get or create user profile
      console.log('[Auth] Getting user profile...');
      const profile = await ensureUserProfile(authUserId, currentDeviceId);
      console.log('[Auth] Profile:', profile?.id, profile?.tier);

      // Check if still mounted after async operation
      if (!isMountedRef.current) return;

      // Transform to our UserProfile type
      const userProfile: UserProfile = {
        id: profile.id,
        authUserId: authUserId,
        tier: profile.tier as 'free' | 'vip' | 'premium',
        supportCode: profile.support_code,
        inviteCodeUsed: profile.invite_code_used,
        subscriptionStatus: profile.subscription_status,
        subscriptionExpiresAt: profile.subscription_expires_at,
      };

      setUser(userProfile);
      console.log('[Auth] User set in store');

      // Load usage info and app config in parallel
      console.log('[Auth] Loading usage and config...');
      const [usageInfo, config] = await Promise.all([
        checkComprehensiveUsage(profile.id),
        getAppConfig(),
      ]);
      console.log('[Auth] Usage loaded:', usageInfo?.tier);

      // Check if still mounted after async operation
      if (!isMountedRef.current) return;

      // Transform comprehensive usage info (with null check)
      if (usageInfo) {
        const transformedUsage: UsageInfo = {
          tier: usageInfo.tier,
          allowed: usageInfo.can_process, // Map can_process to allowed for backwards compatibility
          minutesUsed: usageInfo.ai_minutes_used, // AI processing minutes (new model)
          minutesLimit: usageInfo.ai_minutes_limit,
          minutesRemaining: usageInfo.ai_minutes_remaining,
          periodType: 'monthly',
          isUnlimited: usageInfo.ai_minutes_limit === -1,
          // New comprehensive fields
          canRecord: usageInfo.can_record,
          canProcess: usageInfo.can_process,
          aiMinutesUsed: usageInfo.ai_minutes_used,
          aiMinutesLimit: usageInfo.ai_minutes_limit,
          aiMinutesRemaining: usageInfo.ai_minutes_remaining,
          storageUsed: usageInfo.storage_used,
          storageLimit: usageInfo.storage_limit,
          storageRemaining: usageInfo.storage_remaining,
          periodStart: usageInfo.period_start,
        };

        setUsage(transformedUsage);
      } else {
        console.warn('[Auth] Failed to load usage info, skipping usage setup');
        setUsage(null);
      }

      // Transform app config (with null check)
      if (config) {
        const transformedConfig: AppConfig = {
          freeTier: {
            minutes: config.free_tier.minutes,
            period: config.free_tier.period,
          },
          premium: {
            monthlyPriceTwd: config.premium.monthly_price_twd,
            yearlyPriceTwd: config.premium.yearly_price_twd,
            yearlySavingsTwd: config.premium.yearly_savings_twd,
          },
          limits: {
            maxRecordingDurationMinutes: config.limits.max_recording_duration_minutes,
            maxAudioFileSizeMb: config.limits.max_audio_file_size_mb,
          },
        };

        setAppConfig(transformedConfig);
      } else {
        console.warn('[Auth] Failed to load app config, skipping config setup');
        setAppConfig(null);
      }
      console.log('[Auth] Init complete!');

    } catch (error) {
      console.error('[Auth] Initialization error:', error);
      // On error, still mark as not loading so app can show error state
    } finally {
      // Only update state if still mounted
      if (isMountedRef.current) {
        setAuthLoading(false);
      }
    }
  }, [initDeviceId, setUser, setAuthLoading, setUsage, setAppConfig]);

  // Refresh usage info
  const refreshUsage = useCallback(async () => {
    if (!user) return;

    try {
      const usageInfo = await checkComprehensiveUsage(user.id);

      // Check if still mounted after async operation
      if (!isMountedRef.current) return;

      // Null check before transformation
      if (!usageInfo) {
        console.warn('[Auth] Failed to refresh usage info, no data returned');
        return;
      }

      const transformedUsage: UsageInfo = {
        tier: usageInfo.tier,
        allowed: usageInfo.can_process,
        minutesUsed: usageInfo.ai_minutes_used,
        minutesLimit: usageInfo.ai_minutes_limit,
        minutesRemaining: usageInfo.ai_minutes_remaining,
        periodType: 'monthly',
        isUnlimited: usageInfo.ai_minutes_limit === -1,
        // Comprehensive fields
        canRecord: usageInfo.can_record,
        canProcess: usageInfo.can_process,
        aiMinutesUsed: usageInfo.ai_minutes_used,
        aiMinutesLimit: usageInfo.ai_minutes_limit,
        aiMinutesRemaining: usageInfo.ai_minutes_remaining,
        storageUsed: usageInfo.storage_used,
        storageLimit: usageInfo.storage_limit,
        storageRemaining: usageInfo.storage_remaining,
        periodStart: usageInfo.period_start,
      };

      setUsage(transformedUsage);
    } catch (error) {
      console.error('Error refreshing usage:', error);
    }
  }, [user, setUsage]);

  // Redeem invite code
  const redeemInviteCode = useCallback(async (code: string): Promise<{ success: boolean; message: string }> => {
    if (!user) {
      return { success: false, message: 'Not authenticated' };
    }

    try {
      const result = await redeemCode(user.id, code);

      // Only update state if still mounted after async operation
      if (result.success && isMountedRef.current) {
        // Update local user tier
        updateUserTier('vip');
        // Refresh usage to get updated limits
        await refreshUsage();
      }

      return result;
    } catch (error) {
      console.error('Error redeeming code:', error);
      return { success: false, message: 'Failed to redeem code' };
    }
  }, [user, updateUserTier, refreshUsage]);

  // Check if user can record (has remaining quota)
  const canRecord = useCallback((durationMinutes: number = 0): boolean => {
    if (!usage) return false;

    // VIP and Premium can always record
    if (usage.isUnlimited) return true;

    // Check if adding this duration would exceed limit
    return usage.minutesUsed + durationMinutes <= usage.minutesLimit;
  }, [usage]);

  // Get remaining minutes
  const getRemainingMinutes = useCallback((): number => {
    if (!usage) return 0;
    if (usage.isUnlimited) return -1; // -1 indicates unlimited
    return Math.max(0, usage.minutesRemaining);
  }, [usage]);

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setUsage(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser, setUsage]);

  return {
    user,
    isAuthLoading,
    usage,
    appConfig,
    initAuth,
    refreshUsage,
    redeemInviteCode,
    canRecord,
    getRemainingMinutes,
  };
}
