import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Zap,
  X,
  Footprints,
  Bus,
  Car,
  Bike,
  Sparkles,
  Lock,
  Unlock,
  ArrowRight,
  CheckCircle2,
  Clock,
  Compass,
  MapPin,
  TrendingDown,
  Navigation,
  Utensils,
  Sun,
  Moon,
  Info
} from "lucide-react";
import { ActivitySpot, TransportMode } from "../types";
import { optimizeDayRoute, RouteOptimizationOptions, OptimizedRouteResult } from "../utils/routeOptimizer";
import { TranslatedText } from "./TranslatedText";

interface RouteOptimizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  dayNumber: number;
  activities: ActivitySpot[];
  initialTransportMode?: TransportMode;
  onApplyOptimizedRoute: (newActivities: ActivitySpot[]) => void;
}

export const RouteOptimizerModal: React.FC<RouteOptimizerModalProps> = ({
  isOpen,
  onClose,
  dayNumber,
  activities,
  initialTransportMode = "public_transit",
  onApplyOptimizedRoute,
}) => {
  const [transportMode, setTransportMode] = useState<TransportMode | 'walking' | 'auto'>(
    initialTransportMode || "public_transit"
  );
  const [lockStart, setLockStart] = useState<boolean>(true);
  const [lockEnd, setLockEnd] = useState<boolean>(false);
  const [preserveMeals, setPreserveMeals] = useState<boolean>(true);
  const [lockedIds, setLockedIds] = useState<string[]>([]);
  const [isApplied, setIsApplied] = useState<boolean>(false);

  const toggleLockActivity = (id: string) => {
    setLockedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const optimizationResult: OptimizedRouteResult = useMemo(() => {
    return optimizeDayRoute(activities, {
      transportMode,
      lockStartSpot: lockStart,
      lockEndSpot: lockEnd,
      preserveMealTimes: preserveMeals,
      lockedActivityIds: lockedIds,
    });
  }, [activities, transportMode, lockStart, lockEnd, preserveMeals, lockedIds]);

  const handleApply = () => {
    onApplyOptimizedRoute(optimizationResult.orderedActivities);
    setIsApplied(true);
    setTimeout(() => {
      setIsApplied(false);
      onClose();
    }, 600);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-stone-900/60 backdrop-blur-xs overflow-y-auto no-print">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="bg-[#5A5A40] text-white p-5 sm:p-6 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center text-amber-300 shadow-inner">
                <Zap className="w-6 h-6 fill-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-wider font-bold bg-white/20 px-2.5 py-0.5 rounded-full text-stone-200">
                    <TranslatedText text="Day" /> {dayNumber}
                  </span>
                  <span className="text-xs text-stone-300 font-medium flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <TranslatedText text="Smart Logistics & Excursion Engine" />
                  </span>
                </div>
                <h3 className="font-serif font-bold text-xl text-stone-100 mt-0.5">
                  <TranslatedText text="Route & Transit Optimizer" />
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1 bg-stone-50/50">
            {/* Mode Selector & Anchor Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Transport Mode Choice */}
              <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-3xs">
                <label className="text-xs font-bold text-stone-600 uppercase tracking-wider block mb-2.5">
                  <TranslatedText text="Primary Transport Mode" />
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: "walking", label: "Walk", icon: Footprints },
                    { id: "public_transit", label: "Transit", icon: Bus },
                    { id: "car", label: "Car/Taxi", icon: Car },
                    { id: "bicycle", label: "Bicycle", icon: Bike },
                  ].map((mode) => {
                    const Icon = mode.icon;
                    const isSelected = transportMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setTransportMode(mode.id as any)}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? "bg-[#5A5A40] text-white border-[#5A5A40] shadow-xs"
                            : "bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200"
                        }`}
                      >
                        <Icon className="w-4 h-4 mb-1" />
                        <span><TranslatedText text={mode.label} /></span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Constraints & Anchors */}
              <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-3xs space-y-2.5">
                <label className="text-xs font-bold text-stone-600 uppercase tracking-wider block">
                  <TranslatedText text="Smart Constraints & Anchors" />
                </label>
                <div className="space-y-2 text-xs">
                  <label className="flex items-center gap-2.5 text-stone-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={lockStart}
                      onChange={(e) => setLockStart(e.target.checked)}
                      className="w-4 h-4 rounded text-[#5A5A40] focus:ring-[#5A5A40]"
                    />
                    <span className="font-medium"><TranslatedText text="Keep 1st spot as starting base (hotel/coffee)" /></span>
                  </label>
                  <label className="flex items-center gap-2.5 text-stone-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={preserveMeals}
                      onChange={(e) => setPreserveMeals(e.target.checked)}
                      className="w-4 h-4 rounded text-[#5A5A40] focus:ring-[#5A5A40]"
                    />
                    <span className="font-medium"><TranslatedText text="Preserve meal times (don't shift lunch to 9 AM)" /></span>
                  </label>
                  <label className="flex items-center gap-2.5 text-stone-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={lockEnd}
                      onChange={(e) => setLockEnd(e.target.checked)}
                      className="w-4 h-4 rounded text-[#5A5A40] focus:ring-[#5A5A40]"
                    />
                    <span className="font-medium"><TranslatedText text="Keep last spot fixed (night destination)" /></span>
                  </label>
                </div>
              </div>
            </div>

            {/* Savings & Efficiency Metric Bar */}
            <div className="bg-gradient-to-r from-[#5A5A40]/10 via-amber-50 to-emerald-50/50 p-4 sm:p-5 rounded-2xl border border-[#5A5A40]/20 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#5A5A40] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <TrendingDown className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <div className="text-xs text-stone-500 font-medium">
                    <TranslatedText text="Efficiency Optimization" />
                  </div>
                  <div className="text-base font-bold text-stone-800 flex items-center gap-2">
                    {optimizationResult.isImproved ? (
                      <>
                        <span className="text-emerald-700 font-bold">
                          {optimizationResult.timeSavedMinutes} <TranslatedText text="min saved" />
                        </span>
                        <span className="text-stone-300">•</span>
                        <span className="text-emerald-700 font-bold">
                          {optimizationResult.distanceSavedKm} km <TranslatedText text="less backtracking" />
                        </span>
                      </>
                    ) : (
                      <span className="text-stone-700 font-semibold">
                        <TranslatedText text="Your current route is already optimal!" />
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs bg-white/80 backdrop-blur-xs px-3.5 py-2 rounded-xl border border-stone-200 shadow-3xs">
                <div className="text-right">
                  <span className="text-stone-400 block"><TranslatedText text="New Total Distance" /></span>
                  <span className="font-bold text-stone-800">{optimizationResult.optimizedDistanceKm} km</span>
                </div>
                <div className="h-6 w-px bg-stone-200"></div>
                <div className="text-left">
                  <span className="text-stone-400 block"><TranslatedText text="Est. Travel Time" /></span>
                  <span className="font-bold text-stone-800">~{optimizationResult.optimizedTravelTimeMinutes} min</span>
                </div>
              </div>
            </div>

            {/* Sequence & Activity Preview */}
            <div className="bg-white rounded-2xl border border-stone-200 shadow-3xs p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3.5">
                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Navigation className="w-4 h-4 text-[#5A5A40]" />
                  <TranslatedText text="Proposed Optimized Sequence" />
                </h4>
                <span className="text-[11px] text-stone-400 font-medium">
                  <TranslatedText text="Click lock icon to fix any spot in place" />
                </span>
              </div>

              <div className="space-y-2.5">
                {optimizationResult.orderedActivities.map((act, idx) => {
                  const isLocked = lockedIds.includes(act.id) || (idx === 0 && lockStart) || (idx === optimizationResult.orderedActivities.length - 1 && lockEnd);
                  const isMeal = act.category === "food" || act.name.toLowerCase().includes("lunch") || act.name.toLowerCase().includes("dinner");
                  const legToNext = optimizationResult.legs[idx];

                  return (
                    <div key={act.id} className="space-y-2">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200/90 hover:border-stone-300 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 h-6 rounded-full bg-[#5A5A40] text-white text-xs font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-stone-800 truncate">
                                {act.name}
                              </span>
                              {isMeal && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold shrink-0">
                                  <TranslatedText text="Meal" />
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-stone-500 flex items-center gap-2">
                              <span>{act.time}</span>
                              {act.address && (
                                <span className="truncate text-stone-400 max-w-[200px] sm:max-w-xs">
                                  • {act.address}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleLockActivity(act.id)}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              isLocked
                                ? "bg-amber-100 border-amber-300 text-amber-800"
                                : "bg-white border-stone-200 text-stone-400 hover:text-stone-600"
                            }`}
                            title={isLocked ? "Spot is locked" : "Click to lock this spot in place"}
                          >
                            {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Leg Connector */}
                      {legToNext && (
                        <div className="flex items-center gap-2 pl-6 py-0.5 text-[11px] text-stone-500 font-medium">
                          <div className="w-3.5 h-3.5 flex items-center justify-center text-[#5A5A40]">
                            {legToNext.mode === "walk" ? (
                              <Footprints className="w-3 h-3" />
                            ) : legToNext.mode === "drive" ? (
                              <Car className="w-3 h-3" />
                            ) : legToNext.mode === "bicycle" ? (
                              <Bike className="w-3 h-3" />
                            ) : (
                              <Bus className="w-3 h-3" />
                            )}
                          </div>
                          <span>
                            {legToNext.travelMinutes} min ({legToNext.distanceKm} km)
                          </span>
                          {legToNext.isExcursionLeg && (
                            <span className="text-[10px] px-2 py-0.2 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold">
                              <TranslatedText text="Excursion Leg" />
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-5 bg-white border-t border-stone-200 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              <TranslatedText text="Cancel" />
            </button>

            <button
              type="button"
              onClick={handleApply}
              disabled={isApplied}
              className="px-5 py-2.5 rounded-xl bg-[#5A5A40] hover:bg-[#4a4a34] text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isApplied ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span><TranslatedText text="Applied Successfully!" /></span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span><TranslatedText text="Apply Optimized Route" /></span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
export default RouteOptimizerModal;
