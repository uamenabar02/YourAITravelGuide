import React, { useState } from "react";
import { ItineraryPlan, ActivitySpot } from "../types";
import {
  Compass,
  MapPin,
  Navigation,
  CloudRain,
  ChevronUp,
  ChevronDown,
  X,
  Loader2,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { getRouteInfoBetweenSpots } from "../utils/transit";

interface LiveNavigatorBarProps {
  plan: ItineraryPlan;
  activeDayNumber: number | "all";
  onSelectSpot: (spot: ActivitySpot) => void;
  onSwapForIndoor: (activity: ActivitySpot, dayNumber: number) => Promise<void>;
  destinationOrTown: string;
}

export const LiveNavigatorBar: React.FC<LiveNavigatorBarProps> = ({
  plan,
  activeDayNumber,
  onSelectSpot,
  onSwapForIndoor,
  destinationOrTown,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDayNum, setSelectedDayNum] = useState<number>(() => {
    if (typeof activeDayNumber === "number") return activeDayNumber;
    return plan.days[0]?.dayNumber || 1;
  });
  const [swappingSpotId, setSwappingSpotId] = useState<string | null>(null);

  // Synchronize when activeDayNumber prop changes
  React.useEffect(() => {
    if (typeof activeDayNumber === "number") {
      setSelectedDayNum(activeDayNumber);
    }
  }, [activeDayNumber]);

  const currentDay = plan.days.find((d) => d.dayNumber === selectedDayNum) || plan.days[0];
  const activities = currentDay?.activities || [];

  const handleIndoorSwap = async (spot: ActivitySpot) => {
    setSwappingSpotId(spot.id);
    try {
      await onSwapForIndoor(spot, selectedDayNum);
    } finally {
      setSwappingSpotId(null);
    }
  };

  return (
    <div className="hidden md:flex fixed bottom-5 right-5 z-40 no-print flex-col items-end">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group flex items-center space-x-2.5 px-4 py-3 bg-[#2c2c24] text-white rounded-full shadow-xl hover:bg-[#5A5A40] transition-all transform hover:scale-105 border border-[#4a4a3c]"
        >
          <div className="w-7 h-7 rounded-full bg-[#5A5A40] group-hover:bg-[#2c2c24] flex items-center justify-center shrink-0 border border-white/20">
            <Compass className="w-4 h-4 text-white animate-spin-slow" />
          </div>
          <div className="text-left font-serif italic text-xs leading-tight">
            <span className="block font-semibold">Pocket Navigator</span>
            <span className="text-[10px] text-[#d1d1ca] font-sans not-italic">
              Routes & Rainy Swap
            </span>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
        </button>
      )}

      {/* Pocket Navigator Drawer / Sheet */}
      {isOpen && (
        <div className="w-full max-w-sm sm:max-w-md bg-white border border-[#e5e5df] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] transition-all duration-300">
          {/* Header */}
          <div className="p-4 bg-[#2c2c24] text-white flex items-center justify-between border-b border-[#4a4a3c]">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#5A5A40] flex items-center justify-center shrink-0">
                <Compass className="w-4 h-4 text-white" />
              </div>
              <div>
                <h4 className="font-serif italic text-sm font-semibold">
                  Pocket Guide Navigator
                </h4>
                <p className="text-[11px] text-[#d1d1ca] font-sans">
                  {destinationOrTown} • Transit & Covered Swaps
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Day Selector Tabs */}
          <div className="flex items-center space-x-1.5 p-2 bg-[#f5f5f0] border-b border-[#e5e5df] overflow-x-auto no-scrollbar">
            {plan.days.map((d) => (
              <button
                key={d.dayNumber}
                type="button"
                onClick={() => setSelectedDayNum(d.dayNumber)}
                className={`px-3 py-1.5 rounded-xl text-xs font-serif italic whitespace-nowrap transition-colors ${
                  selectedDayNum === d.dayNumber
                    ? "bg-[#5A5A40] text-white font-semibold shadow-xs"
                    : "bg-white text-[#6b6b5e] hover:bg-[#ecece4] border border-[#d1d1ca]"
                }`}
              >
                Day {d.dayNumber}
              </button>
            ))}
          </div>

          {/* Activity Timeline & Transit Navigator */}
          <div className="p-4 overflow-y-auto space-y-3 font-sans text-xs flex-1">
            {activities.length === 0 ? (
              <p className="text-center py-6 text-[#8a8a7e] font-serif italic">
                No activities scheduled for Day {selectedDayNum}.
              </p>
            ) : (
              activities.map((spot, idx) => {
                const nextSpot = activities[idx + 1];
                const routeInfo = nextSpot
                  ? getRouteInfoBetweenSpots(spot, nextSpot, destinationOrTown)
                  : null;
                const isCurrentlySwapping = swappingSpotId === spot.id;

                return (
                  <div key={spot.id || idx} className="space-y-2">
                    {/* Spot Card */}
                    <div
                      onClick={() => onSelectSpot(spot)}
                      className="p-3.5 bg-white border border-[#e5e5df] rounded-2xl hover:border-[#5A5A40] transition-colors cursor-pointer group shadow-2xs"
                    >
                      <div className="flex items-start justify-between space-x-2">
                        <div className="flex items-start space-x-2.5 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-[#ecece4] text-[#5A5A40] flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="text-[10px] text-[#8a8a7e] font-serif italic font-semibold">
                              {spot.time}
                            </div>
                            <h5 className="font-medium text-[#2c2c24] text-xs group-hover:text-[#5A5A40] transition-colors truncate">
                              {spot.name}
                            </h5>
                          </div>
                        </div>

                        {/* Rainy Day / Indoor Spot Swap Button */}
                        <button
                          type="button"
                          disabled={isCurrentlySwapping}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleIndoorSwap(spot);
                          }}
                          className="flex items-center space-x-1 px-2.5 py-1 bg-[#ecece4] hover:bg-sky-100 text-[#5A5A40] hover:text-sky-800 rounded-xl border border-[#d1d1ca] hover:border-sky-300 transition-colors shrink-0 text-[10px] font-serif italic"
                          title="Swap for a cozy indoor or covered spot (Rainy Day Swap)"
                        >
                          {isCurrentlySwapping ? (
                            <Loader2 className="w-3 h-3 animate-spin text-sky-600" />
                          ) : (
                            <CloudRain className="w-3 h-3 text-sky-600" />
                          )}
                          <span>{isCurrentlySwapping ? "Finding Covered Spot..." : "Indoor Swap"}</span>
                        </button>
                      </div>

                      <p className="text-[11px] text-[#6b6b5e] line-clamp-1 mt-1.5 pl-8">
                        {spot.description}
                      </p>
                    </div>

                    {/* Transit Connector to Next Spot */}
                    {nextSpot && routeInfo && (
                      <div className="mx-3 my-1 px-3 py-1.5 bg-[#f5f5f0] border border-[#d1d1ca] rounded-xl flex items-center justify-between text-[11px] text-[#6b6b5e]">
                        <div className="flex items-center space-x-2 min-w-0">
                          <span className="shrink-0 text-sm">
                            {routeInfo.mode === "walk"
                              ? "🚶‍♂️"
                              : routeInfo.mode === "transit"
                              ? "🚌"
                              : "🚕"}
                          </span>
                          <span className="font-serif italic font-semibold text-[#2c2c24] truncate">
                            {routeInfo.duration} ({routeInfo.distance})
                          </span>
                        </div>

                        <a
                          href={routeInfo.googleMapsDirectionsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center space-x-1 px-2 py-0.5 bg-white text-[#5A5A40] hover:text-[#2c2c24] rounded-lg border border-[#d1d1ca] hover:border-[#5A5A40] text-[10px] font-serif italic shrink-0 transition-colors"
                        >
                          <Navigation className="w-3 h-3 text-[#5A5A40]" />
                          <span>Navigate</span>
                        </a>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer note */}
          <div className="p-2.5 bg-[#f5f5f0] border-t border-[#e5e5df] text-[10px] text-center text-[#8a8a7e] font-serif italic">
            ☔ Tap "Indoor Swap" anytime to replace an outdoor sight with a covered alternative.
          </div>
        </div>
      )}
    </div>
  );
};
