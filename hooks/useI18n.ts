import { useMemo } from 'react';
import { useAppStore } from '@/store';
import { translations, Translations, Language } from '@/i18n/translations';

interface UseI18nReturn {
  t: Translations;
  language: Language;
  setLanguage: (language: Language) => void;
}

export function useI18n(): UseI18nReturn {
  const language = useAppStore((state) => state.settings.language);
  const setLanguage = useAppStore((state) => state.setLanguage);

  const t = useMemo(() => translations[language], [language]);

  return { t, language, setLanguage };
}

// Helper hook for text size
export function useTextSize() {
  const textSize = useAppStore((state) => state.settings.textSize);
  const setTextSize = useAppStore((state) => state.setTextSize);

  return { textSize, setTextSize };
}
