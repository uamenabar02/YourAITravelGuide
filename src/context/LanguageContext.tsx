import React, { createContext, useContext, useState, ReactNode } from "react";
import { en } from "../locales/en";
import { es } from "../locales/es";
import { eu } from "../locales/eu";
import { fr } from "../locales/fr";
import { de } from "../locales/de";
import { it } from "../locales/it";
import { pt } from "../locales/pt";
import { ja } from "../locales/ja";
import { zh } from "../locales/zh";
import { ar } from "../locales/ar";

export type Language =
  | "en" // English
  | "es" // Spanish (Español)
  | "eu" // Basque (Euskara)
  | "fr" // French (Français)
  | "de" // German (Deutsch)
  | "it" // Italian (Italiano)
  | "pt" // Portuguese (Português)
  | "ja" // Japanese (日本語)
  | "zh" // Chinese (简体中文)
  | "ar"; // Arabic (العربية)

export interface LanguageOption {
  code: Language;
  name: string;
  nativeName: string;
  flag: string;
  isPrimary?: boolean;
}

export const PRIMARY_LANGUAGES: LanguageOption[] = [
  { code: "en", name: "English", nativeName: "English", flag: "🇬🇧", isPrimary: true },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸", isPrimary: true },
  { code: "eu", name: "Basque", nativeName: "Euskara", flag: "🔴🟢⚪", isPrimary: true },
];

export const WORLD_LANGUAGES: LanguageOption[] = [
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷" },
  { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪" },
  { code: "it", name: "Italian", nativeName: "Italiano", flag: "🇮🇹" },
  { code: "pt", name: "Portuguese", nativeName: "Português", flag: "🇵🇹" },
  { code: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵" },
  { code: "zh", name: "Chinese", nativeName: "简体中文", flag: "🇨🇳" },
  { code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇸🇦" },
];

export const ALL_LANGUAGES: LanguageOption[] = [...PRIMARY_LANGUAGES, ...WORLD_LANGUAGES];

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  showOriginal: boolean;
  setShowOriginal: (show: boolean) => void;
  toggleShowOriginal: () => void;
  t: (key: string, fallbackOrParams?: string | Record<string, string | number>) => string;
  formatCurrency: (amount: number, currencySymbol?: string) => string;
}

const LANGUAGE_STORAGE_KEY = "localexplorer_lang_v1";

const translations: Record<Language, Record<string, string>> = {
  en,
  es,
  eu,
  fr,
  de,
  it,
  pt,
  ja,
  zh,
  ar,
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language;
      const validLangs: Language[] = ["en", "es", "eu", "fr", "de", "it", "pt", "ja", "zh", "ar"];
      if (saved && validLangs.includes(saved)) {
        return saved;
      }
    } catch {
      // ignore
    }
    return "en";
  });

  const [showOriginal, setShowOriginal] = useState<boolean>(false);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    setShowOriginal(false);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // ignore
    }
  };

  const toggleShowOriginal = () => {
    setShowOriginal((prev) => !prev);
  };

  const t = (key: string, fallbackOrParams?: string | Record<string, string | number>): string => {
    if (showOriginal && translations["en"]?.[key]) {
      let rawEn = translations["en"][key];
      if (typeof fallbackOrParams === "object" && fallbackOrParams !== null) {
        Object.entries(fallbackOrParams).forEach(([paramKey, paramVal]) => {
          rawEn = rawEn.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(paramVal));
        });
      }
      return rawEn;
    }

    let raw = translations[language]?.[key] || translations["en"]?.[key];

    if (!raw) {
      if (typeof fallbackOrParams === "string") return fallbackOrParams;
      return key;
    }

    if (typeof fallbackOrParams === "object" && fallbackOrParams !== null) {
      Object.entries(fallbackOrParams).forEach(([paramKey, paramVal]) => {
        raw = raw.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(paramVal));
      });
    }

    return raw;
  };

  const formatCurrency = (amount: number, currencySymbol = "€"): string => {
    const formatted = amount.toFixed(2);
    if (language === "eu" || language === "es" || language === "fr" || language === "de" || language === "it" || language === "pt") {
      return `${formatted.replace(".", ",")} ${currencySymbol}`;
    }
    return `${currencySymbol}${formatted}`;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        showOriginal,
        setShowOriginal,
        toggleShowOriginal,
        t,
        formatCurrency,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
