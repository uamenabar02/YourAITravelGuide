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
  ArrowUp,
  ArrowDown,
  Layers,
  MessageSquare,
  Ticket,
  Ban,
  ThumbsUp,
  ThumbsDown,
  Heart,
  Send,
  GripVertical,
} from "lucide-react";
import { generateGoogleMapsSearchUrl, getTicketOrBookingUrl } from "../utils/destinations";
import { normalizeTimeSlot } from "../utils/time";
import { getActivityHistory, recordActivityVisit, removeHistoryItem } from "../utils/storage";
import {
  getCollaborationState,
  toggleActivityVote,
  addActivityComment,
  getCurrentUserName,
} from "../utils/collaboration";
import { useLanguage } from "../context/LanguageContext";
import { TranslatedText } from "./TranslatedText";

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
  onPublishActivity?: (activity: ActivitySpot, dayNumber: number) => void;
  onVisitedChanged?: (activity: ActivitySpot, isVisited: boolean) => void;
  destinationOrTown: string;
  canEdit?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: (e: React.DragEvent, index: number) => void;
  onDragOver?: (e: React.DragEvent, index: number) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, index: number) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isCardExpanded?: boolean;
  onToggleCardExpanded?: () => void;
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
  onPublishActivity,
  onVisitedChanged,
  destinationOrTown,
  canEdit = true,
  isDragging = false,
  isDragOver = false,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  isCardExpanded = true,
  onToggleCardExpanded = () => {},
}) => {
  const { t } = useLanguage();
  const [isSwapping, setIsSwapping] = useState(false);
  const [isVisited, setIsVisited] = useState(() => {
    const history = getActivityHistory();
    return history.some((h) => h.name.toLowerCase() === activity.name.toLowerCase());
  });
  const [showOpinions, setShowOpinions] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");

  const [collab, setCollab] = useState(() => getCollaborationState("current_trip"));
  const currentUser = getCurrentUserName();
  const currentVotes = collab.votes[activity.id] || { upvotes: [], downvotes: [], hearts: [] };
  const currentComments = collab.comments[activity.id] || [];

  const handleVote = (e: React.MouseEvent, type: "up" | "down" | "heart") => {
    e.stopPropagation();
    const updated = toggleActivityVote("current_trip", activity.id, type, currentUser);
    setCollab(updated);
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    addActivityComment("current_trip", activity.id, newCommentText.trim(), currentUser);
    const updated = getCollaborationState("current_trip");
    setCollab(updated);
    setNewCommentText("");
  };

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

  if (!isCardExpanded) {
    return (
      <div
        id={`activity-card-${activity.id}`}
        onClick={handleCardClick}
        draggable={canEdit}
        onDragStart={(e) => canEdit && onDragStart && onDragStart(e, index)}
        onDragOver={(e) => canEdit && onDragOver && onDragOver(e, index)}
        onDragLeave={(e) => canEdit && onDragLeave && onDragLeave(e)}
        onDrop={(e) => canEdit && onDrop && onDrop(e, index)}
        onDragEnd={(e) => canEdit && onDragEnd && onDragEnd(e)}
        className={`group relative bg-white rounded-xl p-3 border transition-all cursor-pointer flex items-center justify-between gap-3 ${
          isDragging
            ? "opacity-40 scale-[0.99] border-dashed border-[#5A5A40] bg-[#fafaf8]"
            : isDragOver
            ? "border-emerald-500 ring-2 ring-emerald-400/60 bg-emerald-50/40 shadow-md scale-[1.01]"
            : isSelected
            ? "border-[#5A5A40] ring-1 ring-[#5A5A40] shadow-2xs bg-[#ecece4]/20 border-l-4 border-l-[#5A5A40]"
            : "border-[#e5e5df] hover:border-[#d1d1ca] hover:shadow-3xs"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {canEdit && (
            <span
              className="cursor-grab active:cursor-grabbing text-[#8a8a7e] hover:text-[#5A5A40] p-1 rounded opacity-50 group-hover:opacity-100 transition-opacity no-print"
              title="Drag & drop to reorder activity slot"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="w-4 h-4 shrink-0" />
            </span>
          )}

          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-serif italic shrink-0 ${
              isSelected ? "bg-[#5A5A40] text-white font-bold" : "bg-[#ecece4] text-[#2c2c24]"
            }`}
          >
            {index + 1}
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs font-serif italic text-[#2c2c24] bg-[#f5f5f0] px-2 py-0.5 rounded-lg border border-[#e5e5df] shrink-0">
            <Clock className="w-3.5 h-3.5 text-[#8a8a7e]" />
            <span>{normalizeTimeSlot(activity.time)}</span>
          </div>

          <h4 className="font-serif text-sm sm:text-base font-normal italic text-[#2c2c24] truncate flex-1 hover:text-[#5A5A40] transition-colors">
            <TranslatedText text={activity.name} />
          </h4>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline-block text-xs font-serif italic font-semibold text-[#2c2c24] bg-[#ecece4] px-2.5 py-0.5 rounded-lg border border-[#d1d1ca]">
            {activity.approxCost}
          </span>

          <span
            className={`hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-sans border ${categoryMeta.badgeClass}`}
          >
            <span>{categoryMeta.icon}</span>
            <span className="ml-1">{t(`category.${activity.category}`, categoryMeta.label)}</span>
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCardExpanded();
            }}
            title="Expand details"
            className="p-1 rounded-lg hover:bg-[#ecece4] text-[#8a8a7e] hover:text-[#2c2c24] cursor-pointer"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

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
      draggable={canEdit}
      onDragStart={(e) => canEdit && onDragStart && onDragStart(e, index)}
      onDragOver={(e) => canEdit && onDragOver && onDragOver(e, index)}
      onDragLeave={(e) => canEdit && onDragLeave && onDragLeave(e)}
      onDrop={(e) => canEdit && onDrop && onDrop(e, index)}
      onDragEnd={(e) => canEdit && onDragEnd && onDragEnd(e)}
      className={`group relative bg-white rounded-2xl p-3.5 sm:p-6 border transition-all cursor-pointer ${
        isDragging
          ? "opacity-40 scale-[0.99] border-dashed border-[#5A5A40] bg-[#fafaf8]"
          : isDragOver
          ? "border-emerald-500 ring-2 ring-emerald-400/60 bg-emerald-50/40 shadow-md scale-[1.01]"
          : isSelected
          ? "border-[#5A5A40] ring-1 ring-[#5A5A40] shadow-sm bg-[#ecece4]/20 border-l-4 border-l-[#5A5A40]"
          : "border-[#e5e5df] hover:border-[#d1d1ca] hover:shadow-xs"
      }`}
    >
      {/* Top row: Drag Grip, Number, Time, Category, and Cost */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <span
              className="cursor-grab active:cursor-grabbing text-[#8a8a7e] hover:text-[#5A5A40] p-0.5 rounded opacity-50 group-hover:opacity-100 transition-opacity no-print"
              title="Drag & drop to reorder activity slot"
            >
              <GripVertical className="w-4 h-4" />
            </span>
          )}

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
            <span>{t(`category.${activity.category}`, categoryMeta.label)}</span>
          </span>

          {activity.isLiveEvent && (
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-900 border border-amber-300 shadow-xs">
              <Sparkles className="w-3 h-3 text-amber-600 animate-pulse" />
              <span>{t("act.liveHappening", "Live Happening 🔥")}</span>
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

          {/* Reorder & Collapse Controls */}
          <div className="flex items-center space-x-1 opacity-60 group-hover:opacity-100 transition-opacity no-print">
            <div className="flex items-center bg-[#ecece4]/50 rounded-lg p-0.5 border border-[#d1d1ca]/40">
              <button
                type="button"
                disabled={index === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveActivity(dayNumber, index, index - 1);
                }}
                title="Move Up"
                className="p-1 rounded-md text-[#8a8a7e] hover:text-[#2c2c24] hover:bg-white disabled:opacity-20 cursor-pointer"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={index === totalActivities - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveActivity(dayNumber, index, index + 1);
                }}
                title="Move Down"
                className="p-1 rounded-md text-[#8a8a7e] hover:text-[#2c2c24] hover:bg-white disabled:opacity-20 cursor-pointer"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>

            <span className="w-[1px] h-4 bg-[#d1d1ca] mx-1 shrink-0" />

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleCardExpanded();
              }}
              title="Collapse Spot"
              className="p-1 rounded-lg text-[#8a8a7e] hover:text-[#2c2c24] hover:bg-[#ecece4] cursor-pointer"
            >
              <ChevronUp className="w-4 h-4" />
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
              {t("act.multipleChoice", "Multiple Choice Options (Click to switch)")}
            </span>
            <span className="text-[#5A5A40] font-semibold">{t("act.available", "{count} Available").replace("{count}", allOptionsList.length.toString())}</span>
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
      <div className="mb-2 sm:mb-3.5">
        <div className="flex items-center justify-between">
          <h4 className="font-serif text-base sm:text-xl font-normal italic text-[#2c2c24] leading-snug group-hover:text-[#5A5A40] transition-colors">
            <TranslatedText text={activity.name} />
          </h4>
          {activity.isSwapped && (
            <span className="text-[10px] font-medium text-[#5A5A40] bg-[#ecece4] border border-[#d1d1ca] px-2 py-0.5 rounded-full ml-2 shrink-0">
              {t("act.freshChoice", "Fresh Choice 🔄")}
            </span>
          )}
        </div>
        <div className="text-xs sm:text-sm text-[#2c2c24]/90 mt-1 sm:mt-1.5 leading-relaxed font-sans line-clamp-2 sm:line-clamp-none">
          <TranslatedText text={activity.description} />
        </div>
      </div>

      {/* Live Event Callout Box */}
      {activity.eventDetails && (
        <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-2.5 sm:p-3.5 mb-2.5 sm:mb-3.5 text-xs text-amber-950 leading-relaxed flex items-start space-x-2.5 shadow-2xs">
          <Ticket className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <div className="font-serif italic font-bold text-amber-900 flex flex-wrap items-center gap-2">
              <span>{activity.eventDetails.eventType || t("act.activeEvent", "Active Local Event")}</span>
              {activity.eventDetails.dates && (
                <span className="font-sans text-[11px] font-normal bg-amber-200/70 px-2 py-0.5 rounded-full text-amber-950">
                  📅 {activity.eventDetails.dates}
                </span>
              )}
            </div>
            {activity.eventDetails.venue && (
              <p className="text-amber-800 font-sans mt-1">
                📍 {t("act.venue", "Venue: {venue}").replace("{venue}", activity.eventDetails.venue)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Insider Tip Callout */}
      {activity.insiderTip && (
        <div className="hidden sm:flex bg-[#ecece4] border border-[#d1d1ca] rounded-2xl p-3 sm:p-3.5 mb-3.5 text-xs text-[#2c2c24] leading-relaxed items-start space-x-2.5">
          <Lightbulb className="w-4 h-4 text-[#5A5A40] shrink-0 mt-0.5" />
          <div>
            <span className="font-serif italic font-semibold mr-1">{t("act.insiderTip", "Insider Note:")}</span>
            <span className="text-[#6b6b5e] font-sans">
              <TranslatedText text={activity.insiderTip} />
            </span>
          </div>
        </div>
      )}

      {/* Google Maps Opinion Snippet (Expandable) */}
      {showOpinions && activity.reviews && activity.reviews.length > 0 && (
        <div className="bg-[#f5f5f0] border border-[#e5e5df] rounded-2xl p-3 mb-3.5 text-xs space-y-2 animate-in fade-in-20">
          <div className="flex items-center justify-between font-serif italic text-[#5A5A40]">
            <span>{t("act.reviews", "Reviews")}</span>
            <span className="text-[11px] font-sans text-[#8a8a7e]">{activity.reviews.length} reviews</span>
          </div>
          {activity.reviews.map((rev, i) => (
            <div key={i} className="bg-white p-2 rounded-xl border border-[#ecece4]">
              <div className="flex items-center justify-between text-[10px] text-[#8a8a7e]">
                <span className="font-semibold text-[#2c2c24]">{rev.author}</span>
                <span>⭐ {rev.rating}</span>
              </div>
              <p className="text-[#6b6b5e] mt-0.5 italic flex items-start gap-0.5">
                <span>"</span>
                <TranslatedText text={rev.text} />
                <span>"</span>
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Group Travel Comments & Memos (Expandable) */}
      {showComments && (
        <div
          className="bg-[#f5f5f0] border border-[#d1d1ca] rounded-2xl p-3.5 mb-3.5 text-xs space-y-2.5 no-print animate-in fade-in-20"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between font-serif italic text-[#2c2c24] font-semibold">
            <span>{t("act.groupNotesTitle", "Group Travel Notes & Tips")}</span>
            <span className="text-[10px] font-sans text-[#8a8a7e]">
              {currentComments.length} {currentComments.length === 1 ? t("act.note", "note") : t("act.notes", "notes")}
            </span>
          </div>

          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {currentComments.length === 0 ? (
              <p className="text-[11px] text-[#8a8a7e] italic">
                {t("act.noNotes", "No group notes left for this spot yet. Add a reservation confirmation, meeting point, or thought below!")}
              </p>
            ) : (
              currentComments.map((c) => (
                <div key={c.id} className="bg-white p-2 rounded-xl border border-[#e5e5df] text-[11px]">
                  <div className="flex items-center justify-between text-[#8a8a7e] text-[10px]">
                    <span className="font-bold text-[#2c2c24]">👤 {c.author}</span>
                    <span>{new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-[#2c2c24] mt-0.5">{c.text}</p>
                </div>
              ))
            )}
          </div>

          {/* Add Comment Field */}
          <form onSubmit={handleAddComment} className="flex items-center gap-1.5 pt-1">
            <input
              type="text"
              placeholder={t("act.addNotePlaceholder", { user: currentUser })}
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              className="flex-1 px-2.5 py-1 text-xs border border-[#d1d1ca] rounded-xl bg-white focus:outline-none focus:border-[#5A5A40]"
            />
            <button
              type="submit"
              disabled={!newCommentText.trim()}
              className="p-1.5 bg-[#5A5A40] text-white rounded-xl disabled:opacity-40 hover:bg-[#4a4a35] transition-colors shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Bottom Action Row */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-[#e5e5df] text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Deep Details & AI Guide Button */}
          {onOpenDetails && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetails(activity, dayNumber);
              }}
              className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#ecece4] hover:bg-[#5A5A40] text-[#5A5A40] hover:text-white border border-[#d1d1ca] font-medium transition-all shadow-2xs group/detail shrink-0 whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#5A5A40] group-hover/detail:text-white transition-colors" />
              <span>{t("act.details", "Details & Guide")}</span>
            </button>
          )}

          {/* Publish Activity to Community Explore Button */}
          {onPublishActivity && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPublishActivity(activity, dayNumber);
              }}
              title={t("act.publishToExplore", "Publish this activity with photos to Community Explore")}
              className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-300 font-medium transition-all shadow-2xs group/pub shrink-0 whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 group-hover/pub:text-white transition-colors" />
              <span>{t("act.publish", "Publish Spot")}</span>
            </button>
          )}

          {/* Purchase Ticket / Booking Link (if available or paid activity) */}
          {resolvedTicketUrl && (
            <a
              href={resolvedTicketUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#5A5A40] text-white text-xs font-serif italic hover:bg-[#4a4a35] transition-all shadow-xs shrink-0 whitespace-nowrap"
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>{t("act.tickets", "Tickets / Booking")}</span>
            </a>
          )}

          {/* External Map Link */}
          <button
            type="button"
            onClick={openInMaps}
            className="flex items-center space-x-1 text-[#8a8a7e] hover:text-[#2c2c24] font-medium transition-colors shrink-0 whitespace-nowrap"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#8a8a7e]" />
            <span>{t("act.mapsReviews", "Map & Reviews")}</span>
          </button>

          {/* Group Reactions (Thumbs Up, Heart, Thumbs Down) */}
          <div className="flex items-center space-x-1 no-print bg-[#f5f5f0] p-0.5 rounded-full border border-[#d1d1ca] shrink-0">
            <button
              type="button"
              onClick={(e) => handleVote(e, "heart")}
              title="Love this spot"
              className={`p-1 rounded-full transition-all ${
                currentVotes.hearts.includes(currentUser)
                  ? "bg-rose-100 text-rose-600 font-bold"
                  : "text-[#8a8a7e] hover:text-rose-600 hover:bg-white"
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${currentVotes.hearts.includes(currentUser) ? "fill-current" : ""}`} />
            </button>

            <button
              type="button"
              onClick={(e) => handleVote(e, "up")}
              title="Like this spot"
              className={`p-1 rounded-full transition-all ${
                currentVotes.upvotes.includes(currentUser)
                  ? "bg-emerald-100 text-emerald-700 font-bold"
                  : "text-[#8a8a7e] hover:text-emerald-700 hover:bg-white"
              }`}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={(e) => handleVote(e, "down")}
              title="Pass on this spot"
              className={`p-1 rounded-full transition-all ${
                currentVotes.downvotes.includes(currentUser)
                  ? "bg-amber-100 text-amber-800 font-bold"
                  : "text-[#8a8a7e] hover:text-amber-800 hover:bg-white"
              }`}
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>

            {/* Reaction counts if any */}
            {(currentVotes.hearts.length > 0 || currentVotes.upvotes.length > 0) && (
              <span className="text-[10px] font-sans font-semibold text-[#5A5A40] px-1.5">
                {currentVotes.hearts.length + currentVotes.upvotes.length}
              </span>
            )}
          </div>

          {/* Toggle Group Comments */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowComments(!showComments);
            }}
            className={`flex items-center space-x-1 no-print font-medium transition-colors shrink-0 whitespace-nowrap ${
              currentComments.length > 0 ? "text-[#5A5A40] font-semibold" : "text-[#8a8a7e] hover:text-[#2c2c24]"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{currentComments.length > 0 ? `${t("act.notes", "Notes")} (${currentComments.length})` : t("act.note", "Note")}</span>
          </button>

          {/* Toggle Opinions */}
          {activity.reviews && activity.reviews.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowOpinions(!showOpinions);
              }}
              className="flex items-center space-x-1 text-[#8a8a7e] hover:text-[#2c2c24] font-medium transition-colors shrink-0 whitespace-nowrap"
            >
              <Star className="w-3.5 h-3.5 text-amber-500" />
              <span>{showOpinions ? t("act.hideReviews", "Hide Reviews") : t("act.reviews", "Reviews")}</span>
            </button>
          )}

          {/* Mark Visited Toggle */}
          <button
            type="button"
            onClick={handleToggleVisited}
            className={`flex items-center space-x-1 font-medium transition-colors shrink-0 whitespace-nowrap ${
              isVisited ? "text-[#5A5A40] font-bold" : "text-[#8a8a7e] hover:text-[#2c2c24]"
            }`}
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${isVisited ? "text-[#5A5A40]" : ""}`} />
            <span>{isVisited ? t("act.visited", "Visited") : t("act.markVisited", "Mark Visited")}</span>
          </button>
        </div>

        {/* Action Controls: Edit, Swap, Delete (Only for Organizers / Contributors) */}
        {canEdit && (
          <div className="flex items-center space-x-2 no-print ml-auto shrink-0">
            {/* Edit Activity Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditActivity(activity, dayNumber);
              }}
              title="Edit activity details"
              className="p-1.5 rounded-lg text-[#8a8a7e] hover:text-[#2c2c24] hover:bg-[#ecece4] transition-colors shrink-0"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>

            {/* Delete Activity Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(t("act.deleteConfirm", "Remove \"{name}\" from Day {day}?").replace("{name}", activity.name).replace("{day}", dayNumber.toString()))) {
                  onDeleteActivity(activity.id, dayNumber);
                }
              }}
              title="Delete activity"
              className="p-1.5 rounded-lg text-[#8a8a7e] hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
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
                      t("act.permanentSkipPrompt", { name: activity.name })
                    )
                  ) {
                    onSkipPermanently(activity, dayNumber);
                  }
                }}
                title={t("act.permanentSkip", "Permanently Exclude Spot")}
                className="p-1.5 rounded-lg text-[#8a8a7e] hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
              >
                <Ban className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Regenerate / Swap Single Activity Button */}
            <button
              type="button"
              onClick={handleSwap}
              disabled={isSwapping}
              title={t("act.swap", "Swap Spot")}
              className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#f5f5f0] text-[#5A5A40] hover:bg-[#ecece4] border border-[#d1d1ca] font-medium transition-all disabled:opacity-50 shrink-0 whitespace-nowrap"
            >
              <RefreshCw className={`w-3 h-3 ${isSwapping ? "animate-spin text-[#5A5A40]" : ""}`} />
              <span>{isSwapping ? t("act.swapping", "Swapping...") : t("act.swap", "Swap Spot")}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

