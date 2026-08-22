import React, { useEffect, useState } from "react";
import { DailyPlan, ActivitySpot } from "../types";
import { ActivityCard } from "./ActivityCard";
import { ChevronDown, ChevronUp, DollarSign, Plus, Edit3, Trash2 } from "lucide-react";

interface DayCardProps {
  day: DailyPlan;
  isExpandedDefault?: boolean;
  selectedSpotId: string | null;
  onSelectSpot: (spot: ActivitySpot) => void;
  onSwapActivity: (activity: ActivitySpot, dayNumber: number) => Promise<void>;
  onEditActivity: (activity: ActivitySpot, dayNumber: number) => void;
  onDeleteActivity: (activityId: string, dayNumber: number) => void;
  onMoveActivity: (dayNumber: number, fromIndex: number, toIndex: number) => void;
  onSelectAlternativeOption: (dayNumber: number, activityIndex: number, optionIndex: number) => void;
  onOpenAddActivity: (dayNumber: number) => void;
  onDeleteDay?: (dayNumber: number) => void;
  /** Persist a day title/theme edit immutably through the parent plan state. */
  onUpdateDayHeader?: (dayNumber: number, patch: { dayTitle?: string; theme?: string }) => void;
  /** Permanently exclude a spot from all future suggestions. */
  onSkipPermanently?: (activity: ActivitySpot, dayNumber: number) => void;
  onOpenDetails?: (activity: ActivitySpot, dayNumber: number) => void;
  onVisitedChanged?: (activity: ActivitySpot, isVisited: boolean) => void;
  destinationOrTown: string;
}

export const DayCard: React.FC<DayCardProps> = ({
  day,
  isExpandedDefault = true,
  selectedSpotId,
  onSelectSpot,
  onSwapActivity,
  onEditActivity,
  onDeleteActivity,
  onMoveActivity,
  onSelectAlternativeOption,
  onOpenAddActivity,
  onDeleteDay,
  onUpdateDayHeader,
  onSkipPermanently,
  onOpenDetails,
  onVisitedChanged,
  destinationOrTown,
}) => {
  const [isExpanded, setIsExpanded] = useState(isExpandedDefault);
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [dayTitle, setDayTitle] = useState(day.dayTitle);
  const [theme, setTheme] = useState(day.theme);

  // Keep the edit fields in sync if the underlying day object changes
  // (e.g. reorder, renumber, or a reload of a saved trip).
  useEffect(() => {
    setDayTitle(day.dayTitle);
  }, [day.dayTitle]);
  useEffect(() => {
    setTheme(day.theme);
  }, [day.theme]);

  const handleSaveHeader = (e: React.FormEvent) => {
    e.preventDefault();
    // Persist immutably through the parent instead of mutating props, so the
    // change propagates to React state, saved-trip storage, and exports.
    if (onUpdateDayHeader) {
      onUpdateDayHeader(day.dayNumber, {
        dayTitle: dayTitle.trim() || day.dayTitle,
        theme: theme.trim() || day.theme,
      });
    }
    setIsEditingHeader(false);
  };

  return (
    <div className="bg-white rounded-3xl border border-[#e5e5df] overflow-hidden shadow-xs transition-all mb-4 print-page-break itinerary-card">
      {/* Day Header */}
      <div className="p-5 sm:p-6 bg-white flex items-center justify-between border-b border-[#e5e5df] hover:bg-[#f5f5f0]/60 transition-colors">
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center space-x-3.5 flex-1 cursor-pointer select-none mr-2"
        >
          <div className="w-10 h-10 rounded-xl bg-[#ecece4] text-[#5A5A40] flex items-center justify-center font-serif italic font-semibold text-base border border-[#d1d1ca] shrink-0">
            D{day.dayNumber}
          </div>
          <div>
            {!isEditingHeader ? (
              <>
                <div className="flex items-center space-x-2">
                  <h3 className="font-serif text-lg sm:text-xl font-normal italic text-[#2c2c24]">
                    {day.dayTitle}
                  </h3>
                  {day.destinationName && (
                    <span className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-[#ecece4] text-[#5A5A40] border border-[#d1d1ca]">
                      📍 {day.destinationName}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#8a8a7e] font-sans font-medium line-clamp-1 mt-0.5">
                  {day.theme} • {day.activities.length} planned spots
                </p>
              </>
            ) : (
              <form onSubmit={handleSaveHeader} onClick={(e) => e.stopPropagation()} className="space-y-1.5 py-1">
                <input
                  type="text"
                  value={dayTitle}
                  onChange={(e) => setDayTitle(e.target.value)}
                  className="px-2.5 py-1 text-sm border border-[#d1d1ca] rounded-lg w-full font-serif italic"
                />
                <input
                  type="text"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="px-2.5 py-1 text-xs border border-[#d1d1ca] rounded-lg w-full font-sans"
                />
                <button type="submit" className="text-[11px] px-2.5 py-0.5 bg-[#5A5A40] text-white rounded-md font-serif italic">
                  Save
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right side header tools */}
        <div className="flex items-center space-x-2 shrink-0">
          {day.estimatedTotalBudget && (
            <div className="hidden sm:flex items-center space-x-1 text-xs font-serif italic text-[#2c2c24] bg-[#ecece4] px-3 py-1 rounded-full border border-[#d1d1ca]">
              <DollarSign className="w-3.5 h-3.5 text-[#5A5A40]" />
              <span>Est. {day.estimatedTotalBudget}</span>
            </div>
          )}

          {/* Quick Edit Day Header */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditingHeader(!isEditingHeader);
            }}
            title="Edit day title and theme"
            className="p-1 text-[#8a8a7e] hover:text-[#2c2c24] no-print"
          >
            <Edit3 className="w-4 h-4" />
          </button>

          {/* Delete Day if multiple */}
          {onDeleteDay && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete Day ${day.dayNumber}?`)) {
                  onDeleteDay(day.dayNumber);
                }
              }}
              title="Delete Day"
              className="p-1 text-[#8a8a7e] hover:text-rose-600 no-print"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-[#8a8a7e] hover:text-[#2c2c24]"
          >
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Day Summary & Activities List */}
      {isExpanded && (
        <div className="p-5 sm:p-6 space-y-4 bg-[#f5f5f0]/40">
          {day.summary && (
            <p className="text-xs sm:text-sm text-[#6b6b5e] italic bg-white p-3.5 rounded-2xl border border-[#e5e5df] font-serif">
              "{day.summary}"
            </p>
          )}

          <div className="space-y-3.5">
            {day.activities.map((act, idx) => (
              <React.Fragment key={act.id || `act-${idx}`}>
                <ActivityCard
                  activity={act}
                  dayNumber={day.dayNumber}
                  index={idx}
                  totalActivities={day.activities.length}
                  isSelected={selectedSpotId === act.id}
                  onSelect={onSelectSpot}
                  onSwapActivity={onSwapActivity}
                  onEditActivity={onEditActivity}
                  onDeleteActivity={onDeleteActivity}
                  onMoveActivity={onMoveActivity}
                  onSelectAlternativeOption={onSelectAlternativeOption}
                  onSkipPermanently={onSkipPermanently}
                  onOpenDetails={onOpenDetails}
                  onVisitedChanged={onVisitedChanged}
                  destinationOrTown={destinationOrTown}
                />

                {/* Transit Route Connector to Next Spot */}
                {idx < day.activities.length - 1 && act.transitToNext && (
                  <div className="my-2.5 px-4 py-2 bg-[#ecece4]/60 border border-[#d1d1ca] rounded-2xl flex items-center justify-between text-xs text-[#2c2c24] font-sans shadow-2xs">
                    <div className="flex items-center space-x-2.5">
                      <span className="w-7 h-7 rounded-xl bg-white border border-[#d1d1ca] flex items-center justify-center text-sm shadow-2xs shrink-0">
                        {act.transitToNext.mode === "walk"
                          ? "🚶‍♂️"
                          : act.transitToNext.mode === "funicular"
                          ? "🚠"
                          : act.transitToNext.mode === "boat"
                          ? "🛥️"
                          : act.transitToNext.mode === "transit"
                          ? "🚌"
                          : "🚕"}
                      </span>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-serif italic font-semibold text-[#2c2c24]">
                            {act.transitToNext.duration}
                          </span>
                          {act.transitToNext.distance && (
                            <span className="text-[11px] text-[#8a8a7e]">
                              • {act.transitToNext.distance}
                            </span>
                          )}
                        </div>
                        {act.transitToNext.instructions && (
                          <p className="text-[11px] text-[#6b6b5e] line-clamp-1">
                            {act.transitToNext.instructions}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-[#5A5A40] bg-white px-2 py-0.5 rounded-full border border-[#d1d1ca] shrink-0">
                      Route
                    </span>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Add Activity Button inside Day */}
          <div className="pt-2 no-print">
            <button
              type="button"
              onClick={() => onOpenAddActivity(day.dayNumber)}
              className="w-full py-2.5 px-4 rounded-2xl border border-dashed border-[#d1d1ca] hover:border-[#5A5A40] bg-white hover:bg-[#ecece4]/60 text-[#5A5A40] text-xs font-serif italic flex items-center justify-center space-x-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Custom Spot to Day {day.dayNumber}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
