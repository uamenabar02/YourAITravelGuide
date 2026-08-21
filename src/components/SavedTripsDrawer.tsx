import React, { useState } from "react";
import { ItineraryPlan } from "../types";
import { X, Bookmark, Trash2, Calendar, MapPin, Search, ArrowRight, Plane } from "lucide-react";

interface SavedTripsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  savedTrips: ItineraryPlan[];
  onSelectTrip: (trip: ItineraryPlan) => void;
  onDeleteTrip: (id: string) => void;
}

export const SavedTripsDrawer: React.FC<SavedTripsDrawerProps> = ({
  isOpen,
  onClose,
  savedTrips,
  onSelectTrip,
  onDeleteTrip,
}) => {
  const [filterMode, setFilterMode] = useState<"all" | "vacation" | "hometown">("all");
  const [searchQuery, setSearchQuery] = useState("");

  if (!isOpen) return null;

  const filteredTrips = savedTrips.filter((t) => {
    const matchesMode = filterMode === "all" || t.mode === filterMode;
    const matchesSearch =
      searchQuery === "" ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.destinationOrTown.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesMode && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#2c2c24]/40 backdrop-blur-xs flex justify-end no-print animate-fade-in">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-[#e5e5df]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#e5e5df] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Bookmark className="w-5 h-5 text-[#5A5A40]" />
            <h3 className="font-serif text-2xl font-light italic text-[#2c2c24]">
              Saved Journeys ({savedTrips.length})
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[#8a8a7e] hover:text-[#2c2c24] hover:bg-[#ecece4] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-5 bg-[#f5f5f0] border-b border-[#e5e5df] space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#8a8a7e] absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search destination or trip name..."
              className="w-full pl-10 pr-3.5 py-2.5 rounded-full border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] placeholder:text-[#8a8a7e] focus:outline-none focus:ring-1 focus:ring-[#5A5A40] focus:border-[#5A5A40]"
            />
          </div>

          {/* Mode Pill Filter */}
          <div className="flex items-center space-x-1.5 text-xs">
            <button
              onClick={() => setFilterMode("all")}
              className={`px-3.5 py-1.5 rounded-full font-medium transition-colors ${
                filterMode === "all"
                  ? "bg-[#5A5A40] text-white shadow-xs"
                  : "bg-white text-[#2c2c24] border border-[#d1d1ca] hover:bg-[#ecece4]"
              }`}
            >
              All ({savedTrips.length})
            </button>
            <button
              onClick={() => setFilterMode("vacation")}
              className={`px-3.5 py-1.5 rounded-full font-medium transition-colors ${
                filterMode === "vacation"
                  ? "bg-[#5A5A40] text-white shadow-xs"
                  : "bg-white text-[#2c2c24] border border-[#d1d1ca] hover:bg-[#ecece4]"
              }`}
            >
              Vacations ({savedTrips.filter((t) => t.mode === "vacation").length})
            </button>
            <button
              onClick={() => setFilterMode("hometown")}
              className={`px-3.5 py-1.5 rounded-full font-medium transition-colors ${
                filterMode === "hometown"
                  ? "bg-[#5A5A40] text-white shadow-xs"
                  : "bg-white text-[#2c2c24] border border-[#d1d1ca] hover:bg-[#ecece4]"
              }`}
            >
              Hometown ({savedTrips.filter((t) => t.mode === "hometown").length})
            </button>
          </div>
        </div>

        {/* Trips List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3.5 bg-[#f5f5f0]/40">
          {filteredTrips.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Bookmark className="w-10 h-10 text-[#d1d1ca] mx-auto mb-3 stroke-1" />
              <p className="font-serif text-lg italic text-[#2c2c24]">No saved itineraries found</p>
              <p className="text-xs text-[#8a8a7e] mt-1 font-sans">
                Plan a vacation or hometown outing and click "Save to My Trips" to store it offline.
              </p>
            </div>
          ) : (
            filteredTrips.map((trip) => (
              <div
                key={trip.id}
                className="bg-white rounded-2xl p-5 border border-[#e5e5df] hover:border-[#d1d1ca] hover:shadow-xs transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-[#ecece4] text-[#5A5A40] border border-[#d1d1ca]">
                      {trip.mode === "vacation" ? `${trip.totalDays} Days` : "Local Outing"}
                    </span>
                    <button
                      onClick={() => onDeleteTrip(trip.id)}
                      title="Delete trip"
                      className="p-1 text-[#8a8a7e] hover:text-rose-600 hover:bg-rose-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <h4 className="font-serif text-base font-normal italic text-[#2c2c24] leading-snug">
                    {trip.title}
                  </h4>

                  <div className="flex items-center space-x-1.5 text-xs text-[#8a8a7e] mt-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#5A5A40]" />
                    <span>{trip.destinationOrTown}</span>
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
                    className="flex items-center space-x-1 text-xs font-serif italic font-semibold text-[#5A5A40] hover:text-[#2c2c24]"
                  >
                    <span>Open Plan</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
