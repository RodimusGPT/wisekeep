import { Language } from '@/i18n/translations';

export interface NoteLine {
  id: string;
  timestamp: number; // milliseconds from start of recording
  text: string;
  speaker?: string; // e.g., "Speaker 1", "Speaker 2"
}

export interface Recording {
  id: string;
  label?: string; // User-defined label for easy identification
  createdAt: string; // ISO date string
  duration: number; // in seconds
  audioUri: string; // local file path
  audioRemoteUrl?: string; // Supabase storage URL if uploaded
  status: 'recording' | 'processing_notes' | 'processing_summary' | 'ready' | 'error';
  notes?: NoteLine[];
  summary?: string[];
  language?: Language;
  errorMessage?: string;
}

export interface AppSettings {
  language: Language;
  textSize: 'small' | 'medium' | 'large';
  hasCompletedOnboarding: boolean;
  hasMicrophonePermission: boolean;
  hasSeenFirstRecordingEducation: boolean;
}

export type TextSize = 'small' | 'medium' | 'large';

// Text size scale factors
export const TEXT_SIZE_SCALES: Record<TextSize, number> = {
  small: 0.9,
  medium: 1.0,
  large: 1.15,
};

// Base font sizes (in points) - designed for seniors
export const BASE_FONT_SIZES = {
  body: 20,
  bodyLarge: 22,
  button: 22,
  header: 28,
  headerLarge: 32,
  small: 16,
  timer: 48,
};

// Calculate actual font size based on text size preference
export function getFontSize(base: keyof typeof BASE_FONT_SIZES, textSize: TextSize): number {
  return Math.round(BASE_FONT_SIZES[base] * TEXT_SIZE_SCALES[textSize]);
}
