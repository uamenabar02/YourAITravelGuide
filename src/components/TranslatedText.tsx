import React, { useState, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext";
import { getCachedTranslation, fetchTranslation, fetchTranslationBatch, TRANSLATION_EVENT } from "../utils/translator";

interface TranslatedTextProps {
  text?: string;
  children?: React.ReactNode;
  className?: string;
  as?: "span" | "p" | "div" | "h1" | "h2" | "h3" | "h4" | "li" | "strong" | "italic";
  isMarkdown?: boolean;
}

export const TranslatedText: React.FC<TranslatedTextProps> = ({
  text = "",
  children,
  className = "",
  as: Component = "span",
}) => {
  const contentText = text || (typeof children === "string" ? children : "");
  const { language, showOriginal } = useLanguage();
  const [translatedText, setTranslatedText] = useState<string>(() => {
    if (showOriginal || language === "en" || !contentText) return contentText;
    const cached = getCachedTranslation(contentText, language);
    return cached || contentText;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (showOriginal || language === "en" || !contentText) return false;
    const cached = getCachedTranslation(contentText, language);
    return !cached;
  });

  useEffect(() => {
    if (showOriginal || language === "en" || !contentText) {
      setTranslatedText(contentText);
      setLoading(false);
      return;
    }

    const cached = getCachedTranslation(contentText, language);
    if (cached) {
      setTranslatedText(cached);
      setLoading(false);
      return;
    }

    let isCurrent = true;
    setLoading(true);

    fetchTranslation(contentText, language)
      .then((translated) => {
        if (isCurrent) {
          setTranslatedText(translated);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn("Dynamic translation failed:", err);
        if (isCurrent) {
          setTranslatedText(contentText); // fallback to original
          setLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [contentText, language, showOriginal]);

  // Listen to broadcast translation updates from batch engine
  useEffect(() => {
    if (showOriginal || language === "en" || !contentText) return;

    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ lang: string }>;
      if (!customEvent.detail || customEvent.detail.lang === language) {
        const cached = getCachedTranslation(contentText, language);
        if (cached) {
          setTranslatedText((prev) => (prev !== cached ? cached : prev));
          setLoading(false);
        }
      }
    };

    window.addEventListener(TRANSLATION_EVENT, handleUpdate);
    return () => {
      window.removeEventListener(TRANSLATION_EVENT, handleUpdate);
    };
  }, [contentText, language, showOriginal]);

  const displayedText = loading ? contentText : translatedText;

  // Handle markdown-like formatting (bold **, line breaks \n) cleanly
  if (displayedText.includes("**") || displayedText.includes("\n")) {
    const lines = displayedText.split("\n");
    return (
      <Component className={`${className} transition-opacity duration-300 ${loading ? "opacity-75" : "opacity-100"}`}>
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

  return (
    <Component className={`${className} transition-opacity duration-300 ${loading ? "opacity-75" : "opacity-100"}`}>
      {displayedText}
    </Component>
  );
};

/**
 * Custom hook to translate a single string dynamically.
 * Automatically switches to the active language and handles loading state.
 */
export function useTranslateText(text: string): { translated: string; loading: boolean } {
  const { language, showOriginal } = useLanguage();
  const [translated, setTranslated] = useState<string>(() => {
    if (showOriginal || language === "en" || !text) return text;
    return getCachedTranslation(text, language) || text;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (showOriginal || language === "en" || !text) return false;
    return !getCachedTranslation(text, language);
  });

  useEffect(() => {
    if (showOriginal || language === "en" || !text) {
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
  }, [text, language, showOriginal]);

  useEffect(() => {
    if (showOriginal || language === "en" || !text) return;

    const handleUpdate = () => {
      const cached = getCachedTranslation(text, language);
      if (cached && cached !== translated) {
        setTranslated(cached);
        setLoading(false);
      }
    };

    window.addEventListener(TRANSLATION_EVENT, handleUpdate);
    return () => {
      window.removeEventListener(TRANSLATION_EVENT, handleUpdate);
    };
  }, [text, language, showOriginal, translated]);

  return { translated, loading };
}

/**
 * Custom hook to translate an array of strings dynamically.
 * Combines them into a single batch query to optimize performance.
 */
export function useTranslateArray(texts: string[]): { translated: string[]; loading: boolean } {
  const { language, showOriginal } = useLanguage();
  const [translated, setTranslated] = useState<string[]>(() => {
    if (showOriginal || language === "en" || !texts || texts.length === 0) return texts || [];
    return texts.map((t) => getCachedTranslation(t, language) || t);
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (showOriginal || language === "en" || !texts || texts.length === 0) return false;
    const allCached = texts.every((t) => !!getCachedTranslation(t, language));
    return !allCached;
  });

  useEffect(() => {
    if (showOriginal || language === "en" || !texts || texts.length === 0) {
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
  }, [JSON.stringify(texts), language, showOriginal]);

  useEffect(() => {
    if (showOriginal || language === "en" || !texts || texts.length === 0) return;

    const handleUpdate = () => {
      const allCached = texts.map((t) => getCachedTranslation(t, language) || t);
      setTranslated(allCached);
      setLoading(false);
    };

    window.addEventListener(TRANSLATION_EVENT, handleUpdate);
    return () => {
      window.removeEventListener(TRANSLATION_EVENT, handleUpdate);
    };
  }, [JSON.stringify(texts), language, showOriginal]);

  return { translated, loading };
}

