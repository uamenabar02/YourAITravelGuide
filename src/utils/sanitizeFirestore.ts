/**
 * Sanitizes an object or array to ensure no `undefined` values exist,
 * preventing Firestore `setDoc()` or `updateDoc()` from throwing errors.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) return null as any;
  if (data === null || typeof data !== "object") return data;
  if (data instanceof Date) return data;
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as any;
  }
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(data as Record<string, any>)) {
    if (val !== undefined) {
      clean[key] = sanitizeForFirestore(val);
    }
  }
  return clean as T;
}
