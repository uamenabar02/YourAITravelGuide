import { GoogleGenAI, Type } from "@google/genai";
import { ActivitySpot } from "../src/types.js";
import { generateGoogleMapsSearchUrl } from "../src/utils/destinations.js";

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName?: string;
  address?: string;
}

interface SpotGeocodeItem {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

const memoryCache = new Map<string, GeocodeResult>();
let geocodeAiClient: GoogleGenAI | null = null;

function getAi(): GoogleGenAI | null {
  if (!geocodeAiClient && process.env.GEMINI_API_KEY) {
    geocodeAiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return geocodeAiClient;
}

export function haversineDistKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radius = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function validCoordinates(value?: { lat?: number; lng?: number }): value is { lat: number; lng: number } {
  return typeof value?.lat === "number" && typeof value.lng === "number" &&
    Number.isFinite(value.lat) && Number.isFinite(value.lng) &&
    Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180 &&
    !(value.lat === 0 && value.lng === 0);
}

async function geocodeViaNominatim(query: string): Promise<GeocodeResult | null> {
  const key = `nominatim:${query.trim().toLowerCase()}`;
  if (memoryCache.has(key)) return memoryCache.get(key)!;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3&addressdetails=1&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "YourAITravelGuide/1.0 (worldwide geocoder)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const rows: any[] = await response.json();
    for (const row of rows) {
      const lat = Number(row.lat);
      const lng = Number(row.lon);
      if (validCoordinates({ lat, lng })) {
        const result = { lat, lng, displayName: row.display_name, address: row.display_name };
        memoryCache.set(key, result);
        return result;
      }
    }
  } catch { /* continue to the next deterministic provider */ }
  return null;
}

async function geocodeViaPhoton(query: string, base?: { lat: number; lng: number }): Promise<GeocodeResult | null> {
  const key = `photon:${query.trim().toLowerCase()}:${base?.lat || ""}:${base?.lng || ""}`;
  if (memoryCache.has(key)) return memoryCache.get(key)!;
  try {
    const bias = base ? `&lat=${base.lat}&lon=${base.lng}` : "";
    const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=3${bias}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const data: any = await response.json();
    for (const feature of data.features || []) {
      const [lng, lat] = feature.geometry?.coordinates || [];
      if (!validCoordinates({ lat, lng })) continue;
      if (base && haversineDistKm(base.lat, base.lng, lat, lng) > 50) continue;
      const props = feature.properties || {};
      const result = {
        lat, lng,
        displayName: props.name || query,
        address: [props.street, props.housenumber, props.city, props.country].filter(Boolean).join(", "),
      };
      memoryCache.set(key, result);
      return result;
    }
  } catch { /* Gemini is the final provider */ }
  return null;
}

async function deterministicGeocode(name: string, town: string, address?: string): Promise<GeocodeResult | null> {
  // Deliberately ordered: Nominatim spot+town, address+town, spot alone; then Photon.
  const nominatimQueries = [`${name}, ${town}`, address ? `${address}, ${town}` : "", name].filter(Boolean);
  for (const query of nominatimQueries) {
    const result = await geocodeViaNominatim(query);
    if (result) return result;
  }
  const townCenter = await geocodeViaNominatim(town);
  for (const query of [`${name}, ${town}`, address ? `${address}, ${town}` : "", name].filter(Boolean)) {
    const result = await geocodeViaPhoton(query, townCenter || undefined);
    if (result) return result;
  }
  return null;
}

async function geminiGeocode(spots: { name: string; address?: string; category?: string }[], town: string): Promise<SpotGeocodeItem[]> {
  const ai = getAi();
  if (!ai || spots.length === 0) return [];
  const prompt = `Geolocate these real places in or around ${town}. Return exact worldwide GPS coordinates and real addresses: ${spots.map((s) => `${s.name}${s.address ? ` (${s.address})` : ""}`).join("; ")}.`;
  for (const model of ["gemini-3.5-flash-lite", "gemini-3.5-flash"]) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING }, address: { type: Type.STRING },
                lat: { type: Type.NUMBER }, lng: { type: Type.NUMBER },
              },
              required: ["name", "address", "lat", "lng"],
            },
          },
        },
      });
      const parsed: SpotGeocodeItem[] = JSON.parse(response.text || "[]");
      if (Array.isArray(parsed)) return parsed.filter((item) => validCoordinates(item));
    } catch (error) {
      console.warn(`Gemini GIS geocode failed on ${model}:`, (error as Error).message);
    }
  }
  return [];
}

export async function dynamicAIGeocodeBatch(
  spots: { name: string; address?: string; category?: string }[],
  destinationContext: string
): Promise<Map<string, SpotGeocodeItem>> {
  const results = new Map<string, SpotGeocodeItem>();
  const unresolved: typeof spots = [];
  for (const spot of spots) {
    const key = spot.name.trim().toLowerCase();
    if (!key || results.has(key)) continue;
    const cached = memoryCache.get(`${destinationContext.toLowerCase()}|${key}`);
    const found = cached || await deterministicGeocode(spot.name, destinationContext, spot.address);
    if (found) {
      const item = { name: spot.name, address: found.address || spot.address || "", lat: found.lat, lng: found.lng };
      results.set(key, item);
      memoryCache.set(`${destinationContext.toLowerCase()}|${key}`, found);
    } else unresolved.push(spot);
  }
  // Gemini GIS is intentionally the last resort, never the first source of a pin.
  for (const item of await geminiGeocode(unresolved, destinationContext)) {
    const requested = unresolved.find((spot) => spot.name.toLowerCase() === item.name.toLowerCase());
    const key = (requested?.name || item.name).trim().toLowerCase();
    results.set(key, item);
    memoryCache.set(`${destinationContext.toLowerCase()}|${key}`, item);
  }
  return results;
}

export async function geocodeSpot(spotName: string, destination = "", address?: string): Promise<GeocodeResult | null> {
  const found = await deterministicGeocode(spotName, destination, address);
  if (found) return found;
  const ai = await geminiGeocode([{ name: spotName, address }], destination);
  return ai[0] || null;
}

export async function resolveActivityCoordinates(
  spotName: string,
  townContext: string,
  address?: string,
  modelCoordinates?: { lat?: number; lng?: number },
  _maxRadiusKm = 35
): Promise<{ lat: number; lng: number }> {
  const found = await geocodeSpot(spotName, townContext, address);
  if (found) return { lat: found.lat, lng: found.lng };
  if (validCoordinates(modelCoordinates)) return modelCoordinates;
  // A dynamically geocoded town centre is the only fallback; there is no city database.
  const townCenter = await geocodeViaNominatim(townContext) || await geocodeViaPhoton(townContext);
  if (townCenter) return { lat: townCenter.lat, lng: townCenter.lng };
  throw new Error(`Unable to geocode ${spotName} in ${townContext}`);
}

export async function enrichActivitiesWithDynamicAI(activities: ActivitySpot[], destinationContext: string): Promise<void> {
  if (!activities.length) return;
  const all = activities.flatMap((activity) => [activity, ...(activity.alternativeOptions || []), ...(activity.allOptions || [])]);
  const geoMap = await dynamicAIGeocodeBatch(all.map((spot) => ({ name: spot.name, address: spot.address, category: spot.category })), destinationContext);
  for (const spot of all) {
    const match = geoMap.get(spot.name.trim().toLowerCase());
    if (match) {
      spot.coordinates = { lat: match.lat, lng: match.lng };
      if (match.address) spot.address = match.address;
    } else {
      try {
        spot.coordinates = await resolveActivityCoordinates(spot.name, destinationContext, spot.address, spot.coordinates);
      } catch (error) {
        console.warn((error as Error).message); // Preserve an existing model pin rather than inventing one.
      }
    }
    spot.googleMapsUrl = generateGoogleMapsSearchUrl(spot.name, destinationContext, spot.address, spot.coordinates);
  }
}
