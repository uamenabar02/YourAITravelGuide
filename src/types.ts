export type AppMode = 'vacation' | 'hometown';

export type PaceType = 'relaxed' | 'balanced' | 'action-packed';
export type BudgetTier = 'budget' | 'mid-range' | 'luxury';
export type TransportMode = 'public_transit' | 'car' | 'bicycle' | 'taxi';

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
  isLocked?: boolean;
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

export interface AccommodationDetails {
  id?: string;
  name: string;
  location: string;
  description?: string;
  checkInDay?: number; // e.g. Day 1
  checkInHour?: string; // e.g. "15:00"
  checkOutDay?: number; // e.g. Day 3
  checkOutHour?: string; // e.g. "11:00"
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
  transportMode?: TransportMode;
  transportModes?: TransportMode[];
  accommodation?: AccommodationDetails;
  accommodations?: AccommodationDetails[];
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
  transportMode?: TransportMode;
  transportModes?: TransportMode[];
  permanentSkips?: string[]; // Names permanently excluded by the resident (never suggest again)
  userSpots?: UserSpot[]; // The traveler's own favorite places (dining is sourced from here, never static lists)
  tasteProfile?: TasteProfile; // How the user likes to eat & drink (personalizes dining suggestions)
  customNotes?: string;
  isMultiDestination?: boolean;
  destinations?: DestinationStop[];
  arrivalHour?: string; // e.g. "14:00"
  departureHour?: string; // e.g. "11:00"
  accommodation?: AccommodationDetails;
  accommodations?: AccommodationDetails[];
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
  transportMode?: TransportMode;
  transportModes?: TransportMode[];
  excludedPlaces?: string[]; // IDs or names of places visited in past 30 days
  permanentSkips?: string[]; // Names permanently excluded by the resident (never suggest again)
  userSpots?: UserSpot[]; // The resident's own places — primary source for dining suggestions
  tasteProfile?: TasteProfile; // How the user likes to eat & drink (personalizes dining suggestions)
  customNotes?: string;
  accommodation?: AccommodationDetails;
  accommodations?: AccommodationDetails[];
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

export interface SwapActivityRequest {
  currentActivityName: string;
  category: ActivityCategory;
  destinationOrTown: string;
  mode?: AppMode;
  dayNumber: number;
  timeSlot?: string;
  priorActivity?: ActivitySpot | null;
  posteriorActivity?: ActivitySpot | null;
  allItineraryActivityNames?: string[];
  currentItinerarySummary?: string;
  vibes?: string[];
  budgetTier?: BudgetTier;
  pace?: PaceType;
  groupSize?: number;
  meansOfTransport?: string;
  excludedPlaces?: string[];
  permanentSkips?: string[];
  excludedNames?: string[];
  tripVibes?: string[];
  tasteProfile?: TasteProfile;
  userSpots?: UserSpot[];
  isIndoorOnly?: boolean;
  customRequirement?: string;
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

export interface SubSpotPin {
  name: string;
  description: string;
  category?: string;
  coordinates: Coordinates;
  address?: string;
  mustSeeReason?: string;
}

export interface AnecdoteItem {
  title: string;
  story: string;
  type: "legend" | "history" | "secret" | "quote" | "fun-fact";
  sourceOrPeriod?: string;
}

export interface ActivityDeepDetails {
  spotName: string;
  destination: string;
  category: ActivityCategory;
  headline: string;
  fullExplanation: string;
  historicalContext: string;
  culturalSignificance: string;
  architecturalOrNaturalHighlights?: string;
  whatToExpect: string[];
  anecdotes: AnecdoteItem[];
  subSpots?: SubSpotPin[];
  bestTimeToVisit?: string;
  recommendedDuration?: string;
  photographyTips?: string[];
  insiderAdvice?: string[];
  suggestedQuestions: string[];
  exactAddress?: string;
  coordinates: Coordinates;
  googleMapsUrl?: string;
  photos?: string[];
}

export interface ActivityChatMessage {
  id: string;
  sender: "user" | "guide";
  text: string;
  timestamp: number;
}

// --- Feature 1: Offline Pocket Companion Types ---
export interface OfflineSavedPlan {
  planId: string;
  savedAt: number;
  title: string;
  destination: string;
  totalDays: number;
  planData: ItineraryPlan;
  offlineNotes?: string;
  completedActivityIds: string[];
}

// --- Feature 2: Group Collaboration Types ---
export interface ActivityVote {
  upvotes: string[]; // List of member names
  downvotes: string[];
  hearts: string[];
}

export interface ActivityComment {
  id: string;
  activityId: string;
  author: string;
  text: string;
  timestamp: number;
}

export interface GroupPackingItem {
  id: string;
  category: "essentials" | "clothes" | "electronics" | "documents" | "health" | "custom";
  item: string;
  assignedTo?: string;
  checkedBy: string[]; // User names who have checked this item for their own packing
  isChecked?: boolean; // Backwards-compatible fallback
}

export type ExpenseCategory = "food" | "transport" | "accommodation" | "activities" | "shopping" | "general";
export type SplitMode = "equal" | "exact" | "shares";

export interface GroupExpenseItem {
  id: string;
  title: string;
  amount: number;
  paidBy: string;
  currency: string;
  category: ExpenseCategory;
  date: string; // YYYY-MM-DD
  splitMode: SplitMode;
  splitBetween: string[]; // member names involved
  allocations?: Record<string, number>; // exact amount or shares per member
  notes?: string;
  createdAt: number;
}

export interface DebtTransfer {
  from: string;
  to: string;
  amount: number;
}

export interface BalanceSheet {
  member: string;
  totalPaid: number;
  totalOwed: number;
  netBalance: number; // positive = gets back money, negative = owes money
}

export type MemberRole = "organizer" | "editor" | "viewer";

export interface GroupMemberProfile {
  id: string;
  name: string;
  role: MemberRole;
  avatarColor?: string;
  joinedAt?: number;
}

export type GroupAccessLevel = "open_collab" | "invite_only" | "view_only";

export interface GroupAccessSettings {
  accessLevel: GroupAccessLevel;
  inviteCode: string;
  allowGuestsToLogExpenses: boolean;
  allowGuestsToVote: boolean;
}

export interface GroupCollaborationState {
  tripId: string;
  members: string[];
  currentUser: string;
  memberProfiles?: GroupMemberProfile[];
  accessSettings?: GroupAccessSettings;
  votes: Record<string, ActivityVote>; // activityId -> ActivityVote
  comments: Record<string, ActivityComment[]>; // activityId -> comments
  packingList: GroupPackingItem[];
  expenses: GroupExpenseItem[];
  lastUpdated: number;
}

// --- Feature 3: Schedule Adjuster Types ---
export interface ScheduleShiftOptions {
  startActivityId?: string;
  startActivityIndex?: number;
  compressDurations?: boolean;
  destination?: string;
}

export interface ScheduleShiftResult {
  updatedDay: DailyPlan;
  originalDay: DailyPlan;
  delayMinutes: number;
  startActivityIndex: number;
  warnings: string[];
  shiftedActivitiesCount: number;
}


