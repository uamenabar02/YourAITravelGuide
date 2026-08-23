import React, { useState, useEffect } from "react";
import { MapPin, Navigation, Sparkles, Clock, Compass, Sun, ShieldCheck, ChevronDown, ChevronUp, AlertCircle, Hotel, Plus, Trash2, Eye, EyeOff, CheckCircle2, Loader2 } from "lucide-react";
import { HometownPreferences, TimeAvailability, TransportMode, WeatherData, Coordinates } from "../types";
import { fetchLiveWeather, reverseGeocode } from "../utils/weather";
import { getRecentExcludedPlaces, getPermanentSkips, getPermanentSkipNames } from "../utils/storage";
import { DestinationAdvisor } from "./DestinationAdvisor";
import { findVerifiedDestination } from "../utils/destinations";
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
        <label className="block text-[10px] uppercase tracking-wider font-bold text-[#6b6b5e] truncate">
          {t("vacation.locationAddress")}
        </label>
        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsMapOpen(true)}
            className="inline-flex items-center gap-1 text-[10px] text-[#5A5A40] hover:text-[#2c2c24] underline font-bold cursor-pointer whitespace-nowrap"
          >
            🗺️ {t("vacation.pinOnMap")}
          </button>
          {isVerified && coordinates ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-mono whitespace-nowrap">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              {t("vacation.geoVerified")} ({coordinates.lat.toFixed(2)}, {coordinates.lng.toFixed(2)})
            </span>
          ) : (
            <span className="text-[10px] text-[#8a8a7e] italic whitespace-nowrap">
              {t("vacation.searchVerify")}
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
          placeholder={t("vacation.accommodationPlaceholder")}
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

interface HometownFormProps {
  onSubmit: (prefs: HometownPreferences) => void;
  isLoading: boolean;
  onOpenHistory: () => void;
}

const OCCASIONS = [
  { id: "solo", key: "occ.solo", descKey: "occ.soloDesc", icon: "☕", defaultLabel: "Solo Chill & Read" },
  { id: "date", key: "occ.date", descKey: "occ.dateDesc", icon: "🍷", defaultLabel: "Date Night & Ambiance" },
  { id: "adventure", key: "occ.adventure", descKey: "occ.adventureDesc", icon: "🥾", defaultLabel: "Outdoor Adventure" },
  { id: "rainy", key: "occ.rainy", descKey: "occ.rainyDesc", icon: "☔", defaultLabel: "Rainy Day Indoor" },
  { id: "tapas", key: "occ.tapas", descKey: "occ.tapasDesc", icon: "🥘", defaultLabel: "Local Tapas & Eateries" },
  { id: "nature", key: "occ.nature", descKey: "occ.natureDesc", icon: "🌿", defaultLabel: "Nature & River Spots" },
  { id: "vintage", key: "occ.vintage", descKey: "occ.vintageDesc", icon: "💎", defaultLabel: "Hidden Gems & Vintage" },
  { id: "family", key: "occ.family", descKey: "occ.familyDesc", icon: "🪁", defaultLabel: "Family Fun Outing" },
];

const WEATHER_PRESETS = [
  { label: "Sunny & Mild (22°C)", condition: "Sunny & Mild", temp: 22 },
  { label: "Overcast & Crisp (16°C)", condition: "Overcast & Crisp", temp: 16 },
  { label: "Rainy & Cozy (14°C)", condition: "Rainy & Cozy", temp: 14 },
  { label: "Warm Summer Evening (26°C)", condition: "Warm Summer Evening", temp: 26 },
  { label: "Brisk & Chilly (8°C)", condition: "Brisk & Chilly", temp: 8 },
];

export const HometownForm: React.FC<HometownFormProps> = ({ onSubmit, isLoading, onOpenHistory }) => {
  const { t } = useLanguage();
  const [location, setLocation] = useState("Azpeitia, Spain");
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [timeAvailable, setTimeAvailable] = useState<TimeAvailability>("half-day");
  const [transportModes, setTransportModes] = useState<TransportMode[]>(["public_transit"]);
  const [occasion, setOccasion] = useState("Solo Chill & Read");

  const toggleTransportMode = (mode: TransportMode) => {
    setTransportModes((prev) => {
      if (prev.includes(mode)) {
        if (prev.length === 1) return prev;
        return prev.filter((m) => m !== mode);
      }
      return [...prev, mode];
    });
  };
  const [weatherCondition, setWeatherCondition] = useState("Sunny & Mild (22°C)");
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [liveWeatherData, setLiveWeatherData] = useState<WeatherData | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customNotes, setCustomNotes] = useState("");

  // Optional Accommodation / Base Stay Context
  const [hasAccommodation, setHasAccommodation] = useState(false);
  const [accommodations, setAccommodations] = useState<
    {
      id: string;
      name: string;
      location: string;
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
      checkOutDay: 1,
      checkOutHour: "11:00",
    },
  ]);

  const verifiedTown = findVerifiedDestination(location);
  const excludedCount = getRecentExcludedPlaces(location).length;
  const permanentSkipCount = getPermanentSkips().length;

  const handleAddAccommodation = () => {
    setAccommodations([
      ...accommodations,
      {
        id: `acc-${Date.now()}`,
        name: "",
        location: "",
        description: "",
        checkInDay: 1,
        checkInHour: "15:00",
        checkOutDay: 1,
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

  // Auto-detect GPS location on click
  const handleDetectGPS = () => {
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by this browser. Please type your town instead.");
      return;
    }
    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const detectedTown = await reverseGeocode(latitude, longitude);
          setLocation(detectedTown);

          const weather = await fetchLiveWeather(latitude, longitude, detectedTown);
          setLiveWeatherData(weather);
          setWeatherCondition(`${weather.condition} (${weather.temperature}°C)`);
        } catch (err) {
          console.error("GPS detection error:", err);
          setGpsError("Could not resolve your location. Please type your town instead.");
        } finally {
          setIsDetectingLocation(false);
        }
      },
      (err) => {
        console.warn("Geolocation permission denied or timed out:", err);
        setIsDetectingLocation(false);
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. Enable it or type your town instead."
            : "Could not detect your location in time. Please type your town instead."
        );
      },
      { timeout: 8000 }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.trim()) return;

    const excludedPlaces = getRecentExcludedPlaces(location);
    let accommodationData = undefined;
    let accommodationsData = undefined;

    if (hasAccommodation) {
      const validList = accommodations
        .filter((a) => a.name.trim() || a.location.trim())
        .map((a) => ({
          id: a.id,
          name: a.name.trim() || "Base Accommodation",
          location: a.location.trim(),
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

    onSubmit({
      location: location.trim(),
      radiusKm,
      timeAvailable,
      transportMode: transportModes[0] || "public_transit",
      transportModes,
      occasion,
      weatherCondition,
      currentTemp: liveWeatherData?.temperature,
      excludedPlaces,
      permanentSkips: getPermanentSkipNames(),
      customNotes: customNotes.trim() || undefined,
      accommodation: accommodationData,
      accommodations: accommodationsData,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 sm:p-8 border border-[#e5e5df] shadow-sm">
      {/* Header title */}
      <div className="flex items-center justify-between pb-5 mb-6 border-b border-[#e5e5df]">
        <div>
          <h2 className="font-serif text-2xl sm:text-3xl font-light text-[#2c2c24] flex items-center gap-2">
            <span>📍</span>
            <span>{t("hometown.title")}</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <p className="text-sm text-[#6b6b5e] font-sans">
              {t("hometown.subtitle")}
            </p>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-50 text-amber-900 border border-amber-200/90 px-2.5 py-0.5 rounded-full shadow-2xs">
              <Sparkles className="w-3 h-3 text-amber-600 animate-pulse" />
              <span>{t("hometown.liveSearchBadge")}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* 1. Location Input + GPS Button */}
        <div>
          <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 truncate">
              <MapPin className="w-3.5 h-3.5 text-[#5A5A40] shrink-0" />
              <span className="truncate">{t("hometown.locationLabel")}</span>
            </span>
            {verifiedTown ? (
              <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1 shrink-0 whitespace-nowrap">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                {t("hometown.verifiedTown")}
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-[#5A5A40] bg-[#ecece4] px-2.5 py-0.5 rounded-full border border-[#d1d1ca] shrink-0 whitespace-nowrap">
                {t("hometown.nativeResident")}
              </span>
            )}
          </label>
          <div className="flex space-x-2">
            <div className="flex-1 min-w-0">
              <DestinationAdvisor
                id="input-hometown-location"
                value={location}
                onChange={setLocation}
                onSelectVerified={(dest) => setLocation(`${dest.name}, ${dest.country}`)}
                placeholder="e.g. Azpeitia, Spain or Silver Lake, Los Angeles"
              />
            </div>
            <button
              id="btn-detect-gps"
              type="button"
              onClick={handleDetectGPS}
              disabled={isDetectingLocation}
              title="Detect Current GPS Coordinates"
              className="px-3 sm:px-4 py-3 rounded-xl bg-[#ecece4] text-[#5A5A40] hover:bg-[#e5e5df] border border-[#d1d1ca] font-medium text-xs sm:text-sm flex items-center space-x-1.5 transition-colors disabled:opacity-50 h-[46px] shrink-0 whitespace-nowrap"
            >
              {isDetectingLocation ? (
                <div className="w-4 h-4 border-2 border-[#5A5A40] border-t-transparent rounded-full animate-spin" />
              ) : (
                <Navigation className="w-4 h-4 text-[#5A5A40]" />
              )}
              <span className="hidden sm:inline">{t("hometown.useGps")}</span>
            </button>
          </div>

          {/* GPS / Geolocation Error Feedback */}
          {gpsError && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{gpsError}</span>
            </div>
          )}

          {/* Verified Destination Advisor Confirmation Banner */}
          {verifiedTown ? (
            <div className="mt-3 p-3.5 bg-emerald-50/80 border border-emerald-200/90 rounded-2xl animate-in fade-in-50 duration-200 text-xs shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 font-serif">
                <div className="flex items-center gap-1.5 text-emerald-950 font-medium text-sm">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{verifiedTown.name}</span>
                  <span className="text-emerald-700/80 text-xs font-sans">({verifiedTown.region}, {verifiedTown.country})</span>
                </div>
                <span className="text-[11px] font-mono font-medium text-emerald-800 bg-emerald-100/90 px-2.5 py-0.5 rounded-md border border-emerald-300/60">
                  GPS Center: {verifiedTown.coordinates.lat.toFixed(4)}° N, {Math.abs(verifiedTown.coordinates.lng).toFixed(4)}° {verifiedTown.coordinates.lng < 0 ? "W" : "E"}
                </span>
              </div>
              {verifiedTown.popularSpots && verifiedTown.popularSpots.length > 0 && (
                <div className="mt-2.5 text-[#333d31] font-sans flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="font-semibold text-emerald-900">Local Spots within radius:</span>
                  {verifiedTown.popularSpots.slice(0, 4).map((spot, i) => (
                    <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full bg-white text-[#2c352a] border border-emerald-200/90 shadow-2xs font-medium">
                      📍 {spot}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-2.5 text-[11px] text-emerald-900 italic font-serif border-t border-emerald-200/80 pt-2 flex flex-wrap items-center justify-between gap-2">
                <span>AI Strict Radius Boundary: Search will be constrained within {radiusKm} km of {verifiedTown.name}.</span>
                <span className="not-italic font-sans font-bold text-[10px] text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300/80 flex items-center gap-1">
                  🔒 {radiusKm} km Limit Enforced
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#6b6b5e] px-1 font-sans">
              <span className="flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-[#5A5A40] shrink-0" />
                Type your town or neighborhood to verify exact GPS coordinates & boundary
              </span>
              <span className="text-[10px] text-[#8a8a7e] font-mono whitespace-nowrap">Max Search Radius: {radiusKm} km</span>
            </div>
          )}
        </div>

        {/* 2. Radius Slider & Time Available */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
          {/* Radius Slider */}
          <div className="bg-[#f5f5f0] p-5 rounded-2xl border border-[#e5e5df]">
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-[#5A5A40]" />
                {t("hometown.radius")}
              </label>
              <span className="font-serif italic font-semibold text-xs sm:text-sm text-[#2c2c24] bg-white px-3 py-0.5 rounded-full border border-[#d1d1ca] whitespace-nowrap">
                {radiusKm} km ({Math.round(radiusKm * 0.621371)} mi)
              </span>
            </div>
            <input
              id="slider-hometown-radius"
              type="range"
              min={5}
              max={50}
              step={5}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="w-full accent-[#5A5A40] cursor-pointer h-2 bg-[#d1d1ca] rounded-lg appearance-none"
            />
            <div className="flex justify-between text-[10px] text-[#8a8a7e] font-medium mt-2">
              <span>5 km</span>
              <span>15 km</span>
              <span>30 km</span>
              <span>50 km</span>
            </div>
          </div>

          {/* Time Available Selector */}
          <div className="bg-[#f5f5f0] p-5 rounded-2xl border border-[#e5e5df]">
            <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-2.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#5A5A40]" />
              {t("hometown.time")}
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTimeAvailable("quick")}
                className={`py-2 px-1.5 rounded-xl text-xs flex flex-col items-center justify-center transition-all border ${
                  timeAvailable === "quick"
                    ? "bg-white text-[#2c2c24] border-[#5A5A40] shadow-xs font-semibold"
                    : "bg-[#ecece4] text-[#6b6b5e] border-transparent hover:bg-white"
                }`}
              >
                <span className="font-serif italic truncate w-full text-center">⚡ {t("hometown.timeQuick")}</span>
                <span className="text-[10px] text-[#8a8a7e] mt-0.5 truncate">{t("hometown.timeQuickHours")}</span>
              </button>

              <button
                type="button"
                onClick={() => setTimeAvailable("half-day")}
                className={`py-2 px-1.5 rounded-xl text-xs flex flex-col items-center justify-center transition-all border ${
                  timeAvailable === "half-day"
                    ? "bg-white text-[#2c2c24] border-[#5A5A40] shadow-xs font-semibold"
                    : "bg-[#ecece4] text-[#6b6b5e] border-transparent hover:bg-white"
                }`}
              >
                <span className="font-serif italic truncate w-full text-center">🌤️ {t("hometown.timeHalf")}</span>
                <span className="text-[10px] text-[#8a8a7e] mt-0.5 truncate">{t("hometown.timeHalfHours")}</span>
              </button>

              <button
                type="button"
                onClick={() => setTimeAvailable("full-day")}
                className={`py-2 px-1.5 rounded-xl text-xs flex flex-col items-center justify-center transition-all border ${
                  timeAvailable === "full-day"
                    ? "bg-white text-[#2c2c24] border-[#5A5A40] shadow-xs font-semibold"
                    : "bg-[#ecece4] text-[#6b6b5e] border-transparent hover:bg-white"
                }`}
              >
                <span className="font-serif italic truncate w-full text-center">🌅 {t("hometown.timeFull")}</span>
                <span className="text-[10px] text-[#8a8a7e] mt-0.5 truncate">{t("hometown.timeFullHours")}</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3. Occasion / Vibe Selection Grid */}
        <div>
          <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-2.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span>🎯</span>
              {t("hometown.occasion")}
            </span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {OCCASIONS.map((occ) => {
              const occLabel = t(occ.key) || occ.defaultLabel;
              const occDesc = t(occ.descKey);
              const isSelected = occasion === occ.defaultLabel || occasion === occLabel;
              return (
                <button
                  key={occ.id}
                  type="button"
                  onClick={() => setOccasion(occ.defaultLabel)}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    isSelected
                      ? "bg-white border-[#5A5A40] ring-1 ring-[#5A5A40] shadow-xs"
                      : "bg-[#f5f5f0] border-[#e5e5df] hover:bg-white"
                  }`}
                >
                  <div className="text-lg mb-1">{occ.icon}</div>
                  <div className="font-serif italic font-semibold text-xs text-[#2c2c24] leading-snug line-clamp-1">{occLabel}</div>
                  <div className="text-[10px] text-[#6b6b5e] mt-0.5 line-clamp-1">{occDesc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Live Weather Integration */}
        <div>
          <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-2.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-[#5A5A40]" />
              {t("hometown.weather")}
            </span>
            {liveWeatherData?.isAutoDetected && (
              <span className="text-[10px] text-[#5A5A40] bg-[#ecece4] px-2.5 py-0.5 rounded-full border border-[#d1d1ca] font-medium">
                {t("hometown.liveSensor")}
              </span>
            )}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2">
              <input
                type="text"
                value={weatherCondition}
                onChange={(e) => setWeatherCondition(e.target.value)}
                placeholder="e.g. Sunny & Warm 24°C or Crisp & Overcast"
                className="w-full px-4 py-2.5 rounded-xl border border-[#d1d1ca] bg-white text-[#2c2c24] text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
              />
            </div>
            <select
              onChange={(e) => setWeatherCondition(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl border border-[#d1d1ca] bg-white text-[#2c2c24] text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
            >
              <option value="">{t("hometown.presets")}</option>
              {WEATHER_PRESETS.map((p) => (
                <option key={p.label} value={p.label}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 5. Booked Accommodation / Stay Context */}
        {!hasAccommodation ? (
          <div className="bg-[#f5f5f0] p-4 sm:p-5 rounded-2xl border border-[#e5e5df] flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white border border-[#d1d1ca] flex items-center justify-center text-[#5A5A40] shrink-0">
                <Hotel className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-semibold text-[#2c2c24] font-serif italic truncate">
                  {t("vacation.accommodationTitle")}
                </h4>
                <p className="text-[11px] text-[#6b6b5e] font-sans truncate">
                  {t("vacation.accommodationSubtitle")}
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
              <span>{t("vacation.showAccommodation")}</span>
            </button>
          </div>
        ) : (
          <div className="bg-[#f5f5f0] p-4 sm:p-5 rounded-2xl border border-[#e5e5df] space-y-4">
            <div className="flex items-center justify-between border-b border-[#e5e5df] pb-3">
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] flex items-center gap-1.5">
                  <Hotel className="w-4 h-4 text-[#5A5A40]" />
                  {t("vacation.accommodationHeading")}
                </label>
                <p className="text-xs text-[#6b6b5e] mt-0.5 font-sans">
                  {t("vacation.accommodationSub")}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setHasAccommodation(false)}
                  className="flex items-center space-x-1 text-[11px] text-[#6b6b5e] hover:text-[#2c2c24] font-serif italic px-2.5 py-1 rounded-lg border border-[#d1d1ca] bg-white transition-colors whitespace-nowrap"
                >
                  <EyeOff className="w-3 h-3" />
                  <span>{t("vacation.hideAccommodation")}</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddAccommodation}
                  className="flex items-center space-x-1 text-[11px] bg-[#5A5A40] text-white px-3 py-1 rounded-xl font-serif italic hover:bg-[#2c2c24] transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3 h-3" />
                  <span>{t("vacation.addStay")}</span>
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {accommodations.map((acc, index) => (
                <div key={acc.id} className="bg-white p-4 rounded-xl border border-[#d1d1ca] space-y-3 shadow-2xs relative">
                  <div className="flex items-center justify-between border-b border-[#ecece4] pb-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#5A5A40] font-mono">
                      {t("vacation.stay")} #{index + 1}
                    </span>
                    {accommodations.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAccommodation(acc.id)}
                        className="p-1 text-[#8a8a7e] hover:text-red-600 transition-colors flex items-center gap-1 text-[11px]"
                        title="Remove stay"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{t("action.delete")}</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-bold text-[#6b6b5e] mb-1">
                        {t("vacation.accommodationName")}
                      </label>
                      <input
                        type="text"
                        value={acc.name}
                        onChange={(e) => handleUpdateAccommodation(acc.id, "name", e.target.value)}
                        placeholder={t("vacation.accommodationPlaceholder")}
                        className="w-full px-3 py-1.5 rounded-xl border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] font-medium placeholder:text-[#8a8a7e] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                      />
                    </div>

                    <AccommodationLocationInput
                      location={acc.location}
                      isVerified={acc.isVerified}
                      coordinates={acc.coordinates}
                      cityContext={location}
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
                          {t("vacation.checkInDay")}
                        </label>
                        <select
                          value={acc.checkInDay}
                          onChange={(e) => handleUpdateAccommodation(acc.id, "checkInDay", Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] font-medium focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                        >
                          <option value={1}>{t("action.day")} 1</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-bold text-[#6b6b5e] mb-1 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#5A5A40]" />
                          {t("vacation.checkInHour")}
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
                          {t("vacation.checkOutDay")}
                        </label>
                        <select
                          value={acc.checkOutDay}
                          onChange={(e) => handleUpdateAccommodation(acc.id, "checkOutDay", Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] font-medium focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                        >
                          <option value={1}>{t("action.day")} 1</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-bold text-[#6b6b5e] mb-1 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#5A5A40]" />
                          {t("vacation.checkOutHour")}
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
                      {t("vacation.accommodationNotes")}
                    </label>
                    <input
                      type="text"
                      value={acc.description}
                      onChange={(e) => handleUpdateAccommodation(acc.id, "description", e.target.value)}
                      placeholder="e.g. Near town hall square, luggage storage available"
                      className="w-full px-3 py-1.5 rounded-xl border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] placeholder:text-[#8a8a7e] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. 30-Day Deduplication Banner */}
        <div className="bg-[#ecece4] border border-[#d1d1ca] rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <ShieldCheck className="w-5 h-5 text-[#5A5A40] shrink-0" />
            <div>
              <div className="text-xs font-serif italic font-semibold text-[#2c2c24]">
                {t("hometown.antiRepeat")}
              </div>
              <div className="text-[11px] text-[#6b6b5e]">
                {excludedCount > 0 || permanentSkipCount > 0
                  ? `Filtering out ${excludedCount} recent + ${permanentSkipCount} permanently excluded spots for ${location.split(",")[0]}`
                  : t("hometown.antiRepeatDesc")}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenHistory}
            className="text-xs font-serif italic text-[#5A5A40] hover:text-[#2c2c24] underline shrink-0 ml-2"
          >
            {t("hometown.manage")}
          </button>
        </div>

        {/* Optional Resident Notes */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center text-xs font-semibold text-[#5A5A40] hover:text-[#2c2c24] gap-1"
          >
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{showAdvanced ? t("hometown.residentNotesHide") : t("hometown.residentNotes")}</span>
          </button>

          {showAdvanced && (
            <div className="mt-2">
              <textarea
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="e.g. Bringing my dog, looking for quiet park benches, want a new local sourdough bakery."
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl border border-[#d1d1ca] bg-white text-[#2c2c24] text-xs focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
              />
            </div>
          )}
        </div>

        {/* Submit Action Button */}
        <div className="pt-2">
          <button
            id="btn-generate-hometown"
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#5A5A40] hover:bg-[#4a4a35] text-white py-4 rounded-2xl font-serif italic text-base sm:text-lg shadow-sm flex items-center justify-center space-x-2 transition-colors active:scale-[0.99] disabled:opacity-75 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="font-sans text-sm font-medium">{t("hometown.discovering", { radius: radiusKm })}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-amber-200" />
                <span>{t("hometown.discoverBtn", { city: location.split(",")[0] })}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
};
