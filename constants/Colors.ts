// WiseKeep Color Palette - High Contrast for Senior Accessibility
export const Colors = {
  // Primary colors
  primary: '#D32F2F', // Red for recording (universally understood)
  primaryLight: '#FF6659',
  primaryDark: '#9A0007',

  // Success/Confirmation
  success: '#2E7D32', // Green
  successLight: '#60AD5E',

  // Background colors
  background: '#FFFFFF',
  backgroundSecondary: '#F5F5F5',
  backgroundDark: '#121212',
  backgroundSecondaryDark: '#1E1E1E',

  // Text colors
  text: '#000000',
  textSecondary: '#424242',
  textTertiary: '#757575',
  textDark: '#FFFFFF',
  textSecondaryDark: '#E0E0E0',
  textTertiaryDark: '#BDBDBD',

  // UI elements
  border: '#E0E0E0',
  borderDark: '#424242',
  card: '#FFFFFF',
  cardDark: '#1E1E1E',

  // Recording states
  recordingActive: '#D32F2F',
  recordingPulse: '#FF5252',
  recordingBackground: '#FFEBEE',

  // Playback colors (distinct from recording red)
  playback: '#1976D2', // Blue - common for media players
  playbackLight: '#63A4FF',
  playbackDark: '#004BA0',

  // Status colors
  processing: '#1976D2', // Blue
  ready: '#2E7D32', // Green
  error: '#C62828', // Dark red

  // Tab bar
  tabActive: '#D32F2F',
  tabInactive: '#757575',
  tabInactiveDark: '#BDBDBD',
};

// Theme definitions for light/dark mode
const tintColorLight = Colors.primary;
const tintColorDark = Colors.primaryLight;

export default {
  light: {
    text: Colors.text,
    textSecondary: Colors.textSecondary,
    background: Colors.background,
    backgroundSecondary: Colors.backgroundSecondary,
    tint: tintColorLight,
    tabIconDefault: Colors.tabInactive,
    tabIconSelected: tintColorLight,
    card: Colors.card,
    border: Colors.border,
  },
  dark: {
    text: Colors.textDark,
    textSecondary: Colors.textSecondaryDark,
    background: Colors.backgroundDark,
    backgroundSecondary: Colors.backgroundSecondaryDark,
    tint: tintColorDark,
    tabIconDefault: Colors.tabInactiveDark,
    tabIconSelected: tintColorDark,
    card: Colors.cardDark,
    border: Colors.borderDark,
  },
};
