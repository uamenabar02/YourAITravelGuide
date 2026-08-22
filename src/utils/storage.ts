import { ItineraryPlan, ActivityHistoryItem, ActivitySpot, PermanentSkip, UserSpot, TasteProfile } from "../types";

const SAVED_TRIPS_KEY = "localexplorer_saved_trips_v1";
const CURRENT_SESSION_PLAN_KEY = "localexplorer_current_session_plan_v1";
const ACTIVITY_HISTORY_KEY = "localexplorer_activity_history_v1";
const PERMANENT_SKIPS_KEY = "localexplorer_permanent_skips_v1";
const MY_SPOTS_KEY = "localexplorer_my_spots_v1";
const TASTE_PROFILE_KEY = "localexplorer_taste_profile_v1";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// --- Saved Trips ---

export function getSavedTrips(): ItineraryPlan[] {
  try {
    const raw = localStorage.getItem(SAVED_TRIPS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to read saved trips from localStorage:", err);
    return [];
  }
}

export function saveTrip(trip: ItineraryPlan): void {
  try {
    const current = getSavedTrips();
    const existingIndex = current.findIndex((t) => t.id === trip.id);
    let updated: ItineraryPlan[];
    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = trip;
    } else {
      updated = [trip, ...current];
    }
    localStorage.setItem(SAVED_TRIPS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to save trip to localStorage:", err);
  }
}

export function deleteSavedTrip(id: string): void {
  try {
    const current = getSavedTrips();
    const updated = current.filter((t) => t.id !== id);
    localStorage.setItem(SAVED_TRIPS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to delete saved trip:", err);
  }
}

export function isTripSaved(id: string): boolean {
  const current = getSavedTrips();
  return current.some((t) => t.id === id);
}

// --- Active Session Persistence ---

export function getCurrentSessionPlan(): ItineraryPlan | null {
  try {
    const raw = localStorage.getItem(CURRENT_SESSION_PLAN_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to read current session plan from localStorage:", err);
    return null;
  }
}

export function saveCurrentSessionPlan(plan: ItineraryPlan | null): void {
  try {
    if (!plan) {
      localStorage.removeItem(CURRENT_SESSION_PLAN_KEY);
    } else {
      localStorage.setItem(CURRENT_SESSION_PLAN_KEY, JSON.stringify(plan));
    }
  } catch (err) {
    console.error("Failed to save current session plan to localStorage:", err);
  }
}

// --- 30-Day Activity History & Deduplication ---

export function getActivityHistory(): ActivityHistoryItem[] {
  try {
    const raw = localStorage.getItem(ACTIVITY_HISTORY_KEY);
    if (!raw) return [];
    const items: ActivityHistoryItem[] = JSON.parse(raw);
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    // Clean up items older than 30 days automatically
    const valid = items.filter((item) => item.timestamp >= cutoff);
    if (valid.length !== items.length) {
      localStorage.setItem(ACTIVITY_HISTORY_KEY, JSON.stringify(valid));
    }
    return valid;
  } catch (err) {
    console.error("Failed to read activity history:", err);
    return [];
  }
}

export function recordActivityVisit(activity: ActivitySpot, location: string): void {
  try {
    const current = getActivityHistory();
    const newItem: ActivityHistoryItem = {
      id: "hist-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      name: activity.name,
      location: location,
      category: activity.category,
      timestamp: Date.now(),
      approxCost: activity.approxCost,
    };
    // Don't duplicate if added in the last 24 hours
    const filtered = current.filter(
      (item) => !(item.name.toLowerCase() === activity.name.toLowerCase() && Date.now() - item.timestamp < 86400000)
    );
    const updated = [newItem, ...filtered];
    localStorage.setItem(ACTIVITY_HISTORY_KEY, JSON.stringify(updated.slice(0, 200)));
  } catch (err) {
    console.error("Failed to record activity visit:", err);
  }
}

export function recordPlanActivities(plan: ItineraryPlan): void {
  for (const day of plan.days) {
    for (const spot of day.activities) {
      recordActivityVisit(spot, plan.destinationOrTown);
    }
  }
}

export function getRecentExcludedPlaces(location?: string): string[] {
  const history = getActivityHistory();
  if (!location) {
    return Array.from(new Set(history.map((h) => h.name)));
  }
  const locLower = location.toLowerCase();
  const matched = history.filter(
    (h) => h.location.toLowerCase().includes(locLower) || locLower.includes(h.location.toLowerCase())
  );
  return Array.from(new Set(matched.map((h) => h.name)));
}

export function removeHistoryItem(id: string): void {
  try {
    const current = getActivityHistory();
    const updated = current.filter((h) => h.id !== id);
    localStorage.setItem(ACTIVITY_HISTORY_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to remove history item:", err);
  }
}

export function clearActivityHistory(): void {
  localStorage.removeItem(ACTIVITY_HISTORY_KEY);
}

// --- Permanent Skips ("never suggest this again") ---

export function getPermanentSkips(): PermanentSkip[] {
  try {
    const raw = localStorage.getItem(PERMANENT_SKIPS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to read permanent skips:", err);
    return [];
  }
}

export function getPermanentSkipNames(): string[] {
  return getPermanentSkips().map((s) => s.name);
}

export function addPermanentSkip(name: string): void {
  const clean = name.trim();
  if (!clean) return;
  try {
    const current = getPermanentSkips();
    const exists = current.some((s) => s.name.toLowerCase() === clean.toLowerCase());
    if (exists) return;
    const updated = [
      {
        id: "skip-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
        name: clean,
        addedAt: Date.now(),
      },
      ...current,
    ];
    localStorage.setItem(PERMANENT_SKIPS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to add permanent skip:", err);
  }
}

export function removePermanentSkip(id: string): void {
  try {
    const current = getPermanentSkips();
    const updated = current.filter((s) => s.id !== id);
    localStorage.setItem(PERMANENT_SKIPS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to remove permanent skip:", err);
  }
}

// --- My Places (user-provided spots: bars, cafés, restaurants, favorites) ---

export function getMySpots(): UserSpot[] {
  try {
    const raw = localStorage.getItem(MY_SPOTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to read My Spots:", err);
    return [];
  }
}

export function addMySpot(spot: Omit<UserSpot, "id" | "addedAt">): UserSpot {
  const newSpot: UserSpot = {
    ...spot,
    id: "myspot-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
    addedAt: Date.now(),
  };
  try {
    const current = getMySpots();
    localStorage.setItem(MY_SPOTS_KEY, JSON.stringify([newSpot, ...current]));
  } catch (err) {
    console.error("Failed to save My Spot:", err);
  }
  return newSpot;
}

export function removeMySpot(id: string): void {
  try {
    const current = getMySpots();
    localStorage.setItem(MY_SPOTS_KEY, JSON.stringify(current.filter((s) => s.id !== id)));
  } catch (err) {
    console.error("Failed to remove My Spot:", err);
  }
}

// --- Taste Profile (how the user likes to eat & drink) ---

export function getTasteProfile(): TasteProfile | null {
  try {
    const raw = localStorage.getItem(TASTE_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      diningStyles: Array.isArray(parsed.diningStyles) ? parsed.diningStyles : [],
      drinkPreferences: Array.isArray(parsed.drinkPreferences) ? parsed.drinkPreferences : [],
      atmospheres: Array.isArray(parsed.atmospheres) ? parsed.atmospheres : [],
      budgetComfort: parsed.budgetComfort,
      dietaryNotes: typeof parsed.dietaryNotes === "string" ? parsed.dietaryNotes : undefined,
      dislikes: Array.isArray(parsed.dislikes) ? parsed.dislikes : [],
      updatedAt: parsed.updatedAt || Date.now(),
    };
  } catch (err) {
    console.error("Failed to read taste profile:", err);
    return null;
  }
}

export function saveTasteProfile(profile: Omit<TasteProfile, "updatedAt">): void {
  try {
    localStorage.setItem(TASTE_PROFILE_KEY, JSON.stringify({ ...profile, updatedAt: Date.now() }));
  } catch (err) {
    console.error("Failed to save taste profile:", err);
  }
}

export function clearTasteProfile(): void {
  localStorage.removeItem(TASTE_PROFILE_KEY);
}

/** Fuzzy match: is this spot name covered by any exclusion list? */
export function isExcludedName(name: string, exclusions: string[]): boolean {
  const clean = name.trim().toLowerCase();
  if (!clean) return false;
  return exclusions.some((ex) => {
    const e = ex.trim().toLowerCase();
    if (!e) return false;
    return clean.includes(e) || e.includes(clean);
  });
}
