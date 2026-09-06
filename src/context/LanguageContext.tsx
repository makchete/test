import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SupportedLanguage } from '../types';
import { translations, TranslationsType, AVAILABLE_LANGUAGES, LanguageOption } from '../i18n/translations';
import { api } from '../services/api';

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: TranslationsType;
  availableLanguages: LanguageOption[];
  currentLanguageOption: LanguageOption;
}

const STORAGE_KEY = 'komechat_language';
const FALLBACK_STORAGE_KEY = 'mmd_language';

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(FALLBACK_STORAGE_KEY);
    if (saved === 'en' || saved === 'nl' || saved === 'fr') {
      return saved;
    }
    return 'fr'; // Default language is French
  });

  const setLanguage = useCallback((newLang: SupportedLanguage) => {
    setLanguageState(newLang);
    localStorage.setItem(STORAGE_KEY, newLang);
    localStorage.setItem(FALLBACK_STORAGE_KEY, newLang);

    // If the user is logged in, sync to server preferences seamlessly
    const token = localStorage.getItem('mmd_chat_token');
    if (token) {
      api.updatePreferences({ language: newLang }).catch((err) => {
        console.warn('Failed to sync language preference to server:', err);
      });
    }
  }, []);

  // Sync preference from server when user loads preferences
  useEffect(() => {
    const token = localStorage.getItem('mmd_chat_token');
    if (token) {
      api.getPreferences()
        .then((res) => {
          if (res.preferences?.language && (res.preferences.language === 'fr' || res.preferences.language === 'en' || res.preferences.language === 'nl')) {
            const serverLang = res.preferences.language;
            const currentSaved = localStorage.getItem(STORAGE_KEY);
            if (!currentSaved) {
              setLanguageState(serverLang);
              localStorage.setItem(STORAGE_KEY, serverLang);
            }
          }
        })
        .catch(() => {
          // Ignore unauthenticated or offline errors
        });
    }
  }, []);

  const currentLanguageOption =
    AVAILABLE_LANGUAGES.find((opt) => opt.code === language) || AVAILABLE_LANGUAGES[0];

  const t = translations[language] || translations.fr;

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        availableLanguages: AVAILABLE_LANGUAGES,
        currentLanguageOption,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
