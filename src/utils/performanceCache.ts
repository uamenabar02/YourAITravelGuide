/**
 * High-Performance LRU In-Memory & Session Storage Cache with Debounced Disk Persistence
 * Optimizes transit routing, coordinates, geocoding lookups, and rapid UI state sync.
 */

export type SyncStatusState = "synced" | "saving" | "offline" | "cached";

type SyncListener = (status: SyncStatusState) => void;

class PerformanceCacheManager {
  private memoryCache: Map<string, { data: any; expiresAt: number }> = new Map();
  private maxCacheSize = 250;
  private defaultTtlMs = 1000 * 60 * 60 * 24; // 24 hours
  private syncListeners: Set<SyncListener> = new Set();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private currentStatus: SyncStatusState = "synced";

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.updateStatus("synced"));
      window.addEventListener("offline", () => this.updateStatus("offline"));
    }
  }

  public getStatus(): SyncStatusState {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return "offline";
    }
    return this.currentStatus;
  }

  public subscribeSync(listener: SyncListener): () => void {
    this.syncListeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.syncListeners.delete(listener);
    };
  }

  private updateStatus(status: SyncStatusState) {
    this.currentStatus = status;
    this.syncListeners.forEach((fn) => fn(status));
  }

  /**
   * Fast LRU Memory & Session Cache Get
   */
  public get<T>(key: string): T | null {
    const cached = this.memoryCache.get(key);
    if (cached) {
      if (Date.now() < cached.expiresAt) {
        // Move to most recently used
        this.memoryCache.delete(key);
        this.memoryCache.set(key, cached);
        return cached.data as T;
      }
      this.memoryCache.delete(key);
    }

    // Try reading from sessionStorage for warm boots
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        const raw = sessionStorage.getItem(`perf_cache_${key}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.expiresAt > Date.now()) {
            this.set(key, parsed.data, parsed.expiresAt - Date.now(), false);
            return parsed.data as T;
          }
        }
      }
    } catch {
      // ignore
    }

    return null;
  }

  /**
   * Fast LRU Memory & Session Cache Set
   */
  public set(key: string, data: any, ttlMs?: number, persistToSession = true): void {
    // Evict oldest if full
    if (this.memoryCache.size >= this.maxCacheSize) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) this.memoryCache.delete(oldestKey);
    }

    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);
    this.memoryCache.set(key, { data, expiresAt });

    if (persistToSession && typeof window !== "undefined" && window.sessionStorage) {
      try {
        sessionStorage.setItem(
          `perf_cache_${key}`,
          JSON.stringify({ data, expiresAt })
        );
      } catch {
        // storage quota exceeded or disabled
      }
    }
  }

  /**
   * Debounced LocalStorage Saver
   * Prevents micro-stutters during rapid multi-item checks, drag-and-drops, and voting.
   */
  public debouncedSave(key: string, data: any, delayMs = 250): void {
    this.updateStatus("saving");

    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(key, JSON.stringify(data));
        }
        this.updateStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "synced");
      } catch (err) {
        console.error("Debounced save failed:", err);
      } finally {
        this.debounceTimers.delete(key);
      }
    }, delayMs);

    this.debounceTimers.set(key, timer);
  }

  /**
   * Clear or trim cache when memory is tight
   */
  public clear(): void {
    this.memoryCache.clear();
  }
}

export const perfCache = new PerformanceCacheManager();
