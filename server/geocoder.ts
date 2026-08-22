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

// ---------------------------------------------------------------------------
// Verified Known World Landmarks Dictionary for 100% Precision Pinpointing
// ---------------------------------------------------------------------------
const KNOWN_VERIFIED_LANDMARKS: Record<string, { lat: number; lng: number; address?: string }> = {
  // Donostia / San Sebastián
  "plaza de gipuzkoa": { lat: 43.3204, lng: -1.9818, address: "Plaza de Gipuzkoa, Donostia-San Sebastián" },
  "gipuzkoa gardens": { lat: 43.3204, lng: -1.9818, address: "Plaza de Gipuzkoa, Donostia-San Sebastián" },
  "playa de la concha": { lat: 43.3168, lng: -1.9858, address: "Paseo de la Concha, Donostia-San Sebastián" },
  "concha promenade": { lat: 43.3168, lng: -1.9858, address: "Paseo de la Concha, Donostia-San Sebastián" },
  "peine del viento": { lat: 43.3216, lng: -2.0053, address: "Eduardo Chillida Pasealekua, Donostia-San Sebastián" },
  "comb of the wind": { lat: 43.3216, lng: -2.0053, address: "Eduardo Chillida Pasealekua, Donostia-San Sebastián" },
  "monte igueldo": { lat: 43.3200, lng: -2.0083, address: "Itsasargi Bidea, Donostia-San Sebastián" },
  "funicular de igueldo": { lat: 43.3195, lng: -2.0065, address: "Plaza del Funicular, Donostia-San Sebastián" },
  "monte urgull": { lat: 43.3248, lng: -1.9882, address: "Subida al Castillo, Donostia-San Sebastián" },
  "castillo de la mota": { lat: 43.3248, lng: -1.9882, address: "Monte Urgull, Donostia-San Sebastián" },
  "parte vieja": { lat: 43.3230, lng: -1.9840, address: "Parte Vieja, Donostia-San Sebastián" },
  "plaza de la constitucion": { lat: 43.3230, lng: -1.9840, address: "Plaza de la Constitución, Donostia-San Sebastián" },
  "plaza de la constitución": { lat: 43.3230, lng: -1.9840, address: "Plaza de la Constitución, Donostia-San Sebastián" },
  "zurriola": { lat: 43.3245, lng: -1.9775, address: "Zurriola Hiribidea, Donostia-San Sebastián" },
  "kursaal": { lat: 43.3245, lng: -1.9785, address: "Zurriola Hiribidea 1, Donostia-San Sebastián" },
  "miramar palace": { lat: 43.3150, lng: -1.9935, address: "Miraconcha Pasealekua 48, Donostia-San Sebastián" },
  "palacio de miramar": { lat: 43.3150, lng: -1.9935, address: "Miraconcha Pasealekua 48, Donostia-San Sebastián" },
  "bretxa": { lat: 43.3222, lng: -1.9825, address: "Alameda del Boulevard 3, Donostia-San Sebastián" },
  "san telmo museum": { lat: 43.3240, lng: -1.9828, address: "Plaza Zuloaga 1, Donostia-San Sebastián" },
  "basque culinary center": { lat: 43.2941, lng: -1.9822, address: "Paseo Juan Avelino Barriola 101, Donostia-San Sebastián" },
  "cristina enea": { lat: 43.3150, lng: -1.9750, address: "Mandako Dukearen Pasealekua, Donostia-San Sebastián" },
  "plaza de lasala": { lat: 43.3230, lng: -1.9860, address: "Lasala Plaza, Donostia-San Sebastián" },
  "muelle de san sebastian": { lat: 43.3230, lng: -1.9860, address: "Muelle Kaia, Donostia-San Sebastián" },
  "tabakalera": { lat: 43.3185, lng: -1.9770, address: "Plaza de las Cigarreras 1, Donostia-San Sebastián" },
  "sagues": { lat: 43.3268, lng: -1.9715, address: "Sagués, Donostia-San Sebastián" },
  "sagüés": { lat: 43.3268, lng: -1.9715, address: "Sagués, Donostia-San Sebastián" },
  "isla santa clara": { lat: 43.3218, lng: -1.9950, address: "Isla de Santa Clara, Donostia-San Sebastián" },
  "isla de santa clara": { lat: 43.3218, lng: -1.9950, address: "Isla de Santa Clara, Donostia-San Sebastián" },
  "santa clara island": { lat: 43.3218, lng: -1.9950, address: "Isla de Santa Clara, Donostia-San Sebastián" },
  "santa clara ferry": { lat: 43.3218, lng: -1.9950, address: "Isla de Santa Clara Ferry, Donostia-San Sebastián" },
  "astigarraga": { lat: 43.2800, lng: -1.9472, address: "Astigarraga, Gipuzkoa" },

  // Bilbao
  "guggenheim": { lat: 43.2687, lng: -2.9340, address: "Abandoibarra Etorbidea 2, Bilbao" },
  "casco viejo bilbao": { lat: 43.2572, lng: -2.9238, address: "Casco Viejo, Bilbao" },
  "mercado de la ribera": { lat: 43.2558, lng: -2.9248, address: "Erribera Kalea, Bilbao" },
  "funicular de artxanda": { lat: 43.2720, lng: -2.9250, address: "Plaza del Funicular, Bilbao" },
  "zubizuri": { lat: 43.2661, lng: -2.9283, address: "Zubizuri Bridge, Bilbao" },
  "plaza nueva bilbao": { lat: 43.2591, lng: -2.9232, address: "Plaza Nueva, Bilbao" },

  // Other Basque spots
  "itzurun": { lat: 43.2995, lng: -2.2580, address: "Itzurun Hondartza, Zumaia" },
  "flysch": { lat: 43.2995, lng: -2.2580, address: "Flysch Geopark, Zumaia" },
  "balenciaga": { lat: 43.3032, lng: -2.2052, address: "Aldamar Parkea 6, Getaria" },
  "raton de getaria": { lat: 43.3075, lng: -2.2020, address: "Monte San Anton, Getaria" },
  "san juan de gaztelugatxe": { lat: 43.4473, lng: -2.7850, address: "Gaztelugatxe, Bermeo" },
  "albaola": { lat: 43.3275, lng: -1.9280, address: "Ondartxo 1, Pasaia" },

  // Barcelona
  "sagrada familia": { lat: 41.4036, lng: 2.1744, address: "Carrer de Mallorca 401, Barcelona" },
  "park guell": { lat: 41.4145, lng: 2.1527, address: "Carrer d'Olot, Barcelona" },
  "casa batllo": { lat: 41.3916, lng: 2.1649, address: "Passeig de Gràcia 43, Barcelona" },
  "boqueria": { lat: 41.3817, lng: 2.1716, address: "La Rambla 91, Barcelona" },

  // Kyoto
  "fushimi inari": { lat: 34.9671, lng: 135.7727, address: "Fushimi Inari Taisha, Kyoto" },
  "arashiyama": { lat: 35.0117, lng: 135.6777, address: "Arashiyama Bamboo Grove, Kyoto" },
  "kiyomizu-dera": { lat: 34.9949, lng: 135.7850, address: "Kiyomizu-dera, Kyoto" },
  "ginkaku-ji": { lat: 35.0272, lng: 135.7982, address: "Ginkaku-ji, Kyoto" },
};

export function checkKnownLandmarks(spotName: string): GeocodeResult | null {
  const norm = (spotName || "").toLowerCase();
  for (const [key, coords] of Object.entries(KNOWN_VERIFIED_LANDMARKS)) {
    if (norm.includes(key)) {
      return {
        lat: coords.lat,
        lng: coords.lng,
        displayName: coords.address || spotName,
        address: coords.address || spotName,
      };
    }
  }
  return null;
}

/**
 * Extracts clean, pinpointable landmark names from compound or descriptive activity titles.
 * e.g., "Plaza de Gipuzkoa Gardens & Romantic Quarter Promenade" -> ["Plaza de Gipuzkoa", "Plaza de Gipuzkoa Gardens"]
 */
export function extractLandmarkQueryCandidates(spotName: string, address?: string): string[] {
  const candidates: string[] = [];
  const cleanSpot = (spotName || "").replace(/\(.*?\)/g, "").trim();

  // Fluff words to strip from landmark titles
  const fluffRegex = /\b(Gardens?|Promenade|Walk|Stroll|Tour|Pintxo Crawl|Tapas Tour|Sunset|Hike|Overlook|Viewpoint|District|Quarter|Area|Neighborhood|Visit|Experience|Sights|Highlights|Tasting|Eatery|Tavern|Restoration|Lined|Beach Promenade|Sea Wall)\b/gi;

  if (address && address.trim().length > 3) {
    candidates.push(address.trim());
  }

  // Split by connectors (&, and, +, /, —, with, including)
  const parts = cleanSpot.split(/\s*(?:&|and|\+|\/|—|-|with|including)\s*/i);
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.length > 2) {
      const stripped = trimmed.replace(fluffRegex, "").trim();
      if (stripped.length > 2 && !candidates.includes(stripped)) {
        candidates.push(stripped);
      }
      if (!candidates.includes(trimmed)) {
        candidates.push(trimmed);
      }
    }
  }

  // Full clean spot without fluff
  const fullStripped = cleanSpot.replace(fluffRegex, "").trim();
  if (fullStripped.length > 3 && !candidates.includes(fullStripped)) {
    candidates.push(fullStripped);
  }

  if (!candidates.includes(spotName)) {
    candidates.push(spotName);
  }

  return candidates;
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
  // 1. Check verified known landmarks dictionary first
  const known = checkKnownLandmarks(name) || (address ? checkKnownLandmarks(address) : null);
  if (known) return known;

  // 2. Resolve town center for regional distance sanity checks
  const townCenter = await checkKnownLandmarks(town) || await geocodeViaNominatim(town);

  // 3. Extract clean query candidates from compound or verbose titles
  const candidates = extractLandmarkQueryCandidates(name, address);

  // Search each candidate with town context first, enforcing regional distance check (<= 80 km)
  for (const candidate of candidates) {
    const nominatimQueries = [`${candidate}, ${town}`, candidate].filter(Boolean);
    for (const query of nominatimQueries) {
      const result = await geocodeViaNominatim(query);
      if (result) {
        // If town center is known, allow regional day trips (<= 80 km), but reject wild ocean/cross-continental jumps
        if (townCenter && haversineDistKm(townCenter.lat, townCenter.lng, result.lat, result.lng) > 80) {
          continue; // Reject cross-continental / wrong-continent false positives (e.g. Puerto Rico)
        }
        return result;
      }
    }
  }

  // 4. Try Photon with spatial bias towards town center
  for (const candidate of candidates) {
    for (const query of [`${candidate}, ${town}`, candidate]) {
      const result = await geocodeViaPhoton(query, townCenter || undefined);
      if (result) {
        if (townCenter && haversineDistKm(townCenter.lat, townCenter.lng, result.lat, result.lng) > 80) {
          continue;
        }
        return result;
      }
    }
  }

  return null;
}

async function geminiGeocode(spots: { name: string; address?: string; category?: string }[], town: string): Promise<SpotGeocodeItem[]> {
  const ai = getAi();
  if (!ai || spots.length === 0) return [];
  const townCenter = await checkKnownLandmarks(town) || await geocodeViaNominatim(town);
  const prompt = `Geolocate these real places in or near ${town}. Return exact GPS coordinates and real street addresses in ${town} or its immediate region: ${spots.map((s) => `${s.name}${s.address ? ` (${s.address})` : ""}`).join("; ")}.`;
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
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => {
          if (!validCoordinates(item)) return false;
          // Distance sanity check: reject spots > 80km away from town center
          if (townCenter && haversineDistKm(townCenter.lat, townCenter.lng, item.lat, item.lng) > 80) {
            return false;
          }
          return true;
        });
      }
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

  // Resolve town center for sanity check
  const townCenter = await checkKnownLandmarks(destinationContext) || await geocodeViaNominatim(destinationContext);

  for (const spot of all) {
    // 1. Check known landmark database
    const known = checkKnownLandmarks(spot.name) || (spot.address ? checkKnownLandmarks(spot.address) : null);
    if (known) {
      spot.coordinates = { lat: known.lat, lng: known.lng };
      if (known.address) spot.address = known.address;
      spot.googleMapsUrl = generateGoogleMapsSearchUrl(spot.name, destinationContext, spot.address, spot.coordinates);
      continue;
    }

    // 2. If spot already has valid coordinates close to town center (<= 8km), keep them unless we get a high-confidence match
    const existingValid = validCoordinates(spot.coordinates);
    const existingDistance = existingValid && townCenter ? haversineDistKm(townCenter.lat, townCenter.lng, spot.coordinates.lat, spot.coordinates.lng) : 999;

    const match = await deterministicGeocode(spot.name, destinationContext, spot.address);
    if (match) {
      spot.coordinates = { lat: match.lat, lng: match.lng };
      if (match.address) spot.address = match.address;
    } else if (!existingValid || existingDistance > 12) {
      try {
        spot.coordinates = await resolveActivityCoordinates(spot.name, destinationContext, spot.address, spot.coordinates);
      } catch (error) {
        console.warn((error as Error).message);
      }
    }

    spot.googleMapsUrl = generateGoogleMapsSearchUrl(spot.name, destinationContext, spot.address, spot.coordinates);
  }
}

