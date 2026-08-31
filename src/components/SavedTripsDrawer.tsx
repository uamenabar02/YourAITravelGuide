import React, { useState } from "react";
import { ItineraryPlan } from "../types";
import { X, Bookmark, Trash2, Calendar, MapPin, Search, ArrowRight, Plane, RefreshCw, CheckCircle2, Cloud } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";

interface SavedTripsDrawerProps {
  isOpen?: boolean;
  onClose?: () => void;
  savedTrips: ItineraryPlan[];
  onSelectTrip: (trip: ItineraryPlan) => void;
  onDeleteTrip: (id: string) => void;
  isInline?: boolean;
}

export const SavedTripsDrawer: React.FC<SavedTripsDrawerProps> = ({
  isOpen = false,
  onClose,
  savedTrips,
  onSelectTrip,
  onDeleteTrip,
  isInline = false,
}) => {
  const { t } = useLanguage();
  const { activeEmail, syncStatus, lastSyncTime, syncUserDataWithCloud } = useAuth();
  const [filterMode, setFilterMode] = useState<"all" | "vacation" | "hometown">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  if (!isInline && !isOpen) return null;

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    try {
      await syncUserDataWithCloud(true);
    } finally {
      setTimeout(() => setIsManualSyncing(false), 500);
    }
  };

  const filteredTrips = savedTrips.filter((t) => {
    const matchesMode = filterMode === "all" || t.mode === filterMode;
    const matchesSearch =
      searchQuery === "" ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.destinationOrTown.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesMode && matchesSearch;
  });

  if (isInline) {
    return (
      <div className="bg-white rounded-3xl border border-[#e5e5df] shadow-sm flex flex-col overflow-hidden max-w-2xl mx-auto w-full animate-in fade-in duration-200">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-[#f5f5f0] border-b border-[#e5e5df] flex items-center justify-between">
          <div className="flex items-center space-x-2.5 min-w-0">
            <Bookmark className="w-5 h-5 text-[#5A5A40] shrink-0" />
            <h3 className="font-serif text-xl sm:text-2xl font-light italic text-[#2c2c24] truncate">
              {t("saved.title", "Saved Journeys")} ({savedTrips.length})
            </h3>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 sm:p-5 bg-[#f5f5f0] border-b border-[#e5e5df] space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#8a8a7e] absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("saved.searchPlaceholder", "Search destination or trip name...")}
              className="w-full pl-10 pr-3.5 py-2.5 rounded-full border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] placeholder:text-[#8a8a7e] focus:outline-none focus:ring-1 focus:ring-[#5A5A40] focus:border-[#5A5A40]"
            />
          </div>

          {/* Mode Pill Filter */}
          <div className="flex items-center space-x-1.5 text-xs overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setFilterMode("all")}
              className={`px-3 py-1.5 rounded-full font-medium transition-colors shrink-0 whitespace-nowrap cursor-pointer ${
                filterMode === "all"
                  ? "bg-[#5A5A40] text-white shadow-xs"
                  : "bg-white text-[#2c2c24] border border-[#d1d1ca] hover:bg-[#ecece4]"
              }`}
            >
              {t("saved.all", "All")} ({savedTrips.length})
            </button>
            <button
              onClick={() => setFilterMode("vacation")}
              className={`px-3 py-1.5 rounded-full font-medium transition-colors shrink-0 whitespace-nowrap cursor-pointer ${
                filterMode === "vacation"
                  ? "bg-[#5A5A40] text-white shadow-xs"
                  : "bg-white text-[#2c2c24] border border-[#d1d1ca] hover:bg-[#ecece4]"
              }`}
            >
              {t("saved.vacations", "Vacations")} ({savedTrips.filter((t) => t.mode === "vacation").length})
            </button>
            <button
              onClick={() => setFilterMode("hometown")}
              className={`px-3 py-1.5 rounded-full font-medium transition-colors shrink-0 whitespace-nowrap cursor-pointer ${
                filterMode === "hometown"
                  ? "bg-[#5A5A40] text-white shadow-xs"
                  : "bg-white text-[#2c2c24] border border-[#d1d1ca] hover:bg-[#ecece4]"
              }`}
            >
              {t("saved.hometown", "Hometown")} ({savedTrips.filter((t) => t.mode === "hometown").length})
            </button>
          </div>
        </div>

        {/* Trips List */}
        <div className="overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-[#f5f5f0]/40 max-h-[500px]">
          {filteredTrips.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Bookmark className="w-10 h-10 text-[#d1d1ca] mx-auto mb-3 stroke-1" />
              <p className="font-serif text-lg italic text-[#2c2c24]">{t("saved.noTrips", "No saved itineraries found")}</p>
              <p className="text-xs text-[#8a8a7e] mt-1 font-sans">
                {t("saved.noTripsSub", "Plan a vacation or hometown outing and click \"Save Trip\" to store it offline.")}
              </p>
            </div>
          ) : (
            filteredTrips.map((trip) => (
              <div
                key={trip.id}
                className="bg-white rounded-2xl p-4 sm:p-5 border border-[#e5e5df] hover:border-[#d1d1ca] hover:shadow-xs transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-[#ecece4] text-[#5A5A40] border border-[#d1d1ca] shrink-0 whitespace-nowrap">
                      {trip.mode === "vacation" ? `${trip.totalDays} ${t("action.days", "Days")}` : t("nav.hometown", "Hometown")}
                    </span>
                    <button
                      onClick={() => onDeleteTrip(trip.id)}
                      title="Delete trip"
                      className="p-1 text-[#8a8a7e] hover:text-rose-600 hover:bg-rose-50 rounded shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <h4 className="font-serif text-base font-normal italic text-[#2c2c24] leading-snug">
                    {trip.title}
                  </h4>

                  <div className="flex items-center space-x-1.5 text-xs text-[#8a8a7e] mt-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#5A5A40] shrink-0" />
                    <span className="truncate">{trip.destinationOrTown}</span>
                  </div>

                  <p className="text-xs text-[#6b6b5e] mt-2 line-clamp-2 font-sans">
                    {trip.summary}
                  </p>
                </div>

                <div className="mt-3.5 pt-3 border-t border-[#e5e5df] flex items-center justify-between">
                  <span className="text-[11px] text-[#8a8a7e] font-medium font-serif italic">
                    {new Date(trip.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => {
                      onSelectTrip(trip);
                      if (onClose) onClose();
                    }}
                    className="flex items-center space-x-1 text-xs font-serif italic font-semibold text-[#5A5A40] hover:text-[#2c2c24] shrink-0 whitespace-nowrap cursor-pointer"
                  >
                    <span>{t("saved.openPlan", "Open Plan")}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Cloud Sync Bar */}
        <div className="p-4 bg-white border-t border-[#e5e5df] flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2 min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${syncStatus === "synced" ? "bg-emerald-500" : syncStatus === "syncing" ? "bg-amber-500 animate-ping" : "bg-[#8a8a7e]"}`} />
            <div className="truncate">
              <p className="text-[11px] font-medium text-[#2c2c24] truncate">
                {activeEmail}
              </p>
              <p className="text-[10px] text-[#8a8a7e] flex items-center space-x-1">
                <span>Cloud Sync: {lastSyncTime}</span>
              </p>
            </div>
          </div>

          <button
            onClick={handleManualSync}
            disabled={isManualSyncing || syncStatus === "syncing"}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full border border-[#d1d1ca] hover:bg-[#ecece4] text-[#2c2c24] font-medium text-xs transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isManualSyncing || syncStatus === "syncing" ? "animate-spin text-[#5A5A40]" : "text-[#8a8a7e]"}`} />
            <span>{isManualSyncing ? "Syncing..." : "Sync"}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 top-0 bottom-[58px] md:inset-0 z-40 md:z-50 overflow-hidden bg-[#2c2c24]/40 md:backdrop-blur-xs flex justify-end no-print animate-fade-in">
      <div className="w-full h-full md:max-w-md bg-white shadow-2xl flex flex-col border-l-0 md:border-l md:border-[#e5e5df]">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-[#e5e5df] flex items-center justify-between">
          <div className="flex items-center space-x-2.5 min-w-0">
            <Bookmark className="w-5 h-5 text-[#5A5A40] shrink-0" />
            <h3 className="font-serif text-xl sm:text-2xl font-light italic text-[#2c2c24] truncate">
              {t("saved.title", "Saved Journeys")} ({savedTrips.length})
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[#8a8a7e] hover:text-[#2c2c24] hover:bg-[#ecece4] transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 sm:p-5 bg-[#f5f5f0] border-b border-[#e5e5df] space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#8a8a7e] absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("saved.searchPlaceholder", "Search destination or trip name...")}
              className="w-full pl-10 pr-3.5 py-2.5 rounded-full border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] placeholder:text-[#8a8a7e] focus:outline-none focus:ring-1 focus:ring-[#5A5A40] focus:border-[#5A5A40]"
            />
          </div>

          {/* Mode Pill Filter */}
          <div className="flex items-center space-x-1.5 text-xs overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setFilterMode("all")}
              className={`px-3 py-1.5 rounded-full font-medium transition-colors shrink-0 whitespace-nowrap ${
                filterMode === "all"
                  ? "bg-[#5A5A40] text-white shadow-xs"
                  : "bg-white text-[#2c2c24] border border-[#d1d1ca] hover:bg-[#ecece4]"
              }`}
            >
              {t("saved.all", "All")} ({savedTrips.length})
            </button>
            <button
              onClick={() => setFilterMode("vacation")}
              className={`px-3 py-1.5 rounded-full font-medium transition-colors shrink-0 whitespace-nowrap ${
                filterMode === "vacation"
                  ? "bg-[#5A5A40] text-white shadow-xs"
                  : "bg-white text-[#2c2c24] border border-[#d1d1ca] hover:bg-[#ecece4]"
              }`}
            >
              {t("saved.vacations", "Vacations")} ({savedTrips.filter((t) => t.mode === "vacation").length})
            </button>
            <button
              onClick={() => setFilterMode("hometown")}
              className={`px-3 py-1.5 rounded-full font-medium transition-colors shrink-0 whitespace-nowrap ${
                filterMode === "hometown"
                  ? "bg-[#5A5A40] text-white shadow-xs"
                  : "bg-white text-[#2c2c24] border border-[#d1d1ca] hover:bg-[#ecece4]"
              }`}
            >
              {t("saved.hometown", "Hometown")} ({savedTrips.filter((t) => t.mode === "hometown").length})
            </button>
          </div>
        </div>

        {/* Trips List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-[#f5f5f0]/40">
          {filteredTrips.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Bookmark className="w-10 h-10 text-[#d1d1ca] mx-auto mb-3 stroke-1" />
              <p className="font-serif text-lg italic text-[#2c2c24]">{t("saved.noTrips", "No saved itineraries found")}</p>
              <p className="text-xs text-[#8a8a7e] mt-1 font-sans">
                {t("saved.noTripsSub", "Plan a vacation or hometown outing and click \"Save Trip\" to store it offline.")}
              </p>
            </div>
          ) : (
            filteredTrips.map((trip) => (
              <div
                key={trip.id}
                className="bg-white rounded-2xl p-4 sm:p-5 border border-[#e5e5df] hover:border-[#d1d1ca] hover:shadow-xs transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-[#ecece4] text-[#5A5A40] border border-[#d1d1ca] shrink-0 whitespace-nowrap">
                      {trip.mode === "vacation" ? `${trip.totalDays} ${t("action.days", "Days")}` : t("nav.hometown", "Hometown")}
                    </span>
                    <button
                      onClick={() => onDeleteTrip(trip.id)}
                      title="Delete trip"
                      className="p-1 text-[#8a8a7e] hover:text-rose-600 hover:bg-rose-50 rounded shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <h4 className="font-serif text-base font-normal italic text-[#2c2c24] leading-snug">
                    {trip.title}
                  </h4>

                  <div className="flex items-center space-x-1.5 text-xs text-[#8a8a7e] mt-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#5A5A40] shrink-0" />
                    <span className="truncate">{trip.destinationOrTown}</span>
                  </div>

                  <p className="text-xs text-[#6b6b5e] mt-2 line-clamp-2 font-sans">
                    {trip.summary}
                  </p>
                </div>

                <div className="mt-3.5 pt-3 border-t border-[#e5e5df] flex items-center justify-between">
                  <span className="text-[11px] text-[#8a8a7e] font-medium font-serif italic">
                    {new Date(trip.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => {
                      onSelectTrip(trip);
                      onClose();
                    }}
                    className="flex items-center space-x-1 text-xs font-serif italic font-semibold text-[#5A5A40] hover:text-[#2c2c24] shrink-0 whitespace-nowrap"
                  >
                    <span>{t("saved.openPlan", "Open Plan")}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Cloud Sync Bar */}
        <div className="p-3 sm:p-4 bg-white border-t border-[#e5e5df] flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2 min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${syncStatus === "synced" ? "bg-emerald-500" : syncStatus === "syncing" ? "bg-amber-500 animate-ping" : "bg-[#8a8a7e]"}`} />
            <div className="truncate">
              <p className="text-[11px] font-medium text-[#2c2c24] truncate">
                {activeEmail}
              </p>
              <p className="text-[10px] text-[#8a8a7e] flex items-center space-x-1">
                <span>Cloud Sync: {lastSyncTime}</span>
              </p>
            </div>
          </div>

          <button
            onClick={handleManualSync}
            disabled={isManualSyncing || syncStatus === "syncing"}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full border border-[#d1d1ca] hover:bg-[#ecece4] text-[#2c2c24] font-medium text-xs transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isManualSyncing || syncStatus === "syncing" ? "animate-spin text-[#5A5A40]" : "text-[#8a8a7e]"}`} />
            <span>{isManualSyncing ? "Syncing..." : "Sync"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
