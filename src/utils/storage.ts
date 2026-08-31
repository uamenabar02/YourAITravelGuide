import { ItineraryPlan, ActivityHistoryItem, ActivitySpot, PermanentSkip, UserSpot, TasteProfile } from "../types";

const SAVED_TRIPS_KEY = "localexplorer_saved_trips_v1";
const CURRENT_SESSION_PLAN_KEY = "localexplorer_current_session_plan_v1";
const ACTIVITY_HISTORY_KEY = "localexplorer_activity_history_v1";
const PERMANENT_SKIPS_KEY = "localexplorer_permanent_skips_v1";
const MY_SPOTS_KEY = "localexplorer_my_spots_v1";
const TASTE_PROFILE_KEY = "localexplorer_taste_profile_v1";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// --- Smart Merge Helpers for Cloud Sync ---

export function mergeSavedTrips(local: ItineraryPlan[], incoming: ItineraryPlan[]): ItineraryPlan[] {
  const map = new Map<string, ItineraryPlan>();
  // Add incoming first
  incoming.forEach((trip) => {
    if (trip && trip.id) {
      map.set(trip.id, trip);
    }
  });
  // Local items overwrite or add
  local.forEach((trip) => {
    if (trip && trip.id) {
      map.set(trip.id, trip);
    }
  });
  return Array.from(map.values());
}

export function mergeMySpots(local: UserSpot[], incoming: UserSpot[]): UserSpot[] {
  const map = new Map<string, UserSpot>();
  incoming.forEach((spot) => {
    if (spot && (spot.id || spot.name)) {
      map.set(spot.id || spot.name.toLowerCase(), spot);
    }
  });
  local.forEach((spot) => {
    if (spot && (spot.id || spot.name)) {
      map.set(spot.id || spot.name.toLowerCase(), spot);
    }
  });
  return Array.from(map.values());
}

export function mergePermanentSkips(local: PermanentSkip[], incoming: PermanentSkip[]): PermanentSkip[] {
  const map = new Map<string, PermanentSkip>();
  incoming.forEach((skip) => {
    if (skip && skip.name) {
      map.set(skip.name.toLowerCase(), skip);
    }
  });
  local.forEach((skip) => {
    if (skip && skip.name) {
      map.set(skip.name.toLowerCase(), skip);
    }
  });
  return Array.from(map.values());
}

export function mergeActivityHistory(local: ActivityHistoryItem[], incoming: ActivityHistoryItem[]): ActivityHistoryItem[] {
  const map = new Map<string, ActivityHistoryItem>();
  const cutoff = Date.now() - THIRTY_DAYS_MS;
  incoming.forEach((item) => {
    if (item && item.timestamp >= cutoff) {
      map.set(item.id || `${item.name}-${item.location}`, item);
    }
  });
  local.forEach((item) => {
    if (item && item.timestamp >= cutoff) {
      map.set(item.id || `${item.name}-${item.location}`, item);
    }
  });
  return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp).slice(0, 200);
}

export function mergeTasteProfiles(local: TasteProfile | null, incoming: TasteProfile | null): TasteProfile | null {
  if (!local) return incoming;
  if (!incoming) return local;
  return (incoming.updatedAt || 0) >= (local.updatedAt || 0) ? incoming : local;
}

// --- Notification helper for real-time cloud sync ---

export function notifyLocalDataChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("localexplorer_data_changed"));
    window.dispatchEvent(new Event("storage"));
  }
}

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
    notifyLocalDataChanged();
  } catch (err) {
    console.error("Failed to save trip to localStorage:", err);
  }
}

export function deleteSavedTrip(id: string): void {
  try {
    const current = getSavedTrips();
    const deletedTrip = current.find((t) => t.id === id);
    const updated = current.filter((t) => t.id !== id);
    localStorage.setItem(SAVED_TRIPS_KEY, JSON.stringify(updated));

    // Clear cached activity details for the deleted trip's spots or destination
    try {
      const keysToRemove: string[] = [];
      const rawDest = deletedTrip?.destinationOrTown?.toLowerCase() || "";
      const destTag = rawDest.replace(/[^a-z0-9]/g, "");
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("act_details_cache_")) {
          const lowerKey = key.toLowerCase();
          const cleanKey = lowerKey.replace(/[^a-z0-9]/g, "");
          if (destTag && cleanKey.includes(destTag)) {
            keysToRemove.push(key);
          } else if (
            deletedTrip &&
            deletedTrip.days.some((d) =>
              d.activities.some(
                (a) =>
                  (a.id && lowerKey.includes(a.id.toLowerCase())) ||
                  (a.name && lowerKey.includes(a.name.toLowerCase().replace(/[^a-z0-9]/g, "_")))
              )
            )
          ) {
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.warn("Error cleaning cached details on trip deletion:", e);
    }

    notifyLocalDataChanged();
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
    notifyLocalDataChanged();
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
    notifyLocalDataChanged();
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
    notifyLocalDataChanged();
  } catch (err) {
    console.error("Failed to remove history item:", err);
  }
}

export function clearActivityHistory(): void {
  localStorage.removeItem(ACTIVITY_HISTORY_KEY);
  notifyLocalDataChanged();
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
    notifyLocalDataChanged();
  } catch (err) {
    console.error("Failed to add permanent skip:", err);
  }
}

export function removePermanentSkip(id: string): void {
  try {
    const current = getPermanentSkips();
    const updated = current.filter((s) => s.id !== id);
    localStorage.setItem(PERMANENT_SKIPS_KEY, JSON.stringify(updated));
    notifyLocalDataChanged();
  } catch (err) {
    console.error("Failed to remove permanent skip:", err);
  }
}

export function moveHistoryItemToPermanentSkips(historyItem: ActivityHistoryItem): void {
  addPermanentSkip(historyItem.name);
  removeHistoryItem(historyItem.id);
}

export function movePermanentSkipToHistory(skip: PermanentSkip, defaultLocation: string = "Local Area"): void {
  recordActivityVisit(
    {
      id: skip.id,
      name: skip.name,
      category: "culture",
      description: "",
      insiderTip: "",
      address: defaultLocation,
      time: "",
      approxCost: "",
      coordinates: { lat: 0, lng: 0 },
    },
    defaultLocation
  );
  removePermanentSkip(skip.id);
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
    notifyLocalDataChanged();
  } catch (err) {
    console.error("Failed to save My Spot:", err);
  }
  return newSpot;
}

export function removeMySpot(id: string): void {
  try {
    const current = getMySpots();
    localStorage.setItem(MY_SPOTS_KEY, JSON.stringify(current.filter((s) => s.id !== id)));
    notifyLocalDataChanged();
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
    notifyLocalDataChanged();
  } catch (err) {
    console.error("Failed to save taste profile:", err);
  }
}

export function clearTasteProfile(): void {
  localStorage.removeItem(TASTE_PROFILE_KEY);
  notifyLocalDataChanged();
}

/** Check if an activity spot has been recorded in the 30-day visit history */
export function isActivityVisited(name: string): boolean {
  if (!name) return false;
  const history = getActivityHistory();
  return history.some((h) => h.name.toLowerCase() === name.toLowerCase());
}

/** Toggle visited status for an activity spot in the 30-day visit history */
export function toggleActivityVisited(
  name: string,
  location: string,
  category: any,
  approxCost?: string
): boolean {
  if (!name) return false;
  const history = getActivityHistory();
  const existing = history.find((h) => h.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    removeHistoryItem(existing.id);
    return false;
  } else {
    recordActivityVisit(
      {
        id: "spot-" + Date.now(),
        time: "",
        name,
        category: category || "sightseeing",
        description: "",
        insiderTip: "",
        approxCost: approxCost || "Free",
        coordinates: { lat: 0, lng: 0 },
      },
      location
    );
    return true;
  }
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
