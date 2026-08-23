import React, { useState, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext";
import { getCachedTranslation, fetchTranslation } from "../utils/translator";

interface TranslatedTextProps {
  text: string;
  className?: string;
  as?: "span" | "p" | "div" | "h1" | "h2" | "h3" | "h4" | "li" | "strong" | "italic";
  isMarkdown?: boolean;
}

export const TranslatedText: React.FC<TranslatedTextProps> = ({
  text = "",
  className = "",
  as: Component = "span",
}) => {
  const { language } = useLanguage();
  const [translatedText, setTranslatedText] = useState<string>(() => {
    if (language === "en" || !text) return text;
    const cached = getCachedTranslation(text, language);
    return cached || text;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (language === "en" || !text) return false;
    const cached = getCachedTranslation(text, language);
    return !cached;
  });

  useEffect(() => {
    if (language === "en" || !text) {
      setTranslatedText(text);
      setLoading(false);
      return;
    }

    const cached = getCachedTranslation(text, language);
    if (cached) {
      setTranslatedText(cached);
      setLoading(false);
      return;
    }

    let isCurrent = true;
    setLoading(true);

    fetchTranslation(text, language)
      .then((translated) => {
        if (isCurrent) {
          setTranslatedText(translated);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn("Dynamic translation failed:", err);
        if (isCurrent) {
          setTranslatedText(text); // fallback to original
          setLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [text, language]);

  if (loading) {
    return (
      <span className="inline-flex flex-col gap-1 w-full animate-pulse opacity-75" aria-hidden="true">
        <span className="h-4 bg-stone-200 rounded-sm w-11/12"></span>
        {text.length > 80 && <span className="h-4 bg-stone-200 rounded-sm w-9/12"></span>}
        {text.length > 150 && <span className="h-4 bg-stone-200 rounded-sm w-6/12"></span>}
      </span>
    );
  }

  // Handle markdown-like formatting (bold **, line breaks \n) cleanly
  if (translatedText.includes("**") || translatedText.includes("\n")) {
    const lines = translatedText.split("\n");
    return (
      <Component className={`${className} transition-opacity duration-300`}>
        {lines.map((line, lIdx) => {
          // Parse bold markers **text**
          const parts = line.split(/(\*\*[^*]+\*\*)/g);
          const elements = parts.map((part, pIdx) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return <strong key={pIdx} className="font-bold text-stone-950">{part.slice(2, -2)}</strong>;
            }
            return part;
          });

          return (
            <React.Fragment key={lIdx}>
              {elements}
              {lIdx < lines.length - 1 && <br />}
            </React.Fragment>
          );
        })}
      </Component>
    );
  }

  return <Component className={`${className} transition-opacity duration-300`}>{translatedText}</Component>;
};

/**
 * Custom hook to translate a single string dynamically.
 * Automatically switches to the active language and handles loading state.
 */
export function useTranslateText(text: string): { translated: string; loading: boolean } {
  const { language } = useLanguage();
  const [translated, setTranslated] = useState<string>(() => {
    if (language === "en" || !text) return text;
    return getCachedTranslation(text, language) || text;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (language === "en" || !text) return false;
    return !getCachedTranslation(text, language);
  });

  useEffect(() => {
    if (language === "en" || !text) {
      setTranslated(text);
      setLoading(false);
      return;
    }

    const cached = getCachedTranslation(text, language);
    if (cached) {
      setTranslated(cached);
      setLoading(false);
      return;
    }

    let isCurrent = true;
    setLoading(true);

    fetchTranslation(text, language)
      .then((res) => {
        if (isCurrent) {
          setTranslated(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn("Failed to translate text dynamically:", err);
        if (isCurrent) {
          setTranslated(text);
          setLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [text, language]);

  return { translated, loading };
}

/**
 * Custom hook to translate an array of strings dynamically.
 * Combines them into a single batch query to optimize performance.
 */
import { fetchTranslationBatch } from "../utils/translator";

export function useTranslateArray(texts: string[]): { translated: string[]; loading: boolean } {
  const { language } = useLanguage();
  const [translated, setTranslated] = useState<string[]>(() => {
    if (language === "en" || !texts || texts.length === 0) return texts || [];
    return texts.map((t) => getCachedTranslation(t, language) || t);
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (language === "en" || !texts || texts.length === 0) return false;
    const allCached = texts.every((t) => !!getCachedTranslation(t, language));
    return !allCached;
  });

  useEffect(() => {
    if (language === "en" || !texts || texts.length === 0) {
      setTranslated(texts || []);
      setLoading(false);
      return;
    }

    const allCached = texts.every((t) => !!getCachedTranslation(t, language));
    if (allCached) {
      setTranslated(texts.map((t) => getCachedTranslation(t, language) as string));
      setLoading(false);
      return;
    }

    let isCurrent = true;
    setLoading(true);

    fetchTranslationBatch(texts, language)
      .then((res) => {
        if (isCurrent) {
          setTranslated(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn("Failed to translate array dynamically:", err);
        if (isCurrent) {
          setTranslated(texts);
          setLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [JSON.stringify(texts), language]);

  return { translated, loading };
}

