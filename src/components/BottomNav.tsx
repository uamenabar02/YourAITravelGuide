import React from "react";
import {
  Compass,
  Plane,
  MapPin,
  Bookmark,
  Utensils,
  User,
  Calendar,
  Sparkles,
} from "lucide-react";
import { AppMode } from "../types";
import { useLanguage } from "../context/LanguageContext";

interface BottomNavProps {
  activeMobileTab: "form" | "itinerary";
  activeMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  onScrollToForm: () => void;
  onScrollToItinerary: () => void;
  hasActiveTrip: boolean;
  savedTripsCount: number;
  onOpenSavedTrips: () => void;
  mySpotsCount: number;
  onOpenMySpots: () => void;
  onOpenProfile: () => void;
  hasTasteProfile?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeMobileTab,
  activeMode,
  onModeChange,
  onScrollToForm,
  onScrollToItinerary,
  hasActiveTrip,
  savedTripsCount,
  onOpenSavedTrips,
  mySpotsCount,
  onOpenMySpots,
  onOpenProfile,
  hasTasteProfile = false,
}) => {
  const { t } = useLanguage();

  const isFormActive = activeMobileTab === "form";
  const isItineraryActive = activeMobileTab === "itinerary";

  return (
    <nav
      id="mobile-bottom-nav"
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-[#e5e5df] pb-[env(safe-area-inset-bottom,8px)] pt-1 px-1 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] no-print"
    >
      <div className="grid grid-cols-5 items-center justify-around max-w-md mx-auto">
        {/* Tab 1: Form / Mode Switcher */}
        <button
          id="btn-mobile-nav-form"
          type="button"
          onClick={onScrollToForm}
          className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[#6b6b5e] hover:text-[#2c2c24] active:scale-95 transition-all"
        >
          <div className={`relative p-1 rounded-xl border transition-all ${
            isFormActive ? "bg-[#5A5A40] border-[#5A5A40]" : "bg-[#f5f5f0] border-[#e5e5df]"
          }`}>
            {activeMode === "vacation" ? (
              <Plane className={`w-4 h-4 ${isFormActive ? "text-white" : "text-[#5A5A40]"}`} />
            ) : (
              <MapPin className={`w-4 h-4 ${isFormActive ? "text-white" : "text-[#5A5A40]"}`} />
            )}
          </div>
          <span className={`text-[10px] font-semibold tracking-tight mt-1 truncate max-w-[62px] transition-all ${
            isFormActive ? "text-[#2c2c24]" : "text-[#6b6b5e]"
          }`}>
            {activeMode === "vacation" ? t("nav.vacationShort", "Vacation") : t("nav.hometownShort", "Hometown")}
          </span>
        </button>

        {/* Tab 2: Itinerary Plan (Live Navigator) */}
        <button
          id="btn-mobile-nav-itinerary"
          type="button"
          onClick={onScrollToItinerary}
          className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[#6b6b5e] hover:text-[#2c2c24] active:scale-95 transition-all"
        >
          <div className={`relative p-1 rounded-xl border transition-all ${
            isItineraryActive ? "bg-[#5A5A40] border-[#5A5A40]" : "bg-[#f5f5f0] border-[#e5e5df]"
          }`}>
            <Compass className={`w-4 h-4 transition-all ${
              isItineraryActive ? "text-white" : hasActiveTrip ? "text-[#5A5A40]" : "text-[#8a8a7e]"
            }`} />
            {hasActiveTrip && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white" />
            )}
          </div>
          <span className={`text-[10px] font-semibold tracking-tight mt-1 truncate max-w-[62px] transition-all ${
            isItineraryActive ? "text-[#2c2c24]" : "text-[#6b6b5e]"
          }`}>
            {t("nav.itinerary", "Itinerary")}
          </span>
        </button>

        {/* Tab 3: My Places & Dining */}
        <button
          id="btn-mobile-nav-places"
          type="button"
          onClick={onOpenMySpots}
          className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[#6b6b5e] hover:text-[#2c2c24] active:scale-95 transition-all"
        >
          <div className="relative p-1 rounded-xl bg-[#f5f5f0] border border-[#e5e5df]">
            <Utensils className="w-4 h-4 text-[#5A5A40]" />
            {mySpotsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 px-0.5 items-center justify-center rounded-full bg-[#5A5A40] text-[9px] font-bold text-white">
                {mySpotsCount > 9 ? "9+" : mySpotsCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium tracking-tight mt-1 truncate max-w-[62px]">
            {t("nav.myPlaces", "Places")}
          </span>
        </button>

        {/* Tab 4: Saved Trips */}
        <button
          id="btn-mobile-nav-saved"
          type="button"
          onClick={onOpenSavedTrips}
          className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[#6b6b5e] hover:text-[#2c2c24] active:scale-95 transition-all"
        >
          <div className="relative p-1 rounded-xl bg-[#f5f5f0] border border-[#e5e5df]">
            <Bookmark className="w-4 h-4 text-[#5A5A40]" />
            {savedTripsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 px-0.5 items-center justify-center rounded-full bg-[#5A5A40] text-[9px] font-bold text-white">
                {savedTripsCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium tracking-tight mt-1 truncate max-w-[62px]">
            {t("nav.savedShort", "Saved")}
          </span>
        </button>

        {/* Tab 5: User Profile & Preferences */}
        <button
          id="btn-mobile-nav-profile"
          type="button"
          onClick={onOpenProfile}
          className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[#6b6b5e] hover:text-[#2c2c24] active:scale-95 transition-all"
        >
          <div className="relative p-1 rounded-xl bg-[#f5f5f0] border border-[#e5e5df]">
            <User className="w-4 h-4 text-[#5A5A40]" />
            {hasTasteProfile && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 border border-white" />
            )}
          </div>
          <span className="text-[10px] font-medium tracking-tight mt-1 truncate max-w-[62px]">
            {t("nav.profile", "Profile")}
          </span>
        </button>
      </div>
    </nav>
  );
};
