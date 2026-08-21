import React, { useState } from "react";
import { ItineraryPlan, ActivitySpot, DailyPlan } from "../types";
import { DayCard } from "./DayCard";
import { InteractiveMap } from "./InteractiveMap";
import { EditActivityModal } from "./EditActivityModal";
import { AddActivityModal } from "./AddActivityModal";
import {
  Bookmark,
  BookmarkCheck,
  Share2,
  Printer,
  Sparkles,
  MapPin,
  Sun,
  RefreshCw,
  Layers,
  CheckCircle,
  Plus,
  Edit2,
} from "lucide-react";
import confetti from "canvas-confetti";

interface ItineraryDisplayProps {
  plan: ItineraryPlan;
  isSaved: boolean;
  onSaveTrip: () => void;
  onOpenExport: () => void;
  onSwapActivity: (activity: ActivitySpot, dayNumber: number) => Promise<void>;
  onUpdatePlan: (updatedPlan: ItineraryPlan) => void;
  onRegenerateAll?: () => void;
}

function parseTimeToHours(timeStr: string): number {
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

  return hours + minutes / 60;
}

export const ItineraryDisplay: React.FC<ItineraryDisplayProps> = ({
  plan,
  isSaved,
  onSaveTrip,
  onOpenExport,
  onSwapActivity,
  onUpdatePlan,
  onRegenerateAll,
}) => {
  const [activeDayNumber, setActiveDayNumber] = useState<number | "all">("all");
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);

  // Modals state
  const [editingActivity, setEditingActivity] = useState<{ activity: ActivitySpot; dayNumber: number } | null>(null);
  const [addingDayNumber, setAddingDayNumber] = useState<number | null>(null);

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

      // Reassign times so positions maintain ascending time slots
      acts.forEach((act, idx) => {
        if (originalTimes[idx]) {
          act.time = originalTimes[idx];
        }
      });

      return { ...day, activities: acts };
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
          time: "13:00 PM - 15:30 PM",
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

  return (
    <div className="space-y-6">
      {/* Header Banner Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#e5e5df] shadow-sm relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 pb-5 border-b border-[#e5e5df]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-0.5 rounded-full text-xs font-medium bg-[#ecece4] text-[#5A5A40] border border-[#d1d1ca]">
                {plan.mode === "vacation" ? `✈️ ${plan.totalDays}-Day Cultural Journey` : "📍 Native Hometown Guide"}
              </span>

              {plan.weatherSummary && (
                <span className="inline-flex items-center space-x-1 px-3 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-900 border border-amber-200">
                  <Sun className="w-3.5 h-3.5 text-amber-700" />
                  <span>{plan.weatherSummary}</span>
                </span>
              )}

              {plan.customPace && (
                <span className="px-3 py-0.5 rounded-full text-xs font-medium bg-[#f5f5f0] text-[#6b6b5e] border border-[#e5e5df]">
                  Pace: {plan.customPace}
                </span>
              )}

              {plan.groupSize && plan.groupSize > 0 && (
                <span className="px-3 py-0.5 rounded-full text-xs font-medium bg-[#ecece4] text-[#2c2c24] border border-[#d1d1ca]">
                  👥 {plan.groupSize} Traveler{plan.groupSize > 1 ? "s" : ""}
                </span>
              )}

              {plan.budgetType === "exact" && plan.exactBudgetPerDay ? (
                <span className="px-3 py-0.5 rounded-full text-xs font-medium bg-[#f5f5f0] text-[#5A5A40] border border-[#d1d1ca] font-serif italic">
                  💰 {plan.currency || "€"}{plan.exactBudgetPerDay} / person / day
                </span>
              ) : plan.budgetTier ? (
                <span className="px-3 py-0.5 rounded-full text-xs font-medium bg-[#f5f5f0] text-[#6b6b5e] border border-[#e5e5df]">
                  Budget: {plan.budgetTier}
                </span>
              ) : null}

              {plan.arrivalHour && (
                <span className="px-3 py-0.5 rounded-full text-xs font-medium bg-[#ecece4] text-[#2c2c24] border border-[#d1d1ca]">
                  🛬 Arrives: {plan.arrivalHour}
                </span>
              )}

              {plan.departureHour && (
                <span className="px-3 py-0.5 rounded-full text-xs font-medium bg-[#ecece4] text-[#2c2c24] border border-[#d1d1ca]">
                  🛫 Departs: {plan.departureHour}
                </span>
              )}
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl font-normal italic text-[#2c2c24] leading-tight">
              {plan.title}
            </h1>

            <div className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-[#8a8a7e]">
              <MapPin className="w-3.5 h-3.5 text-[#5A5A40] shrink-0" />
              <span>{plan.destinationOrTown}</span>
            </div>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex flex-wrap items-center gap-2 shrink-0 no-print">
            <button
              id="btn-save-itinerary"
              onClick={handleSaveClick}
              className={`flex items-center space-x-1.5 px-4 py-2 rounded-full font-serif italic text-sm transition-all shadow-xs ${
                isSaved
                  ? "bg-[#ecece4] text-[#5A5A40] border border-[#5A5A40]"
                  : "bg-[#5A5A40] text-white hover:bg-[#4a4a35] active:scale-95"
              }`}
            >
              {isSaved ? (
                <>
                  <BookmarkCheck className="w-4 h-4 text-[#5A5A40]" />
                  <span>Saved to Trips</span>
                </>
              ) : (
                <>
                  <Bookmark className="w-4 h-4" />
                  <span>Save to My Trips</span>
                </>
              )}
            </button>

            <button
              id="btn-export-itinerary"
              onClick={onOpenExport}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-full bg-white hover:bg-[#ecece4] text-[#2c2c24] font-sans font-medium text-xs sm:text-sm border border-[#d1d1ca] transition-colors"
            >
              <Share2 className="w-3.5 h-3.5 text-[#5A5A40]" />
              <span>Export / Share</span>
            </button>

            <button
              id="btn-print-itinerary"
              onClick={() => window.print()}
              title="Print Itinerary"
              className="p-2 rounded-full bg-white hover:bg-[#ecece4] text-[#5A5A40] border border-[#d1d1ca] transition-colors"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
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
            All Days ({plan.days.length})
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
              Day {day.dayNumber}
            </button>
          ))}
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
    </div>
  );
};
