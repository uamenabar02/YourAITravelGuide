import React, { useState } from "react";
import { ItineraryPlan, ActivitySpot, DailyPlan } from "../types";
import { DayCard } from "./DayCard";
import { InteractiveMap } from "./InteractiveMap";
import { EditActivityModal } from "./EditActivityModal";
import { AddActivityModal } from "./AddActivityModal";
import { ActivityDetailModal } from "./ActivityDetailModal";
import { OfflinePocketModal } from "./OfflinePocketModal";
import { GroupCollaborationModal } from "./GroupCollaborationModal";
import { ScheduleAdjusterModal } from "./ScheduleAdjusterModal";
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
} from "lucide-react";
import confetti from "canvas-confetti";
import { parseTimeToHours } from "../utils/time";
import { LiveNavigatorBar } from "./LiveNavigatorBar";
import { getRouteInfoBetweenSpots } from "../utils/transit";
import { PrintDailyMap } from "./PrintDailyMap";
import { formatCleanTripTitle, formatConciseWeather } from "../utils/formatters";
import { useLanguage } from "../context/LanguageContext";

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
  const [activeDayNumber, setActiveDayNumber] = useState<number | "all">("all");
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [itinerarySubTab, setItinerarySubTab] = useState<"itinerary" | "group" | "offline">("itinerary");

  // Modals state
  const [editingActivity, setEditingActivity] = useState<{ activity: ActivitySpot; dayNumber: number } | null>(null);
  const [addingDayNumber, setAddingDayNumber] = useState<number | null>(null);
  const [detailedActivity, setDetailedActivity] = useState<{ spot: ActivitySpot; dayNumber?: number } | null>(null);

  // New Feature Modals state
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [showCollabModal, setShowCollabModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
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

      // Capture the original time slots, then reassign them positionally so the
      // schedule stays chronologically ascending after the move. Build NEW
      // objects instead of mutating the existing ones (which would not trigger
      // a React re-render reliably).
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
          <div className="bg-white p-1 rounded-2xl border border-[#e5e5df] max-w-lg mx-auto w-full flex shadow-2xs">
            <button
              onClick={() => setItinerarySubTab("itinerary")}
              className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl text-xs font-semibold tracking-tight transition-all cursor-pointer ${
                itinerarySubTab === "itinerary"
                  ? "bg-[#5A5A40] text-white shadow-xs font-bold"
                  : "text-[#6b6b5e] hover:text-[#2c2c24] hover:bg-[#f5f5f0]"
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>{t("nav.dailyPlan", "Daily Plan")}</span>
            </button>
            <button
              id="nav-sub-group"
              onClick={() => setItinerarySubTab("group")}
              className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl text-xs font-semibold tracking-tight transition-all cursor-pointer ${
                itinerarySubTab === "group"
                  ? "bg-[#5A5A40] text-white shadow-xs font-bold"
                  : "text-[#6b6b5e] hover:text-[#2c2c24] hover:bg-[#f5f5f0]"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>{t("action.groupHub", "Group Hub")}</span>
            </button>
            <button
              id="nav-sub-offline"
              onClick={() => setItinerarySubTab("offline")}
              className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl text-xs font-semibold tracking-tight transition-all cursor-pointer ${
                itinerarySubTab === "offline"
                  ? "bg-[#5A5A40] text-white shadow-xs font-bold"
                  : "text-[#6b6b5e] hover:text-[#2c2c24] hover:bg-[#f5f5f0]"
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>{t("action.pocketGuide", "Offline Pocket")}</span>
            </button>
          </div>
        </div>

        {itinerarySubTab === "itinerary" && (
          <>
            {/* Header Banner Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#e5e5df] shadow-sm relative overflow-hidden space-y-6">
        {/* Top Badges & Clean Visual Toolbar Row */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-[#e5e5df]">
          {/* Metadata Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#ecece4] text-[#5A5A40] border border-[#d1d1ca]">
              {plan.mode === "vacation" ? `✈️ ${plan.totalDays} Days` : "📍 Native Hometown Guide"}
            </span>

            {/* Short Weather Badge with Tooltip */}
            {conciseWeather && (
              <div className="relative group/weather">
                <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-900 border border-amber-200 shadow-2xs cursor-help">
                  <span>{conciseWeather.emoji}</span>
                  <span className="font-bold">{conciseWeather.temp}</span>
                  <span className="text-amber-800 font-normal hidden sm:inline">• {conciseWeather.shortDesc}</span>
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
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#f5f5f0] text-[#6b6b5e] border border-[#e5e5df]">
                Pace: {plan.customPace}
              </span>
            )}

            {plan.groupSize && plan.groupSize > 0 && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#ecece4] text-[#2c2c24] border border-[#d1d1ca]">
                👥 {plan.groupSize} Traveler{plan.groupSize > 1 ? "s" : ""}
              </span>
            )}

            {plan.budgetType === "exact" && plan.exactBudgetPerDay ? (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#f5f5f0] text-[#5A5A40] border border-[#d1d1ca] font-serif italic">
                💰 {plan.currency || "€"}{plan.exactBudgetPerDay} / day
              </span>
            ) : plan.budgetTier ? (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#f5f5f0] text-[#6b6b5e] border border-[#e5e5df]">
                Budget: {plan.budgetTier}
              </span>
            ) : null}

            {plan.arrivalHour && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#ecece4] text-[#2c2c24] border border-[#d1d1ca]">
                🛬 {plan.arrivalHour}
              </span>
            )}

            {plan.departureHour && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#ecece4] text-[#2c2c24] border border-[#d1d1ca]">
                🛫 {plan.departureHour}
              </span>
            )}
          </div>

          {/* Action Buttons Toolbar - Visual & Simple */}
          <div className="flex flex-wrap items-center gap-2 shrink-0 no-print">
            {/* Primary: Save Trip */}
            <button
              id="btn-save-itinerary"
              onClick={handleSaveClick}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl font-serif italic text-xs sm:text-sm transition-all shadow-xs ${
                isSaved
                  ? "bg-[#ecece4] text-[#5A5A40] border border-[#5A5A40]"
                  : "bg-[#5A5A40] text-white hover:bg-[#4a4a35] active:scale-95"
              }`}
            >
              {isSaved ? (
                <>
                  <BookmarkCheck className="w-4 h-4 text-[#5A5A40]" />
                  <span>{t("action.saved", "Saved")}</span>
                </>
              ) : (
                <>
                  <Bookmark className="w-4 h-4" />
                  <span>{t("action.saveTrip", "Save Trip")}</span>
                </>
              )}
            </button>

            {/* Group Collaboration Hub */}
            <button
              id="btn-group-hub"
              onClick={() => setItinerarySubTab("group")}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#ecece4] text-[#2c2c24] font-sans font-medium text-xs sm:text-sm border border-[#d1d1ca] transition-colors shadow-2xs"
              title="Group Hub: Manage travelers, day votes, personal packing & Tricount splits"
            >
              <Users className="w-3.5 h-3.5 text-[#5A5A40]" />
              <span>{t("action.groupHub", "Group Hub")}</span>
            </button>

            {/* Live Schedule Adjuster */}
            <button
              id="btn-adjust-schedule"
              onClick={() => {
                setAdjustingDayNumber(typeof activeDayNumber === "number" ? activeDayNumber : 1);
                setShowScheduleModal(true);
              }}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#ecece4] text-[#2c2c24] font-sans font-medium text-xs sm:text-sm border border-[#d1d1ca] transition-colors shadow-2xs"
              title="Shift or adjust day schedule if running late or ahead of time"
            >
              <Clock className="w-3.5 h-3.5 text-[#5A5A40]" />
              <span>{t("action.adjustSchedule", "Adjust Schedule")}</span>
            </button>

            {/* Offline Pocket Companion */}
            <button
              id="btn-offline-pocket"
              onClick={() => setItinerarySubTab("offline")}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#ecece4] text-[#2c2c24] font-sans font-medium text-xs sm:text-sm border border-[#d1d1ca] transition-colors shadow-2xs"
              title="Open Offline Pocket Companion & Standalone Guide"
            >
              <Smartphone className="w-3.5 h-3.5 text-[#5A5A40]" />
              <span>{t("action.pocketGuide", "Offline Pocket")}</span>
            </button>

            {/* Export / Share */}
            <button
              id="btn-export-itinerary"
              onClick={onOpenExport}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#ecece4] text-[#2c2c24] font-sans font-medium text-xs sm:text-sm border border-[#d1d1ca] transition-colors shadow-2xs"
              title="Export PDF, Apple / Google Wallet, or Share Link"
            >
              <Share2 className="w-3.5 h-3.5 text-[#5A5A40]" />
              <span>{t("action.export", "Export / Share")}</span>
            </button>

            {/* Auto-Fill with AI (if available) */}
            {onReiteratePlan && (
              <button
                id="btn-reiterate-itinerary"
                onClick={() => setShowReiterateModal(true)}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-[#f5f5f0] hover:bg-[#ecece4] text-[#2c2c24] font-serif italic text-xs sm:text-sm border border-[#5A5A40] transition-all shadow-2xs"
                title="Auto-Fill empty slots with AI recommendations"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#5A5A40]" />
                <span>Auto-Fill AI</span>
              </button>
            )}

            {/* Print */}
            <button
              id="btn-print-itinerary"
              onClick={() => window.print()}
              title="Print Itinerary"
              className="p-2 rounded-xl bg-white hover:bg-[#ecece4] text-[#5A5A40] border border-[#d1d1ca] transition-colors shadow-2xs"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Full-Width Clean Short Trip Title, Location & Accommodations */}
        <div className="space-y-4 w-full">
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-normal italic text-[#2c2c24] leading-tight tracking-tight">
            {cleanTripTitle}
          </h1>

          <div className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-[#8a8a7e]">
            <MapPin className="w-4 h-4 text-[#5A5A40] shrink-0" />
            <span>{plan.destinationOrTown}</span>
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
                    <span>{acc.name}</span>
                    {acc.location && (
                      <span className="font-normal text-[#6b6b5e] font-sans"> • {acc.location}</span>
                    )}
                    {(acc.isVerified || acc.coordinates) && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                        ✓ Geo Verified
                      </span>
                    )}
                  </div>
                  {acc.description && (
                    <p className="text-[11px] text-[#8a8a7e] font-sans italic mt-0.5 truncate">
                      {acc.description}
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
        <p className="text-sm sm:text-base text-[#2c2c24] mt-4 leading-relaxed font-sans max-w-4xl">
          {plan.summary}
        </p>

        {/* Highlights Pills */}
        {plan.highlights && plan.highlights.length > 0 && (
          <div className="mt-5 pt-4 border-t border-[#e5e5df]">
            <span className="text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] block mb-2">
              Curated Highlights & Signatures
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {plan.highlights.map((h, i) => (
                <div
                  key={i}
                  className="flex items-start space-x-2 text-xs text-[#2c2c24] bg-[#f5f5f0] p-2.5 rounded-xl border border-[#e5e5df]"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#5A5A40] shrink-0 mt-0.5" />
                  <span className="font-sans leading-snug">{h}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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
          <button
            onClick={() => setShowReiterateModal(true)}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#5A5A40] text-white hover:bg-[#4a4a35] font-serif italic shrink-0 transition-colors shadow-2xs text-xs sm:text-sm"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Auto-Fill Empty Slots</span>
          </button>
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
              onSwapActivity={onSwapActivity}
              onEditActivity={(act, dNum) => setEditingActivity({ activity: act, dayNumber: dNum })}
              onDeleteActivity={handleDeleteActivity}
              onMoveActivity={handleMoveActivity}
              onSelectAlternativeOption={handleSelectAlternativeOption}
              onOpenAddActivity={(dNum) => setAddingDayNumber(dNum)}
              onDeleteDay={plan.days.length > 1 ? handleDeleteDay : undefined}
              onUpdateDayHeader={handleUpdateDayHeader}
              onSkipPermanently={onSkipPermanently}
              onOpenDetails={(act, dNum) => setDetailedActivity({ spot: act, dayNumber: dNum })}
              onVisitedChanged={onVisitedChanged}
              onOpenScheduleAdjuster={(dNum) => {
                setAdjustingDayNumber(dNum);
                setShowScheduleModal(true);
              }}
              destinationOrTown={plan.destinationOrTown}
            />
          ))}
      </div>

      {/* Add Extra Day Button */}
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
          </>
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

            <div className="flex items-center justify-end space-x-2.5 pt-2 border-t border-[#ecece4]">
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
      )}

      {/* Floating Pocket Guide Navigator & Rainy Swap Widget */}
      <LiveNavigatorBar
        plan={plan}
        activeDayNumber={activeDayNumber}
        onSelectSpot={(spot) => setSelectedSpotId(spot.id)}
        onSwapForIndoor={(activity, dayNum) =>
          onSwapActivity(activity, dayNum, { isIndoorOnly: true })
        }
        destinationOrTown={plan.destinationOrTown}
      />

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
