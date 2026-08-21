import React, { useState } from "react";
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
} from "lucide-react";
import { VacationPreferences, PaceType, BudgetTier, DestinationStop } from "../types";
import { DestinationAdvisor } from "./DestinationAdvisor";

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
  { label: "Gastronomy & Local Food", icon: "🍜" },
  { label: "Scenic & Outdoors", icon: "🌲" },
  { label: "History & Architecture", icon: "🏛️" },
  { label: "Family Friendly", icon: "👨‍👩‍👧" },
  { label: "Hidden Gems / Non-Touristy", icon: "💎" },
  { label: "Budget Friendly", icon: "🏷️" },
  { label: "Nightlife & Bars", icon: "🍸" },
  { label: "Art & Culture", icon: "🎨" },
  { label: "Relaxation & Wellness", icon: "🌿" },
];

export const VacationForm: React.FC<VacationFormProps> = ({ onSubmit, isLoading }) => {
  const [destination, setDestination] = useState("Donostia / San Sebastián, Spain");
  const [groupSize, setGroupSize] = useState<number>(2);
  const [duration, setDuration] = useState<number>(3);
  const [pace, setPace] = useState<PaceType>("balanced");
  const [selectedVibes, setSelectedVibes] = useState<string[]>([
    "Gastronomy & Local Food",
    "History & Architecture",
    "Hidden Gems / Non-Touristy",
  ]);

  // Budget settings: Tier vs Exact
  const [budgetType, setBudgetType] = useState<"tier" | "exact">("tier");
  const [budgetTier, setBudgetTier] = useState<BudgetTier>("mid-range");
  const [exactBudgetPerDay, setExactBudgetPerDay] = useState<number>(75);
  const [currency, setCurrency] = useState<string>("€");

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customNotes, setCustomNotes] = useState("");

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

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
            <span>Vacation Itinerary Planner</span>
          </h2>
          <p className="text-sm text-[#6b6b5e] mt-1 font-sans">
            Cost-aware, multi-day cultural itineraries with authentic hidden gems & verified route optimization
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Single vs Multi-Destination Switch */}
        <div className="flex items-center justify-between p-3.5 bg-[#f5f5f0] rounded-2xl border border-[#e5e5df]">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-[#5A5A40]" />
            <span className="text-xs font-serif italic text-[#2c2c24]">Trip Mode:</span>
          </div>

          <div className="flex rounded-xl bg-[#ecece4] p-1 text-xs">
            <button
              type="button"
              onClick={() => setIsMultiDestination(false)}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                !isMultiDestination ? "bg-white text-[#2c2c24] shadow-xs" : "text-[#6b6b5e]"
              }`}
            >
              Single Destination
            </button>
            <button
              type="button"
              onClick={() => setIsMultiDestination(true)}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                isMultiDestination ? "bg-white text-[#2c2c24] shadow-xs" : "text-[#6b6b5e]"
              }`}
            >
              Multi-Destination / Road Trip
            </button>
          </div>
        </div>

        {/* 1. Destination Input (Single Mode) */}
        {!isMultiDestination ? (
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#5A5A40]" />
                Destination City or Region (Advisor & Verifier)
              </span>
              <span className="font-medium text-[#5A5A40]">Precise Geocoding</span>
            </label>

            {/* Smart Destination Advisor Component */}
            <DestinationAdvisor
              value={destination}
              onChange={setDestination}
              placeholder="e.g. Donostia / San Sebastián, Spain"
            />

            {/* Quick Suggestions */}
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              <span className="text-[11px] text-[#8a8a7e] font-medium mr-1 uppercase tracking-wider">Popular:</span>
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
              Multi-City Route Stops
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
                    <span className="text-xs font-serif italic text-[#2c2c24]">Stop {index + 1}</span>
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
                      <span className="text-xs text-[#8a8a7e]">Days:</span>
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
              <span>Add Another Stop / City</span>
            </button>
          </div>
        )}

        {/* 2. Number of People in Vacation Group (Placed below destination input) */}
        <div className="bg-[#f5f5f0] p-4 sm:p-5 rounded-2xl border border-[#e5e5df]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#5A5A40]" />
                Vacation Group Size
              </label>
              <p className="text-xs text-[#6b6b5e] mt-0.5 font-sans">
                Number of people traveling in your party
              </p>
            </div>

            {/* Stepper counter */}
            <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-2xl border border-[#d1d1ca] shadow-xs">
              <button
                type="button"
                onClick={() => setGroupSize(Math.max(1, groupSize - 1))}
                disabled={groupSize <= 1}
                className="w-7 h-7 rounded-xl bg-[#f5f5f0] hover:bg-[#ecece4] text-[#2c2c24] flex items-center justify-center transition-colors disabled:opacity-30"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-12 text-center font-serif italic font-semibold text-sm text-[#2c2c24]">
                {groupSize} {groupSize === 1 ? "Person" : "People"}
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
              { size: 1, label: "Solo Traveler", icon: "👤" },
              { size: 2, label: "Couple (2)", icon: "👫" },
              { size: 4, label: "Small Group (4)", icon: "👨‍👩‍👧" },
              { size: 6, label: "Large Group (6+)", icon: "👥" },
            ].map((p) => (
              <button
                key={p.size}
                type="button"
                onClick={() => setGroupSize(p.size)}
                className={`py-2 px-3 rounded-xl border text-xs font-serif italic flex items-center justify-center space-x-1.5 transition-all ${
                  groupSize === p.size
                    ? "bg-[#5A5A40] text-white border-[#5A5A40] font-medium shadow-xs"
                    : "bg-white text-[#2c2c24] border-[#d1d1ca] hover:border-[#5A5A40]"
                }`}
              >
                <span>{p.icon}</span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 3. Arrival & Departure Hours Constraints */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#f5f5f0] p-4 sm:p-5 rounded-2xl border border-[#e5e5df]">
          <div>
            <label className="text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] flex items-center gap-1.5 mb-1.5">
              <Clock className="w-3.5 h-3.5 text-[#5A5A40]" />
              Arrival Hour (Day 1)
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
              Day 1 starts after your arrival time.
            </p>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] flex items-center gap-1.5 mb-1.5">
              <Clock className="w-3.5 h-3.5 text-[#5A5A40]" />
              Departure Hour (Final Day)
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
              Final day wraps up before your departure time.
            </p>
          </div>
        </div>

        {/* 4. Duration & Pace (Single Mode Duration slider) */}
        {!isMultiDestination && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
            <div className="bg-[#f5f5f0] p-5 rounded-2xl border border-[#e5e5df]">
              <div className="flex items-center justify-between mb-2.5">
                <label className="text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#5A5A40]" />
                  Trip Duration
                </label>
                <div className="flex items-center space-x-2">
                  <span className="font-serif italic font-semibold text-sm text-[#2c2c24] bg-white px-3 py-0.5 rounded-full border border-[#d1d1ca]">
                    {duration} {duration === 1 ? "Day" : "Days"}
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
                <span>1 Day</span>
                <span>3-4 Days</span>
                <span>7 Days</span>
                <span>14 Days</span>
              </div>
            </div>

            {/* Travel Pace Selector */}
            <div className="bg-[#f5f5f0] p-5 rounded-2xl border border-[#e5e5df]">
              <label className="text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-2.5 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-[#5A5A40]" />
                Exploration Pace
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "relaxed", label: "Relaxed", icon: "☕" },
                  { id: "balanced", label: "Balanced", icon: "⚖️" },
                  { id: "action-packed", label: "Packed", icon: "⚡" },
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
                    <span>{item.label}</span>
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
              Travel Vibes & Interests
            </span>
            <span className="text-[10px] text-[#8a8a7e] font-medium">Select all that apply</span>
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
                  <span className="text-sm">{vibe.icon}</span>
                  <span className="font-sans text-[11px] leading-tight">{vibe.label}</span>
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
                Activity Discovery Swiper
                <span className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-white text-[#5A5A40] border border-[#d1d1ca]">
                  Interactive
                </span>
              </span>
              <p className="text-xs text-[#6b6b5e] mt-0.5 font-sans">
                Review & swipe right on candidate spots (with photos, Google Maps opinions & links) before building the final itinerary.
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
              Budget Planning Mode
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
                Subjective Tier
              </button>
              <button
                type="button"
                onClick={() => setBudgetType("exact")}
                className={`px-3 py-1 rounded-lg font-serif italic transition-all ${
                  budgetType === "exact" ? "bg-white text-[#2c2c24] shadow-xs font-semibold" : "text-[#6b6b5e]"
                }`}
              >
                Exact Budget / Day / Person
              </button>
            </div>
          </div>

          {/* Conditional Rendering: Tier vs Exact */}
          {budgetType === "tier" ? (
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              {[
                { id: "budget", label: "Budget-Savvy", desc: "Street food & free vistas" },
                { id: "mid-range", label: "Balanced", desc: "Cozy bistros & iconic spots" },
                { id: "luxury", label: "Luxury", desc: "Michelin stars & private tours" },
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
                  <div className="font-serif italic text-xs text-[#2c2c24]">{tier.label}</div>
                  <div className="text-[10px] text-[#8a8a7e] mt-0.5 line-clamp-1">{tier.desc}</div>
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
                    / person / day
                  </span>
                </div>
              </div>

              {/* Quick budget chip buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-[#8a8a7e] font-bold uppercase tracking-wider mr-1">Quick Select:</span>
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
                  Estimated Total Budget:
                </span>
                <span className="font-semibold text-[#5A5A40]">
                  {currency}{exactBudgetPerDay} × {groupSize} {groupSize === 1 ? "traveler" : "travelers"} × {calculatedTotalDays} {calculatedTotalDays === 1 ? "day" : "days"} = {currency}{exactBudgetPerDay * groupSize * calculatedTotalDays}
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
            <span>Additional traveler requests or dietary notes (Optional)</span>
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showAdvanced && (
            <div className="mt-3">
              <textarea
                id="textarea-custom-notes"
                rows={2}
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="e.g. Vegetarian pintxos, traveling with elderly parents, interested in modern architecture and surf breaks..."
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
              <span>Curating Itinerary...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>
                {enableSwiper
                  ? "Launch Activity Discovery & Swiper →"
                  : isMultiDestination
                  ? "Generate Multi-Destination Plan →"
                  : `Generate ${duration}-Day Itinerary →`}
              </span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};
