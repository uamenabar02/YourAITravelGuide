import { ItineraryPlan, ActivityHistoryItem, ActivitySpot } from "../types";

const SAVED_TRIPS_KEY = "localexplorer_saved_trips_v1";
const ACTIVITY_HISTORY_KEY = "localexplorer_activity_history_v1";
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
