import { perfCache } from "./performanceCache";

export interface VerifiedLocation {
  displayName: string;
  lat: number;
  lng: number;
  city?: string;
  country?: string;
}

/**
 * Verify and geocode accommodation location/address using free OpenMeteo & Nominatim geocoding services.
 */
export async function searchLocationSuggestions(
  query: string,
  cityContext?: string
): Promise<VerifiedLocation[]> {
  if (!query || query.trim().length < 2) return [];

  const fullQuery = cityContext && !query.toLowerCase().includes(cityContext.toLowerCase())
    ? `${query}, ${cityContext}`
    : query;

  const cacheKey = `geo_${fullQuery.toLowerCase().trim()}`;
  const cached = perfCache.get<VerifiedLocation[]>(cacheKey);
  if (cached) return cached;

  try {
    // 1. Try OpenMeteo Geocoding first
    const openMeteoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      fullQuery
    )}&count=5&language=en&format=json`;

    const res = await fetch(openMeteoUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const results: VerifiedLocation[] = data.results.map((item: any) => ({
          displayName: [item.name, item.admin1, item.country].filter(Boolean).join(", "),
          lat: item.latitude,
          lng: item.longitude,
          city: item.admin1 || item.name,
          country: item.country,
        }));
        perfCache.set(cacheKey, results, 1000 * 60 * 60 * 24);
        return results;
      }
    }

    // 2. Fallback to Nominatim for precise street addresses
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      fullQuery
    )}&limit=5`;

    const nomRes = await fetch(nominatimUrl, {
      headers: { "Accept-Language": "en" },
    });

    if (nomRes.ok) {
      const nomData = await nomRes.json();
      if (Array.isArray(nomData) && nomData.length > 0) {
        const results: VerifiedLocation[] = nomData.map((item: any) => ({
          displayName: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        }));
        perfCache.set(cacheKey, results, 1000 * 60 * 60 * 24);
        return results;
      }
    }
  } catch (err) {
    console.warn("Location geocoding search error:", err);
  }

  return [];
}
