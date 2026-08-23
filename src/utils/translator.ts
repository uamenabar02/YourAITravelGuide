// Dynamic translation cache and service utilizing Gemini API
import { Language } from "../context/LanguageContext";

const CACHE_STORAGE_KEY = "localexplorer_ai_translation_cache_v2";

// Local translation cache: { languageCode: { englishText: translatedText } }
const translationCache: Record<string, Record<string, string>> = {};

// Load cache on startup
try {
  const saved = localStorage.getItem(CACHE_STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    Object.keys(parsed).forEach((lang) => {
      translationCache[lang] = parsed[lang] || {};
    });
  }
} catch (e) {
  console.warn("Failed to load translation cache:", e);
}

const saveCache = () => {
  try {
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(translationCache));
  } catch (e) {
    console.warn("Failed to persist translation cache:", e);
  }
};

/**
 * Check if we have a translation cached for a given text and language.
 */
export function getCachedTranslation(text: string, lang: Language): string | null {
  if (lang === "en" || !text) return text;
  const cleanText = text.trim();
  if (!cleanText) return "";
  return translationCache[lang]?.[cleanText] || null;
}

/**
 * Cache a translation for a given text and language.
 */
export function setCachedTranslation(text: string, lang: Language, translation: string): void {
  if (lang === "en" || !text || !translation) return;
  const cleanText = text.trim();
  if (!translationCache[lang]) {
    translationCache[lang] = {};
  }
  translationCache[lang][cleanText] = translation.trim();
  saveCache();
}

/**
 * Fetch translation for a single text string from the server.
 */
export async function fetchTranslation(text: string, lang: Language): Promise<string> {
  if (lang === "en" || !text) return text;
  const cached = getCachedTranslation(text, lang);
  if (cached) return cached;

  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, targetLanguage: lang }),
    });

    if (res.ok) {
      const data = await res.json();
      const translated = data.translation;
      if (translated && typeof translated === "string") {
        setCachedTranslation(text, lang, translated);
        return translated;
      }
    }
  } catch (err) {
    console.error(`Failed to fetch translation for text: "${text.substring(0, 30)}..."`, err);
  }

  return text; // Fallback to original English
}

/**
 * Fetch translations for a batch of text strings from the server in one request.
 */
export async function fetchTranslationBatch(texts: string[], lang: Language): Promise<string[]> {
  if (lang === "en" || !texts || texts.length === 0) return texts;

  const results: string[] = new Array(texts.length);
  const indexesToFetch: number[] = [];
  const textsToFetch: string[] = [];

  // Populate cached entries first
  texts.forEach((text, idx) => {
    const cached = getCachedTranslation(text, lang);
    if (cached) {
      results[idx] = cached;
    } else {
      indexesToFetch.push(idx);
      textsToFetch.push(text);
    }
  });

  if (textsToFetch.length === 0) {
    return results;
  }

  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: textsToFetch, targetLanguage: lang }),
    });

    if (res.ok) {
      const data = await res.json();
      const translatedList = data.translation;
      if (Array.isArray(translatedList)) {
        translatedList.forEach((translated, index) => {
          const originalIdx = indexesToFetch[index];
          const originalText = textsToFetch[index];
          if (translated) {
            setCachedTranslation(originalText, lang, translated);
            results[originalIdx] = translated;
          } else {
            results[originalIdx] = originalText;
          }
        });
        return results;
      }
    }
  } catch (err) {
    console.error("Failed to fetch translation batch:", err);
  }

  // Fallback missing indices to originals
  indexesToFetch.forEach((originalIdx) => {
    results[originalIdx] = texts[originalIdx];
  });

  return results;
}
