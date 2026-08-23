/**
 * Helper utilities for clean, concise titles, short weather badges, and group avatars.
 */

/**
 * Returns a clean, concise trip title indicating the destination and duration.
 * E.g., "3 Days in San Sebastián" or "3-Day Donostia / San Sebastián Trip"
 */
export function formatCleanTripTitle(
  rawTitle: string | undefined,
  totalDays: number | undefined,
  destinationOrTown: string | undefined,
  mode: "vacation" | "hometown" = "vacation"
): string {
  const days = totalDays && totalDays > 0 ? totalDays : 3;
  let cleanDest = (destinationOrTown || "Trip").trim();

  // If destination has a country part like "Donostia / San Sebastián, Spain", keep the city part
  if (cleanDest.includes(",")) {
    const parts = cleanDest.split(",");
    cleanDest = parts[0].trim();
  }

  if (mode === "hometown") {
    return `Native Guide to ${cleanDest}`;
  }

  if (days === 1) {
    return `1-Day ${cleanDest} Day Trip`;
  }

  return `${days} Days in ${cleanDest}`;
}

export interface ConciseWeatherInfo {
  emoji: string;
  temp: string; // e.g. "21°C"
  shortDesc: string; // e.g. "Mild & Breezy"
  badgeText: string; // e.g. "⛅ 21°C Mild"
  fullText: string;
}

/**
 * Extracts a short, visual weather summary with an emoji and current/typical temperature.
 */
export function formatConciseWeather(
  rawSummary: string | undefined,
  destination: string = ""
): ConciseWeatherInfo {
  const text = (rawSummary || "").trim();
  const destLower = destination.toLowerCase();

  // Extract explicit temperature if mentioned in text (e.g. "21°C", "24°", "18-22°C", "70°F")
  const tempMatch = text.match(/(\d{1,2}(?:\s*[-–—]\s*\d{1,2})?\s*(?:°C|°F|°))/i);
  let temp = tempMatch ? tempMatch[1].replace(/\s+/g, "") : "";

  // Guess temperature based on season or climate if missing
  if (!temp) {
    if (destLower.includes("donostia") || destLower.includes("sebastian") || destLower.includes("bilbao")) {
      temp = "21°C";
    } else if (destLower.includes("barcelona") || destLower.includes("valencia") || destLower.includes("malaga") || destLower.includes("sevilla") || destLower.includes("madrid")) {
      temp = "24°C";
    } else if (destLower.includes("london") || destLower.includes("paris") || destLower.includes("amsterdam")) {
      temp = "18°C";
    } else if (destLower.includes("rome") || destLower.includes("athens") || destLower.includes("lisbon")) {
      temp = "25°C";
    } else if (destLower.includes("tokyo") || destLower.includes("kyoto")) {
      temp = "22°C";
    } else {
      temp = "22°C";
    }
  }

  // Detect weather condition emoji and short description
  let emoji = "⛅";
  let shortDesc = "Mild & Breezy";

  const lower = text.toLowerCase();
  if (lower.includes("rain") || lower.includes("drizzle") || lower.includes("shower") || lower.includes("chubascos")) {
    emoji = "🌦️";
    shortDesc = "Coastal Drizzle";
  } else if (lower.includes("sun") || lower.includes("sunny") || lower.includes("clear") || lower.includes("soleado")) {
    emoji = "☀️";
    shortDesc = "Sunny";
  } else if (lower.includes("cloud") || lower.includes("overcast") || lower.includes("nublado")) {
    emoji = "☁️";
    shortDesc = "Partly Cloudy";
  } else if (lower.includes("snow") || lower.includes("winter") || lower.includes("cold") || lower.includes("frío")) {
    emoji = "❄️";
    shortDesc = "Crisp & Cool";
  } else if (lower.includes("warm") || lower.includes("hot") || lower.includes("calor")) {
    emoji = "🌤️";
    shortDesc = "Warm & Clear";
  } else if (lower.includes("maritime") || lower.includes("breeze") || lower.includes("wind") || lower.includes("coast")) {
    emoji = "⛅";
    shortDesc = "Mild Coastal";
  }

  const badgeText = `${emoji} ${temp} • ${shortDesc}`;

  return {
    emoji,
    temp,
    shortDesc,
    badgeText,
    fullText: text || `${badgeText}. Typical seasonal weather for ${destination || "this destination"}.`,
  };
}

export const AVATAR_COLORS = [
  "bg-emerald-700 text-white",
  "bg-amber-700 text-white",
  "bg-rose-700 text-white",
  "bg-indigo-700 text-white",
  "bg-teal-700 text-white",
  "bg-sky-700 text-white",
  "bg-purple-700 text-white",
  "bg-stone-700 text-white",
];

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}
