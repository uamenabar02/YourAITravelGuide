import React, { useEffect, useState } from "react";
import { DailyPlan, ActivitySpot } from "../types";
import { ActivityCard } from "./ActivityCard";
import { ChevronDown, ChevronUp, DollarSign, Plus, Edit3, Trash2, Navigation, Clock } from "lucide-react";
import { getRouteInfoBetweenSpots, getEntireDayRouteGoogleMapsUrl } from "../utils/transit";
import { useLanguage } from "../context/LanguageContext";
import { TranslatedText } from "./TranslatedText";

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
  onOpenScheduleAdjuster?: (dayNumber: number) => void;
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
  onOpenScheduleAdjuster,
  destinationOrTown,
}) => {
  const { t } = useLanguage();
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
      <div className="p-4 sm:p-6 bg-white flex items-center justify-between border-b border-[#e5e5df] hover:bg-[#f5f5f0]/60 transition-colors">
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center space-x-3 sm:space-x-3.5 flex-1 cursor-pointer select-none mr-2 min-w-0"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#ecece4] text-[#5A5A40] flex items-center justify-center font-serif italic font-semibold text-sm sm:text-base border border-[#d1d1ca] shrink-0">
            D{day.dayNumber}
          </div>
          <div className="min-w-0 flex-1">
            {!isEditingHeader ? (
              <>
                <div className="flex items-center space-x-2 min-w-0">
                  <h3 className="font-serif text-base sm:text-xl font-normal italic text-[#2c2c24] truncate">
                    <TranslatedText text={day.dayTitle} />
                  </h3>
                  {day.destinationName && (
                    <span className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-[#ecece4] text-[#5A5A40] border border-[#d1d1ca] shrink-0 hidden sm:inline-block">
                      📍 {day.destinationName}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#8a8a7e] font-sans font-medium line-clamp-1 mt-0.5 truncate flex items-center gap-1.5">
                  <TranslatedText text={day.theme} />
                  <span>•</span>
                  <span>{t("day.plannedSpots", { count: day.activities.length })}</span>
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
                  {t("action.save", "Save")}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right side header tools */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          {day.estimatedTotalBudget && (
            <div className="hidden md:flex items-center space-x-1 text-xs font-serif italic text-[#2c2c24] bg-[#ecece4] px-3 py-1 rounded-full border border-[#d1d1ca] shrink-0">
              <DollarSign className="w-3.5 h-3.5 text-[#5A5A40]" />
              <span>{t("day.estBudget", { budget: day.estimatedTotalBudget })}</span>
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
            className="p-1 text-[#8a8a7e] hover:text-[#2c2c24] no-print shrink-0"
          >
            <Edit3 className="w-4 h-4" />
          </button>

          {/* Delete Day if multiple */}
          {onDeleteDay && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(t("day.deleteConfirm", { day: day.dayNumber }))) {
                  onDeleteDay(day.dayNumber);
                }
              }}
              title="Delete Day"
              className="p-1 text-[#8a8a7e] hover:text-rose-600 no-print shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-[#8a8a7e] hover:text-[#2c2c24] shrink-0"
          >
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Day Summary & Activities List */}
      {isExpanded && (
        <div className="p-4 sm:p-6 space-y-4 bg-[#f5f5f0]/40">
          {day.summary && (
            <p className="text-xs sm:text-sm text-[#6b6b5e] italic bg-white p-3.5 rounded-2xl border border-[#e5e5df] font-serif flex items-start gap-1">
              <span>"</span>
              <TranslatedText text={day.summary} />
              <span>"</span>
            </p>
          )}

          {/* Day Actions & Route Exporter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white p-3.5 rounded-2xl border border-[#e5e5df] no-print">
            <div className="flex items-center space-x-2 min-w-0">
              <span className="text-xs font-sans font-semibold text-[#5A5A40] bg-[#5A5A40]/10 px-2.5 py-1 rounded-xl shrink-0 whitespace-nowrap">
                {t("day.mappedSpots", { count: day.activities.length })}
              </span>
              {day.estimatedTotalBudget && (
                <span className="text-xs font-serif italic text-[#2c2c24] bg-[#ecece4] px-2.5 py-1 rounded-xl border border-[#d1d1ca] shrink-0 whitespace-nowrap">
                  {t("day.estBudget", { budget: day.estimatedTotalBudget })}
                </span>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-2 ml-auto shrink-0">
              {onOpenScheduleAdjuster && (
                <button
                  type="button"
                  onClick={() => onOpenScheduleAdjuster(day.dayNumber)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#f5f5f0] hover:bg-[#ecece4] text-[#5A5A40] hover:text-[#2c2c24] text-xs font-serif italic border border-[#d1d1ca] hover:border-[#5A5A40] rounded-xl transition-all shadow-3xs shrink-0 whitespace-nowrap"
                  title="Shift or compress today's schedule if you are running late or ahead of time"
                >
                  <Clock className="w-3.5 h-3.5 text-[#5A5A40]" />
                  <span>{t("day.adjustSchedule", "Adjust Schedule / Running Late")}</span>
                </button>
              )}

              {day.activities.length > 1 && (
                <a
                  href={getEntireDayRouteGoogleMapsUrl(day.activities, destinationOrTown)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 hover:text-emerald-900 text-xs font-serif italic border border-emerald-200 hover:border-emerald-300 rounded-xl transition-all shadow-3xs shrink-0 whitespace-nowrap"
                  title="Generate and open the full sequence of stops for today in Google Maps"
                >
                  <Navigation className="w-3.5 h-3.5 text-emerald-700 animate-pulse" />
                  <span>{t("day.exportGoogleMaps", "Export Day Route to Google Maps")}</span>
                </a>
              )}
            </div>
          </div>

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
                {idx < day.activities.length - 1 && (() => {
                  const nextAct = day.activities[idx + 1];
                  const route = getRouteInfoBetweenSpots(act, nextAct, destinationOrTown);

                  // Dynamically translate the duration string
                  const minsMatch = route.duration.match(/^(\d+)/);
                  const mins = minsMatch ? minsMatch[1] : "";
                  let translatedDuration = route.duration;
                  if (mins) {
                    if (route.mode === "walk") {
                      translatedDuration = t("transit.walk", "{mins} min walk").replace("{mins}", mins);
                    } else if (route.mode === "transit") {
                      translatedDuration = t("transit.transit", "{mins} min transit").replace("{mins}", mins);
                    } else if (route.mode === "drive" || route.mode === "taxi") {
                      translatedDuration = t("transit.drive", "{mins} min drive/taxi").replace("{mins}", mins);
                    } else {
                      translatedDuration = t("transit.connection", "{mins} min connection").replace("{mins}", mins);
                    }
                  }

                  // Dynamically translate the instructions string
                  let translatedInstructions = route.instructions;
                  if (route.instructions) {
                    if (route.instructions.startsWith("Direct connection from")) {
                      translatedInstructions = t("transit.instructions", "Direct connection from {from} to {to}")
                        .replace("{from}", act.name)
                        .replace("{to}", nextAct.name);
                    } else if (route.instructions.startsWith("Navigate from")) {
                      translatedInstructions = t("transit.navigate", "Navigate from {from} to {to}")
                        .replace("{from}", act.name)
                        .replace("{to}", nextAct.name);
                    }
                  }

                  return (
                    <div className="my-2 px-3 sm:px-4 py-2 bg-[#ecece4]/70 border border-[#d1d1ca] rounded-2xl flex items-center justify-between text-xs text-[#2c2c24] font-sans shadow-2xs gap-2">
                      <div className="flex items-center space-x-2 sm:space-x-2.5 min-w-0">
                        <span className="w-7 h-7 rounded-xl bg-white border border-[#d1d1ca] flex items-center justify-center text-sm shadow-2xs shrink-0">
                          {route.mode === "walk"
                            ? "🚶‍♂️"
                            : route.mode === "funicular"
                            ? "🚠"
                            : route.mode === "boat"
                            ? "🛥️"
                            : route.mode === "transit"
                            ? "🚌"
                            : "🚕"}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-serif italic font-semibold text-[#2c2c24] shrink-0">
                              {translatedDuration}
                            </span>
                            {route.distance && (
                              <span className="text-[11px] text-[#8a8a7e] truncate">
                                • {route.distance}
                              </span>
                            )}
                          </div>
                          {translatedInstructions && (
                            <p className="text-[11px] text-[#6b6b5e] truncate">
                              {translatedInstructions}
                            </p>
                          )}
                        </div>
                      </div>

                      <a
                        href={route.googleMapsDirectionsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center space-x-1 text-[11px] font-serif italic text-[#5A5A40] hover:text-[#2c2c24] bg-white px-2.5 py-1 rounded-xl border border-[#d1d1ca] hover:border-[#5A5A40] shrink-0 transition-colors whitespace-nowrap"
                        title={`Open directions from ${act.name} to ${nextAct.name} in Google Maps`}
                      >
                        <Navigation className="w-3 h-3 text-[#5A5A40]" />
                        <span>{t("day.directions", "Directions")}</span>
                      </a>
                    </div>
                  );
                })()}
              </React.Fragment>
            ))}
          </div>

          {/* Add Activity Button inside Day */}
          <div className="pt-2 no-print">
            <button
              type="button"
              onClick={() => onOpenAddActivity(day.dayNumber)}
              className="w-full py-2.5 px-4 rounded-2xl border border-dashed border-[#d1d1ca] hover:border-[#5A5A40] bg-white hover:bg-[#ecece4]/60 text-[#5A5A40] text-xs font-serif italic flex items-center justify-center space-x-1.5 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>{t("day.addCustomSpot", { day: day.dayNumber })}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
