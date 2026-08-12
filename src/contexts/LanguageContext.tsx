"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Locale, DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@/lib/i18n/i18n";

import enMessages from "@/lib/i18n/locales/en.json";
import esMessages from "@/lib/i18n/locales/es.json";
import frMessages from "@/lib/i18n/locales/fr.json";
import taMessages from "@/lib/i18n/locales/ta.json";

const messagesMap: Record<Locale, Record<string, any>> = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
  ta: taMessages,
};

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LOCALE_STORAGE_KEY = "choseno_locale";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;
      if (saved && SUPPORTED_LOCALES.some((l) => l.code === saved)) {
        setLocaleState(saved);
        return;
      }

      // Auto-detect browser language
      const browserLang = navigator.language?.slice(0, 2).toLowerCase();
      const matched = SUPPORTED_LOCALES.find((l) => l.code === browserLang);
      if (matched) {
        setLocaleState(matched.code);
      }
    } catch {
      // Fallback silently if storage unavailable
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
      document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`;
    } catch {
      // Ignore storage errors
    }
  };

  const t = (key: string, fallback?: string): string => {
    const keys = key.split(".");
    let current: any = messagesMap[locale] || messagesMap[DEFAULT_LOCALE];

    for (const k of keys) {
      if (current && typeof current === "object" && k in current) {
        current = current[k];
      } else {
        // Fallback to English dictionary if key missing in target language
        let fallbackVal: any = messagesMap[DEFAULT_LOCALE];
        for (const fk of keys) {
          if (fallbackVal && typeof fallbackVal === "object" && fk in fallbackVal) {
            fallbackVal = fallbackVal[fk];
          } else {
            return fallback || key;
          }
        }
        return typeof fallbackVal === "string" ? fallbackVal : fallback || key;
      }
    }

    return typeof current === "string" ? current : fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  return context;
}
