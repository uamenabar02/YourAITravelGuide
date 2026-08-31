import React, { useState, useEffect } from "react";
import { ItineraryPlan, ActivitySpot, DailyPlan } from "../types";
import { InteractiveMap } from "./InteractiveMap";
import { parseTimeToHours } from "../utils/time";
import { getRouteInfoBetweenSpots } from "../utils/transit";
import { isActivityVisited, toggleActivityVisited, getActivityHistory } from "../utils/storage";
import {
  Compass,
  MapPin,
  Navigation,
  CloudRain,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Calendar,
  AlertCircle,
  Footprints,
  Bus,
  Car,
  Hotel,
  Key,
  Phone,
  RefreshCw,
  Map as MapIcon,
  Layers,
  ArrowRight,
} from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { TranslatedText } from "./TranslatedText";
import { motion } from "motion/react";

interface DayCompanionModeProps {
  plan: ItineraryPlan;
  onUpdatePlan: (updatedPlan: ItineraryPlan) => void;
  onSwapActivity: (
    activity: ActivitySpot,
    dayNumber: number,
    options?: { isIndoorOnly?: boolean; customRequirement?: string }
  ) => Promise<void>;
  onVisitedChanged?: (activity: ActivitySpot, isVisited: boolean) => void;
  onOpenSpotDetail: (spot: ActivitySpot) => void;
  onOpenWallet?: () => void;
}

export const DayCompanionMode: React.FC<DayCompanionModeProps> = ({
  plan,
  onUpdatePlan,
  onSwapActivity,
  onVisitedChanged,
  onOpenSpotDetail,
  onOpenWallet,
}) => {
  const { t } = useLanguage();
  const [activeDayNum, setActiveDayNum] = useState<number>(1);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [isSwappingIndoor, setIsSwappingIndoor] = useState<string | null>(null);
  const [showMobileMap, setShowMobileMap] = useState<boolean>(false);
  const [delayBufferMinutes, setDelayBufferMinutes] = useState<number>(0);

  // Get current active day object
  const currentDay: DailyPlan = plan.days.find((d) => d.dayNumber === activeDayNum) || plan.days[0];
  const activities = currentDay?.activities || [];

  // Determine active spot based on time or selection
  const now = new Date();
  const currentHourDecimal = now.getHours() + now.getMinutes() / 60;

  // Find active spot index
  let activeIndex = 0;
  if (selectedSpotId) {
    const foundIdx = activities.findIndex((a) => a.id === selectedSpotId);
    if (foundIdx !== -1) activeIndex = foundIdx;
  } else {
    // Auto-detect spot closest to current time
    let bestMatchIdx = 0;
    let minDiff = 999;
    activities.forEach((act, idx) => {
      const parsedTime = parseTimeToHours(act.time);
      if (typeof parsedTime === "number") {
        const diff = Math.abs(currentHourDecimal - parsedTime);
        if (diff < minDiff) {
          minDiff = diff;
          bestMatchIdx = idx;
        }
      }
    });
    activeIndex = bestMatchIdx;
  }

  const activeSpot = activities[activeIndex] || activities[0];
  const nextSpot = activities[activeIndex + 1] || null;
  const prevSpot = activeIndex > 0 ? activities[activeIndex - 1] : null;

  // Navigation Route between active spot and next spot
  const transitToNext = activeSpot && nextSpot
    ? getRouteInfoBetweenSpots(activeSpot, nextSpot, plan.destinationOrTown)
    : null;

  // Transit Route from Previous Spot
  const transitFromPrev = prevSpot && activeSpot
    ? getRouteInfoBetweenSpots(prevSpot, activeSpot, plan.destinationOrTown)
    : null;

  // Count visited spots for current day
  const visitedCount = activities.filter((act) => isActivityVisited(act.name)).length;
  const progressPercent = activities.length > 0 ? Math.round((visitedCount / activities.length) * 100) : 0;

  // 1-Click Indoor Swap Handler
  const handleIndoorSwap = async (spot: ActivitySpot) => {
    setIsSwappingIndoor(spot.id);
    try {
      await onSwapActivity(spot, activeDayNum, { isIndoorOnly: true });
    } finally {
      setIsSwappingIndoor(null);
    }
  };

  // Toggle Visited Status
  const handleToggleVisited = (spot: ActivitySpot) => {
    const isNowVisited = toggleActivityVisited(spot.name, plan.destinationOrTown, spot.category, spot.approxCost);
    if (onVisitedChanged) {
      onVisitedChanged(spot, isNowVisited);
    }
    // Force re-render trigger
    onUpdatePlan({ ...plan });
  };

  // Quick 15-Minute Schedule Buffer Shift
  const handleAddScheduleBuffer = (mins: number) => {
    if (!currentDay) return;
    const defaultTimeSlots = ["09:00 AM", "11:00 AM", "01:30 PM", "04:00 PM", "07:00 PM", "09:00 PM"];
    const updatedActivities = currentDay.activities.map((act, idx) => {
      if (idx < activeIndex) return act; // don't shift past spots
      const parsed = parseTimeToHours(act.time);
      if (typeof parsed !== "number") return act;
      const newStartDecimal = (parsed + mins / 60) % 24;
      const newEndDecimal = (parsed + 1.5 + mins / 60) % 24;

      const formatDecimalTime = (decimal: number) => {
        const h = Math.floor(decimal);
        const m = Math.round((decimal - h) * 60);
        const period = h >= 12 ? "PM" : "AM";
        const displayH = h % 12 === 0 ? 12 : h % 12;
        const displayM = m < 10 ? `0${m}` : `${m}`;
        return `${displayH}:${displayM} ${period}`;
      };

      const newTimeStr = `${formatDecimalTime(newStartDecimal)} - ${formatDecimalTime(newEndDecimal)}`;
      return { ...act, time: newTimeStr };
    });

    const updatedDays = plan.days.map((d) =>
      d.dayNumber === activeDayNum ? { ...d, activities: updatedActivities } : d
    );
    onUpdatePlan({ ...plan, days: updatedDays });
    setDelayBufferMinutes((prev) => prev + mins);
  };

  // Google Maps URL for active spot
  const activeSpotMapsUrl = activeSpot?.googleMapsUrl ||
    (activeSpot
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${activeSpot.name}, ${plan.destinationOrTown}`
        )}`
      : "#");

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Header Banner: On-The-Go Companion Status */}
      <div className="bg-white text-[#2c2c24] rounded-3xl p-4 sm:p-6 border border-[#e5e5df] shadow-sm relative overflow-hidden">
        {/* Background Decorative Graphic */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-[#5A5A40]/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e5df]/50 pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-[#5A5A40] flex items-center justify-center shrink-0 border border-[#ecece4] shadow-sm">
                <Compass className="w-5 h-5 text-white animate-spin-slow" />
              </div>
              <div>
                <div className="hidden sm:flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-serif italic text-emerald-800 font-semibold uppercase tracking-wider">
                    {t("companion.activeBadge", "Live Day Companion Mode Active")}
                  </span>
                </div>
                <h2 className="font-serif italic text-base sm:text-2xl font-bold text-[#2c2c24] leading-tight">
                  {plan.destinationOrTown} — {currentDay?.dayTitle || `${t("action.day", "Day")} ${activeDayNum}`}
                </h2>
              </div>
            </div>

            {/* Mobile View Toggle (Map vs Cards) with Bubble Motion */}
            <div className="flex items-center bg-[#ecece4] p-0.5 rounded-full border border-[#d1d1ca]/50 shadow-inner h-8.5 relative shrink-0 lg:hidden w-full xs:w-auto mt-2 xs:mt-0">
              <button
                type="button"
                onClick={() => setShowMobileMap(false)}
                className={`relative flex-1 xs:flex-initial flex items-center justify-center space-x-1.5 px-3 py-1 rounded-full text-xs font-serif italic font-semibold h-7.5 cursor-pointer z-10 transition-colors duration-200 whitespace-nowrap ${
                  !showMobileMap
                    ? "text-[#2c2c24]"
                    : "text-[#5A5A40] hover:text-[#2c2c24]"
                }`}
              >
                {!showMobileMap && (
                  <motion.span
                    layoutId="companionMobileViewBubble"
                    className="absolute inset-0 bg-white rounded-full -z-10 shadow-3xs"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <Layers className="w-3.5 h-3.5" />
                <span>{t("companion.viewTimeline", "Timeline")}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowMobileMap(true)}
                className={`relative flex-1 xs:flex-initial flex items-center justify-center space-x-1.5 px-3 py-1 rounded-full text-xs font-serif italic font-semibold h-7.5 cursor-pointer z-10 transition-colors duration-200 whitespace-nowrap ${
                  showMobileMap
                    ? "text-[#2c2c24]"
                    : "text-[#5A5A40] hover:text-[#2c2c24]"
                }`}
              >
                {showMobileMap && (
                  <motion.span
                    layoutId="companionMobileViewBubble"
                    className="absolute inset-0 bg-white rounded-full -z-10 shadow-3xs"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <MapIcon className="w-3.5 h-3.5" />
                <span>{t("companion.viewLiveMap", "Live Map")}</span>
              </button>
            </div>
          </div>

          {/* Day Selector & Progress Meter Bar */}
          <div className="flex flex-col gap-3 pt-1">
            {/* Days Tabs (Scrollable row ensures all trip days are 100% visible and accessible) - Desktop/Tablet only */}
            <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-thin">
              {plan.days.map((day) => {
                const isSelected = day.dayNumber === activeDayNum;
                const dayVisited = day.activities.filter((a) => isActivityVisited(a.name)).length;
                const isDayComplete = day.activities.length > 0 && dayVisited === day.activities.length;

                return (
                  <button
                    key={day.dayNumber}
                    type="button"
                    onClick={() => {
                      setActiveDayNum(day.dayNumber);
                      setSelectedSpotId(null);
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-serif italic transition-all flex items-center space-x-1.5 shrink-0 border ${
                      isSelected
                        ? "bg-[#5A5A40] text-white border-[#5A5A40] shadow-md font-bold"
                        : "bg-[#f5f5f0] text-[#6b6b5e] hover:bg-[#ecece4] border-[#e5e5df]"
                    }`}
                  >
                    <span>{t("action.day", "Day")} {day.dayNumber}</span>
                    {isDayComplete ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <span className="text-[10px] text-[#6b6b5e]">
                        ({dayVisited}/{day.activities.length})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Mobile Day Selector Dropdown (Smartphone only) */}
            <div className="block sm:hidden relative w-full">
              <label htmlFor="mobile-day-select" className="sr-only">
                {t("action.selectDay", "Select Day")}
              </label>
              <select
                id="mobile-day-select"
                value={activeDayNum}
                onChange={(e) => {
                  setActiveDayNum(Number(e.target.value));
                  setSelectedSpotId(null);
                }}
                className="w-full px-3 py-2 bg-[#f5f5f0] border border-[#e5e5df] text-[#2c2c24] rounded-xl text-xs font-serif italic font-bold focus:outline-none focus:ring-1 focus:ring-[#5A5A40] cursor-pointer appearance-none pr-10"
                style={{
                  backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%235A5A40' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 12px center",
                  backgroundSize: "16px",
                }}
              >
                {plan.days.map((day) => {
                  const dayVisited = day.activities.filter((a) => isActivityVisited(a.name)).length;
                  const isDayComplete = day.activities.length > 0 && dayVisited === day.activities.length;
                  return (
                    <option key={day.dayNumber} value={day.dayNumber}>
                      {t("action.day", "Day")} {day.dayNumber} ({dayVisited}/{day.activities.length}) {isDayComplete ? "✓" : ""}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Progress Meter Bar - Desktop/Tablet only */}
            <div className="hidden sm:flex items-center space-x-3 bg-[#f5f5f0] px-3.5 py-2 rounded-2xl border border-[#e5e5df] shrink-0">
              <div className="text-right">
                <span className="text-[10px] text-[#8a8a7e] font-sans block">{t("companion.todaysProgress", "Today's Progress")}</span>
                <span className="text-xs font-bold text-[#2c2c24]">{progressPercent}% {t("companion.completed", "Completed")}</span>
              </div>
              <div className="w-20 bg-[#ecece4] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Dual-Column Content Layout (PC 2-Column, Mobile Stack or Map Toggle) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Interactive Timeline Stream & Spotlight Card (7 cols on PC) */}
        <div className={`space-y-6 lg:col-span-7 ${showMobileMap ? "hidden lg:block" : "block"}`}>
          {/* A. TODAY'S TIMELINE STREAM */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#e5e5df] space-y-4">
            <div className="flex items-center justify-between border-b border-[#e5e5df] pb-3">
              <h4 className="font-serif italic font-bold text-base text-[#2c2c24] flex items-center space-x-2">
                <Layers className="w-4 h-4 text-[#5A5A40]" />
                <span>{t("companion.scheduleStream", "Today's Full Schedule Stream")}</span>
              </h4>
              <span className="text-xs text-[#8a8a7e] font-serif italic">
                {activities.length} {t("companion.totalSpots", "total spots")}
              </span>
            </div>

            <div className="space-y-3">
              {activities.map((spot, idx) => {
                const isSelected = spot.id === activeSpot?.id;
                const isVisited = isActivityVisited(spot.name);

                return (
                  <div
                    key={spot.id || idx}
                    onClick={() => setSelectedSpotId(spot.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between space-x-3 ${
                      isSelected
                        ? "bg-[#fafaf8] border-[#5A5A40] ring-1 ring-[#5A5A40] shadow-2xs"
                        : "bg-white border-[#e5e5df] hover:border-[#5A5A40]"
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      {/* Interactive Badge: Click badge or button to toggle visited */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleVisited(spot);
                        }}
                        className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 transition-transform active:scale-95 ${
                          isVisited
                            ? "bg-emerald-600 text-white border border-emerald-700 shadow-2xs"
                            : isSelected
                            ? "bg-[#5A5A40] text-white"
                            : "bg-[#f5f5f0] text-[#5a5a4c] border border-[#d1d1ca] hover:bg-emerald-100 hover:border-emerald-400"
                        }`}
                        title={isVisited ? t("companion.markVisited", "Mark Visited") : t("companion.markVisited", "Mark Visited")}
                      >
                        {isVisited ? "✓" : idx + 1}
                      </button>

                      <div className="min-w-0">
                        <div className="text-[10px] text-[#8a8a7e] font-serif italic font-semibold">
                          {spot.time}
                        </div>
                        <h5
                          className={`font-medium text-xs sm:text-sm truncate ${
                            isVisited ? "line-through text-[#8a8a7e]" : "text-[#2c2c24]"
                          }`}
                        >
                          <TranslatedText text={spot.name} />
                        </h5>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#f5f5f0] text-[#5a5a4c] border border-[#d1d1ca] uppercase tracking-wider hidden sm:inline-block">
                        {t(`category.${spot.category}`, spot.category.toUpperCase())}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] font-serif italic text-[#5A5A40] font-bold hidden md:inline-block">
                          {t("companion.focus", "Focus")}
                        </span>
                      )}

                      {/* Direct Visited Action Button on each item */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleVisited(spot);
                        }}
                        className={`flex items-center space-x-1 px-2.5 py-1 rounded-xl text-[11px] font-serif italic font-semibold transition-all shrink-0 border ${
                          isVisited
                            ? "bg-emerald-700 text-white border-emerald-800 shadow-2xs"
                            : "bg-[#f5f5f0] text-[#5a5a4c] hover:bg-emerald-50 hover:text-emerald-800 border-[#d1d1ca]"
                        }`}
                        title={isVisited ? t("companion.visited", "Visited") : t("companion.visitedQuestion", "Visited?")}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{isVisited ? t("companion.visited", "Visited") : t("companion.visitedQuestion", "Visited?")}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* B. ACTIVE SPOT SPOTLIGHT HERO CARD */}
          {activeSpot ? (
            <div className="bg-white rounded-3xl p-5 sm:p-7 border-2 border-[#5A5A40] shadow-md space-y-5 relative overflow-hidden">
              {/* Highlight Tag */}
              <div className="flex items-center justify-between border-b border-[#e5e5df] pb-3">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-serif italic text-[#5A5A40] font-bold uppercase tracking-wider">
                    {t("companion.selectedSpot", "Currently Selected Focus Spot")}
                  </span>
                </div>
                <div className="flex items-center space-x-1.5 bg-[#f5f5f0] px-2.5 py-1 rounded-full border border-[#d1d1ca] text-xs font-semibold text-[#2c2c24]">
                  <Clock className="w-3.5 h-3.5 text-[#5A5A40]" />
                  <span>{activeSpot.time}</span>
                </div>
              </div>

              {/* Title & Category Badge */}
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-[#ecece4] text-[#5A5A40] uppercase tracking-wider mb-1 border border-[#d1d1ca]">
                      {t(`category.${activeSpot.category}`, activeSpot.category.toUpperCase())}
                    </span>
                    <h3 className="font-serif italic text-xl sm:text-2xl font-bold text-[#2c2c24] leading-tight">
                      <TranslatedText text={activeSpot.name} />
                    </h3>
                  </div>

                  {/* Visited Checkbox Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleVisited(activeSpot)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-serif italic transition-all shrink-0 border ${
                      isActivityVisited(activeSpot.name)
                        ? "bg-emerald-700 text-white border-emerald-800 shadow-xs"
                        : "bg-[#f5f5f0] text-[#5a5a4c] hover:bg-emerald-50 border-[#d1d1ca]"
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isActivityVisited(activeSpot.name) ? t("companion.visitedExclamation", "Visited!") : t("companion.markVisited", "Mark Visited")}</span>
                  </button>
                </div>

                <p className="text-xs sm:text-sm text-[#5a5a4c] leading-relaxed">
                  <TranslatedText text={activeSpot.description} />
                </p>
              </div>

              {/* Insider Advice Box */}
              {activeSpot.insiderTip && (
                <div className="bg-[#fafaf8] border border-[#e5e5df] rounded-2xl p-3.5 space-y-1">
                  <div className="flex items-center space-x-1.5 text-xs font-serif italic font-bold text-[#2c2c24]">
                    <Sparkles className="w-4 h-4 text-[#5A5A40]" />
                    <span>{t("companion.insiderTipTitle", "On-The-Go Insider Tip")}</span>
                  </div>
                  <p className="text-xs text-[#5a5a4c] italic">
                    "<TranslatedText text={activeSpot.insiderTip} />"
                  </p>
                </div>
              )}

              {/* Quick Actions Toolbar */}
              <div className="pt-2 border-t border-[#e5e5df] flex flex-wrap items-center gap-2">
                {/* 1-Tap Google Maps Directions */}
                <a
                  href={activeSpotMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 min-w-[140px] px-4 py-2.5 bg-[#5A5A40] hover:bg-[#40402e] text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-all shadow-xs"
                >
                  <Navigation className="w-4 h-4 text-white" />
                  <span>{t("companion.navigateMaps", "Navigate in Maps")}</span>
                  <ExternalLink className="w-3 h-3 text-white/70" />
                </a>

                {/* 1-Click Rainy Day / Indoor Swap */}
                <button
                  type="button"
                  disabled={isSwappingIndoor === activeSpot.id}
                  onClick={() => handleIndoorSwap(activeSpot)}
                  className="px-3.5 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-300 rounded-xl text-xs font-serif italic font-semibold flex items-center space-x-1.5 transition-all shrink-0 disabled:opacity-50"
                  title={t("companion.rainySwapTitle", "Replace with an indoor covered spot due to rain or bad weather")}
                >
                  {isSwappingIndoor === activeSpot.id ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-sky-700" />
                  ) : (
                    <CloudRain className="w-4 h-4 text-sky-700" />
                  )}
                  <span>{t("companion.rainySwap", "Rainy Swap")}</span>
                </button>

                {/* Schedule Buffer (+15 Min Shift) */}
                <button
                  type="button"
                  onClick={() => handleAddScheduleBuffer(15)}
                  className="px-3.5 py-2.5 bg-[#f5f5f0] hover:bg-[#ecece4] text-[#2c2c24] border border-[#d1d1ca] rounded-xl text-xs font-serif italic font-semibold flex items-center space-x-1.5 transition-all shrink-0"
                  title={t("companion.delayBufferTitle", "Running late? Add a 15-minute buffer to shift subsequent spots")}
                >
                  <Clock className="w-4 h-4 text-[#5A5A40]" />
                  <span>{t("companion.delayBuffer", "+15m Delay")}</span>
                </button>

                {/* Full Details Modal Toggle */}
                <button
                  type="button"
                  onClick={() => onOpenSpotDetail(activeSpot)}
                  className="px-3.5 py-2.5 bg-[#f5f5f0] hover:bg-[#ecece4] text-[#5a5a4c] border border-[#d1d1ca] rounded-xl text-xs font-serif italic font-semibold flex items-center space-x-1.5 transition-all shrink-0"
                >
                  <span>{t("companion.details", "Details")}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Transit & Walking Connector to Next Destination */}
              {nextSpot && (
                <div className="bg-[#f5f5f0] border border-[#d1d1ca] rounded-2xl p-3.5 flex items-center justify-between text-xs text-[#2c2c24] mt-3">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-xl bg-white border border-[#d1d1ca] flex items-center justify-center shrink-0">
                      {transitToNext?.mode === "walk" ? (
                        <Footprints className="w-4 h-4 text-[#5A5A40]" />
                      ) : (
                        <Bus className="w-4 h-4 text-[#5A5A40]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-serif italic font-bold text-xs truncate">
                        {t("companion.next", "Next")}: <TranslatedText text={nextSpot.name} />
                      </div>
                      <div className="text-[11px] text-[#6b6b5e] font-sans truncate">
                        {transitToNext?.duration || "10-15 mins"} ({transitToNext?.distance || "650m"}) • <TranslatedText text={transitToNext?.instructions || "Head towards destination"} />
                      </div>
                    </div>
                  </div>

                  <a
                    href={transitToNext?.googleMapsDirectionsUrl || activeSpotMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1.5 bg-white hover:bg-[#ecece4] text-[#5A5A40] border border-[#d1d1ca] rounded-xl text-[11px] font-serif italic font-bold shrink-0 transition-all flex items-center space-x-1 ml-2"
                  >
                    <span>{t("companion.route", "Route")}</span>
                    <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-8 border border-[#e5e5df] text-center text-[#8a8a7e]">
              {t("companion.noActivities", "No activities scheduled for this day.")}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Interactive Live Map & On-the-Go Toolkit (5 cols on PC) */}
        <div className={`space-y-6 lg:col-span-5 ${showMobileMap ? "block" : "hidden lg:block"}`}>
          {/* A. INTERACTIVE DAY ROUTE MAP */}
          <div className="bg-white rounded-3xl p-4 border border-[#e5e5df] shadow-sm space-y-3 sticky top-20">
            <div className="flex items-center justify-between px-1 pt-1">
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-[#5A5A40]" />
                <h4 className="font-serif italic font-bold text-sm text-[#2c2c24]">
                  {t("companion.liveRouteMap", "Live Route Map")} — {t("action.day", "Day")} {activeDayNum}
                </h4>
              </div>
              <span className="text-[10px] text-[#8a8a7e] font-serif italic">
                {activities.length} {t("companion.pins", "Pins")}
              </span>
            </div>

            <div className="rounded-2xl overflow-hidden border border-[#e5e5df] shadow-inner h-[360px] relative">
              <InteractiveMap
                plan={plan}
                activeDayNumber={activeDayNum}
                selectedSpotId={activeSpot?.id || null}
                onSelectSpot={(spot) => setSelectedSpotId(spot.id)}
              />
            </div>

            {/* B. ON-THE-GO QUICK TOOLKIT */}
            <div className="space-y-3 pt-2">
              {/* Hotel / Accommodation Details */}
              {plan.accommodation && (
                <div className="bg-[#fafaf8] border border-[#e5e5df] rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-serif italic font-bold text-[#2c2c24]">
                    <div className="flex items-center space-x-2">
                      <Hotel className="w-4 h-4 text-[#5A5A40]" />
                      <span>{t("companion.hotelStay", "Hotel & Stay Base")}</span>
                    </div>
                    {plan.accommodation.checkOutDay && (
                      <span className="text-[10px] text-[#8a8a7e] font-sans font-normal">
                        {t("companion.checkout", "Out")}: {t("action.day", "Day")} {plan.accommodation.checkOutDay} ({plan.accommodation.checkOutHour || "11:00"})
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#5a5a4c] font-medium">
                    {plan.accommodation.name}
                  </div>
                  {plan.accommodation.location && (
                    <div className="text-[11px] text-[#8a8a7e] line-clamp-1">
                      📍 {plan.accommodation.location}
                    </div>
                  )}
                  {plan.accommodation.notes && (
                    <div className="text-[11px] bg-white p-2 rounded-xl border border-[#e5e5df] text-[#2c2c24]">
                      🔑 {plan.accommodation.notes}
                    </div>
                  )}
                </div>
              )}

              {/* Quick Travel Wallet Access */}
              {onOpenWallet && (
                <button
                  type="button"
                  onClick={onOpenWallet}
                  className="w-full p-3.5 bg-white hover:bg-[#fafaf8] border border-[#e5e5df] hover:border-[#5A5A40] rounded-2xl text-left transition-all flex items-center justify-between group shadow-2xs"
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#f5f5f0] text-[#5A5A40] flex items-center justify-center shrink-0 border border-[#d1d1ca]">
                      <Key className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="font-serif italic text-xs font-bold text-[#2c2c24] group-hover:text-[#5A5A40]">
                        {t("companion.walletAccess", "Travel Wallet & Booking Passes")}
                      </h5>
                      <p className="text-[10px] text-[#8a8a7e] font-sans">
                        {t("companion.walletAccessDesc", "Boarding passes, confirmation codes & vouchers")}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#8a8a7e] group-hover:text-[#5A5A40]" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
