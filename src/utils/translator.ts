import { Language } from "../context/LanguageContext";
import { ItineraryPlan } from "../types";

const CACHE_STORAGE_KEY = "localexplorer_ai_translation_cache_v2";
export const TRANSLATION_EVENT = "localexplorer_translation_updated";

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

const MAX_CACHE_ENTRIES_PER_LANG = 400;
const AGGRESSIVE_TRIM_PER_LANG = 150;

const saveCache = () => {
  try {
    // Trim cache to MAX_CACHE_ENTRIES_PER_LANG if needed
    Object.keys(translationCache).forEach((lang) => {
      const keys = Object.keys(translationCache[lang] || {});
      if (keys.length > MAX_CACHE_ENTRIES_PER_LANG) {
        const trimmed: Record<string, string> = {};
        keys.slice(keys.length - MAX_CACHE_ENTRIES_PER_LANG).forEach((k) => {
          trimmed[k] = translationCache[lang][k];
        });
        translationCache[lang] = trimmed;
      }
    });

    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(translationCache));
  } catch (e) {
    console.warn("Storage write limit reached in translation cache; aggressively trimming to retry:", e);
    try {
      // Aggressively trim to AGGRESSIVE_TRIM_PER_LANG and retry
      Object.keys(translationCache).forEach((lang) => {
        const keys = Object.keys(translationCache[lang] || {});
        if (keys.length > AGGRESSIVE_TRIM_PER_LANG) {
          const trimmed: Record<string, string> = {};
          keys.slice(keys.length - AGGRESSIVE_TRIM_PER_LANG).forEach((k) => {
            trimmed[k] = translationCache[lang][k];
          });
          translationCache[lang] = trimmed;
        }
      });
      localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(translationCache));
    } catch (retryErr) {
      console.warn("Unable to persist translation cache even after aggressive trim:", retryErr);
    }
  }
};

const notifyTranslationUpdate = (lang: Language) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(TRANSLATION_EVENT, { detail: { lang } }));
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

// In-flight pending requests map: key = `${lang}:${text}` -> Promise<string>
const pendingPromises = new Map<string, Promise<string>>();

// Debounced batching queue: { [lang]: Array<{ text: string; resolve: (val: string) => void; reject: (err: any) => void }> }
const batchQueue: Record<string, Array<{ text: string; resolve: (val: string) => void }>> = {};
const batchTimers: Record<string, any> = {};

function processBatchQueue(lang: Language) {
  const queue = batchQueue[lang];
  delete batchQueue[lang];
  delete batchTimers[lang];

  if (!queue || queue.length === 0) return;

  const uniqueTexts = Array.from(new Set(queue.map((item) => item.text)));

  fetchTranslationBatch(uniqueTexts, lang)
    .then((results) => {
      const resultMap = new Map<string, string>();
      uniqueTexts.forEach((txt, idx) => {
        resultMap.set(txt, results[idx] || txt);
      });

      queue.forEach((item) => {
        const res = resultMap.get(item.text) || item.text;
        item.resolve(res);
      });
    })
    .catch((_err) => {
      // Graceful fallback: resolve with original text
      queue.forEach((item) => {
        item.resolve(item.text);
      });
    });
}

/**
 * Fetch translation for a single text string from the server.
 * Automatically aggregates into a debounced batch queue (50ms window) to prevent burst requests.
 */
export async function fetchTranslation(text: string, lang: Language): Promise<string> {
  if (lang === "en" || !text) return text;
  const cached = getCachedTranslation(text, lang);
  if (cached) return cached;

  const cacheKey = `${lang}:${text.trim()}`;
  if (pendingPromises.has(cacheKey)) {
    return pendingPromises.get(cacheKey)!;
  }

  const promise = new Promise<string>((resolve) => {
    if (!batchQueue[lang]) {
      batchQueue[lang] = [];
    }
    batchQueue[lang].push({ text, resolve });

    if (!batchTimers[lang]) {
      batchTimers[lang] = setTimeout(() => {
        processBatchQueue(lang);
      }, 50);
    }
  }).finally(() => {
    pendingPromises.delete(cacheKey);
  });

  pendingPromises.set(cacheKey, promise);
  return promise;
}

/**
 * Fetch translations for a batch of text strings from the server in chunks.
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

  // Chunk into batches of up to 45 strings so whole plans translate in 1 single fast request
  const CHUNK_SIZE = 45;
  for (let i = 0; i < textsToFetch.length; i += CHUNK_SIZE) {
    const chunkTexts = textsToFetch.slice(i, i + CHUNK_SIZE);
    const chunkIndexes = indexesToFetch.slice(i, i + CHUNK_SIZE);

    let success = false;
    for (let attempt = 0; attempt < 2 && !success; attempt++) {
      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: chunkTexts, targetLanguage: lang }),
        });

        if (res.ok) {
          const data = await res.json();
          const translatedList = data.translation;
          if (Array.isArray(translatedList)) {
            translatedList.forEach((translated, relIdx) => {
              const originalIdx = chunkIndexes[relIdx];
              const originalText = chunkTexts[relIdx];
              if (translated && typeof translated === "string") {
                setCachedTranslation(originalText, lang, translated);
                results[originalIdx] = translated;
              } else {
                results[originalIdx] = originalText;
              }
            });
            success = true;
          } else if (typeof translatedList === "string" && chunkTexts.length === 1) {
            const originalIdx = chunkIndexes[0];
            const originalText = chunkTexts[0];
            setCachedTranslation(originalText, lang, translatedList);
            results[originalIdx] = translatedList;
            success = true;
          }
        } else if (res.status === 429 && attempt === 0) {
          // Wait before single retry on rate limit
          await new Promise((r) => setTimeout(r, 600));
        }
      } catch (_err) {
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }
    }

    if (!success) {
      // Graceful fallback to original English strings
      chunkIndexes.forEach((idx) => {
        if (!results[idx]) {
          results[idx] = texts[idx];
        }
      });
    }
  }

  // Fill in any still-missing items
  indexesToFetch.forEach((idx) => {
    if (!results[idx]) {
      results[idx] = texts[idx];
    }
  });

  saveCache();
  notifyTranslationUpdate(lang);
  return results;
}

/**
 * Extract all dynamic translatable strings from an ItineraryPlan and pre-fetch them in batches.
 * Runs silently in the background when the user changes language in the navigation menu.
 */
export async function translateEntireItineraryPlan(
  plan: ItineraryPlan,
  lang: Language,
  onProgress?: (progressPercent: number) => void
): Promise<void> {
  if (lang === "en" || !plan) {
    if (onProgress) onProgress(100);
    return;
  }

  const extractedTexts = new Set<string>();

  // Title and summaries
  if (plan.title) extractedTexts.add(plan.title);
  if (plan.summary) extractedTexts.add(plan.summary);
  if (Array.isArray(plan.highlights)) {
    plan.highlights.forEach((h) => h && extractedTexts.add(h));
  }

  // Days and activities
  if (Array.isArray(plan.days)) {
    plan.days.forEach((day) => {
      if (day.dayTitle) extractedTexts.add(day.dayTitle);
      if (day.theme) extractedTexts.add(day.theme);
      if (day.summary) extractedTexts.add(day.summary);

      if (Array.isArray(day.activities)) {
        day.activities.forEach((act) => {
          if (act.name) extractedTexts.add(act.name);
          if (act.description) extractedTexts.add(act.description);
          if (act.insiderTip) extractedTexts.add(act.insiderTip);
          if (act.eventDetails?.eventType) extractedTexts.add(act.eventDetails.eventType);
          if (act.eventDetails?.venue) extractedTexts.add(act.eventDetails.venue);
          if (Array.isArray(act.reviews)) {
            act.reviews.forEach((r) => r?.text && extractedTexts.add(r.text));
          }
        });
      }
    });
  }

  // Accommodations
  if (Array.isArray(plan.accommodations)) {
    plan.accommodations.forEach((acc) => {
      if (acc.name) extractedTexts.add(acc.name);
      if (acc.description) extractedTexts.add(acc.description);
    });
  }

  const allTexts = Array.from(extractedTexts).filter((t) => t && t.trim().length > 0);
  const uncachedTexts = allTexts.filter((t) => !getCachedTranslation(t, lang));

  if (uncachedTexts.length === 0) {
    if (onProgress) onProgress(100);
    notifyTranslationUpdate(lang);
    return;
  }

  // Pre-fetch all uncached texts in optimized batch
  await fetchTranslationBatch(uncachedTexts, lang);

  if (onProgress) onProgress(100);
  notifyTranslationUpdate(lang);
}
