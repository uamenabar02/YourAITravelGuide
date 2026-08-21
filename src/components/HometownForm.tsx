import React, { useState, useEffect } from "react";
import { MapPin, Navigation, Sparkles, Clock, Compass, Sun, ShieldCheck, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { HometownPreferences, TimeAvailability, WeatherData } from "../types";
import { fetchLiveWeather, reverseGeocode } from "../utils/weather";
import { getRecentExcludedPlaces, getPermanentSkips, getPermanentSkipNames } from "../utils/storage";
import { DestinationAdvisor } from "./DestinationAdvisor";
import { findVerifiedDestination } from "../utils/destinations";

interface HometownFormProps {
  onSubmit: (prefs: HometownPreferences) => void;
  isLoading: boolean;
  onOpenHistory: () => void;
}

const OCCASIONS = [
  { label: "Solo Chill & Read", icon: "☕", desc: "Quiet roasteries, bookshops, parks" },
  { label: "Date Night & Ambiance", icon: "🍷", desc: "Atmospheric bistros, sunset spots" },
  { label: "Outdoor Adventure", icon: "🥾", desc: "Scenic trails, viewpoints, riverbanks" },
  { label: "Rainy Day Indoor", icon: "☔", desc: "Museums, cozy cafes, craft galleries" },
  { label: "Local Tapas & Eateries", icon: "🥘", desc: "Authentic hidden food counters" },
  { label: "Nature & River Spots", icon: "🌿", desc: "Green sanctuaries & wetlands" },
  { label: "Hidden Gems & Vintage", icon: "💎", desc: "Indie vinyl, thrift, secret gardens" },
  { label: "Family Fun Outing", icon: "🪁", desc: "Interactive parks & family treats" },
];

const WEATHER_PRESETS = [
  { label: "Sunny & Mild (22°C)", condition: "Sunny & Mild", temp: 22 },
  { label: "Overcast & Crisp (16°C)", condition: "Overcast & Crisp", temp: 16 },
  { label: "Rainy & Cozy (14°C)", condition: "Rainy & Cozy", temp: 14 },
  { label: "Warm Summer Evening (26°C)", condition: "Warm Summer Evening", temp: 26 },
  { label: "Brisk & Chilly (8°C)", condition: "Brisk & Chilly", temp: 8 },
];

export const HometownForm: React.FC<HometownFormProps> = ({ onSubmit, isLoading, onOpenHistory }) => {
  const [location, setLocation] = useState("Azpeitia, Spain");
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [timeAvailable, setTimeAvailable] = useState<TimeAvailability>("half-day");
  const [occasion, setOccasion] = useState("Solo Chill & Read");
  const [weatherCondition, setWeatherCondition] = useState("Sunny & Mild (22°C)");
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [liveWeatherData, setLiveWeatherData] = useState<WeatherData | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customNotes, setCustomNotes] = useState("");

  const verifiedTown = findVerifiedDestination(location);
  const excludedCount = getRecentExcludedPlaces(location).length;
  const permanentSkipCount = getPermanentSkips().length;

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

    onSubmit({
      location: location.trim(),
      radiusKm,
      timeAvailable,
      occasion,
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
            <span>Hometown Local Guide</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <p className="text-sm text-[#6b6b5e] font-sans">
              Native resident outings with zero tourist traps, tuned to weather & free time.
            </p>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-50 text-amber-900 border border-amber-200/90 px-2.5 py-0.5 rounded-full shadow-2xs">
              <Sparkles className="w-3 h-3 text-amber-600 animate-pulse" />
              <span>Real-Time Live Search: Concerts, Markets & Sports</span>
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* 1. Location Input + GPS Button */}
        <div>
          <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#5A5A40]" />
              Current Town or Neighborhood
            </span>
            {verifiedTown ? (
              <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Verified Town Coordinates
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-[#5A5A40] bg-[#ecece4] px-2.5 py-0.5 rounded-full border border-[#d1d1ca]">
                Native Resident Mode
              </span>
            )}
          </label>
          <div className="flex space-x-2">
            <div className="flex-1">
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
              className="px-4 py-3 rounded-xl bg-[#ecece4] text-[#5A5A40] hover:bg-[#e5e5df] border border-[#d1d1ca] font-medium text-xs sm:text-sm flex items-center space-x-1.5 transition-colors disabled:opacity-50 h-[46px] shrink-0"
            >
              {isDetectingLocation ? (
                <div className="w-4 h-4 border-2 border-[#5A5A40] border-t-transparent rounded-full animate-spin" />
              ) : (
                <Navigation className="w-4 h-4 text-[#5A5A40]" />
              )}
              <span className="hidden sm:inline">Use GPS</span>
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
                <Compass className="w-3.5 h-3.5 text-[#5A5A40]" />
                Type your town or neighborhood to verify exact GPS coordinates & boundary
              </span>
              <span className="text-[10px] text-[#8a8a7e] font-mono">Max Search Radius: {radiusKm} km</span>
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
                Exploration Radius
              </label>
              <span className="font-serif italic font-semibold text-sm text-[#2c2c24] bg-white px-3 py-0.5 rounded-full border border-[#d1d1ca]">
                {radiusKm} km ({Math.round(radiusKm * 0.621371)} miles)
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
              <span>5 km (Walk/Bike)</span>
              <span>15 km (Neighborhood)</span>
              <span>30 km (District)</span>
              <span>50 km</span>
            </div>
          </div>

          {/* Time Available Selector */}
          <div className="bg-[#f5f5f0] p-5 rounded-2xl border border-[#e5e5df]">
            <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-2.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#5A5A40]" />
              Time Available Today
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTimeAvailable("quick")}
                className={`py-2 px-2 rounded-xl text-xs flex flex-col items-center justify-center transition-all border ${
                  timeAvailable === "quick"
                    ? "bg-white text-[#2c2c24] border-[#5A5A40] shadow-xs font-semibold"
                    : "bg-[#ecece4] text-[#6b6b5e] border-transparent hover:bg-white"
                }`}
              >
                <span className="font-serif italic">⚡ Quick</span>
                <span className="text-[10px] text-[#8a8a7e] mt-0.5">1-2 hours</span>
              </button>

              <button
                type="button"
                onClick={() => setTimeAvailable("half-day")}
                className={`py-2 px-2 rounded-xl text-xs flex flex-col items-center justify-center transition-all border ${
                  timeAvailable === "half-day"
                    ? "bg-white text-[#2c2c24] border-[#5A5A40] shadow-xs font-semibold"
                    : "bg-[#ecece4] text-[#6b6b5e] border-transparent hover:bg-white"
                }`}
              >
                <span className="font-serif italic">🌤️ Half-Day</span>
                <span className="text-[10px] text-[#8a8a7e] mt-0.5">3-5 hours</span>
              </button>

              <button
                type="button"
                onClick={() => setTimeAvailable("full-day")}
                className={`py-2 px-2 rounded-xl text-xs flex flex-col items-center justify-center transition-all border ${
                  timeAvailable === "full-day"
                    ? "bg-white text-[#2c2c24] border-[#5A5A40] shadow-xs font-semibold"
                    : "bg-[#ecece4] text-[#6b6b5e] border-transparent hover:bg-white"
                }`}
              >
                <span className="font-serif italic">🌅 Full Day</span>
                <span className="text-[10px] text-[#8a8a7e] mt-0.5">All Day</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3. Occasion / Vibe Selection Grid */}
        <div>
          <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-2.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span>🎯</span>
              Occasion & Desired Vibe
            </span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {OCCASIONS.map((occ) => {
              const isSelected = occasion === occ.label;
              return (
                <button
                  key={occ.label}
                  type="button"
                  onClick={() => setOccasion(occ.label)}
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    isSelected
                      ? "bg-white border-[#5A5A40] ring-1 ring-[#5A5A40] shadow-xs"
                      : "bg-[#f5f5f0] border-[#e5e5df] hover:bg-white"
                  }`}
                >
                  <div className="text-xl mb-1">{occ.icon}</div>
                  <div className="font-serif italic font-semibold text-xs sm:text-sm text-[#2c2c24] leading-snug">{occ.label}</div>
                  <div className="text-[11px] text-[#6b6b5e] mt-0.5 line-clamp-1">{occ.desc}</div>
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
              Current Weather Context
            </span>
            {liveWeatherData?.isAutoDetected && (
              <span className="text-[10px] text-[#5A5A40] bg-[#ecece4] px-2.5 py-0.5 rounded-full border border-[#d1d1ca] font-medium">
                Live Sensor Sync
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
              <option value="">Presets...</option>
              {WEATHER_PRESETS.map((p) => (
                <option key={p.label} value={p.label}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 5. 30-Day Deduplication Banner */}
        <div className="bg-[#ecece4] border border-[#d1d1ca] rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <ShieldCheck className="w-5 h-5 text-[#5A5A40] shrink-0" />
            <div>
              <div className="text-xs font-serif italic font-semibold text-[#2c2c24]">
                30-Day Anti-Repeat Memory Active
              </div>
              <div className="text-[11px] text-[#6b6b5e]">
                {excludedCount > 0 || permanentSkipCount > 0
                  ? `Filtering out ${excludedCount} recent + ${permanentSkipCount} permanently excluded spots for ${location.split(",")[0]}`
                  : "Automatically tracks history to prevent suggesting recently visited places"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenHistory}
            className="text-xs font-serif italic text-[#5A5A40] hover:text-[#2c2c24] underline shrink-0 ml-2"
          >
            Manage
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
            <span>{showAdvanced ? "Hide" : "Add"} Resident Specifics (Dog friendly, craft roastery, bike path)</span>
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
            className="w-full bg-[#5A5A40] hover:bg-[#4a4a35] text-white py-4 rounded-2xl font-serif italic text-lg shadow-sm flex items-center justify-center space-x-2 transition-colors active:scale-[0.99] disabled:opacity-75 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="font-sans text-sm font-medium">Scouting Local Gems within {radiusKm}km...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-amber-200" />
                <span>Discover Local Outing in {location.split(",")[0]}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
};
