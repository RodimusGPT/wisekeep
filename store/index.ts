import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateUUID } from '@/utils/uuid';
import { Recording, AppSettings, TextSize } from '@/types';
import { Language } from '@/i18n/translations';

// User tier types
export type UserTier = 'free' | 'vip' | 'premium';

// User profile from Supabase
export interface UserProfile {
  id: string;
  authUserId: string;
  tier: UserTier;
  supportCode: string | null;
  inviteCodeUsed: string | null;
  subscriptionStatus: string | null;
  subscriptionExpiresAt: string | null;
}

// Usage information
export interface UsageInfo {
  tier: UserTier;
  allowed: boolean;
  minutesUsed: number;
  minutesLimit: number;
  minutesRemaining: number;
  periodType: string;
  isUnlimited: boolean;
  // New comprehensive usage fields
  canRecord: boolean;
  canProcess: boolean;
  aiMinutesUsed: number;
  aiMinutesLimit: number;
  aiMinutesRemaining: number;
  storageUsed: number;
  storageLimit: number;
  storageRemaining: number;
  periodStart?: string;
}

// App configuration from server
export interface AppConfig {
  freeTier: {
    minutes: number;
    period: string;
  };
  premium: {
    monthlyPriceTwd: number;
    yearlyPriceTwd: number;
    yearlySavingsTwd: number;
  };
  limits: {
    maxRecordingDurationMinutes: number;
    maxAudioFileSizeMb: number;
  };
}

interface AppState {
  // Settings
  settings: AppSettings;
  setLanguage: (language: Language) => void;
  setTextSize: (size: TextSize) => void;
  completeOnboarding: () => void;
  setMicrophonePermission: (granted: boolean) => void;
  markFirstRecordingEducationSeen: () => void;

  // User Authentication
  user: UserProfile | null;
  isAuthLoading: boolean;
  setUser: (user: UserProfile | null) => void;
  setAuthLoading: (loading: boolean) => void;
  updateUserTier: (tier: UserTier) => void;

  // Usage Tracking
  usage: UsageInfo | null;
  setUsage: (usage: UsageInfo | null) => void;

  // App Config (from server)
  appConfig: AppConfig | null;
  setAppConfig: (config: AppConfig | null) => void;

  // Recordings
  recordings: Recording[];
  currentRecordingId: string | null;
  addRecording: (recording: Recording) => void;
  updateRecording: (id: string, updates: Partial<Recording>) => void;
  deleteRecording: (id: string) => void;
  getRecording: (id: string) => Recording | undefined;
  setCurrentRecordingId: (id: string | null) => void;

  // Device ID (for anonymous identification)
  deviceId: string | null;
  initDeviceId: () => Promise<string>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Settings
      settings: {
        language: 'zh-TW',
        textSize: 'medium',
        hasCompletedOnboarding: false,
        hasMicrophonePermission: false,
        hasSeenFirstRecordingEducation: false,
      },

      setLanguage: (language) =>
        set((state) => ({
          settings: { ...state.settings, language },
        })),

      setTextSize: (textSize) =>
        set((state) => ({
          settings: { ...state.settings, textSize },
        })),

      completeOnboarding: () =>
        set((state) => ({
          settings: { ...state.settings, hasCompletedOnboarding: true },
        })),

      setMicrophonePermission: (granted) =>
        set((state) => ({
          settings: { ...state.settings, hasMicrophonePermission: granted },
        })),

      markFirstRecordingEducationSeen: () =>
        set((state) => ({
          settings: { ...state.settings, hasSeenFirstRecordingEducation: true },
        })),

      // User Authentication
      user: null,
      isAuthLoading: true,

      setUser: (user) => set({ user }),

      setAuthLoading: (isAuthLoading) => set({ isAuthLoading }),

      updateUserTier: (tier) =>
        set((state) => ({
          user: state.user ? { ...state.user, tier } : null,
        })),

      // Usage Tracking
      usage: null,
      setUsage: (usage) => set({ usage }),

      // App Config
      appConfig: null,
      setAppConfig: (appConfig) => set({ appConfig }),

      // Recordings
      recordings: [],
      currentRecordingId: null,

      addRecording: (recording) =>
        set((state) => {
          // Prevent duplicate recordings with the same ID
          const exists = state.recordings.some((r) => r.id === recording.id);
          if (exists) {
            console.warn(`[Store] Attempted to add duplicate recording: ${recording.id}`);
            return state; // No change
          }
          return {
            recordings: [recording, ...state.recordings],
          };
        }),

      updateRecording: (id, updates) =>
        set((state) => ({
          recordings: state.recordings.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        })),

      deleteRecording: (id) =>
        set((state) => ({
          recordings: state.recordings.filter((r) => r.id !== id),
        })),

      getRecording: (id) => {
        return get().recordings.find((r) => r.id === id);
      },

      setCurrentRecordingId: (id) => set({ currentRecordingId: id }),

      // Device ID
      deviceId: null,

      initDeviceId: async () => {
        const state = get();
        if (state.deviceId) {
          return state.deviceId;
        }

        const newDeviceId = generateUUID();
        set({ deviceId: newDeviceId });
        return newDeviceId;
      },
    }),
    {
      name: 'wisekeep-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        settings: state.settings,
        recordings: state.recordings,
        deviceId: state.deviceId,
        user: state.user, // Persist user profile for offline access
      }),
    }
  )
);
