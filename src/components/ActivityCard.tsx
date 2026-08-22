import React, { useState, useEffect } from "react";
import { ActivitySpot, ActivityCategory } from "../types";
import {
  Clock,
  DollarSign,
  Star,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Lightbulb,
  MapPin,
  CheckCircle2,
  Edit2,
  Trash2,
  ChevronUp,
  ChevronDown,
  Layers,
  MessageSquare,
  Ticket,
  Ban,
} from "lucide-react";
import { generateGoogleMapsSearchUrl, getTicketOrBookingUrl } from "../utils/destinations";
import { normalizeTimeSlot } from "../utils/time";
import { getActivityHistory, recordActivityVisit, removeHistoryItem } from "../utils/storage";

interface ActivityCardProps {
  activity: ActivitySpot;
  dayNumber: number;
  index: number;
  totalActivities: number;
  isSelected: boolean;
  onSelect: (activity: ActivitySpot) => void;
  onSwapActivity: (activity: ActivitySpot, dayNumber: number) => Promise<void>;
  onEditActivity: (activity: ActivitySpot, dayNumber: number) => void;
  onDeleteActivity: (activityId: string, dayNumber: number) => void;
  onMoveActivity: (dayNumber: number, fromIndex: number, toIndex: number) => void;
  onSelectAlternativeOption: (dayNumber: number, activityIndex: number, optionIndex: number) => void;
  onSkipPermanently?: (activity: ActivitySpot, dayNumber: number) => void;
  onOpenDetails?: (activity: ActivitySpot, dayNumber: number) => void;
  onVisitedChanged?: (activity: ActivitySpot, isVisited: boolean) => void;
  destinationOrTown: string;
}

const CATEGORY_META: Record<ActivityCategory, { label: string; icon: string; badgeClass: string }> = {
  food: { label: "Local Eatery", icon: "🍜", badgeClass: "bg-[#ecece4] text-[#2c2c24] border-[#d1d1ca]" },
  nature: { label: "Nature & Walk", icon: "🌲", badgeClass: "bg-[#ecece4] text-[#2c2c24] border-[#d1d1ca]" },
  culture: { label: "Culture & Art", icon: "🏛️", badgeClass: "bg-[#ecece4] text-[#2c2c24] border-[#d1d1ca]" },
  sightseeing: { label: "Landmark", icon: "📍", badgeClass: "bg-[#ecece4] text-[#2c2c24] border-[#d1d1ca]" },
  "hidden-gem": { label: "Secret Spot", icon: "💎", badgeClass: "bg-[#ecece4] text-[#5A5A40] border-[#5A5A40] font-semibold" },
  shopping: { label: "Artisan Craft", icon: "🛍️", badgeClass: "bg-[#ecece4] text-[#2c2c24] border-[#d1d1ca]" },
  relaxation: { label: "Sanctuary", icon: "🌿", badgeClass: "bg-[#ecece4] text-[#2c2c24] border-[#d1d1ca]" },
  nightlife: { label: "Evening Spot", icon: "🍸", badgeClass: "bg-[#ecece4] text-[#2c2c24] border-[#d1d1ca]" },
  cafe: { label: "Local Roastery", icon: "☕", badgeClass: "bg-[#ecece4] text-[#2c2c24] border-[#d1d1ca]" },
  entertainment: { label: "Entertainment", icon: "🎭", badgeClass: "bg-[#ecece4] text-[#2c2c24] border-[#d1d1ca]" },
};

export const ActivityCard: React.FC<ActivityCardProps> = ({
  activity,
  dayNumber,
  index,
  totalActivities,
  isSelected,
  onSelect,
  onSwapActivity,
  onEditActivity,
  onDeleteActivity,
  onMoveActivity,
  onSelectAlternativeOption,
  onSkipPermanently,
  onOpenDetails,
  onVisitedChanged,
  destinationOrTown,
}) => {
  const [isSwapping, setIsSwapping] = useState(false);
  const [isVisited, setIsVisited] = useState(() => {
    const history = getActivityHistory();
    return history.some((h) => h.name.toLowerCase() === activity.name.toLowerCase());
  });
  const [showOpinions, setShowOpinions] = useState(false);

  useEffect(() => {
    const history = getActivityHistory();
    setIsVisited(history.some((h) => h.name.toLowerCase() === activity.name.toLowerCase()));
  }, [activity.name]);

  const handleToggleVisited = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isVisited) {
      const history = getActivityHistory();
      const matched = history.find((h) => h.name.toLowerCase() === activity.name.toLowerCase());
      if (matched) {
        removeHistoryItem(matched.id);
      }
      setIsVisited(false);
      if (onVisitedChanged) onVisitedChanged(activity, false);
    } else {
      recordActivityVisit(activity, destinationOrTown);
      setIsVisited(true);
      if (onVisitedChanged) onVisitedChanged(activity, true);
    }
  };

  const categoryMeta = CATEGORY_META[activity.category] || CATEGORY_META.sightseeing;

  const handleCardClick = () => {
    onSelect(activity);
    if (onOpenDetails) {
      onOpenDetails(activity, dayNumber);
    }
  };

  const handleSwap = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSwapping(true);
    try {
      await onSwapActivity(activity, dayNumber);
    } finally {
      setIsSwapping(false);
    }
  };

  const openInMaps = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = activity.googleMapsUrl || generateGoogleMapsSearchUrl(activity.name, destinationOrTown);
    window.open(url, "_blank");
  };

  // Build clean options list for multiple choice
  const allOptionsList: ActivitySpot[] =
    activity.allOptions && activity.allOptions.length > 0
      ? activity.allOptions
      : activity.alternativeOptions && activity.alternativeOptions.length > 0
      ? [
          {
            ...activity,
            allOptions: undefined,
            alternativeOptions: undefined,
          },
          ...activity.alternativeOptions,
        ]
      : [];

  const hasAlternatives = allOptionsList.length > 1;
  const activeOptionIdx = activity.selectedOptionIndex ?? 0;

  // Resolve Ticket URL if applicable
  const resolvedTicketUrl = getTicketOrBookingUrl(
    activity.name,
    destinationOrTown,
    activity.approxCost,
    activity.ticketUrl
  );

  return (
    <div
      id={`activity-card-${activity.id}`}
      onClick={handleCardClick}
      className={`group relative bg-white rounded-2xl p-5 sm:p-6 border transition-all cursor-pointer ${
        isSelected
          ? "border-[#5A5A40] ring-1 ring-[#5A5A40] shadow-sm bg-[#ecece4]/20 border-l-4 border-l-[#5A5A40]"
          : "border-[#e5e5df] hover:border-[#d1d1ca] hover:shadow-xs"
      }`}
    >
      {/* Top row: Number, Time, Category, and Cost */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-serif italic shrink-0 ${
              isSelected ? "bg-[#5A5A40] text-white font-bold" : "bg-[#ecece4] text-[#2c2c24] group-hover:bg-[#5A5A40] group-hover:text-white transition-colors"
            }`}
          >
            {index + 1}
          </div>

          <div className="flex items-center space-x-1.5 text-xs font-serif italic text-[#2c2c24]">
            <Clock className="w-3.5 h-3.5 text-[#8a8a7e]" />
            <span>{normalizeTimeSlot(activity.time)}</span>
          </div>

          <span
            className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-sans border ${categoryMeta.badgeClass}`}
          >
            <span>{categoryMeta.icon}</span>
            <span>{categoryMeta.label}</span>
          </span>

          {activity.isLiveEvent && (
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-900 border border-amber-300 shadow-xs">
              <Sparkles className="w-3 h-3 text-amber-600 animate-pulse" />
              <span>Live Happening 🔥</span>
            </span>
          )}
        </div>

        {/* Cost, rating, and Quick Reorder Controls */}
        <div className="flex items-center space-x-2 shrink-0">
          <span className="text-xs font-serif italic font-semibold text-[#2c2c24] bg-[#f5f5f0] px-2.5 py-0.5 rounded-full border border-[#e5e5df]">
            {activity.approxCost}
          </span>
          {activity.rating && (
            <span className="flex items-center text-xs font-medium text-[#2c2c24] bg-[#ecece4] px-2 py-0.5 rounded-full border border-[#d1d1ca]">
              <Star className="w-3 h-3 fill-amber-500 text-amber-500 mr-1" />
              {activity.rating}
            </span>
          )}

          {/* Reorder Buttons */}
          <div className="flex items-center space-x-0.5 opacity-60 group-hover:opacity-100 transition-opacity no-print">
            <button
              type="button"
              disabled={index === 0}
              onClick={(e) => {
                e.stopPropagation();
                onMoveActivity(dayNumber, index, index - 1);
              }}
              title="Move Up"
              className="p-1 rounded text-[#8a8a7e] hover:text-[#2c2c24] hover:bg-[#ecece4] disabled:opacity-20"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={index === totalActivities - 1}
              onClick={(e) => {
                e.stopPropagation();
                onMoveActivity(dayNumber, index, index + 1);
              }}
              title="Move Down"
              className="p-1 rounded text-[#8a8a7e] hover:text-[#2c2c24] hover:bg-[#ecece4] disabled:opacity-20"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Multiple Choice Options Selector (Fixed) */}
      {hasAlternatives && (
        <div
          className="mb-3 p-2.5 bg-[#f5f5f0] border border-[#e5e5df] rounded-xl text-xs space-y-1.5 no-print"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-widest text-[#8a8a7e]">
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3 text-[#5A5A40]" />
              Multiple Choice Options (Click to switch)
            </span>
            <span className="text-[#5A5A40] font-semibold">{allOptionsList.length} Available</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {allOptionsList.map((opt, optIdx) => {
              const isSelectedOpt = activeOptionIdx === optIdx;
              const letter = String.fromCharCode(65 + optIdx);
              const displayName = opt.name.split(":")[0].replace(/^Option [A-Z]:\s*/i, "").slice(0, 26);
              return (
                <button
                  key={opt.id || optIdx}
                  type="button"
                  onClick={() => onSelectAlternativeOption(dayNumber, index, optIdx)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-serif italic border transition-all ${
                    isSelectedOpt
                      ? "bg-[#5A5A40] text-white border-[#5A5A40] font-semibold shadow-xs"
                      : "bg-white text-[#2c2c24] border-[#d1d1ca] hover:bg-[#ecece4] hover:border-[#5A5A40]"
                  }`}
                >
                  Option {letter}: {displayName}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Title & Description */}
      <div className="mb-3.5">
        <div className="flex items-center justify-between">
          <h4 className="font-serif text-lg sm:text-xl font-normal italic text-[#2c2c24] leading-snug group-hover:text-[#5A5A40] transition-colors">
            {activity.name}
          </h4>
          {activity.isSwapped && (
            <span className="text-[10px] font-medium text-[#5A5A40] bg-[#ecece4] border border-[#d1d1ca] px-2 py-0.5 rounded-full ml-2 shrink-0">
              Fresh Choice 🔄
            </span>
          )}
        </div>
        <p className="text-sm text-[#2c2c24]/90 mt-1.5 leading-relaxed font-sans">
          {activity.description}
        </p>
      </div>

      {/* Live Event Callout Box */}
      {activity.eventDetails && (
        <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-3 sm:p-3.5 mb-3.5 text-xs text-amber-950 leading-relaxed flex items-start space-x-2.5 shadow-2xs">
          <Ticket className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <div className="font-serif italic font-bold text-amber-900 flex flex-wrap items-center gap-2">
              <span>{activity.eventDetails.eventType || "Active Local Event"}</span>
              {activity.eventDetails.dates && (
                <span className="font-sans text-[11px] font-normal bg-amber-200/70 px-2 py-0.5 rounded-full text-amber-950">
                  📅 {activity.eventDetails.dates}
                </span>
              )}
            </div>
            {activity.eventDetails.venue && (
              <p className="text-amber-800 font-sans mt-1">
                📍 Venue: {activity.eventDetails.venue}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Insider Tip Callout */}
      {activity.insiderTip && (
        <div className="bg-[#ecece4] border border-[#d1d1ca] rounded-2xl p-3 sm:p-3.5 mb-3.5 text-xs text-[#2c2c24] leading-relaxed flex items-start space-x-2.5">
          <Lightbulb className="w-4 h-4 text-[#5A5A40] shrink-0 mt-0.5" />
          <div>
            <span className="font-serif italic font-semibold mr-1">Insider Note:</span>
            <span className="text-[#6b6b5e] font-sans">{activity.insiderTip}</span>
          </div>
        </div>
      )}

      {/* Google Maps Opinion Snippet (Expandable) */}
      {showOpinions && activity.reviews && activity.reviews.length > 0 && (
        <div className="bg-[#f5f5f0] border border-[#e5e5df] rounded-2xl p-3 mb-3.5 text-xs space-y-2 animate-in fade-in-20">
          <div className="flex items-center justify-between font-serif italic text-[#5A5A40]">
            <span>Google Maps Visitor Reviews</span>
            <span className="text-[11px] font-sans text-[#8a8a7e]">{activity.reviews.length} reviews</span>
          </div>
          {activity.reviews.map((rev, i) => (
            <div key={i} className="bg-white p-2 rounded-xl border border-[#ecece4]">
              <div className="flex items-center justify-between text-[10px] text-[#8a8a7e]">
                <span className="font-semibold text-[#2c2c24]">{rev.author}</span>
                <span>⭐ {rev.rating}</span>
              </div>
              <p className="text-[#6b6b5e] mt-0.5 italic">"{rev.text}"</p>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Action Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#e5e5df] text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Deep Details & AI Guide Button */}
          {onOpenDetails && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetails(activity, dayNumber);
              }}
              className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#ecece4] hover:bg-[#5A5A40] text-[#5A5A40] hover:text-white border border-[#d1d1ca] font-medium transition-all shadow-2xs group/detail"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#5A5A40] group-hover/detail:text-white transition-colors" />
              <span>Details, Lore & Guide</span>
            </button>
          )}

          {/* Purchase Ticket / Booking Link (if available or paid activity) */}
          {resolvedTicketUrl && (
            <a
              href={resolvedTicketUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#5A5A40] text-white text-xs font-serif italic hover:bg-[#4a4a35] transition-all shadow-xs"
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>Buy Tickets / Booking</span>
            </a>
          )}

          {/* External Map Link */}
          <button
            type="button"
            onClick={openInMaps}
            className="flex items-center space-x-1 text-[#8a8a7e] hover:text-[#2c2c24] font-medium transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#8a8a7e]" />
            <span>Map & Reviews</span>
          </button>

          {/* Toggle Opinions */}
          {activity.reviews && activity.reviews.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowOpinions(!showOpinions);
              }}
              className="flex items-center space-x-1 text-[#8a8a7e] hover:text-[#2c2c24] font-medium transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{showOpinions ? "Hide Reviews" : "Opinions"}</span>
            </button>
          )}

          {/* Mark Visited Toggle */}
          <button
            type="button"
            onClick={handleToggleVisited}
            className={`flex items-center space-x-1 font-medium transition-colors ${
              isVisited ? "text-[#5A5A40] font-bold" : "text-[#8a8a7e] hover:text-[#2c2c24]"
            }`}
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${isVisited ? "text-[#5A5A40]" : ""}`} />
            <span>{isVisited ? "Visited" : "Mark Visited"}</span>
          </button>
        </div>

        {/* Action Controls: Edit, Swap, Delete */}
        <div className="flex items-center space-x-2 no-print ml-auto">
          {/* Edit Activity Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEditActivity(activity, dayNumber);
            }}
            title="Edit activity details"
            className="p-1.5 rounded-lg text-[#8a8a7e] hover:text-[#2c2c24] hover:bg-[#ecece4] transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          {/* Delete Activity Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Remove "${activity.name}" from Day ${dayNumber}?`)) {
                onDeleteActivity(activity.id, dayNumber);
              }
            }}
            title="Delete activity"
            className="p-1.5 rounded-lg text-[#8a8a7e] hover:text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Permanent Skip: never suggest this place again */}
          {onSkipPermanently && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (
                  confirm(
                    `Never suggest "${activity.name}" again?\n\nIt will be permanently excluded from all future plans. You can undo this anytime in History → Permanent Skips.`
                  )
                ) {
                  onSkipPermanently(activity, dayNumber);
                }
              }}
              title="Never suggest this place again"
              className="p-1.5 rounded-lg text-[#8a8a7e] hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <Ban className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Regenerate / Swap Single Activity Button */}
          <button
            type="button"
            onClick={handleSwap}
            disabled={isSwapping}
            title="Regenerate this spot with a fresh authentic alternative"
            className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#f5f5f0] text-[#5A5A40] hover:bg-[#ecece4] border border-[#d1d1ca] font-medium transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isSwapping ? "animate-spin text-[#5A5A40]" : ""}`} />
            <span>{isSwapping ? "Swapping..." : "Swap Spot"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

