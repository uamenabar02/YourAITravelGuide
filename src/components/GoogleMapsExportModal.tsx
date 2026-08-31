import React, { useState } from "react";
import { ItineraryPlan, ActivitySpot } from "../types";
import { generateGoogleMapsSearchUrl } from "../utils/destinations";
import { formatSpotForGoogleMaps } from "../utils/transit";
import { downloadFile } from "../utils/sharing";
import {
  X,
  MapPin,
  ExternalLink,
  Download,
  Copy,
  Check,
  CheckSquare,
  Square,
  QrCode,
  FileSpreadsheet,
  Globe,
  Sparkles,
  Navigation,
  Bookmark,
  Plus,
  Layers,
  ListPlus,
  Compass,
} from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

interface GoogleMapsExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: ItineraryPlan;
}

export const GoogleMapsExportModal: React.FC<GoogleMapsExportModalProps> = ({
  isOpen,
  onClose,
  plan,
}) => {
  const { t } = useLanguage();
  const allDayNumbers = plan.days.map((d) => d.dayNumber);
  const [selectedDayNumbers, setSelectedDayNumbers] = useState<number[]>(allDayNumbers);
  const [copiedList, setCopiedList] = useState(false);
  const [copiedCompiledUrl, setCopiedCompiledUrl] = useState(false);
  const [activeExportTab, setActiveExportTab] = useState<
    "csv_import" | "quick_link" | "copy_list" | "qr_code"
  >("csv_import");

  if (!isOpen) return null;

  // Toggle selection of a single day
  const toggleDaySelection = (dayNum: number) => {
    if (selectedDayNumbers.includes(dayNum)) {
      if (selectedDayNumbers.length > 1) {
        setSelectedDayNumbers(selectedDayNumbers.filter((n) => n !== dayNum));
      }
    } else {
      setSelectedDayNumbers([...selectedDayNumbers, dayNum].sort((a, b) => a - b));
    }
  };

  const selectAllDays = () => setSelectedDayNumbers(allDayNumbers);

  // Gather selected spots from selected days
  const selectedDays = plan.days.filter((d) => selectedDayNumbers.includes(d.dayNumber));
  const selectedActivities: Array<{ activity: ActivitySpot; dayNumber: number; dayTitle: string }> = [];

  selectedDays.forEach((day) => {
    day.activities.forEach((act) => {
      selectedActivities.push({
        activity: act,
        dayNumber: day.dayNumber,
        dayTitle: day.dayTitle,
      });
    });
  });

  // Category classification helper for Google Maps Saved Lists
  const categorizeSpot = (spot: ActivitySpot): string => {
    const cat = (spot.category || "").toLowerCase();
    const name = (spot.name || "").toLowerCase();
    const desc = (spot.description || "").toLowerCase();

    if (cat.includes("museum") || name.includes("museum") || name.includes("museo") || desc.includes("museum")) return "museum";
    if (cat.includes("food") || cat.includes("restaurant") || name.includes("restaurant") || name.includes("bar") || name.includes("taverna") || name.includes("eating") || cat.includes("dining")) return "eating";
    if (cat.includes("cafe") || cat.includes("breakfast") || name.includes("cafe") || name.includes("café") || name.includes("coffee") || name.includes("breakfast") || name.includes("pastelería") || name.includes("bakery")) return "breakfast";
    if (cat.includes("view") || cat.includes("nature") || cat.includes("park") || name.includes("mirador") || name.includes("viewpoint") || name.includes("park") || name.includes("beach")) return "viewpoint";
    if (cat.includes("transport") || cat.includes("hotel") || name.includes("station") || name.includes("estación") || name.includes("hotel")) return "transport";
    return "monument";
  };

  const CATEGORY_META: Record<string, { title: string; icon: string; bg: string; text: string; border: string }> = {
    monument: { title: "Monument & Sights", icon: "🗽", bg: "bg-blue-50/80", text: "text-blue-900", border: "border-blue-200" },
    museum: { title: "Museum & Culture", icon: "🏛️", bg: "bg-purple-50/80", text: "text-purple-900", border: "border-purple-200" },
    eating: { title: "Eating Places", icon: "🍽️", bg: "bg-amber-50/80", text: "text-amber-900", border: "border-amber-200" },
    breakfast: { title: "Breakfast & Cafés", icon: "☕", bg: "bg-orange-50/80", text: "text-orange-900", border: "border-orange-200" },
    viewpoint: { title: "Viewpoints & Nature", icon: "👁️", bg: "bg-emerald-50/80", text: "text-emerald-900", border: "border-emerald-200" },
    transport: { title: "Transport & Stays", icon: "🚆", bg: "bg-indigo-50/80", text: "text-indigo-900", border: "border-indigo-200" },
  };

  // Group selected activities by category
  const groupedSpots: Record<string, Array<{ activity: ActivitySpot; dayNumber: number }>> = {};
  selectedActivities.forEach(({ activity, dayNumber }) => {
    const key = categorizeSpot(activity);
    if (!groupedSpots[key]) groupedSpots[key] = [];
    groupedSpots[key].push({ activity, dayNumber });
  });

  // Batch open all spots in a category in browser tabs
  const handleBatchOpenCategory = (catKey: string) => {
    const items = groupedSpots[catKey] || [];
    items.forEach(({ activity }) => {
      const gUrl = activity.googleMapsUrl || generateGoogleMapsSearchUrl(activity.name, plan.destinationOrTown, activity.address, activity.coordinates);
      window.open(gUrl, "_blank");
    });
  };

  // 1. Build Multi-Point Google Maps Route / Search URL
  const buildCompiledGoogleMapsUrl = (): string => {
    if (selectedActivities.length === 0) return "https://maps.google.com";

    const waypoints = selectedActivities.map(({ activity }) => {
      return formatSpotForGoogleMaps(activity, plan.destinationOrTown);
    });

    if (waypoints.length === 1) {
      return `https://www.google.com/maps/search/?api=1&query=${waypoints[0]}`;
    }

    const origin = waypoints[0];
    const destination = waypoints[waypoints.length - 1];
    const intermediate = waypoints.slice(1, -1).slice(0, 8);

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
    if (intermediate.length > 0) {
      url += `&waypoints=${intermediate.join("|")}`;
    }
    url += `&travelmode=walking`;
    return url;
  };

  const compiledMapsUrl = buildCompiledGoogleMapsUrl();

  // 2. Generate Google My Maps Compatible CSV
  const handleDownloadCSV = () => {
    const csvRows = [
      ["Name", "Category", "Day", "Time", "Address", "Latitude", "Longitude", "Description", "Insider Tip", "Google Maps Link"],
    ];

    selectedActivities.forEach(({ activity, dayNumber, dayTitle }) => {
      const gUrl = activity.googleMapsUrl || generateGoogleMapsSearchUrl(activity.name, plan.destinationOrTown, activity.address, activity.coordinates);
      csvRows.push([
        `"${activity.name.replace(/"/g, '""')}"`,
        `"${activity.category}"`,
        `"Day ${dayNumber}: ${dayTitle.replace(/"/g, '""')}"`,
        `"${activity.time || ""}"`,
        `"${(activity.address || plan.destinationOrTown).replace(/"/g, '""')}"`,
        `"${activity.coordinates?.lat || ""}"`,
        `"${activity.coordinates?.lng || ""}"`,
        `"${activity.description.replace(/"/g, '""')}"`,
        `"${activity.insiderTip.replace(/"/g, '""')}"`,
        `"${gUrl}"`,
      ]);
    });

    const csvContent = csvRows.map((e) => e.join(",")).join("\n");
    const daysLabel = selectedDayNumbers.length === allDayNumbers.length ? "FullItinerary" : `Days_${selectedDayNumbers.join("-")}`;
    const filename = `${plan.destinationOrTown.replace(/[^a-zA-Z0-9]/g, "_")}_GoogleMapsList_${daysLabel}.csv`;
    downloadFile(csvContent, filename, "text/csv;charset=utf-8;");
  };

  // 3. Generate Formatted Text List with Map Links
  const buildFormattedTextList = (): string => {
    let text = `🗺️ Google Maps Activity List: ${plan.title}\n📍 ${plan.destinationOrTown} (${selectedActivities.length} spots)\n\n`;

    selectedDays.forEach((day) => {
      text += `📅 ${day.dayTitle}\n`;
      day.activities.forEach((act, idx) => {
        const gUrl = act.googleMapsUrl || generateGoogleMapsSearchUrl(act.name, plan.destinationOrTown, act.address, act.coordinates);
        text += `${idx + 1}. ${act.name} (${act.time || "Flexible"})\n   📍 ${act.address || plan.destinationOrTown}\n   🔗 ${gUrl}\n\n`;
      });
    });

    text += `Generated with Local Explorer AI`;
    return text;
  };

  // Clipboard Helper
  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fallback
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  };

  const handleCopyTextList = async () => {
    const text = buildFormattedTextList();
    const ok = await copyToClipboard(text);
    setCopiedList(ok);
    setTimeout(() => setCopiedList(false), 2500);
  };

  const handleCopyCompiledUrl = async () => {
    const ok = await copyToClipboard(compiledMapsUrl);
    setCopiedCompiledUrl(ok);
    setTimeout(() => setCopiedCompiledUrl(false), 2500);
  };

  // QR Code URL using free reliable QR Server API
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(compiledMapsUrl)}`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#2c2c24]/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-[#e5e5df] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#e5e5df] flex items-center justify-between bg-[#fafaf7]">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2.5 rounded-2xl bg-teal-50 text-teal-700 border border-teal-200 shrink-0 shadow-2xs">
              <Bookmark className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#2c2c24] flex items-center gap-2">
                <span>Google Maps Export & Lists</span>
                <span className="px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-900 text-[10px] font-bold uppercase tracking-wider font-sans border border-teal-200">
                  Saved • Lists
                </span>
              </h3>
              <p className="text-xs text-[#6b6b5e] font-sans truncate">
                {plan.destinationOrTown} • {selectedActivities.length} places ready for Google Maps
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-[#8a8a7e] hover:text-[#2c2c24] hover:bg-[#ecece4] transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* STEP 1: Select Scope / Days */}
          <div className="bg-[#f5f5f0] p-4.5 rounded-2xl border border-[#e5e5df] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-serif italic text-[#2c2c24] font-bold flex items-center gap-1.5">
                <span>📅 1. Choose Itinerary Days to Export</span>
                <span className="text-[#8a8a7e] font-sans font-normal">
                  ({selectedDayNumbers.length} of {allDayNumbers.length} selected)
                </span>
              </label>
              <button
                type="button"
                onClick={selectAllDays}
                className="text-[11px] text-[#5A5A40] font-semibold hover:underline"
              >
                Select All Days
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {plan.days.map((day) => {
                const isSelected = selectedDayNumbers.includes(day.dayNumber);
                return (
                  <button
                    key={day.dayNumber}
                    type="button"
                    onClick={() => toggleDaySelection(day.dayNumber)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                      isSelected
                        ? "bg-[#5A5A40] text-white border-[#4a4a35] shadow-2xs"
                        : "bg-white text-[#6b6b5e] border-[#d1d1ca] hover:bg-[#ecece4]"
                    }`}
                  >
                    {isSelected ? <CheckSquare className="w-3.5 h-3.5 shrink-0" /> : <Square className="w-3.5 h-3.5 shrink-0" />}
                    <span>Day {day.dayNumber}</span>
                    <span className="opacity-70 font-normal text-[10px]">({day.activities.length} spots)</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 2: Choose Export Method Tabs */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-serif italic text-[#2c2c24] font-bold">
                🏷️ 2. Export Format & Google Maps Integration
              </label>
            </div>

            {/* Sub-tabs bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-[#f5f5f0] rounded-2xl border border-[#e5e5df]">
              <button
                type="button"
                onClick={() => setActiveExportTab("csv_import")}
                className={`py-2 px-1.5 rounded-xl text-xs font-semibold transition-all flex flex-col items-center justify-center gap-1 ${
                  activeExportTab === "csv_import"
                    ? "bg-[#5A5A40] text-white shadow-xs font-bold"
                    : "text-[#6b6b5e] hover:text-[#2c2c24] hover:bg-white/60"
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span className="text-[10px] sm:text-[11px]">My Maps CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveExportTab("quick_link")}
                className={`py-2 px-1.5 rounded-xl text-xs font-semibold transition-all flex flex-col items-center justify-center gap-1 ${
                  activeExportTab === "quick_link"
                    ? "bg-[#5A5A40] text-white shadow-xs font-bold"
                    : "text-[#6b6b5e] hover:text-[#2c2c24] hover:bg-white/60"
                }`}
              >
                <Navigation className="w-4 h-4 shrink-0" />
                <span className="text-[10px] sm:text-[11px]">Direct Route</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveExportTab("copy_list")}
                className={`py-2 px-1.5 rounded-xl text-xs font-semibold transition-all flex flex-col items-center justify-center gap-1 ${
                  activeExportTab === "copy_list"
                    ? "bg-[#5A5A40] text-white shadow-xs font-bold"
                    : "text-[#6b6b5e] hover:text-[#2c2c24] hover:bg-white/60"
                }`}
              >
                <Copy className="w-4 h-4 shrink-0" />
                <span className="text-[10px] sm:text-[11px]">Copy Text</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveExportTab("qr_code")}
                className={`py-2 px-1.5 rounded-xl text-xs font-semibold transition-all flex flex-col items-center justify-center gap-1 ${
                  activeExportTab === "qr_code"
                    ? "bg-[#5A5A40] text-white shadow-xs font-bold"
                    : "text-[#6b6b5e] hover:text-[#2c2c24] hover:bg-white/60"
                }`}
              >
                <QrCode className="w-4 h-4 shrink-0" />
                <span className="text-[10px] sm:text-[11px]">Scan QR</span>
              </button>
            </div>

            {/* TAB 1: GOOGLE MY MAPS CSV EXPORT & INSTRUCTIONS */}
            {activeExportTab === "csv_import" && (
              <div className="bg-white p-5 rounded-2xl border border-[#e5e5df] shadow-2xs space-y-4">
                <div className="space-y-1">
                  <h4 className="font-serif font-bold text-sm text-[#2c2c24] flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Export to Google My Maps (via CSV)</span>
                  </h4>
                  <p className="text-xs text-[#6b6b5e] leading-relaxed">
                    Download a pre-formatted CSV file containing names, exact GPS coordinates, categories, addresses, and insider tips for custom map layering in Google My Maps.
                  </p>
                </div>

                {/* 3-Step Guide to Import into Google My Maps */}
                <div className="bg-[#fafaf7] p-4 rounded-xl border border-[#ecece5] space-y-2 text-xs text-[#2c2c24]">
                  <p className="font-serif font-bold text-[#5A5A40] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>How to import into Google My Maps:</span>
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-[#6b6b5e] font-sans">
                    <li>Click below to download the <strong>.CSV file</strong>.</li>
                    <li>Open <a href="https://www.google.com/maps/d/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-semibold">Google My Maps</a> in your browser.</li>
                    <li>Click <strong>"Create a New Map"</strong> &rarr; <strong>Import</strong> &rarr; select the downloaded CSV file!</li>
                  </ol>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadCSV}
                  className="w-full px-5 py-3 rounded-xl bg-[#5A5A40] hover:bg-[#474732] text-white font-semibold text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Google My Maps CSV File ({selectedActivities.length} spots)</span>
                </button>
              </div>
            )}

            {/* TAB 3: Direct Multi-Stop Google Maps Route Link */}
            {activeExportTab === "quick_link" && (
              <div className="bg-white p-5 rounded-2xl border border-[#e5e5df] shadow-2xs space-y-4">
                <div className="space-y-1">
                  <h4 className="font-serif font-bold text-sm text-[#2c2c24] flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-red-600" />
                    <span>Open Multi-Stop Route in Google Maps</span>
                  </h4>
                  <p className="text-xs text-[#6b6b5e] leading-relaxed">
                    Instantly compiles all {selectedActivities.length} locations into a multi-stop walking & driving itinerary map in Google Maps.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <a
                    href={compiledMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <MapPin className="w-4 h-4" />
                    <span>Open directly in Google Maps</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    type="button"
                    onClick={handleCopyCompiledUrl}
                    className="px-4 py-3 rounded-xl bg-[#f5f5f0] hover:bg-[#ecece4] text-[#2c2c24] font-semibold text-xs border border-[#d1d1ca] transition-colors flex items-center justify-center gap-1.5 shrink-0"
                  >
                    {copiedCompiledUrl ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-[#5A5A40]" />}
                    <span>{copiedCompiledUrl ? "Copied Link!" : "Copy Map Link"}</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: Copy Formatted Text List with Map Links */}
            {activeExportTab === "copy_list" && (
              <div className="bg-white p-5 rounded-2xl border border-[#e5e5df] shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-serif font-bold text-sm text-[#2c2c24] flex items-center gap-2">
                      <Copy className="w-4 h-4 text-indigo-600" />
                      <span>Copy Spots List with Google Maps Links</span>
                    </h4>
                    <p className="text-xs text-[#6b6b5e]">
                      Perfect for pasting into WhatsApp group chats, Apple Notes, or email.
                    </p>
                  </div>
                  {copiedList && (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                      <Check className="w-4 h-4" /> Copied!
                    </span>
                  )}
                </div>

                <textarea
                  readOnly
                  rows={6}
                  value={buildFormattedTextList()}
                  className="w-full p-3.5 bg-[#f5f5f0] border border-[#d1d1ca] rounded-xl text-xs font-mono text-[#2c2c24] focus:outline-none resize-none"
                />

                <button
                  type="button"
                  onClick={handleCopyTextList}
                  className="w-full px-5 py-2.5 rounded-xl bg-[#2c2c24] hover:bg-[#3d3d32] text-white font-semibold text-xs transition-colors shadow-xs flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  <span>{copiedList ? "Copied to Clipboard!" : "Copy Full Text List"}</span>
                </button>
              </div>
            )}

            {/* TAB 5: Scan QR Code on Mobile */}
            {activeExportTab === "qr_code" && (
              <div className="bg-white p-5 rounded-2xl border border-[#e5e5df] shadow-2xs text-center space-y-4 flex flex-col items-center">
                <div className="space-y-1">
                  <h4 className="font-serif font-bold text-sm text-[#2c2c24] flex items-center justify-center gap-2">
                    <QrCode className="w-4 h-4 text-amber-600" />
                    <span>Scan with Mobile Camera</span>
                  </h4>
                  <p className="text-xs text-[#6b6b5e]">
                    Point your iPhone or Android camera at the QR code to instantly open these spots in Google Maps.
                  </p>
                </div>

                <div className="p-3 bg-white rounded-2xl border-2 border-[#5A5A40]/30 shadow-md inline-block">
                  <img
                    src={qrCodeImageUrl}
                    alt="Google Maps QR Code"
                    className="w-48 h-48 rounded-lg"
                  />
                </div>

                <p className="text-[11px] text-[#8a8a7e] italic">
                  Opens Google Maps directly with all selected day activities
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#fafaf7] border-t border-[#e5e5df] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-[#5A5A40] hover:bg-[#474732] text-white text-xs font-serif italic rounded-xl transition-colors shadow-xs font-bold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

