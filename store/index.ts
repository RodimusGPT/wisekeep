import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Recording, AppSettings, TextSize } from '@/types';
import { Language } from '@/i18n/translations';
import * as Crypto from 'expo-crypto';

interface AppState {
  // Settings
  settings: AppSettings;
  setLanguage: (language: Language) => void;
  setTextSize: (size: TextSize) => void;
  completeOnboarding: () => void;
  setMicrophonePermission: (granted: boolean) => void;
  markFirstRecordingEducationSeen: () => void;

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

      // Recordings
      recordings: [],
      currentRecordingId: null,

      addRecording: (recording) =>
        set((state) => ({
          recordings: [recording, ...state.recordings],
        })),

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

        const newDeviceId = Crypto.randomUUID();
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
      }),
    }
  )
);
