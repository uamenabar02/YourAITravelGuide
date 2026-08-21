/**
 * Dynamic geocoding via OpenStreetMap Nominatim.
 *
 * Nothing in the app should depend on a static coordinate database alone:
 * any named place can be resolved to real-world coordinates at runtime.
 *
 * Nominatim usage policy compliance:
 *  - max ~1 request/second (enforced with a local throttle)
 *  - descriptive User-Agent
 *  - aggressive in-process caching (positive AND negative) so repeated
 *    generations never hammer the service
 */

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName?: string;
}

const cache = new Map<string, GeocodeResult | null>();
let lastRequestAt = 0;
const MIN_INTERVAL_MS = 1100;

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttle(): Promise<void> {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

/** Geocode a free-form query string. Returns null when nothing is found. */
export async function geocodePlace(query: string): Promise<GeocodeResult | null> {
  const key = query.trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;

  try {
    await throttle();
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=jsonv2&limit=1`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "LocalExplorerAI/1.0 (trip-planner geocoding; contact: local-explorer-app)",
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      // Transient HTTP error: do NOT negative-cache, allow retry later
      return null;
    }
    const data: any = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const result: GeocodeResult = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        displayName: data[0].display_name,
      };
      if (!isNaN(result.lat) && !isNaN(result.lng)) {
        cache.set(key, result);
        return result;
      }
    }
    // Successful request with zero results → negative-cache
    cache.set(key, null);
    return null;
  } catch (err) {
    console.warn("Nominatim geocode failed for", query, err);
    return null; // network error: no negative cache
  }
}

/**
 * Resolve a named spot (bar, café, landmark, trail…) to coordinates,
 * using the town/region context to disambiguate.
 * Tries "Spot, Town" first, then the spot name alone.
 */
export async function geocodeSpot(
  spotName: string,
  townContext?: string
): Promise<GeocodeResult | null> {
  const name = (spotName || "").trim();
  if (!name) return null;

  if (townContext && townContext.trim()) {
    const withTown = await geocodePlace(`${name}, ${townContext.trim()}`);
    if (withTown) return withTown;
  }
  return geocodePlace(name);
}
