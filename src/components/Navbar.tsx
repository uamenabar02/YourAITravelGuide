import React from "react";
import { Compass, Sparkles, Bookmark, History, MapPin, Plane, Share2, Sun } from "lucide-react";
import { AppMode } from "../types";

interface NavbarProps {
  activeMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  savedTripsCount: number;
  onOpenSavedTrips: () => void;
  historyCount: number;
  onOpenHistory: () => void;
  onOpenExport?: () => void;
  hasActiveTrip: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeMode,
  onModeChange,
  savedTripsCount,
  onOpenSavedTrips,
  historyCount,
  onOpenHistory,
  onOpenExport,
  hasActiveTrip,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#e5e5df] shadow-xs no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-9 h-9 rounded-xl bg-[#5A5A40] flex items-center justify-center text-white font-serif italic text-xl shadow-xs">
              L
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-serif text-xl sm:text-2xl font-semibold tracking-tight italic text-[#2c2c24]">
                  LocalExplorer AI
                </span>
              </div>
              <p className="text-[11px] text-[#8a8a7e] hidden sm:block font-medium uppercase tracking-wider">
                Cultural Trip Planner & Hometown Guide
              </p>
            </div>
          </div>

          {/* Mode Selector Center Switch */}
          <div className="flex items-center bg-[#ecece4] p-1 rounded-full border border-[#d1d1ca]/50 shadow-inner">
            <button
              id="nav-mode-vacation"
              onClick={() => onModeChange("vacation")}
              className={`flex items-center space-x-1.5 px-4 sm:px-5 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 ${
                activeMode === "vacation"
                  ? "bg-white text-[#2c2c24] shadow-xs font-semibold"
                  : "text-[#5A5A40] hover:text-[#2c2c24]"
              }`}
            >
              <Plane className={`w-3.5 h-3.5 ${activeMode === "vacation" ? "text-[#5A5A40]" : ""}`} />
              <span>Vacation Mode</span>
            </button>
            <button
              id="nav-mode-hometown"
              onClick={() => onModeChange("hometown")}
              className={`flex items-center space-x-1.5 px-4 sm:px-5 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 ${
                activeMode === "hometown"
                  ? "bg-white text-[#2c2c24] shadow-xs font-semibold"
                  : "text-[#5A5A40] hover:text-[#2c2c24]"
              }`}
            >
              <MapPin className={`w-3.5 h-3.5 ${activeMode === "hometown" ? "text-[#5A5A40]" : ""}`} />
              <span>Hometown Mode</span>
            </button>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center space-x-2">
            {/* 30-Day History / Deduplication Button */}
            <button
              id="btn-history-modal"
              onClick={onOpenHistory}
              title="30-day activity deduplication history"
              className="relative p-2 rounded-full text-[#5A5A40] hover:text-[#2c2c24] hover:bg-[#ecece4] border border-[#d1d1ca]/60 transition-colors"
            >
              <History className="w-4 h-4" />
              {historyCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#5A5A40] text-[10px] font-bold text-white">
                  {historyCount > 9 ? "9+" : historyCount}
                </span>
              )}
            </button>

            {/* Saved Trips Drawer Trigger */}
            <button
              id="btn-saved-trips"
              onClick={onOpenSavedTrips}
              title="Saved itineraries"
              className="relative flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-[#2c2c24] hover:bg-[#ecece4] font-medium text-xs sm:text-sm transition-colors border border-[#d1d1ca]"
            >
              <Bookmark className="w-4 h-4 text-[#5A5A40]" />
              <span className="hidden md:inline font-sans">Saved Trips</span>
              {savedTripsCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#5A5A40] px-1 text-[10px] font-bold text-white">
                  {savedTripsCount}
                </span>
              )}
            </button>

            {/* Share / Export button if trip exists */}
            {hasActiveTrip && onOpenExport && (
              <button
                id="btn-export-nav"
                onClick={onOpenExport}
                className="hidden sm:flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-[#5A5A40] text-white hover:bg-[#4a4a35] text-xs sm:text-sm font-medium transition-all shadow-xs"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Export / Share</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
