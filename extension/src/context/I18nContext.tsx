import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getStorageItem, setStorageItem } from '../utils/storage';
import { zh } from '../locales/zh';
import { en } from '../locales/en';

type SupportedLanguage = 'zh' | 'en';
type Translations = typeof zh;

interface I18nContextType {
  lang: SupportedLanguage;
  setLang: (lang: SupportedLanguage) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

const locales: Record<SupportedLanguage, Translations> = {
  zh,
  en,
};

// Helper to resolve nested object keys like "nav.dashboard"
const resolveKey = (obj: any, path: string): string => {
  return path.split('.').reduce((prev, curr) => {
    return prev ? prev[curr] : undefined;
  }, obj) as unknown as string;
};

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<SupportedLanguage>('zh');

  useEffect(() => {
    const loadLang = async () => {
      const savedLang = await getStorageItem<SupportedLanguage>('app_language');
      if (savedLang === 'en' || savedLang === 'zh') {
        setLangState(savedLang);
      }
    };
    loadLang();
  }, []);

  const setLang = useCallback(async (newLang: SupportedLanguage) => {
    setLangState(newLang);
    await setStorageItem('app_language', newLang);
  }, []);

  const t = useCallback((key: string): string => {
    const translation = resolveKey(locales[lang], key);
    return translation !== undefined ? translation : key;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
};
