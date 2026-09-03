/**
 * Safe Promise Timeout Utility
 * Prevents network calls (such as Firebase Firestore queries) from hanging indefinitely
 * in constrained environments like Android WebViews, mobile browsers, or iframes.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallbackValue: T,
  label: string = "Operation"
): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        console.warn(`[Timeout] ${label} exceeded ${ms}ms limit, proceeding with fallback.`);
        resolve(fallbackValue);
      }
    }, ms);

    promise
      .then((result) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(result);
        }
      })
      .catch((err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          console.warn(`[Notice] ${label} caught exception, proceeding with fallback:`, err?.message || err);
          resolve(fallbackValue);
        }
      });
  });
}
