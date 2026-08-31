import React, { useState } from "react";
import {
  X,
  MapPin,
  Calendar,
  Star,
  Download,
  Compass,
  Sparkles,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Bookmark,
  Share2,
  Check,
  Award,
  Layers,
  Heart,
  Eye,
  Info,
} from "lucide-react";
import { SharedTripDoc, ItineraryPlan, ActivitySpot, DailyPlan, ActivityCategory } from "../types";
import { useLanguage } from "../context/LanguageContext";
import { TranslatedText } from "./TranslatedText";

interface ItineraryPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: SharedTripDoc | null;
  onOpenInWorkspace: (plan: ItineraryPlan) => void;
  onSaveCopy?: (plan: ItineraryPlan) => void;
  onOpenActivityDetails?: (spot: ActivitySpot, dayNumber?: number) => void;
  onShowToast?: (msg: string, type?: "success" | "info" | "error") => void;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  food: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" },
  nature: { bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200" },
  culture: { bg: "bg-stone-100", text: "text-stone-800", border: "border-stone-300" },
  sightseeing: { bg: "bg-sky-50", text: "text-sky-800", border: "border-sky-200" },
  "hidden-gem": { bg: "bg-purple-50", text: "text-purple-800", border: "border-purple-200" },
  nightlife: { bg: "bg-rose-50", text: "text-rose-800", border: "border-rose-200" },
  shopping: { bg: "bg-pink-50", text: "text-pink-800", border: "border-pink-200" },
  relaxation: { bg: "bg-teal-50", text: "text-teal-800", border: "border-teal-200" },
};

export const ItineraryPreviewModal: React.FC<ItineraryPreviewModalProps> = ({
  isOpen,
  onClose,
  trip,
  onOpenInWorkspace,
  onSaveCopy,
  onOpenActivityDetails,
  onShowToast,
}) => {
  const { t } = useLanguage();
  const [selectedDayTab, setSelectedDayTab] = useState<number | "all">("all");
  const [isSavedLocally, setIsSavedLocally] = useState(false);

  if (!isOpen || !trip) return null;

  const plan = trip.plan;
  const days = plan?.days || [];

  const handleSaveToMyTrips = () => {
    if (onSaveCopy) {
      onSaveCopy(plan);
      setIsSavedLocally(true);
    }
  };

  const handleLoadAndOpen = () => {
    onOpenInWorkspace(plan);
    onClose();
  };

  const displayedDays =
    selectedDayTab === "all"
      ? days
      : days.filter((d) => d.dayNumber === selectedDayTab);

  return (
    <div
      id="itinerary-preview-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-900/70 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] shadow-2xl border border-stone-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-white border-b border-[#e5e5df]/60 p-6 sm:p-8 text-[#2c2c24] relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#f5f5f0] hover:bg-[#ecece4] text-[#5A5A40] border border-[#d1d1ca] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="space-y-3 pr-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 bg-[#5A5A40]/10 text-[#5A5A40] border border-[#d1d1ca]/50 rounded-full text-xs font-semibold flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5" />
                <TranslatedText text="Community Curated Itinerary" />
              </span>
              <span className="px-2.5 py-1 bg-[#f5f5f0] text-[#2c2c24] border border-[#d1d1ca] rounded-full text-xs font-medium flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#5A5A40]" />
                {plan.totalDays} {plan.totalDays === 1 ? t("action.day", "Day") : t("action.days", "Days")}
              </span>
              <span className="px-2.5 py-1 bg-[#f5f5f0] text-[#2c2c24] border border-[#d1d1ca] rounded-full text-xs font-medium flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#5A5A40]" />
                {plan.destinationOrTown}
              </span>
              <div className="flex items-center gap-1 bg-amber-400/10 text-[#b58100] px-2.5 py-1 rounded-full text-xs font-bold border border-amber-300/30">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                <span>{trip.rating?.toFixed(1) || "5.0"}</span>
                <span className="text-[#8a8a7e] font-normal">({trip.ratingsCount || 1})</span>
              </div>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#2c2c24] tracking-tight">
              {plan.title}
            </h2>

            <p className="text-xs sm:text-sm text-[#6b6b5e] leading-relaxed max-w-3xl">
              {plan.summary}
            </p>

            {/* Creator info & tags */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#e5e5df]/60">
              <div className="flex items-center gap-2 text-xs text-[#6b6b5e]">
                <div className="w-6 h-6 rounded-full bg-[#5A5A40] text-white font-bold flex items-center justify-center text-xs">
                  {trip.creatorName ? trip.creatorName[0].toUpperCase() : "T"}
                </div>
                <span>
                  <TranslatedText text="Crafted by" />{" "}
                  <strong className="text-[#2c2c24]">{trip.creatorName || "Local Explorer"}</strong>
                </span>
                {trip.creatorEmail?.includes("localexplorer") && (
                  <Award className="w-3.5 h-3.5 text-[#5A5A40]" />
                )}
              </div>

              {/* Tags / Vibes */}
              {(plan.tags || trip.featuredTags) && (
                <div className="flex flex-wrap gap-1.5">
                  {(trip.featuredTags || plan.tags || []).map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-[#f5f5f0] text-[#5A5A40] border border-[#d1d1ca] text-[11px] font-medium"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Bar (Top) */}
        <div className="px-6 py-3 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
          {/* Day Navigation Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full">
            <button
              type="button"
              onClick={() => setSelectedDayTab("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                selectedDayTab === "all"
                  ? "bg-emerald-800 text-white shadow-xs"
                  : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-100"
              }`}
            >
              <TranslatedText text="All Days" /> ({days.length})
            </button>
            {days.map((d) => (
              <button
                key={d.dayNumber}
                type="button"
                onClick={() => setSelectedDayTab(d.dayNumber)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                  selectedDayTab === d.dayNumber
                    ? "bg-emerald-800 text-white shadow-xs"
                    : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-100"
                }`}
              >
                {t("action.day", "Day")} {d.dayNumber}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {onSaveCopy && (
              <button
                type="button"
                onClick={handleSaveToMyTrips}
                disabled={isSavedLocally}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  isSavedLocally
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default"
                    : "bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 shadow-2xs"
                }`}
              >
                {isSavedLocally ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <TranslatedText text="Saved to My Trips" />
                  </>
                ) : (
                  <>
                    <Bookmark className="w-3.5 h-3.5 text-stone-500" />
                    <TranslatedText text="Save Copy to My Trips" />
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handleLoadAndOpen}
              className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold transition-all shadow-xs active:scale-95 flex items-center gap-1.5"
            >
              <Compass className="w-3.5 h-3.5" />
              <TranslatedText text="Open in Workspace" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-stone-50/50">
          {displayedDays.map((day) => (
            <div
              key={day.dayNumber}
              className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden"
            >
              {/* Day Sub-Header */}
              <div className="p-4 bg-stone-100/70 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-emerald-800 text-white text-xs font-serif italic flex items-center justify-center font-bold">
                    {day.dayNumber}
                  </span>
                  <div>
                    <h3 className="font-bold text-stone-900 text-sm font-serif">
                      {day.dayTitle || `Day ${day.dayNumber}: ${day.theme || "Exploration"}`}
                    </h3>
                    {day.theme && (
                      <p className="text-[11px] text-emerald-800 font-medium">
                        {day.theme}
                      </p>
                    )}
                  </div>
                </div>

                <span className="text-xs text-stone-500 font-medium">
                  {day.activities?.length || 0} <TranslatedText text="spots" />
                </span>
              </div>

              {/* Day Summary */}
              {day.summary && (
                <div className="px-4 py-2.5 bg-emerald-50/40 border-b border-emerald-100/50 text-xs text-emerald-950 leading-relaxed italic">
                  "{day.summary}"
                </div>
              )}

              {/* Activities List */}
              <div className="p-4 divide-y divide-stone-100 space-y-3">
                {(day.activities || []).map((act, actIdx) => {
                  const catStyle = CATEGORY_COLORS[act.category] || CATEGORY_COLORS["culture"];
                  const spotName = act.name || (act as any).spotName;
                  const spotLocation = act.address || (act as any).location;
                  const spotCost = act.approxCost || (act as any).cost;
                  const spotTip = act.insiderTip || ((act as any).insiderTips && (act as any).insiderTips[0]);
                  const spotPhoto = (act.photos && act.photos.length > 0 ? act.photos[0] : (act as any).photoUrl);

                  return (
                    <div
                      key={act.id || actIdx}
                      className={`pt-3 first:pt-0 flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${
                        actIdx > 0 ? "mt-3" : ""
                      }`}
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {(act as any).timeSlot && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md">
                              <Clock className="w-3 h-3 text-stone-400" />
                              {(act as any).timeSlot}
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-wider ${catStyle.bg} ${catStyle.text} border ${catStyle.border}`}
                          >
                            {act.category}
                          </span>
                          {spotCost && (
                            <span className="text-[11px] font-semibold text-stone-600">
                              {spotCost}
                            </span>
                          )}
                        </div>

                        <h4 className="font-bold text-stone-900 text-sm">
                          {spotName}
                        </h4>

                        {spotLocation && (
                          <p className="text-xs text-stone-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
                            <span className="truncate">{spotLocation}</span>
                          </p>
                        )}

                        <p className="text-xs text-stone-600 leading-relaxed">
                          {act.description}
                        </p>

                        {/* Insider tip highlight */}
                        {spotTip && (
                          <div className="p-2.5 bg-amber-50/80 rounded-xl border border-amber-200/60 text-xs text-amber-950 space-y-0.5 mt-1.5">
                            <span className="font-bold text-amber-800 flex items-center gap-1 text-[11px]">
                              <span>💡</span> <TranslatedText text="Insider Tip:" />
                            </span>
                            <p className="text-[11px] leading-relaxed">
                              {spotTip}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Right side: Photo & Details button */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                        {spotPhoto && (
                          <img
                            src={spotPhoto}
                            alt={spotName}
                            referrerPolicy="no-referrer"
                            className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-stone-200 shadow-2xs"
                          />
                        )}

                        {onOpenActivityDetails && (
                          <button
                            type="button"
                            onClick={() => onOpenActivityDetails(act, day.dayNumber)}
                            className="px-3 py-1 bg-stone-100 hover:bg-emerald-700 text-stone-700 hover:text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1 border border-stone-200 hover:border-emerald-700"
                          >
                            <Sparkles className="w-3 h-3 text-emerald-600 group-hover:text-white" />
                            <TranslatedText text="Details & Guide" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white border-t border-stone-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors"
          >
            <TranslatedText text="Close Preview" />
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLoadAndOpen}
              className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-md active:scale-95 flex items-center gap-2"
            >
              <Compass className="w-4 h-4" />
              <TranslatedText text="Open in Workspace" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
