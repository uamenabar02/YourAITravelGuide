import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import {
  Bookmark,
  History,
  MapPin,
  Plane,
  Share2,
  Utensils,
  ChefHat,
  Globe,
  CheckCircle,
  RefreshCw,
  WifiOff,
  User,
  Cloud,
  ChevronDown,
  Check,
  Sparkles,
} from "lucide-react";
import { AppMode } from "../types";
import {
  useLanguage,
  Language,
  PRIMARY_LANGUAGES,
  WORLD_LANGUAGES,
  ALL_LANGUAGES,
} from "../context/LanguageContext";
import { perfCache, SyncStatusState } from "../utils/performanceCache";
import { useAuth } from "../context/AuthContext";

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
  onOpenProfile?: () => void;
  hasActiveTrip: boolean;
  isExploreOpen: boolean;
  onOpenExplore: () => void;
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
  onOpenProfile,
  hasActiveTrip,
  isExploreOpen,
  onOpenExplore,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const { activeEmail, syncStatus: cloudSyncStatus, lastSyncTime, syncUserDataWithCloud, logout } = useAuth();
  const [syncStatus, setSyncStatus] = useState<SyncStatusState>(perfCache.getStatus());
  const [showLangMenu, setShowLangMenu] = useState<boolean>(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = perfCache.subscribeSync((status) => {
      setSyncStatus(status);
    });
    return unsubscribe;
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setShowLangMenu(false);
      }
    };
    if (showLangMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showLangMenu]);

  const currentLangObj = ALL_LANGUAGES.find((l) => l.code === language) || PRIMARY_LANGUAGES[0];
  const isWorldLangActive = WORLD_LANGUAGES.some((l) => l.code === language);

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#e5e5df] shadow-xs no-print">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-18">
          {/* Logo and Brand */}
          <div
            className="flex items-center space-x-2.5 sm:space-x-3 cursor-pointer select-none shrink-0 md:flex-initial"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#5A5A40] flex items-center justify-center text-white font-serif italic text-lg sm:text-xl shadow-xs shrink-0">
              L
            </div>
            <div className="min-w-0">
              <span className="font-serif text-base sm:text-lg lg:text-2xl font-semibold tracking-tight italic text-[#2c2c24] truncate block">
                {t("nav.brand", "LocalExplorer AI")}
              </span>
              <p className="text-[10px] text-[#8a8a7e] hidden xl:block font-medium uppercase tracking-wider">
                {t("nav.subtitle", "Cultural Trip Planner & Hometown Guide")}
              </p>
            </div>
          </div>

          {/* Mode Selector Center Switch (Responsive) - Hidden on Mobile */}
          <div className="hidden md:flex items-center bg-[#ecece4] p-0.5 sm:p-1 rounded-full border border-[#d1d1ca]/50 shadow-inner shrink-0 h-8 sm:h-9 relative mx-2">
            <button
              id="nav-mode-vacation"
              onClick={() => onModeChange("vacation")}
              className={`relative flex items-center space-x-1 sm:space-x-1.5 px-2.5 lg:px-4 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium transition-colors duration-200 whitespace-nowrap h-6.5 sm:h-7.5 cursor-pointer z-10 ${
                activeMode === "vacation"
                  ? "text-[#2c2c24] font-semibold"
                  : "text-[#5A5A40] hover:text-[#2c2c24]"
              }`}
            >
              {activeMode === "vacation" && (
                <motion.span
                  layoutId="activeModeBubble"
                  className="absolute inset-0 bg-white rounded-full -z-10 shadow-xs"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <Plane className={`w-3.5 h-3.5 shrink-0 ${activeMode === "vacation" ? "text-[#5A5A40]" : ""}`} />
              <span className="whitespace-nowrap hidden lg:inline">{t("nav.vacation", "Vacation Mode")}</span>
              <span className="whitespace-nowrap inline lg:hidden">{t("nav.vacationShort", "Vacation")}</span>
            </button>
            <button
              id="nav-mode-hometown"
              onClick={() => onModeChange("hometown")}
              className={`relative flex items-center space-x-1 sm:space-x-1.5 px-2.5 lg:px-4 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium transition-colors duration-200 whitespace-nowrap h-6.5 sm:h-7.5 cursor-pointer z-10 ${
                activeMode === "hometown"
                  ? "text-[#2c2c24] font-semibold"
                  : "text-[#5A5A40] hover:text-[#2c2c24]"
              }`}
            >
              {activeMode === "hometown" && (
                <motion.span
                  layoutId="activeModeBubble"
                  className="absolute inset-0 bg-white rounded-full -z-10 shadow-xs"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <MapPin className={`w-3.5 h-3.5 shrink-0 ${activeMode === "hometown" ? "text-[#5A5A40]" : ""}`} />
              <span className="whitespace-nowrap hidden lg:inline">{t("nav.hometown", "Hometown Mode")}</span>
              <span className="whitespace-nowrap inline lg:hidden">{t("nav.hometownShort", "Hometown")}</span>
            </button>
          </div>

          {/* Right Action Icons & Language Toggle */}
          <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
            {/* Language Selector (EN | ES | EU + World Languages Dropdown) */}
            <div className="relative hidden md:flex items-center" ref={langMenuRef}>
              <div className="flex items-center bg-[#f5f5f0] p-0.5 rounded-xl border border-[#d1d1ca] text-[11px] font-sans shrink-0">
                {PRIMARY_LANGUAGES.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => setLanguage(item.code)}
                    className={`hidden xl:block px-2 py-0.5 sm:py-1 rounded-lg uppercase tracking-wider font-semibold transition-all whitespace-nowrap text-[10px] sm:text-[11px] cursor-pointer ${
                      language === item.code
                        ? "bg-[#5A5A40] text-white shadow-2xs"
                        : "text-[#6b6b5e] hover:text-[#2c2c24]"
                    }`}
                    title={`${item.nativeName} (${item.name})`}
                  >
                    {item.code}
                  </button>
                ))}

                {/* World Languages Dropdown Button */}
                <button
                  type="button"
                  onClick={() => setShowLangMenu((prev) => !prev)}
                  className={`px-2 py-0.5 sm:py-1 rounded-lg font-semibold transition-all whitespace-nowrap text-[10px] sm:text-[11px] flex items-center gap-1 cursor-pointer ${
                    isWorldLangActive
                      ? "bg-[#5A5A40] text-white shadow-2xs font-bold"
                      : "text-[#6b6b5e] hover:text-[#2c2c24] hover:bg-black/5"
                  }`}
                  title="More World Languages"
                >
                  <span>{isWorldLangActive ? currentLangObj.flag : "🌐"}</span>
                  {isWorldLangActive && <span className="uppercase text-[10px] hidden xl:inline">{language}</span>}
                  <ChevronDown className="w-2.5 h-2.5 opacity-70" />
                </button>
              </div>

              {/* Language Dropdown Menu */}
              {showLangMenu && (
                <div className="absolute right-0 top-full mt-2 w-60 p-2 bg-[#2c2c24] text-white border border-white/20 rounded-2xl shadow-2xl z-50 animate-fadeIn">
                  <div className="px-2.5 py-1 text-[10px] font-bold text-white/50 uppercase tracking-wider">
                    Primary Languages
                  </div>
                  <div className="space-y-0.5">
                    {PRIMARY_LANGUAGES.map((l) => (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => {
                          setLanguage(l.code);
                          setShowLangMenu(false);
                        }}
                        className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-colors ${
                          language === l.code
                            ? "bg-[#5A5A40] text-white font-bold"
                            : "hover:bg-white/10 text-white/90"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span>{l.flag}</span>
                          <span>{l.nativeName}</span>
                          <span className="text-[10px] opacity-60">({l.name})</span>
                        </span>
                        {language === l.code && <Check className="w-3.5 h-3.5 text-amber-300" />}
                      </button>
                    ))}
                  </div>

                  <div className="my-1.5 border-t border-white/10"></div>

                  <div className="px-2.5 py-1 text-[10px] font-bold text-white/50 uppercase tracking-wider">
                    World Main Languages
                  </div>
                  <div className="space-y-0.5 max-h-44 overflow-y-auto pr-1">
                    {WORLD_LANGUAGES.map((l) => (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => {
                          setLanguage(l.code);
                          setShowLangMenu(false);
                        }}
                        className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-colors ${
                          language === l.code
                            ? "bg-[#5A5A40] text-white font-bold"
                            : "hover:bg-white/10 text-white/90"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span>{l.flag}</span>
                          <span>{l.nativeName}</span>
                          <span className="text-[10px] opacity-60">({l.name})</span>
                        </span>
                        {language === l.code && <Check className="w-3.5 h-3.5 text-amber-300" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Taste Profile */}
            {onOpenTasteProfile && (
              <button
                id="btn-taste-profile"
                onClick={onOpenTasteProfile}
                title={t("nav.tasteProfile", "Taste Profile")}
                className="hidden md:inline-flex relative p-2 rounded-full text-[#5A5A40] hover:text-[#2c2c24] hover:bg-[#ecece4] border border-[#d1d1ca]/60 transition-colors shrink-0 cursor-pointer"
              >
                <ChefHat className="w-4 h-4" />
                {hasTasteProfile && (
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border border-white" />
                )}
              </button>
            )}

            {/* My Places */}
            {onOpenMySpots && (
              <button
                id="btn-my-spots"
                onClick={onOpenMySpots}
                title={t("nav.mySpots", "My Places")}
                className="hidden md:inline-flex relative p-2 rounded-full text-[#5A5A40] hover:text-[#2c2c24] hover:bg-[#ecece4] border border-[#d1d1ca]/60 transition-colors shrink-0 cursor-pointer"
              >
                <Utensils className="w-4 h-4" />
                {mySpotsCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#5A5A40] text-[10px] font-bold text-white">
                    {mySpotsCount > 9 ? "9+" : mySpotsCount}
                  </span>
                )}
              </button>
            )}

            {/* 30-Day History */}
            <button
              id="btn-history-modal"
              onClick={onOpenHistory}
              title={t("nav.history", "History")}
              className="hidden md:inline-flex relative p-2 rounded-full text-[#5A5A40] hover:text-[#2c2c24] hover:bg-[#ecece4] border border-[#d1d1ca]/60 transition-colors shrink-0 cursor-pointer"
            >
              <History className="w-4 h-4" />
              {historyCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#5A5A40] text-[10px] font-bold text-white">
                  {historyCount > 9 ? "9+" : historyCount}
                </span>
              )}
            </button>

            {/* Community Explore Trigger */}
            <button
              id="btn-explore-community"
              onClick={onOpenExplore}
              title={t("nav.explore", "Explore Community Feed")}
              className={`hidden md:flex relative items-center justify-center p-2 lg:px-3 lg:py-1.5 rounded-full font-medium text-xs sm:text-sm transition-all border whitespace-nowrap shrink-0 cursor-pointer ${
                isExploreOpen
                  ? "bg-[#5A5A40] text-white border-[#5A5A40] shadow-xs"
                  : "text-[#2c2c24] border-[#d1d1ca] hover:bg-[#ecece4]"
              }`}
            >
              <Sparkles className={`w-4 h-4 shrink-0 ${isExploreOpen ? "text-amber-300 animate-pulse" : "text-[#5A5A40]"}`} />
              <span className="font-sans hidden lg:inline ml-1.5">{t("nav.explore", "Explore")}</span>
            </button>

            {/* Saved Trips Drawer Trigger */}
            <button
              id="btn-saved-trips"
              onClick={onOpenSavedTrips}
              title={t("nav.savedTrips", "Saved Trips")}
              className="hidden md:flex relative items-center justify-center p-2 lg:px-3 lg:py-1.5 rounded-full text-[#2c2c24] hover:bg-[#ecece4] font-medium text-xs sm:text-sm transition-colors border border-[#d1d1ca] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Bookmark className="w-4 h-4 text-[#5A5A40] shrink-0" />
              <span className="font-sans hidden lg:inline ml-1.5">{t("nav.savedTrips", "Saved Trips")}</span>
              {savedTripsCount > 0 && (
                <span className="absolute -top-1 -right-1 lg:static flex h-4 min-w-4 items-center justify-center rounded-full bg-[#5A5A40] px-1 text-[10px] font-bold text-white lg:ml-1.5">
                  {savedTripsCount}
                </span>
              )}
            </button>

            {/* User Profile Trigger */}
            {onOpenProfile && (
              <button
                id="btn-profile-nav"
                onClick={onOpenProfile}
                title={t("profile.title", "User Profile & Preferences")}
                className="hidden md:flex relative p-1.5 sm:p-2 rounded-full text-[#5A5A40] hover:text-[#2c2c24] hover:bg-[#ecece4] border border-[#d1d1ca]/80 transition-colors shrink-0 items-center justify-center cursor-pointer"
              >
                <User className="w-4 h-4" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
