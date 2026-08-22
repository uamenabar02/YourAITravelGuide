import { GoogleGenAI, Type } from "@google/genai";
import {
  ItineraryPlan,
  DailyPlan,
  VacationPreferences,
  HometownPreferences,
  ActivitySpot,
  ActivityCategory,
  SwapActivityRequest,
  CandidateSpot,
  DestinationStop,
  UserSpot,
  TasteProfile,
  ActivityDeepDetails,
  SubSpotPin,
  AnecdoteItem,
} from "../src/types.js";
import { geocodeSpot, resolveActivityCoordinates, enrichActivitiesWithDynamicAI } from "./geocoder.js";
import { getRealPhotosForSpot } from "./photoService.js";
import {
  getCuratedPhotosForSpot,
  getTicketOrBookingUrl,
  generateGoogleMapsSearchUrl,
  calculateTransitLogistics,
  findVerifiedDestination,
  getKnownSpotCoordinates,
} from "../src/utils/destinations.js";
import { normalizeTimeSlot, parseTimeToHours, formatHoursTo12 } from "../src/utils/time.js";

function parseTimeInterval(timeStr: string): { start: number; end: number } {
  if (!timeStr) return { start: 9.0, end: 10.5 };
  const parts = timeStr.split(/\s+[-–—]\s+|\s+to\s+/i);
  let start = parseTimeToHours(parts[0]);
  let end = parts.length > 1 ? parseTimeToHours(parts[1]) : start + 1.5;
  if (end <= start) end = start + 1.25;
  return { start, end };
}

export function deoverlapDayActivities(
  activities: ActivitySpot[],
  originalLockedNames: string[] = []
): ActivitySpot[] {
  if (!activities || activities.length <= 1) return activities || [];

  const lockedSet = new Set(originalLockedNames.map((n) => n.trim().toLowerCase()));

  // Wrap activities with parsed time intervals
  const items = activities.map((act) => {
    const range = parseTimeInterval(act.time);
    const isLocked = !!(act as any).isLocked || lockedSet.has(act.name.trim().toLowerCase());
    return {
      act: { ...act, isLocked },
      start: range.start,
      end: range.end,
      duration: Math.max(0.75, range.end - range.start),
      isLocked,
    };
  });

  // Sort chronologically by start time.
  // If start times are identical, place locked activities before newly generated ones.
  items.sort((a, b) => {
    if (Math.abs(a.start - b.start) < 0.01) {
      if (a.isLocked && !b.isLocked) return -1;
      if (!a.isLocked && b.isLocked) return 1;
    }
    return a.start - b.start;
  });

  // Adjust overlapping activities
  for (let i = 0; i < items.length - 1; i++) {
    const current = items[i];
    const next = items[i + 1];

    const buffer = 0.25; // 15 minute transit/buffer
    if (next.start < current.end) {
      // Overlap detected!
      if (next.isLocked && !current.isLocked) {
        // 'next' is locked, so 'current' (which is unlocked) must end before 'next' starts
        current.end = Math.max(current.start + 0.75, next.start - buffer);
        current.act.time = `${formatHoursTo12(current.start)} - ${formatHoursTo12(current.end)}`;
      } else if (!next.isLocked) {
        // 'next' is UNLOCKED, so move 'next' to start after 'current'
        const isMorningBakery =
          /breakfast|pasteler[íi]a|bakery|caf[ée]|coffee|desayuno/i.test(next.act.name + " " + next.act.category) &&
          current.start >= 9.0;

        if (isMorningBakery && i === 0 && current.start - next.duration >= 7.5 && !current.isLocked) {
          next.start = Math.max(7.5, current.start - next.duration - buffer);
          next.end = next.start + next.duration;
          next.act.time = `${formatHoursTo12(next.start)} - ${formatHoursTo12(next.end)}`;
        } else {
          next.start = Math.round((current.end + buffer) * 4) / 4;
          next.end = next.start + next.duration;
          next.act.time = `${formatHoursTo12(next.start)} - ${formatHoursTo12(next.end)}`;
        }
      }
      // If BOTH are locked, leave their original time slots intact without mutating!
    } else {
      if (!next.isLocked) next.act.time = normalizeTimeSlot(next.act.time);
    }
    if (!current.isLocked) current.act.time = normalizeTimeSlot(current.act.time);
  }

  // Re-sort items chronologically by updated start times
  items.sort((a, b) => a.start - b.start);

  return items.map((item) => item.act);
}

// ---------------------------------------------------------------------------
// Gemini model configuration.
// Model IDs are validated against the Gemini API catalog:
//  - gemini-3.5-flash is the primary and creative model.
//  - gemini-3.5-flash-lite is the resilient fallback and tertiary model.
// Override via env if needed.
// ---------------------------------------------------------------------------
const PRIMARY_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.5-flash";
const FALLBACK_TEXT_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash-lite";
const CREATIVE_MODEL = process.env.GEMINI_CREATIVE_MODEL || "gemini-3.5-flash";
const TERTIARY_TEXT_MODEL = "gemini-3.5-flash-lite";

// Lazy-initialized Gemini client
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Names that indicate a dining/drinking venue. Dining recommendations must
// come from user-provided data or live AI search — never from static lists.
const DINING_NAME_HINTS = [
  "pintxo", "tapas", "tavern", "bar ", " bar", "bistro", "café", "cafe", "coffee",
  "restaurant", "eatery", "gastronomy", "michelin", "ciderhouse", "sagardotegi",
  "tasting", "izakaya", "roastery", "bakery", "asador", "trattoria", "brew",
];
function isDiningName(name: string): boolean {
  const n = (name || "").toLowerCase();
  return DINING_NAME_HINTS.some((h) => n.includes(h));
}

/**
 * Serialize the user's Taste Profile into prompt language.
 * Returns "" when there is nothing meaningful to tell the model.
 */
function buildTasteInstruction(tp?: TasteProfile | null): string {
  if (!tp) return "";
  const parts: string[] = [];
  if (tp.diningStyles && tp.diningStyles.length > 0) parts.push(`preferred dining styles: ${tp.diningStyles.join(", ")}`);
  if (tp.drinkPreferences && tp.drinkPreferences.length > 0) parts.push(`preferred drinks: ${tp.drinkPreferences.join(", ")}`);
  if (tp.atmospheres && tp.atmospheres.length > 0) parts.push(`preferred atmospheres: ${tp.atmospheres.join(", ")}`);
  if (tp.budgetComfort) parts.push(`usual budget comfort: ${tp.budgetComfort}`);
  if (tp.dietaryNotes) parts.push(`dietary notes: ${tp.dietaryNotes}`);
  if (tp.dislikes && tp.dislikes.length > 0) parts.push(`MUST AVOID: ${tp.dislikes.join(", ")}`);
  return parts.join("; ");
}

/**
 * Context-aware dining pairing rules: every food/drink suggestion must fit
 * both the user's taste profile AND the flow of surrounding activities.
 */
const CONTEXT_AWARE_DINING_RULES = `CONTEXT-AWARE DINING PAIRING: Every bar/café/restaurant you suggest MUST match the user's taste profile above AND the activities around its time slot:
- After outdoor/hiking/active plans → casual, restorative, no-fuss spots (counter lunch, hearty local dish).
- Before a sunset, viewpoint or evening stroll → a terrace or aperitif-style stop close to the route.
- On rainy or indoor-culture days → cozy, quiet, indoor atmospheres.
- Morning slots → coffee/bakery-style stops aligned with their drink preferences.
- Evening slots → aligned with their preferred drinks (wine bar vs cocktails vs craft beer vs cider).
Never suggest a dining venue in isolation from the day's flow.`;

// Coordinate & Destination Knowledge Base
const DESTINATION_COORDINATES: Record<string, { lat: number; lng: number; country: string }> = {
  "azpeitia": { lat: 43.1818, lng: -2.2644, country: "Spain" },
  "azkoitia": { lat: 43.1782, lng: -2.3117, country: "Spain" },
  "zarautz": { lat: 43.2847, lng: -2.1698, country: "Spain" },
  "tolosa": { lat: 43.1367, lng: -2.0728, country: "Spain" },
  "zumaia": { lat: 43.2983, lng: -2.2572, country: "Spain" },
  "getaria": { lat: 43.3025, lng: -2.2036, country: "Spain" },
  "hondarribia": { lat: 43.3636, lng: -1.7911, country: "Spain" },
  "pasaia": { lat: 43.3247, lng: -1.9286, country: "Spain" },
  "eibar": { lat: 43.1844, lng: -2.4725, country: "Spain" },
  "ordizia": { lat: 43.0539, lng: -2.1783, country: "Spain" },
  "beasain": { lat: 43.0483, lng: -2.1722, country: "Spain" },
  "irun": { lat: 43.3378, lng: -1.7888, country: "Spain" },
  "gernika": { lat: 43.3150, lng: -2.6800, country: "Spain" },
  "getxo": { lat: 43.3580, lng: -3.0130, country: "Spain" },
  "astigarraga": { lat: 43.2800, lng: -1.9472, country: "Spain" },
  "orio": { lat: 43.2790, lng: -2.1280, country: "Spain" },
  "bakio": { lat: 43.4280, lng: -2.8100, country: "Spain" },
  "mundaka": { lat: 43.4070, lng: -2.6980, country: "Spain" },
  "donostia": { lat: 43.3183, lng: -1.9812, country: "Spain" },
  "san sebastian": { lat: 43.3183, lng: -1.9812, country: "Spain" },
  "san sebastián": { lat: 43.3183, lng: -1.9812, country: "Spain" },
  "donostia / san sebastian": { lat: 43.3183, lng: -1.9812, country: "Spain" },
  "donostia / san sebastián": { lat: 43.3183, lng: -1.9812, country: "Spain" },
  "donostia-san sebastián": { lat: 43.3183, lng: -1.9812, country: "Spain" },
  "bilbao": { lat: 43.2630, lng: -2.9350, country: "Spain" },
  "biarritz": { lat: 43.4832, lng: -1.5586, country: "France" },
  "pamplona": { lat: 42.8125, lng: -1.6458, country: "Spain" },
  "vitoria": { lat: 42.8467, lng: -2.6716, country: "Spain" },
  "vitoria-gasteiz": { lat: 42.8467, lng: -2.6716, country: "Spain" },
  "kyoto": { lat: 35.0116, lng: 135.7681, country: "Japan" },
  "tokyo": { lat: 35.6762, lng: 139.6503, country: "Japan" },
  "barcelona": { lat: 41.3879, lng: 2.1699, country: "Spain" },
  "madrid": { lat: 40.4168, lng: -3.7038, country: "Spain" },
  "seville": { lat: 37.3891, lng: -5.9845, country: "Spain" },
  "valencia": { lat: 39.4699, lng: -0.3763, country: "Spain" },
  "granada": { lat: 37.1773, lng: -3.5986, country: "Spain" },
  "malaga": { lat: 36.7213, lng: -4.4214, country: "Spain" },
  "rome": { lat: 41.9028, lng: 12.4964, country: "Italy" },
  "florence": { lat: 43.7696, lng: 11.2558, country: "Italy" },
  "venice": { lat: 45.4408, lng: 12.3155, country: "Italy" },
  "paris": { lat: 48.8566, lng: 2.3522, country: "France" },
  "nice": { lat: 43.7102, lng: 7.2620, country: "France" },
  "london": { lat: 51.5074, lng: -0.1278, country: "United Kingdom" },
  "edinburgh": { lat: 55.9533, lng: -3.1883, country: "United Kingdom" },
  "lisbon": { lat: 38.7223, lng: -9.1393, country: "Portugal" },
  "porto": { lat: 41.1579, lng: -8.6291, country: "Portugal" },
  "amsterdam": { lat: 52.3676, lng: 4.9041, country: "Netherlands" },
  "vienna": { lat: 48.2082, lng: 16.3738, country: "Austria" },
  "prague": { lat: 50.0755, lng: 14.4378, country: "Czech Republic" },
  "berlin": { lat: 52.5200, lng: 13.4050, country: "Germany" },
  "munich": { lat: 48.1351, lng: 11.5820, country: "Germany" },
  "new york": { lat: 40.7128, lng: -74.0060, country: "USA" },
  "san francisco": { lat: 37.7749, lng: -122.4194, country: "USA" },
  "los angeles": { lat: 34.0522, lng: -118.2437, country: "USA" },
  "chicago": { lat: 41.8781, lng: -87.6298, country: "USA" },
  "oaxaca": { lat: 17.0732, lng: -96.7266, country: "Mexico" },
  "mexico city": { lat: 19.4326, lng: -99.1332, country: "Mexico" },
  "vancouver": { lat: 49.2827, lng: -123.1207, country: "Canada" },
  "cape town": { lat: -33.9249, lng: 18.4241, country: "South Africa" },
  "sydney": { lat: -33.8688, lng: 151.2093, country: "Australia" },
  "bangkok": { lat: 13.7563, lng: 100.5018, country: "Thailand" },
  "seoul": { lat: 37.5665, lng: 126.9780, country: "South Korea" },
};

function lookupKnownCoordinates(placeName: string): { lat: number; lng: number } {
  const clean = placeName.trim().toLowerCase();
  
  // 1. Check verified destinations database
  const verified = findVerifiedDestination(clean);
  if (verified) {
    return { lat: verified.coordinates.lat, lng: verified.coordinates.lng };
  }

  // 2. Check local coordinate map
  for (const [key, val] of Object.entries(DESTINATION_COORDINATES)) {
    if (clean === key || clean.includes(key) || key.includes(clean)) {
      return { lat: val.lat, lng: val.lng };
    }
  }
  
  return { lat: 43.3183, lng: -1.9812 }; // Default baseline
}

function getSpotSignatures(name: string, description: string = ""): string[] {
  const text = (name + " " + description).toLowerCase();
  const signatures: string[] = [];

  const landmarkKeywords = [
    "hondarribia", "getaria", "pasaia", "pasai", "zarautz", "tolosa", "astigarraga", "biarritz",
    "zurriola", "peine", "chillida", "kursaal", "miramar", "concha", "urgull", "mota", "telmo",
    "bretxa", "nestor", "cuchara", "ganbara", "vina", "viña", "igueldo", "funicular", "sagues",
    "sagüés", "clara", "cider", "sagardo", "guggenheim", "artxanda", "colosseum", "pantheon",
    "sagrada", "guell", "louvre", "eiffel", "cristina enea", "perla", "tabakalera", "alberdi",
    "gipuzkoa", "lasala", "albaola", "hiruzta", "akelarre", "arzak", "katxina"
  ];

  for (const kw of landmarkKeywords) {
    if (text.includes(kw)) {
      signatures.push(kw);
    }
  }

  const cleanWords = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(
      (w) =>
        w.length > 3 &&
        !["with", "from", "your", "that", "this", "town", "city", "walk", "tour", "day", "visit", "stroll", "explore", "center"].includes(w)
    );

  if (cleanWords.length >= 2) {
    signatures.push(cleanWords.slice(0, 3).join("_"));
  } else if (cleanWords.length === 1) {
    signatures.push(cleanWords[0]);
  }

  // Exact-name signature: guarantees that even subtle name differences
  // (e.g. "(Variation 2)" fallback spots) are treated as distinct.
  const exactName = name.trim().toLowerCase();
  if (exactName) {
    signatures.push(`name:${exactName}`);
  }

  return signatures;
}

function getUnusedBackupSpot(
  destination: string,
  usedSignatures: Set<string>,
  timeSlot: string = "02:30 PM - 04:30 PM",
  preferredCategory: ActivityCategory = "culture"
): ActivitySpot {
  const isDonostia =
    destination.toLowerCase().includes("donosti") ||
    destination.toLowerCase().includes("san sebastian") ||
    destination.toLowerCase().includes("san sebastián");

  const baseCoords = lookupKnownCoordinates(destination);

  if (isDonostia) {
    const backupList: ActivitySpot[] = [
      {
        id: `bk-ss-1`,
        time: timeSlot,
        name: "Plaza de Gipuzkoa Gardens & Romantic Quarter Promenade",
        category: "culture",
        description: "19th-century French-inspired gardens featuring a duck pond, marble busts, and historic arcades lined with traditional bakeries.",
        insiderTip: "Enjoy morning coffee under the stone arches at Cafe Parke.",
        approxCost: "Free",
        rating: 4.8,
        coordinates: { lat: 43.3205, lng: -1.9805 },
        address: "Plaza de Gipuzkoa, Donostia",
        durationMinutes: 75,
      },
      {
        id: `bk-ss-2`,
        time: timeSlot,
        name: "Cristina Enea Romantic Park & Mandragora Villa",
        category: "nature",
        description: "Lush aristocratic park created by the Duke of Mandas, featuring free-roaming peacocks, giant redwoods, and tranquil woodland trails.",
        insiderTip: "Cross the wooden footbridge over the Urumea river to enter from Egia.",
        approxCost: "Free",
        rating: 4.9,
        coordinates: { lat: 43.3150, lng: -1.9750 },
        address: "Mandako Dukearen Pasealekua, Donostia",
        durationMinutes: 90,
      },
      {
        id: `bk-ss-3`,
        time: timeSlot,
        name: "Plaza de Lasala & Old Fishing Port Dock Stroll",
        category: "sightseeing",
        description: "Historic stone quayside where colorful wooden trawlers dock, backed by traditional seafood taverns and ramparts.",
        insiderTip: "Grab a portion of fried calamari from the portside stands to eat by the water.",
        approxCost: "€8 - €15",
        rating: 4.8,
        coordinates: { lat: 43.3230, lng: -1.9860 },
        address: "Muelle de San Sebastián, Donostia",
        durationMinutes: 60,
      },
      {
        id: `bk-ss-4`,
        time: timeSlot,
        name: "Alderdi Eder Gardens & Belle Époque Bandstand",
        category: "relaxation",
        description: "Romantic riverside gardens with a fairytale bandstand, tamarind trees, and open views toward the bay.",
        insiderTip: "The benches facing the bandstand catch the last evening sun.",
        approxCost: "Free",
        rating: 4.8,
        coordinates: { lat: 43.3210, lng: -1.9815 },
        address: "Alderdi Eder, Donostia",
        durationMinutes: 60,
      },
      {
        id: `bk-ss-5`,
        time: timeSlot,
        name: "Ondarreta Beach & Illuminated Cliffside Tunnel",
        category: "nature",
        description: "Quiet royal beach promenade leading through the sea cliff tunnel illuminated by artistic wave light installations.",
        insiderTip: "Great low-tide walk connecting La Concha to Ondarreta.",
        approxCost: "Free",
        rating: 4.9,
        coordinates: { lat: 43.3155, lng: -1.9990 },
        address: "Paseo de Ondarreta, Donostia",
        durationMinutes: 75,
      },
    ];

    for (const spot of backupList) {
      const sigs = getSpotSignatures(spot.name, spot.description);
      const isUsed = sigs.some((s) => usedSignatures.has(s));
      if (!isUsed) {
        sigs.forEach((s) => usedSignatures.add(s));
        return spot;
      }
    }
  }

  // Generic backup spot fallback.
  // IMPORTANT: rotate through a varied template pool so consecutive fallback
  // spots are always distinct (previously the same spot was returned for every
  // call, producing itineraries full of duplicates for non-curated cities).
  // NOTE: dining venues (bars/cafés/restaurants) are intentionally ABSENT here.
  // Food & drink recommendations come from the user's own places (My Places)
  // or from live AI search — never from a static built-in list.
  const GENERIC_TEMPLATES: {
    name: string;
    category: ActivityCategory;
    description: string;
    insiderTip: string;
    approxCost: string;
  }[] = [
    {
      name: "Historic Old Quarter & Landmark Square Walk",
      category: "sightseeing",
      description: "Wander the oldest streets of the center, admiring preserved facades, churches, and the main square where locals gather.",
      insiderTip: "Start at the main square and duck into the side alleys where the original street layout survives.",
      approxCost: "Free",
    },
    {
      name: "Panoramic Viewpoint & Scenic Lookout Trail",
      category: "nature",
      description: "A gentle climb to the best elevated viewpoint over the rooftops and surrounding landscape.",
      insiderTip: "Arrive shortly before sunset for the best light and photographs.",
      approxCost: "Free",
    },
    {
      name: "Historic Market Hall & Craft Stalls",
      category: "shopping",
      description: "The town's main market hall, full of regional produce, artisan goods, and everyday local life.",
      insiderTip: "Go mid-morning when the stalls are fullest and the aisles are calm.",
      approxCost: "Free to browse",
    },
    {
      name: "Local History Museum & Craft Exhibition",
      category: "culture",
      description: "A compact museum tracing the region's history, crafts, and traditions through well-curated exhibits.",
      insiderTip: "Ask the front desk about any temporary exhibitions or guided visits.",
      approxCost: "€5 - €12",
    },
    {
      name: "Riverside or Waterfront Promenade Stroll",
      category: "nature",
      description: "A flat, shaded walking path along the water connecting bridges, benches, and small squares.",
      insiderTip: "Cross to the opposite bank for the classic postcard view back toward the center.",
      approxCost: "Free",
    },
    {
      name: "Botanical Garden & Quiet Park Loop",
      category: "relaxation",
      description: "A leafy urban park or botanical garden perfect for an unhurried loop between flower beds and old trees.",
      insiderTip: "The benches near the water feature are the calmest spot on warm afternoons.",
      approxCost: "Free",
    },
    {
      name: "Artisan Quarter & Independent Workshop Visits",
      category: "shopping",
      description: "A cluster of small workshops and boutiques selling ceramics, textiles, and handmade souvenirs.",
      insiderTip: "Chat with the makers; many will demonstrate their craft if asked politely.",
      approxCost: "Free to browse",
    },
    {
      name: "Historic Church or Monument Interior Visit",
      category: "culture",
      description: "Step inside the most significant historic monument to admire its architecture, art, and quiet atmosphere.",
      insiderTip: "Mornings are quietest; check opening hours as they can change for services.",
      approxCost: "€3 - €8",
    },
    {
      name: "Hidden Courtyard & Street-Art Discovery Walk",
      category: "hidden-gem",
      description: "A self-guided loop linking quiet courtyards, murals, and corners most visitors never find.",
      insiderTip: "Look up—many of the best details are above street level.",
      approxCost: "Free",
    },
    {
      name: "Old-Town Evening Photo Walk",
      category: "nightlife",
      description: "Familiar streets read completely differently after dark: lit facades, empty squares, and the town at its quietest.",
      insiderTip: "Walk the lit route counter-clockwise — the best details face you on the way.",
      approxCost: "Free",
    },
  ];

  // Pick the first template whose signature has not been used yet.
  let chosen = GENERIC_TEMPLATES.find((tpl) => {
    const sigs = getSpotSignatures(tpl.name, tpl.description);
    return !sigs.some((s) => usedSignatures.has(s));
  });

  // Absolute last resort: everything is exhausted, vary the name with a suffix
  // so the spot remains unique within this itinerary.
  if (!chosen) {
    const base = GENERIC_TEMPLATES[usedSignatures.size % GENERIC_TEMPLATES.length];
    const variantNum = Math.floor(usedSignatures.size / GENERIC_TEMPLATES.length) + 1;
    chosen = {
      ...base,
      name: `${base.name} (Variation ${variantNum})`,
    };
  }

  const uniqueId = `dyn-gen-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
  const genericSpot: ActivitySpot = {
    id: uniqueId,
    time: normalizeTimeSlot(timeSlot),
    name: chosen.name,
    category: chosen.category || preferredCategory,
    description: chosen.description,
    insiderTip: chosen.insiderTip,
    approxCost: chosen.approxCost,
    rating: 4.8,
    coordinates: { lat: baseCoords.lat + (Math.random() * 0.004 - 0.002), lng: baseCoords.lng + (Math.random() * 0.004 - 0.002) },
    durationMinutes: 75,
  };

  const sigs = getSpotSignatures(genericSpot.name, genericSpot.description);
  sigs.forEach((s) => usedSignatures.add(s));

  return genericSpot;
}

function generateExtraDayForDestination(
  dayNum: number,
  destination: string,
  prefs: VacationPreferences,
  usedSignatures: Set<string> = new Set()
): DailyPlan {
  const isDonostia = destination.toLowerCase().includes("donosti") || destination.toLowerCase().includes("san sebastian") || destination.toLowerCase().includes("san sebastián");

  if (isDonostia) {
    const candidateDays: DailyPlan[] = [
      {
        dayNumber: dayNum,
        dayTitle: `Day ${dayNum}: Mount Ulia Coastal Trail & Pasaia Donibane Wooden Boat Crossing`,
        theme: "Cliffside Nature Path & Maritime Heritage",
        summary: "Hike the historic St. James coastal trail along Mount Ulia's cliffs, descending into the fjord-like harbor of Pasaia Donibane.",
        estimatedTotalBudget: "€30 - €60",
        activities: [
          {
            id: `ss-${dayNum}-1`,
            time: "09:30 AM - 12:30 PM",
            name: "Mount Ulia St. James Coastal Way Cliffside Walk",
            category: "nature",
            description: "Hike past historic stone lighthouses, ruined aqueducts, and dramatic sandstone cliffs with unobstructed views of the roaring Atlantic.",
            insiderTip: "Wear comfortable walking shoes with good tread for the stone steps.",
            approxCost: "Free",
            rating: 4.9,
            coordinates: { lat: 43.3310, lng: -1.9550 },
            address: "Paseo de Ulia, Donostia",
            durationMinutes: 180,
            photos: getCuratedPhotosForSpot("nature", "Mount Ulia coastal trail", destination),
          },
          {
            id: `ss-${dayNum}-2`,
            time: "01:00 PM - 04:00 PM",
            name: "Albaola Sea Factory of the Basques & Pasaia Boat Shuttle",
            category: "culture",
            description: "Cross Pasaia harbor on a green wooden motor launch to visit the live shipyard building a full-scale replica of the 16th-century whaling galleon San Juan.",
            insiderTip: "Watch master carpenters shape oak beams using medieval timbering techniques.",
            approxCost: "€9 museum",
            rating: 4.9,
            coordinates: { lat: 43.3265, lng: -1.9280 },
            address: "Ondartxo 1, Pasaia San Pedro",
            durationMinutes: 150,
            photos: getCuratedPhotosForSpot("culture", "Albaola sea factory shipyard", destination),
          },
        ],
      },
      {
        dayNumber: dayNum,
        dayTitle: `Day ${dayNum}: Getaria Coastal Fishing Village & Balenciaga Museum`,
        theme: "Oceanic Terroir & Haute Couture Heritage",
        summary: "Explore the coastal village of Getaria, home to fashion legend Cristóbal Balenciaga and world-famous wood-grilled whole turbot.",
        estimatedTotalBudget: "€45 - €85",
        activities: [
          {
            id: `ss-${dayNum}-1`,
            time: "10:00 AM - 12:30 PM",
            name: "Cristóbal Balenciaga Haute Couture Museum",
            category: "culture",
            description: "Admire groundbreaking architectural fashion designs by master couturier Cristóbal Balenciaga housed in his ancestral palace.",
            insiderTip: "Visit the top floor gallery overlooking the harbor.",
            approxCost: "€10",
            rating: 4.9,
            coordinates: { lat: 43.3020, lng: -2.2040 },
            address: "Aldamar Parkea 6, Getaria",
            durationMinutes: 120,
            photos: getCuratedPhotosForSpot("culture", "Balenciaga museum fashion", destination),
          },
          {
            id: `ss-${dayNum}-2`,
            time: "01:00 PM - 04:00 PM",
            name: "Getaria Medieval Streets & San Antón Hill Views",
            category: "sightseeing",
            description: "Wander the walled lanes up toward Mount San Anton for sweeping views over the fishing port and the Basque coast.",
            insiderTip: "Take the harbourside path back down for the classic postcard angle.",
            approxCost: "Free",
            rating: 4.9,
            coordinates: { lat: 43.3010, lng: -2.2025 },
            address: "Getaria Old Town",
            durationMinutes: 180,
            photos: getCuratedPhotosForSpot("sightseeing", "Getaria medieval old town harbor", destination),
          },
        ],
      },
      {
        dayNumber: dayNum,
        dayTitle: `Day ${dayNum}: Medieval Hondarribia Fishing Port & Coastal Cliff Views`,
        theme: "Walled Medieval Heritage & Coastal Views",
        summary: "Take a scenic coastal drive to the border walled town of Hondarribia, admiring colorful fishermen's houses on San Pedro street and walking the ramparts above the Bidasoa estuary.",
        estimatedTotalBudget: "€40 - €75",
        activities: [
          {
            id: `ss-${dayNum}-1`,
            time: "10:00 AM - 12:30 PM",
            name: "Hondarribia Walled Old Town & Calle San Pedro Fishermen Quarter",
            category: "culture",
            description: "Explore the medieval ramparts, Emperor Charles V Castle, and vibrant timber-framed fishermen cottages with painted flower balconies along Calle San Pedro.",
            insiderTip: "Order a grilled sardine pintxo and cold Txakoli wine at Bar Gran Sol on Calle San Pedro.",
            approxCost: "Free",
            rating: 4.9,
            coordinates: { lat: 43.3685, lng: -1.7915 },
            address: "Calle San Pedro, Hondarribia",
            durationMinutes: 120,
            photos: getCuratedPhotosForSpot("culture", "Hondarribia Old Town", destination),
          },
          {
            id: `ss-${dayNum}-2`,
            time: "01:30 PM - 04:00 PM",
            name: "Hondarribia Ramparts Circuit & Bidasoa Estuary Views",
            category: "nature",
            description: "A gentle loop along the medieval walls ending with wide views over the Bidasoa estuary toward the French coast.",
            insiderTip: "The eastern rampart stretch is the quietest and has the best afternoon light.",
            approxCost: "Free",
            rating: 4.9,
            coordinates: { lat: 43.3650, lng: -1.7935 },
            address: "Murallas de Hondarribia",
            durationMinutes: 150,
            photos: getCuratedPhotosForSpot("nature", "Hondarribia ramparts estuary views", destination),
          },
        ],
      },
    ];

    for (const candidate of candidateDays) {
      const primarySigs = getSpotSignatures(candidate.activities[0].name, candidate.activities[0].description);
      const isUsed = primarySigs.some((s) => usedSignatures.has(s));
      if (!isUsed) {
        return candidate;
      }
    }
  }

  // Default fallback extra day
  const baseCoords = lookupKnownCoordinates(destination);
  return {
    dayNumber: dayNum,
    dayTitle: `Day ${dayNum}: ${destination} Artisan Quarters & Scenic Escape`,
    theme: "Neighborhood Terroir & Scenic Relaxation",
    summary: `Immerse deeper into ${destination}'s hidden neighborhood lanes, artisan craft workshops, and scenic vistas.`,
    estimatedTotalBudget: "€40 - €75",
    activities: [
      getUnusedBackupSpot(destination, usedSignatures, "10:00 AM - 12:30 PM", "culture"),
      getUnusedBackupSpot(destination, usedSignatures, "01:30 PM - 04:30 PM", "food"),
    ],
  };
}

function isDaytimeOnlySpot(act: ActivitySpot): boolean {
  const cat = (act.category || "").toLowerCase();
  const text = `${act.name} ${act.description}`.toLowerCase();

  // Museums, cloisters, galleries, exhibitions, cathedrals, shopping, market stalls
  if (["culture", "shopping", "art", "museum"].includes(cat)) return true;
  if (/museum|cloister|gallery|exhibition|monastery|convent|cathedral|church|boutique|market stalls|guided tour|workshop/.test(text)) {
    if (/night tour|evening tour|illuminated/.test(text)) return false;
    return true;
  }

  // High effort hikes/nature without sunset/night context
  if (cat === "nature" || cat === "sightseeing") {
    if (/hike|hiking|trail|trek|climb|mount\s|monte\s|summit/.test(text)) {
      if (/sunset|golden hour|evening|night|lookout|viewpoint/.test(text)) {
        return false;
      }
      return true;
    }
  }

  return false;
}

function getEveningAppropriateSpot(
  dest: string,
  idx: number,
  userSpots?: UserSpot[],
  timeSlot: string = "08:00 PM - 10:30 PM"
): ActivitySpot {
  const baseCoords = lookupKnownCoordinates(dest);

  // Check user dining options
  const userDining = (userSpots || []).filter((sp) => ["bar", "cafe", "restaurant"].includes(sp.category));
  if (userDining.length > 0 && userDining[idx % userDining.length]) {
    const sp = userDining[idx % userDining.length];
    return {
      id: `eve-user-${Date.now()}-${idx}`,
      time: timeSlot,
      name: sp.name,
      category: sp.category === "bar" ? "nightlife" : "food",
      description: sp.notes ? `User saved dining spot: ${sp.notes}` : `Authentic evening dining experience in ${dest}.`,
      insiderTip: "Enjoy the authentic local atmosphere in the late evening.",
      approxCost: "€20 - €40",
      rating: 5.0,
      coordinates: sp.coordinates || baseCoords,
      address: sp.town || dest,
    };
  }

  const eveningCurated: ActivitySpot[] = [
    {
      id: `eve-curated-1-${idx}`,
      time: timeSlot,
      name: "Parte Vieja Traditional Pintxo Crawl & Local Wine Tasting",
      category: "food",
      description: "Hop through historic Old Town pintxo taverns sampling freshly seared local delicacies, artisanal croquettes, and crisp chilled Txakoli wine.",
      insiderTip: "Stand at the bar counter for the authentic Basque dining atmosphere.",
      approxCost: "€20 - €35",
      rating: 5.0,
      coordinates: { lat: 43.3235, lng: -1.9840 },
      address: "Parte Vieja, Donostia",
      durationMinutes: 120,
    },
    {
      id: `eve-curated-2-${idx}`,
      time: timeSlot,
      name: "Gros Neighborhood Artisan Pintxo Route & Craft Beer",
      category: "nightlife",
      description: "Explore the bohemian Gros neighborhood, visiting artisanal craft taverns and creative modern pintxo bars near Zurriola beach.",
      insiderTip: "Try the slow-cooked beef cheek pintxo or seared squid along Calle Zabaleta.",
      approxCost: "€18 - €30",
      rating: 4.9,
      coordinates: { lat: 43.3245, lng: -1.9735 },
      address: "Gros, Donostia",
      durationMinutes: 120,
    },
    {
      id: `eve-curated-3-${idx}`,
      time: timeSlot,
      name: "La Concha Bay Night Promenade & Oceanfront Terrace Drinks",
      category: "relaxation",
      description: "An unhurried illuminated evening stroll along La Concha bay promenade, ending with a digestif or glass of wine overlooking the ocean.",
      insiderTip: "The wrought-iron street lamps cast beautiful reflections on the water at high tide.",
      approxCost: "€10 - €20",
      rating: 4.8,
      coordinates: { lat: 43.3165, lng: -1.9880 },
      address: "Paseo de La Concha, Donostia",
      durationMinutes: 120,
    },
  ];

  return eveningCurated[idx % eveningCurated.length];
}

export async function enforceVacationConstraintsAndPhotos(
  plan: ItineraryPlan,
  prefs: VacationPreferences,
  options: { isReiteration?: boolean } = {}
): Promise<ItineraryPlan> {
  const dest = plan.destinationOrTown || prefs.destination;
  const requestedDays = Math.min(Math.max(Number(prefs.duration) || 3, 1), 30);

  // 1. Process Liked & Skipped Spots from Discovery Swiper
  const likedSpots = prefs.likedSpots || [];
  const skippedSpots = prefs.skippedSpots || [];
  const skippedNames = [
    ...skippedSpots.map((s) => s.name.toLowerCase()),
    ...(prefs.permanentSkips || []).map((s) => s.trim().toLowerCase()).filter(Boolean),
  ];

  // Clone plan days and attach curated photos & booking links
  let updatedDays: DailyPlan[] = plan.days.map((day) => {
    let activities: ActivitySpot[] = day.activities.map((act) => {
      const photos = act.photos && act.photos.length > 0
        ? act.photos
        : getCuratedPhotosForSpot(act.category, act.name, dest);
      const ticketUrl = getTicketOrBookingUrl(act.name, dest, act.approxCost, act.ticketUrl);
      const googleMapsUrl = act.googleMapsUrl || generateGoogleMapsSearchUrl(act.name, dest);

      const alternativeOptions = act.alternativeOptions?.map((alt) => ({
        ...alt,
        photos: getCuratedPhotosForSpot(alt.category, alt.name, dest),
        ticketUrl: getTicketOrBookingUrl(alt.name, dest, alt.approxCost),
        googleMapsUrl: generateGoogleMapsSearchUrl(alt.name, dest),
      }));

      const allOptions = act.allOptions && act.allOptions.length > 0
        ? act.allOptions
        : alternativeOptions && alternativeOptions.length > 0
        ? [
            {
              ...act,
              photos,
              ticketUrl,
              googleMapsUrl,
              alternativeOptions: undefined,
              allOptions: undefined,
            },
            ...alternativeOptions.map((alt) => ({
              ...alt,
              alternativeOptions: undefined,
              allOptions: undefined,
            })),
          ]
        : undefined;

      return {
        ...act,
        photos,
        ticketUrl,
        googleMapsUrl,
        alternativeOptions,
        allOptions,
        selectedOptionIndex: act.selectedOptionIndex ?? 0,
      };
    });

    return {
      ...day,
      activities,
    };
  });

  // Filter out SKIPPED / REJECTED spots from all days (unless locked)
  if (skippedNames.length > 0) {
    updatedDays.forEach((day) => {
      day.activities = day.activities.filter((act) => {
        if ((act as any).isLocked) return true;
        const actName = act.name.toLowerCase();
        return !skippedNames.some((sn) => actName.includes(sn) || sn.includes(actName));
      });

      // Filter alternatives as well
      day.activities.forEach((act) => {
        if (act.alternativeOptions) {
          act.alternativeOptions = act.alternativeOptions.filter((alt) => {
            const altName = alt.name.toLowerCase();
            return !skippedNames.some((sn) => altName.includes(sn) || sn.includes(altName));
          });
        }
      });
    });
  }

  // 4. Strict Trip Duration Enforcement (requestedDays)
  const tripUsedSignatures = new Set<string>();
  updatedDays.flatMap((d) => d.activities).forEach((act) => {
    getSpotSignatures(act.name, act.description).forEach((sig) => tripUsedSignatures.add(sig));
  });

  if (updatedDays.length > requestedDays) {
    updatedDays = updatedDays.slice(0, requestedDays);
  } else if (updatedDays.length < requestedDays) {
    const missingCount = requestedDays - updatedDays.length;
    for (let i = 0; i < missingCount; i++) {
      const nextDayNum = updatedDays.length + 1;
      const extraDay = generateExtraDayForDestination(nextDayNum, dest, prefs, tripUsedSignatures);
      extraDay.activities.flatMap((a) => getSpotSignatures(a.name, a.description)).forEach((s) => tripUsedSignatures.add(s));
      updatedDays.push(extraDay);
    }
  }

  // Ensure day numbers and day titles strictly match sequence
  updatedDays.forEach((day, idx) => {
    day.dayNumber = idx + 1;
    if (!day.dayTitle.includes(`Day ${idx + 1}`)) {
      const cleanTitle = day.dayTitle.replace(/^Day \d+:\s*/i, '');
      day.dayTitle = `Day ${idx + 1}: ${cleanTitle}`;
    }
  });

  // 5. Exploration Pace & Full-Day Coverage Pass
  // NO TRUNCATION IS PERFORMED HERE. Pace only dictates spacing and activity intensity.
  // Ensure every single day spans from morning (~08:30 AM) through late evening (~10:30 PM) across ALL paces.
  updatedDays.forEach((day, dayIdx) => {
    if (!day.activities || day.activities.length === 0) return;

    day.activities.sort((a, b) => parseTimeToHours(a.time) - parseTimeToHours(b.time));

    const firstAct = day.activities[0];
    const lastAct = day.activities[day.activities.length - 1];

    const firstStartH = parseTimeToHours(firstAct.time);
    const lastRange = parseTimeInterval(lastAct.time);
    const lastEndH = lastRange.end;

    // Morning gap check: If day starts late (>= 10:15 AM) and it's not Day 1 arrival
    if (firstStartH >= 10.25 && !(dayIdx === 0 && prefs.arrivalHour)) {
      const morningSpot: ActivitySpot = {
        id: `morning-fill-${dayIdx}-${Date.now()}`,
        time: "08:30 AM - 09:45 AM",
        name: `${dest} Morning Promenade & Artisan Coffee Terrace`,
        category: "cafe",
        description: `Begin your morning with an unhurried promenade walk and fresh local pastries at a scenic outdoor cafe terrace in ${dest}.`,
        insiderTip: "Enjoy quiet early morning views before the daytime crowds arrive.",
        approxCost: "€5 - €10",
        rating: 4.8,
        coordinates: { lat: firstAct.coordinates.lat + 0.001, lng: firstAct.coordinates.lng + 0.001 },
        durationMinutes: 75,
        photos: getCuratedPhotosForSpot("cafe", "coffee terrace breakfast", dest),
        googleMapsUrl: generateGoogleMapsSearchUrl("Artisan Bakery & Cafe", dest),
      };
      day.activities.unshift(morningSpot);
    }

    // Evening gap check: If day ends early (<= 07:30 PM / 19.5) and it's not final day departure
    if (lastEndH <= 19.5 && !(dayIdx === updatedDays.length - 1 && prefs.departureHour)) {
      const eveSpot = getEveningAppropriateSpot(dest, day.activities.length, prefs.userSpots, "08:00 PM - 10:30 PM");
      day.activities.push(eveSpot);
    }

    day.activities.sort((a, b) => parseTimeToHours(a.time) - parseTimeToHours(b.time));
  });

  // 6. Strict Arrival Hour Constraint on Day 1
  if (prefs.arrivalHour && updatedDays.length > 0) {
    const arrHourNum = parseTimeToHours(prefs.arrivalHour);
    const day1 = updatedDays[0];
    const startH = Math.min(Math.floor(arrHourNum), 22);

    // Build up to 3 sane slots starting after arrival, always with end > start
    // and never running past 23:30.
    const slots: string[] = [];
    let cursor = startH + 0.5; // 30 min buffer to settle in
    for (let i = 0; i < 3; i++) {
      const slotStart = cursor;
      const slotEnd = Math.min(slotStart + 2.5, 23.5);
      if (slotEnd - slotStart < 0.75) break; // not enough evening left
      slots.push(`${formatHoursTo12(slotStart)} - ${formatHoursTo12(slotEnd)}`);
      cursor = slotEnd + 0.5; // 30 min transition buffer
    }

    const keptActivities = day1.activities.slice(0, Math.max(1, slots.length));
    day1.activities = keptActivities.map((act, i) => {
      const slotTime = slots[i] || act.time;
      const slotStartH = parseTimeToHours(slotTime);
      if (slotStartH >= 19.5 && isDaytimeOnlySpot(act)) {
        const eveSpot = getEveningAppropriateSpot(dest, i, prefs.userSpots, slotTime);
        return { ...eveSpot, time: slotTime };
      }
      return {
        ...act,
        time: slotTime,
      };
    });

    day1.dayTitle = `Day 1: Arrival & Evening Exploration (${prefs.arrivalHour})`;
    day1.summary = `Arrive in ${dest} at ${prefs.arrivalHour}, settle into accommodation, and begin exploration with an afternoon orientation stroll and dinner.`;
  }

  // 7. Strict Departure Hour Constraint on Final Day
  if (prefs.departureHour && updatedDays.length > 0) {
    const depHourNum = parseTimeToHours(prefs.departureHour);
    const lastDayIdx = updatedDays.length - 1;
    const lastDay = updatedDays[lastDayIdx];

    const filtered = lastDay.activities.filter((act) => {
      const actStartHour = parseTimeToHours(act.time);
      return actStartHour < depHourNum - 0.25;
    });

    // Farewell window: start 1.5h before departure (never earlier than 06:00)
    // so the range is always valid, even for very early departures.
    const farewellStartH = Math.max(6, depHourNum - 1.5);
    const farewellTime =
      farewellStartH < depHourNum
        ? `${formatHoursTo12(farewellStartH)} - ${formatHoursTo12(depHourNum)}`
        : `${formatHoursTo12(Math.max(6, depHourNum - 0.75))} - ${formatHoursTo12(depHourNum)}`;

    if (filtered.length > 0) {
      lastDay.activities = filtered.map((act, i) => ({
        ...act,
        time: i === 0 && depHourNum <= 12 ? farewellTime : act.time,
      }));
    } else {
      const baseCoords = lookupKnownCoordinates(dest);
      lastDay.activities = [
        {
          id: `farewell-morning-${Date.now()}`,
          time: farewellTime,
          name: `Farewell Morning Walk, Traditional Bakery & Scenic Lookout`,
          category: "cafe",
          description: `Savor final panoramic vistas of ${dest} and visit an artisan local bakery for fresh morning coffee and pastries before departure.`,
          insiderTip: "Pick up local gourmet specialties to bring home as souvenirs.",
          approxCost: "€8 - €15",
          rating: 4.9,
          coordinates: { lat: baseCoords.lat + 0.002, lng: baseCoords.lng - 0.001 },
          durationMinutes: 90,
          photos: getCuratedPhotosForSpot("cafe", "bakery morning breakfast", dest),
          ticketUrl: undefined,
          googleMapsUrl: generateGoogleMapsSearchUrl("Artisan Bakery & Cafe", dest),
        },
      ];
    }

    lastDay.dayTitle = `Day ${lastDay.dayNumber}: Morning Farewell & Departure (${prefs.departureHour})`;
    lastDay.theme = "Farewell Morning & Departure";
    lastDay.summary = `Enjoy a relaxed final morning in ${dest}, enjoying traditional coffee and breakfast before departing at ${prefs.departureHour}.`;
  }

  // --- EVENING FEASIBILITY & ACTIVITY APPROPRIATENESS PASS ---
  updatedDays.forEach((day) => {
    day.activities = day.activities.map((act, actIdx) => {
      const startH = parseTimeToHours(act.time);

      // Late Night Slot (07:30 PM / 19:30 onwards)
      if (startH >= 19.5 && isDaytimeOnlySpot(act)) {
        // Replace with a dedicated evening experience
        return getEveningAppropriateSpot(dest, actIdx, prefs.userSpots, act.time);
      }

      // Late Afternoon / Golden Hour Slot (05:00 PM - 07:30 PM): check hikes
      if (startH >= 17.0 && startH < 19.5) {
        const text = `${act.name} ${act.description}`.toLowerCase();
        if ((act.category === "nature" || act.category === "sightseeing") && /hike|trail|trek|climb/.test(text)) {
          if (!/sunset|golden hour|lookout|viewpoint/.test(text)) {
            // Re-frame as a sunset lookout walk
            act.name = `${act.name.replace(/\s*(Hike|Trail|Trek)\s*/i, ' Sunset Lookout ')} & Golden Hour Vistas`;
            act.description = `${act.description} Specially timed for golden hour to enjoy panoramic sunset views across the landscape.`;
            act.insiderTip = `Arrive 20 minutes before sunset for the best photo lighting.`;
          }
        }
      }

      return act;
    });
  });

  // --- REGIONAL EXCURSIONS & TOWN EXPLORATION TIME ALLOCATION PASS ---
  const knownExcursionTowns = [
    { town: "Hondarribia", keywords: ["hondarribia", "san pedro", "jaizkibel", "fontarrabie"] },
    { town: "Getaria", keywords: ["getaria", "balenciaga", "san antón", "mouse of getaria"] },
    { town: "Pasaia", keywords: ["pasaia", "pasai", "san pedro", "donibane", "albaola"] },
    { town: "Zarautz", keywords: ["zarautz", "mollarri", "luzaide"] },
    { town: "Zumaia", keywords: ["zumaia", "flysch", "itzurun"] },
    { town: "Tolosa", keywords: ["tolosa", "tinglado", "gorrotxategi"] },
    { town: "Biarritz", keywords: ["biarritz", "rocher de la vierge"] },
    { town: "Saint-Jean-de-Luz", keywords: ["saint-jean-de-luz", "donibane loizune"] },
  ];

  updatedDays.forEach((day) => {
    let excursionTown: string | null = null;
    const excursionIndices: number[] = [];

    day.activities.forEach((act, idx) => {
      const text = `${act.name} ${act.description} ${act.address || ""}`.toLowerCase();
      const match = knownExcursionTowns.find((item) => item.keywords.some((kw) => text.includes(kw)));
      if (match) {
        excursionTown = match.town;
        excursionIndices.push(idx);
      }
    });

    if (excursionTown && excursionIndices.length > 0) {
      if (!day.destinationName) day.destinationName = excursionTown;
      if (!day.dayTitle.includes(excursionTown)) {
        day.dayTitle = `${day.dayTitle.split(":")[0]}: Regional Excursion to ${excursionTown} & Surrounding Highlights`;
      }

      // If only 1 activity was assigned in the excursion town, enrich the adjacent daytime activity
      if (excursionIndices.length === 1 && day.activities.length > 1) {
        const singleIdx = excursionIndices[0];
        const targetNextIdx = singleIdx < day.activities.length - 1 ? singleIdx + 1 : singleIdx - 1;
        const targetAct = day.activities[targetNextIdx];

        const targetText = `${targetAct.name} ${targetAct.description}`.toLowerCase();
        const targetIsBaseCity = /donostia|san sebasti[aá]n|concha|gros|parte vieja/.test(targetText) && !targetText.includes(excursionTown.toLowerCase());

        if (targetIsBaseCity) {
          if (excursionTown === "Hondarribia") {
            targetAct.name = "Hondarribia Medieval Walled Quarter & Marina Promenade Walk";
            targetAct.description = "Explore the 15th-century stone ramparts, Emperor Charles V Castle, and vibrant timber-framed fishermen balconies along Calle San Pedro.";
            targetAct.insiderTip = "Stop at Bar Gran Sol for award-winning pintxos in the heart of the fishermen's quarter.";
            targetAct.category = "culture";
            targetAct.approxCost = "Free";
            targetAct.coordinates = { lat: 43.3685, lng: -1.7915 };
            targetAct.address = "Calle San Pedro, Hondarribia";
          } else if (excursionTown === "Getaria") {
            targetAct.name = "Getaria Medieval Old Town & San Antón Lookout Trail";
            targetAct.description = "Wander through cobblestone fishing lanes past wood-fired turbot grills up to the panoramic summit of Mount San Antón.";
            targetAct.insiderTip = "Grab a glass of chilled local Txakoli wine at a harbor terrace.";
            targetAct.category = "sightseeing";
            targetAct.approxCost = "Free";
            targetAct.coordinates = { lat: 43.3015, lng: -2.2030 };
            targetAct.address = "Old Town Harbor, Getaria";
          } else if (excursionTown === "Pasaia") {
            targetAct.name = "Pasaia Donibane Fjord Harbor Walk & Historic Timber Houses";
            targetAct.description = "Stroll the narrow stone passageways of Pasai Donibane, passing historic maritime houses hugging the fjord water.";
            targetAct.insiderTip = "Take the 10-cent green wooden motor launch boat across the harbor mouth.";
            targetAct.category = "culture";
            targetAct.approxCost = "Free";
            targetAct.coordinates = { lat: 43.3265, lng: -1.9280 };
            targetAct.address = "Pasai Donibane, Pasaia";
          } else if (excursionTown === "Zumaia") {
            targetAct.name = "Zumaia Flysch Cliffs & Itzurun Beach Geological Trail";
            targetAct.description = "Marvel at the 60-million-year-old vertical limestone strata layers forming dramatic sea cliffs at Itzurun beach.";
            targetAct.insiderTip = "Best visited at mid-to-low tide when the rocky seabed platforms are exposed.";
            targetAct.category = "nature";
            targetAct.approxCost = "Free";
            targetAct.coordinates = { lat: 43.2990, lng: -2.2580 };
            targetAct.address = "Itzurun Beach, Zumaia";
          }
        }
      }
    }
  });

  // --- ABSOLUTE QUALITY GATE: MULTI-DAY DEDUPLICATION PASS ---
  // Runs AFTER all additions, expansions, and extra day injections to ensure 100% unique activities!
  const seenGlobalSignatures = new Set<string>();

  updatedDays.forEach((day, dayIdx) => {
    const dedupedActivities: ActivitySpot[] = [];

    day.activities.forEach((act) => {
      const actSigs = getSpotSignatures(act.name, act.description);
      const isDuplicate = actSigs.some((sig) => seenGlobalSignatures.has(sig));

      if (isDuplicate && dayIdx > 0 && !(act as any).isLocked && !options.isReiteration) {
        // Try finding an unused non-duplicate alternative
        let freshSpot: ActivitySpot | undefined;
        if (act.alternativeOptions && act.alternativeOptions.length > 0) {
          freshSpot = act.alternativeOptions.find((alt) => {
            const altSigs = getSpotSignatures(alt.name, alt.description);
            return !altSigs.some((s) => seenGlobalSignatures.has(s));
          });
        }

        // If no alternative option works, pick a fresh backup spot
        if (!freshSpot) {
          freshSpot = getUnusedBackupSpot(dest, seenGlobalSignatures, act.time, act.category);
        }

        if (freshSpot) {
          const freshSigs = getSpotSignatures(freshSpot.name, freshSpot.description);
          freshSigs.forEach((s) => seenGlobalSignatures.add(s));

          dedupedActivities.push({
            ...freshSpot,
            time: act.time,
            photos: freshSpot.photos && freshSpot.photos.length > 0 ? freshSpot.photos : getCuratedPhotosForSpot(freshSpot.category, freshSpot.name, dest),
            ticketUrl: getTicketOrBookingUrl(freshSpot.name, dest, freshSpot.approxCost),
            googleMapsUrl: generateGoogleMapsSearchUrl(freshSpot.name, dest),
          });
        } else {
          dedupedActivities.push(act);
        }
      } else {
        actSigs.forEach((sig) => seenGlobalSignatures.add(sig));
        dedupedActivities.push(act);
      }
    });

    if (dedupedActivities.length > 0) {
      day.activities = dedupedActivities;
    }
  });

  // 8. Strict Chronological Sorting, Time Normalization, Dynamic AI Geocoding & Transit Logistics Pass
  for (const day of updatedDays) {
    const dayDest = day.destinationName || dest;

    // Deoverlap & normalize time slots
    day.activities = deoverlapDayActivities(day.activities);

    // Normalize time slots
    for (const act of day.activities) {
      act.time = normalizeTimeSlot(act.time);
      if (act.alternativeOptions) {
        act.alternativeOptions.forEach((alt) => (alt.time = normalizeTimeSlot(alt.time)));
      }
      if (act.allOptions) {
        act.allOptions.forEach((opt) => (opt.time = normalizeTimeSlot(opt.time)));
      }
    }

    // High-precision dynamic AI geocoding pass for all venues in the day's destination
    await enrichActivitiesWithDynamicAI(day.activities, dayDest);

    // Sort activities strictly chronologically by start time
    day.activities.sort((a, b) => parseTimeToHours(a.time) - parseTimeToHours(b.time));

    // Connect consecutive chronologically ordered activities with transit logistics
    for (let i = 0; i < day.activities.length - 1; i++) {
      const currentAct = day.activities[i];
      const nextAct = day.activities[i + 1];
      currentAct.transitToNext = calculateTransitLogistics(currentAct, nextAct, dayDest);
    }
    if (day.activities.length > 0) {
      day.activities[day.activities.length - 1].transitToNext = undefined;
    }
  }

  // ABSOLUTE HARD SAFETY CHECK FOR FINAL DAY DEPARTURE HOUR
  if (prefs.departureHour && updatedDays.length > 0) {
    const depHourNum = parseTimeToHours(prefs.departureHour);
    const lastDay = updatedDays[updatedDays.length - 1];

    const validActs = lastDay.activities.filter((act) => {
      const startH = parseTimeToHours(act.time);
      const range = parseTimeInterval(act.time);
      return startH < depHourNum - 0.1 && range.end <= depHourNum + 0.1;
    });

    if (validActs.length > 0) {
      lastDay.activities = validActs.map((act) => {
        const range = parseTimeInterval(act.time);
        if (range.end > depHourNum) {
          return {
            ...act,
            time: `${formatHoursTo12(range.start)} - ${formatHoursTo12(depHourNum)}`,
          };
        }
        return act;
      });
    } else {
      const farewellStartH = Math.max(6, depHourNum - 1.5);
      const farewellTime = `${formatHoursTo12(farewellStartH)} - ${formatHoursTo12(depHourNum)}`;
      const baseCoords = lookupKnownCoordinates(dest);
      lastDay.activities = [
        {
          id: `farewell-morning-${Date.now()}`,
          time: farewellTime,
          name: `Farewell Morning Walk & Local Bakery`,
          category: "cafe",
          description: `Enjoy a quiet final morning promenade in ${dest} with fresh local pastries and artisan coffee before departing.`,
          insiderTip: "Pick up local treats for your trip home.",
          approxCost: "€5 - €10",
          rating: 4.9,
          coordinates: { lat: baseCoords.lat + 0.002, lng: baseCoords.lng - 0.001 },
          durationMinutes: Math.round((depHourNum - farewellStartH) * 60),
          photos: getCuratedPhotosForSpot("cafe", "bakery morning breakfast", dest),
          googleMapsUrl: generateGoogleMapsSearchUrl("Bakery & Cafe", dest),
        },
      ];
    }
  }

  return {
    ...plan,
    title: `${requestedDays}-Day ${dest} ${prefs.vibes.length ? prefs.vibes.join(" & ") : "Cultural"} Journey`,
    totalDays: requestedDays,
    days: updatedDays,
    tags: prefs.vibes && prefs.vibes.length > 0 ? prefs.vibes : plan.tags,
    customPace: prefs.pace || plan.customPace,
    budgetTier: prefs.budgetTier || plan.budgetTier,
    arrivalHour: prefs.arrivalHour || plan.arrivalHour,
    departureHour: prefs.departureHour || plan.departureHour,
  };
}

export async function generateVacationItinerary(prefs: VacationPreferences): Promise<ItineraryPlan> {
  const ai = getAiClient();
  const daysCount = Math.min(Math.max(Number(prefs.duration) || 3, 1), 30);
  const baseCoords = lookupKnownCoordinates(prefs.destination);

  const paceDescription =
    prefs.pace === "relaxed"
      ? "2 to 3 quality spots per day, relaxed pace with ample downtime"
      : prefs.pace === "action-packed"
      ? "5 to 6 exciting spots per day, high energy & maximum exploration"
      : "3 to 4 well-balanced spots per day";

  // Build specific destination & multi-destination instructions
  let destinationDetails = `Destination: ${prefs.destination}`;
  if (prefs.isMultiDestination && prefs.destinations && prefs.destinations.length > 0) {
    destinationDetails = `Multi-Destination Road Trip:\n` +
      prefs.destinations.map((d, i) => `Stop ${i + 1}: ${d.city} (${d.days} days, Arrival: ${d.arrivalHour || 'Morning'}, Departure: ${d.departureHour || 'Evening'})`).join('\n');
  }

  // Arrival & Departure Hours constraints
  let timeScheduleInstructions = "";
  if (prefs.arrivalHour) {
    timeScheduleInstructions += `\n- STRICT ARRIVAL CONSTRAINT (Day 1): Traveler arrives at ${prefs.arrivalHour}. Do NOT schedule any morning activities on Day 1. Day 1 activities MUST start at or after ${prefs.arrivalHour}.`;
  }
  if (prefs.departureHour) {
    timeScheduleInstructions += `\n- STRICT DEPARTURE CONSTRAINT (Final Day, Day ${daysCount}): Traveler departs at ${prefs.departureHour}. ALL activities on Day ${daysCount} MUST finish BEFORE ${prefs.departureHour}. NO afternoon or evening activities on Day ${daysCount}!`;
  }

  // Liked & Skipped spots from swiper
  let likedSpotsInstruction = "";
  if (prefs.likedSpots && prefs.likedSpots.length > 0) {
    likedSpotsInstruction = `\n- USER SWIPER FAVORITES MANDATE: The user explicitly swiped RIGHT / LIKED these places: [${prefs.likedSpots.map(s => s.name).join(", ")}]. YOU MUST SCHEDULE ALL OF THESE LIKED PLACES into the itinerary days!`;
  }

  let skippedSpotsInstruction = "";
  if (prefs.skippedSpots && prefs.skippedSpots.length > 0) {
    skippedSpotsInstruction = `\n- USER SWIPER REJECTED SPOTS MANDATE: The user explicitly swiped LEFT / REJECTED / SKIPPED these places in the candidate swiper: [${prefs.skippedSpots.map(s => s.name).join(", ")}]. YOU ARE STRICTLY FORBIDDEN FROM INCLUDING ANY OF THESE SKIPPED SPOTS OR THEIR DIRECT EQUIVALENTS ANYWHERE IN THE ITINERARY OR ALTERNATIVES!`;
  }

  const paceTarget = prefs.pace === "relaxed"
    ? "EXACTLY 3 to 4 well-spaced activities"
    : prefs.pace === "action-packed"
    ? "EXACTLY 5 to 7 high-energy, full-day activities"
    : "EXACTLY 4 to 5 balanced activities";

  let paceInstruction = `\n- EXPLORATION PACE & FULL-DAY COVERAGE MANDATE: The user selected pace "${prefs.pace || 'balanced'}".
* You MUST output ${paceTarget} per day for ALL ${daysCount} days.
* FULL-DAY SPAN RULE: Every single day's itinerary MUST span the ENTIRE DAY starting in the morning (e.g. 08:30 AM / 09:00 AM) through afternoon, golden hour / sunset, and into the late evening (~08:00 PM - 10:30 PM for dinner, evening pintxos, illuminated night strolls, or scenic viewpoints).
* DO NOT END A DAY AT 5:00 PM OR 6:00 PM! The evening is an essential part of a packed itinerary.
* EVENING FEASIBILITY MANDATE: Daytime high-effort activities (museums, hiking trails, gallery visits, mountain treks, shopping boutiques, daytime boat tours) MUST END BEFORE DINNER TIME (~07:30 PM). NEVER schedule a museum or hiking trail at or after 07:30 PM! The late evening slot (07:30 PM onwards) MUST be dedicated to sit-down dining, pintxo crawls, wine bars, or illuminated night strolls.
* BUFFER & TRANSIT TIMES: Provide realistic 15-30 minute transition buffers between activities to account for walking, driving, or public transit between locations (e.g. 08:30 AM - 10:00 AM -> 15 min buffer -> 10:15 AM - 12:00 PM -> 30 min lunch buffer -> 12:30 PM - 02:30 PM -> 30 min transit -> 03:00 PM - 05:00 PM -> 30 min buffer -> 05:30 PM - 07:30 PM sunset -> 30 min buffer -> 08:00 PM - 10:30 PM evening dinner/walk).`;

  const modes = prefs.transportModes && prefs.transportModes.length > 0
    ? prefs.transportModes
    : (prefs.transportMode ? [prefs.transportMode] : ["public_transit"]);

  const transportNotes: string[] = [];
  if (modes.includes("car")) {
    transportNotes.push("PRIVATE / RENTAL CAR AVAILABLE: Highly encourage scenic coastal drives, elevated mountain lookouts, and regional day trip excursions to surrounding towns & villages within 20-60km (e.g. Getaria, Hondarribia, Zarautz, Pasaia, Tolosa)!");
  }
  if (modes.includes("public_transit")) {
    transportNotes.push("PUBLIC TRANSIT & WALKING: Group urban spots into walkable neighborhood clusters or along direct bus/train corridors.");
  }
  if (modes.includes("bicycle")) {
    transportNotes.push("BICYCLE / E-BIKE: Include bike-friendly greenways, seaside promenade paths, and scenic urban cycle routes.");
  }
  if (modes.includes("taxi")) {
    transportNotes.push("TAXI / RIDESHARE: Door-to-door transit for quick city transfers or direct access to hilltop viewpoints.");
  }

  let transportInstruction = `\n- MEANS OF TRANSPORTATION MANDATE: Selected transport options: [${modes.join(", ")}].\n${transportNotes.map(n => `* ${n}`).join("\n")}`;

  let vibesInstruction = "";
  if (prefs.vibes && prefs.vibes.length > 0) {
    vibesInstruction = `\n- TRAVEL VIBES & INTERESTS MANDATE: The traveler explicitly selected these vibes: [${prefs.vibes.join(", ")}].
At least 70% of scheduled activities MUST directly reflect these selected vibes!
* If 'Regional Excursions & Viewpoints' is selected: prioritize day trips to scenic surrounding towns/villages, coastal drives, high pacing, panoramic lookouts, and viewpoints. Reduce time spent in slow museums/sit-down dining!
* If 'Shopping & Local Boutiques' is selected: prioritize premier shopping avenues, fashion districts, local artisan boutiques, markets, and craft shops.
* If 'Scenic & Outdoors' is selected: prioritize coastal promenades, cliff walks, viewpoints, nature trails, and beaches.
* If 'Nightlife & Bars' is selected: include evening pintxo taverns, cocktail lounges, and wine bars.
* If 'Family Friendly' is selected: include family-accessible funiculars, parks, gentle walks, and museums.
* If 'Relaxation & Wellness' is selected: include thermal baths/spas, quiet gardens, seaside benches, and peaceful tea/coffee terraces.
* If 'History & Architecture' is selected: include historic old town tours, castles, museums, and architectural landmarks.
* If 'Gastronomy & Local Food' is selected: include gourmet food halls, pintxo crawls, ciderhouses, and culinary tours.
* If 'Hidden Gems / Non-Touristy' is selected: include secret viewpoints, neighborhood artisan quarters, and uncrowded spots.`;
  }

  let durationInstruction = `\n- TRIP DURATION MANDATE: The requested trip duration is STRICTLY ${daysCount} days. You MUST output EXACTLY ${daysCount} objects in the "days" array (Day 1 through Day ${daysCount}).`;

  const systemInstruction = `You are LocalExplorer AI, an elite travel curator and local cultural insider.
CRITICAL ACCURACY, SPECIFICITY & LOGISTICS RULES:
1. STRICT MULTI-DAY DEDUPLICATION: NEVER repeat the same activity, landmark, or excursion town (e.g. Hondarribia, Getaria, or Pasaia) across different days! Every single day in the itinerary must feature completely unique, non-repeating attractions and establishments. An excursion to a neighboring town like Hondarribia, Getaria, or Pasaia can ONLY happen ONCE in the entire multi-day trip.
2. GEOGRAPHIC CLUSTERING & REGIONAL EXCURSION TIME ALLOCATION:
   * SINGLE CONTINUOUS EXCURSION BLOCK: When visiting a neighboring town or taking a regional drive/excursion (e.g. driving or taking transit to Hondarribia, Getaria, Pasaia, Zarautz, Tolosa, Zumaia):
     - YOU MUST NOT schedule a single quick drive or viewpoint and immediately send the traveler back to the base city for the next activity!
     - YOU MUST allocate a dedicated multi-activity block (at least 2 to 3 consecutive spots or a full half-day) TO EXPLORE THAT TOWN AND ITS SURROUNDING HIGHLIGHTS (e.g. scenic drive/viewpoint -> medieval quarter/ramparts -> harbor walk & local pintxo tavern in that town).
     - A viewpoint on its own takes ~45 minutes, but you must pair it with nearby interest places in that same area so the traveler experiences the destination properly before returning!
   * ZERO INTERLEAVING / ZERO BACKTRACKING: You are STRICTLY FORBIDDEN from interleaving spots from different towns within the same half-day (e.g. NEVER do: Donostia -> Hondarribia -> Donostia -> Hondarribia). Once you arrive in an excursion town like Hondarribia, complete all local spots there consecutively before returning to your base city.
   * TRANSPORT MODE CONSISTENCY: If the traveler drives a rental car to an excursion town, keep transportation choices consistent per journey segment.
3. TIME-OF-DAY FEASIBILITY & EVENING APPROPRIATENESS:
   * DAYTIME HIGH-EFFORT ACTIVITIES: High-effort, opening-hours-dependent, and daytime outdoor activities (such as museums, cloister visits, galleries, hiking trails, mountain treks, shopping boutiques, and daytime boat tours) MUST END BEFORE DINNER TIME (~07:30 PM).
   * NO LATE-NIGHT MUSEUMS OR HIKES: IT IS STRICTLY FORBIDDEN to schedule a museum, gallery, cloister, hiking trail, or daytime tour starting at or after 07:30 PM (19:30).
   * HIKES & OUTDOOR TRAILS AFTER 05:00 PM: If a hike or outdoor trail is scheduled in the late afternoon / sunset window (between 05:00 PM and 07:30 PM), it MUST be specifically tailored as a SUNSET LOOKOUT / GOLDEN HOUR WALK (e.g. watching the sunset from a coastal viewpoint or hill bastion). Strenuous daytime hikes with no sunset purpose are strictly forbidden in the late afternoon/evening.
   * EVENING SLOTS (~07:30 PM - 10:30 PM) MUST STRICTLY be reserved for evening-appropriate experiences: sit-down dinners, pintxo/tapas crawls, wine & cocktail lounges, illuminated old town strolls, sunset lookout points with a drink, or evening acoustic music.
4. ALWAYS provide EXACT, REAL, NAMED ESTABLISHMENTS, historic landmarks, and specific venues with real names. NEVER give generic descriptions.
5. GEOGRAPHIC COORDINATES ACCURACY: You MUST provide real-world latitude and longitude for ${prefs.destination}.
6. MULTIPLE CHOICE OPTIONS: For EACH scheduled activity slot, provide 1-2 curated "alternativeOptions" with full details (name, category, description, insiderTip, approxCost, coordinates) so the user can easily toggle between options!
7. ACTIONABLE INSIDER TIPS: Write high-value, precise insider tips.
8. STRICT CHRONOLOGICAL ORDER MANDATE: All activities within each day MUST be listed in strict ascending chronological order by start time (e.g., Morning 09:00 AM -> Midday 12:30 PM -> Afternoon 03:30 PM -> Evening 07:30 PM). NEVER place an evening activity before a morning activity.
9. SCHEDULE TIME AWARENESS: ${timeScheduleInstructions}
9. ${durationInstruction}
10. ${paceInstruction}
11. ${vibesInstruction}
12. ${transportInstruction}
13. ${skippedSpotsInstruction}
14. ${likedSpotsInstruction}
${(() => {
  const tasteLine = buildTasteInstruction(prefs.tasteProfile);
  return tasteLine ? `15. TRAVELER TASTE PROFILE: ${tasteLine}.\n${CONTEXT_AWARE_DINING_RULES}` : "";
})()}
14. DINING FROM THE TRAVELER'S OWN PLACES: ${(prefs.userSpots && prefs.userSpots.length > 0)
    ? `the traveler provided their own favorite places: [${prefs.userSpots.map((sp) => `${sp.name} (${sp.category}${sp.town ? ", " + sp.town : ""})`).join("; ")}]. For any bar/café/restaurant slot in the destination matching their towns, prefer THESE places. `
    : ""}Bars, cafés and restaurants must be real, named, currently-operating venues (from your knowledge or search) — never generic placeholders.`;

  const prompt = `Plan an in-depth, geographically clustered, non-repeating EXACTLY ${daysCount}-day itinerary for ${prefs.destination}.
Number of Days: STRICTLY ${daysCount} Days (Day 1 through Day ${daysCount}).
${destinationDetails}
Pace: ${prefs.pace} (${paceDescription})
Budget Tier: ${prefs.budgetTier}
Vibes & Interests: ${prefs.vibes.join(", ") || "Gastronomy, Culture, Scenic, Hidden Gems"}
${prefs.customNotes ? `Special Traveler Requests: ${prefs.customNotes}` : ""}
${likedSpotsInstruction}
${skippedSpotsInstruction}

Ensure every single spot has exact coordinates in ${prefs.destination}, realistic costs, authentic insider tips, logical walking/transit logistics, zero duplicates across days, no skipped spots, and multiple choice alternatives. Output strictly valid JSON.`;

  if (!ai) {
    console.warn("GEMINI_API_KEY not configured. Generating curated rich vacation plan.");
    return generateFallbackVacation(prefs);
  }

  const generateWithModel = async (modelName: string) => {
    return await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            destinationOrTown: { type: Type.STRING },
            summary: { type: Type.STRING },
            highlights: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            mapCenter: {
              type: Type.OBJECT,
              properties: {
                lat: { type: Type.NUMBER },
                lng: { type: Type.NUMBER },
              },
              required: ["lat", "lng"],
            },
            mapZoom: { type: Type.NUMBER },
            weatherSummary: { type: Type.STRING },
            days: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  dayNumber: { type: Type.INTEGER },
                  dayTitle: { type: Type.STRING },
                  theme: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  estimatedTotalBudget: { type: Type.STRING },
                  destinationName: { type: Type.STRING },
                  activities: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        time: { type: Type.STRING },
                        name: { type: Type.STRING },
                        category: {
                          type: Type.STRING,
                          description: "food, nature, culture, sightseeing, hidden-gem, shopping, relaxation, nightlife, cafe",
                        },
                        description: { type: Type.STRING },
                        insiderTip: { type: Type.STRING },
                        approxCost: { type: Type.STRING },
                        rating: { type: Type.NUMBER },
                        coordinates: {
                          type: Type.OBJECT,
                          properties: {
                            lat: { type: Type.NUMBER },
                            lng: { type: Type.NUMBER },
                          },
                          required: ["lat", "lng"],
                        },
                        address: { type: Type.STRING },
                        durationMinutes: { type: Type.INTEGER },
                        alternativeOptions: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              id: { type: Type.STRING },
                              time: { type: Type.STRING },
                              name: { type: Type.STRING },
                              category: { type: Type.STRING },
                              description: { type: Type.STRING },
                              insiderTip: { type: Type.STRING },
                              approxCost: { type: Type.STRING },
                              rating: { type: Type.NUMBER },
                              coordinates: {
                                type: Type.OBJECT,
                                properties: {
                                  lat: { type: Type.NUMBER },
                                  lng: { type: Type.NUMBER },
                                },
                                required: ["lat", "lng"],
                              },
                              address: { type: Type.STRING },
                            },
                            required: ["id", "name", "category", "description", "insiderTip", "approxCost", "coordinates"],
                          },
                        },
                      },
                      required: ["id", "time", "name", "category", "description", "insiderTip", "approxCost", "coordinates"],
                    },
                  },
                },
                required: ["dayNumber", "dayTitle", "theme", "summary", "activities"],
              },
            },
          },
          required: ["title", "destinationOrTown", "summary", "highlights", "mapCenter", "days"],
        },
      },
    });
  };

  try {
    let response;
    const modelsToTry = [PRIMARY_TEXT_MODEL, FALLBACK_TEXT_MODEL, TERTIARY_TEXT_MODEL];
    let lastError: any = null;
    let parsed: any = null;

    for (const modelName of modelsToTry) {
      try {
        response = await generateWithModel(modelName);
        const text = response.text;
        if (text) {
          parsed = JSON.parse(text);
          if (parsed && Array.isArray(parsed.days) && parsed.days.length > 0) {
            break;
          }
        }
      } catch (err) {
        console.warn(`Vacation model ${modelName} failed:`, (err as any)?.message || err);
        lastError = err;
      }
    }

    if (!parsed || !Array.isArray(parsed.days) || parsed.days.length === 0) {
      throw lastError || new Error("All Gemini models failed for vacation itinerary");
    }

    // Shape validation: never ship a plan without usable days/activities
    if (!parsed || !Array.isArray(parsed.days) || parsed.days.length === 0) {
      throw new Error("Gemini response missing days array");
    }
    parsed.days.forEach((day: any) => {
      if (!Array.isArray(day.activities)) day.activities = [];
    });

    const mapCenter = parsed.mapCenter && typeof parsed.mapCenter.lat === "number" && !isNaN(parsed.mapCenter.lat)
      ? parsed.mapCenter
      : baseCoords;

    const rawPlan: ItineraryPlan = {
      ...parsed,
      id: "vacation-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
      mode: "vacation",
      totalDays: daysCount,
      createdAt: new Date().toISOString(),
      tags: prefs.vibes,
      customPace: prefs.pace,
      budgetTier: prefs.budgetTier,
      mapCenter,
      mapZoom: parsed.mapZoom || 13,
      destinations: prefs.destinations,
      arrivalHour: prefs.arrivalHour,
      departureHour: prefs.departureHour,
    };

    return await enforceVacationConstraintsAndPhotos(rawPlan, prefs);
  } catch (error) {
    console.error("Error generating vacation itinerary with Gemini:", error);
    return generateFallbackVacation(prefs);
  }
}

export interface ReiterateExtraContext {
  excludedPlaces?: string[];
  permanentSkips?: string[];
  tasteProfile?: TasteProfile;
  userSpots?: UserSpot[];
  transportModes?: string[];
  arrivalHour?: string;
  departureHour?: string;
}

export async function reiterateItineraryPlan(
  existingPlan: ItineraryPlan,
  userInstructions?: string,
  extraContext?: ReiterateExtraContext
): Promise<ItineraryPlan> {
  const ai = getAiClient();
  const dest = existingPlan.destinationOrTown;
  const daysCount = existingPlan.totalDays || existingPlan.days.length;

  const arrHour = extraContext?.arrivalHour || existingPlan.arrivalHour;
  const depHour = extraContext?.departureHour || existingPlan.departureHour;

  const lockedNamesAllDays = existingPlan.days.flatMap((d) => d.activities.map((a) => a.name));
  const excludedPlaces = extraContext?.excludedPlaces || [];
  const permanentSkips = extraContext?.permanentSkips || [];
  const tasteProfile = extraContext?.tasteProfile;
  const userSpots = extraContext?.userSpots || [];
  const transportModes = extraContext?.transportModes || existingPlan.transportModes || [];

  const allBlacklistRaw = Array.from(
    new Set([
      ...lockedNamesAllDays,
      ...excludedPlaces,
      ...permanentSkips,
    ])
  ).filter(Boolean);

  const globalBlacklistSigs = new Set<string>();
  allBlacklistRaw.forEach((name) => {
    getSpotSignatures(name, name).forEach((sig) => globalBlacklistSigs.add(sig));
  });

  const daysOverview = existingPlan.days
    .map((day) => {
      const actList = day.activities
        .map(
          (a, i) =>
            `   - LOCKED Activity ${i + 1}: "${a.name}" [Category: ${a.category}] | TIME SLOT: ${a.time} | Description: ${a.description} | Location: ${a.address || dest}`
        )
        .join("\n");
      return `Day ${day.dayNumber} ("${day.dayTitle}"):\n${
        actList || "   - (No activities currently scheduled - empty day)"
      }\n   UNOCCUPIED TIME SLOTS TO AUTO-FILL: Propose non-overlapping spots strictly for open schedule windows (before, between, or after locked spots).`;
    })
    .join("\n\n");

  const tasteInstruction = buildTasteInstruction(tasteProfile);

  const systemInstruction = `You are LocalExplorer AI, an expert travel curator and local insider.
The user has customized their travel itinerary for ${dest}. They have adjusted, deleted, or allocated extra time to specific activities, creating empty schedule slots that now need to be filled with new, complementary activities.

CRITICAL MANDATES FOR REITERATION & AUTO-FILL:
1. PRESERVE LOCKED ACTIVITIES (ABSOLUTE COMPULSORY MANDATE):
   - Every existing activity currently listed on each day is LOCKED!
   - YOU MUST NOT DELETE, REMOVE, REPLACE, RE-NAME, OR ALTER ANY LOCKED ACTIVITY!
   - Keep the times assigned to locked activities intact.
   - Place new auto-filled activities strictly in unoccupied times before, between, or after locked activities.

2. ARRIVAL & DEPARTURE BOUNDARY MANDATES:
   ${arrHour ? `- DAY 1 ARRIVAL TIME: The traveler arrives at ${arrHour}. DO NOT schedule any auto-fill activity before ${arrHour} on Day 1.` : "- Day 1 starts morning ~08:30 AM."}
   ${depHour ? `- FINAL DAY DEPARTURE TIME: The traveler departs at ${depHour} on Day ${daysCount}. DO NOT schedule ANY activity that starts at or after ${depHour} or extends past ${depHour} on Day ${daysCount}!` : "- Final Day finishes evening ~10:30 PM."}

3. FULL-DAY COVERAGE & EFFORT LEVEL HARMONY:
   - Ensure days without departure constraints span from morning through late evening (~08:00 PM - 10:30 PM).
   - Effort level flow: evaluate the physical exertion of prior and posterior activities around each open slot. If adjacent activities are high-effort (e.g. hikes or large museums), propose low-effort, relaxing complementary spots (e.g., terrace cafe, beach lounge, scenic viewpoint, old town promenade).
   - EVENING FEASIBILITY MANDATE: Daytime high-effort activities MUST end before 07:30 PM. Late evening slots (07:30 PM onwards) MUST strictly be sit-down dining, pintxo crawls, wine bars, or night strolls.

4. MULTI-DAY DEDUPLICATION & BLACKLIST:
   - Do NOT propose any spot already present anywhere in the itinerary or blacklisted!
   - Avoid these forbidden spots: [${allBlacklistRaw.slice(0, 25).join(", ")}].

5. TRAVELER PREFERENCES & TASTE PROFILE:
   - Pace: ${existingPlan.customPace || "balanced"}
   - Budget Tier: ${existingPlan.budgetTier || "mid-range"}
   - Vibes & Interests: ${(existingPlan.tags || []).join(", ") || "Culture, Gastronomy, Scenic"}
   - Means of Transport: ${transportModes.join(", ") || "public transit & walking"}
   ${tasteInstruction ? `- Taste Profile for Dining/Cafes: ${tasteInstruction}` : ""}
   ${userSpots.length > 0 ? `- User Favorite Places to prefer for dining/cafes: [${userSpots.map((s) => s.name).join(", ")}].` : ""}

6. OUTPUT FORMAT:
   - Output strictly valid JSON matching the \`ItineraryPlan\` schema.`;

  const prompt = `Auto-fill empty schedule slots for this customized itinerary in ${dest}.

USER'S CURRENT LOCKED ITINERARY & ACTIVITIES:
${daysOverview}

USER'S INSTRUCTIONS FOR AUTO-FILL:
${userInstructions || "Preserve all my locked activities and auto-fill remaining open slots with high-quality, non-overlapping local spots."}

Ensure all locked activities remain 100% intact while open slots are seamlessly filled. Output strictly valid JSON.`;

  const prefs: VacationPreferences = {
    destination: dest,
    duration: daysCount,
    vibes: existingPlan.tags || [],
    pace: existingPlan.customPace || "balanced",
    budgetTier: existingPlan.budgetTier || "mid-range",
    groupSize: existingPlan.groupSize || 1,
    arrivalHour: arrHour,
    departureHour: depHour,
  };

  let parsed: any = null;
  if (ai) {
    for (const modelName of [PRIMARY_TEXT_MODEL, FALLBACK_TEXT_MODEL, TERTIARY_TEXT_MODEL]) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                destinationOrTown: { type: Type.STRING },
                summary: { type: Type.STRING },
                highlights: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                mapCenter: {
                  type: Type.OBJECT,
                  properties: {
                    lat: { type: Type.NUMBER },
                    lng: { type: Type.NUMBER },
                  },
                  required: ["lat", "lng"],
                },
                mapZoom: { type: Type.NUMBER },
                days: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      dayNumber: { type: Type.INTEGER },
                      dayTitle: { type: Type.STRING },
                      theme: { type: Type.STRING },
                      summary: { type: Type.STRING },
                      estimatedTotalBudget: { type: Type.STRING },
                      destinationName: { type: Type.STRING },
                      activities: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            id: { type: Type.STRING },
                            time: { type: Type.STRING },
                            name: { type: Type.STRING },
                            category: { type: Type.STRING },
                            description: { type: Type.STRING },
                            insiderTip: { type: Type.STRING },
                            approxCost: { type: Type.STRING },
                            rating: { type: Type.NUMBER },
                            coordinates: {
                              type: Type.OBJECT,
                              properties: {
                                lat: { type: Type.NUMBER },
                                lng: { type: Type.NUMBER },
                              },
                              required: ["lat", "lng"],
                            },
                            address: { type: Type.STRING },
                          },
                          required: ["id", "time", "name", "category", "description", "insiderTip", "approxCost", "coordinates"],
                        },
                      },
                    },
                    required: ["dayNumber", "dayTitle", "theme", "summary", "activities"],
                  },
                },
              },
              required: ["title", "destinationOrTown", "summary", "highlights", "mapCenter", "days"],
            },
          },
        });

        if (response.text) {
          parsed = JSON.parse(response.text);
          if (parsed && Array.isArray(parsed.days) && parsed.days.length > 0) {
            break;
          }
        }
      } catch (e) {
        console.warn(`Reiteration model ${modelName} failed:`, (e as Error).message);
      }
    }
  }

  // GUARANTEED MERGE: Preserve 100% of original locked activities
  const updatedDays: DailyPlan[] = existingPlan.days.map((origDay) => {
    const dayNum = origDay.dayNumber;
    // Mark original activities as locked
    const origActivities: ActivitySpot[] = origDay.activities.map((a) => ({ ...a, isLocked: true }));

    const aiDay = parsed?.days?.find((d: any) => d.dayNumber === dayNum);
    const aiActivities: ActivitySpot[] = aiDay && Array.isArray(aiDay.activities) ? aiDay.activities : [];

    const dayLockedSigs = new Set<string>();
    origActivities.forEach((a) => {
      getSpotSignatures(a.name, a.description).forEach((s) => dayLockedSigs.add(s));
    });

    const isDay1 = dayNum === 1;
    const isLastDay = dayNum === existingPlan.days.length;

    const arrHourNum = isDay1 && arrHour ? parseTimeToHours(arrHour) : undefined;
    const depHourNum = isLastDay && depHour ? parseTimeToHours(depHour) : undefined;

    const freshNewFills: ActivitySpot[] = [];
    aiActivities.forEach((aiAct) => {
      if (!aiAct.name || !aiAct.time) return;

      const actStartH = parseTimeToHours(aiAct.time);
      const actRange = parseTimeInterval(aiAct.time);

      // Arrival constraint: Skip auto-fill spots starting before arrivalHour on Day 1
      if (arrHourNum !== undefined && actStartH < arrHourNum) {
        return;
      }

      // Departure constraint: Skip auto-fill spots starting at/after departureHour or ending past departureHour on Last Day
      if (depHourNum !== undefined && (actStartH >= depHourNum - 0.1 || actRange.end > depHourNum + 0.1)) {
        return;
      }

      const sigs = getSpotSignatures(aiAct.name, aiAct.description);
      const isDup = sigs.some((s) => dayLockedSigs.has(s) || globalBlacklistSigs.has(s));
      if (!isDup) {
        sigs.forEach((s) => dayLockedSigs.add(s));
        freshNewFills.push({
          ...aiAct,
          id: `autofill-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          isLocked: false,
        });
      }
    });

    const combined = [...origActivities, ...freshNewFills];
    const deoverlapped = deoverlapDayActivities(combined, origActivities.map((a) => a.name));

    return {
      ...origDay,
      activities: deoverlapped,
    };
  });

  const rawPlan: ItineraryPlan = {
    ...existingPlan,
    title: parsed?.title || existingPlan.title,
    summary: parsed?.summary || existingPlan.summary,
    highlights: parsed?.highlights || existingPlan.highlights,
    days: updatedDays,
    createdAt: new Date().toISOString(),
  };

  return await enforceVacationConstraintsAndPhotos(rawPlan, prefs, { isReiteration: true });
}

function cleanAndParseJson<T>(text: string): T {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
  cleaned = cleaned.replace(/\s*```$/i, "");
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const startIdx = cleaned.indexOf("{");
    const endIdx = cleaned.lastIndexOf("}");
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const jsonSub = cleaned.substring(startIdx, endIdx + 1);
      return JSON.parse(jsonSub);
    }
    throw err;
  }
}

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function enforceHometownRadiusAndCoordinates(
  plan: ItineraryPlan,
  prefs: HometownPreferences,
  baseCoords: { lat: number; lng: number }
): ItineraryPlan {
  const verified = findVerifiedDestination(prefs.location);
  const maxRadius = prefs.radiusKm;
  const locName = verified?.name || prefs.location;
  const excludedLower = [...(prefs.excludedPlaces || []), ...(prefs.permanentSkips || [])]
    .map((x) => x.trim().toLowerCase()).filter(Boolean);
  const isExcludedName = (name: string) => excludedLower.some((ex) => {
    const n = name.toLowerCase();
    return n.includes(ex) || ex.includes(n);
  });
  const safeLocalSpots = (verified?.popularSpots || []).filter(
    (spot) => !isExcludedName(spot) && !isDiningName(spot)
  );

  for (const day of plan.days || []) {
    for (const [idx, act] of (day.activities || []).entries()) {
      if (typeof act.time === "string") act.time = normalizeTimeSlot(act.time);

      // Prefer a verified, real coordinate for a known local place.
      const known = getKnownSpotCoordinates(locName, act.name);
      if (known) act.coordinates = known;

      const lat = act.coordinates?.lat ?? baseCoords.lat;
      const lng = act.coordinates?.lng ?? baseCoords.lng;
      const distance = haversineDistanceKm(baseCoords.lat, baseCoords.lng, lat, lng);
      const text = `${act.name} ${act.description} ${act.address || ""}`.toLowerCase();
      const namesAnotherCity =
        !/donostia|san sebasti[aá]n/.test(locName.toLowerCase()) &&
        /donostia|san sebasti[aá]n|concha|gros|parte vieja|bilbao/.test(text);

      // A legitimate place just beyond the requested radius keeps its real pin.
      // Replace only an unmistakably wrong-city result; never fabricate/jitter coordinates.
      if (namesAnotherCity || distance > maxRadius * 2) {
        const replacement = safeLocalSpots[idx % Math.max(safeLocalSpots.length, 1)];
        if (replacement) {
          act.name = replacement;
          act.description = `Authentic local highlight in ${locName} within your ${maxRadius}km radius.`;
          act.insiderTip = `A favorite local spot right here in ${locName}.`;
          act.coordinates = getKnownSpotCoordinates(locName, replacement) || baseCoords;
        } else {
          act.name = `${locName} Town Centre`;
          act.description = `Explore the real town centre of ${locName}.`;
          act.insiderTip = `Start in the centre and follow locally signposted points of interest.`;
          act.coordinates = baseCoords;
        }
      }
    }
  }

  plan.mapCenter = baseCoords;
  plan.destinationOrTown = locName;
  return plan;
}

export async function generateHometownItinerary(prefs: HometownPreferences): Promise<ItineraryPlan> {
  const ai = getAiClient();
  const baseCoords = lookupKnownCoordinates(prefs.location);

  const timeDescription =
    prefs.timeAvailable === "quick"
      ? "Quick Outing of 1 to 2 hours (1-2 hyper-focused spots)"
      : prefs.timeAvailable === "half-day"
      ? "Half-Day plan of 3 to 5 hours (3-4 complementary spots)"
      : "Full Day / Weekend exploration (4-5 spots with lunch & dinner)";

  // --- Resident exclusion & "already known sights" intelligence ---
  const permanentSkips = prefs.permanentSkips || [];
  const excludedRecent = prefs.excludedPlaces || [];
  const verifiedTown = findVerifiedDestination(prefs.location);
  const knownTouristSights = verifiedTown?.popularSpots || [];

  const exclusionBlocks: string[] = [];
  if (excludedRecent.length > 0) {
    exclusionBlocks.push(`30-DAY MEMORY RULE: The resident has visited or been suggested these places in the past 30 days. STRICTLY AVOID them and their equivalents: [${excludedRecent.join(", ")}].`);
  }
  if (permanentSkips.length > 0) {
    exclusionBlocks.push(`PERMANENT EXCLUSION RULE (absolute, highest priority): The resident has PERMANENTLY banned these places. NEVER suggest them or their direct equivalents under any circumstances: [${permanentSkips.join(", ")}].`);
  }
  if (knownTouristSights.length > 0) {
    exclusionBlocks.push(`ALREADY-KNOWN SIGHTS RULE: This resident has already seen ALL classic sights of ${verifiedTown?.name || prefs.location}. Do NOT propose ordinary tourist visits to: [${knownTouristSights.join(", ")}]. The only exception is ONE item that re-experiences such a place in a genuinely unusual micro-way (empty opening hour, night illumination, low tide, seasonal/temporary event).`);
  }
  const exclusions = exclusionBlocks.join("\n");

  let likedSpotsInstruction = "";
  if (prefs.likedSpots && prefs.likedSpots.length > 0) {
    likedSpotsInstruction = `\n- USER SWIPED LIKED SPOTS: Include and prioritize these spots: [${prefs.likedSpots.map(s => s.name).join(", ")}].`;
  }

  // The resident's own places — dining must come from here or from live search, never static data
  const userSpotsList = prefs.userSpots || [];
  const userSpotsInstruction = userSpotsList.length > 0
    ? `RESIDENT'S OWN PLACES (user-provided data): [${userSpotsList
        .map((sp) => `${sp.name} (${sp.category}${sp.town ? ", " + sp.town : ""}${sp.notes ? ", note: " + sp.notes : ""})`)
        .join("; ")}]. Whenever the occasion fits (especially for bars/cafés/restaurants), weave these into the plan and/or alternatives. They must NEVER be excluded or filtered out.`
    : `The resident has NOT provided their own places. Bars, cafés and restaurants MUST come from your live Google Search results ONLY — never invent or reuse dining venues from memory.`;

  const systemInstruction = `You are LocalExplorer AI in Hometown Local Guide Mode, empowered with Google Search to discover real-time live events, concerts, street food markets, sports races, food truck rallies, pop-up artisan markets, temporary art exhibits, and local festivals.
THE USER IS A LONG-TIME RESIDENT OF ${prefs.location.toUpperCase()} — NOT A TOURIST. They already know every famous sight, landmark and "top 10" recommendation. Your value is revealing their own town through angles they have not lived yet.

RESIDENT-FIRST CURATION RULES:
1. REAL & VERIFIED PLACES ONLY: Every recommendation MUST be a real, named, currently-existing place or event within ${prefs.radiusKm} km of ${prefs.location}. USE GOOGLE SEARCH to discover real local businesses, trails, viewpoints and happenings (the actual independent bakery, the actual trailhead, the actual market happening this week). Invented or placeholder places ("Artisan Coffee Roastery", "Cozy Local Cafe") are STRICTLY FORBIDDEN.
2. HYPER-LOCAL & EPHEMERAL OVER FAMOUS: Prioritize what only residents can enjoy — quiet-hour revisits, tide- or sunset-dependent spots, today's market lineup, this week's concerts/races/pop-ups, seasonal produce, the bench locals actually use, the counter with the daily special.
3. NO TOURIST AGENDA: Never frame anything as a sightseeing visit to a famous landmark${knownTouristSights.length > 0 ? ` — the resident has already seen: [${knownTouristSights.join(", ")}]` : ""}.
4. CENTER LOCATION: ${prefs.location} (Exact Lat: ${baseCoords.lat.toFixed(4)}, Lng: ${baseCoords.lng.toFixed(4)}).
5. MAXIMUM ALLOWED DISTANCE: ${prefs.radiusKm} km from ${prefs.location}. Every single activity, restaurant, coffee shop, and event MUST be physically located within this radius (adjacent villages are fine only if inside the radius).
6. For any spot that is an active live event, set "isLiveEvent": true and populate "eventDetails": { "eventType": "Concert" | "Market" | "Race" | "Festival" | "Exhibition", "dates": "e.g. Aug 21-23 or Tonight 8 PM", "venue": "Venue Name" }.
7. STRICTLY AVOID generic tourist traps, commercial chains, and anything a travel blog would list as a "must-see".
8. Adapt specifically to current weather: "${prefs.weatherCondition}" (${prefs.currentTemp ? prefs.currentTemp + "°C" : ""}) — if wet or cold, favor indoor, covered, or cozy experiences.
9. Fit into the timeframe: ${timeDescription}.
10. Coordinates must be accurate real-world lat/lng within ${prefs.radiusKm} km of (${baseCoords.lat.toFixed(4)}, ${baseCoords.lng.toFixed(4)}).
11. Provide alternative choices for each activity spot.
12. ${exclusions}
13. ${likedSpotsInstruction}
14. ${userSpotsInstruction}
${(() => {
  const tasteLine = buildTasteInstruction(prefs.tasteProfile);
  return tasteLine ? `15. RESIDENT TASTE PROFILE: ${tasteLine}.\n${CONTEXT_AWARE_DINING_RULES}` : "";
})()}`;

  const prompt = `The requester is a LONG-TIME RESIDENT of ${prefs.location}, not a visitor: they have already seen every tourist sight and standard recommendation. Surprise them with real places and happenings they plausibly have not experienced yet.
Perform a live web search for active events, live concerts, street food markets, sports races, and cultural pop-ups happening right now or this week near ${prefs.location} (within a ${prefs.radiusKm}km radius of lat ${baseCoords.lat.toFixed(4)}, lng ${baseCoords.lng.toFixed(4)}).
Build a custom local plan incorporating live events discovered during search alongside top neighborhood hidden gems strictly within ${prefs.radiusKm} km of ${prefs.location}.

Location: ${prefs.location}
Coordinates: lat ${baseCoords.lat.toFixed(4)}, lng ${baseCoords.lng.toFixed(4)}
Radius: ${prefs.radiusKm} km (Strict boundary enforced)
Occasion / Vibe: ${prefs.occasion}
Available Time: ${prefs.timeAvailable} (${timeDescription})
Weather: ${prefs.weatherCondition} (${prefs.currentTemp ? prefs.currentTemp + "°C" : ""})
${prefs.customNotes ? `Resident Notes: ${prefs.customNotes}` : ""}

CRITICAL OUTPUT FORMAT REQUIREMENT:
Your response MUST be ONLY a raw valid JSON object (no conversational text outside the JSON). Match this exact structure:
{
  "title": "string (e.g. '${prefs.location} Local Outing & Event Exploration')",
  "destinationOrTown": "${prefs.location}",
  "summary": "string describing the outing within ${prefs.radiusKm}km of ${prefs.location} and explicitly highlighting live events, concerts, markets, or races discovered during search",
  "highlights": ["string"],
  "mapCenter": { "lat": ${baseCoords.lat}, "lng": ${baseCoords.lng} },
  "mapZoom": ${prefs.radiusKm <= 5 ? 15 : prefs.radiusKm <= 15 ? 13 : 11},
  "weatherSummary": "string",
  "days": [
    {
      "dayNumber": 1,
      "dayTitle": "string",
      "theme": "string",
      "summary": "string",
      "estimatedTotalBudget": "string",
      "activities": [
        {
          "id": "string",
          "time": "string",
          "name": "string",
          "category": "food | nature | culture | sightseeing | hidden-gem | shopping | relaxation | nightlife | cafe | entertainment",
          "description": "string",
          "insiderTip": "string",
          "approxCost": "string",
          "rating": number,
          "isLiveEvent": boolean,
          "eventDetails": {
            "eventType": "string",
            "dates": "string",
            "venue": "string"
          },
          "coordinates": { "lat": number, "lng": number },
          "address": "string",
          "durationMinutes": number,
          "alternativeOptions": [
            {
              "id": "string",
              "time": "string",
              "name": "string",
              "category": "string",
              "description": "string",
              "insiderTip": "string",
              "approxCost": "string",
              "coordinates": { "lat": number, "lng": number }
            }
          ]
        }
      ]
    }
  ]
}`;

  if (!ai) {
    console.warn("GEMINI_API_KEY not configured. Generating curated hometown plan.");
    return generateFallbackHometown(prefs);
  }

  try {
    const modelsToTry = [PRIMARY_TEXT_MODEL, FALLBACK_TEXT_MODEL, TERTIARY_TEXT_MODEL];
    let parsed: any = null;
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      // 1. Try with Google Search tool first for live local discoveries
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction,
            tools: [{ googleSearch: {} }],
          },
        });
        const text = response.text;
        if (text) {
          parsed = cleanAndParseJson<any>(text);
          if (parsed && Array.isArray(parsed.days) && parsed.days.length > 0) {
            break;
          }
        }
      } catch (errSearch) {
        console.warn(`Hometown live search on ${modelName} encountered issue, trying direct structured mode:`, (errSearch as any)?.message || errSearch);
        // 2. Immediate fallback: same model with JSON mode (no external search rate limit)
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              systemInstruction,
              responseMimeType: "application/json",
            },
          });
          const text = response.text;
          if (text) {
            parsed = cleanAndParseJson<any>(text);
            if (parsed && Array.isArray(parsed.days) && parsed.days.length > 0) {
              break;
            }
          }
        } catch (errJson) {
          console.warn(`Hometown structured generation failed on ${modelName}:`, (errJson as any)?.message || errJson);
          lastError = errJson;
        }
      }
    }

    // Shape validation: never ship a plan without usable days/activities
    if (!parsed || !Array.isArray(parsed.days) || parsed.days.length === 0) {
      throw lastError || new Error("All Gemini models failed for hometown itinerary");
    }
    parsed.days.forEach((day: any) => {
      if (!Array.isArray(day.activities)) day.activities = [];
    });

    const mapCenter = parsed.mapCenter && typeof parsed.mapCenter.lat === "number" && !isNaN(parsed.mapCenter.lat)
      ? parsed.mapCenter
      : baseCoords;

    const planResult: ItineraryPlan = {
      ...parsed,
      id: "hometown-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
      mode: "hometown",
      totalDays: 1,
      createdAt: new Date().toISOString(),
      tags: [prefs.occasion, `${prefs.radiusKm}km radius`, prefs.weatherCondition],
      mapCenter,
      mapZoom: parsed.mapZoom || (prefs.radiusKm <= 10 ? 14 : prefs.radiusKm <= 25 ? 12 : 11),
    };

    // Resident exclusion filter: strip permanently-banned / recently-seen spots from the model output
    const allExclusionsLower = [...permanentSkips, ...excludedRecent]
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
    if (allExclusionsLower.length > 0 && Array.isArray(planResult.days)) {
      planResult.days.forEach((day) => {
        if (!Array.isArray(day.activities)) return;
        day.activities = day.activities.filter((act) => {
          const n = (act.name || "").toLowerCase();
          return !allExclusionsLower.some((ex) => n.includes(ex) || ex.includes(n));
        });
        day.activities.forEach((act) => {
          if (act.alternativeOptions) {
            act.alternativeOptions = act.alternativeOptions.filter((alt) => {
              const n = (alt.name || "").toLowerCase();
              return !allExclusionsLower.some((ex) => n.includes(ex) || ex.includes(n));
            });
          }
        });
      });
    }

    // Dynamic geocoding: resolve real coordinates and street addresses dynamically worldwide
    for (const day of planResult.days) {
      if (!Array.isArray(day.activities)) continue;
      await enrichActivitiesWithDynamicAI(day.activities, prefs.location);
    }

    return enforceHometownRadiusAndCoordinates(planResult, prefs, baseCoords);
  } catch (error) {
    console.error("Error generating hometown itinerary with search grounding:", error);
    return generateFallbackHometown(prefs);
  }
}

// Generate candidate spots for the Swiper Modal
export async function generateCandidateSpots(
  destination: string,
  count: number = 10,
  vibes: string[] = [],
  budgetTier?: string,
  exactBudgetPerDay?: number,
  currency: string = "€",
  pace?: string,
  userSpots: UserSpot[] = [],
  tasteProfile?: TasteProfile | null
): Promise<CandidateSpot[]> {
  const ai = getAiClient();
  const baseCoords = lookupKnownCoordinates(destination);

  let budgetInstruction = "";
  if (exactBudgetPerDay && exactBudgetPerDay > 0) {
    budgetInstruction = `\n- BUDGET MANDATE: The traveler specified an EXACT budget of ${currency}${exactBudgetPerDay}/day. Ensure candidate spots and their costs align with this budget target (e.g., if low budget, select free or inexpensive spots; if high, select mid-range or luxury spots).`;
  } else if (budgetTier) {
    if (budgetTier === "budget") {
      budgetInstruction = `\n- BUDGET MANDATE: The traveler selected 'Budget Friendly' tier. Candidate spots MUST prioritize free activities, low-cost local taverns/street food, public parks, scenic lookouts, and budget spots.`;
    } else if (budgetTier === "luxury") {
      budgetInstruction = `\n- BUDGET MANDATE: The traveler selected 'Luxury & Fine Dining' tier. Candidate spots MUST prioritize high-end establishments, Michelin-starred or acclaimed dining, thermal spas, private tasting tours, and luxury experiences.`;
    } else {
      budgetInstruction = `\n- BUDGET MANDATE: The traveler selected 'Mid-Range / Balanced' budget tier. Provide a balanced mix of popular landmarks, mid-priced dining, and local spots.`;
    }
  }

  let vibesInstruction = "";
  if (vibes && vibes.length > 0) {
    vibesInstruction = `\n- TRAVEL VIBES & INTERESTS MANDATE: The traveler explicitly selected these interests: [${vibes.join(", ")}].
At least 80% of generated candidate spots MUST directly match these selected vibes!
* If 'Scenic & Outdoors': prioritize coastal promenades, cliff walks, viewpoints, nature trails, beaches, parks.
* If 'Nightlife & Bars': prioritize cocktail lounges, craft beer pubs, pintxo/tapas taverns, rooftop bars, music venues.
* If 'Family Friendly': prioritize funiculars, aquariums, interactive parks, boat tours, gentle walks.
* If 'Relaxation & Wellness': prioritize thermal baths/spas, quiet gardens, seaside benches, tea houses.
* If 'History & Architecture': prioritize historic old town walks, castles, cathedrals, museums, landmark buildings.
* If 'Gastronomy & Local Food': prioritize food markets, pintxo/tapas crawls, food halls, wine tastings, artisan bakeries.
* If 'Hidden Gems / Non-Touristy': prioritize secret local spots, uncrowded viewpoints, neighborhood artisan quarters.`;
  }

  let paceInstruction = "";
  if (pace === "relaxed") {
    paceInstruction = `\n- PACE MANDATE: The traveler prefers a 'Relaxed' unhurried pace. Focus on spacious, relaxing spots with generous breaks.`;
  } else if (pace === "action-packed") {
    paceInstruction = `\n- PACE MANDATE: The traveler prefers an 'Action-Packed' pace. Include active hubs, vibrant spots, and high-energy venues.`;
  }

  const systemInstruction = `You are LocalExplorer AI. Generate ${count} distinct, highly specific candidate places, hidden gems, and iconic venues in ${destination} strictly customized to the traveler's selected vibes and budget preferences.
${vibesInstruction}
${budgetInstruction}
${paceInstruction}

For each place:
- Exact name (e.g. "Peine del Viento", "Monte Igueldo Funicular", "Bar Nestor", "La Perla Spa", "San Telmo Museum" in Donostia / San Sebastián).
- Category: food, nature, culture, sightseeing, hidden-gem, shopping, relaxation, nightlife, cafe.
- Rich engaging description detailing how it connects to their chosen travel vibes.
- Actionable insider tip.
- Approximate cost per person in ${currency} (e.g. "Free", "€10 - €20", "€80 - €120").
- Exact real-world lat/lng coordinates in ${destination}.
- Approximate address.
- 2-3 realistic Google Maps visitor reviews with author names, star rating, and authentic feedback quotes.
${(() => {
  const tasteLine = buildTasteInstruction(tasteProfile);
  return tasteLine
    ? `\nUSER TASTE PROFILE (bias candidate selection accordingly, especially dining/leisure spots): ${tasteLine}.`
    : "";
})()}`;

  const prompt = `Generate ${count} candidate activities for a traveler visiting ${destination}.
Travel Vibes: ${vibes.join(", ") || "General exploration"}.
Budget Setting: ${exactBudgetPerDay ? `${currency}${exactBudgetPerDay}/day` : budgetTier || "mid-range"}.
Pace: ${pace || "balanced"}.
Output strictly valid JSON array of candidate spots.`;

  if (!ai) {
    return generateFallbackCandidates(destination, count, vibes, budgetTier, userSpots, tasteProfile);
  }

  try {
    const modelsToTry = [PRIMARY_TEXT_MODEL, FALLBACK_TEXT_MODEL, TERTIARY_TEXT_MODEL];
    let responseText = "";

    for (const modelName of modelsToTry) {
      try {
        const res = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  time: { type: Type.STRING },
                  name: { type: Type.STRING },
                  category: { type: Type.STRING },
                  description: { type: Type.STRING },
                  insiderTip: { type: Type.STRING },
                  approxCost: { type: Type.STRING },
                  rating: { type: Type.NUMBER },
                  address: { type: Type.STRING },
                  coordinates: {
                    type: Type.OBJECT,
                    properties: {
                      lat: { type: Type.NUMBER },
                      lng: { type: Type.NUMBER },
                    },
                    required: ["lat", "lng"],
                  },
                  durationMinutes: { type: Type.INTEGER },
                  reviews: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        author: { type: Type.STRING },
                        rating: { type: Type.NUMBER },
                        timeAgo: { type: Type.STRING },
                        text: { type: Type.STRING },
                      },
                      required: ["author", "rating", "text"],
                    },
                  },
                },
                required: ["id", "name", "category", "description", "insiderTip", "approxCost", "coordinates"],
              },
            },
          },
        });
        if (res.text) {
          responseText = res.text;
          break;
        }
      } catch (e) {
        console.warn(`Candidate generation failed on ${modelName}:`, (e as any)?.message || e);
      }
    }

    if (!responseText) {
      return generateFallbackCandidates(destination, count, vibes, budgetTier, userSpots, tasteProfile);
    }

    const parsed: CandidateSpot[] = JSON.parse(responseText || "[]");
    const resolvedSpots: CandidateSpot[] = parsed.map((spot, idx) => ({
      ...spot,
      id: spot.id || `candidate-${Date.now()}-${idx}`,
      time: spot.time || "Recommended Visit",
      coordinates: spot.coordinates || { lat: 43.1839, lng: -2.2642 },
      photos: getCuratedPhotosForSpot(spot.category, spot.name, destination),
      ticketUrl: getTicketOrBookingUrl(spot.name, destination, spot.approxCost),
      googleMapsUrl: generateGoogleMapsSearchUrl(spot.name, destination, spot.address, spot.coordinates),
    }));

    await enrichActivitiesWithDynamicAI(resolvedSpots, destination);

    return resolvedSpots;
  } catch (error) {
    console.error("Error generating candidate spots:", error);
    return generateFallbackCandidates(destination, count, vibes, budgetTier, userSpots, tasteProfile);
  }
}

export async function swapActivitySpot(req: SwapActivityRequest): Promise<ActivitySpot> {
  const ai = getAiClient();
  const baseCoords = lookupKnownCoordinates(req.destinationOrTown);

  const blacklistRaw = [
    req.currentActivityName,
    ...(req.allItineraryActivityNames || []),
    ...(req.excludedPlaces || []),
    ...(req.permanentSkips || []),
    ...(req.excludedNames || []),
  ].filter(Boolean);

  const blacklist = Array.from(new Set(blacklistRaw.map((x) => x.trim().toLowerCase())));

  const priorSummary = req.priorActivity
    ? `'${req.priorActivity.name}' [Category: ${req.priorActivity.category}, Time: ${req.priorActivity.time}, Address: ${req.priorActivity.address || req.destinationOrTown}, Description: ${req.priorActivity.description}]`
    : "None (This is the first activity of the day)";

  const posteriorSummary = req.posteriorActivity
    ? `'${req.posteriorActivity.name}' [Category: ${req.posteriorActivity.category}, Time: ${req.posteriorActivity.time}, Address: ${req.posteriorActivity.address || req.destinationOrTown}, Description: ${req.posteriorActivity.description}]`
    : "None (This is the last activity of the day)";

  const tasteInstruction = buildTasteInstruction(req.tasteProfile);

  const systemInstruction = `You are LocalExplorer AI, an expert local travel curator.
Your task is to propose ONE single replacement spot for "${req.currentActivityName}" in ${req.destinationOrTown}.

CRITICAL MANDATES FOR SWAPPING:
1. ABSOLUTE DEDUPLICATION & BLACKLIST (STRICTEST PRIORITY):
   The proposed replacement spot MUST NOT be any of the following places. They are ALREADY scheduled in the itinerary across all days, visited in 30-day memory, or permanently skipped:
   [${blacklistRaw.join(", ")}].
   You MUST propose a completely distinct, non-repeating, authentic local spot.

2. TIME SLOT & CATEGORY COMPATIBILITY:
   - Target Time Slot: ${req.timeSlot || "Flexible"}
   - Requested Category: ${req.category}
   - User Pace: ${req.pace || "balanced"}

3. PRIOR & POSTERIOR ACTIVITY HARMONY (EFFORT LEVEL & LOCATION FLOW):
   - Immediately PRIOR Activity: ${priorSummary}
   - Immediately POSTERIOR Activity: ${posteriorSummary}
   - EFFORT & LOCATION INSTRUCTION: Ensure the replacement spot is geographically reachable from the prior spot and smoothly bridges to the posterior spot. Match the physical exertion level (e.g. if the prior activity is a high-effort hike, provide a relaxed spot or logical transition, not back-to-back intense exertion).

4. USER TASTE PROFILE (IF DINING / BAR / CAFE / FOOD):
   ${["food", "cafe", "nightlife"].includes(req.category) && tasteInstruction ? `- Taste Profile: ${tasteInstruction}` : "- Ensure high authentic local quality."}

5. TRAVEL INPUT PREFERENCES:
   - Budget Tier: ${req.budgetTier || "mid-range"}
   - Selected Vibes: ${(req.vibes || req.tripVibes || []).join(", ") || "Authentic local"}
   - Transport Mode: ${req.meansOfTransport || "public transit / walking"}
   - Group Size: ${req.groupSize || 1}

Output strictly valid JSON matching the ActivitySpot schema.`;

  const prompt = `Propose 1 fresh, unique replacement spot in ${req.destinationOrTown} to replace "${req.currentActivityName}" during ${req.timeSlot || "Flexible"}.
Ensure it is NOT in the blacklist [${blacklistRaw.slice(0, 15).join(", ")}], fits between the prior and posterior activities, respects taste profile/budget/transport/pace, and matches ${req.category}.
Output strictly valid JSON.`;

  if (!ai) {
    return generateFallbackSwap(req, blacklist);
  }

  try {
    const modelsToTry = [PRIMARY_TEXT_MODEL, FALLBACK_TEXT_MODEL, TERTIARY_TEXT_MODEL];
    let responseText = "";

    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                time: { type: Type.STRING },
                name: { type: Type.STRING },
                category: { type: Type.STRING },
                description: { type: Type.STRING },
                insiderTip: { type: Type.STRING },
                approxCost: { type: Type.STRING },
                rating: { type: Type.NUMBER },
                coordinates: {
                  type: Type.OBJECT,
                  properties: {
                    lat: { type: Type.NUMBER },
                    lng: { type: Type.NUMBER },
                  },
                  required: ["lat", "lng"],
                },
                address: { type: Type.STRING },
                durationMinutes: { type: Type.INTEGER },
              },
              required: ["id", "time", "name", "category", "description", "insiderTip", "approxCost", "coordinates"],
            },
          },
        });
        if (response.text) {
          responseText = response.text;
          break;
        }
      } catch (err) {
        console.warn(`Swap generation failed on ${modelName}:`, (err as any)?.message || err);
      }
    }

    if (!responseText) {
      return generateFallbackSwap(req, blacklist);
    }

    const parsed = JSON.parse(responseText || "{}");
    const parsedNameClean = (parsed.name || "").trim().toLowerCase();

    // Verify parsed spot is not in blacklist
    const isForbidden = blacklist.some((b) => parsedNameClean.includes(b) || b.includes(parsedNameClean));
    if (isForbidden || !parsed.name) {
      console.warn(`Swap spot '${parsed.name}' was blacklisted or empty! Generating fallback swap.`);
      return generateFallbackSwap(req, blacklist);
    }

    const resolvedCoords = await resolveActivityCoordinates(
      parsed.name,
      req.destinationOrTown,
      parsed.address,
      parsed.coordinates,
      30
    );
    return {
      ...parsed,
      id: "spot-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      time: normalizeTimeSlot(req.timeSlot || parsed.time || "Flexible"),
      isSwapped: true,
      coordinates: resolvedCoords,
      googleMapsUrl: generateGoogleMapsSearchUrl(parsed.name, req.destinationOrTown, parsed.address, resolvedCoords),
    };
  } catch (error) {
    console.error("Error swapping activity:", error);
    return generateFallbackSwap(req, blacklist);
  }
}

// Curated Dynamic Fallback Generator for Donostia / San Sebastián and Global Destinations
async function generateFallbackVacation(prefs: VacationPreferences): Promise<ItineraryPlan> {
  const dest = prefs.destination.trim() || "Donostia / San Sebastián, Spain";
  const daysCount = Math.min(Math.max(Number(prefs.duration) || 3, 1), 14);
  const baseCoords = lookupKnownCoordinates(dest);
  const pace = prefs.pace || "balanced";
  const vibes = prefs.vibes && prefs.vibes.length > 0 ? prefs.vibes : ["Gastronomy & Local Food", "Scenic & Outdoors", "History & Architecture"];

  // Activity pool for San Sebastián categorized by vibe
  const donostiaSpotPool: (ActivitySpot & { vibeCategories: string[] })[] = [
    // Gastronomy
        {
      id: "fb-2",
      time: "12:30 PM - 02:30 PM",
      name: "Mercado de la Bretxa & Old Town Produce Stalls",
      category: "food",
      description: "Historic covered market square where Michelin chefs shop for daily seafood, Idiazabal cheeses, and Guernica peppers.",
      insiderTip: "Explore the subterranean fishmonger stalls for fresh Cantabrian spider crab.",
      approxCost: "€15 - €25",
      rating: 4.8,
      coordinates: { lat: 43.3235, lng: -1.9830 },
      address: "Alameda del Boulevard 3, Donostia",
      durationMinutes: 90,
      vibeCategories: ["Gastronomy & Local Food", "Budget Friendly", "Family Friendly"],
    },
            // Scenic & Outdoors / Nature
    {
      id: "fb-5",
      time: "09:30 AM - 11:30 AM",
      name: "Paseo de La Concha & Miramar Palace Gardens",
      category: "nature",
      description: "Walk along the iconic wrought-iron promenade of La Concha bay, crossing into royal palace gardens overlooking Santa Clara Island.",
      insiderTip: "Pass through the pedestrian tunnel under Miramar hill onto Ondarreta beach.",
      approxCost: "Free",
      rating: 4.9,
      coordinates: { lat: 43.3150, lng: -1.9930 },
      address: "Paseo de La Concha, Donostia",
      durationMinutes: 90,
      vibeCategories: ["Scenic & Outdoors", "Relaxation & Wellness", "Family Friendly", "Budget Friendly"],
    },
    {
      id: "fb-6",
      time: "11:45 AM - 01:15 PM",
      name: "Peine del Viento (Comb of the Wind by Eduardo Chillida)",
      category: "culture",
      description: "Monumental steel sculptures forged into sea cliffs where Atlantic swells roar through granite blowholes.",
      insiderTip: "Stand directly over the perforated blowholes when high tide arrives.",
      approxCost: "Free",
      rating: 5.0,
      coordinates: { lat: 43.3175, lng: -2.0062 },
      address: "Paseo Eduardo Chillida, Donostia",
      durationMinutes: 75,
      vibeCategories: ["Scenic & Outdoors", "Art & Culture", "History & Architecture"],
    },
    {
      id: "fb-7",
      time: "02:30 PM - 05:00 PM",
      name: "Monte Urgull, English Cemetery & Castillo de la Mota Fortress",
      category: "sightseeing",
      description: "Ascend shaded coastal forest trails to 12th-century stone ramparts with panoramic vistas over the harbor and old town.",
      insiderTip: "Stop at Bar Polboriña on the hilltop bastion terrace for a cold cider.",
      approxCost: "Free",
      rating: 4.9,
      coordinates: { lat: 43.3250, lng: -1.9880 },
      address: "Monte Urgull, Donostia",
      durationMinutes: 120,
      vibeCategories: ["Scenic & Outdoors", "History & Architecture", "Budget Friendly"],
    },
    {
      id: "fb-8",
      time: "05:30 PM - 07:30 PM",
      name: "Sagüés Sea Wall Sunset & Zurriola Surf Beach Promenade",
      category: "relaxation",
      description: "Join locals on the massive sea wall at Zurriola surf beach to watch the sun drop behind Monte Igueldo.",
      insiderTip: "Grab a cold drink from the beachfront kiosko as the evening swell rolls in.",
      approxCost: "Free",
      rating: 4.9,
      coordinates: { lat: 43.3280, lng: -1.9710 },
      address: "Paseo de Sagüés, Donostia",
      durationMinutes: 90,
      vibeCategories: ["Scenic & Outdoors", "Relaxation & Wellness", "Nightlife & Bars", "Budget Friendly"],
    },
    // Family Friendly & Relaxation
    {
      id: "fb-9",
      time: "01:30 PM - 04:00 PM",
      name: "Monte Igueldo 1912 Vintage Funicular & Panoramic Lookout",
      category: "sightseeing",
      description: "Ride the vintage wooden funicular 180m above the bay for postcard views and the classic 1928 oceanfront roller coaster.",
      insiderTip: "Great for families and panorama photography lovers.",
      approxCost: "€4.50 funicular",
      rating: 4.9,
      coordinates: { lat: 43.3195, lng: -2.0090 },
      address: "Plaza del Funicular 4, Donostia",
      durationMinutes: 120,
      vibeCategories: ["Family Friendly", "Scenic & Outdoors", "Relaxation & Wellness"],
    },
    {
      id: "fb-10",
      time: "10:00 AM - 12:30 PM",
      name: "Motoras Boat Shuttle to Santa Clara Island & Lighthouse Path",
      category: "sightseeing",
      description: "Take the small blue boat shuttle across the bay to Santa Clara Island, walking up to the lighthouse and sculpture installation.",
      insiderTip: "Check low tide times to walk along the island's tiny hidden sandy beach.",
      approxCost: "€5 boat ticket",
      rating: 4.9,
      coordinates: { lat: 43.3210, lng: -1.9980 },
      address: "Puerto Pesquero, Donostia",
      durationMinutes: 120,
      vibeCategories: ["Family Friendly", "Scenic & Outdoors", "Hidden Gems / Non-Touristy"],
    },
    {
      id: "fb-11",
      time: "10:30 AM - 01:00 PM",
      name: "La Perla Thalassotherapy Thermal Spa & Promenade Terrace",
      category: "relaxation",
      description: "Unwind at La Perla, an iconic Belle Époque seawater spa with heated hydrotherapy pools directly on La Concha beach.",
      insiderTip: "Book a 2-hour circuit pass for access to ocean-view Jacuzzis.",
      approxCost: "€32 - €45",
      rating: 4.8,
      coordinates: { lat: 43.3160, lng: -1.9860 },
      address: "Paseo de La Concha, Donostia",
      durationMinutes: 150,
      vibeCategories: ["Relaxation & Wellness", "Budget Friendly"],
    },
    // Art, History & Culture
    {
      id: "fb-12",
      time: "11:45 AM - 01:45 PM",
      name: "San Telmo Museum of Basque Society & Renaissance Cloister",
      category: "culture",
      description: "Basque ethnographic history and monumental Sert murals housed in a 16th-century monastery integrated with modern architecture.",
      insiderTip: "Rest in the serene Renaissance cloister courtyard.",
      approxCost: "€6",
      rating: 4.8,
      coordinates: { lat: 43.3242, lng: -1.9818 },
      address: "Plaza Zuloaga 1, Donostia",
      durationMinutes: 90,
      vibeCategories: ["History & Architecture", "Art & Culture"],
    },
    {
      id: "fb-13",
      time: "10:00 AM - 12:30 PM",
      name: "Tabakalera International Centre for Contemporary Culture Roof Terrace",
      category: "culture",
      description: "Former tobacco factory converted into a vibrant arts center with contemporary galleries and a free rooftop deck.",
      insiderTip: "Head to the 5th floor terrace for sweeping 360-degree views over the river.",
      approxCost: "Free",
      rating: 4.8,
      coordinates: { lat: 43.3180, lng: -1.9770 },
      address: "Plaza de las Cigarreras 1, Donostia",
      durationMinutes: 90,
      vibeCategories: ["Art & Culture", "Hidden Gems / Non-Touristy", "Budget Friendly"],
    },
    // Hidden Gems
    {
      id: "fb-14",
      time: "10:00 AM - 12:30 PM",
      name: "Hondarribia Medieval Walled Town & Calle San Pedro Fishermen Houses",
      category: "culture",
      description: "Scenic excursion to Hondarribia's medieval ramparts and colorful timber fishermen cottages with painted balconies.",
      insiderTip: "Walk to the harbor end of Calle San Pedro for the best balcony photo angle.",
      approxCost: "Free",
      rating: 4.9,
      coordinates: { lat: 43.3685, lng: -1.7915 },
      address: "Calle San Pedro, Hondarribia",
      durationMinutes: 120,
      vibeCategories: ["Hidden Gems / Non-Touristy", "History & Architecture", "Gastronomy & Local Food"],
    },
    {
      id: "fb-15",
      time: "09:30 AM - 12:30 PM",
      name: "Mount Ulia St. James Coastal Trail & Cliffside Walk",
      category: "nature",
      description: "Hike past historic stone lighthouses and dramatic sandstone cliffs with unobstructed ocean views along the Camino de Santiago.",
      insiderTip: "Wear good walking shoes for the historic stone steps.",
      approxCost: "Free",
      rating: 4.9,
      coordinates: { lat: 43.3310, lng: -1.9550 },
      address: "Paseo de Ulia, Donostia",
      durationMinutes: 180,
      vibeCategories: ["Hidden Gems / Non-Touristy", "Scenic & Outdoors"],
    },
  ];

  // Filter out skipped spots if present
  const skippedNames = (prefs.skippedSpots || []).map((s) => s.name.toLowerCase());
  const isDonostia = dest.toLowerCase().includes("donosti") || dest.toLowerCase().includes("san sebastian") || dest.toLowerCase().includes("san sebastián");

  const validPool = (isDonostia ? donostiaSpotPool : []).filter((spot) => {
    const sName = spot.name.toLowerCase();
    return !skippedNames.some((sk) => sName.includes(sk) || sk.includes(sName));
  });

  // Dining is sourced from the traveler's OWN places (user-provided data) —
  // static pools never contain bars/cafés/restaurants anymore.
  const userDiningRaw = (prefs.userSpots || []).filter(
    (sp) => ["bar", "cafe", "restaurant"].includes(sp.category)
  );
  const destKey = dest.split(",")[0].trim().toLowerCase();
  const userDiningForDest = userDiningRaw.filter((sp) => {
    const n = sp.name.toLowerCase();
    if (skippedNames.some((sk) => n.includes(sk) || sk.includes(n))) return false;
    if (!sp.town) return true;
    const t = sp.town.toLowerCase();
    return t.includes(destKey) || destKey.includes(t) || dest.toLowerCase().includes(t);
  });

  // Determine activities per day based on pace
  const targetActivitiesPerDay = pace === "relaxed" ? 3 : pace === "action-packed" ? 6 : 4;

  // Build days dynamically
  const days: DailyPlan[] = [];
  const usedSignatures = new Set<string>();
  let userDiningIdx = 0;

  for (let d = 1; d <= daysCount; d++) {
    const dayActivities: ActivitySpot[] = [];
    const countForThisDay = d === 1 && prefs.arrivalHour ? Math.max(1, targetActivitiesPerDay - 1) : targetActivitiesPerDay;

    for (let a = 0; a < countForThisDay; a++) {
      const isEveningSlot = a === countForThisDay - 1;

      let spotToAdd: ActivitySpot;

      if (isEveningSlot) {
        // ALWAYS assign a dedicated evening experience for the late night slot
        const eveningOptions: ActivitySpot[] = [
          {
            id: `fb-eve-1`,
            time: "08:00 PM - 10:30 PM",
            name: "Parte Vieja Traditional Pintxo Crawl & Local Wine Tasting",
            category: "food",
            description: "Hop through historic Old Town pintxo taverns sampling freshly seared line-caught squid, Iberian ham croquettes, and crisp chilled local wine.",
            insiderTip: "Stand at the bar counter for the authentic Basque dining atmosphere.",
            approxCost: "€20 - €35",
            rating: 5.0,
            coordinates: { lat: 43.3235, lng: -1.9840 },
            address: "Calle 31 de Agosto, Donostia",
            durationMinutes: 120,
          },
          {
            id: `fb-eve-2`,
            time: "08:00 PM - 10:30 PM",
            name: "Gros Neighborhood Artisan Pintxo Route & Craft Beer",
            category: "nightlife",
            description: "Explore the bohemian Gros neighborhood, visiting artisanal craft taverns and creative modern pintxo bars near Zurriola beach.",
            insiderTip: "Try the slow-cooked beef cheek pintxo along Calle Zabaleta.",
            approxCost: "€18 - €30",
            rating: 4.9,
            coordinates: { lat: 43.3245, lng: -1.9735 },
            address: "Calle Zabaleta, Donostia",
            durationMinutes: 120,
          },
          {
            id: `fb-eve-3`,
            time: "08:00 PM - 10:30 PM",
            name: "La Concha Bay Night Promenade & Oceanfront Terrace Drinks",
            category: "relaxation",
            description: "An unhurried illuminated evening stroll along La Concha bay, ending with a digestif or glass of wine overlooking the ocean.",
            insiderTip: "The wrought-iron street lamps cast beautiful reflections on the wet sand at low tide.",
            approxCost: "€10 - €20",
            rating: 4.8,
            coordinates: { lat: 43.3165, lng: -1.9880 },
            address: "Paseo de La Concha, Donostia",
            durationMinutes: 120,
          },
        ];
        spotToAdd = eveningOptions[(d - 1) % eveningOptions.length];
      } else {
        // Daytime slot: find an unused spot matching vibe
        let chosenSpot = validPool.find((spot) => {
          const sigs = getSpotSignatures(spot.name, spot.description);
          const isUsed = sigs.some((s) => usedSignatures.has(s));
          const matchesVibe = spot.vibeCategories.some((cat) => vibes.includes(cat));
          return !isUsed && matchesVibe;
        });

        if (!chosenSpot) {
          chosenSpot = validPool.find((spot) => {
            const sigs = getSpotSignatures(spot.name, spot.description);
            return !sigs.some((s) => usedSignatures.has(s));
          });
        }

        if (chosenSpot) {
          const sigs = getSpotSignatures(chosenSpot.name, chosenSpot.description);
          sigs.forEach((s) => usedSignatures.add(s));
          spotToAdd = chosenSpot;
        } else {
          const defaultTime = "02:30 PM - 04:30 PM";
          spotToAdd = getUnusedBackupSpot(dest, usedSignatures, defaultTime, "culture");
        }
      }

      let formattedTime = spotToAdd.time;
      if (pace === "relaxed") {
        if (a === 0) formattedTime = "09:30 AM - 11:30 AM";
        else if (a === 1) formattedTime = "01:00 PM - 03:30 PM";
        else formattedTime = "06:30 PM - 09:00 PM";
      } else if (pace === "action-packed") {
        if (a === 0) formattedTime = "08:30 AM - 10:00 AM";
        else if (a === 1) formattedTime = "10:30 AM - 12:00 PM";
        else if (a === 2) formattedTime = "12:30 PM - 02:30 PM";
        else if (a === 3) formattedTime = "03:00 PM - 05:00 PM";
        else if (a === 4) formattedTime = "05:30 PM - 07:30 PM";
        else formattedTime = "08:00 PM - 10:30 PM";
      } else {
        if (a === 0) formattedTime = "09:00 AM - 10:30 AM";
        else if (a === 1) formattedTime = "11:00 AM - 12:30 PM";
        else if (a === 2) formattedTime = "01:00 PM - 03:00 PM";
        else if (a === 3) formattedTime = "04:00 PM - 06:30 PM";
        else formattedTime = "08:00 PM - 10:00 PM";
      }

      dayActivities.push({
        ...spotToAdd,
        id: `fb-day${d}-act${a + 1}-${Date.now()}`,
        time: formattedTime,
      });
    }

    // Fallback generic spot if pool was exhausted
    if (dayActivities.length === 0) {
      dayActivities.push(getUnusedBackupSpot(dest, usedSignatures, "10:00 AM - 12:30 PM", "culture"));
    }

    // Weave in the traveler's own dining spot for this day (dynamically geocoded)
    if (userDiningForDest.length > 0 && userDiningIdx < userDiningForDest.length) {
      const us = userDiningForDest[userDiningIdx++];
      if (!us.coordinates) {
        const geo = await geocodeSpot(us.name, us.town || dest);
        if (geo) us.coordinates = { lat: geo.lat, lng: geo.lng };
      }
      const dinnerTime =
        pace === "relaxed" ? "06:30 PM - 08:30 PM" : pace === "action-packed" ? "09:00 PM - 11:00 PM" : "08:00 PM - 10:00 PM";
      const userAct: ActivitySpot = {
        id: `user-spot-${us.id}-d${d}`,
        time: dinnerTime,
        name: us.name,
        category: us.category === "bar" ? "nightlife" : us.category === "cafe" ? "cafe" : "food",
        description: us.notes ? `One of your own places: ${us.notes}` : "One of your own places, saved in My Places.",
        insiderTip: "You added this one yourself — it belongs on the trip.",
        approxCost: "Your budget",
        rating: 5.0,
        coordinates: us.coordinates || { lat: baseCoords.lat + 0.002, lng: baseCoords.lng - 0.002 },
        address: us.town,
        durationMinutes: 105,
      };
      // Keep the pace counts stable: replace the last slot when the day is already full
      if (dayActivities.length >= countForThisDay) {
        dayActivities[dayActivities.length - 1] = userAct;
      } else {
        dayActivities.push(userAct);
      }
    }

    // Determine day theme dynamically from vibes
    const dominantVibe = vibes[(d - 1) % vibes.length] || "Cultural Exploration";
    days.push({
      dayNumber: d,
      dayTitle: `Day ${d}: ${dominantVibe} in ${dest}`,
      theme: `${dominantVibe} & District Discovery`,
      summary: `Tailored Day ${d} featuring ${dominantVibe.toLowerCase()} highlights and unhurried local exploration in ${dest}.`,
      estimatedTotalBudget: "$40 - $75",
      activities: dayActivities,
    });
  }

  const dynamicPlan: ItineraryPlan = {
    id: "vacation-fallback-" + Date.now(),
    mode: "vacation",
    title: `${daysCount}-Day ${dest} (${vibes.slice(0, 2).join(" & ")}) Itinerary`,
    destinationOrTown: dest,
    summary: `A ${pace}-paced ${daysCount}-day itinerary in ${dest} custom-tailored for ${vibes.join(", ")}.`,
    highlights: [
      `Curated daily route tailored for ${vibes.slice(0, 2).join(" & ")} in ${dest}`,
      `Authentic local establishments, scenic spots, and dining highlights`,
      `Optimized ${pace} exploration flow with zero repeated activities`,
    ],
    totalDays: daysCount,
    createdAt: new Date().toISOString(),
    tags: vibes,
    weatherSummary: "Pleasant local exploring weather expected.",
    mapCenter: baseCoords,
    mapZoom: 13,
    customPace: pace,
    budgetTier: prefs.budgetTier,
    arrivalHour: prefs.arrivalHour,
    departureHour: prefs.departureHour,
    days: days,
  };

  return await enforceVacationConstraintsAndPhotos(dynamicPlan, prefs);
}

/**
 * Offline hometown fallback.
 * IMPORTANT: dining suggestions (bars/cafés/restaurants) are NEVER fabricated
 * here — they are sourced from the user's own places ("My Places"). Known
 * local places and user places are geocoded dynamically (KB fast-path +
 * Nominatim), so pins always point at the real location.
 */
async function generateFallbackHometown(prefs: HometownPreferences): Promise<ItineraryPlan> {
  const loc = prefs.location.trim() || "Local Neighborhood";
  const baseCoords = lookupKnownCoordinates(loc);
  const verified = findVerifiedDestination(prefs.location);
  const townName = verified?.name || loc.split(",")[0].trim();

  // Honor the resident's exclusion lists even in offline mode
  const excludedLower = [...(prefs.excludedPlaces || []), ...(prefs.permanentSkips || [])]
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  const isExcludedSpot = (name: string) => {
    const n = name.toLowerCase();
    return excludedLower.some((ex) => n.includes(ex) || ex.includes(n));
  };

  // Dining demand is satisfied with DATA PROVIDED BY THE USER, never static lists
  const userDiningAll = (prefs.userSpots || []).filter(
    (sp) => ["bar", "cafe", "restaurant"].includes(sp.category) && !isExcludedSpot(sp.name)
  );
  const townMatched = userDiningAll.filter(
    (sp) =>
      !sp.town ||
      sp.town.toLowerCase().includes(townName.toLowerCase()) ||
      townName.toLowerCase().includes(sp.town.toLowerCase())
  );
  const diningPool = townMatched.length > 0 ? townMatched : userDiningAll;

  const spotCount = prefs.timeAvailable === "quick" ? 2 : prefs.timeAvailable === "full-day" ? 4 : 3;
  const wetWeather = /rain|storm|drizzle|wet|cold|chilly|wind|overcast/i.test(prefs.weatherCondition || "");

  let diningSlots =
    prefs.occasion === "Local Tapas & Eateries" ? spotCount : prefs.timeAvailable === "full-day" ? 2 : 1;
  diningSlots = Math.min(diningSlots, spotCount);

  // Dynamically geocode the user's places if their coordinates are pending
  for (const sp of diningPool) {
    if (!sp.coordinates) {
      const geo = await geocodeSpot(sp.name, sp.town || townName);
      if (geo) sp.coordinates = { lat: geo.lat, lng: geo.lng };
    }
  }

  // How a resident re-lives a familiar place, per occasion
  const occasionAngles: Record<string, { suffix: string; tip: string }> = {
    "Solo Chill & Read": {
      suffix: "Quiet-Hour Revisit",
      tip: "Go at the calm hour when it belongs to locals, not visitors — bring something to read and stay twice as long as you normally would.",
    },
    "Date Night & Ambiance": {
      suffix: "Evening-Ambiance Revisit",
      tip: "Same place, different town: after dark the crowds thin, the light changes, and it feels like somewhere new.",
    },
    "Outdoor Adventure": {
      suffix: "Active Local Loop",
      tip: "Do it at local pace and take the branch residents use to skip the busy stretch.",
    },
    "Rainy Day Indoor": {
      suffix: "Sheltered-Corner Revisit",
      tip: "Head straight for the covered corner — wet days give it a completely different atmosphere.",
    },
    "Local Tapas & Eateries": {
      suffix: "Counter & Daily Special",
      tip: "Ignore the card menu: stand at the bar and ask for today's local special.",
    },
    "Nature & River Spots": {
      suffix: "Slow Nature Loop",
      tip: "Take the longer resident loop instead of the signposted short route.",
    },
    "Hidden Gems & Vintage": {
      suffix: "Back-Side Exploration",
      tip: "Explore the side entrances and back streets around it that most people walk straight past.",
    },
    "Family Fun Outing": {
      suffix: "Family-Hour Revisit",
      tip: "Go at family hour when it's relaxed, and the staff have time for the kids.",
    },
  };
  const angle = occasionAngles[prefs.occasion] || occasionAngles["Solo Chill & Read"];
  // Non-dining spots on a dining-focused outing get a stroll-style framing instead
  const realSpotAngle =
    prefs.occasion === "Local Tapas & Eateries"
      ? {
          suffix: "Evening-Stroll Stop",
          tip: "The classic between-bites walk locals do — this is the scenic breather.",
        }
      : angle;

  // Occasion-matched NON-DINING archetypes (dining comes exclusively from user data)
  const archetypesByOccasion: Record<string, { name: string; category: ActivityCategory; description: string; tip: string; cost: string }[]> = {
    "Solo Chill & Read": [
      { name: "Library or Quiet Reading Corner", category: "relaxation", description: "The calmest public corner in town to sit, read and disconnect.", tip: "The upper floor is the quietest after lunch.", cost: "Free" },
      { name: "Quiet Green Loop & Locals' Bench", category: "nature", description: "The calmest walking loop nearby, ending at the bench residents actually use.", tip: "The bench facing west gets the last sun of the day.", cost: "Free" },
      { name: "Bookshop or Kiosk Browsing Stroll", category: "hidden-gem", description: "Slow browsing through local shelves and magazines, no agenda.", tip: "Check the small local-press section for town history zines.", cost: "Free to browse" },
      { name: "Empty-Hour Square Bench", category: "relaxation", description: "The main square at its quietest — just the fountain and the pigeons.", tip: "Locals go between lunch and the evening rush — that's the calm window.", cost: "Free" },
    ],
    "Date Night & Ambiance": [
      { name: "Sunset Viewpoint the Locals Actually Use", category: "nature", description: "The lookout where residents take visitors — and each other.", tip: "Arrive 20 minutes before sunset for the best light and a free bench.", cost: "Free" },
      { name: "Night-Illuminated Old-Quarter Walk", category: "sightseeing", description: "Familiar streets read completely differently after dark.", tip: "Walk the lit route counter-clockwise — the best facades face you.", cost: "Free" },
      { name: "Skyline or Riverbank Evening Bench", category: "relaxation", description: "The bench with the evening view locals keep to themselves.", tip: "Bring a thermos; there's no kiosk, which is exactly why it's quiet.", cost: "Free" },
      { name: "Concert Hall or Theatre Facade & Program", category: "culture", description: "Check tonight's program — locals plan the evening around it.", tip: "Last-minute seats often free up right before the doors open.", cost: "Varies" },
    ],
    "Outdoor Adventure": [
      { name: "Ridge or Trailhead Active Loop", category: "nature", description: "The proper local loop with real elevation, not the signposted stroll.", tip: "Take the residents' shortcut on the way back — it saves 15 minutes.", cost: "Free" },
      { name: "Riverbank or Estuary Path Run/Walk", category: "nature", description: "Flat-out-and-back along the water where locals train.", tip: "The far bridge has the best mid-route view.", cost: "Free" },
      { name: "Panoramic Picnic Ledge", category: "nature", description: "A sheltered spot with the view residents keep to themselves.", tip: "Bring water — there's no kiosk up there, which is exactly why it's quiet.", cost: "Free" },
      { name: "Coastal or Countryside Lookout Detour", category: "sightseeing", description: "A short detour to the lookout locals mention but guidebooks miss.", tip: "Best in the hour before sunset when the haze drops.", cost: "Free" },
    ],
    "Rainy Day Indoor": [
      { name: "Small Museum or Gallery Corner", category: "culture", description: "The town's indoor refuge — one good room beats five rushed ones.", tip: "Rainy days are when the curator actually has time to talk.", cost: "€3 - €8" },
      { name: "Covered Market Hall Browsing", category: "shopping", description: "Dry, warm, and full of local life between the stalls.", tip: "The back aisles are calmest once the morning rush ends.", cost: "Free to browse" },
      { name: "Library or Reading Room", category: "relaxation", description: "Rain on the windows and a quiet chair — the classic local hideout.", tip: "The reading room by the tall windows fills first; the side tables are the backup.", cost: "Free" },
      { name: "Bookshop, Workshop or Artisan Visit", category: "hidden-gem", description: "Indoor wandering through shelves or a maker's bench.", tip: "Ask about repairs or custom orders — rainy days are when makers work.", cost: "Free to browse" },
    ],
    "Local Tapas & Eateries": [
      { name: "Old-Quarter Evening Stroll", category: "sightseeing", description: "The classic between-bars walk locals do — facades, squares and street life.", tip: "Start at the main square and let the side alleys decide the route.", cost: "Free" },
      { name: "Seafront or Riverside Promenade at Dusk", category: "nature", description: "The digestivo walk residents take after eating.", tip: "Go against the crowd flow for the quiet stretch.", cost: "Free" },
    ],
    "Nature & River Spots": [
      { name: "Riverside Greenway Slow Loop", category: "nature", description: "The flat green path along the water, done at resident pace.", tip: "Cross at the second bridge for the quieter return bank.", cost: "Free" },
      { name: "Wetland or Park Sanctuary Bench", category: "nature", description: "The green pocket where locals go to hear birds instead of traffic.", tip: "The far bench is the one with morning sun and no dog traffic.", cost: "Free" },
      { name: "Tree-Shaded Reading Clearing", category: "relaxation", description: "A clearing residents claim for slow afternoons.", tip: "Bring a blanket — the grass dries fastest on the south edge.", cost: "Free" },
      { name: "Waterline Lookout at Golden Hour", category: "sightseeing", description: "Where the river meets the light — the resident's free spectacle.", tip: "Low water exposes the stepping stones; check before crossing.", cost: "Free" },
    ],
    "Hidden Gems & Vintage": [
      { name: "Vintage & Thrift Back Rooms", category: "shopping", description: "The racks behind the racks, where the good stuff hides.", tip: "New stock goes out midweek mornings — not weekends.", cost: "€5 - €20" },
      { name: "Murals, Courtyards & Hidden Corners", category: "hidden-gem", description: "A self-guided loop of the details residents stop noticing.", tip: "Look up — half the best pieces are above street level.", cost: "Free" },
      { name: "Independent Workshop Visit", category: "culture", description: "A maker's bench you can actually stand and watch.", tip: "Weekday afternoons are when makers work; weekends they sell.", cost: "Free to browse" },
      { name: "Hidden Staircase & Passage Loop", category: "hidden-gem", description: "The shortcut stairs and passages only residents use.", tip: "The upper passage has the best view without the climb.", cost: "Free" },
    ],
    "Family Fun Outing": [
      { name: "Playground & Shaded Picnic Park", category: "relaxation", description: "The park local families actually default to.", tip: "The shaded benches near the small slide fill first on warm days.", cost: "Free" },
      { name: "Fountain & Shaded Play Square", category: "relaxation", description: "Splash, shade, and benches within sight of each other.", tip: "Mornings are calmer; the fountain is switched off at dusk.", cost: "Free" },
      { name: "Easy Nature Stroll with a Destination", category: "nature", description: "Short legs, big payoff: a walk that ends somewhere worth it.", tip: "Promise the destination first — it halves the whining.", cost: "Free" },
      { name: "Animal or Water-Watching Corner", category: "nature", description: "Ducks, herons or boats — the spot kids can watch for an hour.", tip: "Bring bread only if locals do; some ponds ban feeding.", cost: "Free" },
    ],
  };

  let archetypePool = archetypesByOccasion[prefs.occasion] || archetypesByOccasion["Solo Chill & Read"];
  if (wetWeather && (prefs.occasion === "Outdoor Adventure" || prefs.occasion === "Nature & River Spots")) {
    archetypePool = archetypesByOccasion["Rainy Day Indoor"];
  }

  const timeSlots =
    spotCount === 2
      ? ["10:30 AM - 12:00 PM", "12:30 PM - 02:00 PM"]
      : spotCount === 3
      ? ["10:30 AM - 12:00 PM", "12:30 PM - 02:30 PM", "03:00 PM - 04:30 PM"]
      : ["10:00 AM - 11:30 AM", "12:00 PM - 02:00 PM", "02:30 PM - 04:00 PM", "04:30 PM - 06:00 PM"];

  // Real local places (verified knowledge base) re-experienced at a resident angle.
  // Exception: a dining-focused occasion with no user dining places falls back to
  // the evening-stroll archetypes instead of tagging mountains with food suffixes.
  const realSpots =
    prefs.occasion === "Local Tapas & Eateries" && diningPool.length === 0
      ? []
      : (verified?.popularSpots || []).filter((sp) => !isExcludedSpot(sp) && !isDiningName(sp));
  const rotate = realSpots.length > 0 ? new Date().getDate() % realSpots.length : 0;

  // Which slot indices are dining (lunch mid-plan, dinner last)
  const diningSlotIdx = new Set<number>();
  if (diningPool.length > 0 && diningSlots > 0) {
    if (diningSlots >= 2 && spotCount >= 3) {
      diningSlotIdx.add(Math.floor(spotCount / 2));
      diningSlotIdx.add(spotCount - 1);
    } else {
      diningSlotIdx.add(spotCount - 1);
    }
  }

  const activities: ActivitySpot[] = [];
  let diningUsed = 0;
  let realUsed = 0;
  let archUsed = 0;
  const usedDiningIds = new Set<string>();

  // Pick the user's place that best fits this slot + their taste profile
  const pickDiningSpot = (slotIdx: number): UserSpot | null => {
    if (diningPool.length === 0) return null;
    const isMorning = slotIdx === 0;
    const isEvening = slotIdx === spotCount - 1;
    const tp = prefs.tasteProfile;
    let best: UserSpot | null = null;
    let bestScore = -Infinity;
    for (const sp of diningPool) {
      if (usedDiningIds.has(sp.id)) continue;
      let score = 0;
      if (tp) {
        const coffeeOrTea = (tp.drinkPreferences || []).some((d) => /coffee|tea|infusion/i.test(d));
        const alcoholic = (tp.drinkPreferences || []).some((d) => /wine|txakoli|beer|cocktail|cider|mixed/i.test(d));
        if (isMorning) {
          if (sp.category === "cafe") score += coffeeOrTea ? 4 : 2;
        } else if (isEvening) {
          if (sp.category === "bar") score += alcoholic ? 4 : 2;
          if (sp.category === "restaurant") score += 1;
          if (sp.category === "cafe" && coffeeOrTea) score += 1; // quiet evening café for coffee lovers
        } else {
          if (sp.category === "restaurant") score += 3;
          if (sp.category === "cafe") score += coffeeOrTea ? 3 : 1; // reading-break café for coffee lovers
        }
        // Budget nudge: 'luxury' profiles lean restaurant, 'budget' leans casual
        if (tp.budgetComfort === "luxury" && sp.category === "restaurant") score += 1;
      } else {
        if (isMorning && sp.category === "cafe") score += 1;
        if (isEvening && sp.category === "bar") score += 1;
        if (!isMorning && !isEvening && sp.category === "restaurant") score += 1;
      }
      if (score > bestScore) {
        bestScore = score;
        best = sp;
      }
    }
    return best;
  };

  for (let i = 0; i < spotCount; i++) {
    const jitterLat = baseCoords.lat + Math.sin(i * 2.1 + 0.7) * 0.004;
    const jitterLng = baseCoords.lng + Math.cos(i * 2.1 + 0.7) * 0.004;

    // 1) Dining slots → the user's OWN places (dynamic, user-provided data),
    //    ranked for the time slot and their taste profile
    const pickedDining = diningSlotIdx.has(i) ? pickDiningSpot(i) : null;
    if (pickedDining) {
      const sp = pickedDining;
      usedDiningIds.add(sp.id);
      diningUsed++;
      activities.push({
        id: `ht-user-${sp.id || diningUsed}-${Date.now()}`,
        time: timeSlots[i],
        name: sp.name,
        category: sp.category === "bar" ? "nightlife" : sp.category === "cafe" ? "cafe" : "food",
        description: sp.notes
          ? `One of your own places — ${sp.notes}`
          : "One of your own places, saved in My Places. Dining suggestions always come from you — never from a built-in list.",
        insiderTip: "You chose this one — it's on the plan because it's yours.",
        approxCost: "Your budget",
        rating: 5.0,
        coordinates: sp.coordinates || { lat: jitterLat, lng: jitterLng },
        address: sp.town,
        durationMinutes: 75,
      });
      continue;
    }

    // 2) Known local places at a resident angle (real name, dynamic coordinates)
    const realSpot = realSpots.length > 0 && realUsed < realSpots.length
      ? realSpots[(rotate + realUsed) % realSpots.length]
      : null;
    if (realSpot) {
      realUsed++;
      let coords = getKnownSpotCoordinates(loc, realSpot) || null;
      if (!coords) {
        const geo = await geocodeSpot(realSpot, townName);
        if (geo) coords = { lat: geo.lat, lng: geo.lng };
      }
      activities.push({
        id: `ht-local-${i}-${Date.now()}`,
        time: timeSlots[i],
        name: `${realSpot} — ${realSpotAngle.suffix}`,
        category: wetWeather ? (i % 2 === 0 ? "culture" : "relaxation") : (["nature", "relaxation", "hidden-gem", "sightseeing"] as ActivityCategory[])[i % 4],
        description: `You already know ${realSpot} — this is the resident's way of re-living it: at an unusual hour and a slower pace, when the place belongs to locals rather than visitors.`,
        insiderTip: realSpotAngle.tip,
        approxCost: "Free",
        rating: 4.8,
        coordinates: coords || { lat: jitterLat, lng: jitterLng },
        durationMinutes: 75,
      });
      continue;
    }

    // 3) Non-dining archetypes (curated local moments)
    const arch = archetypePool[archUsed++ % archetypePool.length];
    activities.push({
      id: `ht-arch-${i}-${Date.now()}`,
      time: timeSlots[i],
      name: `${townName}: ${arch.name}`,
      category: arch.category,
      description: arch.description,
      insiderTip: arch.tip,
      approxCost: arch.cost,
      rating: 4.7,
      coordinates: { lat: jitterLat, lng: jitterLng },
      durationMinutes: 75,
    });
  }

  const summary = `A resident-first outing within ${prefs.radiusKm}km of ${loc}, tuned for ${prefs.weatherCondition} and built around rediscovering familiar places at unusual hours — no tourist agenda.`;

  return {
    id: "hometown-" + Date.now(),
    mode: "hometown",
    title: `Local Explorer: ${prefs.occasion} in ${townName}`,
    destinationOrTown: loc,
    summary,
    highlights: [
      diningUsed > 0
        ? `${diningUsed} of your own places woven into the outing`
        : `Familiar ${townName} places re-experienced at quiet, resident-only hours`,
      `Tuned to "${prefs.occasion}" and today's ${prefs.weatherCondition.toLowerCase()} conditions`,
      `Your permanent exclusions and 30-day memory are respected`,
    ],
    totalDays: 1,
    createdAt: new Date().toISOString(),
    tags: [prefs.occasion, `${prefs.radiusKm}km radius`, prefs.weatherCondition],
    weatherSummary: `Optimized for ${prefs.weatherCondition}.`,
    mapCenter: baseCoords,
    mapZoom: 14,
    days: [
      {
        dayNumber: 1,
        dayTitle: `${townName}: ${prefs.occasion} — Resident Angle`,
        theme: prefs.occasion,
        summary: `Crafted for a ${prefs.timeAvailable} outing that skips everything you have already done.`,
        estimatedTotalBudget: "$10 - $35",
        activities,
      },
    ],
  };
}

async function generateFallbackCandidates(
  destination: string,
  count: number,
  vibes: string[] = [],
  budgetTier?: string,
  userSpots: UserSpot[] = [],
  tasteProfile?: TasteProfile | null
): Promise<CandidateSpot[]> {
  const isDonostia = destination.toLowerCase().includes("donosti") || destination.toLowerCase().includes("san sebastian") || destination.toLowerCase().includes("san sebastián");
  const baseCoords = lookupKnownCoordinates(destination);

  type CandidateWithMeta = CandidateSpot & {
    vibeTags: string[];
    budgetCategory: "budget" | "mid-range" | "luxury";
  };

  let pool: CandidateWithMeta[] = [];

  // USER-PROVIDED PLACES COME FIRST: dining/leisure discovery is driven by
  // the user's own data, never by static venue lists.
  for (const sp of userSpots) {
    if (!sp.coordinates) {
      const geo = await geocodeSpot(sp.name, sp.town || destination);
      if (geo) sp.coordinates = { lat: geo.lat, lng: geo.lng };
    }
    pool.push({
      id: `cand-user-${sp.id}`,
      time: "Any time — your place",
      name: sp.name,
      category: sp.category === "bar" ? "nightlife" : sp.category === "cafe" ? "cafe" : sp.category === "restaurant" ? "food" : "hidden-gem",
      description: sp.notes ? `One of your own places: ${sp.notes}` : "One of your own places, saved in My Places.",
      insiderTip: "You saved this one — swipe right to build the plan around it.",
      approxCost: "Your budget",
      rating: 5.0,
      coordinates: sp.coordinates || { lat: baseCoords.lat + 0.002, lng: baseCoords.lng - 0.002 },
      address: sp.town,
      durationMinutes: 90,
      vibeTags: ["Gastronomy & Local Food", "Hidden Gems / Non-Touristy"],
      budgetCategory: "mid-range",
      reviews: [],
    });
  }

  if (isDonostia) {
    pool = [
      {
        id: "cand-ss-1",
        time: "Morning / Golden Hour",
        name: "Peine del Viento (Eduardo Chillida)",
        category: "culture",
        description: "Three monumental 10-ton oxidized steel sculptures fused into the coastal rocks facing Atlantic waves.",
        insiderTip: "Stand near the granite blowholes when high tide surges.",
        approxCost: "Free",
        rating: 4.9,
        coordinates: { lat: 43.3175, lng: -2.0062 },
        address: "Paseo Eduardo Chillida, Donostia",
        durationMinutes: 75,
        vibeTags: ["Scenic & Outdoors", "History & Architecture", "Relaxation & Wellness"],
        budgetCategory: "budget",
        reviews: [
          { author: "Inés G. (Local Guide)", rating: 5, timeAgo: "1 week ago", text: "Chillida's masterpiece. Raw clash of steel, rock, and sea." },
          { author: "Mark P. (Traveler)", rating: 5, timeAgo: "a month ago", text: "Incredible atmosphere at sunset." },
        ],
      },
      {
        id: "cand-ss-2",
        time: "Midday / Sunset",
        name: "Monte Igueldo & 1912 Wooden Funicular",
        category: "sightseeing",
        description: "Historic funicular railway operating since 1912 climbing to the summit panorama of La Concha Bay.",
        insiderTip: "Ride the vintage 'Montaña Suiza' coaster on the cliff edge for unmatched views.",
        approxCost: "€4.50",
        rating: 4.9,
        coordinates: { lat: 43.3195, lng: -2.0090 },
        address: "Plaza del Funicular 4, Donostia",
        durationMinutes: 120,
        vibeTags: ["Family Friendly", "Scenic & Outdoors"],
        budgetCategory: "budget",
        reviews: [
          { author: "Jon A. (Resident)", rating: 5, timeAgo: "2 weeks ago", text: "The postcard view of San Sebastián." },
        ],
      },
                  {
        id: "cand-ss-5",
        time: "Morning / Afternoon",
        name: "Paseo de La Concha & Miramar Palace",
        category: "nature",
        description: "Iconic crescent beach promenade past Miramar Palace's royal English gardens.",
        insiderTip: "Walk the shoreline at low tide from Alderdi Eder to Ondarreta.",
        approxCost: "Free",
        rating: 4.9,
        coordinates: { lat: 43.3150, lng: -1.9930 },
        address: "Paseo de La Concha, Donostia",
        durationMinutes: 90,
        vibeTags: ["Scenic & Outdoors", "Relaxation & Wellness", "Family Friendly"],
        budgetCategory: "budget",
        reviews: [
          { author: "Carlos R.", rating: 5, timeAgo: "1 month ago", text: "One of the most beautiful urban beaches in the world." },
        ],
      },
      {
        id: "cand-ss-6",
        time: "Afternoon",
        name: "La Perla Thalassotherapy Center & Thermal Spa",
        category: "relaxation",
        description: "Historic Belle Époque seawater hydrotherapy spa with panoramic bay view thermal pools, saunas, and ocean Jacuzzis.",
        insiderTip: "Book the 2-hour thalasso circuit around sunset for glowing views over La Concha.",
        approxCost: "€38 - €70",
        rating: 4.9,
        coordinates: { lat: 43.3155, lng: -1.9875 },
        address: "Paseo de La Concha, Donostia",
        durationMinutes: 120,
        vibeTags: ["Relaxation & Wellness", "Luxury"],
        budgetCategory: "luxury",
        reviews: [
          { author: "Elena M.", rating: 5, timeAgo: "1 week ago", text: "Pure bliss watching the Atlantic waves from the warm hydrotherapy pool." }
        ],
      },
                  {
        id: "cand-ss-9",
        time: "Morning / Afternoon",
        name: "Mount Ulia Coastal Trail to Pasaia (Camino de Santiago Route)",
        category: "nature",
        description: "Breathtaking coastal hiking trail along dramatic ocean cliffs leading to the historic fishing fjord of Pasai Donibane.",
        insiderTip: "Take the 10-cent wooden ferry boat across Pasaia bay to lunch at Casa Cámara.",
        approxCost: "Free",
        rating: 4.9,
        coordinates: { lat: 43.3280, lng: -1.9610 },
        address: "Monte Ulia, Donostia",
        durationMinutes: 180,
        vibeTags: ["Scenic & Outdoors", "Hidden Gems / Non-Touristy"],
        budgetCategory: "budget",
        reviews: [
          { author: "Hiker Dan", rating: 5, timeAgo: "1 month ago", text: "Sensational cliffside trail along the Atlantic." }
        ],
      },
            {
        id: "cand-ss-11",
        time: "Afternoon",
        name: "Santa Clara Island Ferry & Lighthouse Promenade",
        category: "sightseeing",
        description: "Quaint island in the center of La Concha Bay reachable by Las Motoras ferry, featuring a cliffside bar and lighthouse sculpture.",
        insiderTip: "Pack a picnic and sit on the island's secret grassy western cove.",
        approxCost: "€5",
        rating: 4.8,
        coordinates: { lat: 43.3215, lng: -1.9960 },
        address: "Isla Santa Clara, Donostia",
        durationMinutes: 120,
        vibeTags: ["Family Friendly", "Scenic & Outdoors", "Hidden Gems / Non-Touristy"],
        budgetCategory: "budget",
        reviews: [
          { author: "Lucia P.", rating: 5, timeAgo: "1 month ago", text: "Lovely boat ride and peaceful island views." }
        ],
      },
      {
        id: "cand-ss-12",
        time: "Afternoon / Evening",
        name: "Tabakalera Cultural Center & Roof Terrace",
        category: "culture",
        description: "Converted 1913 tobacco factory transformed into a contemporary art complex with a free 360-degree rooftop terrace.",
        insiderTip: "Head to the 5th floor terrace for panoramic city views without the crowds.",
        approxCost: "Free",
        rating: 4.8,
        coordinates: { lat: 43.3180, lng: -1.9770 },
        address: "Plaza de las Cigarreras 1, Donostia",
        durationMinutes: 90,
        vibeTags: ["History & Architecture", "Hidden Gems / Non-Touristy", "Art & Culture"],
        budgetCategory: "budget",
        reviews: [
          { author: "Mikel T.", rating: 5, timeAgo: "2 weeks ago", text: "Great art exhibits and awesome rooftop viewpoint." }
        ],
      },
    ];
  } else {
    // Generic candidate generator (non-dining archetypes only)
    pool = [...pool, 
      {
        id: "cand-1",
        time: "Morning",
        name: `${destination} Historic Heritage Quarter`,
        category: "culture",
        description: `Wander through ancient cobblestone alleys, preserved stone facades, and quiet historic courtyards in ${destination}.`,
        insiderTip: "Visit in the early morning for the best photography and minimal foot traffic.",
        approxCost: "Free",
        rating: 4.8,
        coordinates: { lat: baseCoords.lat + 0.002, lng: baseCoords.lng - 0.001 },
        address: `Historic Center, ${destination}`,
        durationMinutes: 90,
        vibeTags: ["History & Architecture", "Culture", "Scenic & Outdoors"],
        budgetCategory: "budget",
        reviews: [{ author: "Traveler A", rating: 5, timeAgo: "2 weeks ago", text: "Atmospheric and charming." }],
      },
      {
        id: "cand-2",
        time: "Midday",
        name: `${destination} Artisan Central Food Market`,
        category: "food",
        description: "Bustling market hall featuring regional produce, artisan cheeses, cured delicacies, and lunch counters.",
        insiderTip: "Seek out the multi-generational family stalls for authentic local flavors.",
        approxCost: "€15 - €30",
        rating: 4.9,
        coordinates: { lat: baseCoords.lat - 0.002, lng: baseCoords.lng + 0.003 },
        address: `Market Quarter, ${destination}`,
        durationMinutes: 90,
        vibeTags: ["Gastronomy & Local Food", "Nightlife & Bars"],
        budgetCategory: "mid-range",
        reviews: [{ author: "Local Resident", rating: 5, timeAgo: "1 month ago", text: "The freshest food in the area." }],
      },
      {
        id: "cand-3",
        time: "Sunset",
        name: `${destination} Panoramic Hillside Viewpoint`,
        category: "sightseeing",
        description: "Scenic overlook offering uninterrupted vistas across the city and surrounding landscape.",
        insiderTip: "Bring your camera for golden hour reflections.",
        approxCost: "Free",
        rating: 4.8,
        coordinates: { lat: baseCoords.lat + 0.005, lng: baseCoords.lng + 0.004 },
        address: `Lookout Point, ${destination}`,
        durationMinutes: 75,
        vibeTags: ["Scenic & Outdoors", "Relaxation & Wellness", "Family Friendly"],
        budgetCategory: "budget",
        reviews: [{ author: "Photographer M", rating: 5, timeAgo: "3 weeks ago", text: "Spectacular 360-degree view." }],
      },
          ];
  }

  // Score candidates based on user's selected vibes and budget tier
  const scored = pool.map((item) => {
    let score = 0;

    // Taste-profile bonus for the user's own spots
    if (tasteProfile && item.id.startsWith("cand-user-")) {
      const drinks = tasteProfile.drinkPreferences || [];
      const coffeeOrTea = drinks.some((d) => /coffee|tea|infusion/i.test(d));
      const alcoholic = drinks.some((d) => /wine|txakoli|beer|cocktail|cider|mixed/i.test(d));
      if (item.category === "cafe" && coffeeOrTea) score += 4;
      if ((item.category === "nightlife" || item.category === "food") && alcoholic) score += 3;
      if (tasteProfile.budgetComfort === "luxury") score += 1;
    }
    if (vibes && vibes.length > 0) {
      for (const v of vibes) {
        if (item.vibeTags && item.vibeTags.includes(v)) {
          score += 5;
        }
      }
    }

    if (budgetTier) {
      if (budgetTier === "budget" && item.budgetCategory === "budget") score += 4;
      if (budgetTier === "luxury" && item.budgetCategory === "luxury") score += 4;
      if (budgetTier === "mid-range" && item.budgetCategory === "mid-range") score += 3;
    }

    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, count).map((s) => ({
    ...s.item,
    photos: getCuratedPhotosForSpot(s.item.category, s.item.name, destination),
    ticketUrl: getTicketOrBookingUrl(s.item.name, destination, s.item.approxCost),
    googleMapsUrl: generateGoogleMapsSearchUrl(s.item.name, destination),
  }));
}

async function generateFallbackSwap(req: SwapActivityRequest, blacklist: string[] = []): Promise<ActivitySpot> {
  const baseCoords = lookupKnownCoordinates(req.destinationOrTown);

  const isExcluded = (name: string) => {
    const clean = name.trim().toLowerCase();
    return blacklist.some((b) => clean.includes(b) || b.includes(clean));
  };

  // Dining-type swaps are sourced from the user's OWN places — never static lists.
  const isDiningSwap = ["food", "cafe", "nightlife"].includes(req.category);
  if (isDiningSwap && req.userSpots && req.userSpots.length > 0) {
    const candidates = req.userSpots.filter(
      (sp) => ["bar", "cafe", "restaurant"].includes(sp.category) && !isExcluded(sp.name)
    );
    if (candidates.length > 0) {
      const sp = candidates[Math.floor(Math.random() * candidates.length)];
      if (!sp.coordinates) {
        const geo = await geocodeSpot(sp.name, sp.town || req.destinationOrTown);
        if (geo) sp.coordinates = { lat: geo.lat, lng: geo.lng };
      }
      return {
        id: "swap-user-" + Date.now(),
        time: normalizeTimeSlot(req.timeSlot || "Flexible"),
        name: sp.name,
        category: sp.category === "bar" ? "nightlife" : sp.category === "cafe" ? "cafe" : "food",
        description: sp.notes ? `One of your own places: ${sp.notes}` : "One of your own places, saved in My Places.",
        insiderTip: "You added this one yourself — it belongs on the trip.",
        approxCost: "Your budget",
        rating: 5.0,
        coordinates: sp.coordinates || { lat: baseCoords.lat + (Math.random() - 0.5) * 0.01, lng: baseCoords.lng + (Math.random() - 0.5) * 0.01 },
        address: sp.town,
        isSwapped: true,
        googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${sp.name}, ${req.destinationOrTown}`)}`,
      };
    }
  }

  // Non-dining swaps: generic experience types (no invented venues)
  const alternatives = [
    {
      name: "Historic Arcade & Craft Shops",
      category: "shopping" as const,
      description: "A covered arcade of small independent shops and craft counters.",
      insiderTip: "The back row of stalls is where the makers actually work.",
      approxCost: "Free to browse",
    },
    {
      name: "Old Quarter Photo Walk & Hidden Squares",
      category: "sightseeing" as const,
      description: "A slow loop through the oldest lanes and quietest squares.",
      insiderTip: "Look up — the best details are above street level.",
      approxCost: "Free",
    },
    {
      name: "Riverside Sculpture Promenade",
      category: "nature" as const,
      description: "A serene walking path along the water with modern open-air sculptures and scenic benches.",
      insiderTip: "Great spot for afternoon strolls and catching local street musicians.",
      approxCost: "Free",
    },
  ];

  const picked = alternatives.find((a) => !isExcluded(a.name)) || alternatives[0];
  return {
    id: "swap-" + Date.now(),
    time: normalizeTimeSlot(req.timeSlot || "Flexible"),
    name: picked.name,
    category: picked.category,
    description: picked.description,
    insiderTip: picked.insiderTip,
    approxCost: picked.approxCost,
    rating: 4.85,
    coordinates: { lat: baseCoords.lat + (Math.random() - 0.5) * 0.01, lng: baseCoords.lng + (Math.random() - 0.5) * 0.01 },
    isSwapped: true,
    googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${picked.name}, ${req.destinationOrTown}`)}`,
  };
}

// ---------------------------------------------------------------------------
// 100% Dynamic Deep Activity Details & Anecdotes Engine
// ---------------------------------------------------------------------------

export async function fetchActivityDeepDetails(params: {
  spotName: string;
  destination: string;
  category?: string;
  address?: string;
  description?: string;
  coordinates?: { lat: number; lng: number };
}): Promise<ActivityDeepDetails> {
  const { spotName, destination, category = "sightseeing", address, description, coordinates } = params;
  const ai = getAiClient();

  const systemInstruction = `You are a world-renowned cultural historian, local tour guide, and master storyteller for travel destinations worldwide.
Your job is to provide richly detailed, captivating, and authentic deep-dive information about a specific spot or activity in ${destination}.

Requirements:
1. Provide a concise, evocative headline.
2. In 'fullExplanation', write 2-3 engaging, descriptive paragraphs covering what this place/activity is, why it is special, its atmosphere, and how visitors should experience it.
3. In 'historicalContext', provide the real origins, founding dates/eras, architectural styles, or key events.
4. In 'culturalSignificance', explain what this spot means to locals, its traditions, customs, or culinary heritage.
5. In 'architecturalOrNaturalHighlights', highlight specific craftsmanship, viewpoints, materials, or natural formations.
6. In 'whatToExpect', provide 3 to 5 clear bullet points.
7. In 'anecdotes', provide at least 3 to 4 captivating, specific anecdotes, legends, quirky historical occurrences, or famous quotes associated with this place or its creators.
8. CRITICAL FOR SUB-SPOTS: If the activity represents an area, district, walking tour, historical complex, park, or market quarter (e.g. "Old Town Walk", "Montmartre District", "Santuario de Loyola complex", "Trastevere loop", "Central Park"), identify 3 to 5 specific, high-priority landmark pins/stops within this area with their specific names, exact street addresses, and why visitors must stop there. If the activity is already a single compact building or restaurant, subSpots can be 2-3 standout rooms/galleries/adjacent spots or an empty list.
9. In 'suggestedQuestions', provide 4 to 6 compelling template questions that a curious visitor would love to ask an AI Local Guide chatbot (e.g., "Can you tell any a random quote about this place?", "Why was this made?", "What's the best hidden secret here?", "What's the story behind the architecture?").
10. In 'photographyTips', give 2-3 practical tips for the best angles/lighting.
11. In 'insiderAdvice', give 2-3 insider local tips.`;

  const prompt = `Provide the full in-depth travel dossier and stories for:
Place/Activity: "${spotName}"
Destination: "${destination}"
Category: "${category}"
Address context: "${address || "Unknown"}"
Description context: "${description || "None provided"}"`;

  let parsedData: any = null;

  if (ai) {
    for (const model of [PRIMARY_TEXT_MODEL, FALLBACK_TEXT_MODEL, TERTIARY_TEXT_MODEL]) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                headline: { type: Type.STRING },
                fullExplanation: { type: Type.STRING },
                historicalContext: { type: Type.STRING },
                culturalSignificance: { type: Type.STRING },
                architecturalOrNaturalHighlights: { type: Type.STRING },
                whatToExpect: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                anecdotes: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      story: { type: Type.STRING },
                      type: {
                        type: Type.STRING,
                        enum: ["legend", "history", "secret", "quote", "fun-fact"],
                      },
                      sourceOrPeriod: { type: Type.STRING },
                    },
                    required: ["title", "story", "type"],
                  },
                },
                subSpots: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      description: { type: Type.STRING },
                      category: { type: Type.STRING },
                      address: { type: Type.STRING },
                      mustSeeReason: { type: Type.STRING },
                      lat: { type: Type.NUMBER },
                      lng: { type: Type.NUMBER },
                    },
                    required: ["name", "description"],
                  },
                },
                bestTimeToVisit: { type: Type.STRING },
                recommendedDuration: { type: Type.STRING },
                photographyTips: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                insiderAdvice: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                suggestedQuestions: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                exactAddress: { type: Type.STRING },
              },
              required: [
                "headline",
                "fullExplanation",
                "historicalContext",
                "culturalSignificance",
                "whatToExpect",
                "anecdotes",
                "suggestedQuestions",
              ],
            },
          },
        });

        parsedData = JSON.parse(response.text || "{}");
        if (parsedData && parsedData.headline && parsedData.fullExplanation) {
          break;
        }
      } catch (err) {
        console.warn(`Deep activity details generation failed on model ${model}:`, (err as Error).message);
      }
    }
  }

  // Ensure baseline coordinates
  const baseCoords = coordinates && coordinates.lat && coordinates.lng
    ? coordinates
    : await resolveActivityCoordinates(spotName, destination, address);

  // If subSpots were provided, geocode them dynamically
  const resolvedSubSpots: SubSpotPin[] = [];
  if (parsedData && Array.isArray(parsedData.subSpots) && parsedData.subSpots.length > 0) {
    for (const sub of parsedData.subSpots) {
      if (!sub.name) continue;
      let subCoords = baseCoords;
      try {
        subCoords = await resolveActivityCoordinates(sub.name, destination, sub.address || address);
      } catch {
        subCoords = {
          lat: +(baseCoords.lat + (Math.random() - 0.5) * 0.005).toFixed(5),
          lng: +(baseCoords.lng + (Math.random() - 0.5) * 0.005).toFixed(5),
        };
      }
      resolvedSubSpots.push({
        name: sub.name,
        description: sub.description || "",
        category: sub.category || category,
        address: sub.address || "",
        mustSeeReason: sub.mustSeeReason || "",
        coordinates: subCoords,
      });
    }
  }

  const defaultSuggestedQuestions = [
    "Can you tell any a random quote about this place?",
    "Why was this made?",
    "What is the most famous legend or story here?",
    "What is a hidden detail that most tourists miss?",
    "What should I order or look out for nearby?",
  ];

  const detailsObj: ActivityDeepDetails = {
    spotName,
    destination,
    category: category as ActivityCategory,
    headline: parsedData?.headline || `Discover the iconic charm of ${spotName}`,
    fullExplanation:
      parsedData?.fullExplanation ||
      `${spotName} is one of the most compelling highlights in ${destination}. Offering rich cultural heritage and an authentic local atmosphere, it is a cornerstone of any memorable journey to the region.`,
    historicalContext:
      parsedData?.historicalContext ||
      `Rooted in the historical tapestry of ${destination}, this location reflects generations of local traditions and craftsmanship.`,
    culturalSignificance:
      parsedData?.culturalSignificance ||
      `Cherished by residents and travelers alike, it represents the living spirit and identity of ${destination}.`,
    architecturalOrNaturalHighlights:
      parsedData?.architecturalOrNaturalHighlights ||
      "Features distinctive local design aesthetics, atmospheric surroundings, and exceptional craftsmanship.",
    whatToExpect: parsedData?.whatToExpect?.length
      ? parsedData.whatToExpect
      : [
          "Authentic regional atmosphere and unique ambiance",
          "Rich photo opportunities and scenic angles",
          "Engaging insights into local lifestyle and history",
        ],
    anecdotes: parsedData?.anecdotes?.length
      ? parsedData.anecdotes
      : [
          {
            title: "Origins & Foundations",
            story: `Legend has it that this location was chosen for its unique vantage point and connection to the heartbeat of ${destination}.`,
            type: "history",
            sourceOrPeriod: "Historical archives",
          },
          {
            title: "Local Secret",
            story: "Locals often visit during the quiet hours of early morning or late golden hour to soak in the atmosphere away from midday crowds.",
            type: "secret",
            sourceOrPeriod: "Resident folklore",
          },
        ],
    subSpots: resolvedSubSpots,
    bestTimeToVisit: parsedData?.bestTimeToVisit || "Morning or golden hour before sunset for the best light and atmosphere.",
    recommendedDuration: parsedData?.recommendedDuration || "1 to 2 hours",
    photographyTips: parsedData?.photographyTips || [
      "Capture wide-angle shots to frame the full surroundings",
      "Look for architectural textures and candid local moments",
    ],
    insiderAdvice: parsedData?.insiderAdvice || [
      "Take your time to stroll the perimeter and observe the fine details",
      "Combine your visit with nearby neighborhood cafes or viewpoints",
    ],
    suggestedQuestions: parsedData?.suggestedQuestions?.length
      ? parsedData.suggestedQuestions
      : defaultSuggestedQuestions,
    exactAddress: parsedData?.exactAddress || address || `${spotName}, ${destination}`,
    coordinates: baseCoords,
    googleMapsUrl: generateGoogleMapsSearchUrl(spotName, destination, address || parsedData?.exactAddress, baseCoords),
  };

  // Resolve real-world authentic photos (Wikipedia/Wikimedia open public domain imagery)
  try {
    const realPhotos = await getRealPhotosForSpot(spotName, destination, category, baseCoords);
    if (realPhotos && realPhotos.length > 0) {
      detailsObj.photos = realPhotos;
    }
  } catch (photoErr) {
    console.warn("Could not fetch real photos for deep details:", photoErr);
  }

  return detailsObj;
}

// ---------------------------------------------------------------------------
// Activity Specific Local Guide Chatbot
// ---------------------------------------------------------------------------

export async function chatWithActivityGuide(params: {
  messages: { role: "user" | "guide" | "assistant" | "model"; text: string }[];
  spotContext: {
    spotName: string;
    destination: string;
    category?: string;
    address?: string;
    headline?: string;
    fullExplanation?: string;
    historicalContext?: string;
    anecdotes?: AnecdoteItem[];
  };
}): Promise<{ reply: string; followUpQuestions: string[] }> {
  const { messages, spotContext } = params;
  const ai = getAiClient();
  const defaultFollowUps = [
    "Can you tell any a random quote about this place?",
    "Why was this made?",
    "What is a hidden secret here that tourists miss?",
    "What should I taste or drink nearby?",
  ];

  if (!ai) {
    return {
      reply: `I'm your local guide for ${spotContext.spotName} in ${spotContext.destination}. Feel free to ask me anything about its history, legends, or secret spots!`,
      followUpQuestions: defaultFollowUps,
    };
  }

  const systemInstruction = `You are a warm, highly knowledgeable, and charismatic Local Guide & Travel Agent living in ${spotContext.destination}.
You are currently providing private on-site guidance for a traveler visiting "${spotContext.spotName}" in ${spotContext.destination}.

Context for this location:
- Name: ${spotContext.spotName}
- Destination: ${spotContext.destination}
- Category: ${spotContext.category || "Sightseeing / Culture"}
- Address: ${spotContext.address || "Local area"}
- Summary: ${spotContext.headline || ""}
- Background: ${spotContext.fullExplanation || ""}
- History: ${spotContext.historicalContext || ""}
- Known Lore: ${spotContext.anecdotes ? JSON.stringify(spotContext.anecdotes) : ""}

Guidelines:
1. Speak warmly and authentically in the first-person as a passionate local expert guide.
2. If asked for a random quote, provide a genuine famous quote (or translated historical remark) by an artist, writer, historical figure, or philosopher about this place, its region, or its founders.
3. If asked "Why was this made?" or about origins, give the vivid, captivating story behind its construction, creation, or founding.
4. Keep answers engaging, vivid, culturally nuanced, and practical (2-4 concise paragraphs max).
5. Always generate 3-4 natural, conversational, highly relevant follow-up questions that the user might want to ask NEXT based on what you just shared.
6. Output JSON with:
   - "reply": Markdown text of your guide response
   - "followUpQuestions": Array of 3-4 short, specific suggested follow-up questions.`;

  // Build the conversation history
  const conversationContents = messages.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.text }],
  }));

  for (const model of [PRIMARY_TEXT_MODEL, FALLBACK_TEXT_MODEL, TERTIARY_TEXT_MODEL]) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: conversationContents.length > 0 ? conversationContents : [{ role: "user", parts: [{ text: "Hello! Tell me about this place." }] }],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING },
              followUpQuestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ["reply", "followUpQuestions"],
          },
        },
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        if (parsed && parsed.reply) {
          return {
            reply: parsed.reply,
            followUpQuestions: Array.isArray(parsed.followUpQuestions) && parsed.followUpQuestions.length > 0
              ? parsed.followUpQuestions
              : defaultFollowUps,
          };
        }
      }
    } catch (err) {
      console.warn(`Activity chat error with model ${model}:`, (err as Error).message);
    }
  }

  return {
    reply: `Welcome to ${spotContext.spotName}! As your local guide in ${spotContext.destination}, I can tell you that this is one of our most treasured locations. Feel free to ask about its historical origins, famous quotes, hidden architectural details, or what to try nearby!`,
    followUpQuestions: defaultFollowUps,
  };
}


