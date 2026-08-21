/**
 * Shared time parsing & formatting utilities.
 * Used by both the client (sorting, display) and the server (constraint enforcement).
 */

/** Parse a human time string ("09:30 AM", "14:00", "Evening", "13:00 PM") into fractional hours (0-24). */
export function parseTimeToHours(timeStr: string): number {
  if (!timeStr) return 12;
  const str = timeStr.trim().toLowerCase();
  const match = str.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) {
    if (str.includes("morning")) return 9;
    if (str.includes("noon") || str.includes("lunch") || str.includes("midday")) return 12;
    if (str.includes("afternoon")) return 14;
    if (str.includes("evening") || str.includes("night") || str.includes("dinner") || str.includes("sunset")) return 18;
    return 12;
  }

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const ampm = match[3] ? match[3].toLowerCase() : undefined;

  if (ampm === "pm" && hours < 12) {
    hours += 12;
  } else if (ampm === "am" && hours === 12) {
    hours = 0;
  }

  // Guard against impossible times coming from malformed AI output
  if (hours > 23) hours = 23;

  return hours + minutes / 60;
}

function formatHour12(hours: number, minutes: number): string {
  const h24 = ((Math.floor(hours) % 24) + 24) % 24;
  const suffix = h24 >= 12 ? "PM" : "AM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  const mm = String(Math.round(minutes)).padStart(2, "0");
  return `${String(h12).padStart(2, "0")}:${mm} ${suffix}`;
}

/** Format fractional 24h hours (e.g. 14.5) as a clean 12-hour token ("02:30 PM"). */
export function formatHoursTo12(fractionalHours: number): string {
  const h = Math.floor(fractionalHours);
  const m = Math.round((fractionalHours - h) * 60);
  return formatHour12(h, m);
}

/**
 * Normalize a single time-of-day token.
 * Fixes malformed hybrid formats such as "13:00 PM", "14:30 PM" or 24h "16:30"
 * into clean 12-hour form ("01:00 PM", "02:30 PM", "04:30 PM").
 * Tokens it cannot understand are returned unchanged.
 */
export function normalizeTimeToken(token: string): string {
  const trimmed = token.trim();
  const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return trimmed;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const ampm = match[3] ? match[3].toLowerCase() : undefined;

  const is24h = hours > 12;
  const hasRedundantSuffix = ampm !== undefined && ((ampm === "pm" && hours > 12) || (ampm === "am" && hours === 12));

  // Only rewrite times that are malformed; leave clean "09:00 AM" style untouched.
  if (!is24h && !hasRedundantSuffix && ampm) return trimmed;
  if (!is24h && !hasRedundantSuffix && !ampm) return trimmed;

  if (is24h) {
    return formatHour12(hours, minutes);
  }
  // Redundant suffix case, e.g. "13:00 PM" or "12:30 AM" used as 24h
  return formatHour12(hours, minutes);
}

/**
 * Normalize a full time-slot string, typically a range like "13:00 PM - 15:30 PM".
 * Handles "-", "–", "—" and "to" separators. Non-time strings pass through unchanged.
 */
export function normalizeTimeSlot(timeStr: string): string {
  if (!timeStr || typeof timeStr !== "string") return timeStr;
  const parts = timeStr.split(/\s+[-–—]\s+|\s+to\s+/i);
  const normalized = parts.map((p) => normalizeTimeToken(p));
  if (normalized.length === 1) return normalized[0];
  return normalized.join(" - ");
}
