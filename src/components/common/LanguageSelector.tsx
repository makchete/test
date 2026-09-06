import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { SupportedLanguage } from '../../types';

interface LanguageSelectorProps {
  variant?: 'pills' | 'dropdown' | 'cards';
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'pills',
  className = '',
}) => {
  const { language, setLanguage, availableLanguages, currentLanguageOption, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (variant === 'cards') {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-3 gap-2.5 ${className}`}>
        {availableLanguages.map((lang) => {
          const isSelected = language === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => setLanguage(lang.code)}
              className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                isSelected
                  ? 'bg-blue-600/20 border-blue-500/80 text-white shadow-lg shadow-blue-500/15'
                  : 'bg-slate-950/70 hover:bg-slate-800/80 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xl" role="img" aria-label={lang.name}>
                  {lang.flag}
                </span>
                <div>
                  <div className="text-xs font-bold leading-tight flex items-center gap-1.5">
                    <span>{lang.nativeName}</span>
                    {lang.code === 'fr' && (
                      <span className="text-[9px] font-medium text-blue-400 bg-blue-500/10 px-1.5 py-0.2 rounded border border-blue-500/20">
                        {t.settings.defaultBadge}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">{lang.name}</div>
                </div>
              </div>

              {isSelected ? (
                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white shrink-0">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full border border-slate-700 shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === 'dropdown') {
    return (
      <div className={`relative inline-block ${className}`} ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-medium text-slate-200 transition-colors shadow-sm cursor-pointer"
          title={t.auth.selectLanguage}
        >
          <span className="text-sm">{currentLanguageOption.flag}</span>
          <span>{currentLanguageOption.nativeName}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-1.5 w-44 bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">
              {t.auth.language}
            </div>
            {availableLanguages.map((lang) => {
              const isSelected = language === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    setLanguage(lang.code);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600/30 text-blue-300 font-bold'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{lang.flag}</span>
                    <span>{lang.nativeName}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-blue-400" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Default 'pills' variant
  return (
    <div className={`inline-flex items-center p-1 bg-slate-900/90 backdrop-blur-md border border-slate-800/90 rounded-2xl shadow-md ${className}`}>
      <div className="flex items-center gap-1">
        {availableLanguages.map((lang) => {
          const isSelected = language === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => setLanguage(lang.code)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span className="text-sm">{lang.flag}</span>
              <span>{lang.nativeName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
