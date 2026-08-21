export type AppMode = 'vacation' | 'hometown';

export type PaceType = 'relaxed' | 'balanced' | 'action-packed';
export type BudgetTier = 'budget' | 'mid-range' | 'luxury';

export type TimeAvailability = 'quick' | 'half-day' | 'full-day';

export type ActivityCategory =
  | 'food'
  | 'nature'
  | 'culture'
  | 'sightseeing'
  | 'hidden-gem'
  | 'shopping'
  | 'relaxation'
  | 'nightlife'
  | 'cafe'
  | 'entertainment';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface PlaceReview {
  author: string;
  rating: number;
  timeAgo?: string;
  text: string;
}

export interface TransitInfo {
  mode: 'walk' | 'transit' | 'drive' | 'funicular' | 'boat' | 'taxi';
  duration: string; // e.g. "8 min walk"
  distance?: string; // e.g. "650m"
  instructions?: string; // e.g. "Scenic stroll along Ondarreta promenade towards the rocky headland"
}

export interface ActivitySpot {
  id: string;
  time: string; // e.g. "09:00 AM - 10:30 AM" or "Morning"
  name: string;
  category: ActivityCategory;
  description: string;
  insiderTip: string;
  approxCost: string; // e.g. "Free", "$15 - $25", "€30"
  ticketUrl?: string; // Direct link to purchase ticket or booking info
  rating?: number; // e.g. 4.8
  coordinates: Coordinates;
  address?: string;
  bestFor?: string;
  durationMinutes?: number;
  tags?: string[];
  isSwapped?: boolean;
  isLiveEvent?: boolean;
  eventDetails?: {
    eventType?: string; // e.g. "Concert", "Street Market", "Race", "Festival", "Exhibition"
    dates?: string; // e.g. "Aug 21-23" or "Tonight 8 PM"
    venue?: string;
    sourceUrl?: string;
  };
  photos?: string[];
  googleMapsUrl?: string;
  reviews?: PlaceReview[];
  allOptions?: ActivitySpot[]; // Complete list of choices (Option A, Option B, Option C)
  alternativeOptions?: ActivitySpot[]; // Multiple choice options for user to pick from
  selectedOptionIndex?: number;
  transitToNext?: TransitInfo;
}

export interface CandidateSpot extends ActivitySpot {
  vibeCategories?: string[];
  matchScore?: number;
  isLiked?: boolean;
}

export interface DailyPlan {
  dayNumber: number;
  dayTitle: string; // e.g. "Day 1: Historic Heart & Sunset Tapas"
  theme: string; // e.g. "Art & Culinary Discovery"
  summary: string;
  activities: ActivitySpot[];
  estimatedTotalBudget?: string;
  destinationName?: string; // For multi-destination trips
}

export interface DestinationStop {
  id: string;
  city: string;
  country?: string;
  region?: string;
  days: number;
  arrivalHour?: string; // e.g. "14:00"
  departureHour?: string; // e.g. "11:00"
  coordinates?: Coordinates;
}

export interface ItineraryPlan {
  id: string;
  mode: AppMode;
  title: string;
  destinationOrTown: string;
  summary: string;
  highlights: string[];
  totalDays: number;
  days: DailyPlan[];
  createdAt: string;
  tags: string[];
  weatherSummary?: string;
  mapCenter: Coordinates;
  mapZoom: number;
  customPace?: PaceType;
  budgetTier?: BudgetTier;
  budgetType?: 'tier' | 'exact';
  exactBudgetPerDay?: number;
  currency?: string;
  groupSize?: number;
  destinations?: DestinationStop[];
  arrivalHour?: string;
  departureHour?: string;
}

export interface VacationPreferences {
  destination: string;
  duration: number; // 1 - 30 days
  pace: PaceType;
  vibes: string[];
  budgetTier: BudgetTier;
  budgetType?: 'tier' | 'exact';
  exactBudgetPerDay?: number;
  currency?: string;
  groupSize: number; // e.g. 1, 2, 4
  permanentSkips?: string[]; // Names permanently excluded by the resident (never suggest again)
  userSpots?: UserSpot[]; // The traveler's own favorite places (dining is sourced from here, never static lists)
  tasteProfile?: TasteProfile; // How the user likes to eat & drink (personalizes dining suggestions)
  customNotes?: string;
  isMultiDestination?: boolean;
  destinations?: DestinationStop[];
  arrivalHour?: string; // e.g. "14:00"
  departureHour?: string; // e.g. "11:00"
  enableSwiper?: boolean;
  likedSpots?: ActivitySpot[];
  skippedSpots?: ActivitySpot[];
}

export interface HometownPreferences {
  location: string;
  radiusKm: number; // 5 - 50 km
  timeAvailable: TimeAvailability;
  occasion: string;
  weatherCondition: string;
  currentTemp?: number;
  excludedPlaces?: string[]; // IDs or names of places visited in past 30 days
  permanentSkips?: string[]; // Names permanently excluded by the resident (never suggest again)
  userSpots?: UserSpot[]; // The resident's own places — primary source for dining suggestions
  tasteProfile?: TasteProfile; // How the user likes to eat & drink (personalizes dining suggestions)
  customNotes?: string;
  enableSwiper?: boolean;
  likedSpots?: ActivitySpot[];
  skippedSpots?: ActivitySpot[];
}

export interface ActivityHistoryItem {
  id: string;
  name: string;
  location: string;
  category: ActivityCategory;
  timestamp: number; // Date.now()
  approxCost?: string;
}

/** A place the resident has permanently excluded from all future suggestions. */
export interface PermanentSkip {
  id: string;
  name: string;
  addedAt: number; // Date.now()
}

/**
 * A place provided BY THE USER ("My Places"): their own bars, cafés,
 * restaurants and other favorites. Dining recommendations are sourced from
 * these (or live AI search) — never from a static built-in list.
 */
export interface UserSpot {
  id: string;
  name: string;
  category: "bar" | "cafe" | "restaurant" | "other";
  town?: string;
  notes?: string;
  coordinates?: Coordinates; // resolved via geocoding when added
  addedAt: number;
}

/**
 * The user's TASTE PROFILE: how they like to eat & drink.
 * Captured via a questionnaire and used by the AI to recommend dining that
 * fits both the profile and the flow of each day's activities.
 */
export interface TasteProfile {
  diningStyles: string[]; // e.g. "Pintxo / tapas hopping", "Sit-down local restaurant"
  drinkPreferences: string[]; // e.g. "Specialty coffee", "Local wine / txakoli"
  atmospheres: string[]; // e.g. "Quiet & cozy", "Terrace / outdoor seating"
  budgetComfort?: BudgetTier; // € / €€ / €€€
  dietaryNotes?: string; // free text: vegetarian, allergies…
  dislikes: string[]; // things to avoid: "Tourist traps", "Chains"…
  updatedAt: number;
}

export interface WeatherData {
  city: string;
  temperature: number;
  condition: string;
  weatherCode: number;
  iconName: string;
  humidity?: number;
  windSpeed?: number;
  isAutoDetected?: boolean;
}

export interface ActivitySubLocation {
  name: string;
  description: string;
  coordinates: Coordinates;
  address?: string;
  highlight?: string; // e.g. "Must-see", "Hidden gem", "Photo spot"
}

export interface ActivityDetailData {
  detailedDescription: string;
  anecdotes: string[];
  subLocations: ActivitySubLocation[];
  suggestedQuestions: string[];
  historicalContext?: string;
  practicalTips?: string[];
}

export interface ActivityChatMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp?: number;
}

export interface SwapActivityRequest {
  destinationOrTown: string;
  mode: AppMode;
  dayNumber: number;
  timeSlot: string;
  currentActivityName: string;
  category: ActivityCategory;
  vibes: string[];
  budgetTier?: BudgetTier;
  excludedPlaces?: string[];
  userSpots?: UserSpot[]; // So dining swaps can be sourced from the user's own places
  tasteProfile?: TasteProfile; // So dining swaps match how the user likes to eat & drink
}

