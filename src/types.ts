export type AppMode = 'vacation' | 'hometown';

export type PaceType = 'relaxed' | 'balanced' | 'action-packed';
export type BudgetTier = 'budget' | 'mid-range' | 'luxury';
export type TransportMode = 'public_transit' | 'walking' | 'car' | 'bicycle' | 'taxi';

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
  mode: 'walk' | 'transit' | 'drive' | 'funicular' | 'boat' | 'taxi' | 'bicycle';
  duration: string; // e.g. "8 min walk"
  distance?: string; // e.g. "650m"
  instructions?: string; // e.g. "Scenic stroll along Ondarreta promenade towards the rocky headland"
}

export interface UsefulLinkItem {
  id: string;
  title: string;
  url: string;
  category?: "official" | "booking" | "maps" | "reviews" | "transit" | "weather" | "custom";
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
  usefulLinks?: UsefulLinkItem[];
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
  address?: string;
  description?: string;
  notes?: string;
  checkInDay?: number; // e.g. Day 1
  checkInHour?: string; // e.g. "15:00"
  checkOutDay?: number; // e.g. Day 3
  checkOutHour?: string; // e.g. "11:00"
}

export interface ItineraryPlan {
  id: string;
  creatorEmail?: string;
  mode: AppMode;
  title: string;
  destinationOrTown: string;
  summary: string;
  highlights: string[];
  totalDays: number;
  days: DailyPlan[];
  createdAt: string;
  tags: string[];
  vibes?: string[];
  selectedVibes?: string[];
  weatherSummary?: string;
  startDate?: string;
  weatherForecast?: WeatherForecastData;
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
  startTime?: string;
  startLocation?: string;
  startLocationCoordinates?: Coordinates;
  endTime?: string;
  endLocation?: string;
  endLocationCoordinates?: Coordinates;
  authorEmail?: string;
  authorName?: string;
  isPublic?: boolean;
  visibility?: 'public' | 'private';
  generationMeta?: AIGenerationMetadata;
}

export interface VacationPreferences {
  destination: string;
  duration: number; // 1 - 30 days
  startDate?: string; // e.g. "2026-09-15"
  pace: PaceType;
  vibes: string[];
  budgetTier: BudgetTier;
  budgetType?: 'tier' | 'exact';
  exactBudgetPerDay?: number;
  currency?: string;
  groupSize: number; // e.g. 1, 2, 4;
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
  weatherForecast?: WeatherForecastData;
  enableSwiper?: boolean;
  likedSpots?: ActivitySpot[];
  skippedSpots?: ActivitySpot[];
  manualCustomSpots?: {
    id: string;
    name: string;
    category?: ActivityCategory;
    location?: string;
    coordinates?: Coordinates;
    notes?: string;
  }[];
  aiSettings?: AISelectionSettings;
}

export interface HometownPreferences {
  location: string;
  radiusKm: number; // 5 - 50 km
  startDate?: string; // e.g. "2026-08-25"
  startTime?: string; // e.g. "09:00" (optional)
  startLocation?: string; // e.g. "Calle Mayor 14, Donostia" (optional)
  startLocationCoordinates?: Coordinates;
  isStartLocationVerified?: boolean;
  endTime?: string; // e.g. "18:00" (optional)
  endLocation?: string; // e.g. "Home address or train station" (optional)
  endLocationCoordinates?: Coordinates;
  isEndLocationVerified?: boolean;
  timeAvailable: TimeAvailability;
  occasion: string;
  occasions?: string[];
  weatherCondition: string;
  currentTemp?: number;
  weatherForecast?: WeatherForecastData;
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
  aiSettings?: AISelectionSettings;
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
  transportModes?: TransportMode[];
  accommodation?: AccommodationDetails;
  accommodations?: AccommodationDetails[];
  startDate?: string;
  weatherForecast?: WeatherForecastData;
  excludedPlaces?: string[];
  permanentSkips?: string[];
  excludedNames?: string[];
  tripVibes?: string[];
  tasteProfile?: TasteProfile;
  userSpots?: UserSpot[];
  isIndoorOnly?: boolean;
  swapReason?: string;
  customRequirement?: string;
  aiSettings?: AISelectionSettings;
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

export interface WeatherForecastDay {
  dayNumber: number; // 1, 2, 3...
  dateStr: string; // e.g. "2026-09-15" or "Oct 12"
  dayOfWeek: string; // e.g. "Tue"
  tempHighC: number;
  tempLowC: number;
  condition: string;
  iconName: string; // Sun, CloudRain, CloudSun, etc.
  precipitationChance: number; // percentage e.g. 15
  humidity?: number;
  uvIndex?: number;
  windSpeedKmH?: number;
  activityTip?: string; // e.g. "Ideal morning for coastal walking"
  clothingAdvice?: string; // e.g. "Light layers + windbreaker"
}

export interface WeatherForecastData {
  destination: string;
  startDate?: string;
  isDateSpecific: boolean; // true if user selected start date
  summary: string; // e.g. "Expect pleasant autumn conditions with mild sunshine and cool evenings."
  avgHighC: number;
  avgLowC: number;
  seasonalityWarnings: string[]; // e.g. ["⚠️ High UV Index between 11:00-15:00", "🧥 Temperature drops 8°C after sunset"]
  packingEssentials: string[]; // e.g. ["Light rain jacket", "Sunglasses", "Comfortable walking shoes"]
  dailyForecast: WeatherForecastDay[];
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
  usefulLinks?: UsefulLinkItem[];
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
  category: "essentials" | "clothes" | "weather" | "activities" | "electronics" | "documents" | "health" | "custom";
  item: string;
  reason?: string;
  assignedTo?: string;
  checkedBy: string[]; // User names who have checked this item for their own packing
  isChecked?: boolean; // Backwards-compatible fallback
}

export type ShoppingCategory =
  | "fresh_produce"
  | "bakery_snacks"
  | "drinks"
  | "pantry_cooking"
  | "toiletries_meds"
  | "camping_gear"
  | "household_misc";

export interface GroupShoppingItem {
  id: string;
  name: string;
  category: ShoppingCategory;
  emoji?: string;
  quantity?: string;
  assignedTo?: string; // member name who claimed to buy this
  status: "needed" | "bought";
  addedBy: string;
  createdAt: number;
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
  claimedByEmail?: string; // Google Account email linked to this member
  claimedByName?: string; // Google Account user display name
  claimedAt?: number; // timestamp when claimed
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
  shoppingList?: GroupShoppingItem[];
  expenses: GroupExpenseItem[];
  lastUpdated: number;
}

export interface SharedTripDoc {
  id: string;
  creatorEmail: string;
  creatorUid?: string;
  creatorName?: string;
  plan: ItineraryPlan;
  collabState: GroupCollaborationState;
  offlineNotes?: string;
  walletPasses?: TravelBookingPass[];
  emergencyInfo?: {
    contacts?: Array<{ name: string; phone: string; relation: string }>;
    localPolice?: string;
    localAmbulance?: string;
    embassyPhone?: string;
    customNotes?: string;
  };
  lastUpdated: number;
  updatedByEmail?: string;
  
  // Community & Visibility properties
  isPublic?: boolean;
  visibility?: "private" | "public" | "passcode";
  passcode?: string;
  rating?: number;
  ratingsCount?: number;
  reviews?: Array<{
    id: string;
    author: string;
    email: string;
    rating: number;
    text: string;
    createdAt: number;
  }>;
  downloadsCount?: number;
  featuredTags?: string[];
  vibes?: string[];
}

export interface UserTripPermissions {
  role: MemberRole;
  memberName: string | null;
  memberProfile?: GroupMemberProfile | null;
  isOrganizer: boolean;
  isContributor: boolean;
  canEdit: boolean;
  isViewer: boolean;
  isClaimed: boolean;
}

// --- Feature 4: Travel Wallet & Bookings Hub Types ---
export type BookingCategory =
  | "flight"
  | "train"
  | "hotel"
  | "activity"
  | "car_rental"
  | "transit"
  | "insurance"
  | "document";

export type BookingStatus = "confirmed" | "pending" | "cancelled" | "completed";

export interface BookingAttachment {
  id: string;
  name: string;
  type: string; // e.g. "application/pdf", "image/png", "message/rfc822"
  dataUrl?: string; // base64 data URL
  size?: number; // bytes
  uploadedAt: number;
}

export interface TravelBookingPass {
  id: string;
  tripId: string;
  category: BookingCategory;
  title: string; // e.g. "Iberia IB3482 Madrid -> San Sebastián" or "Hotel Maria Cristina Stay"
  provider: string; // e.g. "Iberia", "Renfe", "Marriott", "Guggenheim", "Hertz", "Allianz"
  confirmationCode: string; // e.g. "IB89X2" or "RES-948271"
  passengerName?: string;
  secondaryCode?: string; // e.g. e-ticket number, voucher number, policy number
  
  // Date & Time
  startDate: string; // YYYY-MM-DD
  startTime?: string; // e.g. "08:45 AM"
  endDate?: string; // YYYY-MM-DD
  endTime?: string; // e.g. "10:15 AM"
  
  // Locations & Routing
  origin?: string; // e.g. "MAD (Madrid Barajas T4)"
  destination?: string; // e.g. "EAS (San Sebastián Airport)"
  address?: string; // e.g. "Paseo República Argentina 4, San Sebastián"
  gate?: string; // e.g. "K12"
  terminal?: string; // e.g. "T4"
  seat?: string; // e.g. "14A (Window)"
  platform?: string; // e.g. "Track 4"
  coach?: string; // e.g. "Coach 5"
  
  // Status & Details
  status: BookingStatus;
  bookingUrl?: string;
  qrCodeData?: string; // Barcode / QR string representation
  barcodeType?: "qr" | "code128" | "aztec" | "pdf417";
  
  // Hotel / Stay specifics
  roomType?: string; // e.g. "Deluxe Double with River View"
  accessPinOrKeycode?: string; // e.g. "Keycode: #4829"
  wifiDetails?: string; // e.g. "Network: MC_Guest / Pass: Txakoli2026"
  
  // Car rental specifics
  vehicleModel?: string; // e.g. "Audi A3 Sportback or similar"
  pickupLocation?: string;
  dropoffLocation?: string;
  
  // Insurance / Emergency specifics
  emergencyPhone?: string; // e.g. "+1-800-555-0199"
  coverageSummary?: string; // e.g. "Medical €100k, Trip Cancellation, Luggage"
  
  // Costs & Expense Link
  cost?: number; // e.g. 145.50
  currency?: string; // e.g. "EUR" or "USD"
  paidBy?: string; // Member name who paid
  assignedMembers?: string[]; // Member names this pass applies to
  
  // Notes & Attachments
  notes?: string;
  attachmentName?: string;
  attachments?: BookingAttachment[];
  
  createdAt: number;
  updatedAt: number;
}

export interface TravelWalletState {
  tripId: string;
  passes: TravelBookingPass[];
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

// --- Community & Social Types ---
export interface PublicUserProfile {
  id: string; // e.g. "user_uamenabar02_gmail_com"
  email: string;
  name: string;
  avatarUrl?: string;
  avatarPreset?: string;
  bio?: string;
  homeCity?: string;
  travelStyle?: string;
  websiteOrSocial?: string;
  badges?: string[];
  followers?: string[]; // user emails or canonical user ids
  following?: string[]; // user emails or canonical user ids
  publishedTripsCount?: number;
  publishedSpotsCount?: number;
  savedTripsCount?: number;
  joinedAt?: number;
  lastActive?: number;
}

export interface CommunitySpotReview {
  id: string;
  author: string;
  email: string;
  rating: number;
  text: string;
  createdAt: number;
}

export interface CommunitySpotDoc {
  id: string;
  name: string;
  category: ActivityCategory;
  description: string;
  insiderTip?: string;
  cityOrRegion: string;
  neighborhood?: string;
  address?: string;
  approxCost?: string;
  coordinates?: Coordinates;
  durationMinutes?: number;
  rating?: number;
  ratingsCount?: number;
  reviews?: CommunitySpotReview[];
  tags?: string[];
  imageUrl?: string;
  photos?: string[];
  creatorEmail: string;
  creatorUid?: string;
  creatorName: string;
  creatorAvatar?: string;
  likesCount?: number;
  likedBy?: string[];
  importsCount?: number;
  createdAt: number;
  lastUpdated: number;
}

// --- AI Models & Multi-Provider Selection Types ---
export type AIProvider = 'system_gemini' | 'gemini' | 'openai' | 'anthropic' | 'groq' | 'deepseek' | 'openrouter' | 'huggingface' | 'ollama' | 'lmstudio' | 'custom';

export interface UserAIModelConfig {
  id: string;
  provider: AIProvider;
  name: string;
  modelId: string;
  apiKey?: string;
  baseUrl?: string;
  status?: 'untested' | 'working' | 'error';
  lastTestedAt?: number;
  errorMessage?: string;
  isSystem?: boolean;
}

export type AITaskCategory = 'itinerary' | 'activity_details' | 'spot_swap' | 'advisor';

export interface AISelectionSettings {
  mode: 'basic' | 'advanced';
  basic: {
    primaryModelId: string;
    fallbackModel1Id: string;
    fallbackModel2Id: string;
  };
  advanced: {
    itinerary: { primaryModelId: string; fallbackModel1Id: string; fallbackModel2Id: string };
    activity_details: { primaryModelId: string; fallbackModel1Id: string; fallbackModel2Id: string };
    spot_swap: { primaryModelId: string; fallbackModel1Id: string; fallbackModel2Id: string };
    advisor: { primaryModelId: string; fallbackModel1Id: string; fallbackModel2Id: string };
  };
  customModels: UserAIModelConfig[];
}

export interface AIAttemptLog {
  modelId: string;
  modelName: string;
  provider: AIProvider;
  success: boolean;
  error?: string;
}

export interface AIGenerationMetadata {
  usedModelId: string;
  usedModelName: string;
  usedProvider: AIProvider;
  isFallbackUsed: boolean;
  attemptedModels: AIAttemptLog[];
  hasWarnings: boolean;
  warnings: string[];
  latencyMs?: number;
}



