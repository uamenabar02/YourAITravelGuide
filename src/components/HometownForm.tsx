import React, { useState, useEffect } from "react";
import { MapPin, Navigation, Sparkles, Clock, Compass, Sun, ShieldCheck, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Loader2, Bus, Car, Bike, Search, Footprints } from "lucide-react";
import { HometownPreferences, TimeAvailability, TransportMode, WeatherData, Coordinates } from "../types";
import { fetchLiveWeather, reverseGeocode } from "../utils/weather";
import { getRecentExcludedPlaces, getPermanentSkips, getPermanentSkipNames } from "../utils/storage";
import { DestinationAdvisor } from "./DestinationAdvisor";
import { findVerifiedDestination } from "../utils/destinations";
import { useLanguage } from "../context/LanguageContext";
import { AccommodationMapPickerModal } from "./AccommodationMapPickerModal";
import { TranslatedText } from "./TranslatedText";

interface HometownFormProps {
  onSubmit: (prefs: HometownPreferences) => void;
  isLoading: boolean;
  onOpenHistory: () => void;
}

const OCCASIONS = [
  { id: "beach", key: "occ.beach", descKey: "occ.beachDesc", icon: "🏖️", defaultLabel: "Beaches & Swim Spots" },
  { id: "solo", key: "occ.solo", descKey: "occ.soloDesc", icon: "☕", defaultLabel: "Solo Chill & Read" },
  { id: "date", key: "occ.date", descKey: "occ.dateDesc", icon: "🍷", defaultLabel: "Date Night & Ambiance" },
  { id: "adventure", key: "occ.adventure", descKey: "occ.adventureDesc", icon: "🥾", defaultLabel: "Outdoor Adventure" },
  { id: "rainy", key: "occ.rainy", descKey: "occ.rainyDesc", icon: "☔", defaultLabel: "Rainy Day Indoor" },
  { id: "tapas", key: "occ.tapas", descKey: "occ.tapasDesc", icon: "🥘", defaultLabel: "Local Tapas & Eateries" },
  { id: "nature", key: "occ.nature", descKey: "occ.natureDesc", icon: "🌿", defaultLabel: "Nature & River Spots" },
  { id: "vintage", key: "occ.vintage", descKey: "occ.vintageDesc", icon: "💎", defaultLabel: "Hidden Gems & Vintage" },
  { id: "family", key: "occ.family", descKey: "occ.familyDesc", icon: "🪁", defaultLabel: "Family Fun Outing" },
  { id: "sunsetSunrise", key: "occ.sunsetSunrise", descKey: "occ.sunsetSunriseDesc", icon: "🌅", defaultLabel: "Sunset & Sunrise Spots" },
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
  const [occasions, setOccasions] = useState<string[]>(["Solo Chill & Read"]);

  const toggleTransportMode = (mode: TransportMode) => {
    setTransportModes((prev) => {
      if (prev.includes(mode)) {
        if (prev.length === 1) return prev;
        return prev.filter((m) => m !== mode);
      }
      return [...prev, mode];
    });
  };

  const toggleOccasion = (occLabel: string) => {
    setOccasions((prev) => {
      if (prev.includes(occLabel)) {
        if (prev.length === 1) return prev; // keep at least 1 vibe
        return prev.filter((o) => o !== occLabel);
      }
      return [...prev, occLabel];
    });
  };

  const [weatherCondition, setWeatherCondition] = useState("Sunny & Mild (22°C)");
  const [startDate, setStartDate] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [startLocation, setStartLocation] = useState<string>("");
  const [startLocationCoordinates, setStartLocationCoordinates] = useState<Coordinates | undefined>(undefined);
  const [isStartLocationVerified, setIsStartLocationVerified] = useState<boolean>(false);
  const [isSearchingStartAddress, setIsSearchingStartAddress] = useState<boolean>(false);
  const [startAddressSuggestions, setStartAddressSuggestions] = useState<{ displayName: string; coords: Coordinates }[]>([]);

  // End Time & Return Location states
  const [endTime, setEndTime] = useState<string>("");
  const [endLocation, setEndLocation] = useState<string>("");
  const [endLocationCoordinates, setEndLocationCoordinates] = useState<Coordinates | undefined>(undefined);
  const [isEndLocationVerified, setIsEndLocationVerified] = useState<boolean>(false);
  const [isSearchingEndAddress, setIsSearchingEndAddress] = useState<boolean>(false);
  const [endAddressSuggestions, setEndAddressSuggestions] = useState<{ displayName: string; coords: Coordinates }[]>([]);

  // Map Picker Modal target ('start' | 'end')
  const [mapPickerTarget, setMapPickerTarget] = useState<"start" | "end">("start");
  const [isMapPickerOpen, setIsMapPickerOpen] = useState<boolean>(false);

  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [liveWeatherData, setLiveWeatherData] = useState<WeatherData | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customNotes, setCustomNotes] = useState("");

  const verifiedTown = findVerifiedDestination(location);
  const excludedCount = getRecentExcludedPlaces(location).length;
  const permanentSkipCount = getPermanentSkips().length;

  // Verify search address using Nominatim (Start location)
  const handleVerifyStartLocation = async () => {
    if (!startLocation.trim()) return;
    setIsSearchingStartAddress(true);
    try {
      const townContext = location.split(",")[0] || location;
      const query = startLocation.toLowerCase().includes(townContext.toLowerCase())
        ? startLocation
        : `${startLocation}, ${location}`;

      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=4`,
        { headers: { "Accept-Language": "en" } }
      );

      if (res.ok) {
        const items = await res.json();
        if (Array.isArray(items) && items.length > 0) {
          const formatted = items.map((i: any) => ({
            displayName: i.display_name,
            coords: { lat: parseFloat(i.lat), lng: parseFloat(i.lon) },
          }));
          setStartAddressSuggestions(formatted);
          setStartLocationCoordinates(formatted[0].coords);
          setIsStartLocationVerified(true);
        } else {
          setStartAddressSuggestions([]);
          setIsStartLocationVerified(false);
        }
      }
    } catch (err) {
      console.warn("Start location search error:", err);
    } finally {
      setIsSearchingStartAddress(false);
    }
  };

  const handlePickStartSuggestion = (sug: { displayName: string; coords: Coordinates }) => {
    setStartLocation(sug.displayName);
    setStartLocationCoordinates(sug.coords);
    setIsStartLocationVerified(true);
    setStartAddressSuggestions([]);
  };

  // Verify search address using Nominatim (End location)
  const handleVerifyEndLocation = async () => {
    if (!endLocation.trim()) return;
    setIsSearchingEndAddress(true);
    try {
      const townContext = location.split(",")[0] || location;
      const query = endLocation.toLowerCase().includes(townContext.toLowerCase())
        ? endLocation
        : `${endLocation}, ${location}`;

      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=4`,
        { headers: { "Accept-Language": "en" } }
      );

      if (res.ok) {
        const items = await res.json();
        if (Array.isArray(items) && items.length > 0) {
          const formatted = items.map((i: any) => ({
            displayName: i.display_name,
            coords: { lat: parseFloat(i.lat), lng: parseFloat(i.lon) },
          }));
          setEndAddressSuggestions(formatted);
          setEndLocationCoordinates(formatted[0].coords);
          setIsEndLocationVerified(true);
        } else {
          setEndAddressSuggestions([]);
          setIsEndLocationVerified(false);
        }
      }
    } catch (err) {
      console.warn("End location search error:", err);
    } finally {
      setIsSearchingEndAddress(false);
    }
  };

  const handlePickEndSuggestion = (sug: { displayName: string; coords: Coordinates }) => {
    setEndLocation(sug.displayName);
    setEndLocationCoordinates(sug.coords);
    setIsEndLocationVerified(true);
    setEndAddressSuggestions([]);
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
    const primaryOccasion = occasions.join(", ");

    onSubmit({
      location: location.trim(),
      radiusKm,
      startDate: startDate.trim() || undefined,
      startTime: startTime.trim() || undefined,
      startLocation: startLocation.trim() || undefined,
      startLocationCoordinates,
      isStartLocationVerified,
      endTime: endTime.trim() || undefined,
      endLocation: endLocation.trim() || undefined,
      endLocationCoordinates,
      isEndLocationVerified,
      timeAvailable,
      transportMode: transportModes[0] || "public_transit",
      transportModes,
      occasion: primaryOccasion,
      occasions,
      weatherCondition,
      currentTemp: liveWeatherData?.temperature,
      excludedPlaces,
      permanentSkips: getPermanentSkipNames(),
      customNotes: customNotes.trim() || undefined,
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
                <div className="mt-2.5 text-[#333d31] font-sans flex-wrap items-center gap-1.5 text-[11px] hidden sm:flex">
                  <span className="font-semibold text-emerald-900">
                    <TranslatedText text="Local Spots within radius:" />
                  </span>
                  {verifiedTown.popularSpots.slice(0, 4).map((spot, i) => (
                    <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full bg-white text-[#2c352a] border border-emerald-200/90 shadow-2xs font-medium">
                      📍 {spot}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-2.5 text-[11px] text-emerald-900 italic font-serif border-t border-emerald-200/80 pt-2 flex flex-wrap items-center justify-between gap-2">
                <span>
                  <TranslatedText text={`AI Strict Radius Boundary: Search will be constrained within ${radiusKm} km of ${verifiedTown.name}.`} />
                </span>
                <span className="not-italic font-sans font-bold text-[10px] text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300/80 flex items-center gap-1">
                  🔒 {radiusKm} km <TranslatedText text="Limit Enforced" />
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#6b6b5e] px-1 font-sans">
              <span className="flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-[#5A5A40] shrink-0" />
                <TranslatedText text="Type your town or neighborhood to verify exact GPS coordinates & boundary" />
              </span>
              <span className="text-[10px] text-[#8a8a7e] font-mono whitespace-nowrap">
                <TranslatedText text="Max Search Radius" />: {radiusKm} km
              </span>
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

        {/* 2c. Start Time, End Time & Location Context (Optional Inputs) */}
        <div className="bg-[#f5f5f0] p-5 rounded-2xl border border-[#e5e5df] space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#e5e5df]">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#5A5A40]" />
              <h3 className="font-serif italic font-semibold text-sm text-[#2c2c24]">
                {t("hometown.timingRoutingHeader", "Outing Schedule & Routing (Optional)")}
              </h3>
            </div>
            <span className="text-[10px] text-[#8a8a7e] font-sans italic">
              {t("hometown.optionalNotice", "Leave blank for AI-chosen natural start/end")}
            </span>
          </div>

          {/* Grid of Start and End options */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* START POINT */}
            <div className="space-y-3 bg-white p-3.5 rounded-xl border border-[#e5e5df]">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                  {t("hometown.startTimeLabel", "1. Departure Point & Start Time")}
                </label>
                {isStartLocationVerified && (
                  <span className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    {t("hometown.locationVerified", "Verified")}
                  </span>
                )}
              </div>

              {/* Start Time input */}
              <div className="flex gap-2 items-center">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  placeholder="e.g. 09:30"
                  className="px-3 py-1.5 rounded-xl border border-[#d1d1ca] bg-[#f9f9f6] text-xs text-[#2c2c24] font-medium focus:outline-none focus:ring-1 focus:ring-[#5A5A40] h-[36px]"
                />
                <div className="hidden sm:flex flex-wrap gap-1 flex-1">
                  {["09:00", "11:30", "14:00", "18:00"].map((timeVal) => (
                    <button
                      key={timeVal}
                      type="button"
                      onClick={() => setStartTime(startTime === timeVal ? "" : timeVal)}
                      className={`px-2 py-0.5 rounded-lg text-[11px] border transition-colors ${
                        startTime === timeVal
                          ? "bg-[#5A5A40] text-white border-[#5A5A40]"
                          : "bg-white text-[#5A5A40] border-[#d1d1ca] hover:bg-[#ecece4]"
                      }`}
                    >
                      {timeVal}
                    </button>
                  ))}
                  {startTime && (
                    <button
                      type="button"
                      onClick={() => setStartTime("")}
                      className="text-[10px] text-amber-800 hover:underline px-1 cursor-pointer"
                    >
                      <TranslatedText text="Clear" />
                    </button>
                  )}
                </div>
              </div>

              {/* Start Address input */}
              <div className="flex gap-1.5 w-full">
                <input
                  type="text"
                  value={startLocation}
                  onChange={(e) => {
                    setStartLocation(e.target.value);
                    setIsStartLocationVerified(false);
                  }}
                  placeholder={t("hometown.startLocationPlaceholder", "e.g. Calle Mayor 14 or Central Station")}
                  className="flex-1 min-w-0 px-3 py-1.5 rounded-xl border border-[#d1d1ca] bg-[#f9f9f6] text-xs text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40] h-[36px]"
                />
                <button
                  type="button"
                  onClick={handleVerifyStartLocation}
                  disabled={isSearchingStartAddress || !startLocation.trim()}
                  className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 bg-[#ecece4] hover:bg-[#d1d1ca] text-[#2c2c24] text-xs font-semibold rounded-xl transition-colors shrink-0 disabled:opacity-50 h-[36px]"
                >
                  {isSearchingStartAddress ? (
                    <Loader2 className="w-3 h-3 animate-spin text-[#5A5A40]" />
                  ) : (
                    <Search className="w-3 h-3 text-[#5A5A40]" />
                  )}
                  <span className="text-[11px]">{t("hometown.verify", "Verify")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMapPickerTarget("start");
                    setIsMapPickerOpen(true);
                  }}
                  className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold rounded-xl flex items-center gap-1 transition-colors shrink-0 h-[36px]"
                >
                  <MapPin className="w-3 h-3 text-amber-700" />
                  <span className="text-[11px]">{t("hometown.pinMap", "Pin")}</span>
                </button>
              </div>

              {/* Suggestions List for Start */}
              {startAddressSuggestions.length > 0 && (
                <div className="mt-1.5 p-2 bg-white border border-[#d1d1ca] rounded-xl space-y-1 shadow-sm">
                  {startAddressSuggestions.map((sug, idx) => (
                    <div
                      key={idx}
                      onClick={() => handlePickStartSuggestion(sug)}
                      className="p-1.5 hover:bg-[#f5f5f0] rounded-lg cursor-pointer text-xs flex items-center justify-between border border-transparent hover:border-[#e5e5df]"
                    >
                      <span className="font-medium text-[#2c2c24] truncate">{sug.displayName}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* END POINT */}
            <div className="space-y-3 bg-white p-3.5 rounded-xl border border-[#e5e5df]">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-700" />
                  {t("hometown.endTimeLabel", "2. Final Return Location & Wrap-up Time")}
                </label>
                {isEndLocationVerified && (
                  <span className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    {t("hometown.locationVerified", "Verified")}
                  </span>
                )}
              </div>

              {/* End Time input */}
              <div className="flex gap-2 items-center">
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  placeholder="e.g. 18:00"
                  className="px-3 py-1.5 rounded-xl border border-[#d1d1ca] bg-[#f9f9f6] text-xs text-[#2c2c24] font-medium focus:outline-none focus:ring-1 focus:ring-[#5A5A40] h-[36px]"
                />
                <div className="hidden sm:flex flex-wrap gap-1 flex-1">
                  {["13:30", "17:00", "20:30", "23:00"].map((timeVal) => (
                    <button
                      key={timeVal}
                      type="button"
                      onClick={() => setEndTime(endTime === timeVal ? "" : timeVal)}
                      className={`px-2 py-0.5 rounded-lg text-[11px] border transition-colors ${
                        endTime === timeVal
                          ? "bg-[#5A5A40] text-white border-[#5A5A40]"
                          : "bg-white text-[#5A5A40] border-[#d1d1ca] hover:bg-[#ecece4]"
                      }`}
                    >
                      {timeVal}
                    </button>
                  ))}
                  {endTime && (
                    <button
                      type="button"
                      onClick={() => setEndTime("")}
                      className="text-[10px] text-amber-800 hover:underline px-1 cursor-pointer"
                    >
                      <TranslatedText text="Clear" />
                    </button>
                  )}
                </div>
              </div>

              {/* End Address input */}
              <div className="flex gap-1.5 w-full">
                <input
                  type="text"
                  value={endLocation}
                  onChange={(e) => {
                    setEndLocation(e.target.value);
                    setIsEndLocationVerified(false);
                  }}
                  placeholder={t("hometown.endLocationPlaceholder", "e.g. Home, Hotel, or Plaza Gipuzkoa")}
                  className="flex-1 min-w-0 px-3 py-1.5 rounded-xl border border-[#d1d1ca] bg-[#f9f9f6] text-xs text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40] h-[36px]"
                />
                <button
                  type="button"
                  onClick={handleVerifyEndLocation}
                  disabled={isSearchingEndAddress || !endLocation.trim()}
                  className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 bg-[#ecece4] hover:bg-[#d1d1ca] text-[#2c2c24] text-xs font-semibold rounded-xl transition-colors shrink-0 disabled:opacity-50 h-[36px] cursor-pointer"
                >
                  {isSearchingEndAddress ? (
                    <Loader2 className="w-3 h-3 animate-spin text-[#5A5A40]" />
                  ) : (
                    <Search className="w-3 h-3 text-[#5A5A40]" />
                  )}
                  <span className="text-[11px]">{t("hometown.verify", "Verify")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMapPickerTarget("end");
                    setIsMapPickerOpen(true);
                  }}
                  className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold rounded-xl flex items-center gap-1 transition-colors shrink-0 h-[36px] cursor-pointer"
                >
                  <MapPin className="w-3 h-3 text-amber-700" />
                  <span className="text-[11px]">{t("hometown.pinMap", "Pin")}</span>
                </button>
              </div>

              {/* Suggestions List for End */}
              {endAddressSuggestions.length > 0 && (
                <div className="mt-1.5 p-2 bg-white border border-[#d1d1ca] rounded-xl space-y-1 shadow-sm">
                  {endAddressSuggestions.map((sug, idx) => (
                    <div
                      key={idx}
                      onClick={() => handlePickEndSuggestion(sug)}
                      className="p-1.5 hover:bg-[#f5f5f0] rounded-lg cursor-pointer text-xs flex items-center justify-between border border-transparent hover:border-[#e5e5df]"
                    >
                      <span className="font-medium text-[#2c2c24] truncate">{sug.displayName}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2b. Primary Means of Transport */}
        <div className="bg-[#f5f5f0] p-4 rounded-2xl border border-[#e5e5df]">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] flex items-center gap-1.5">
              <Bus className="w-3.5 h-3.5 text-[#5A5A40]" />
              {t("vacation.transportHeading", "Means of Transport")}
            </label>
            <span className="text-[10px] text-[#5A5A40] bg-white px-2 py-0.5 rounded-full border border-[#d1d1ca] font-mono">
              {t("vacation.transportMulti", "Multiple Choice")}
            </span>
          </div>
          <p className="text-xs text-[#6b6b5e] mb-3 font-sans">
            {t("vacation.transportDesc", "Select all transportation options available during your outing:")}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {[
              {
                mode: "public_transit" as TransportMode,
                keyLabel: "hometown.transportPublic",
                label: "Public Transit",
                icon: <Bus className="w-4 h-4" />,
                keyDesc: "hometown.transportPublicDesc",
                desc: "Buses, metro, trams & local trains",
              },
              {
                mode: "walking" as TransportMode,
                keyLabel: "hometown.transportWalking",
                label: "Walking / On Foot",
                icon: <Footprints className="w-4 h-4" />,
                keyDesc: "hometown.transportWalkingDesc",
                desc: "Pedestrian routes & neighborhood walks",
              },
              {
                mode: "car" as TransportMode,
                keyLabel: "vacation.transportCar",
                label: "Private / Rental Car",
                icon: <Car className="w-4 h-4" />,
                keyDesc: "vacation.transportCarDesc",
                desc: "Excursions & local drives",
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
                  className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
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
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                  </div>
                  <div>
                    <div className="font-serif italic font-semibold text-xs leading-tight">
                      {t(tItem.keyLabel, tItem.label)}
                    </div>
                    <div
                      className={`hidden sm:block text-[10px] mt-0.5 font-sans ${
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

        {/* 3. Occasion / Vibe Selection Grid (Multiple Choice) */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] flex items-center gap-1.5">
              <span>🎯</span>
              {t("hometown.occasion", "Occasion & Desired Vibe")}
            </label>
            <span className="text-[10px] text-[#5A5A40] bg-[#ecece4] px-2.5 py-0.5 rounded-full border border-[#d1d1ca] font-mono">
              <TranslatedText text="Multiple Choice" />
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {OCCASIONS.map((occ) => {
              const occLabel = t(occ.key) || occ.defaultLabel;
              const occDesc = t(occ.descKey) || (occ.id === "sunsetSunrise" ? "Golden hour lookouts, dawn walks & scenic vistas" : "");
              const isSelected = occasions.includes(occ.defaultLabel) || occasions.includes(occLabel);
              return (
                <button
                  key={occ.id}
                  type="button"
                  onClick={() => toggleOccasion(occ.defaultLabel)}
                  className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                    isSelected
                      ? "bg-[#5A5A40] text-white border-[#5A5A40] shadow-xs"
                      : "bg-[#f5f5f0] text-[#2c2c24] border-[#e5e5df] hover:bg-white"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-lg">{occ.icon}</span>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse" />
                      )}
                    </div>
                    <div className="font-serif italic font-semibold text-xs leading-snug line-clamp-1">
                      {occLabel}
                    </div>
                  </div>
                  <div className={`text-[10px] mt-1 line-clamp-2 ${isSelected ? "text-white/80" : "text-[#6b6b5e]"}`}>
                    {occDesc}
                  </div>
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

        {/* 6. 30-Day Deduplication Banner */}
        <div className="bg-[#ecece4] border border-[#d1d1ca] rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <ShieldCheck className="w-5 h-5 text-[#5A5A40] shrink-0" />
            <div>
              <div className="text-xs font-serif italic font-semibold text-[#2c2c24]">
                {t("hometown.antiRepeat")}
              </div>
              <div className="text-[11px] text-[#6b6b5e]">
                {excludedCount > 0 || permanentSkipCount > 0 ? (
                  <TranslatedText
                    text={`Filtering out ${excludedCount} recent + ${permanentSkipCount} permanently excluded spots for ${location.split(",")[0]}`}
                  />
                ) : (
                  t("hometown.antiRepeatDesc")
                )}
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

      <AccommodationMapPickerModal
        isOpen={isMapPickerOpen}
        onClose={() => setIsMapPickerOpen(false)}
        onSelect={(displayName, coordinates) => {
          if (mapPickerTarget === "end") {
            setEndLocation(displayName);
            setEndLocationCoordinates(coordinates);
            setIsEndLocationVerified(true);
          } else {
            setStartLocation(displayName);
            setStartLocationCoordinates(coordinates);
            setIsStartLocationVerified(true);
          }
          setIsMapPickerOpen(false);
        }}
        cityContext={location}
        initialCoordinates={mapPickerTarget === "end" ? endLocationCoordinates : startLocationCoordinates}
        initialLocationName={mapPickerTarget === "end" ? endLocation : startLocation}
      />
    </form>
  );
};
