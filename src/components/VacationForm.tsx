import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Compass,
  Calendar,
  DollarSign,
  Tag,
  Clock,
  ChevronDown,
  ChevronUp,
  MapPin,
  Plus,
  Trash2,
  Layers,
  Users,
  Minus,
  Car,
  Bus,
  Bike,
  Navigation,
  Hotel,
  Home,
  CheckCircle2,
  Search,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { VacationPreferences, PaceType, BudgetTier, TransportMode, DestinationStop, Coordinates } from "../types";
import { DestinationAdvisor } from "./DestinationAdvisor";
import { searchLocationSuggestions, VerifiedLocation } from "../utils/locationVerification";
import { AccommodationMapPickerModal } from "./AccommodationMapPickerModal";
import { useLanguage } from "../context/LanguageContext";

interface AccommodationLocationInputProps {
  location: string;
  isVerified?: boolean;
  coordinates?: Coordinates;
  cityContext?: string;
  onUpdate: (location: string, coordinates?: Coordinates, isVerified?: boolean) => void;
}

function AccommodationLocationInput({
  location,
  isVerified,
  coordinates,
  cityContext,
  onUpdate,
}: AccommodationLocationInputProps) {
  const { t } = useLanguage();
  const [query, setQuery] = useState(location);
  const [suggestions, setSuggestions] = useState<VerifiedLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);

  useEffect(() => {
    setQuery(location);
  }, [location]);

  const handleSearch = async (text: string) => {
    setQuery(text);
    onUpdate(text, undefined, false);

    if (text.trim().length >= 3) {
      setIsSearching(true);
      const results = await searchLocationSuggestions(text, cityContext);
      setSuggestions(results);
      setIsSearching(false);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (item: VerifiedLocation) => {
    setQuery(item.displayName);
    onUpdate(item.displayName, { lat: item.lat, lng: item.lng }, true);
    setShowSuggestions(false);
  };

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-1">
        <label className="block text-[10px] uppercase tracking-wider font-bold text-[#6b6b5e]">
          {t("vacation.locationAddress", "Location / Address / Neighborhood")}
        </label>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setIsMapOpen(true)}
            className="inline-flex items-center gap-1 text-[10px] text-[#5A5A40] hover:text-[#2c2c24] underline font-bold cursor-pointer"
          >
            🗺️ {t("vacation.pinOnMap", "Pin on Map")}
          </button>
          {isVerified && coordinates ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-mono">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              {t("vacation.geoVerified", "Geo Verified")} ({coordinates.lat.toFixed(2)}, {coordinates.lng.toFixed(2)})
            </span>
          ) : (
            <span className="text-[10px] text-[#8a8a7e] italic">
              {t("vacation.searchVerify", "Search to verify location")}
            </span>
          )}
        </div>
      </div>

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true);
          }}
          placeholder={t("vacation.accommodationNotesPlaceholder", "e.g. Paseo República de Argentina 4, City Centre")}
          className="w-full pl-8 pr-8 py-1.5 rounded-xl border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] font-medium placeholder:text-[#8a8a7e] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
        />
        <MapPin className="w-3.5 h-3.5 text-[#8a8a7e] absolute left-2.5 top-2.5" />
        {isSearching && (
          <Loader2 className="w-3.5 h-3.5 text-[#5A5A40] animate-spin absolute right-2.5 top-2.5" />
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-[#d1d1ca] rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-[#ecece4]">
          <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-[#8a8a7e] bg-[#f5f5f0]">
            Verified Location Matches (Click to Lock)
          </div>
          {suggestions.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectSuggestion(item)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-[#f5f5f0] flex items-center justify-between transition-colors"
            >
              <div className="min-w-0 pr-2">
                <p className="font-medium text-[#2c2c24] truncate">{item.displayName}</p>
              </div>
              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Lock Geo
              </span>
            </button>
          ))}
        </div>
      )}

      <AccommodationMapPickerModal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        onSelect={(displayName, coords) => {
          setQuery(displayName);
          onUpdate(displayName, coords, true);
        }}
        cityContext={cityContext || ""}
        initialCoordinates={coordinates}
        initialLocationName={location}
      />
    </div>
  );
}

interface VacationFormProps {
  onSubmit: (prefs: VacationPreferences) => void;
  isLoading: boolean;
}

const POPULAR_DESTINATIONS = [
  "Donostia / San Sebastián, Spain",
  "Bilbao, Spain",
  "Kyoto, Japan",
  "Barcelona, Spain",
  "Rome, Italy",
  "Biarritz, France",
  "Lisbon, Portugal",
  "Oaxaca, Mexico",
];

const VIBE_OPTIONS = [
  { key: "vibe.gastro", label: "Gastronomy & Local Food", icon: "🍜" },
  { key: "vibe.excursions", label: "Regional Excursions & Viewpoints", icon: "🚗" },
  { key: "vibe.shopping", label: "Shopping & Local Boutiques", icon: "🛍️" },
  { key: "vibe.scenic", label: "Scenic & Outdoors", icon: "🌲" },
  { key: "vibe.history", label: "History & Architecture", icon: "🏛️" },
  { key: "vibe.family", label: "Family Friendly", icon: "👨‍👩‍👧" },
  { key: "vibe.hiddenGems", label: "Hidden Gems / Non-Touristy", icon: "💎" },
  { key: "vibe.budget", label: "Budget Friendly", icon: "🏷️" },
  { key: "vibe.nightlife", label: "Nightlife & Bars", icon: "🍸" },
  { key: "vibe.art", label: "Art & Culture", icon: "🎨" },
  { key: "vibe.relaxation", label: "Relaxation & Wellness", icon: "🌿" },
];

export const VacationForm: React.FC<VacationFormProps> = ({ onSubmit, isLoading }) => {
  const { t } = useLanguage();
  const [destination, setDestination] = useState("Donostia / San Sebastián, Spain");
  const [groupSize, setGroupSize] = useState<number>(2);
  const [duration, setDuration] = useState<number>(3);
  const [pace, setPace] = useState<PaceType>("balanced");
  const [transportModes, setTransportModes] = useState<TransportMode[]>(["public_transit"]);
  const [selectedVibes, setSelectedVibes] = useState<string[]>([
    "Gastronomy & Local Food",
    "History & Architecture",
    "Hidden Gems / Non-Touristy",
  ]);

  const toggleTransportMode = (mode: TransportMode) => {
    setTransportModes((prev) => {
      if (prev.includes(mode)) {
        if (prev.length === 1) return prev; // keep at least 1 mode selected
        return prev.filter((m) => m !== mode);
      }
      return [...prev, mode];
    });
  };

  // Budget settings: Tier vs Exact
  const [budgetType, setBudgetType] = useState<"tier" | "exact">("tier");
  const [budgetTier, setBudgetTier] = useState<BudgetTier>("mid-range");
  const [exactBudgetPerDay, setExactBudgetPerDay] = useState<number>(75);
  const [currency, setCurrency] = useState<string>("€");

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customNotes, setCustomNotes] = useState("");

  // Booked Accommodation Details (Collapsible & Supports Multiple Accommodations with Geolocation)
  const [hasAccommodation, setHasAccommodation] = useState(false);
  const [accommodations, setAccommodations] = useState<
    {
      id: string;
      name: string;
      location: string;
      coordinates?: Coordinates;
      isVerified?: boolean;
      description: string;
      checkInDay: number;
      checkInHour: string;
      checkOutDay: number;
      checkOutHour: string;
    }[]
  >([
    {
      id: "acc-1",
      name: "",
      location: "",
      description: "",
      checkInDay: 1,
      checkInHour: "15:00",
      checkOutDay: 2,
      checkOutHour: "11:00",
    },
  ]);

  // Multi-destination features
  const [isMultiDestination, setIsMultiDestination] = useState(false);
  const [destinations, setDestinations] = useState<DestinationStop[]>([
    { id: "dest-1", city: "Bilbao, Spain", days: 2, arrivalHour: "12:00", departureHour: "10:00" },
    { id: "dest-2", city: "Donostia / San Sebastián, Spain", days: 3, arrivalHour: "11:30", departureHour: "18:00" },
  ]);
  const [arrivalHour, setArrivalHour] = useState("14:00");
  const [departureHour, setDepartureHour] = useState("11:00");
  const [enableSwiper, setEnableSwiper] = useState(true);

  const toggleVibe = (vibe: string) => {
    if (selectedVibes.includes(vibe)) {
      setSelectedVibes(selectedVibes.filter((v) => v !== vibe));
    } else {
      setSelectedVibes([...selectedVibes, vibe]);
    }
  };

  const handleAddStop = () => {
    setDestinations([
      ...destinations,
      {
        id: `dest-${Date.now()}`,
        city: "Biarritz, France",
        days: 2,
        arrivalHour: "12:00",
        departureHour: "12:00",
      },
    ]);
  };

  const handleRemoveStop = (id: string) => {
    if (destinations.length <= 1) return;
    setDestinations(destinations.filter((d) => d.id !== id));
  };

  const handleUpdateStop = (id: string, field: keyof DestinationStop, val: any) => {
    setDestinations(
      destinations.map((d) => (d.id === id ? { ...d, [field]: val } : d))
    );
  };

  const calculatedTotalDays = isMultiDestination
    ? destinations.reduce((sum, d) => sum + d.days, 0)
    : duration;

  const handleAddAccommodation = () => {
    const lastAcc = accommodations[accommodations.length - 1];
    const nextCheckIn = lastAcc ? Math.min(lastAcc.checkOutDay, calculatedTotalDays) : 1;
    const nextCheckOut = Math.min(nextCheckIn + 1, Math.max(calculatedTotalDays, 2));

    setAccommodations([
      ...accommodations,
      {
        id: `acc-${Date.now()}`,
        name: "",
        location: "",
        description: "",
        checkInDay: nextCheckIn,
        checkInHour: "15:00",
        checkOutDay: nextCheckOut,
        checkOutHour: "11:00",
      },
    ]);
  };

  const handleRemoveAccommodation = (id: string) => {
    if (accommodations.length <= 1) {
      setHasAccommodation(false);
      return;
    }
    setAccommodations(accommodations.filter((a) => a.id !== id));
  };

  const handleUpdateAccommodation = (id: string, field: string, val: any) => {
    setAccommodations(
      accommodations.map((a) => (a.id === id ? { ...a, [field]: val } : a))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let accommodationData = undefined;
    let accommodationsData = undefined;

    if (hasAccommodation) {
      const validList = accommodations
        .filter((a) => a.name.trim() || a.location.trim())
        .map((a) => ({
          id: a.id,
          name: a.name.trim() || "Booked Accommodation",
          location: a.location.trim(),
          coordinates: a.coordinates,
          isVerified: a.isVerified,
          description: a.description.trim() || undefined,
          checkInDay: a.checkInDay,
          checkInHour: a.checkInHour || undefined,
          checkOutDay: a.checkOutDay,
          checkOutHour: a.checkOutHour || undefined,
        }));

      if (validList.length > 0) {
        accommodationData = validList[0];
        accommodationsData = validList;
      }
    }

    if (isMultiDestination) {
      const totalDays = destinations.reduce((sum, d) => sum + d.days, 0);
      const combinedDest = destinations.map((d) => d.city.split(",")[0]).join(" → ");
      onSubmit({
        destination: combinedDest,
        duration: totalDays,
        pace,
        vibes: selectedVibes,
        budgetTier,
        budgetType,
        exactBudgetPerDay: budgetType === "exact" ? exactBudgetPerDay : undefined,
        currency,
        groupSize: Math.max(1, groupSize),
        customNotes: customNotes.trim() || undefined,
        isMultiDestination: true,
        destinations,
        arrivalHour: destinations[0]?.arrivalHour || arrivalHour,
        departureHour: destinations[destinations.length - 1]?.departureHour || departureHour,
        transportMode: transportModes[0] || "public_transit",
        transportModes,
        accommodation: accommodationData,
        accommodations: accommodationsData,
        enableSwiper,
      });
    } else {
      if (!destination.trim()) return;
      onSubmit({
        destination: destination.trim(),
        duration,
        pace,
        vibes: selectedVibes,
        budgetTier,
        budgetType,
        exactBudgetPerDay: budgetType === "exact" ? exactBudgetPerDay : undefined,
        currency,
        groupSize: Math.max(1, groupSize),
        customNotes: customNotes.trim() || undefined,
        isMultiDestination: false,
        arrivalHour,
        departureHour,
        transportMode: transportModes[0] || "public_transit",
        transportModes,
        accommodation: accommodationData,
        accommodations: accommodationsData,
        enableSwiper,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 sm:p-8 border border-[#e5e5df] shadow-sm">
      {/* Header title */}
      <div className="flex items-center justify-between pb-5 mb-6 border-b border-[#e5e5df]">
        <div>
          <h2 className="font-serif text-2xl sm:text-3xl font-light text-[#2c2c24] flex items-center gap-2">
            <span>✈️</span>
            <span>{t("vacation.title", "Vacation Itinerary Planner")}</span>
          </h2>
          <p className="text-xs sm:text-sm text-[#6b6b5e] mt-1 font-sans">
            {t("vacation.subtitle", "Cost-aware, multi-day cultural itineraries with authentic hidden gems & verified route optimization")}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Single vs Multi-Destination Switch */}
        <div className="flex items-center justify-between p-3.5 bg-[#f5f5f0] rounded-2xl border border-[#e5e5df]">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-[#5A5A40]" />
            <span className="text-xs font-serif italic text-[#2c2c24]">{t("vacation.tripMode", "Trip Mode:")}</span>
          </div>

          <div className="flex rounded-xl bg-[#ecece4] p-1 text-xs">
            <button
              type="button"
              onClick={() => setIsMultiDestination(false)}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                !isMultiDestination ? "bg-white text-[#2c2c24] shadow-xs" : "text-[#6b6b5e]"
              }`}
            >
              {t("vacation.singleDest", "Single Destination")}
            </button>
            <button
              type="button"
              onClick={() => setIsMultiDestination(true)}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                isMultiDestination ? "bg-white text-[#2c2c24] shadow-xs" : "text-[#6b6b5e]"
              }`}
            >
              {t("vacation.multiDest", "Multi-Destination / Road Trip")}
            </button>
          </div>
        </div>

        {/* 1. Destination Input (Single Mode) */}
        {!isMultiDestination ? (
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#5A5A40]" />
                {t("vacation.destinationLabel", "Destination City or Region (Advisor & Verifier)")}
              </span>
              <span className="font-medium text-[#5A5A40]">{t("vacation.geocoding", "Precise Geocoding")}</span>
            </label>

            {/* Smart Destination Advisor Component */}
            <DestinationAdvisor
              value={destination}
              onChange={setDestination}
              placeholder="e.g. Donostia / San Sebastián, Spain"
            />

            {/* Quick Suggestions */}
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              <span className="text-[11px] text-[#8a8a7e] font-medium mr-1 uppercase tracking-wider">{t("vacation.popular", "Popular:")}</span>
              {POPULAR_DESTINATIONS.map((dest) => (
                <button
                  key={dest}
                  type="button"
                  onClick={() => setDestination(dest)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    destination === dest
                      ? "bg-[#5A5A40] text-white border-[#5A5A40] font-medium shadow-xs"
                      : "bg-[#ecece4] text-[#2c2c24] border-[#d1d1ca] hover:border-[#5A5A40]"
                  }`}
                >
                  {dest.split(",")[0]}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Multi-Destination Stops Editor */
          <div className="space-y-3">
            <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e]">
              {t("vacation.multiCityStops", "Multi-City Route Stops")}
            </label>

            <div className="space-y-2.5">
              {destinations.map((stop, index) => (
                <div
                  key={stop.id}
                  className="p-3.5 bg-[#f5f5f0] rounded-2xl border border-[#e5e5df] flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="w-6 h-6 rounded-full bg-[#5A5A40] text-white text-xs font-serif italic flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="text-xs font-serif italic text-[#2c2c24]">{t("vacation.stop", "Stop")} {index + 1}</span>
                  </div>

                  <div className="flex-1">
                    <DestinationAdvisor
                      value={stop.city}
                      onChange={(val) => handleUpdateStop(stop.id, "city", val)}
                      placeholder="e.g. Donostia / San Sebastián"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1 bg-white px-2 py-1.5 rounded-xl border border-[#d1d1ca]">
                      <span className="text-xs text-[#8a8a7e]">{t("action.days", "Days")}:</span>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={stop.days}
                        onChange={(e) => handleUpdateStop(stop.id, "days", parseInt(e.target.value) || 1)}
                        className="w-10 text-center text-xs font-semibold text-[#2c2c24] focus:outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={destinations.length <= 1}
                      onClick={() => handleRemoveStop(stop.id)}
                      className="p-2 text-[#8a8a7e] hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors disabled:opacity-20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddStop}
              className="py-2 px-4 rounded-xl border border-dashed border-[#5A5A40] text-[#5A5A40] text-xs font-serif italic flex items-center space-x-1.5 hover:bg-[#ecece4]/60 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t("vacation.addStop", "Add Another Stop / City")}</span>
            </button>
          </div>
        )}

        {/* 2. Number of People in Vacation Group (Placed below destination input) */}
        <div className="bg-[#f5f5f0] p-4 sm:p-5 rounded-2xl border border-[#e5e5df]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#5A5A40]" />
                {t("vacation.groupSize", "Vacation Group Size")}
              </label>
              <p className="text-xs text-[#6b6b5e] mt-0.5 font-sans">
                {t("vacation.groupSizeDesc", "Number of people traveling in your party")}
              </p>
            </div>

            {/* Stepper counter */}
            <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-2xl border border-[#d1d1ca] shadow-xs shrink-0">
              <button
                type="button"
                onClick={() => setGroupSize(Math.max(1, groupSize - 1))}
                disabled={groupSize <= 1}
                className="w-7 h-7 rounded-xl bg-[#f5f5f0] hover:bg-[#ecece4] text-[#2c2c24] flex items-center justify-center transition-colors disabled:opacity-30"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="min-w-16 px-1 text-center font-serif italic font-semibold text-xs sm:text-sm text-[#2c2c24] whitespace-nowrap">
                {groupSize} {groupSize === 1 ? t("vacation.person", "Person") : t("vacation.people", "People")}
              </span>
              <button
                type="button"
                onClick={() => setGroupSize(Math.min(20, groupSize + 1))}
                disabled={groupSize >= 20}
                className="w-7 h-7 rounded-xl bg-[#f5f5f0] hover:bg-[#ecece4] text-[#2c2c24] flex items-center justify-center transition-colors disabled:opacity-30"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Party Size Presets */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { size: 1, key: "vacation.solo", label: "Solo Traveler", icon: "👤" },
              { size: 2, key: "vacation.couple", label: "Couple (2)", icon: "👫" },
              { size: 4, key: "vacation.smallGroup", label: "Small Group (4)", icon: "👨‍👩‍👧" },
              { size: 6, key: "vacation.largeGroup", label: "Large Group (6+)", icon: "👥" },
            ].map((p) => (
              <button
                key={p.size}
                type="button"
                onClick={() => setGroupSize(p.size)}
                className={`py-2 px-3 rounded-xl border text-xs font-serif italic flex items-center justify-center space-x-1.5 transition-all whitespace-nowrap ${
                  groupSize === p.size
                    ? "bg-[#5A5A40] text-white border-[#5A5A40] font-medium shadow-xs"
                    : "bg-white text-[#2c2c24] border-[#d1d1ca] hover:border-[#5A5A40]"
                }`}
              >
                <span>{p.icon}</span>
                <span>{t(p.key, p.label)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 3. Booked Accommodation Context (Collapsible & Supports Multiple Stays) */}
        {!hasAccommodation ? (
          <div className="bg-[#f5f5f0] p-4 sm:p-5 rounded-2xl border border-[#e5e5df] flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white border border-[#d1d1ca] flex items-center justify-center text-[#5A5A40] shrink-0">
                <Hotel className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-semibold text-[#2c2c24] font-serif italic">
                  {t("vacation.accommodationTitle", "Booked Accommodation & Stay Context")}
                </h4>
                <p className="text-[11px] text-[#6b6b5e] font-sans truncate">
                  {t("vacation.accommodationSubtitle", "Specify hotels, check-in and check-out days & times for single or multi-destination stays")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setHasAccommodation(true);
                if (accommodations.length === 0) {
                  handleAddAccommodation();
                }
              }}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-white text-[#5A5A40] hover:text-[#2c2c24] border border-[#d1d1ca] hover:border-[#5A5A40] rounded-xl text-xs font-medium font-serif italic shadow-2xs transition-colors shrink-0 whitespace-nowrap"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{t("vacation.showAccommodation", "Show Accommodation Card")}</span>
            </button>
          </div>
        ) : (
          <div className="bg-[#f5f5f0] p-4 sm:p-5 rounded-2xl border border-[#e5e5df] space-y-4">
            <div className="flex items-center justify-between border-b border-[#e5e5df] pb-3">
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] flex items-center gap-1.5">
                  <Hotel className="w-4 h-4 text-[#5A5A40]" />
                  {t("vacation.accommodationHeading", "Booked Accommodations & Stay Context")}
                </label>
                <p className="text-xs text-[#6b6b5e] mt-0.5 font-sans">
                  {t("vacation.accommodationSub", "Define daily start/end locations, check-in and check-out days & times")}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setHasAccommodation(false)}
                  className="flex items-center space-x-1 text-[11px] text-[#6b6b5e] hover:text-[#2c2c24] font-serif italic px-2.5 py-1 rounded-lg border border-[#d1d1ca] bg-white transition-colors whitespace-nowrap"
                >
                  <EyeOff className="w-3 h-3" />
                  <span>{t("vacation.hideAccommodation", "Hide Accommodation Card")}</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddAccommodation}
                  className="flex items-center space-x-1 text-[11px] bg-[#5A5A40] text-white px-3 py-1 rounded-xl font-serif italic hover:bg-[#2c2c24] transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3 h-3" />
                  <span>{t("vacation.addStay", "Add Another Stay")}</span>
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {accommodations.map((acc, index) => (
                <div key={acc.id} className="bg-white p-4 rounded-xl border border-[#d1d1ca] space-y-3 shadow-2xs relative">
                  <div className="flex items-center justify-between border-b border-[#ecece4] pb-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#5A5A40] font-mono">
                      {t("vacation.stay", "Stay")} #{index + 1} {accommodations.length > 1 ? `(Hotel ${index + 1})` : ""}
                    </span>
                    {accommodations.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAccommodation(acc.id)}
                        className="p-1 text-[#8a8a7e] hover:text-red-600 transition-colors flex items-center gap-1 text-[11px]"
                        title="Remove stay"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{t("vacation.remove", "Remove")}</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-bold text-[#6b6b5e] mb-1">
                        {t("vacation.accommodationName", "Accommodation Name")}
                      </label>
                      <input
                        type="text"
                        value={acc.name}
                        onChange={(e) => handleUpdateAccommodation(acc.id, "name", e.target.value)}
                        placeholder={t("vacation.accommodationPlaceholder", "e.g. Hotel Maria Cristina, Old Town Airbnb")}
                        className="w-full px-3 py-1.5 rounded-xl border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] font-medium placeholder:text-[#8a8a7e] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                      />
                    </div>

                    <AccommodationLocationInput
                      location={acc.location}
                      isVerified={acc.isVerified}
                      coordinates={acc.coordinates}
                      cityContext={isMultiDestination ? destinations[0]?.city : destination}
                      onUpdate={(locText, coords, verified) => {
                        setAccommodations(
                          accommodations.map((a) =>
                            a.id === acc.id
                              ? { ...a, location: locText, coordinates: coords, isVerified: verified }
                              : a
                          )
                        );
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#f5f5f0] p-3 rounded-xl border border-[#e5e5df]">
                    {/* Check-in Day & Hour */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-bold text-[#6b6b5e] mb-1">
                          {t("vacation.checkInDay", "Check-in Day")}
                        </label>
                        <select
                          value={acc.checkInDay}
                          onChange={(e) => handleUpdateAccommodation(acc.id, "checkInDay", Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] font-medium focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                        >
                          {Array.from({ length: Math.max(calculatedTotalDays, 1) }, (_, i) => i + 1).map((dayNum) => (
                            <option key={dayNum} value={dayNum}>
                              {t("action.day", "Day")} {dayNum}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-bold text-[#6b6b5e] mb-1 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#5A5A40]" />
                          {t("vacation.checkInHour", "Check-in Hour")}
                        </label>
                        <input
                          type="time"
                          value={acc.checkInHour}
                          onChange={(e) => handleUpdateAccommodation(acc.id, "checkInHour", e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] font-medium focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                        />
                      </div>
                    </div>

                    {/* Check-out Day & Hour */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-bold text-[#6b6b5e] mb-1">
                          {t("vacation.checkOutDay", "Check-out Day")}
                        </label>
                        <select
                          value={acc.checkOutDay}
                          onChange={(e) => handleUpdateAccommodation(acc.id, "checkOutDay", Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] font-medium focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                        >
                          {Array.from({ length: Math.max(calculatedTotalDays, 1) }, (_, i) => i + 1).map((dayNum) => (
                            <option key={dayNum} value={dayNum}>
                              {t("action.day", "Day")} {dayNum}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-bold text-[#6b6b5e] mb-1 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#5A5A40]" />
                          {t("vacation.checkOutHour", "Check-out Hour")}
                        </label>
                        <input
                          type="time"
                          value={acc.checkOutHour}
                          onChange={(e) => handleUpdateAccommodation(acc.id, "checkOutHour", e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] font-medium focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-bold text-[#6b6b5e] mb-1">
                      {t("vacation.accommodationNotes", "Description / Hotel Notes (Optional)")}
                    </label>
                    <input
                      type="text"
                      value={acc.description}
                      onChange={(e) => handleUpdateAccommodation(acc.id, "description", e.target.value)}
                      placeholder={t("vacation.accommodationNotesPlaceholder", "e.g. 10 min walk from train station, offers luggage storage")}
                      className="w-full px-3 py-1.5 rounded-xl border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] placeholder:text-[#8a8a7e] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Arrival & Departure Hours Constraints */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#f5f5f0] p-4 sm:p-5 rounded-2xl border border-[#e5e5df]">
          <div>
            <label className="text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] flex items-center gap-1.5 mb-1.5">
              <Clock className="w-3.5 h-3.5 text-[#5A5A40]" />
              {t("vacation.arrivalHour", "Arrival Hour (Day 1)")}
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="time"
                value={arrivalHour}
                onChange={(e) => setArrivalHour(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] font-medium"
              />
            </div>
            <p className="text-[11px] text-[#8a8a7e] mt-1 font-sans">
              {t("vacation.arrivalHourDesc", "Day 1 starts after your arrival time.")}
            </p>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] flex items-center gap-1.5 mb-1.5">
              <Clock className="w-3.5 h-3.5 text-[#5A5A40]" />
              {t("vacation.departureHour", "Departure Hour (Final Day)")}
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="time"
                value={departureHour}
                onChange={(e) => setDepartureHour(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] font-medium"
              />
            </div>
            <p className="text-[11px] text-[#8a8a7e] mt-1 font-sans">
              {t("vacation.departureHourDesc", "Final day wraps up before your departure time.")}
            </p>
          </div>
        </div>

        {/* 3b. Means of Transport Available */}
        <div className="bg-[#f5f5f0] p-4 sm:p-5 rounded-2xl border border-[#e5e5df]">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-[#5A5A40]" />
              {t("vacation.transport", "Means of Transport Available")}
            </label>
            <span className="text-[10px] text-[#5A5A40] bg-white px-2 py-0.5 rounded-full border border-[#d1d1ca] font-mono">
              {t("vacation.transportMulti", "Multiple Choice")}
            </span>
          </div>
          <p className="text-xs text-[#6b6b5e] mb-3 font-sans">
            {t("vacation.transportDesc", "Select all transportation options available during your trip:")}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              {
                mode: "public_transit" as TransportMode,
                keyLabel: "vacation.transportPublic",
                label: "Public Transit & Walking",
                icon: <Bus className="w-4 h-4" />,
                keyDesc: "vacation.transportPublicDesc",
                desc: "Local buses, trains & walking",
              },
              {
                mode: "car" as TransportMode,
                keyLabel: "vacation.transportCar",
                label: "Private / Rental Car",
                icon: <Car className="w-4 h-4" />,
                keyDesc: "vacation.transportCarDesc",
                desc: "Excursions & coastal drives",
              },
              {
                mode: "bicycle" as TransportMode,
                keyLabel: "vacation.transportBike",
                label: "Bicycle / E-Bike",
                icon: <Bike className="w-4 h-4" />,
                keyDesc: "vacation.transportBikeDesc",
                desc: "Bike paths & urban rides",
              },
              {
                mode: "taxi" as TransportMode,
                keyLabel: "vacation.transportTaxi",
                label: "Taxi / Rideshare",
                icon: <Navigation className="w-4 h-4" />,
                keyDesc: "vacation.transportTaxiDesc",
                desc: "Door-to-door city transfers",
              },
            ].map((tItem) => {
              const isSelected = transportModes.includes(tItem.mode);
              return (
                <button
                  key={tItem.mode}
                  type="button"
                  onClick={() => toggleTransportMode(tItem.mode)}
                  className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                    isSelected
                      ? "bg-[#5A5A40] text-white border-[#5A5A40] shadow-xs"
                      : "bg-white text-[#2c2c24] border-[#d1d1ca] hover:border-[#5A5A40]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={isSelected ? "text-white" : "text-[#5A5A40]"}>
                      {tItem.icon}
                    </span>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                  </div>
                  <div>
                    <div className="font-serif italic font-semibold text-xs leading-tight">
                      {t(tItem.keyLabel, tItem.label)}
                    </div>
                    <div
                      className={`text-[10px] mt-0.5 font-sans ${
                        isSelected ? "text-white/80" : "text-[#8a8a7e]"
                      }`}
                    >
                      {t(tItem.keyDesc, tItem.desc)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Duration & Pace (Single Mode Duration slider) */}
        {!isMultiDestination && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
            <div className="bg-[#f5f5f0] p-5 rounded-2xl border border-[#e5e5df]">
              <div className="flex items-center justify-between mb-2.5">
                <label className="text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#5A5A40]" />
                  {t("vacation.duration", "Trip Duration")}
                </label>
                <div className="flex items-center space-x-2">
                  <span className="font-serif italic font-semibold text-sm text-[#2c2c24] bg-white px-3 py-0.5 rounded-full border border-[#d1d1ca]">
                    {duration} {duration === 1 ? t("action.day", "Day") : t("action.days", "Days")}
                  </span>
                </div>
              </div>
              <input
                id="slider-vacation-duration"
                type="range"
                min="1"
                max="14"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full accent-[#5A5A40] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#8a8a7e] font-medium mt-1 font-mono">
                <span>1 {t("vacation.dayWord", "Day")}</span>
                <span>3-4 {t("vacation.daysWord", "Days")}</span>
                <span>7 {t("vacation.daysWord", "Days")}</span>
                <span>14 {t("vacation.daysWord", "Days")}</span>
              </div>
            </div>

            {/* Travel Pace Selector */}
            <div className="bg-[#f5f5f0] p-5 rounded-2xl border border-[#e5e5df]">
              <label className="text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-2.5 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-[#5A5A40]" />
                {t("vacation.pacing", "Exploration Pace")}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "relaxed", key: "vacation.paceRelaxed", label: "Relaxed", icon: "☕" },
                  { id: "balanced", key: "vacation.paceBalanced", label: "Balanced", icon: "⚖️" },
                  { id: "action-packed", key: "vacation.pacePacked", label: "Packed", icon: "⚡" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPace(item.id as PaceType)}
                    className={`py-2 px-2 rounded-xl text-xs font-serif italic transition-all flex flex-col items-center justify-center space-y-1 ${
                      pace === item.id
                        ? "bg-[#5A5A40] text-white font-medium shadow-xs"
                        : "bg-white text-[#2c2c24] border border-[#d1d1ca] hover:border-[#5A5A40]"
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span className="whitespace-nowrap">{t(item.key, item.label)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 5. Travel Vibes & Interests */}
        <div>
          <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[#5A5A40]" />
              {t("vacation.vibes", "Travel Vibes & Interests")}
            </span>
            <span className="text-[10px] text-[#8a8a7e] font-medium">{t("vacation.vibesDesc", "Select all that apply")}</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {VIBE_OPTIONS.map((vibe) => {
              const isSelected = selectedVibes.includes(vibe.label);
              return (
                <button
                  key={vibe.label}
                  type="button"
                  onClick={() => toggleVibe(vibe.label)}
                  className={`p-2.5 rounded-xl border text-xs text-left transition-all flex items-center space-x-2 ${
                    isSelected
                      ? "bg-[#ecece4] text-[#2c2c24] border-[#5A5A40] font-medium shadow-xs"
                      : "bg-white text-[#6b6b5e] border-[#d1d1ca] hover:border-[#8a8a7e]"
                  }`}
                >
                  <span className="text-sm shrink-0">{vibe.icon}</span>
                  <span className="font-sans text-[11px] leading-tight line-clamp-1">{t(vibe.key, vibe.label)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 6. Activity Discovery Swiper Toggle */}
        <div className="p-4 bg-[#ecece4]/70 rounded-2xl border border-[#d1d1ca] flex items-center justify-between">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-full bg-[#5A5A40] text-white flex items-center justify-center text-sm font-serif shrink-0 mt-0.5">
              ❤️
            </div>
            <div>
              <span className="font-serif italic font-medium text-sm text-[#2c2c24] flex items-center gap-1.5">
                {t("vacation.swiper", "Activity Discovery Swiper")}
                <span className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-white text-[#5A5A40] border border-[#d1d1ca]">
                  {t("vacation.swiperInteractive", "Interactive")}
                </span>
              </span>
              <p className="text-xs text-[#6b6b5e] mt-0.5 font-sans">
                {t("vacation.swiperDesc", "Review & swipe right on candidate spots (with photos, Google Maps opinions & links) before building the final itinerary.")}
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
            <input
              type="checkbox"
              checked={enableSwiper}
              onChange={(e) => setEnableSwiper(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-[#d1d1ca] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#d1d1ca] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5A5A40]"></div>
          </label>
        </div>

        {/* 7. Budget Input (Subjective Tier vs Exact Budget per Day & Person) */}
        <div className="bg-[#f5f5f0] p-4 sm:p-5 rounded-2xl border border-[#e5e5df] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-[#5A5A40]" />
              {t("vacation.budget", "Budget Planning Mode")}
            </label>

            {/* Mode Switcher */}
            <div className="flex rounded-xl bg-[#ecece4] p-1 text-xs">
              <button
                type="button"
                onClick={() => setBudgetType("tier")}
                className={`px-3 py-1 rounded-lg font-serif italic transition-all ${
                  budgetType === "tier" ? "bg-white text-[#2c2c24] shadow-xs font-semibold" : "text-[#6b6b5e]"
                }`}
              >
                {t("vacation.budgetTier", "Subjective Tier")}
              </button>
              <button
                type="button"
                onClick={() => setBudgetType("exact")}
                className={`px-3 py-1 rounded-lg font-serif italic transition-all ${
                  budgetType === "exact" ? "bg-white text-[#2c2c24] shadow-xs font-semibold" : "text-[#6b6b5e]"
                }`}
              >
                {t("vacation.budgetExact", "Exact Budget / Day / Person")}
              </button>
            </div>
          </div>

          {/* Conditional Rendering: Tier vs Exact */}
          {budgetType === "tier" ? (
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              {[
                { id: "budget", key: "vacation.budgetSavvy", label: "Budget-Savvy", keyDesc: "vacation.budgetSavvyDesc", desc: "Street food & free vistas" },
                { id: "mid-range", key: "vacation.budgetMid", label: "Balanced", keyDesc: "vacation.budgetMidDesc", desc: "Cozy bistros & iconic spots" },
                { id: "luxury", key: "vacation.budgetLuxury", label: "Luxury", keyDesc: "vacation.budgetLuxuryDesc", desc: "Michelin stars & private tours" },
              ].map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setBudgetTier(tier.id as BudgetTier)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    budgetTier === tier.id
                      ? "bg-[#ecece4] text-[#2c2c24] border-[#5A5A40] font-medium shadow-xs"
                      : "bg-white text-[#6b6b5e] border-[#d1d1ca] hover:border-[#8a8a7e]"
                  }`}
                >
                  <div className="font-serif italic text-xs text-[#2c2c24]">{t(tier.key, tier.label)}</div>
                  <div className="text-[10px] text-[#8a8a7e] mt-0.5 line-clamp-1">{t(tier.keyDesc, tier.desc)}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Currency selector */}
                <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-[#d1d1ca] shrink-0">
                  {["€", "$", "£", "¥"].map((curr) => (
                    <button
                      key={curr}
                      type="button"
                      onClick={() => setCurrency(curr)}
                      className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all ${
                        currency === curr ? "bg-[#5A5A40] text-white" : "text-[#6b6b5e] hover:text-[#2c2c24]"
                      }`}
                    >
                      {curr}
                    </button>
                  ))}
                </div>

                {/* Amount input */}
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#5A5A40]">
                    {currency}
                  </span>
                  <input
                    type="number"
                    min={10}
                    max={5000}
                    value={exactBudgetPerDay}
                    onChange={(e) => setExactBudgetPerDay(Math.max(5, parseInt(e.target.value) || 0))}
                    placeholder="e.g. 75"
                    className="w-full pl-8 pr-28 py-2 rounded-xl border border-[#d1d1ca] bg-white text-xs font-semibold text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-[#8a8a7e]">
                    {t("vacation.perPersonDay", "/ person / day")}
                  </span>
                </div>
              </div>

              {/* Quick budget chip buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-[#8a8a7e] font-bold uppercase tracking-wider mr-1">{t("vacation.quickSelect", "Quick Select:")}</span>
                {[35, 60, 95, 150, 250, 400].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setExactBudgetPerDay(amt)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-serif italic border transition-all ${
                      exactBudgetPerDay === amt
                        ? "bg-[#5A5A40] text-white border-[#5A5A40] font-semibold"
                        : "bg-white text-[#2c2c24] border-[#d1d1ca] hover:bg-[#ecece4]"
                    }`}
                  >
                    {currency}{amt}
                  </button>
                ))}
              </div>

              {/* Real-time Calculation Summary Callout */}
              <div className="p-3 bg-white rounded-xl border border-[#d1d1ca] text-xs text-[#2c2c24] flex items-center justify-between">
                <span className="font-serif italic text-[#6b6b5e]">
                  {t("vacation.estTotalBudget", "Estimated Total Budget:")}
                </span>
                <span className="font-semibold text-[#5A5A40]">
                  {currency}{exactBudgetPerDay} × {groupSize} {groupSize === 1 ? t("vacation.traveler", "traveler") : t("vacation.travelers", "travelers")} × {calculatedTotalDays} {calculatedTotalDays === 1 ? t("vacation.dayWord", "day") : t("vacation.daysWord", "days")} = {currency}{exactBudgetPerDay * groupSize * calculatedTotalDays}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Advanced Notes Accordion */}
        <div className="border-t border-[#e5e5df] pt-4">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between w-full text-xs font-serif italic text-[#6b6b5e] hover:text-[#2c2c24]"
          >
            <span>{t("vacation.advancedNotes", "Additional traveler requests or dietary notes (Optional)")}</span>
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showAdvanced && (
            <div className="mt-3">
              <textarea
                id="textarea-custom-notes"
                rows={2}
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder={t("vacation.advancedNotesPlaceholder", "e.g. Vegetarian pintxos, traveling with elderly parents, interested in modern architecture and surf breaks...")}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#d1d1ca] bg-white text-[#2c2c24] placeholder:text-[#8a8a7e] focus:outline-none focus:ring-1 focus:ring-[#5A5A40] text-xs font-sans"
              />
            </div>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <div className="mt-8 pt-4 border-t border-[#e5e5df]">
        <button
          id="btn-generate-vacation"
          type="submit"
          disabled={isLoading}
          className="w-full py-4 px-6 rounded-2xl bg-[#5A5A40] text-white font-serif italic font-medium text-base hover:bg-[#4a4a35] active:scale-[0.99] transition-all shadow-md flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Sparkles className="w-5 h-5 animate-spin" />
              <span>{t("vacation.generating", "Curating Itinerary...")}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>
                {enableSwiper
                  ? t("vacation.submitSwiper", "Launch Activity Discovery & Swiper →")
                  : isMultiDestination
                  ? t("vacation.submitMulti", "Generate Multi-Destination Plan →")
                  : t("vacation.submitSingle", { days: duration })}
              </span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};
