import React, { useState, useEffect } from "react";
import {
  SharedTripDoc,
  ItineraryPlan,
  CommunitySpotDoc,
  PublicUserProfile,
  ActivitySpot,
  ActivityCategory,
  PaceType,
  BudgetTier,
  TransportMode,
} from "../types";
import {
  submitTripReview,
  incrementTripDownloads,
  fetchAllPublicTrips,
  getCuratedAndLocalTrips,
} from "../utils/sharedTripService";
import {
  fetchCommunitySpots,
  toggleLikeCommunitySpot,
  submitSpotReview,
  importCommunitySpotToPlan,
  CURATED_COMMUNITY_SPOTS,
} from "../utils/communitySpotService";
import { fetchCommunityCreators, CURATED_CREATORS } from "../utils/socialService";
import { saveTrip, getSavedTrips } from "../utils/storage";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { TranslatedText } from "./TranslatedText";
import { CreatorProfileModal } from "./CreatorProfileModal";
import { PublishTripModal } from "./PublishTripModal";
import { PublishSpotModal } from "./PublishSpotModal";
import { ItineraryPreviewModal } from "./ItineraryPreviewModal";
import { ActivityDetailModal } from "./ActivityDetailModal";
import {
  Search,
  Star,
  Download,
  Calendar,
  Compass,
  MapPin,
  Heart,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  User,
  ArrowRight,
  Sparkles,
  Info,
  Plus,
  Share2,
  Check,
  Award,
  Users,
  Globe,
  SlidersHorizontal,
  X,
  Eye,
  Camera,
  RotateCcw,
  Clock,
  RefreshCw,
} from "lucide-react";

interface ExploreFeedProps {
  currentPlan?: ItineraryPlan | null;
  onSelectTrip: (trip: ItineraryPlan) => void;
  onUpdatePlan?: (plan: ItineraryPlan) => void;
  onShowToast?: (msg: string, type?: "success" | "info" | "error") => void;
}

// Vibes & Categories aligned with Vacation Itinerary Planner
const PLANNER_VIBES = [
  { id: "gastro", label: "Gastronomy & Local Food", icon: "🍜", keywords: ["food", "gastro", "restaurant", "pintxos", "tapas", "culinary", "dining", "wine", "seafood"] },
  { id: "history", label: "History & Architecture", icon: "🏛️", keywords: ["history", "architecture", "monument", "cathedral", "castle", "historic", "heritage", "museum"] },
  { id: "hiddenGems", label: "Hidden Gems / Non-Touristy", icon: "💎", keywords: ["hidden", "gem", "secret", "local", "authentic", "offbeat", "non-touristy"] },
  { id: "scenic", label: "Scenic & Outdoors", icon: "🌲", keywords: ["nature", "scenic", "park", "outdoors", "mountain", "hike", "viewpoint", "panoramic"] },
  { id: "beaches", label: "Beaches & Swim Spots", icon: "🏖️", keywords: ["beach", "swim", "coast", "bay", "sea", "ocean", "playa", "surf"] },
  { id: "art", label: "Art & Culture", icon: "🎨", keywords: ["art", "culture", "gallery", "exhibition", "theatre", "music", "cultural"] },
  { id: "excursions", label: "Regional Excursions & Viewpoints", icon: "🚗", keywords: ["excursion", "viewpoint", "day trip", "mirador", "drive", "panoramic"] },
  { id: "shopping", label: "Shopping & Local Boutiques", icon: "🛍️", keywords: ["shopping", "boutique", "market", "souvenirs", "crafts", "fashion"] },
  { id: "family", label: "Family Friendly", icon: "👨‍👩‍👧", keywords: ["family", "kids", "children", "friendly", "playground", "aquarium", "park"] },
  { id: "budget", label: "Budget Friendly", icon: "🏷️", keywords: ["budget", "free", "cheap", "affordable", "student", "economical"] },
  { id: "nightlife", label: "Nightlife & Bars", icon: "🍸", keywords: ["nightlife", "bar", "pub", "cocktails", "club", "party", "drinks"] },
  { id: "relaxation", label: "Relaxation & Wellness", icon: "🌿", keywords: ["relaxation", "wellness", "spa", "chill", "peaceful", "thermal", "sunset"] },
];

const SPOT_CATEGORIES: Array<{ id: ActivityCategory; label: string; icon: string }> = [
  { id: "food", label: "Food & Dining", icon: "🍴" },
  { id: "hidden-gem", label: "Hidden Gems", icon: "💎" },
  { id: "nature", label: "Scenic & Nature", icon: "🌲" },
  { id: "sightseeing", label: "Sightseeing Landmarks", icon: "🏛️" },
  { id: "culture", label: "Art & Culture", icon: "🎨" },
  { id: "nightlife", label: "Nightlife & Bars", icon: "🍸" },
  { id: "shopping", label: "Local Shopping", icon: "🛍️" },
  { id: "relaxation", label: "Relaxation & Wellness", icon: "🌿" },
];

const DURATION_FILTER_OPTIONS = [
  { id: "all", label: "All Durations" },
  { id: "1", label: "1 Day" },
  { id: "2", label: "2 Days" },
  { id: "3", label: "3 Days" },
  { id: "4-5", label: "4–5 Days" },
  { id: "6-7", label: "6–7 Days" },
  { id: "8-10", label: "8–10 Days" },
  { id: "11+", label: "11+ Days" },
];

export const ExploreFeed: React.FC<ExploreFeedProps> = ({
  currentPlan,
  onSelectTrip,
  onUpdatePlan,
  onShowToast,
}) => {
  const { t } = useLanguage();
  const { user, profile, activeEmail, toggleFollowUser } = useAuth();

  // Active Explore Mode Tab: Itineraries | Spots | My Feed | Creators
  const [exploreTab, setExploreTab] = useState<"itineraries" | "spots" | "myfeed" | "creators">("itineraries");
  const [myFeedSubFilter, setMyFeedSubFilter] = useState<"all" | "itineraries" | "spots">("all");

  // Data States (pre-seeded for 0ms instant display without hanging)
  const [trips, setTrips] = useState<SharedTripDoc[]>(() => getCuratedAndLocalTrips());
  const [spots, setSpots] = useState<CommunitySpotDoc[]>(() => CURATED_COMMUNITY_SPOTS);
  const [creators, setCreators] = useState<PublicUserProfile[]>(() => CURATED_CREATORS);
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Search & Basic Duration Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [daysFilter, setDaysFilter] = useState("all");
  const [spotCategoryFilter, setSpotCategoryFilter] = useState("all");
  const [creatorStyleFilter, setCreatorStyleFilter] = useState("all");

  // Advanced Search & Planner Categories
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [selectedPace, setSelectedPace] = useState<string>("all");
  const [selectedBudget, setSelectedBudget] = useState<string>("all");
  const [selectedTransport, setSelectedTransport] = useState<string>("all");
  const [minRatingFilter, setMinRatingFilter] = useState<number>(0);
  const [onlyWithPhotos, setOnlyWithPhotos] = useState(false);
  const [sortBy, setSortBy] = useState<"recommended" | "rating" | "downloads" | "newest">("recommended");

  // Modals & Preview States
  const [previewTrip, setPreviewTrip] = useState<SharedTripDoc | null>(null);
  const [selectedSpotForGuide, setSelectedSpotForGuide] = useState<{
    spot: ActivitySpot;
    destination: string;
    dayNumber?: number;
  } | null>(null);
  const [selectedCreatorEmail, setSelectedCreatorEmail] = useState<string | null>(null);
  const [isPublishTripOpen, setIsPublishTripOpen] = useState(false);
  const [isPublishSpotOpen, setIsPublishSpotOpen] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [tripToPublish, setTripToPublish] = useState<ItineraryPlan | null>(null);
  const [importingSpot, setImportingSpot] = useState<CommunitySpotDoc | null>(null);
  const [selectedImportDay, setSelectedImportDay] = useState<number>(1);

  // Review states for Itineraries
  const [expandedReviewsTripId, setExpandedReviewsTripId] = useState<string | null>(null);
  const [tripReviewRating, setTripReviewRating] = useState<number>(5);
  const [tripReviewText, setTripReviewText] = useState("");
  const [submittingTripReviewId, setSubmittingTripReviewId] = useState<string | null>(null);

  // Review states for Spots
  const [expandedReviewsSpotId, setExpandedReviewsSpotId] = useState<string | null>(null);
  const [spotReviewRating, setSpotReviewRating] = useState<number>(5);
  const [spotReviewText, setSpotReviewText] = useState("");
  const [submittingSpotReviewId, setSubmittingSpotReviewId] = useState<string | null>(null);

  const emailToUse = (activeEmail || user?.email || profile?.email || "").trim().toLowerCase();

  // Helper to convert CommunitySpotDoc to ActivitySpot
  const communitySpotToActivitySpot = (spot: CommunitySpotDoc): ActivitySpot => {
    return {
      id: spot.id,
      name: spot.name,
      time: "Flexible",
      address: spot.neighborhood
        ? `${spot.neighborhood}, ${spot.cityOrRegion}`
        : spot.cityOrRegion,
      description: spot.description,
      insiderTip: spot.insiderTip || "",
      approxCost: spot.approxCost || "Free",
      durationMinutes: spot.durationMinutes || 90,
      category: (spot.category as ActivityCategory) || "hidden-gem",
      coordinates: spot.coordinates || { lat: 43.3183, lng: -1.9812 },
      photos: spot.photos || (spot.imageUrl ? [spot.imageUrl] : []),
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        spot.name + " " + spot.cityOrRegion
      )}`,
      tags: spot.tags || (spot.category ? [spot.category] : []),
      rating: spot.rating || 5.0,
    };
  };

  // Fetch all Explore data in background without blocking UI
  const loadExploreData = async (silent = false) => {
    if (!silent) setIsSyncing(true);
    try {
      const [tripsRes, spotsRes, creatorsRes] = await Promise.allSettled([
        fetchAllPublicTrips(),
        fetchCommunitySpots(),
        fetchCommunityCreators(),
      ]);

      if (tripsRes.status === "fulfilled" && Array.isArray(tripsRes.value) && tripsRes.value.length > 0) {
        setTrips(tripsRes.value);
      }
      if (spotsRes.status === "fulfilled" && Array.isArray(spotsRes.value) && spotsRes.value.length > 0) {
        setSpots(spotsRes.value);
      }
      if (creatorsRes.status === "fulfilled" && Array.isArray(creatorsRes.value) && creatorsRes.value.length > 0) {
        setCreators(creatorsRes.value);
      }
    } catch (err) {
      console.warn("Notice loading community explore data:", err);
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadExploreData(true);

    // Bounded safety timeout: under no circumstance can loading remain stuck
    const safetyTimer = setTimeout(() => {
      setLoading(false);
      setIsSyncing(false);
    }, 2500);

    const handleSyncEvent = () => {
      loadExploreData(true);
    };
    window.addEventListener("localexplorer_cloud_sync_updated", handleSyncEvent);

    return () => {
      clearTimeout(safetyTimer);
      window.removeEventListener("localexplorer_cloud_sync_updated", handleSyncEvent);
    };
  }, []);

  // Toggle follow user
  const handleFollowCreator = async (creatorEmail: string) => {
    if (!creatorEmail) return;
    try {
      await toggleFollowUser(creatorEmail);
      if (onShowToast) {
        const isNowFollowing = !(profile?.following || []).includes(creatorEmail.toLowerCase());
        onShowToast(
          isNowFollowing ? `Now following explorer!` : `Unfollowed explorer.`,
          "success"
        );
      }
      loadExploreData(true);
    } catch (err) {
      console.error("Failed to follow creator:", err);
    }
  };

  // Submit Itinerary Review
  const handleAddTripReview = async (tripId: string) => {
    if (!tripReviewText.trim()) return;
    setSubmittingTripReviewId(tripId);
    try {
      const reviewerName =
        profile?.name || user?.displayName || emailToUse.split("@")[0] || "Explorer";
      const result = await submitTripReview(
        tripId,
        reviewerName,
        emailToUse,
        tripReviewRating,
        tripReviewText.trim()
      );
      if (result && result.success) {
        setTrips((prev) =>
          prev.map((t) =>
            t.id === tripId
              ? {
                  ...t,
                  reviews: result.reviews || t.reviews,
                  rating: result.rating !== undefined ? result.rating : t.rating,
                  ratingsCount: result.reviews ? result.reviews.length : t.ratingsCount,
                }
              : t
          )
        );
        setTripReviewText("");
        if (onShowToast) onShowToast("Review posted successfully!", "success");
      } else {
        if (onShowToast) onShowToast(result?.message || "Failed to post review.", "error");
      }
    } catch (err) {
      console.error("Failed to post trip review:", err);
      if (onShowToast) onShowToast("Failed to post review.", "error");
    } finally {
      setSubmittingTripReviewId(null);
    }
  };

  // Like Spot
  const handleLikeSpot = async (spotId: string) => {
    try {
      const updated = await toggleLikeCommunitySpot(spotId, emailToUse);
      if (updated) {
        setSpots((prev) => prev.map((s) => (s.id === spotId ? updated : s)));
      }
    } catch (err) {
      console.error("Failed to like spot:", err);
    }
  };

  // Submit Spot Review
  const handleAddSpotReview = async (spotId: string) => {
    if (!spotReviewText.trim()) return;
    setSubmittingSpotReviewId(spotId);
    try {
      const reviewerName =
        profile?.name || user?.displayName || emailToUse.split("@")[0] || "Explorer";
      const updated = await submitSpotReview(
        spotId,
        spotReviewRating,
        spotReviewText.trim(),
        reviewerName,
        emailToUse
      );
      if (updated) {
        setSpots((prev) => prev.map((s) => (s.id === spotId ? updated : s)));
        setSpotReviewText("");
        if (onShowToast) onShowToast("Spot review posted!", "success");
      }
    } catch (err) {
      console.error("Failed to post spot review:", err);
      if (onShowToast) onShowToast("Failed to post spot review.", "error");
    } finally {
      setSubmittingSpotReviewId(null);
    }
  };

  // Import Spot into Current Plan
  const handleConfirmImportSpot = () => {
    if (!importingSpot || !currentPlan) {
      if (onShowToast) onShowToast("Open or create a trip first to import spots!", "info");
      setImportingSpot(null);
      return;
    }
    const updatedPlan = importCommunitySpotToPlan(currentPlan, importingSpot, selectedImportDay);
    if (onUpdatePlan) {
      onUpdatePlan(updatedPlan);
    }
    if (onShowToast) {
      onShowToast(`Imported "${importingSpot.name}" to Day ${selectedImportDay}!`, "success");
    }
    setImportingSpot(null);
  };

  // Count active advanced filters
  const activeAdvancedCount =
    selectedVibes.length +
    (selectedPace !== "all" ? 1 : 0) +
    (selectedBudget !== "all" ? 1 : 0) +
    (selectedTransport !== "all" ? 1 : 0) +
    (minRatingFilter > 0 ? 1 : 0) +
    (onlyWithPhotos ? 1 : 0);

  const resetAllFilters = () => {
    setSearchQuery("");
    setDaysFilter("all");
    setSpotCategoryFilter("all");
    setCreatorStyleFilter("all");
    setSelectedVibes([]);
    setSelectedPace("all");
    setSelectedBudget("all");
    setSelectedTransport("all");
    setMinRatingFilter(0);
    setOnlyWithPhotos(false);
    setSortBy("recommended");
  };

  // Structured Metadata Vibe Matcher
  const checkItineraryMatchesVibes = (t: SharedTripDoc, vibeIds: string[]): boolean => {
    if (vibeIds.length === 0) return true;
    const plan = t.plan;
    const rawMetadata = [
      ...(t.vibes || []),
      ...(plan?.vibes || []),
      ...(plan?.selectedVibes || []),
      ...(t.featuredTags || []),
      ...(plan?.tags || []),
    ].map((v) => v.toLowerCase().trim());

    return vibeIds.every((vibeId) => {
      const vibeObj = PLANNER_VIBES.find(
        (v) => v.id === vibeId || v.label.toLowerCase() === vibeId.toLowerCase()
      );
      const labelLower = (vibeObj?.label || vibeId).toLowerCase();
      const idLower = vibeId.toLowerCase();

      // 1. Direct match on metadata / tags
      if (
        rawMetadata.some(
          (m) =>
            m === labelLower ||
            m === idLower ||
            m.includes(labelLower) ||
            labelLower.includes(m) ||
            m.includes(idLower) ||
            idLower.includes(m)
        )
      ) {
        return true;
      }

      // 2. Keyword match on explicit metadata/tags (avoid loose false positives on general text)
      if (vibeObj) {
        return rawMetadata.some((metaItem) =>
          vibeObj.keywords.some((kw) => metaItem.includes(kw) || kw.includes(metaItem))
        );
      }
      return false;
    });
  };

  // Filtered Itineraries
  const filteredTrips = trips
    .filter((t) => {
      const q = searchQuery.toLowerCase().trim();
      const plan = t.plan;
      const allText = [
        plan?.title,
        plan?.destinationOrTown,
        plan?.summary,
        t.creatorName,
        ...(plan?.tags || []),
        ...(t.featuredTags || []),
        ...(t.vibes || []),
        ...(plan?.vibes || []),
        ...(plan?.selectedVibes || []),
        ...(plan?.highlights || []),
        ...(plan?.days?.map((d) => d.dayTitle + " " + d.theme + " " + d.summary) || []),
        ...(plan?.days?.flatMap((d) => d.activities?.map((a) => a.spotName + " " + a.description)) || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !q || allText.includes(q);

      // Duration Filter
      const totalDays = plan?.totalDays || 1;
      const matchesDays =
        daysFilter === "all" ||
        (daysFilter === "1" && totalDays === 1) ||
        (daysFilter === "2" && totalDays === 2) ||
        (daysFilter === "3" && totalDays === 3) ||
        (daysFilter === "4-5" && totalDays >= 4 && totalDays <= 5) ||
        (daysFilter === "6-7" && totalDays >= 6 && totalDays <= 7) ||
        (daysFilter === "8-10" && totalDays >= 8 && totalDays <= 10) ||
        (daysFilter === "11+" && totalDays >= 11);

      // Selected Vibes from Planner (Structured check)
      const matchesVibes = checkItineraryMatchesVibes(t, selectedVibes);

      // Pace Filter (Direct property check with fallback)
      let matchesPace = true;
      if (selectedPace !== "all") {
        matchesPace =
          plan?.customPace === selectedPace ||
          (t.featuredTags || []).some((tag) => tag.toLowerCase().includes(selectedPace.toLowerCase()));
      }

      // Budget Tier Filter (Direct property check with fallback)
      let matchesBudget = true;
      if (selectedBudget !== "all") {
        matchesBudget =
          plan?.budgetTier === selectedBudget ||
          (t.featuredTags || []).some((tag) => tag.toLowerCase().includes(selectedBudget.toLowerCase()));
      }

      // Transport Filter (Direct property check)
      let matchesTransport = true;
      if (selectedTransport !== "all") {
        matchesTransport =
          plan?.transportMode === selectedTransport ||
          (plan?.transportModes || []).includes(selectedTransport as TransportMode) ||
          (t.featuredTags || []).some((tag) => tag.toLowerCase().includes(selectedTransport.toLowerCase()));
      }

      // Min Rating Filter
      const rating = t.rating || 5.0;
      const matchesRating = minRatingFilter === 0 || rating >= minRatingFilter;

      // Real Photos Only
      let matchesPhotos = true;
      if (onlyWithPhotos) {
        matchesPhotos = (plan?.days || []).some((d) =>
          (d.activities || []).some(
            (a) =>
              a.photoUrl ||
              (a.photos && a.photos.length > 0) ||
              (a.userContributedPhotos && a.userContributedPhotos.length > 0)
          )
        );
      }

      return (
        matchesSearch &&
        matchesDays &&
        matchesVibes &&
        matchesPace &&
        matchesBudget &&
        matchesTransport &&
        matchesRating &&
        matchesPhotos
      );
    })
    .sort((a, b) => {
      if (sortBy === "rating") return (b.rating || 5.0) - (a.rating || 5.0);
      if (sortBy === "downloads") return (b.downloadsCount || 0) - (a.downloadsCount || 0);
      if (sortBy === "newest") return b.lastUpdated - a.lastUpdated;
      return 0; // Default recommended
    });

  // Filtered Spots
  const filteredSpots = spots
    .filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const allText = [
        s.name,
        s.cityOrRegion,
        s.neighborhood,
        s.description,
        s.insiderTip,
        s.creatorName,
        s.category,
        ...(s.tags || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !q || allText.includes(q);
      const matchesCategory = spotCategoryFilter === "all" || s.category === spotCategoryFilter;

      // Selected Vibes for spots
      let matchesVibes = true;
      if (selectedVibes.length > 0) {
        matchesVibes = selectedVibes.some((vibeId) => {
          const vibeObj = PLANNER_VIBES.find((v) => v.id === vibeId || v.label.toLowerCase() === vibeId.toLowerCase());
          if (!vibeObj) return false;
          const labelLower = vibeObj.label.toLowerCase();
          const tagsLower = (s.tags || []).map((t) => t.toLowerCase());
          return (
            tagsLower.some((t) => t.includes(vibeId.toLowerCase()) || t.includes(labelLower)) ||
            vibeObj.keywords.some((kw) => allText.includes(kw))
          );
        });
      }

      // Budget filter for spots
      let matchesBudget = true;
      if (selectedBudget !== "all") {
        if (selectedBudget === "budget") {
          matchesBudget =
            (s.approxCost || "").toLowerCase().includes("free") ||
            ((s.approxCost || "").includes("€") && !(s.approxCost || "").includes("€€€"));
        } else if (selectedBudget === "luxury") {
          matchesBudget =
            (s.approxCost || "").includes("€€€") ||
            (s.approxCost || "").toLowerCase().includes("michelin");
        }
      }

      // Min Rating
      const rating = s.rating || 5.0;
      const matchesRating = minRatingFilter === 0 || rating >= minRatingFilter;

      // Only with Real Photos
      let matchesPhotos = true;
      if (onlyWithPhotos) {
        matchesPhotos = (s.photos && s.photos.length > 0) || Boolean(s.imageUrl);
      }

      return (
        matchesSearch &&
        matchesCategory &&
        matchesVibes &&
        matchesBudget &&
        matchesRating &&
        matchesPhotos
      );
    })
    .sort((a, b) => {
      if (sortBy === "rating") return (b.rating || 5.0) - (a.rating || 5.0);
      if (sortBy === "downloads") return (b.likesCount || 0) - (a.likesCount || 0);
      if (sortBy === "newest") return b.lastUpdated - a.lastUpdated;
      return 0;
    });

  // Filtered Creators
  const filteredCreators = creators.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      c.name?.toLowerCase().includes(q) ||
      c.homeCity?.toLowerCase().includes(q) ||
      c.bio?.toLowerCase().includes(q) ||
      c.travelStyle?.toLowerCase().includes(q);

    const matchesStyle =
      creatorStyleFilter === "all" ||
      c.travelStyle?.toLowerCase().includes(creatorStyleFilter.toLowerCase());

    return matchesSearch && matchesStyle;
  });

  // Followed creators list for "My Feed"
  const followedEmails = React.useMemo(() => {
    const fromProfile = profile?.following || [];
    let fromLocal: string[] = [];
    try {
      const raw = localStorage.getItem("localexplorer_user_following");
      if (raw) fromLocal = JSON.parse(raw);
    } catch {}
    const set = new Set([...fromProfile, ...fromLocal].map((e) => e.toLowerCase().trim()));
    return Array.from(set);
  }, [profile?.following]);

  // Items in My Feed
  const myFeedTrips = React.useMemo(() => {
    return trips.filter((t) => followedEmails.includes(t.creatorEmail.toLowerCase()));
  }, [trips, followedEmails]);

  const myFeedSpots = React.useMemo(() => {
    return spots.filter((s) => followedEmails.includes(s.creatorEmail.toLowerCase()));
  }, [spots, followedEmails]);

  // Combined chronological timeline for My Feed
  type FeedTimelineItem =
    | { type: "trip"; trip: SharedTripDoc; timestamp: number }
    | { type: "spot"; spot: CommunitySpotDoc; timestamp: number };

  const myFeedTimeline: FeedTimelineItem[] = React.useMemo(() => {
    const list: FeedTimelineItem[] = [];
    if (myFeedSubFilter === "all" || myFeedSubFilter === "itineraries") {
      myFeedTrips.forEach((t) => list.push({ type: "trip", trip: t, timestamp: t.lastUpdated || Date.now() }));
    }
    if (myFeedSubFilter === "all" || myFeedSubFilter === "spots") {
      myFeedSpots.forEach((s) => list.push({ type: "spot", spot: s, timestamp: s.lastUpdated || s.createdAt || Date.now() }));
    }
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [myFeedTrips, myFeedSpots, myFeedSubFilter]);

  return (
    <div id="explore-community-feed" className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[#e5e5df]/60">
        <div className="space-y-3 max-w-3xl">
          <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 bg-[#f5f5f0] border border-[#d1d1ca] rounded-full text-xs font-semibold text-[#5A5A40]">
            <Compass className="w-3.5 h-3.5 text-[#5A5A40]" />
            <TranslatedText text="Global Traveler Community" />
          </div>
          <h1 className="font-serif text-2xl sm:text-4xl md:text-5xl font-normal italic text-[#2c2c24] leading-tight tracking-tight">
            <TranslatedText text="Explore Shared Itineraries & Local Gems" />
          </h1>
          <p className="text-sm text-[#6b6b5e] leading-relaxed hidden sm:block">
            <TranslatedText text="Discover authentic travel routes crafted by local insiders, preview rich itineraries before loading, inspect detailed spot guides with community photos, and filter by all your favorite vacation vibes." />
          </p>
        </div>

        {/* Action Buttons: Publish Itinerary / Share Spot - Hidden on Mobile */}
        <div className="hidden md:flex flex-wrap items-center gap-3 shrink-0">
          <button
            id="explore-publish-trip-btn"
            onClick={() => {
              if (currentPlan) {
                setTripToPublish(currentPlan);
                setIsPublishTripOpen(true);
              } else {
                const saved = getSavedTrips();
                if (saved.length > 0) {
                  setTripToPublish(saved[0]);
                  setIsPublishTripOpen(true);
                } else {
                  if (onShowToast) onShowToast("Create an itinerary first to publish it!", "info");
                }
              }
            }}
            className="px-4 py-2.5 bg-[#5A5A40] hover:bg-[#4a4a35] text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <Globe className="w-4 h-4" />
            <TranslatedText text="Publish Itinerary" />
          </button>

          <button
            id="explore-share-spot-btn"
            onClick={() => setIsPublishSpotOpen(true)}
            className="px-4 py-2.5 bg-white hover:bg-[#f5f5f0] text-[#5A5A40] border border-[#d1d1ca] rounded-xl text-xs sm:text-sm font-semibold transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#5A5A40]" />
            <TranslatedText text="Share a Spot" />
          </button>
        </div>
      </div>

      {/* Main Tab Switcher & Search Bar */}
      <div className="sticky top-[56px] sm:top-[72px] z-30 bg-[#f5f5f0]/95 backdrop-blur-md py-3 -mx-7 px-7 sm:-mx-12 sm:px-12 lg:-mx-[56px] lg:px-[56px] border-b border-stone-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-auto">
        <div className="w-full sm:w-auto grid grid-cols-4 gap-1 p-1 bg-stone-100 rounded-2xl">
          <button
            id="tab-explore-itineraries"
            onClick={() => setExploreTab("itineraries")}
            className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 py-1.5 sm:py-2 px-1 sm:px-4 rounded-xl text-[10px] sm:text-sm font-semibold transition-all text-center w-full min-w-0 ${
              exploreTab === "itineraries"
                ? "bg-white text-emerald-800 shadow-xs font-bold"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <Compass className="w-4 h-4 shrink-0" />
            <span className="truncate max-w-full"><TranslatedText text="Itineraries" /></span>
          </button>

          <button
            id="tab-explore-spots"
            onClick={() => setExploreTab("spots")}
            className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 py-1.5 sm:py-2 px-1 sm:px-4 rounded-xl text-[10px] sm:text-sm font-semibold transition-all text-center w-full min-w-0 ${
              exploreTab === "spots"
                ? "bg-white text-emerald-800 shadow-xs font-bold"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0 text-amber-500" />
            <span className="truncate max-w-full"><TranslatedText text="Spots" /></span>
          </button>

          <button
            id="tab-explore-myfeed"
            onClick={() => setExploreTab("myfeed")}
            className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 py-1.5 sm:py-2 px-1 sm:px-4 rounded-xl text-[10px] sm:text-sm font-semibold transition-all text-center w-full min-w-0 ${
              exploreTab === "myfeed"
                ? "bg-white text-emerald-800 shadow-xs font-bold"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <Heart className="w-4 h-4 shrink-0 text-rose-500 fill-rose-500/20" />
            <span className="truncate max-w-full"><TranslatedText text="My Feed" /></span>
          </button>

          <button
            id="tab-explore-creators"
            onClick={() => setExploreTab("creators")}
            className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 py-1.5 sm:py-2 px-1 sm:px-4 rounded-xl text-[10px] sm:text-sm font-semibold transition-all text-center w-full min-w-0 ${
              exploreTab === "creators"
                ? "bg-white text-emerald-800 shadow-xs font-bold"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <Users className="w-4 h-4 shrink-0 text-indigo-500" />
            <span className="truncate max-w-full"><TranslatedText text="Explorers" /></span>
          </button>
        </div>

        {/* Global Search & Advanced Filters Button */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                exploreTab === "itineraries"
                  ? "Search city, highlights, vibes..."
                  : exploreTab === "spots"
                  ? "Search secret spots, dining, tips..."
                  : "Search explorers, style, city..."
              }
              className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Advanced Filter Toggle Button */}
          <button
            id="toggle-advanced-filters-btn"
            type="button"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 border shadow-2xs ${
              showAdvancedFilters || activeAdvancedCount > 0
                ? "bg-emerald-700 text-white border-emerald-700 shadow-emerald-700/20"
                : "bg-white text-stone-700 border-stone-300 hover:bg-stone-50"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>
              <TranslatedText text="Categories & Filters" />
            </span>
            {activeAdvancedCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-white text-emerald-800 text-xs font-bold flex items-center justify-center ml-0.5">
                {activeAdvancedCount}
              </span>
            )}
          </button>

          {/* Refresh / Sync Button */}
          <button
            id="refresh-explore-feed-btn"
            type="button"
            onClick={() => loadExploreData(false)}
            disabled={isSyncing}
            title="Refresh Community Hub"
            aria-label="Refresh Community Hub"
            className="p-2 rounded-xl text-stone-600 bg-white border border-stone-300 hover:bg-stone-50 transition-all shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin text-emerald-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Itinerary Length Filter (Tags Filter is Eliminated) */}
      {exploreTab === "itineraries" && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="hidden sm:flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <TranslatedText text="Duration:" />
            </span>
            {DURATION_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDaysFilter(opt.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  daysFilter === opt.id
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Sort By Pills */}
          <div className="flex items-center gap-1.5 text-xs text-stone-500 w-full sm:w-auto justify-end">
            <span className="font-medium uppercase tracking-wider text-[11px]">
              <TranslatedText text="Sort:" />
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-stone-700 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            >
              <option value="recommended">Recommended</option>
              <option value="rating">Highest Rated (★)</option>
              <option value="downloads">Most Popular</option>
              <option value="newest">Recently Published</option>
            </select>
          </div>
        </div>
      )}

      {/* Spot Category Fast Pills */}
      {exploreTab === "spots" && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="hidden sm:flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider mr-1">
              <TranslatedText text="Category:" />
            </span>
            <button
              type="button"
              onClick={() => setSpotCategoryFilter("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                spotCategoryFilter === "all"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              <TranslatedText text="All Categories" />
            </button>
            {SPOT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSpotCategoryFilter(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
                  spotCategoryFilter === cat.id
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-stone-500 w-full sm:w-auto justify-end">
            <span className="font-medium uppercase tracking-wider text-[11px]">
              <TranslatedText text="Sort:" />
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-stone-700 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            >
              <option value="recommended">Recommended</option>
              <option value="rating">Top Rated (★)</option>
              <option value="downloads">Most Liked (♥)</option>
              <option value="newest">Recently Shared</option>
            </select>
          </div>
        </div>
      )}

      {/* Advanced Filter / Vacation Planner Category Matrix Drawer */}
      {showAdvancedFilters && (
        <div className="bg-white rounded-3xl border border-stone-200 shadow-lg p-5 sm:p-6 space-y-5 animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between border-b border-stone-200 pb-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-emerald-700" />
              <h3 className="font-bold text-stone-900 text-sm sm:text-base font-serif">
                <TranslatedText text="Vacation Planner Categories & Advanced Search" />
              </h3>
            </div>
            <button
              type="button"
              onClick={resetAllFilters}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 bg-rose-50 hover:bg-rose-100 px-3 py-1 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <TranslatedText text="Reset All Filters" />
            </button>
          </div>

          {/* 1. Vacation Vibes & Interests */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                <span>✨</span>
                <TranslatedText text="Travel Vibes & Interests" />
              </label>
              {selectedVibes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedVibes([])}
                  className="text-[11px] text-stone-400 hover:text-stone-700"
                >
                  <TranslatedText text="Clear Vibes" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {PLANNER_VIBES.map((vibe) => {
                const isSelected = selectedVibes.includes(vibe.id);
                return (
                  <button
                    key={vibe.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedVibes(selectedVibes.filter((v) => v !== vibe.id));
                      } else {
                        setSelectedVibes([...selectedVibes, vibe.id]);
                      }
                    }}
                    className={`p-2.5 rounded-xl text-xs font-medium transition-all text-left flex items-center gap-2 border ${
                      isSelected
                        ? "bg-emerald-50 text-emerald-900 border-emerald-500 font-bold shadow-2xs ring-1 ring-emerald-500"
                        : "bg-stone-50 text-stone-700 border-stone-200 hover:bg-white hover:border-stone-300"
                    }`}
                  >
                    <span className="text-base">{vibe.icon}</span>
                    <span className="truncate">{vibe.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Secondary Filter Grids: Pace, Budget, Transport, Minimum Rating */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-stone-100">
            {/* Pacing */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-700">
                <TranslatedText text="Exploration Pace" />
              </label>
              <select
                value={selectedPace}
                onChange={(e) => setSelectedPace(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
              >
                <option value="all">All Paces</option>
                <option value="relaxed">☕ Relaxed & Slow</option>
                <option value="balanced">⚖️ Balanced Flow</option>
                <option value="action-packed">⚡ Action-Packed</option>
              </select>
            </div>

            {/* Budget Tier */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-700">
                <TranslatedText text="Budget Level" />
              </label>
              <select
                value={selectedBudget}
                onChange={(e) => setSelectedBudget(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
              >
                <option value="all">All Budget Tiers</option>
                <option value="budget">🏷️ Budget-Savvy</option>
                <option value="mid-range">⚖️ Balanced / Mid-Range</option>
                <option value="luxury">✨ Luxury & Fine Dining</option>
              </select>
            </div>

            {/* Transport Mode */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-700">
                <TranslatedText text="Transport Mode" />
              </label>
              <select
                value={selectedTransport}
                onChange={(e) => setSelectedTransport(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
              >
                <option value="all">Any Transport</option>
                <option value="public_transit">🚌 Public Transit & Walking</option>
                <option value="car">🚗 Rental Car / Driving</option>
                <option value="bicycle">🚲 Bike / E-Bike</option>
                <option value="taxi">🚕 Taxi & Rideshare</option>
              </select>
            </div>

            {/* Min Rating */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-700">
                <TranslatedText text="Minimum Rating" />
              </label>
              <select
                value={minRatingFilter}
                onChange={(e) => setMinRatingFilter(Number(e.target.value))}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
              >
                <option value={0}>Any Rating</option>
                <option value={4.0}>⭐ 4.0 & Above</option>
                <option value={4.5}>⭐ 4.5 & Above</option>
                <option value={4.8}>⭐ 4.8 & Above</option>
              </select>
            </div>
          </div>

          {/* Photo Verification Toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-stone-100">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-stone-700">
              <input
                type="checkbox"
                checked={onlyWithPhotos}
                onChange={(e) => setOnlyWithPhotos(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-stone-300"
              />
              <Camera className="w-4 h-4 text-emerald-700" />
              <span>
                <TranslatedText text="Only show entries with user-contributed photos or visual guides" />
              </span>
            </label>

            <button
              type="button"
              onClick={() => setShowAdvancedFilters(false)}
              className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold transition-all shadow-xs"
            >
              <TranslatedText text="Apply Filters" />
            </button>
          </div>
        </div>
      )}

      {/* Main Feed Content Area */}
      {loading && trips.length === 0 ? (
        <div className="py-20 text-center text-stone-500 space-y-3">
          <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium">
            <TranslatedText text="Connecting to Community Hub..." />
          </p>
        </div>
      ) : (
        <div>
          {/* TAB 1: CURATED COMMUNITY ITINERARIES */}
          {exploreTab === "itineraries" && (
            <div>
              {filteredTrips.length === 0 ? (
                <div className="text-center py-16 px-4 bg-white rounded-3xl border border-dashed border-stone-200 space-y-3">
                  <Compass className="w-12 h-12 text-stone-300 mx-auto" />
                  <h3 className="text-base font-bold text-stone-800">
                    <TranslatedText text="No matching itineraries found" />
                  </h3>
                  <p className="text-xs text-stone-500 max-w-md mx-auto">
                    <TranslatedText text="Try adjusting your filters, searching for a different city, or publish your own route!" />
                  </p>
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-xl transition-colors"
                  >
                    <TranslatedText text="Clear Filters" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredTrips.map((trip) => {
                    const authorEmail = (trip.creatorEmail || "").toLowerCase();
                    const isFollowingAuthor = (profile?.following || [])
                      .map((e) => e.toLowerCase())
                      .includes(authorEmail);
                    const isMyTrip = authorEmail === emailToUse;

                    return (
                      <div
                        key={trip.id}
                        className="bg-white rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                      >
                        <div className="p-5 space-y-3">
                          {/* Top Author & Rating Row */}
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedCreatorEmail(authorEmail)}
                              className="flex items-center gap-2 text-left group/author hover:opacity-80 transition-opacity"
                            >
                              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center border border-emerald-200">
                                {trip.creatorName ? trip.creatorName[0].toUpperCase() : "T"}
                              </div>
                              <div>
                                <div className="text-xs font-bold text-stone-900 group-hover/author:text-emerald-700 flex items-center gap-1">
                                  <span>{trip.creatorName || "Local Explorer"}</span>
                                  {trip.creatorEmail?.includes("localexplorer") && (
                                    <Award className="w-3 h-3 text-emerald-600" />
                                  )}
                                </div>
                                <div className="text-[10px] text-stone-400">
                                  {new Date(trip.lastUpdated).toLocaleDateString()}
                                </div>
                              </div>
                            </button>

                            {/* Author Follow Toggle */}
                            {!isMyTrip && authorEmail && (
                              <button
                                type="button"
                                onClick={() => handleFollowCreator(authorEmail)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                                  isFollowingAuthor
                                    ? "bg-stone-100 text-stone-700 hover:bg-red-50 hover:text-red-600"
                                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                }`}
                              >
                                {isFollowingAuthor ? (
                                  <span className="flex items-center gap-1">
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <TranslatedText text="Following" />
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-0.5">
                                    <Plus className="w-3 h-3" />
                                    <TranslatedText text="Follow" />
                                  </span>
                                )}
                              </button>
                            )}
                          </div>

                          {/* Title & Summary */}
                          <div>
                            <h3 className="font-bold text-stone-900 text-base group-hover:text-emerald-800 transition-colors line-clamp-1">
                              {trip.plan?.title}
                            </h3>
                            <p className="text-xs text-stone-600 line-clamp-2 mt-1 leading-relaxed">
                              {trip.plan?.summary}
                            </p>
                          </div>

                          {/* Stats Pills */}
                          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600 pt-1">
                            <span className="flex items-center gap-1 bg-stone-50 px-2 py-1 rounded-md border border-stone-100">
                              <Calendar className="w-3.5 h-3.5 text-stone-400" />
                              <span className="font-semibold">{trip.plan?.totalDays}</span>{" "}
                              {trip.plan?.totalDays === 1 ? t("action.day", "Day") : t("action.days", "Days")}
                            </span>
                            <span className="flex items-center gap-1 bg-stone-50 px-2 py-1 rounded-md border border-stone-100">
                              <MapPin className="w-3.5 h-3.5 text-stone-400" />
                              <span className="font-semibold">{trip.plan?.destinationOrTown}</span>
                            </span>
                            <span className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-md text-amber-700 font-semibold border border-amber-200/60">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                              <span>{trip.rating?.toFixed(1) || "5.0"}</span>
                              <span className="text-amber-500 font-normal">({trip.ratingsCount || 1})</span>
                            </span>
                            <span className="flex items-center gap-1 bg-stone-50 px-2 py-1 rounded-md text-stone-500 border border-stone-100 ml-auto">
                              <Download className="w-3.5 h-3.5 text-stone-400" />
                              <span>{trip.downloadsCount || 0}</span>
                            </span>
                          </div>

                          {/* Highlights Preview */}
                          {trip.plan?.highlights && trip.plan.highlights.length > 0 && (
                            <div className="text-[11px] text-stone-500 italic line-clamp-1">
                              ✨ {trip.plan.highlights.slice(0, 2).join(" • ")}
                            </div>
                          )}
                        </div>

                        {/* Card Bottom / Actions: Preview Popup, Open Itinerary & Reviews */}
                        <div className="bg-stone-50/80 p-4 border-t border-stone-100 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            {/* Reviews Toggle */}
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedReviewsTripId(
                                  expandedReviewsTripId === trip.id ? null : trip.id
                                )
                              }
                              className="text-xs font-semibold text-stone-600 hover:text-stone-900 flex items-center gap-1"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-stone-400" />
                              <span>
                                {trip.reviews?.length || 0} <TranslatedText text="Reviews" />
                              </span>
                              {expandedReviewsTripId === trip.id ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <div className="flex items-center gap-2">
                              {/* Preview Itinerary Popup Button */}
                              <button
                                type="button"
                                onClick={() => setPreviewTrip(trip)}
                                className="px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 rounded-xl text-xs font-semibold transition-all shadow-2xs flex items-center gap-1.5"
                              >
                                <Eye className="w-3.5 h-3.5 text-emerald-700" />
                                <TranslatedText text="Preview" />
                              </button>

                              {/* Open Itinerary Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  incrementTripDownloads(trip.id);
                                  onSelectTrip(trip.plan);
                                  if (onShowToast) onShowToast(`Loaded "${trip.plan.title}"!`, "success");
                                }}
                                className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold transition-all shadow-xs active:scale-95 flex items-center gap-1.5"
                              >
                                <Compass className="w-3.5 h-3.5" />
                                <TranslatedText text="Open" />
                              </button>
                            </div>
                          </div>

                          {/* Expanded Reviews Section */}
                          {expandedReviewsTripId === trip.id && (
                            <div className="pt-3 border-t border-stone-200/80 space-y-3 animate-fade-in">
                              <div className="space-y-2 max-h-40 overflow-y-auto">
                                {(trip.reviews || []).length === 0 ? (
                                  <p className="text-[11px] text-stone-400 italic text-center py-2">
                                    <TranslatedText text="Be the first explorer to review this route!" />
                                  </p>
                                ) : (
                                  trip.reviews?.map((r, idx) => (
                                    <div key={idx} className="bg-white p-2.5 rounded-lg border border-stone-200 text-xs space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className="font-semibold text-stone-800">{r.author}</span>
                                        <div className="flex items-center text-amber-500 text-[11px]">
                                          <Star className="w-3 h-3 fill-amber-400" />
                                          <span className="ml-0.5">{r.rating}</span>
                                        </div>
                                      </div>
                                      <p className="text-stone-600 text-[11px] leading-relaxed">"{r.text}"</p>
                                    </div>
                                  ))
                                )}
                              </div>

                              {/* Add review form */}
                              <div className="bg-white p-2.5 rounded-xl border border-stone-200 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold uppercase text-stone-600">
                                    <TranslatedText text="Rate Itinerary" />
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <button
                                        key={star}
                                        type="button"
                                        onClick={() => setTripReviewRating(star)}
                                        className="p-0.5 text-amber-400 hover:scale-110 transition-transform"
                                      >
                                        <Star
                                          className={`w-3.5 h-3.5 ${
                                            star <= tripReviewRating ? "fill-amber-400" : "text-stone-300"
                                          }`}
                                        />
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <input
                                  type="text"
                                  value={tripReviewText}
                                  onChange={(e) => setTripReviewText(e.target.value)}
                                  placeholder="Write a quick comment or tip..."
                                  className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                                />
                                <button
                                  type="button"
                                  disabled={submittingTripReviewId === trip.id}
                                  onClick={() => handleAddTripReview(trip.id)}
                                  className="w-full py-1.5 bg-stone-800 hover:bg-stone-900 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                                >
                                  {submittingTripReviewId === trip.id ? "Submitting..." : "Post Review"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: INDIVIDUAL COMMUNITY SPOTS */}
          {exploreTab === "spots" && (
            <div>
              {filteredSpots.length === 0 ? (
                <div className="text-center py-16 px-4 bg-white rounded-3xl border border-dashed border-stone-200 space-y-3">
                  <Sparkles className="w-12 h-12 text-stone-300 mx-auto" />
                  <h3 className="text-base font-bold text-stone-800">
                    <TranslatedText text="No spots match your filter" />
                  </h3>
                  <p className="text-xs text-stone-500 max-w-md mx-auto">
                    <TranslatedText text="Be the first to share an authentic restaurant, viewpoint, or hidden place!" />
                  </p>
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-xl transition-colors"
                  >
                    <TranslatedText text="Clear Filters" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredSpots.map((spot) => {
                    const isLiked = (spot.likedBy || []).includes(emailToUse);
                    const actSpot = communitySpotToActivitySpot(spot);

                    return (
                      <div
                        key={spot.id}
                        className="bg-white rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                      >
                        <div className="p-5 space-y-3">
                          {/* Spot Image preview if available */}
                          {spot.photos && spot.photos.length > 0 && (
                            <div className="relative h-36 -mx-5 -mt-5 mb-3 overflow-hidden bg-stone-100">
                              <img
                                src={spot.photos[0]}
                                alt={spot.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute top-3 right-3 px-2 py-0.5 bg-black/60 backdrop-blur-xs text-white rounded-md text-[10px] font-semibold flex items-center gap-1">
                                <Camera className="w-3 h-3" />
                                <span>{spot.photos.length}</span>
                              </div>
                            </div>
                          )}

                          {/* Category & Rating */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-lg uppercase tracking-wider">
                              {spot.category}
                            </span>
                            <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full text-xs font-bold text-amber-700 border border-amber-200/60">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              <span>{spot.rating?.toFixed(1) || "5.0"}</span>
                            </div>
                          </div>

                          {/* Spot Title & City */}
                          <div>
                            <h3 className="font-bold text-stone-900 text-base line-clamp-1">{spot.name}</h3>
                            <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
                              <span>
                                {spot.neighborhood ? `${spot.neighborhood}, ` : ""}
                                {spot.cityOrRegion}
                              </span>
                            </p>
                          </div>

                          {/* Description */}
                          <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                            {spot.description}
                          </p>

                          {/* Insider Tip Highlight */}
                          {spot.insiderTip && (
                            <div className="p-3 bg-amber-50/80 border border-amber-200/70 rounded-xl text-xs text-amber-950 space-y-0.5">
                              <div className="font-bold flex items-center gap-1 text-amber-800">
                                <span>💡</span>
                                <TranslatedText text="Local Insider Tip:" />
                              </div>
                              <p className="text-[11px] leading-relaxed">{spot.insiderTip}</p>
                            </div>
                          )}

                          {/* Author info & Cost */}
                          <div className="flex items-center justify-between text-xs text-stone-500 pt-1">
                            <button
                              type="button"
                              onClick={() => setSelectedCreatorEmail(spot.creatorEmail)}
                              className="text-stone-700 hover:text-emerald-700 font-medium text-xs flex items-center gap-1.5"
                            >
                              <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center">
                                {spot.creatorName[0]}
                              </div>
                              <span>{spot.creatorName}</span>
                            </button>
                            <span className="font-semibold text-stone-700">{spot.approxCost}</span>
                          </div>
                        </div>

                        {/* Spot Bottom Actions: Details & Guide, Like, Reviews, Import to Plan */}
                        <div className="bg-stone-50/80 p-4 border-t border-stone-100 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              {/* Details & Guide Button */}
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedSpotForGuide({
                                    spot: actSpot,
                                    destination: spot.cityOrRegion,
                                  })
                                }
                                className="px-2.5 py-1.5 bg-white hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 text-stone-700 border border-stone-200 rounded-xl text-xs font-semibold transition-all shadow-2xs flex items-center gap-1"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                                <TranslatedText text="Details & Guide" />
                              </button>

                              {/* Like Button */}
                              <button
                                type="button"
                                onClick={() => handleLikeSpot(spot.id)}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                                  isLiked
                                    ? "bg-rose-50 text-rose-600 border border-rose-200"
                                    : "bg-white text-stone-600 hover:text-rose-600 border border-stone-200"
                                }`}
                              >
                                <Heart className={`w-3.5 h-3.5 ${isLiked ? "fill-rose-500 text-rose-500" : ""}`} />
                                <span>{spot.likesCount || 0}</span>
                              </button>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Reviews toggle */}
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedReviewsSpotId(
                                    expandedReviewsSpotId === spot.id ? null : spot.id
                                  )
                                }
                                className="text-xs font-semibold text-stone-600 hover:text-stone-900 flex items-center gap-1"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-stone-400" />
                                <span>{spot.reviews?.length || 0}</span>
                              </button>

                              {/* Import Spot to Active Itinerary */}
                              <button
                                type="button"
                                onClick={() => setImportingSpot(spot)}
                                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold transition-all shadow-xs active:scale-95 flex items-center gap-1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <TranslatedText text="Import" />
                              </button>
                            </div>
                          </div>

                          {/* Spot Reviews Drawer */}
                          {expandedReviewsSpotId === spot.id && (
                            <div className="pt-3 border-t border-stone-200/80 space-y-2 animate-fade-in">
                              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                {(spot.reviews || []).length === 0 ? (
                                  <p className="text-[11px] text-stone-400 italic text-center py-1">
                                    <TranslatedText text="No reviews yet." />
                                  </p>
                                ) : (
                                  spot.reviews?.map((r, idx) => (
                                    <div key={idx} className="bg-white p-2 rounded-lg border border-stone-200 text-xs">
                                      <div className="flex items-center justify-between font-medium text-[11px] text-stone-700">
                                        <span>{r.author}</span>
                                        <span>⭐ {r.rating}</span>
                                      </div>
                                      <p className="text-stone-600 text-[11px] mt-0.5">"{r.text}"</p>
                                    </div>
                                  ))
                                )}
                              </div>
                              <div className="flex gap-1">
                                <input
                                  type="text"
                                  value={spotReviewText}
                                  onChange={(e) => setSpotReviewText(e.target.value)}
                                  placeholder="Review spot..."
                                  className="flex-1 px-2 py-1 bg-white border border-stone-200 rounded-lg text-xs"
                                />
                                <button
                                  type="button"
                                  disabled={submittingSpotReviewId === spot.id}
                                  onClick={() => handleAddSpotReview(spot.id)}
                                  className="px-3 py-1 bg-stone-800 text-white text-xs font-semibold rounded-lg"
                                >
                                  {submittingSpotReviewId === spot.id ? "..." : "Post"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: MY PERSONALIZED TIMELINE FEED */}
          {exploreTab === "myfeed" && (
            <div className="space-y-6">
              {/* Feed Subfilters */}
              <div className="flex flex-wrap items-center justify-between border-b border-stone-200 pb-3 gap-3">
                <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setMyFeedSubFilter("all")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      myFeedSubFilter === "all"
                        ? "bg-white text-emerald-800 shadow-2xs font-bold"
                        : "text-stone-600 hover:text-stone-950"
                    }`}
                  >
                    <TranslatedText text="All Updates" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMyFeedSubFilter("itineraries")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      myFeedSubFilter === "itineraries"
                        ? "bg-white text-emerald-800 shadow-2xs font-bold"
                        : "text-stone-600 hover:text-stone-950"
                    }`}
                  >
                    <TranslatedText text="Shared Itineraries" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMyFeedSubFilter("spots")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      myFeedSubFilter === "spots"
                        ? "bg-white text-emerald-800 shadow-2xs font-bold"
                        : "text-stone-600 hover:text-stone-950"
                    }`}
                  >
                    <TranslatedText text="Local Spots" />
                  </button>
                </div>
                <div className="text-xs text-stone-500 italic">
                  <TranslatedText text="Personalized updates from creators you follow" />
                </div>
              </div>

              {myFeedTimeline.length === 0 ? (
                <div className="text-center py-16 px-6 bg-white rounded-3xl border border-dashed border-stone-200 space-y-5 max-w-xl mx-auto">
                  <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto shadow-2xs border border-rose-100 animate-pulse">
                    <Heart className="w-6 h-6 fill-rose-500/10" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-stone-800">
                      <TranslatedText text="Your feed is quiet" />
                    </h3>
                    <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
                      <TranslatedText text="Follow local experts and friends in the Community Explorers tab to see their personalized travel diaries, newly published itineraries, and hidden spots right here!" />
                    </p>
                  </div>

                  {/* Creator Suggestions */}
                  {creators.filter(c => c.email.toLowerCase() !== emailToUse && !followedEmails.includes(c.email.toLowerCase())).length > 0 && (
                    <div className="pt-5 border-t border-stone-100 text-left space-y-3">
                      <p className="text-xs font-bold text-stone-700 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        <TranslatedText text="Suggested Insiders to Follow:" />
                      </p>
                      <div className="space-y-2">
                        {creators
                          .filter(c => c.email.toLowerCase() !== emailToUse && !followedEmails.includes(c.email.toLowerCase()))
                          .slice(0, 3)
                          .map((creator) => (
                            <div key={creator.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-2xl border border-stone-100 hover:bg-stone-100/50 transition-all">
                              <button
                                type="button"
                                onClick={() => setSelectedCreatorEmail(creator.email)}
                                className="flex items-center gap-2.5 text-left hover:opacity-80 transition-opacity"
                              >
                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center border border-emerald-200">
                                  {creator.name[0]?.toUpperCase()}
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-stone-900 flex items-center gap-1">
                                    <span>{creator.name}</span>
                                    {creator.email.includes("localexplorer") && (
                                      <Award className="w-3 h-3 text-emerald-600" />
                                    )}
                                  </div>
                                  <div className="text-[10px] text-stone-400">{creator.homeCity || "Community Explorer"}</div>
                                </div>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleFollowCreator(creator.email)}
                                className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[10px] font-bold transition-all shadow-2xs"
                              >
                                <TranslatedText text="Follow" />
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {myFeedTimeline.map((item) => {
                    if (item.type === "trip") {
                      const trip = item.trip;
                      const authorEmail = (trip.creatorEmail || "").toLowerCase();
                      const isMyTrip = authorEmail === emailToUse;

                      return (
                        <div
                          key={`feed-trip-${trip.id}`}
                          className="bg-white rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group border-t-4 border-t-emerald-700"
                        >
                          <div className="p-5 space-y-3">
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded-lg text-emerald-800 text-[10px] font-bold uppercase tracking-wider self-start w-fit">
                              <Compass className="w-3.5 h-3.5 text-emerald-700" />
                              <TranslatedText text="Itinerary Published" />
                            </div>

                            {/* Top Author Row */}
                            <div className="flex items-center justify-between gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setSelectedCreatorEmail(authorEmail)}
                                className="flex items-center gap-2 text-left group/author hover:opacity-80 transition-opacity"
                              >
                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center border border-emerald-200">
                                  {trip.creatorName ? trip.creatorName[0].toUpperCase() : "T"}
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-stone-900 group-hover/author:text-emerald-700 flex items-center gap-1">
                                    <span>{trip.creatorName || "Local Explorer"}</span>
                                    {trip.creatorEmail?.includes("localexplorer") && (
                                      <Award className="w-3 h-3 text-emerald-600" />
                                    )}
                                  </div>
                                  <div className="text-[10px] text-stone-400">
                                    {new Date(trip.lastUpdated).toLocaleDateString()}
                                  </div>
                                </div>
                              </button>

                              {!isMyTrip && authorEmail && (
                                <button
                                  type="button"
                                  onClick={() => handleFollowCreator(authorEmail)}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all bg-stone-100 text-stone-700 hover:bg-red-50 hover:text-red-600"
                                >
                                  <span className="flex items-center gap-1">
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <TranslatedText text="Following" />
                                  </span>
                                </button>
                              )}
                            </div>

                            {/* Title & Summary */}
                            <div>
                              <h3 className="font-bold text-stone-900 text-base group-hover:text-emerald-800 transition-colors line-clamp-1">
                                {trip.plan?.title}
                              </h3>
                              <p className="text-xs text-stone-600 line-clamp-2 mt-1 leading-relaxed">
                                {trip.plan?.summary}
                              </p>
                            </div>

                            {/* Stats Pills */}
                            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600 pt-1">
                              <span className="flex items-center gap-1 bg-stone-50 px-2 py-1 rounded-md border border-stone-100">
                                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                                <span className="font-semibold">{trip.plan?.totalDays}</span>{" "}
                                {trip.plan?.totalDays === 1 ? t("action.day", "Day") : t("action.days", "Days")}
                              </span>
                              <span className="flex items-center gap-1 bg-stone-50 px-2 py-1 rounded-md border border-stone-100">
                                <MapPin className="w-3.5 h-3.5 text-stone-400" />
                                <span className="font-semibold truncate max-w-[120px]">{trip.plan?.destinationOrTown}</span>
                              </span>
                              <span className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-md text-amber-700 font-semibold border border-amber-200/60">
                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                <span>{trip.rating?.toFixed(1) || "5.0"}</span>
                              </span>
                            </div>

                            {/* Vibes List */}
                            {trip.vibes && trip.vibes.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {trip.vibes.slice(0, 3).map((vibe, idx) => (
                                  <span key={idx} className="px-2 py-0.5 bg-stone-100 text-[10px] text-stone-600 rounded-md font-medium">
                                    {vibe}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="bg-stone-50/80 p-4 border-t border-stone-100 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => setPreviewTrip(trip)}
                              className="px-3 py-2 bg-white hover:bg-stone-100 text-stone-800 border border-stone-200 rounded-xl text-xs font-semibold transition-all shadow-2xs flex items-center gap-1.5"
                            >
                              <Eye className="w-4 h-4 text-emerald-700" />
                              <TranslatedText text="Preview Route" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                incrementTripDownloads(trip.id);
                                onSelectTrip(trip.plan);
                                if (onShowToast) {
                                  onShowToast(`Successfully loaded "${trip.plan.title}" as your active itinerary!`, "success");
                                }
                              }}
                              className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold transition-all shadow-xs active:scale-95 flex items-center gap-1.5"
                            >
                              <Download className="w-4 h-4" />
                              <TranslatedText text="Import" />
                            </button>
                          </div>
                        </div>
                      );
                    } else {
                      const spot = item.spot;
                      const actSpot = communitySpotToActivitySpot(spot);
                      const isLiked = (spot.likedBy || []).includes(emailToUse);

                      return (
                        <div
                          key={`feed-spot-${spot.id}`}
                          className="bg-white rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group border-t-4 border-t-teal-700"
                        >
                          <div className="p-5 space-y-3">
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-teal-50 rounded-lg text-teal-800 text-[10px] font-bold uppercase tracking-wider self-start w-fit">
                              <Sparkles className="w-3.5 h-3.5 text-teal-700" />
                              <TranslatedText text="Spot Shared" />
                            </div>

                            {/* Category & Rating */}
                            <div className="flex items-center justify-between gap-2 pt-1">
                              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                                {spot.category}
                              </span>
                              <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full text-xs font-bold text-amber-700 border border-amber-200/60">
                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                <span>{spot.rating?.toFixed(1) || "5.0"}</span>
                              </div>
                            </div>

                            {/* Spot Title & City */}
                            <div>
                              <h3 className="font-bold text-stone-900 text-base line-clamp-1">{spot.name}</h3>
                              <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
                                <span>
                                  {spot.neighborhood ? `${spot.neighborhood}, ` : ""}
                                  {spot.cityOrRegion}
                                </span>
                              </p>
                            </div>

                            {/* Description */}
                            <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                              {spot.description}
                            </p>

                            {/* Author info */}
                            <div className="flex items-center justify-between text-xs text-stone-500 pt-1 border-t border-stone-100">
                              <button
                                type="button"
                                onClick={() => setSelectedCreatorEmail(spot.creatorEmail)}
                                className="text-stone-700 hover:text-emerald-700 font-medium text-xs flex items-center gap-1.5"
                              >
                                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center">
                                  {spot.creatorName[0]}
                                </div>
                                <span>{spot.creatorName}</span>
                              </button>
                              <span className="font-semibold text-stone-700">{spot.approxCost}</span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="bg-stone-50/80 p-4 border-t border-stone-100 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedSpotForGuide({
                                  spot: actSpot,
                                  destination: spot.cityOrRegion,
                                })
                              }
                              className="px-3 py-2 bg-white hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 text-stone-700 border border-stone-200 rounded-xl text-xs font-semibold transition-all shadow-2xs flex items-center gap-1.5"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                              <TranslatedText text="Details & Guide" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleLikeSpot(spot.id)}
                              className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                                isLiked
                                  ? "bg-rose-50 text-rose-600 border border-rose-200"
                                  : "bg-white text-stone-600 hover:text-rose-600 border border-stone-200"
                              }`}
                            >
                              <Heart className={`w-3.5 h-3.5 ${isLiked ? "fill-rose-500 text-rose-500" : ""}`} />
                              <span>{spot.likesCount || 0}</span>
                            </button>
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: COMMUNITY EXPLORERS */}
          {exploreTab === "creators" && (
            <div>
              {filteredCreators.length === 0 ? (
                <div className="text-center py-16 px-4 bg-white rounded-3xl border border-dashed border-stone-200 space-y-3">
                  <Users className="w-12 h-12 text-stone-300 mx-auto" />
                  <h3 className="text-base font-bold text-stone-800">
                    <TranslatedText text="No explorers match your search" />
                  </h3>
                  <p className="text-xs text-stone-500 max-w-md mx-auto">
                    <TranslatedText text="Try clearing your search or publish your profile to join the community directory!" />
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCreators.map((creator) => {
                    const isMe = creator.email.toLowerCase() === emailToUse;
                    const isFollowing = (profile?.following || [])
                      .map((e) => e.toLowerCase())
                      .includes(creator.email.toLowerCase());

                    return (
                      <div
                        key={creator.id}
                        className="bg-white rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between"
                      >
                        <div className="space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-700 to-teal-800 text-white font-bold text-lg flex items-center justify-center shadow-xs">
                                {creator.name[0]?.toUpperCase() || "E"}
                              </div>
                              <div>
                                <h3 className="font-bold text-stone-900 text-base">{creator.name}</h3>
                                {creator.homeCity && (
                                  <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                                    <MapPin className="w-3 h-3 text-stone-400" />
                                    <span>{creator.homeCity}</span>
                                  </p>
                                )}
                              </div>
                            </div>

                            {!isMe && (
                              <button
                                type="button"
                                onClick={() => handleFollowCreator(creator.email)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                  isFollowing
                                    ? "bg-stone-100 text-stone-700 hover:bg-red-50 hover:text-red-600"
                                    : "bg-emerald-700 text-white hover:bg-emerald-800 shadow-xs"
                                }`}
                              >
                                {isFollowing ? <TranslatedText text="Following" /> : <TranslatedText text="Follow" />}
                              </button>
                            )}
                          </div>

                          <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                            {creator.bio || "Passionate explorer sharing authentic travel itineraries and local food gems."}
                          </p>

                          {/* Stats & Badges */}
                          <div className="flex items-center gap-3 text-xs text-stone-600 pt-2 border-t border-stone-100">
                            <div>
                              <strong className="text-stone-900 font-bold">{creator.publishedTripsCount || 0}</strong>{" "}
                              <TranslatedText text="trips" />
                            </div>
                            <div>
                              <strong className="text-stone-900 font-bold">{creator.publishedSpotsCount || 0}</strong>{" "}
                              <TranslatedText text="spots" />
                            </div>
                            <div>
                              <strong className="text-stone-900 font-bold">{creator.followers?.length || 0}</strong>{" "}
                              <TranslatedText text="followers" />
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedCreatorEmail(creator.email)}
                          className="w-full mt-4 py-2 px-4 bg-stone-100 hover:bg-emerald-50 hover:text-emerald-800 text-stone-700 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                        >
                          <User className="w-3.5 h-3.5 text-emerald-600" />
                          <TranslatedText text="View Full Portfolio" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Creator Profile Modal */}
      {selectedCreatorEmail && (
        <CreatorProfileModal
          isOpen={Boolean(selectedCreatorEmail)}
          onClose={() => setSelectedCreatorEmail(null)}
          creatorEmail={selectedCreatorEmail}
          onSelectTrip={(plan) => {
            onSelectTrip(plan);
            setSelectedCreatorEmail(null);
          }}
          onImportSpot={(spot) => {
            setImportingSpot(spot);
            setSelectedCreatorEmail(null);
          }}
          onShowToast={onShowToast}
        />
      )}

      {/* MODAL 2: Itinerary Preview Modal (Doesn't touch active plan unless user clicks 'Open') */}
      {previewTrip && (
        <ItineraryPreviewModal
          isOpen={Boolean(previewTrip)}
          onClose={() => setPreviewTrip(null)}
          trip={previewTrip}
          onOpenInWorkspace={(plan) => {
            incrementTripDownloads(previewTrip.id);
            onSelectTrip(plan);
            if (onShowToast) onShowToast(`Loaded "${plan.title}" to active workspace!`, "success");
            setPreviewTrip(null);
          }}
          onSaveCopy={(plan) => {
            saveTrip(plan);
            if (onShowToast) onShowToast(`Saved copy of "${plan.title}" to My Trips!`, "success");
          }}
          onOpenActivityDetails={(spot, dayNum) => {
            setSelectedSpotForGuide({
              spot,
              destination: previewTrip.plan.destinationOrTown,
              dayNumber: dayNum,
            });
          }}
          onShowToast={onShowToast}
        />
      )}

      {/* MODAL 3: Activity / Spot Detail & Guide Modal */}
      {selectedSpotForGuide && (
        <ActivityDetailModal
          spot={selectedSpotForGuide.spot}
          destination={selectedSpotForGuide.destination}
          dayNumber={selectedSpotForGuide.dayNumber}
          onClose={() => setSelectedSpotForGuide(null)}
        />
      )}

      {/* MODAL 4: Publish Trip Modal */}
      {isPublishTripOpen && tripToPublish && (
        <PublishTripModal
          isOpen={isPublishTripOpen}
          onClose={() => {
            setIsPublishTripOpen(false);
            setTripToPublish(null);
          }}
          trip={tripToPublish}
          onPublished={() => {
            loadExploreData(true);
            if (onShowToast) onShowToast("Your itinerary is now published in Explore!", "success");
          }}
          onShowToast={onShowToast}
        />
      )}

      {/* MODAL 5: Publish Individual Spot Modal */}
      {isPublishSpotOpen && (
        <PublishSpotModal
          isOpen={isPublishSpotOpen}
          onClose={() => setIsPublishSpotOpen(false)}
          onPublished={() => {
            loadExploreData(true);
            if (onShowToast) onShowToast("Spot shared with the community!", "success");
          }}
          onShowToast={onShowToast}
        />
      )}

      {/* MODAL 6: Import Spot Day Picker Modal */}
      {importingSpot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setImportingSpot(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-800">
                <Sparkles className="w-5 h-5" />
                <h3 className="font-bold text-base font-serif">
                  <TranslatedText text="Import Spot to Itinerary" />
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setImportingSpot(null)}
                className="text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200">
              <h4 className="font-bold text-stone-900 text-sm">{importingSpot.name}</h4>
              <p className="text-xs text-stone-500">
                {importingSpot.neighborhood ? `${importingSpot.neighborhood}, ` : ""}
                {importingSpot.cityOrRegion}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                <TranslatedText text="Select Day to Add Activity:" />
              </label>
              {currentPlan ? (
                <div className="grid grid-cols-3 gap-2">
                  {(currentPlan.days || []).map((day) => (
                    <button
                      key={day.dayNumber}
                      type="button"
                      onClick={() => setSelectedImportDay(day.dayNumber)}
                      className={`p-3 rounded-xl text-xs font-bold transition-all border ${
                        selectedImportDay === day.dayNumber
                          ? "bg-emerald-700 text-white border-emerald-700 shadow-xs"
                          : "bg-white text-stone-700 border-stone-200 hover:bg-stone-100"
                      }`}
                    >
                      {t("action.day", "Day")} {day.dayNumber}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl">
                  <TranslatedText text="Please generate or load an itinerary in the planner first." />
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setImportingSpot(null)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800"
              >
                <TranslatedText text="Cancel" />
              </button>
              <button
                type="button"
                disabled={!currentPlan}
                onClick={handleConfirmImportSpot}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold transition-all shadow-xs disabled:opacity-50"
              >
                <TranslatedText text="Add to Day" /> {selectedImportDay}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smartphone Floating Action Button (FAB) for Publish and Share - Hidden on Desktop */}
      <div className="fixed bottom-36 right-6 z-40 md:hidden no-print flex flex-col items-end gap-3">
        {/* Floating Actions Menu */}
        {isFabOpen && (
          <div className="flex flex-col items-end gap-2.5 mb-1 animate-in slide-in-from-bottom-5 duration-200">
            {/* Button 1: Publish Itinerary */}
            <button
              onClick={() => {
                setIsFabOpen(false);
                if (currentPlan) {
                  setTripToPublish(currentPlan);
                  setIsPublishTripOpen(true);
                } else {
                  const saved = getSavedTrips();
                  if (saved.length > 0) {
                    setTripToPublish(saved[0]);
                    setIsPublishTripOpen(true);
                  } else {
                    if (onShowToast) onShowToast("Create an itinerary first to publish it!", "info");
                  }
                }
              }}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg active:scale-95 transition-all border border-emerald-500/30 whitespace-nowrap cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5" />
              <TranslatedText text="Publish Itinerary" />
            </button>

            {/* Button 2: Share a Spot */}
            <button
              onClick={() => {
                setIsFabOpen(false);
                setIsPublishSpotOpen(true);
              }}
              className="flex items-center gap-2 px-3 py-2 bg-[#5A5A40] hover:bg-[#4a4a34] text-white rounded-xl text-xs font-semibold shadow-lg active:scale-95 transition-all border border-stone-600/30 whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
              <TranslatedText text="Share a Spot" />
            </button>
          </div>
        )}

        {/* Main Trigger Button */}
        <button
          onClick={() => setIsFabOpen(!isFabOpen)}
          className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white transition-all duration-300 transform border border-white/20 active:scale-90 cursor-pointer ${
            isFabOpen ? "bg-stone-800 rotate-135" : "bg-emerald-700 hover:bg-emerald-600"
          }`}
          title="Publish or Share"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
