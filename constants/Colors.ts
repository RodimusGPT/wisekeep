// WiseKeep Color Palette - High Contrast for Senior Accessibility
// WCAG AA compliant: minimum 4.5:1 for normal text, 3:1 for large text
export const Colors = {
  // Primary colors
  primary: '#C62828', // Slightly darker red for better contrast
  primaryLight: '#FF5252',
  primaryDark: '#8E0000',

  // Success/Confirmation
  success: '#2E7D32', // Green - good contrast
  successLight: '#4CAF50',

  // Background colors
  background: '#FFFFFF',
  backgroundSecondary: '#F5F5F5',
  backgroundDark: '#121212',
  backgroundSecondaryDark: '#1E1E1E',

  // Text colors - improved contrast ratios
  text: '#000000', // 21:1 on white
  textSecondary: '#37474F', // Darker for better readability (7:1 ratio)
  textTertiary: '#546E7A', // Was #757575, now darker (5.5:1 ratio)
  textDark: '#FFFFFF', // 21:1 on dark backgrounds
  textSecondaryDark: '#ECEFF1', // Lighter for better contrast
  textTertiaryDark: '#B0BEC5', // Better contrast on dark

  // UI elements
  border: '#BDBDBD', // Darker border for visibility
  borderDark: '#616161', // More visible on dark mode
  card: '#FFFFFF',
  cardDark: '#242424', // Slightly lighter for depth perception

  // Recording states
  recordingActive: '#C62828',
  recordingPulse: '#EF5350',
  recordingBackground: '#FFEBEE',

  // Playback colors (distinct from recording red)
  playback: '#1565C0', // Slightly darker blue for contrast
  playbackLight: '#42A5F5',
  playbackDark: '#003C8F',

  // Status colors
  processing: '#1565C0', // Blue
  ready: '#2E7D32', // Green
  error: '#B71C1C', // Darker red for emphasis

  // Tab bar
  tabActive: '#C62828',
  tabInactive: '#546E7A', // Darker for better visibility
  tabInactiveDark: '#B0BEC5',

  // Senior-friendly additions
  highlight: '#FFF3E0', // Warm highlight for current items
  highlightDark: '#3E2723', // Dark mode highlight
  divider: '#E0E0E0', // Clear section dividers
  dividerDark: '#424242',
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
