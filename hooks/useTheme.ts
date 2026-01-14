import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';

export interface ThemeColors {
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  highlight: string;
}

export interface Theme {
  isDark: boolean;
  colors: ThemeColors;
}

export function useTheme(): Theme {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return {
    isDark,
    colors: {
      background: isDark ? Colors.backgroundDark : Colors.background,
      card: isDark ? Colors.cardDark : Colors.card,
      text: isDark ? Colors.textDark : Colors.text,
      textSecondary: isDark ? Colors.textSecondaryDark : Colors.textSecondary,
      textTertiary: isDark ? Colors.textTertiaryDark : Colors.textTertiary,
      border: isDark ? Colors.borderDark : Colors.border,
      highlight: isDark ? Colors.highlightDark : Colors.highlight,
    },
  };
}
