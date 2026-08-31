import React, { useState, useEffect, useRef } from "react";
import L from "leaflet";
import { ActivitySpot, ActivityCategory, ItineraryPlan, Coordinates } from "../types";
import {
  X,
  Sparkles,
  ArrowLeftRight,
  Pencil,
  RefreshCw,
  Clock,
  DollarSign,
  MapPin,
  Tag,
  Lightbulb,
  Check,
  Search,
  CheckCircle2,
  Navigation,
  Map,
} from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { AccommodationMapPickerModal } from "./AccommodationMapPickerModal";
import { findVerifiedDestination } from "../utils/destinations";
import { escapeHtml } from "../utils/offlineStorage";

interface SwapSpotModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: ActivitySpot;
  dayNumber: number;
  plan: ItineraryPlan;
  onSaveSwap: (newSpot: ActivitySpot, dayNumber: number) => void;
  onSwapWithExisting: (activityA: ActivitySpot, dayA: number, activityB: ActivitySpot, dayB: number) => void;
  onShowToast: (type: "success" | "error" | "info", msg: string) => void;
}

const CATEGORIES: { value: ActivityCategory; label: string; icon: string }[] = [
  { value: "sightseeing", label: "Landmark & Sightseeing", icon: "📍" },
  { value: "culture", label: "Culture & Museum", icon: "🏛️" },
  { value: "food", label: "Local Food & Eatery", icon: "🍜" },
  { value: "nature", label: "Nature & Walk", icon: "🌲" },
  { value: "cafe", label: "Cafe & Roastery", icon: "☕" },
  { value: "nightlife", label: "Nightlife & Bar", icon: "🍸" },
  { value: "relaxation", label: "Relaxation & Wellness", icon: "🌿" },
  { value: "shopping", label: "Artisan & Shopping", icon: "🛍️" },
  { value: "hidden-gem", label: "Hidden Gem", icon: "💎" },
  { value: "entertainment", label: "Entertainment", icon: "🎭" },
];

const PRESET_SWAP_REASONS = [
  { id: "rain", label: "Rain / Bad Weather", icon: "🌧️", description: "100% Covered & Indoor spots" },
  { id: "tired", label: "Tired / Low Energy", icon: "🥱", description: "Calm sit-down & low walking" },
  { id: "budget", label: "Budget / Cheaper", icon: "💰", description: "Free or low-cost alternatives" },
  { id: "food", label: "Local Food & Eatery", icon: "🍜", description: "Pintxos, local food & cafes" },
  { id: "family", label: "Kid & Family Friendly", icon: "👨‍👩‍👧", description: "Fun & safe for all ages" },
  { id: "quick", label: "Short / Quick Stop", icon: "⏱️", description: "Under 45 mins, quick access" },
  { id: "closed", label: "Closed / Sold Out", icon: "🔒", description: "High walk-in availability" },
  { id: "hidden", label: "Hidden Gem Vibe", icon: "💎", description: "Secret local favorite" },
];

export const SwapSpotModal: React.FC<SwapSpotModalProps> = ({
  isOpen,
  onClose,
  activity,
  dayNumber,
  plan,
  onSaveSwap,
  onSwapWithExisting,
  onShowToast,
}) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"ai" | "existing" | "manual">("ai");
  
  // AI Suggestions state & Swap Context
  const [aiAlternatives, setAiAlternatives] = useState<ActivitySpot[]>([]);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [hasLoadedAi, setHasLoadedAi] = useState(false);
  const [swapReason, setSwapReason] = useState<string>("");
  const [customRequirement, setCustomRequirement] = useState<string>("");
  const [isIndoorOnly, setIsIndoorOnly] = useState<boolean>(false);

  // Preview Candidate State for Realtime Map
  const [selectedCandidate, setSelectedCandidate] = useState<ActivitySpot | null>(null);

  // Manual form state
  const [manualName, setManualName] = useState(activity.name);
  const [manualCategory, setManualCategory] = useState<ActivityCategory>(activity.category);
  const [manualTime, setManualTime] = useState(activity.time);
  const [manualCost, setManualCost] = useState(activity.approxCost || "");
  const [manualDescription, setManualDescription] = useState(activity.description || "");
  const [manualInsiderTip, setManualInsiderTip] = useState(activity.insiderTip || "");
  const [manualAddress, setManualAddress] = useState(activity.address || "");
  const [manualCoords, setManualCoords] = useState<Coordinates | null>(activity.coordinates || null);

  // Location suggestions & verification state
  const [addressSuggestions, setAddressSuggestions] = useState<{ displayName: string; coords: Coordinates }[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [isAddressVerified, setIsAddressVerified] = useState(!!activity.address);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [showMobileMap, setShowMobileMap] = useState(false);

  // Map Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Reset states when opening
  useEffect(() => {
    if (isOpen) {
      setManualName(activity.name);
      setManualCategory(activity.category);
      setManualTime(activity.time);
      setManualCost(activity.approxCost || "");
      setManualDescription(activity.description || "");
      setManualInsiderTip(activity.insiderTip || "");
      setManualAddress(activity.address || "");
      setManualCoords(activity.coordinates || null);
      setIsAddressVerified(!!activity.address);
      setAddressSuggestions([]);
      setSelectedCandidate(null);
      
      // Auto-fetch AI recommendations on open if we are in AI tab
      if (activeTab === "ai") {
        fetchAiAlternatives();
      }
    }
  }, [isOpen, activity]);

  useEffect(() => {
    if (isOpen && activeTab === "ai" && !hasLoadedAi && !isLoadingAi) {
      fetchAiAlternatives();
    }
  }, [activeTab, isOpen]);

  // Sync candidate when alternatives or tab changes
  useEffect(() => {
    if (activeTab === "ai" && aiAlternatives.length > 0 && !selectedCandidate) {
      setSelectedCandidate(aiAlternatives[0]);
    } else if (activeTab === "manual") {
      setSelectedCandidate({
        id: "manual-preview",
        name: manualName || "Custom Spot",
        time: manualTime,
        category: manualCategory,
        description: manualDescription,
        address: manualAddress,
        coordinates: manualCoords || activity.coordinates,
      });
    }
  }, [activeTab, aiAlternatives, manualName, manualAddress, manualCoords]);

  // Real-time Map Initialization & Updating
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      const dayObj = plan.days.find((d) => d.dayNumber === dayNumber);
      const dayActivities = dayObj ? dayObj.activities : [];

      // Default center fallback
      let defaultLat = activity.coordinates?.lat || 43.3183;
      let defaultLng = activity.coordinates?.lng || -1.9812;

      const verified = findVerifiedDestination(plan.destinationOrTown);
      if (verified && verified.coordinates) {
        defaultLat = verified.coordinates.lat;
        defaultLng = verified.coordinates.lng;
      }

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [defaultLat, defaultLng],
          zoom: 14,
          zoomControl: false,
          attributionControl: false,
        });

        L.control.zoom({ position: "topright" }).addTo(map);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap',
        }).addTo(map);

        layerGroupRef.current = L.layerGroup().addTo(map);
        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;
      const group = layerGroupRef.current;
      if (!map || !group) return;

      group.clearLayers();
      const bounds: L.LatLngBounds = L.latLngBounds([]);

      const pathPoints: [number, number][] = [];

      // 1. Render Day Activities
      dayActivities.forEach((act, idx) => {
        const isBeingReplaced = act.id === activity.id;
        const coords = act.coordinates;

        if (coords && typeof coords.lat === "number" && typeof coords.lng === "number") {
          bounds.extend([coords.lat, coords.lng]);

          if (isBeingReplaced) {
            // Render Replaced spot marker (Orange Cross)
            const replacedIcon = L.divIcon({
              className: "",
              html: `
                <div class="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-xs shadow-lg border-2 border-white ring-2 ring-amber-300">
                  <s>${idx + 1}</s>
                </div>
              `,
              iconSize: [32, 32],
              iconAnchor: [16, 16],
            });

            const m = L.marker([coords.lat, coords.lng], { icon: replacedIcon }).addTo(group);
            m.bindPopup(`<b>Original Spot:</b> ${escapeHtml(act.name)} (Being Replaced)`);

            // Add Candidate coordinates to path instead if candidate exists
            if (selectedCandidate?.coordinates) {
              const candLat = selectedCandidate.coordinates.lat;
              const candLng = selectedCandidate.coordinates.lng;
              pathPoints.push([candLat, candLng]);
              bounds.extend([candLat, candLng]);

              const candidateIcon = L.divIcon({
                className: "",
                html: `
                  <div class="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xl border-2 border-white ring-4 ring-emerald-300/60 animate-pulse">
                    ✨
                  </div>
                `,
                iconSize: [36, 36],
                iconAnchor: [18, 18],
              });

              const candMarker = L.marker([candLat, candLng], { icon: candidateIcon }).addTo(group);
              candMarker.bindPopup(`<b>Proposed Swap:</b> ${escapeHtml(selectedCandidate.name)}<br/><i>${escapeHtml(selectedCandidate.address || "")}</i>`);
            } else {
              pathPoints.push([coords.lat, coords.lng]);
            }
          } else {
            // Normal existing spot pin
            const numIcon = L.divIcon({
              className: "",
              html: `
                <div class="w-7 h-7 rounded-full bg-[#5A5A40] text-white flex items-center justify-center font-bold text-xs shadow-md border-2 border-white">
                  ${idx + 1}
                </div>
              `,
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            });

            const m = L.marker([coords.lat, coords.lng], { icon: numIcon }).addTo(group);
            m.bindPopup(`<b>#${idx + 1} ${escapeHtml(act.name)}</b><br/>${escapeHtml(act.time || "")}`);
            pathPoints.push([coords.lat, coords.lng]);
          }
        }
      });

      // Draw polyline connecting updated itinerary flow
      if (pathPoints.length >= 2) {
        L.polyline(pathPoints, {
          color: "#059669",
          weight: 3.5,
          dashArray: "6, 8",
          opacity: 0.85,
        }).addTo(group);
      }

      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [isOpen, dayNumber, activity, selectedCandidate, activeTab]);

  // Clean up Leaflet map instance on modal close or component unmount
  useEffect(() => {
    if (!isOpen && mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
    }
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        layerGroupRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Fetch 3 AI alternatives
  const fetchAiAlternatives = async () => {
    setIsLoadingAi(true);
    try {
      const dayObj = plan.days.find((d) => d.dayNumber === dayNumber);
      const actIndex = dayObj ? dayObj.activities.findIndex((a) => a.id === activity.id) : -1;
      const priorActivity = actIndex > 0 && dayObj ? dayObj.activities[actIndex - 1] : null;
      const posteriorActivity =
        actIndex >= 0 && dayObj && actIndex < dayObj.activities.length - 1
          ? dayObj.activities[actIndex + 1]
          : null;

      const allItineraryActivityNames = plan.days.flatMap((d) =>
        d.activities.map((a) => a.name)
      );

      const res = await fetch("/api/swap-alternatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationOrTown: plan.destinationOrTown,
          mode: plan.mode,
          dayNumber,
          timeSlot: activity.time,
          currentActivityName: activity.name,
          category: activity.category,
          priorActivity,
          posteriorActivity,
          allItineraryActivityNames,
          vibes: plan.tags || [],
          budgetTier: plan.budgetTier,
          pace: plan.customPace,
          swapReason: swapReason || undefined,
          customRequirement: customRequirement || undefined,
          isIndoorOnly: isIndoorOnly || swapReason === "rain",
          excludedPlaces: [],
          permanentSkips: [],
          tasteProfile: undefined,
        }),
      });

      if (!res.ok) throw new Error("Alternatives fetch failed");
      const list: ActivitySpot[] = await res.json();
      setAiAlternatives(list);
      setHasLoadedAi(true);
      if (list.length > 0) {
        setSelectedCandidate(list[0]);
      }
    } catch (err) {
      console.error("Failed to load AI swap alternatives:", err);
      onShowToast("error", "Failed to propose AI alternatives. Please try again.");
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleSelectAiAlternative = (alt: ActivitySpot) => {
    const finalAlt = { ...alt, time: activity.time };
    onSaveSwap(finalAlt, dayNumber);
    onShowToast("success", `Successfully replaced with "${alt.name}"!`);
    onClose();
  };

  const handleSelectExistingSwap = (otherAct: ActivitySpot, otherDayNum: number) => {
    onSwapWithExisting(activity, dayNumber, otherAct, otherDayNum);
    onShowToast("success", `Swapped "${activity.name}" with "${otherAct.name}"!`);
    onClose();
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) return;

    const manualSpot: ActivitySpot = {
      ...activity,
      name: manualName.trim(),
      time: manualTime.trim(),
      category: manualCategory,
      description: manualDescription.trim(),
      insiderTip: manualInsiderTip.trim() || undefined,
      approxCost: manualCost.trim() || "Free",
      address: manualAddress.trim() || undefined,
      coordinates: manualCoords || activity.coordinates,
      isSwapped: true,
    };

    onSaveSwap(manualSpot, dayNumber);
    onShowToast("success", `Activity manually updated to "${manualName}"!`);
    onClose();
  };

  // Address Verification / Suggestions handler
  const handleVerifySearchAddress = async () => {
    if (!manualAddress.trim()) return;
    setIsSearchingAddress(true);
    try {
      const query = manualAddress.toLowerCase().includes(plan.destinationOrTown.toLowerCase())
        ? manualAddress
        : `${manualAddress}, ${plan.destinationOrTown}`;

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
          setAddressSuggestions(formatted);

          // Auto-select top match
          setManualCoords(formatted[0].coords);
          setIsAddressVerified(true);
          onShowToast("info", "Found location match! Select from suggestions or view map.");
        } else {
          onShowToast("error", "No precise address matches found. Try refining text or pinning on map.");
        }
      }
    } catch (err) {
      console.warn("Address search error:", err);
    } finally {
      setIsSearchingAddress(false);
    }
  };

  // Select suggestion
  const handlePickSuggestion = (sug: { displayName: string; coords: Coordinates }) => {
    setManualAddress(sug.displayName);
    setManualCoords(sug.coords);
    setIsAddressVerified(true);
    setAddressSuggestions([]);
  };

  // Map Picker confirmed
  const handleMapPickerConfirm = (displayName: string, coordinates: Coordinates) => {
    setManualAddress(displayName);
    setManualCoords(coordinates);
    setIsAddressVerified(true);
    onShowToast("success", "Location pinned on map!");
  };

  const otherActivities: { activity: ActivitySpot; dayNumber: number }[] = [];
  plan.days.forEach((day) => {
    day.activities.forEach((act) => {
      if (act.id !== activity.id) {
        otherActivities.push({ activity: act, dayNumber: day.dayNumber });
      }
    });
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#2c2c24]/75 backdrop-blur-xs animate-in fade-in-20">
      <div className="bg-white rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl border border-[#d1d1ca] flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 px-6 bg-[#f5f5f0] border-b border-[#e5e5df] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#5A5A40] text-white flex items-center justify-center shadow-xs">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-lg sm:text-xl font-light italic text-[#2c2c24]">
                Swap & Customize Spot
              </h3>
              <p className="text-[11px] text-[#8a8a7e] font-sans mt-0.5">
                Day {dayNumber} • Replacing: <span className="font-semibold text-[#5a5a4c]">{activity.name}</span> ({activity.time})
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowMobileMap(!showMobileMap)}
              className="lg:hidden px-3 py-1.5 rounded-full bg-[#ecece4] text-[#5A5A40] text-xs font-semibold flex items-center gap-1.5 border border-[#d1d1ca]"
            >
              <Map className="w-3.5 h-3.5" />
              <span>{showMobileMap ? "Hide Map" : "Live Map"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-[#8a8a7e] hover:text-[#2c2c24] hover:bg-[#ecece4] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Custom Tab Bar */}
        <div className="flex border-b border-[#ecece4] bg-[#fafaf8] px-4 shrink-0">
          <button
            onClick={() => {
              setActiveTab("ai");
              if (aiAlternatives.length > 0) setSelectedCandidate(aiAlternatives[0]);
            }}
            className={`flex items-center space-x-2 py-3 px-4 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 ${
              activeTab === "ai"
                ? "border-[#5A5A40] text-[#5A5A40]"
                : "border-transparent text-[#8a8a7e] hover:text-[#5a5a40]"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">AI Recommendations</span>
            <span className="sm:hidden">AI Suggestions</span>
          </button>
          
          <button
            onClick={() => setActiveTab("existing")}
            className={`flex items-center space-x-2 py-3 px-4 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 ${
              activeTab === "existing"
                ? "border-[#5A5A40] text-[#5A5A40]"
                : "border-transparent text-[#8a8a7e] hover:text-[#5a5a40]"
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>Swap Existing</span>
          </button>

          <button
            onClick={() => setActiveTab("manual")}
            className={`flex items-center space-x-2 py-3 px-4 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 ${
              activeTab === "manual"
                ? "border-[#5A5A40] text-[#5A5A40]"
                : "border-transparent text-[#8a8a7e] hover:text-[#5a5a40]"
            }`}
          >
            <Pencil className="w-4 h-4" />
            <span>Customize Form</span>
          </button>
        </div>

        {/* Main Content Grid: Controls (Left) + Real-time Location Impact Map (Right) */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 min-h-0 bg-white">
          
          {/* LEFT COLUMN: OPTIONS / FORM */}
          <div className="lg:col-span-7 p-4 sm:p-6 overflow-y-auto max-h-[70vh] lg:max-h-none border-r border-[#ecece4]">
            
            {/* TAB 1: AI ALTERNATIVES */}
            {activeTab === "ai" && (
              <div className="space-y-4">
                {/* Swap Reason Context & Weather Contingency Control */}
                <div className="bg-[#fafaf8] border border-[#e5e5df] rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-serif italic text-[#2c2c24] flex items-center gap-1.5 font-semibold">
                      <Sparkles className="w-4 h-4 text-[#5A5A40]" />
                      <span>Why do you want to change this activity?</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsIndoorOnly(!isIndoorOnly)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-sans font-semibold flex items-center gap-1.5 border transition-all ${
                        isIndoorOnly || swapReason === "rain"
                          ? "bg-sky-100 text-sky-900 border-sky-300 ring-2 ring-sky-200"
                          : "bg-white text-[#5a5a4c] border-[#d1d1ca] hover:border-[#5A5A40]"
                      }`}
                    >
                      <span>🌧️ 1-Click Rain Contingency</span>
                      {isIndoorOnly && <Check className="w-3 h-3 text-sky-700" />}
                    </button>
                  </div>

                  {/* Preset reason chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_SWAP_REASONS.map((item) => {
                      const isSelected = swapReason === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSwapReason("");
                              if (item.id === "rain") setIsIndoorOnly(false);
                            } else {
                              setSwapReason(item.id);
                              if (item.id === "rain") setIsIndoorOnly(true);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-sans transition-all flex items-center gap-1.5 border ${
                            isSelected
                              ? "bg-[#5A5A40] text-white border-[#5A5A40] shadow-2xs font-medium"
                              : "bg-white text-[#2c2c24] border-[#d1d1ca] hover:border-[#5A5A40] hover:bg-[#f5f5f0]"
                          }`}
                          title={item.description}
                        >
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom reason / requirement input */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={customRequirement}
                      onChange={(e) => setCustomRequirement(e.target.value)}
                      placeholder="Add personalized detail (e.g., must have outdoor terrace, near Old Town port...)"
                      className="flex-1 px-3 py-1.5 rounded-xl border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                    />
                    <button
                      type="button"
                      onClick={fetchAiAlternatives}
                      disabled={isLoadingAi}
                      className="px-3.5 py-1.5 bg-[#5A5A40] hover:bg-[#40402e] text-white text-xs font-medium rounded-xl flex items-center gap-1.5 transition-all shadow-2xs shrink-0 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAi ? "animate-spin" : ""}`} />
                      <span>{isLoadingAi ? "Finding..." : "Recalculate AI"}</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#8a8a7e]">
                    {swapReason || customRequirement || isIndoorOnly
                      ? `Filtered for: ${
                          swapReason
                            ? PRESET_SWAP_REASONS.find((r) => r.id === swapReason)?.label
                            : isIndoorOnly
                            ? "Rain Contingency / Indoor Only"
                            : "Custom Constraint"
                        }`
                      : "AI recommendations matching your pace, vibe, and schedule context:"}
                  </p>
                  <button
                    onClick={fetchAiAlternatives}
                    disabled={isLoadingAi}
                    className="flex items-center space-x-1.5 text-xs text-[#5A5A40] hover:text-[#40402e] font-semibold disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingAi ? "animate-spin" : ""}`} />
                    <span>Refresh</span>
                  </button>
                </div>

                {isLoadingAi ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-3">
                    <RefreshCw className="w-8 h-8 text-[#5A5A40] animate-spin" />
                    <p className="text-sm font-serif italic text-[#8a8a7e]">Crafting personalized local recommendations...</p>
                  </div>
                ) : aiAlternatives.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3.5">
                    {aiAlternatives.map((alt, idx) => {
                      const isSelected = selectedCandidate?.name === alt.name;
                      return (
                        <div
                          key={alt.id || idx}
                          onMouseEnter={() => setSelectedCandidate(alt)}
                          onClick={() => setSelectedCandidate(alt)}
                          className={`border rounded-2xl p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? "border-[#5A5A40] bg-[#fafaf8] ring-1 ring-[#5A5A40] shadow-sm"
                              : "border-[#e5e5df] hover:border-[#8a8a7e] hover:bg-white"
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between">
                              <div className="flex items-center space-x-2">
                                <span className="text-lg">
                                  {CATEGORIES.find((c) => c.value === alt.category)?.icon || "📍"}
                                </span>
                                <h4 className="font-serif text-base font-medium text-[#2c2c24]">
                                  {alt.name}
                                </h4>
                              </div>
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#f5f5f0] text-[#5a5a4c] font-sans border border-[#e5e5df]">
                                {alt.approxCost}
                              </span>
                            </div>

                            <p className="text-xs text-[#5a5a4c] mt-2 leading-relaxed">
                              {alt.description}
                            </p>

                            {alt.address && (
                              <div className="flex items-center space-x-1 mt-3 text-[11px] text-[#8a8a7e]">
                                <MapPin className="w-3 h-3 shrink-0 text-[#8a8a7e]" />
                                <span className="truncate">{alt.address}</span>
                              </div>
                            )}
                          </div>

                          <div className="mt-4 flex items-center justify-between border-t border-[#ecece4] pt-3">
                            <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                              <Navigation className="w-3 h-3" /> Live Map Preview Active
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectAiAlternative(alt);
                              }}
                              className="flex items-center space-x-1.5 px-4 py-1.5 bg-[#5A5A40] hover:bg-[#40402e] text-white font-medium rounded-full text-xs shadow-2xs hover:shadow-xs transition-all"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Select Spot</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 border border-dashed border-[#d1d1ca] rounded-2xl">
                    <Sparkles className="w-8 h-8 text-[#8a8a7e] mb-2" />
                    <p className="text-sm text-[#8a8a7e]">No AI recommendations loaded. Click refresh to retry.</p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: SWAP WITH EXISTING */}
            {activeTab === "existing" && (
              <div className="space-y-4">
                <p className="text-xs text-[#8a8a7e]">
                  Select another scheduled activity in your itinerary to swap dates, slots, and positions bidirectionally:
                </p>

                {otherActivities.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto pr-1">
                    {otherActivities.map(({ activity: other, dayNumber: otherDay }) => {
                      const isSelected = selectedCandidate?.id === other.id;
                      return (
                        <div
                          key={other.id}
                          onMouseEnter={() => setSelectedCandidate(other)}
                          onClick={() => {
                            setSelectedCandidate(other);
                            handleSelectExistingSwap(other, otherDay);
                          }}
                          className={`border rounded-2xl p-3.5 cursor-pointer transition-all duration-200 group flex flex-col justify-between ${
                            isSelected
                              ? "border-[#5A5A40] bg-[#fafaf8] ring-1 ring-[#5A5A40]"
                              : "border-[#e5e5df] bg-[#fcfcfb] hover:bg-white hover:border-[#8a8a7e]"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase font-bold tracking-wider text-[#5A5A40]">
                                Day {otherDay} • {other.time}
                              </span>
                              <span className="text-xs">
                                {CATEGORIES.find((c) => c.value === other.category)?.icon || "📍"}
                              </span>
                            </div>
                            <h4 className="font-serif text-sm font-medium text-[#2c2c24] group-hover:text-[#5A5A40] transition-colors mt-1">
                              {other.name}
                            </h4>
                            <p className="text-[11px] text-[#6e6e60] mt-1 line-clamp-2">
                              {other.description}
                            </p>
                          </div>
                          <div className="mt-3 pt-2 border-t border-[#ecece4] flex items-center justify-between text-[11px] text-[#8a8a7e]">
                            <span>{other.approxCost}</span>
                            <span className="text-[#5A5A40] font-semibold group-hover:underline flex items-center gap-1">
                              <ArrowLeftRight className="w-3 h-3" /> Swap Here
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 border border-dashed border-[#d1d1ca] rounded-2xl">
                    <ArrowLeftRight className="w-8 h-8 text-[#8a8a7e] mb-2" />
                    <p className="text-sm text-[#8a8a7e]">No other activities exist in the itinerary yet.</p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: CUSTOM MANUAL FORM */}
            {activeTab === "manual" && (
              <form onSubmit={handleManualSubmit} className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-1.5">
                    Spot / Venue Name
                  </label>
                  <input
                    type="text"
                    required
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="e.g. Traditional Pintxo Bar"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#d1d1ca] bg-white text-sm text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-1.5">
                    Category
                  </label>
                  <select
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value as ActivityCategory)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.icon} {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Time & Cost */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-1.5 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#5A5A40]" />
                      Schedule Time Slot
                    </label>
                    <input
                      type="text"
                      required
                      value={manualTime}
                      onChange={(e) => setManualTime(e.target.value)}
                      placeholder="e.g. 10:00 AM - 12:00 PM"
                      className="w-full px-3 py-2 rounded-xl border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-1.5 flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-[#5A5A40]" />
                      Approx. Cost
                    </label>
                    <input
                      type="text"
                      value={manualCost}
                      onChange={(e) => setManualCost(e.target.value)}
                      placeholder="e.g. Free, €15, $25"
                      className="w-full px-3 py-2 rounded-xl border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                    />
                  </div>
                </div>

                {/* Address with Verification & Map Pin */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#5A5A40]" />
                      Address / Location Verification
                    </label>
                    {isAddressVerified && (
                      <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Location Verified
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={manualAddress}
                      onChange={(e) => {
                        setManualAddress(e.target.value);
                        setIsAddressVerified(false);
                      }}
                      placeholder="e.g. Calle Mayor 14, Old Town"
                      className="flex-1 px-3.5 py-2 rounded-xl border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                    />
                    <button
                      type="button"
                      onClick={handleVerifySearchAddress}
                      disabled={isSearchingAddress}
                      className="px-3 py-2 bg-[#ecece4] hover:bg-[#d1d1ca] text-[#2c2c24] text-xs font-semibold rounded-xl flex items-center gap-1 transition-colors shrink-0"
                    >
                      <Search className="w-3.5 h-3.5 text-[#5A5A40]" />
                      <span>{isSearchingAddress ? "Checking..." : "Verify"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMapPickerOpen(true)}
                      className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold rounded-xl flex items-center gap-1 transition-colors shrink-0"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Pin Map</span>
                    </button>
                  </div>

                  {/* Suggestions List */}
                  {addressSuggestions.length > 0 && (
                    <div className="mt-2 p-2 bg-[#fafaf8] border border-[#d1d1ca] rounded-xl space-y-1.5 z-10 shadow-sm">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-[#8a8a7e] px-1">
                        Select Verified Location Suggestion:
                      </p>
                      {addressSuggestions.map((sug, idx) => (
                        <div
                          key={idx}
                          onClick={() => handlePickSuggestion(sug)}
                          className="p-1.5 hover:bg-[#ecece4] rounded-lg text-xs text-[#2c2c24] cursor-pointer flex items-center justify-between transition-colors"
                        >
                          <span className="truncate pr-2">{sug.displayName}</span>
                          <span className="text-[10px] font-mono text-[#5A5A40] shrink-0">
                            {sug.coords.lat.toFixed(3)}, {sug.coords.lng.toFixed(3)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-1.5">
                    Description / Activity Details
                  </label>
                  <textarea
                    value={manualDescription}
                    onChange={(e) => setManualDescription(e.target.value)}
                    rows={2}
                    placeholder="What is this activity about? What experiences does it offer?"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40] resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-[#ecece4] flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-[#8a8a7e] hover:bg-[#ecece4] hover:text-[#2c2c24] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#5A5A40] hover:bg-[#40402e] text-white text-xs font-semibold rounded-xl shadow-2xs hover:shadow-xs transition-all"
                  >
                    Save Manually
                  </button>
                </div>
              </form>
            )}

          </div>

          {/* RIGHT COLUMN: REAL-TIME DAY LOCATION IMPACT MAP */}
          <div className={`lg:col-span-5 bg-[#f5f5f0] flex flex-col ${showMobileMap ? "block h-[300px]" : "hidden lg:flex"}`}>
            <div className="p-3 bg-[#ecece4] border-b border-[#d1d1ca] flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <MapPin className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-bold text-[#2c2c24] uppercase tracking-wider">
                  Live Day {dayNumber} Map Impact
                </span>
              </div>
              <span className="text-[10px] text-[#5A5A40] bg-white px-2 py-0.5 rounded-full border border-[#d1d1ca]">
                Real-time Route Preview
              </span>
            </div>

            <div className="flex-1 relative min-h-[280px]">
              <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />
            </div>

            {selectedCandidate && (
              <div className="p-3 bg-white border-t border-[#ecece4] text-xs space-y-1">
                <p className="font-bold text-[#2c2c24] truncate flex items-center gap-1.5">
                  <span className="text-emerald-700">✨ Selected Candidate:</span> {selectedCandidate.name}
                </p>
                <p className="text-[11px] text-[#6e6e60] truncate">
                  {selectedCandidate.address || selectedCandidate.description || "Location preview active"}
                </p>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Manual Accommodation / Spot Map Pin Modal */}
      {isMapPickerOpen && (
        <AccommodationMapPickerModal
          isOpen={isMapPickerOpen}
          onClose={() => setIsMapPickerOpen(false)}
          onSelect={handleMapPickerConfirm}
          cityContext={plan.destinationOrTown}
          initialCoordinates={manualCoords || activity.coordinates}
          initialLocationName={manualAddress}
        />
      )}
    </div>
  );
};
