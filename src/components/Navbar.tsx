import React, { useState, useEffect } from "react";
import { Bookmark, History, MapPin, Plane, Share2, Utensils, ChefHat, Globe, CheckCircle, RefreshCw, WifiOff } from "lucide-react";
import { AppMode } from "../types";
import { useLanguage, Language } from "../context/LanguageContext";
import { perfCache, SyncStatusState } from "../utils/performanceCache";

interface NavbarProps {
  activeMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  savedTripsCount: number;
  onOpenSavedTrips: () => void;
  historyCount: number;
  onOpenHistory: () => void;
  onOpenMySpots?: () => void;
  mySpotsCount?: number;
  onOpenTasteProfile?: () => void;
  hasTasteProfile?: boolean;
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
  onOpenMySpots,
  mySpotsCount = 0,
  onOpenTasteProfile,
  hasTasteProfile = false,
  onOpenExport,
  hasActiveTrip,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const [syncStatus, setSyncStatus] = useState<SyncStatusState>(perfCache.getStatus());

  useEffect(() => {
    const unsubscribe = perfCache.subscribeSync((status) => {
      setSyncStatus(status);
    });
    return unsubscribe;
  }, []);

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
                  {t("nav.brand", "LocalExplorer AI")}
                </span>
                {/* Sync status indicator badge */}
                <div
                  className={`hidden md:flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-sans font-medium border ${
                    syncStatus === "synced"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : syncStatus === "saving"
                      ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse"
                      : syncStatus === "offline"
                      ? "bg-gray-100 text-gray-700 border-gray-300"
                      : "bg-blue-50 text-blue-700 border-blue-200"
                  }`}
                  title={
                    syncStatus === "synced"
                      ? "All trip edits and collaboration states are synced to local storage"
                      : syncStatus === "saving"
                      ? "Saving latest trip changes..."
                      : "Offline mode: changes safely cached locally"
                  }
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      syncStatus === "synced"
                        ? "bg-emerald-500"
                        : syncStatus === "saving"
                        ? "bg-amber-500"
                        : syncStatus === "offline"
                        ? "bg-gray-400"
                        : "bg-blue-500"
                    }`}
                  />
                  <span>
                    {syncStatus === "synced"
                      ? t("nav.syncReady", "Synced")
                      : syncStatus === "saving"
                      ? t("nav.saving", "Saving...")
                      : syncStatus === "offline"
                      ? t("nav.offline", "Offline")
                      : t("nav.cached", "Cached")}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-[#8a8a7e] hidden sm:block font-medium uppercase tracking-wider">
                {t("nav.subtitle", "Cultural Trip Planner & Hometown Guide")}
              </p>
            </div>
          </div>

          {/* Mode Selector Center Switch */}
          <div className="flex items-center bg-[#ecece4] p-1 rounded-full border border-[#d1d1ca]/50 shadow-inner shrink-0 h-9">
            <button
              id="nav-mode-vacation"
              onClick={() => onModeChange("vacation")}
              className={`flex items-center space-x-1.5 px-3 sm:px-4 py-1 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap h-7 sm:h-7.5 ${
                activeMode === "vacation"
                  ? "bg-white text-[#2c2c24] shadow-xs font-semibold"
                  : "text-[#5A5A40] hover:text-[#2c2c24]"
              }`}
            >
              <Plane className={`w-3.5 h-3.5 shrink-0 ${activeMode === "vacation" ? "text-[#5A5A40]" : ""}`} />
              <span className="whitespace-nowrap">{t("nav.vacation", "Vacation Mode")}</span>
            </button>
            <button
              id="nav-mode-hometown"
              onClick={() => onModeChange("hometown")}
              className={`flex items-center space-x-1.5 px-3 sm:px-4 py-1 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap h-7 sm:h-7.5 ${
                activeMode === "hometown"
                  ? "bg-white text-[#2c2c24] shadow-xs font-semibold"
                  : "text-[#5A5A40] hover:text-[#2c2c24]"
              }`}
            >
              <MapPin className={`w-3.5 h-3.5 shrink-0 ${activeMode === "hometown" ? "text-[#5A5A40]" : ""}`} />
              <span className="whitespace-nowrap">{t("nav.hometown", "Hometown Mode")}</span>
            </button>
          </div>

          {/* Right Action Icons & Language Toggle */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            {/* Language Selector (EN | ES | EU) */}
            <div className="flex items-center bg-[#f5f5f0] p-0.5 rounded-xl border border-[#d1d1ca] text-[11px] font-sans shrink-0">
              {(["en", "es", "eu"] as Language[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg uppercase tracking-wider font-semibold transition-all whitespace-nowrap text-[10px] sm:text-[11px] ${
                    language === lang
                      ? "bg-[#5A5A40] text-white shadow-2xs"
                      : "text-[#6b6b5e] hover:text-[#2c2c24]"
                  }`}
                  title={
                    lang === "en"
                      ? "English"
                      : lang === "es"
                      ? "Español (Castellano)"
                      : "Euskara (Basque)"
                  }
                >
                  {lang}
                </button>
              ))}
            </div>

            {/* Taste Profile: how the user likes to eat & drink */}
            {onOpenTasteProfile && (
              <button
                id="btn-taste-profile"
                onClick={onOpenTasteProfile}
                title={t("nav.tasteProfile", "Taste Profile")}
                className="relative p-2 rounded-full text-[#5A5A40] hover:text-[#2c2c24] hover:bg-[#ecece4] border border-[#d1d1ca]/60 transition-colors shrink-0"
              >
                <ChefHat className="w-4 h-4" />
                {hasTasteProfile && (
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border border-white" />
                )}
              </button>
            )}

            {/* My Places: user-provided bars, cafés & restaurants */}
            {onOpenMySpots && (
              <button
                id="btn-my-spots"
                onClick={onOpenMySpots}
                title={t("nav.mySpots", "My Places")}
                className="relative p-2 rounded-full text-[#5A5A40] hover:text-[#2c2c24] hover:bg-[#ecece4] border border-[#d1d1ca]/60 transition-colors shrink-0"
              >
                <Utensils className="w-4 h-4" />
                {mySpotsCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#5A5A40] text-[10px] font-bold text-white">
                    {mySpotsCount > 9 ? "9+" : mySpotsCount}
                  </span>
                )}
              </button>
            )}

            {/* 30-Day History / Deduplication Button */}
            <button
              id="btn-history-modal"
              onClick={onOpenHistory}
              title={t("nav.history", "History")}
              className="relative p-2 rounded-full text-[#5A5A40] hover:text-[#2c2c24] hover:bg-[#ecece4] border border-[#d1d1ca]/60 transition-colors shrink-0"
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
              title={t("nav.savedTrips", "Saved Trips")}
              className="relative flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-[#2c2c24] hover:bg-[#ecece4] font-medium text-xs sm:text-sm transition-colors border border-[#d1d1ca] whitespace-nowrap shrink-0"
            >
              <Bookmark className="w-4 h-4 text-[#5A5A40] shrink-0" />
              <span className="hidden md:inline font-sans">{t("nav.savedTrips", "Saved Trips")}</span>
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
                className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-[#5A5A40] text-white hover:bg-[#4a4a35] text-xs sm:text-sm font-medium transition-all shadow-xs whitespace-nowrap shrink-0"
              >
                <Share2 className="w-3.5 h-3.5 shrink-0" />
                <span>{t("action.export", "Export")}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

