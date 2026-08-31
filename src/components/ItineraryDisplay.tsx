import React, { useState, useEffect } from "react";
import { ItineraryPlan, ActivitySpot, DailyPlan } from "../types";
import { DayCard } from "./DayCard";
import { InteractiveMap } from "./InteractiveMap";
import { EditActivityModal } from "./EditActivityModal";
import { AddActivityModal } from "./AddActivityModal";
import { ActivityDetailModal } from "./ActivityDetailModal";
import { OfflinePocketModal } from "./OfflinePocketModal";
import { GroupCollaborationModal } from "./GroupCollaborationModal";
import { ScheduleAdjusterModal } from "./ScheduleAdjusterModal";
import { RouteOptimizerModal } from "./RouteOptimizerModal";
import { SwapSpotModal } from "./SwapSpotModal";
import { TravelWalletHub } from "./TravelWalletHub";
import { DayCompanionMode } from "./DayCompanionMode";
import { CollaboratorPresence } from "./CollaboratorPresence";
import { AIModelStatusBanner } from "./AIModelStatusBanner";
import {
  Bookmark,
  BookmarkCheck,
  Share2,
  Printer,
  Sparkles,
  MapPin,
  Sun,
  Plus,
  Wand2,
  X,
  Loader2,
  Hotel,
  Smartphone,
  Users,
  Clock,
  CheckCircle2,
  Compass,
  Wallet,
  Navigation,
  Luggage,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import confetti from "canvas-confetti";
import { parseTimeToHours } from "../utils/time";
import { getRouteInfoBetweenSpots } from "../utils/transit";
import { PrintDailyMap } from "./PrintDailyMap";
import { formatCleanTripTitle, formatConciseWeather } from "../utils/formatters";
import { WeatherForecastCard } from "./WeatherForecastCard";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { IdentifyMemberModal } from "./IdentifyMemberModal";
import { PublishTripModal } from "./PublishTripModal";
import { PublishSpotModal } from "./PublishSpotModal";
import { getUserPermissions, publishSharedTripUpdate, subscribeToSharedTrip } from "../utils/sharedTripService";
import { TranslatedText } from "./TranslatedText";
import { translateEntireItineraryPlan } from "../utils/translator";

interface ItineraryDisplayProps {
  plan: ItineraryPlan;
  isSaved: boolean;
  onSaveTrip: () => void;
  onOpenExport: () => void;
  onSwapActivity: (
    activity: ActivitySpot,
    dayNumber: number,
    options?: { isIndoorOnly?: boolean; customRequirement?: string }
  ) => Promise<void>;
  onUpdatePlan: (updatedPlan: ItineraryPlan) => void;
  onSkipPermanently?: (activity: ActivitySpot, dayNumber: number) => void;
  onRegenerateAll?: () => void;
  onReiteratePlan?: (instructions?: string) => Promise<void>;
  onVisitedChanged?: (activity: ActivitySpot, isVisited: boolean) => void;
}

export const ItineraryDisplay: React.FC<ItineraryDisplayProps> = ({
  plan,
  isSaved,
  onSaveTrip,
  onOpenExport,
  onSwapActivity,
  onUpdatePlan,
  onSkipPermanently,
  onRegenerateAll,
  onReiteratePlan,
  onVisitedChanged,
}) => {
  const { t, formatCurrency, language } = useLanguage();
  const { user, activeEmail } = useAuth();
  const [activeDayNumber, setActiveDayNumber] = useState<number | "all">("all");
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [itinerarySubTab, setItinerarySubTab] = useState<"itinerary" | "companion" | "group" | "wallet" | "offline">("itinerary");

  const userPerms = getUserPermissions(plan, undefined, activeEmail || user?.email);

  // Modals state
  const [editingActivity, setEditingActivity] = useState<{ activity: ActivitySpot; dayNumber: number } | null>(null);
  const [addingDayNumber, setAddingDayNumber] = useState<number | null>(null);
  const [detailedActivity, setDetailedActivity] = useState<{ spot: ActivitySpot; dayNumber?: number } | null>(null);
  const [swappingActivity, setSwappingActivity] = useState<{ activity: ActivitySpot; dayNumber: number } | null>(null);
  const [publishingActivity, setPublishingActivity] = useState<{ activity: ActivitySpot; dayNumber: number } | null>(null);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [isHighlightsExpanded, setIsHighlightsExpanded] = useState(false);

  const handleSaveSwap = (newSpot: ActivitySpot, dayNumber: number) => {
    const updatedDays = plan.days.map((day) => {
      if (day.dayNumber === dayNumber) {
        const activities = day.activities.map((act) => {
          if (act.id === swappingActivity?.activity.id) {
            return {
              ...newSpot,
              id: act.id, // Keep original ID if preferred or generate fresh
            };
          }
          return act;
        });
        return { ...day, activities };
      }
      return day;
    });
    onUpdatePlan({ ...plan, days: updatedDays });
    setSwappingActivity(null);
  };

  const handleSwapWithExisting = (
    activityA: ActivitySpot,
    dayNumA: number,
    activityB: ActivitySpot,
    dayNumB: number
  ) => {
    const updatedDays = plan.days.map((day) => {
      let activities = [...day.activities];
      if (day.dayNumber === dayNumA) {
        activities = activities.map((act) => {
          if (act.id === activityA.id) {
            return { ...activityB, time: activityA.time };
          }
          return act;
        });
      }
      if (day.dayNumber === dayNumB) {
        activities = activities.map((act) => {
          if (act.id === activityB.id) {
            return { ...activityA, time: activityB.time };
          }
          return act;
        });
      }
      return { ...day, activities };
    });
    onUpdatePlan({ ...plan, days: updatedDays });
    setSwappingActivity(null);
  };

  // Feature Modals state
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [showCollabModal, setShowCollabModal] = useState(false);
  const [collabInitialTab, setCollabInitialTab] = useState<"votes" | "packing" | "shopping" | "expenses" | "members">("votes");
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showRouteOptimizerModal, setShowRouteOptimizerModal] = useState(false);
  const [optimizingDayNumber, setOptimizingDayNumber] = useState<number>(1);
  const [showIdentifyModal, setShowIdentifyModal] = useState(false);
  const [showPackingModal, setShowPackingModal] = useState(false);
  const [adjustingDayNumber, setAdjustingDayNumber] = useState<number>(1);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "info" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "info" | "error" = "info") => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleApplyAdjustedDay = (updatedDay: DailyPlan) => {
    const updatedDays = plan.days.map((d) => (d.dayNumber === updatedDay.dayNumber ? updatedDay : d));
    onUpdatePlan({
      ...plan,
      days: updatedDays,
    });
  };

  const handleApplyOptimizedDayActivities = (dayNumber: number, orderedActivities: ActivitySpot[]) => {
    const updatedDays = plan.days.map((d) => {
      if (d.dayNumber === dayNumber) {
        return {
          ...d,
          activities: orderedActivities,
        };
      }
      return d;
    });

    onUpdatePlan({
      ...plan,
      days: updatedDays,
    });
    showToast(`Day ${dayNumber} route optimized for travel efficiency!`, "success");
  };

  // Auto-translate itinerary in background when language changes
  useEffect(() => {
    if (language !== "en" && plan) {
      translateEntireItineraryPlan(plan, language).catch((err) => {
        console.warn("Background translation:", err);
      });
    }
  }, [plan, language]);

  // Reiteration modal state
  const [showReiterateModal, setShowReiterateModal] = useState(false);
  const [reiterateInstructions, setReiterateInstructions] = useState("");
  const [isReiterating, setIsReiterating] = useState(false);

  const handleConfirmReiterate = async () => {
    if (!onReiteratePlan) return;
    setIsReiterating(true);
    try {
      await onReiteratePlan(reiterateInstructions);
      setShowReiterateModal(false);
      setReiterateInstructions("");
    } finally {
      setIsReiterating(false);
    }
  };

  const handleTriggerReDo = async () => {
    if (!onReiteratePlan) return;
    setIsReiterating(true);
    try {
      await onReiteratePlan("Re-Do entire itinerary: Regenerate all activities with fresh local recommendations and re-optimized route logistics while preserving user preferences.");
    } finally {
      setIsReiterating(false);
    }
  };

  const handleSaveClick = () => {
    onSaveTrip();
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
      });
    } catch {
      // ignore
    }
  };

  const handleSelectSpot = (spot: ActivitySpot) => {
    setSelectedSpotId(spot.id);
    // If we're filtering by a specific day and the spot is on another day, switch to that day
    const containingDay = plan.days.find((d) => d.activities.some((a) => a.id === spot.id));
    if (containingDay && activeDayNumber !== "all" && activeDayNumber !== containingDay.dayNumber) {
      setActiveDayNumber(containingDay.dayNumber);
    }
    setTimeout(() => {
      const element = document.getElementById(`activity-card-${spot.id}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 80);
  };

  // Activity Edit Handler
  const handleSaveEditedActivity = (updatedActivity: ActivitySpot, dayNumber: number) => {
    const newDays = plan.days.map((day) => {
      if (day.dayNumber !== dayNumber) return day;
      const updatedActs = day.activities.map((act) => (act.id === updatedActivity.id ? updatedActivity : act));
      updatedActs.sort((a, b) => parseTimeToHours(a.time) - parseTimeToHours(b.time));
      return {
        ...day,
        activities: updatedActs,
      };
    });
    onUpdatePlan({ ...plan, days: newDays });
  };

  // Activity Delete Handler
  const handleDeleteActivity = (activityId: string, dayNumber: number) => {
    const newDays = plan.days.map((day) => {
      if (day.dayNumber !== dayNumber) return day;
      return {
        ...day,
        activities: day.activities.filter((act) => act.id !== activityId),
      };
    });
    onUpdatePlan({ ...plan, days: newDays });
  };

  // Activity Reorder Handler
  const handleMoveActivity = (dayNumber: number, fromIndex: number, toIndex: number) => {
    const newDays = plan.days.map((day) => {
      if (day.dayNumber !== dayNumber) return day;
      const acts = [...day.activities];
      if (toIndex < 0 || toIndex >= acts.length) return day;

      const originalTimes = acts.map((a) => a.time);
      const [moved] = acts.splice(fromIndex, 1);
      acts.splice(toIndex, 0, moved);

      const reassigned = acts.map((act, idx) => ({
        ...act,
        time: originalTimes[idx] || act.time,
      }));

      return { ...day, activities: reassigned };
    });
    onUpdatePlan({ ...plan, days: newDays });
  };

  // Activity Reorder Across Days Handler
  const handleMoveActivityAcrossDays = (
    fromDayNumber: number,
    fromIndex: number,
    toDayNumber: number,
    toIndex: number
  ) => {
    if (fromDayNumber === toDayNumber) {
      handleMoveActivity(fromDayNumber, fromIndex, toIndex);
      return;
    }

    const fromDay = plan.days.find((d) => d.dayNumber === fromDayNumber);
    const toDay = plan.days.find((d) => d.dayNumber === toDayNumber);
    if (!fromDay || !toDay) return;

    const movedActivity = fromDay.activities[fromIndex];
    if (!movedActivity) return;

    // Remove from source day & reassign remaining times
    const newFromActivities = [...fromDay.activities];
    const originalFromTimes = newFromActivities.map((a) => a.time);
    newFromActivities.splice(fromIndex, 1);
    const reassignedFrom = newFromActivities.map((act, idx) => ({
      ...act,
      time: originalFromTimes[idx] || act.time,
    }));

    // Insert into target day & reassign times
    const newToActivities = [...toDay.activities];
    const safeInsertIndex = Math.min(Math.max(0, toIndex), newToActivities.length);
    newToActivities.splice(safeInsertIndex, 0, movedActivity);

    const defaultTimeSlots = ["09:00 AM", "11:00 AM", "01:30 PM", "04:00 PM", "07:00 PM", "09:00 PM"];
    const reassignedTo = newToActivities.map((act, idx) => ({
      ...act,
      time: toDay.activities[idx]?.time || defaultTimeSlots[idx] || act.time,
    }));

    const newDays = plan.days.map((day) => {
      if (day.dayNumber === fromDayNumber) {
        return { ...day, activities: reassignedFrom };
      }
      if (day.dayNumber === toDayNumber) {
        return { ...day, activities: reassignedTo };
      }
      return day;
    });

    onUpdatePlan({ ...plan, days: newDays });
    showToast(`Moved "${movedActivity.title}" to Day ${toDayNumber}`, "success");
  };

  // Alternative Option Selection (Multiple Choice toggle) - Fixed immutable state
  const handleSelectAlternativeOption = (dayNumber: number, activityIndex: number, optionIndex: number) => {
    const newDays = plan.days.map((day) => {
      if (day.dayNumber !== dayNumber) return day;
      const acts = [...day.activities];
      const targetAct = acts[activityIndex];
      if (!targetAct) return day;

      // Extract or reconstruct the persistent master list of all options
      const optionsList: ActivitySpot[] =
        targetAct.allOptions && targetAct.allOptions.length > 0
          ? targetAct.allOptions
          : [
              {
                ...targetAct,
                allOptions: undefined,
                alternativeOptions: undefined,
                selectedOptionIndex: undefined,
              },
              ...(targetAct.alternativeOptions || []),
            ];

      const safeOptionIdx = Math.max(0, Math.min(optionIndex, optionsList.length - 1));
      const chosenSpot = optionsList[safeOptionIdx];
      if (!chosenSpot) return day;

      acts[activityIndex] = {
        ...chosenSpot,
        id: targetAct.id, // keep original unique identifier for stable rendering
        time: targetAct.time, // keep assigned time slot
        allOptions: optionsList, // keep the master options list intact
        alternativeOptions: optionsList.slice(1),
        selectedOptionIndex: safeOptionIdx,
      };

      return { ...day, activities: acts };
    });

    onUpdatePlan({ ...plan, days: newDays });
  };

  // Custom Activity Add Handler
  const handleAddCustomActivity = (newActivity: ActivitySpot, dayNumber: number) => {
    const newDays = plan.days.map((day) => {
      if (day.dayNumber !== dayNumber) return day;
      const updatedActs = [...day.activities, newActivity];
      updatedActs.sort((a, b) => parseTimeToHours(a.time) - parseTimeToHours(b.time));
      return {
        ...day,
        activities: updatedActs,
      };
    });
    onUpdatePlan({ ...plan, days: newDays });
  };

  // Day Header (title/theme) Edit Handler — immutable update through parent
  const handleUpdateDayHeader = (dayNumber: number, patch: { dayTitle?: string; theme?: string }) => {
    const newDays = plan.days.map((day) =>
      day.dayNumber === dayNumber ? { ...day, ...patch } : day
    );
    onUpdatePlan({ ...plan, days: newDays });
  };

  // Add New Day
  const handleAddNewDay = () => {
    const nextDayNum = plan.days.length + 1;
    const newDay: DailyPlan = {
      dayNumber: nextDayNum,
      dayTitle: `Day ${nextDayNum}: Extended Local Exploration`,
      theme: "Spontaneous Discoveries & Hidden Gems",
      summary: `An additional day to dive deeper into ${plan.destinationOrTown}.`,
      estimatedTotalBudget: "$40 - $75",
      activities: [
        {
          id: `act-new-${nextDayNum}-1`,
          time: "10:00 AM - 12:30 PM",
          name: "Morning Artisan Walk & Landmark",
          category: "sightseeing",
          description: `Explore picturesque neighborhood corners and artisan boutiques in ${plan.destinationOrTown}.`,
          insiderTip: "Perfect time for quiet photography before midday.",
          approxCost: "Free",
          rating: 4.8,
          coordinates: {
            lat: plan.mapCenter.lat + 0.003,
            lng: plan.mapCenter.lng + 0.002,
          },
        },
        {
          id: `act-new-${nextDayNum}-2`,
          time: "01:00 PM - 03:30 PM",
          name: "Local Tasting & Relaxed Luncheon",
          category: "food",
          description: "Savor authentic regional dishes and local wine or cider.",
          insiderTip: "Ask for the daily seasonal tasting plate.",
          approxCost: "$20 - $35",
          rating: 4.9,
          coordinates: {
            lat: plan.mapCenter.lat - 0.002,
            lng: plan.mapCenter.lng - 0.001,
          },
        },
      ],
    };

    onUpdatePlan({
      ...plan,
      totalDays: nextDayNum,
      days: [...plan.days, newDay],
    });
  };

  // Delete a Day
  const handleDeleteDay = (dayNumber: number) => {
    if (plan.days.length <= 1) {
      alert("An itinerary must contain at least 1 day.");
      return;
    }
    const filteredDays = plan.days
      .filter((d) => d.dayNumber !== dayNumber)
      .map((d, idx) => ({ ...d, dayNumber: idx + 1, dayTitle: d.dayTitle.replace(/Day \d+:/, `Day ${idx + 1}:`) }));

    onUpdatePlan({
      ...plan,
      totalDays: filteredDays.length,
      days: filteredDays,
    });
  };

  // Compute clean short title and concise weather info
  const cleanTripTitle = formatCleanTripTitle(plan.title, plan.totalDays, plan.destinationOrTown, plan.mode);
  const conciseWeather = formatConciseWeather(plan.weatherSummary, plan.destinationOrTown);

  return (
    <div className="space-y-6">
      {/* SCREEN-ONLY WRAPPER */}
      <div className="print:hidden space-y-6">
        {/* Additional Segmented Sub-Navigation Menu for Itinerary (Sticky at top below navbar) */}
        <div className="sticky top-14 sm:top-18 z-20 bg-[#f5f5f0]/95 backdrop-blur-md py-3 -mx-3 px-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 no-print border-b border-[#e5e5df]/50 transition-all">
          <div className="bg-white p-1 rounded-2xl border border-[#e5e5df] max-w-3xl mx-auto w-full grid grid-cols-5 gap-0.5 sm:gap-1 shadow-2xs">
            <button
              id="nav-sub-itinerary"
              onClick={() => setItinerarySubTab("itinerary")}
              className={`flex flex-col sm:flex-row items-center justify-center space-y-0.5 sm:space-y-0 sm:space-x-1.5 py-1.5 sm:py-2.5 px-0.5 sm:px-2.5 rounded-xl text-[10px] sm:text-xs font-semibold tracking-tight transition-all cursor-pointer text-center w-full min-w-0 ${
                itinerarySubTab === "itinerary"
                  ? "bg-[#5A5A40] text-white shadow-xs font-bold"
                  : "text-[#6b6b5e] hover:text-[#2c2c24] hover:bg-[#f5f5f0]"
              }`}
            >
              <Compass className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="sm:hidden text-[10px] truncate max-w-full"><TranslatedText text="Plan" /></span>
              <span className="hidden sm:inline"><TranslatedText text="Daily Plan" /></span>
            </button>
            <button
              id="nav-sub-companion"
              onClick={() => setItinerarySubTab("companion")}
              className={`flex flex-col sm:flex-row items-center justify-center space-y-0.5 sm:space-y-0 sm:space-x-1.5 py-1.5 sm:py-2.5 px-0.5 sm:px-2.5 rounded-xl text-[10px] sm:text-xs font-semibold tracking-tight transition-all cursor-pointer text-center relative w-full min-w-0 ${
                itinerarySubTab === "companion"
                  ? "bg-[#5A5A40] text-white shadow-xs font-bold"
                  : "text-[#6b6b5e] hover:text-[#2c2c24] hover:bg-[#f5f5f0]"
              }`}
            >
              <Navigation className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="sm:hidden text-[10px] truncate max-w-full"><TranslatedText text="Live AI" /></span>
              <span className="hidden sm:inline"><TranslatedText text="Live Companion" /></span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse absolute top-1 right-1" />
            </button>
            <button
              id="nav-sub-wallet"
              onClick={() => setItinerarySubTab("wallet")}
              className={`flex flex-col sm:flex-row items-center justify-center space-y-0.5 sm:space-y-0 sm:space-x-1.5 py-1.5 sm:py-2.5 px-0.5 sm:px-2.5 rounded-xl text-[10px] sm:text-xs font-semibold tracking-tight transition-all cursor-pointer text-center w-full min-w-0 ${
                itinerarySubTab === "wallet"
                  ? "bg-[#5A5A40] text-white shadow-xs font-bold"
                  : "text-[#6b6b5e] hover:text-[#2c2c24] hover:bg-[#f5f5f0]"
              }`}
            >
              <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="sm:hidden text-[10px] truncate max-w-full"><TranslatedText text="Wallet" /></span>
              <span className="hidden sm:inline"><TranslatedText text="Travel Wallet" /></span>
            </button>
            <button
              id="nav-sub-group"
              onClick={() => setItinerarySubTab("group")}
              className={`flex flex-col sm:flex-row items-center justify-center space-y-0.5 sm:space-y-0 sm:space-x-1.5 py-1.5 sm:py-2.5 px-0.5 sm:px-2.5 rounded-xl text-[10px] sm:text-xs font-semibold tracking-tight transition-all cursor-pointer text-center w-full min-w-0 ${
                itinerarySubTab === "group"
                  ? "bg-[#5A5A40] text-white shadow-xs font-bold"
                  : "text-[#6b6b5e] hover:text-[#2c2c24] hover:bg-[#f5f5f0]"
              }`}
            >
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="sm:hidden text-[10px] truncate max-w-full"><TranslatedText text="Group" /></span>
              <span className="hidden sm:inline"><TranslatedText text="Group Hub" /></span>
            </button>
            <button
              id="nav-sub-offline"
              onClick={() => setItinerarySubTab("offline")}
              className={`flex flex-col sm:flex-row items-center justify-center space-y-0.5 sm:space-y-0 sm:space-x-1.5 py-1.5 sm:py-2.5 px-0.5 sm:px-2.5 rounded-xl text-[10px] sm:text-xs font-semibold tracking-tight transition-all cursor-pointer text-center w-full min-w-0 ${
                itinerarySubTab === "offline"
                  ? "bg-[#5A5A40] text-white shadow-xs font-bold"
                  : "text-[#6b6b5e] hover:text-[#2c2c24] hover:bg-[#f5f5f0]"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="sm:hidden text-[10px] truncate max-w-full"><TranslatedText text="Offline" /></span>
              <span className="hidden sm:inline"><TranslatedText text="Offline Pocket" /></span>
            </button>
          </div>
        </div>

        {itinerarySubTab === "itinerary" && (
          <>
            {/* AI Model Generation & Verification Status Banner */}
            <div className="hidden sm:block">
              <AIModelStatusBanner meta={plan.generationMeta} />
            </div>

            {/* Header Banner Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#e5e5df] shadow-sm relative overflow-hidden space-y-6">
        {/* Top Badges & Clean Visual Toolbar Section (Improved Layout for PC & Mobile) */}
        <div className="flex flex-col gap-4 sm:gap-5 pb-5 border-b border-[#e5e5df]">
          {/* Row 1: Metadata Badges (Full Width, No Squishing on PC, Hidden items on Mobile) */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden sm:inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-[#ecece4] text-[#5A5A40] border border-[#d1d1ca] items-center gap-1">
              <span>{plan.mode === "vacation" ? "✈️" : "📍"}</span>
              <span>{plan.mode === "vacation" ? `${plan.totalDays} Days` : "Native Hometown Guide"}</span>
            </span>

            {plan.startDate && (
              <span className="hidden sm:inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-[#5A5A40] text-white border border-[#4a4a35] items-center gap-1 shadow-2xs">
                <span>📅</span>
                <span>
                  {plan.mode === "hometown" ? (
                    <>
                      <TranslatedText text="Outing Date:" />{" "}
                      {new Date((plan.startDate || new Date().toISOString().split("T")[0]) + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </>
                  ) : (
                    new Date((plan.startDate || new Date().toISOString().split("T")[0]) + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                  )}
                </span>
              </span>
            )}

            {/* Short Weather Badge with Tooltip */}
            {conciseWeather && (
              <div className="relative group/weather">
                <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200 shadow-2xs cursor-help">
                  <span>{conciseWeather.emoji}</span>
                  <span className="font-bold">{conciseWeather.temp}</span>
                  <span className="hidden sm:inline text-amber-800 font-normal">• {conciseWeather.shortDesc}</span>
                </span>
                {conciseWeather.fullText && (
                  <div className="absolute top-full left-0 mt-1.5 w-64 p-2.5 bg-[#2c2c24] text-white text-[11px] rounded-xl shadow-xl z-30 opacity-0 group-hover/weather:opacity-100 transition-opacity pointer-events-none border border-[#4a4a35]">
                    <p className="font-serif italic text-[#ecece4] mb-1">Typical Destination Climate:</p>
                    <p className="text-gray-200">{conciseWeather.fullText}</p>
                  </div>
                )}
              </div>
            )}

            {plan.customPace && (
              <span className="hidden sm:inline-flex px-3 py-1 rounded-full text-xs font-medium bg-[#f5f5f0] text-[#6b6b5e] border border-[#e5e5df]">
                Pace: {plan.customPace}
              </span>
            )}

            {plan.groupSize && plan.groupSize > 0 && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#ecece4] text-[#2c2c24] border border-[#d1d1ca]">
                👥 {plan.groupSize}<span className="hidden sm:inline"> Traveler{plan.groupSize > 1 ? "s" : ""}</span>
              </span>
            )}

            {plan.budgetType === "exact" && plan.exactBudgetPerDay ? (
              <span className="hidden sm:inline-flex px-3 py-1 rounded-full text-xs font-medium bg-[#f5f5f0] text-[#5A5A40] border border-[#d1d1ca] font-serif italic">
                💰 {plan.currency || "€"}{plan.exactBudgetPerDay} / day
              </span>
            ) : plan.budgetTier ? (
              <span className="hidden sm:inline-flex px-3 py-1 rounded-full text-xs font-medium bg-[#f5f5f0] text-[#6b6b5e] border border-[#e5e5df]">
                Budget: {plan.budgetTier}
              </span>
            ) : null}

            {plan.arrivalHour && (
              <span className="hidden sm:inline-flex px-3 py-1 rounded-full text-xs font-medium bg-[#ecece4] text-[#2c2c24] border border-[#d1d1ca]">
                🛬 {plan.arrivalHour}
              </span>
            )}

            {plan.departureHour && (
              <span className="hidden sm:inline-flex px-3 py-1 rounded-full text-xs font-medium bg-[#ecece4] text-[#2c2c24] border border-[#d1d1ca]">
                🛫 {plan.departureHour}
              </span>
            )}
          </div>

          {/* Row 2: Action Buttons Toolbar (Polished full-width dashboard bar on PC, horizontal wrap on Mobile) */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 no-print lg:bg-[#fcfcfb] lg:p-3 lg:rounded-2xl lg:border lg:border-[#ecece5] w-full">
            {/* Member Identity / Access Badge */}
            {!userPerms.isClaimed ? (
              <button
                type="button"
                onClick={() => setShowIdentifyModal(true)}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-sans font-semibold text-[11px] sm:text-xs border border-amber-300 transition-all shadow-2xs animate-pulse"
                title="Claim your member identity in this group itinerary"
              >
                <Users className="w-3 h-3 text-amber-800" />
                <span>Claim</span>
              </button>
            ) : (
              <span className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] sm:text-xs font-semibold">
                <span>{userPerms.isOrganizer ? "👑" : userPerms.isContributor ? "✏️" : "👁️"}</span>
                <span className="hidden sm:inline">{userPerms.isOrganizer ? " Organizer" : userPerms.isContributor ? " Contributor" : " Viewer"}</span>
                <span className="sm:hidden">{userPerms.isOrganizer ? "Org" : userPerms.isContributor ? "Edit" : "View"}</span>
              </span>
            )}

            {/* Active Partners / Collaborator Presence */}
            <div className="hidden sm:block">
              <CollaboratorPresence />
            </div>

            {/* Primary: Save Trip */}
            <button
              id="btn-save-itinerary"
              onClick={handleSaveClick}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg font-sans font-semibold text-[11px] sm:text-xs transition-all shadow-sm ${
                isSaved
                  ? "bg-[#ecece4] text-[#5A5A40] border border-[#5A5A40]"
                  : "bg-[#2c2c24] text-white hover:bg-[#3d3d32] active:scale-95"
              }`}
            >
              {isSaved ? (
                <>
                  <BookmarkCheck className="w-3.5 h-3.5 text-[#5A5A40]" />
                  <span>{t("action.saved", "Saved")}</span>
                </>
              ) : (
                <>
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>{t("action.saveTrip", "Save")}</span>
                </>
              )}
            </button>

            {/* Export / Share */}
            <button
              id="btn-export-itinerary"
              onClick={onOpenExport}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-[#f5f5f0] hover:bg-[#ecece4] text-[#2c2c24] font-sans font-medium text-[11px] sm:text-xs border border-[#d1d1ca] transition-colors shadow-2xs"
              title="Export PDF, Apple / Google Wallet, or Share Link"
            >
              <Share2 className="w-3.5 h-3.5 text-[#5A5A40]" />
              <span>{t("action.export", "Export")}</span>
            </button>

            {/* Publish to Explore */}
            <button
              id="btn-publish-to-explore"
              onClick={() => setIsPublishModalOpen(true)}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-sans font-medium text-[11px] sm:text-xs border border-emerald-200 transition-colors shadow-2xs"
              title="Publish this itinerary to the Community Explore Feed"
            >
              <Compass className="w-3 h-3 text-emerald-700" />
              <span><TranslatedText text="Publish" /></span>
            </button>

            {/* Auto-Fill with AI & Re-Do (if available) */}
            {onReiteratePlan && (
              <div className="flex items-center space-x-1.5">
                <button
                  id="btn-reiterate-itinerary"
                  onClick={() => setShowReiterateModal(true)}
                  className="hidden sm:flex items-center space-x-1 px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-900 font-sans font-medium text-xs border border-purple-200 transition-colors shadow-2xs cursor-pointer"
                  title="Auto-Fill empty slots with AI recommendations"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-700" />
                  <span>Auto-Fill AI</span>
                </button>
                <button
                  id="btn-redo-itinerary"
                  onClick={() => handleTriggerReDo()}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 font-sans font-medium text-[11px] sm:text-xs border border-amber-200 transition-colors shadow-2xs cursor-pointer"
                  title="Re-Do itinerary: generate fresh local recommendations"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                  <span>Re-Do</span>
                </button>
              </div>
            )}

            {/* Print */}
            <button
              id="btn-print-itinerary"
              onClick={() => window.print()}
              title="Print Itinerary"
              className="hidden sm:flex p-1.5 rounded-lg bg-white hover:bg-[#f5f5f0] text-[#5A5A40] border border-[#d1d1ca] transition-colors shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Full-Width Clean Short Trip Title, Location & Accommodations */}
        <div className="space-y-4 w-full">
          <h1 className="font-serif text-2xl sm:text-4xl md:text-5xl font-normal italic text-[#2c2c24] leading-tight tracking-tight">
            <TranslatedText text={cleanTripTitle} />
          </h1>

          <div className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-[#8a8a7e]">
            <MapPin className="w-4 h-4 text-[#5A5A40] shrink-0" />
            <span><TranslatedText text={plan.destinationOrTown} /></span>
          </div>

          {((plan.accommodations && plan.accommodations.length > 0)
            ? plan.accommodations
            : plan.accommodation
            ? [plan.accommodation]
            : []
          ).map((acc, idx) => (
            <div
              key={acc.id || idx}
              className="mt-3 bg-[#f5f5f0] border border-[#e5e5df] rounded-2xl p-3.5 text-xs text-[#2c2c24] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div className="flex items-start space-x-2.5 min-w-0">
                <div className="p-1.5 bg-white rounded-lg border border-[#d1d1ca] shrink-0">
                  <Hotel className="w-4 h-4 text-[#5A5A40]" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-[#2c2c24] truncate flex items-center gap-1.5 flex-wrap">
                    <span><TranslatedText text={acc.name} /></span>
                    {acc.location && (
                      <span className="font-normal text-[#6b6b5e] font-sans"> • <TranslatedText text={acc.location} /></span>
                    )}
                    {(acc.isVerified || acc.coordinates) && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                        ✓ Geo Verified
                      </span>
                    )}
                  </div>
                  {acc.description && (
                    <p className="text-[11px] text-[#8a8a7e] font-sans italic mt-0.5 truncate">
                      <TranslatedText text={acc.description} />
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono text-[#5A5A40] shrink-0 bg-white px-2.5 py-1 rounded-xl border border-[#d1d1ca] self-start sm:self-center">
                <span>
                  Check-in: Day {acc.checkInDay || 1} {acc.checkInHour ? `(${acc.checkInHour})` : ""}
                </span>
                <span>|</span>
                <span>
                  Check-out: Day {acc.checkOutDay || plan.totalDays || 1} {acc.checkOutHour ? `(${acc.checkOutHour})` : ""}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Summary Description */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setIsDescExpanded(!isDescExpanded)}
            className="flex items-center justify-between w-full text-left py-2 border-b border-[#e5e5df]/50 text-sm sm:text-base font-serif italic text-[#5A5A40] hover:text-[#2c2c24] transition-colors cursor-pointer"
          >
            <span>{t("itinerary.descriptionTitle", "Itinerary General Description")}</span>
            {isDescExpanded ? (
              <ChevronUp className="w-4 h-4 text-[#8a8a7e]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#8a8a7e]" />
            )}
          </button>
          
          {isDescExpanded && (
            <p className="text-sm sm:text-base text-[#2c2c24] mt-2.5 leading-relaxed font-sans max-w-4xl animate-fadeIn">
              <TranslatedText text={plan.summary} />
            </p>
          )}
        </div>

        {/* Highlights Pills */}
        {plan.highlights && plan.highlights.length > 0 && (
          <div className="mt-5 pt-4 border-t border-[#e5e5df]">
            <button
              type="button"
              onClick={() => setIsHighlightsExpanded(!isHighlightsExpanded)}
              className="flex items-center justify-between w-full text-left py-2 text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] hover:text-[#2c2c24] transition-colors cursor-pointer"
            >
              <span>Curated Highlights & Signatures</span>
              {isHighlightsExpanded ? (
                <ChevronUp className="w-4 h-4 text-[#8a8a7e] normal-case" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#8a8a7e] normal-case" />
              )}
            </button>

            {isHighlightsExpanded && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 animate-fadeIn">
                {plan.highlights.map((h, i) => (
                  <div
                    key={i}
                    className="flex items-start space-x-2 text-xs text-[#2c2c24] bg-[#f5f5f0] p-2.5 rounded-xl border border-[#e5e5df]"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#5A5A40] shrink-0 mt-0.5" />
                    <span className="font-sans leading-snug">
                      <TranslatedText text={h} />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live Weather Forecast & Seasonality Warnings */}
      <WeatherForecastCard
        weatherForecast={plan.weatherForecast}
        destination={plan.destinationOrTown}
        totalDays={plan.totalDays}
        startDate={plan.startDate}
        onOpenPackingModal={() => {
          setCollabInitialTab("packing");
          setShowCollabModal(true);
        }}
      />

      {/* Interactive Map */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#e5e5df] shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-[#5A5A40]" />
            <h3 className="font-serif text-lg sm:text-xl font-light italic text-[#2c2c24]">
              Geographic Route & Activity Map
            </h3>
          </div>
          <span className="text-xs text-[#8a8a7e] font-sans">
            {plan.days.reduce((acc, d) => acc + d.activities.length, 0)} Pinned Locations
          </span>
        </div>

        <InteractiveMap
          plan={plan}
          activeDayNumber={activeDayNumber}
          onSelectDay={(day) => setActiveDayNumber(day)}
          selectedSpotId={selectedSpotId}
          onSelectSpot={handleSelectSpot}
        />
      </div>

      {/* Filter by Day Pills */}
      {/* Day Filter Tabs */}
      {plan.days.length > 1 && (
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 no-print">
          <button
            onClick={() => setActiveDayNumber("all")}
            className={`px-4 py-1.5 rounded-full text-xs font-serif italic transition-all shrink-0 ${
              activeDayNumber === "all"
                ? "bg-[#5A5A40] text-white font-medium shadow-xs"
                : "bg-white text-[#2c2c24] border border-[#d1d1ca] hover:border-[#5A5A40]"
            }`}
          >
            {t("action.allDays", "All Days")} ({plan.days.length})
          </button>

          {plan.days.map((day) => (
            <button
              key={day.dayNumber}
              onClick={() => setActiveDayNumber(day.dayNumber)}
              className={`px-4 py-1.5 rounded-full text-xs font-serif italic transition-all shrink-0 ${
                activeDayNumber === day.dayNumber
                  ? "bg-[#5A5A40] text-white font-medium shadow-xs"
                  : "bg-white text-[#2c2c24] border border-[#d1d1ca] hover:border-[#5A5A40]"
              }`}
            >
              {t("action.day", "Day")} {day.dayNumber}
            </button>
          ))}
        </div>
      )}

      {/* Reiterative Auto-Fill Banner Callout */}
      {onReiteratePlan && (
        <div className="bg-[#f5f5f0] border border-[#d1d1ca] p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm text-[#2c2c24] no-print shadow-2xs">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-[#5A5A40]/10 flex items-center justify-center shrink-0 text-[#5A5A40]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="font-serif italic text-sm font-medium text-[#2c2c24]">
                Customized your schedule?
              </p>
              <p className="text-xs text-[#6b6b5e]">
                If you removed or retimed activities, the AI will keep all your choices and fill the open schedule slots with new local spots!
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setShowReiterateModal(true)}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#5A5A40] text-white hover:bg-[#4a4a35] font-serif italic transition-colors shadow-2xs text-xs sm:text-sm cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Auto-Fill Empty Slots</span>
            </button>
            <button
              onClick={() => handleTriggerReDo()}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-serif italic transition-colors shadow-2xs text-xs sm:text-sm cursor-pointer"
              title="Re-Do itinerary: generate fresh local recommendations"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Re-Do</span>
            </button>
          </div>
        </div>
      )}

      {/* Daily Itinerary Cards */}
      <div className="space-y-4">
        {plan.days
          .filter((day) => activeDayNumber === "all" || day.dayNumber === activeDayNumber)
          .map((day) => (
            <DayCard
              key={day.dayNumber}
              day={day}
              selectedSpotId={selectedSpotId}
              onSelectSpot={handleSelectSpot}
              onSwapActivity={(act, dNum) => setSwappingActivity({ activity: act, dayNumber: dNum })}
              onEditActivity={(act, dNum) => setEditingActivity({ activity: act, dayNumber: dNum })}
              onDeleteActivity={handleDeleteActivity}
              onMoveActivity={handleMoveActivity}
              onMoveActivityAcrossDays={handleMoveActivityAcrossDays}
              onSelectAlternativeOption={handleSelectAlternativeOption}
              onOpenAddActivity={(dNum) => setAddingDayNumber(dNum)}
              onDeleteDay={plan.days.length > 1 ? handleDeleteDay : undefined}
              onUpdateDayHeader={handleUpdateDayHeader}
              onSkipPermanently={onSkipPermanently}
              onOpenDetails={(act, dNum) => setDetailedActivity({ spot: act, dayNumber: dNum })}
              onPublishActivity={(act, dNum) => setPublishingActivity({ activity: act, dayNumber: dNum })}
              onVisitedChanged={onVisitedChanged}
              onOpenScheduleAdjuster={(dNum) => {
                setAdjustingDayNumber(dNum);
                setShowScheduleModal(true);
              }}
              onOpenRouteOptimizer={(dNum) => {
                setOptimizingDayNumber(dNum);
                setShowRouteOptimizerModal(true);
              }}
              destinationOrTown={plan.destinationOrTown}
              canEdit={userPerms.canEdit}
            />
          ))}
      </div>

      {/* Add Extra Day Button */}
      {userPerms.canEdit && (
        <div className="pt-2 no-print">
          <button
            type="button"
            onClick={handleAddNewDay}
            className="w-full py-3.5 px-6 rounded-3xl border border-dashed border-[#5A5A40]/40 hover:border-[#5A5A40] bg-white hover:bg-[#ecece4]/60 text-[#5A5A40] font-serif italic text-sm flex items-center justify-center space-x-2 transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Extend Trip (+ Add Day {plan.days.length + 1})</span>
          </button>
        </div>
      )}
          </>
        )}

        {itinerarySubTab === "companion" && (
          <div className="animate-in fade-in-20 duration-200">
            <DayCompanionMode
              plan={plan}
              onUpdatePlan={onUpdatePlan}
              onSwapActivity={onSwapActivity}
              onVisitedChanged={onVisitedChanged}
              onOpenSpotDetail={(spot) => setDetailedActivity({ spot })}
              onOpenWallet={() => setItinerarySubTab("wallet")}
            />
          </div>
        )}

        {itinerarySubTab === "wallet" && (
          <div className="animate-in fade-in-20 duration-200">
            <TravelWalletHub
              plan={plan}
              onShowToast={showToast}
              onSwitchTab={(tab) => setItinerarySubTab(tab as any)}
            />
          </div>
        )}

        {itinerarySubTab === "group" && (
          <div className="animate-in fade-in-20 duration-200">
            <GroupCollaborationModal
              plan={plan}
              isOpen={false}
              isInline={true}
              onClose={() => setItinerarySubTab("itinerary")}
              onShowToast={showToast}
            />
          </div>
        )}

        {itinerarySubTab === "offline" && (
          <div className="animate-in fade-in-20 duration-200">
            <OfflinePocketModal
              plan={plan}
              isOpen={false}
              isInline={true}
              onClose={() => setItinerarySubTab("itinerary")}
              onShowToast={showToast}
            />
          </div>
        )}
      </div> {/* END OF print:hidden SCREEN-ONLY WRAPPER */}

    {/* -------------------- PROFESSIONAL TRAVEL ITINERARY REPORT (PRINT-ONLY) -------------------- */}
    <div className="print-only space-y-10 bg-white text-[#111111] p-1 select-none leading-relaxed">
      
      {/* Editorial Report Header Cover */}
      <div className="border-b-4 border-[#5A5A40] pb-6 mb-8">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[10px] tracking-wider font-bold text-[#5A5A40] uppercase font-sans">
              Personalized Travel Dossier
            </span>
            <h1 className="font-serif text-3xl font-bold italic text-[#2c2c24] mt-1 leading-tight">
              {plan.totalDays}-Day {plan.destinationOrTown}
            </h1>
            <p className="text-xs text-[#6b6b5e] font-sans font-medium mt-1">
              Curated itinerary for {plan.destinationOrTown} • {plan.totalDays} Days of Custom Exploration
            </p>
          </div>
          <div className="text-right">
            <span className="font-serif italic font-bold text-lg text-[#5A5A40]">LocalExplorer AI</span>
            <p className="text-[8px] text-[#8a8a7e] uppercase tracking-wider font-sans mt-0.5">Verified Local Expertise</p>
          </div>
        </div>

        {/* Executive Metadata Summary */}
        <div className="grid grid-cols-3 gap-4 mt-6 bg-[#f5f5f0] p-4 rounded-xl border border-[#d1d1ca] text-xs">
          <div>
            <span className="text-[#8a8a7e] block text-[9px] uppercase font-bold tracking-wider">Destination</span>
            <span className="font-semibold text-[#2c2c24]">{plan.destinationOrTown}</span>
          </div>
          <div>
            <span className="text-[#8a8a7e] block text-[9px] uppercase font-bold tracking-wider">Duration</span>
            <span className="font-semibold text-[#2c2c24]">{plan.totalDays} Days of Custom Exploration</span>
          </div>
          <div>
            <span className="text-[#8a8a7e] block text-[9px] uppercase font-bold tracking-wider">Weather Conditions</span>
            <span className="font-semibold text-[#2c2c24]">
              {(() => {
                if (!plan.weatherSummary) return "Seasonal Clear";
                const parts = plan.weatherSummary.split(/[;.]/);
                if (parts.length > 0 && parts[0].trim().length > 3) {
                  return parts[0].trim();
                }
                return plan.weatherSummary;
              })()}
            </span>
          </div>
        </div>
      </div>

      {/* Executive Overview */}
      <div className="print-page-break space-y-2">
        <h2 className="font-serif text-lg font-bold italic text-[#2c2c24] border-b border-[#e5e5df] pb-1">
          Executive Trip Overview
        </h2>
        <p className="text-xs text-[#2c2c24] leading-relaxed font-sans">
          {plan.summary}
        </p>
      </div>

      {/* Accommodation scheduled details */}
      {((plan.accommodations && plan.accommodations.length > 0)
        ? plan.accommodations
        : plan.accommodation
        ? [plan.accommodation]
        : []
      ).length > 0 && (
        <div className="print-page-break space-y-2.5">
          <h2 className="font-serif text-lg font-bold italic text-[#2c2c24] border-b border-[#e5e5df] pb-1">
            Stay & Accommodation Lodging
          </h2>
          <div className="space-y-2.5">
            {((plan.accommodations && plan.accommodations.length > 0)
              ? plan.accommodations
              : plan.accommodation
              ? [plan.accommodation]
              : []
            ).map((acc, idx) => (
              <div key={acc.id || idx} className="bg-white border border-[#d1d1ca] p-3 rounded-lg flex items-start justify-between text-xs">
                <div className="space-y-0.5">
                  <div className="font-bold text-sm text-[#2c2c24]">{acc.name}</div>
                  {acc.location && <p className="text-[#6b6b5e] font-sans">📍 {acc.location}</p>}
                  {acc.description && <p className="text-[#8a8a7e] italic font-sans">{acc.description}</p>}
                </div>
                <div className="text-right font-mono text-[9px] text-[#5A5A40] bg-[#f5f5f0] border border-[#d1d1ca] px-2.5 py-0.5 rounded-md shrink-0">
                  Check-In: Day {acc.checkInDay || 1} • Check-Out: Day {acc.checkOutDay || plan.totalDays}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Curated Highlights */}
      {plan.highlights && plan.highlights.length > 0 && (
        <div className="print-page-break space-y-2.5">
          <h2 className="font-serif text-lg font-bold italic text-[#2c2c24] border-b border-[#e5e5df] pb-1">
            Curated Highlights & Signatures
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {plan.highlights.map((h, i) => (
              <div key={i} className="flex items-start space-x-2 text-xs bg-[#f5f5f0] p-3 rounded-lg border border-[#e5e5df]">
                <span className="text-[#5A5A40] text-sm shrink-0 leading-none">✦</span>
                <p className="font-sans text-[#2c2c24] leading-relaxed">{h}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User Input & Travel Context */}
      <div className="print-page-break space-y-2.5">
        <h2 className="font-serif text-lg font-bold italic text-[#2c2c24] border-b border-[#e5e5df] pb-1">
          Travel Preferences & Planning Parameters
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[#f5f5f0]/40 p-4 rounded-xl border border-[#e5e5df] text-xs">
          <div>
            <span className="text-[#8a8a7e] block text-[9px] uppercase font-bold tracking-wider mb-0.5">Exploration Pace</span>
            <span className="font-semibold text-[#2c2c24]">
              {plan.customPace 
                ? plan.customPace.charAt(0).toUpperCase() + plan.customPace.slice(1).replace("-", " ") 
                : "Balanced Pace"}
            </span>
          </div>
          <div>
            <span className="text-[#8a8a7e] block text-[9px] uppercase font-bold tracking-wider mb-0.5">Means of Transport Available</span>
            <span className="font-semibold text-[#2c2c24]">
              {(() => {
                const formatTransport = (mode?: string) => {
                  if (!mode) return "Transit";
                  return mode.split(/[_-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
                };
                return plan.transportModes && plan.transportModes.length > 0
                  ? plan.transportModes.map(m => formatTransport(m)).join(", ")
                  : formatTransport(plan.transportMode) || "Public Transit & Walking";
              })()}
            </span>
          </div>
          <div>
            <span className="text-[#8a8a7e] block text-[9px] uppercase font-bold tracking-wider mb-0.5">Budget Planning Mode</span>
            <span className="font-semibold text-[#2c2c24]">
              {plan.budgetType === "exact" && plan.exactBudgetPerDay 
                ? `Budget: ${plan.currency || "€"}${plan.exactBudgetPerDay} / day` 
                : plan.budgetTier 
                ? plan.budgetTier.charAt(0).toUpperCase() + plan.budgetTier.slice(1) 
                : "Standard Mid-Range"}
            </span>
          </div>
          <div>
            <span className="text-[#8a8a7e] block text-[9px] uppercase font-bold tracking-wider mb-0.5">Travel Vibes & Interests</span>
            <span className="font-semibold text-[#2c2c24]">
              {plan.tags && plan.tags.length > 0 
                ? plan.tags.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(", ") 
                : "Curated Local Experience"}
            </span>
          </div>
        </div>
      </div>

      {/* Daily Itinerary Agenda */}
      <div className="space-y-8 pt-4">
        <h2 className="font-serif text-xl font-bold italic text-[#2c2c24] border-b-2 border-[#5A5A40] pb-1.5 mb-6">
          Detailed Day-by-Day Agenda
        </h2>

        {plan.days.map((day) => (
          <div key={day.dayNumber} className="print-page-break border-l-2 border-[#5A5A40] pl-5 space-y-3.5 py-1">
            
            {/* Day Header */}
            <div className="flex justify-between items-baseline gap-4">
              <div>
                <h3 className="font-serif text-lg font-bold italic text-[#2c2c24]">
                  {day.dayTitle}
                </h3>
                <p className="text-xs text-[#8a8a7e] font-sans font-semibold mt-0.5">
                  Focus: {day.theme}
                </p>
              </div>
              {day.estimatedTotalBudget && (
                <span className="font-serif italic text-[10px] text-[#2c2c24] bg-[#f5f5f0] px-2 py-0.5 rounded border border-[#d1d1ca] shrink-0">
                  Est. Day Budget: {day.estimatedTotalBudget}
                </span>
              )}
            </div>

            {/* Day Summary */}
            {day.summary && (
              <p className="text-xs text-[#6b6b5e] italic bg-[#f5f5f0]/50 p-3 rounded-lg border border-[#e5e5df] font-serif leading-relaxed mb-2">
                "{day.summary}"
              </p>
            )}

            {/* Printable Daily Route Map */}
            <PrintDailyMap day={day} destinationOrTown={plan.destinationOrTown} />

            {/* Activities of Day */}
            <div className="space-y-3">
              {day.activities.map((act, actIdx) => (
                <div key={act.id || actIdx} className="print-page-break bg-white border border-[#e5e5df] p-3.5 rounded-lg space-y-1.5">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <span className="text-[9px] font-mono font-bold uppercase text-[#5A5A40] bg-[#ecece4] px-1.5 py-0.5 rounded">
                        {act.time || `Stop ${actIdx + 1}`}
                      </span>
                      <h4 className="font-serif text-sm font-bold text-[#2c2c24] mt-1 leading-snug">
                        {act.name}
                      </h4>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px] text-[#8a8a7e]">
                        {act.category && <span>🏷️ {act.category}</span>}
                        {act.cost && <span>• 💰 {act.cost}</span>}
                        {act.duration && <span>• ⏱️ {act.duration}</span>}
                      </div>
                    </div>
                    {act.address && (
                      <p className="text-[9px] text-[#6b6b5e] font-sans text-right max-w-xs leading-normal">
                        📍 {act.address}
                      </p>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-[11px] text-[#2c2c24] leading-relaxed">
                    {act.description}
                  </p>

                  {/* Insider Tip */}
                  {act.insiderTip && (
                    <div className="bg-[#f5f5f0] border-l-2 border-[#5A5A40] p-2 rounded-r-md text-[11px]">
                      <span className="font-bold font-serif italic text-[#5A5A40] block text-[9px] uppercase tracking-wider">
                        Insider Tip:
                      </span>
                      <p className="text-[#2c2c24] italic leading-relaxed">{act.insiderTip}</p>
                    </div>
                  )}

                  {/* Transit connector inside Day */}
                  {actIdx < day.activities.length - 1 && (() => {
                    const nextAct = day.activities[actIdx + 1];
                    const route = getRouteInfoBetweenSpots(act, nextAct, plan.destinationOrTown);
                    return (
                      <div className="mt-2.5 pt-1.5 border-t border-dashed border-[#e5e5df] flex items-center space-x-2 text-[10px] text-[#6b6b5e]">
                        <span>
                          {route.mode === "walk" ? "🚶‍♂️" : route.mode === "transit" ? "🚌" : "🚕"}
                        </span>
                        <span className="font-semibold italic">{route.duration}</span>
                        <span>({route.distance || "nearby"})</span>
                        {route.instructions && <span className="opacity-80">• {route.instructions}</span>}
                      </div>
                    );
                  })()}

                </div>
              ))}
            </div>

          </div>
        ))}

      </div>

      {/* Footer/Signoff */}
      <div className="border-t border-[#d1d1ca] pt-5 mt-10 text-center text-[9px] text-[#8a8a7e] font-sans">
        <p>© {new Date().getFullYear()} LocalExplorer AI — Personalized Travel Guide & Itinerary Planner</p>
        <p className="mt-0.5 font-serif italic">Have an incredible, safe, and memorable trip!</p>
      </div>

    </div>

    {/* Deep Activity Details, Lore, Map & Chatbot Modal */}
    {detailedActivity && (
        <ActivityDetailModal
          spot={detailedActivity.spot}
          destination={plan.destinationOrTown}
          dayNumber={detailedActivity.dayNumber}
          onClose={() => setDetailedActivity(null)}
        />
      )}

      {/* Swap Activity Modal */}
      {swappingActivity && (
        <SwapSpotModal
          isOpen={true}
          onClose={() => setSwappingActivity(null)}
          activity={swappingActivity.activity}
          dayNumber={swappingActivity.dayNumber}
          plan={plan}
          onSaveSwap={handleSaveSwap}
          onSwapWithExisting={handleSwapWithExisting}
          onShowToast={showToast}
        />
      )}

      {/* Edit Activity Modal */}
      {editingActivity && (
        <EditActivityModal
          activity={editingActivity.activity}
          dayNumber={editingActivity.dayNumber}
          isOpen={true}
          onClose={() => setEditingActivity(null)}
          onSave={handleSaveEditedActivity}
        />
      )}

      {/* Add Activity Modal */}
      {addingDayNumber !== null && (
        <AddActivityModal
          dayNumber={addingDayNumber}
          isOpen={true}
          onClose={() => setAddingDayNumber(null)}
          onAdd={handleAddCustomActivity}
          baseCoordinates={plan.mapCenter}
        />
      )}

      {/* Reiterate / Auto-Fill Itinerary Modal */}
      {showReiterateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-[#d1d1ca] space-y-4">
            <div className="flex items-center justify-between border-b border-[#ecece4] pb-3">
              <div className="flex items-center space-x-2 text-[#2c2c24]">
                <div className="w-8 h-8 rounded-full bg-[#5A5A40]/10 flex items-center justify-center text-[#5A5A40]">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif text-xl italic font-medium">Reiterate & Auto-Fill Itinerary</h3>
                  <p className="text-xs text-[#8a8a7e]">Complete schedule gaps starting from your edits</p>
                </div>
              </div>
              <button
                onClick={() => setShowReiterateModal(false)}
                className="p-1.5 text-[#8a8a7e] hover:text-[#2c2c24] rounded-full hover:bg-[#ecece4] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-[#6b6b5e] leading-relaxed">
              The AI will analyze your customized schedule, <strong>preserve all of your kept activities and time modifications</strong>, and automatically fill remaining empty slots or schedule gaps with brand new local spots matching your pacing.
            </p>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#8a8a7e] mb-1.5">
                Optional Instructions for AI
              </label>
              <textarea
                value={reiterateInstructions}
                onChange={(e) => setReiterateInstructions(e.target.value)}
                placeholder="e.g., 'Fill empty slots with seaside walks and seafood tapas', or 'Keep afternoon open on Day 2'..."
                className="w-full p-3.5 text-xs sm:text-sm rounded-2xl border border-[#d1d1ca] bg-[#f5f5f0]/50 text-[#2c2c24] focus:outline-none focus:border-[#5A5A40] h-24 resize-none placeholder:text-[#a0a092]"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#ecece4]">
              <button
                type="button"
                onClick={() => {
                  setShowReiterateModal(false);
                  handleTriggerReDo();
                }}
                disabled={isReiterating}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 font-serif italic text-xs hover:bg-amber-100 disabled:opacity-50 transition-colors shadow-2xs"
                title="Regenerate all activities with fresh recommendations"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                <span>Re-Do Entire Plan</span>
              </button>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowReiterateModal(false)}
                  disabled={isReiterating}
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-[#6b6b5e] hover:text-[#2c2c24] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReiterate}
                  disabled={isReiterating}
                  className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#5A5A40] text-white font-serif italic text-sm hover:bg-[#4a4a35] disabled:opacity-50 transition-colors shadow-xs"
                >
                  {isReiterating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Reiterating & Auto-Filling...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      <span>Fill Empty Slots with AI</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Feature 1: Offline Pocket Companion Modal */}
      <OfflinePocketModal
        plan={plan}
        isOpen={showOfflineModal}
        onClose={() => setShowOfflineModal(false)}
        onShowToast={showToast}
      />

      {/* Feature 2: Smart Group Collaboration & Packing Modal */}
      <GroupCollaborationModal
        plan={plan}
        isOpen={showCollabModal}
        onClose={() => setShowCollabModal(false)}
        onShowToast={showToast}
        initialTab={collabInitialTab}
      />

      {/* Feature 3: Live Schedule Adjuster & Delay Recalibration Modal */}
      <ScheduleAdjusterModal
        plan={plan}
        initialDayNumber={adjustingDayNumber}
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onApplyUpdatedDay={handleApplyAdjustedDay}
        onShowToast={showToast}
      />

      {/* Feature 4: Smart Route & Multi-Modal Transit Optimizer Modal */}
      {showRouteOptimizerModal && (
        <RouteOptimizerModal
          isOpen={showRouteOptimizerModal}
          onClose={() => setShowRouteOptimizerModal(false)}
          dayNumber={optimizingDayNumber}
          activities={
            plan.days.find((d) => d.dayNumber === optimizingDayNumber)?.activities || []
          }
          initialTransportMode={plan.mode === "vacation" ? "public_transit" : "public_transit"}
          onApplyOptimizedRoute={(newActs) => {
            handleApplyOptimizedDayActivities(optimizingDayNumber, newActs);
          }}
        />
      )}

      {/* Identify Member Modal for Shared Trips */}
      <IdentifyMemberModal
        plan={plan}
        isOpen={showIdentifyModal}
        onClose={() => setShowIdentifyModal(false)}
        onSuccess={(claimedName) => {
          showToast(`Successfully claimed identity as ${claimedName}!`, "success");
        }}
      />

      {/* Publish Trip to Explore Modal */}
      <PublishTripModal
        trip={plan}
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        onShowToast={(msg, type) => showToast(msg, type || "success")}
      />

      {/* Publish Single Activity to Explore Modal */}
      {publishingActivity && (
        <PublishSpotModal
          isOpen={Boolean(publishingActivity)}
          onClose={() => setPublishingActivity(null)}
          defaultCity={plan.destinationOrTown}
          initialActivity={publishingActivity.activity}
          onPublished={() => {
            setPublishingActivity(null);
            showToast("Activity successfully published to Community Explore!", "success");
          }}
          onShowToast={(msg, type) => showToast(msg, type || "success")}
        />
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in-20 slide-in-from-bottom-3 no-print">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center space-x-2 text-xs font-sans ${
              toastMessage.type === "success"
                ? "bg-[#2c2c24] text-white border-emerald-500/40"
                : "bg-white text-[#2c2c24] border-[#d1d1ca]"
            }`}
          >
            {toastMessage.type === "success" && (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}
    </div>
  );
};
