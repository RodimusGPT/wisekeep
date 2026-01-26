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
  audioUri: string; // local file path (first chunk for chunked recordings)
  audioRemoteUrl?: string; // Supabase storage URL if uploaded
  status: 'recording' | 'recorded' | 'processing_notes' | 'notes_ready' | 'processing_summary' | 'ready' | 'error';
  notes?: NoteLine[];
  summary?: string[];
  language?: Language;
  errorMessage?: string;

  // Auto-chunked recording support (for VIP unlimited recordings)
  // Chunks are created every 20 minutes to stay under 25MB Groq limit
  // But presented to user as one seamless recording
  audioChunks?: string[]; // Array of local file paths for each chunk
}

export interface AppSettings {
  language: Language;
  textSize: 'small' | 'medium' | 'large';
  hasCompletedOnboarding: boolean;
  hasMicrophonePermission: boolean;
  hasSeenFirstRecordingEducation: boolean;
}

export type TextSize = 'small' | 'medium' | 'large';

// Text size scale factors - larger increments for senior accessibility
export const TEXT_SIZE_SCALES: Record<TextSize, number> = {
  small: 0.85,   // For users who prefer smaller text
  medium: 1.0,   // Default - already senior-friendly
  large: 1.2,    // Extra large for low vision users
};

// Base font sizes (in points) - optimized for senior accessibility
// Follows WCAG guidelines: minimum 16px for body, larger preferred
export const BASE_FONT_SIZES = {
  small: 16,       // Smallest readable text (metadata, timestamps)
  body: 18,        // Main content text - comfortable reading size
  bodyLarge: 20,   // Emphasized body text
  button: 18,      // Button text - matches body for consistency
  header: 24,      // Section headers
  headerLarge: 28, // Page titles
  timer: 48,       // Large timer display
};

// Calculate actual font size based on text size preference
export function getFontSize(base: keyof typeof BASE_FONT_SIZES, textSize: TextSize): number {
  return Math.round(BASE_FONT_SIZES[base] * TEXT_SIZE_SCALES[textSize]);
}

// Line height multipliers for readability
export const LINE_HEIGHT_MULTIPLIERS = {
  tight: 1.3,    // For single-line items
  normal: 1.5,   // Default - good for body text
  relaxed: 1.7,  // For longer reading passages
};
