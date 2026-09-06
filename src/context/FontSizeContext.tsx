import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

export type ChatFontSize = 'small' | 'medium' | 'large' | 'xlarge';

interface FontSizeContextType {
  fontSize: ChatFontSize;
  setFontSize: (size: ChatFontSize) => Promise<void>;
  messageTextClass: string;
  fileTextClass: string;
  subTextClass: string;
}

const FontSizeContext = createContext<FontSizeContextType | undefined>(undefined);

const FONT_SIZE_STORAGE_KEY = 'komechat_chat_font_size';

export const FontSizeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [fontSize, setFontSizeState] = useState<ChatFontSize>(() => {
    try {
      const stored = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
      if (stored === 'small' || stored === 'medium' || stored === 'large' || stored === 'xlarge') {
        return stored;
      }
    } catch {}
    return 'medium';
  });

  // Sync with user preferences if available
  useEffect(() => {
    const fetchUserPref = async () => {
      try {
        const token = localStorage.getItem('mmd_chat_token');
        if (!token) return;
        const res = await api.getPreferences();
        if (res?.preferences?.fontSize) {
          const pref = res.preferences.fontSize;
          if (pref === 'small' || pref === 'medium' || pref === 'large' || (pref as string) === 'xlarge') {
            setFontSizeState(pref as ChatFontSize);
            try {
              localStorage.setItem(FONT_SIZE_STORAGE_KEY, pref);
            } catch {}
          }
        }
      } catch {
        // Ignore network failure on initial load
      }
    };
    fetchUserPref();
  }, []);

  const setFontSize = async (size: ChatFontSize) => {
    setFontSizeState(size);
    try {
      localStorage.setItem(FONT_SIZE_STORAGE_KEY, size);
    } catch {}

    try {
      const token = localStorage.getItem('mmd_chat_token');
      if (token) {
        await api.updatePreferences({ fontSize: size });
      }
    } catch (err) {
      console.warn('Could not sync font size preference to server:', err);
    }
  };

  const messageTextClass =
    fontSize === 'small'
      ? 'text-xs leading-relaxed'
      : fontSize === 'large'
      ? 'text-base sm:text-lg leading-relaxed'
      : fontSize === 'xlarge'
      ? 'text-lg sm:text-xl leading-relaxed'
      : 'text-xs sm:text-sm leading-relaxed';

  const fileTextClass =
    fontSize === 'small'
      ? 'text-[11px]'
      : fontSize === 'large'
      ? 'text-sm font-semibold'
      : fontSize === 'xlarge'
      ? 'text-base font-semibold'
      : 'text-xs font-semibold';

  const subTextClass =
    fontSize === 'small'
      ? 'text-[9px]'
      : fontSize === 'large'
      ? 'text-xs'
      : fontSize === 'xlarge'
      ? 'text-sm'
      : 'text-[10px]';

  return (
    <FontSizeContext.Provider
      value={{
        fontSize,
        setFontSize,
        messageTextClass,
        fileTextClass,
        subTextClass,
      }}
    >
      {children}
    </FontSizeContext.Provider>
  );
};

export const useFontSize = (): FontSizeContextType => {
  const ctx = useContext(FontSizeContext);
  if (!ctx) {
    throw new Error('useFontSize must be used within a FontSizeProvider');
  }
  return ctx;
};
