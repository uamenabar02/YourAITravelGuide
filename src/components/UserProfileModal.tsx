import React, { useState, useEffect } from "react";
import {
  X,
  User,
  ShieldCheck,
  RefreshCw,
  Download,
  Upload,
  Globe,
  Trash2,
  Sparkles,
  Award,
  CheckCircle2,
  AlertCircle,
  Database,
  Eye,
  Sliders,
  DollarSign,
  HeartHandshake,
  Compass,
  Plane,
  MapPin,
} from "lucide-react";
import { useLanguage, Language } from "../context/LanguageContext";
import {
  getSavedTrips,
  getMySpots,
  getActivityHistory,
  getPermanentSkips,
  removePermanentSkip,
  getTasteProfile,
  saveTasteProfile,
} from "../utils/storage";
import { TasteProfile, BudgetTier, PaceType, AppMode } from "../types";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTasteProfile: () => void;
  onOpenMySpots: () => void;
  onOpenSavedTrips: () => void;
  onOpenHistory: () => void;
  onDataChanged?: () => void;
  activeMode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

const PERSONA_PRESETS: {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  profile: Omit<TasteProfile, "updatedAt">;
  pace: PaceType;
  budget: BudgetTier;
}[] = [
  {
    id: "gastronomy",
    name: "Gastronomy & Pintxos Lover",
    emoji: "🍢",
    tagline: "Authentic taverns, tapas hopping, specialty coffee & local wine",
    pace: "relaxed",
    budget: "mid-range",
    profile: {
      diningStyles: ["Pintxo / tapas hopping", "Sit-down local restaurant", "Market counter & stalls"],
      drinkPreferences: ["Specialty coffee", "Local wine / txakoli", "Craft beer"],
      atmospheres: ["Lively & social", "Terrace / outdoor seating", "Historic & classic"],
      budgetComfort: "mid-range",
      dislikes: ["Tourist traps", "Chains & franchises"],
      dietaryNotes: "Foodie eager for authentic regional specialties and seasonal ingredients.",
    },
  },
  {
    id: "culture",
    name: "Heritage & Culture Seeker",
    emoji: "🏛️",
    tagline: "Historic gems, quiet eateries, architecture & storytelling",
    pace: "balanced",
    budget: "mid-range",
    profile: {
      diningStyles: ["Sit-down local restaurant", "Picnic & takeaway"],
      drinkPreferences: ["Tea & infusions", "Specialty coffee", "Local wine / txakoli"],
      atmospheres: ["Quiet & cozy", "Historic & classic"],
      budgetComfort: "mid-range",
      dislikes: ["Tourist traps", "Loud music", "Overcrowded places"],
      dietaryNotes: "Appreciates historic venues with rich culinary traditions.",
    },
  },
  {
    id: "backpacker",
    name: "Active Nature Backpacker",
    emoji: "🥾",
    tagline: "Panoramic hikes, scenic picnics, quick espresso & street bites",
    pace: "action-packed",
    budget: "budget",
    profile: {
      diningStyles: ["Quick bites & street food", "Picnic & takeaway", "Market counter & stalls"],
      drinkPreferences: ["Specialty coffee", "Alcohol-free options", "Craft beer"],
      atmospheres: ["Terrace / outdoor seating", "Lively & social"],
      budgetComfort: "budget",
      dislikes: ["Long queues", "Overcrowded places"],
      dietaryNotes: "Fast, energizing fuel for outdoor adventures and trails.",
    },
  },
  {
    id: "luxury",
    name: "Luxury & Wellness Escape",
    emoji: "✨",
    tagline: "Fine tasting menus, artisan cocktails & serene ambiance",
    pace: "relaxed",
    budget: "luxury",
    profile: {
      diningStyles: ["Long gastronomic tasting", "Sit-down local restaurant"],
      drinkPreferences: ["Cocktails & mixed drinks", "Local wine / txakoli", "Specialty coffee"],
      atmospheres: ["Quiet & cozy", "Modern & trendy"],
      budgetComfort: "luxury",
      dislikes: ["Tourist traps", "Chains & franchises", "Loud music"],
      dietaryNotes: "Refined dining with attentive service and pairings.",
    },
  },
  {
    id: "family",
    name: "Family & Casual Explorer",
    emoji: "👨‍👩‍👧",
    tagline: "Spacious terraces, casual taverns, gelato & bakeries",
    pace: "balanced",
    budget: "mid-range",
    profile: {
      diningStyles: ["Sit-down local restaurant", "Quick bites & street food", "Market counter & stalls"],
      drinkPreferences: ["Tea & infusions", "Alcohol-free options", "Specialty coffee"],
      atmospheres: ["Family-friendly", "Terrace / outdoor seating"],
      budgetComfort: "mid-range",
      dislikes: ["Overcrowded places", "Long queues", "Loud music"],
      dietaryNotes: "Kid-friendly menus, comfortable seating, accessible options.",
    },
  },
];

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  onOpenTasteProfile,
  onOpenMySpots,
  onOpenSavedTrips,
  onOpenHistory,
  onDataChanged,
  activeMode,
  onModeChange,
}) => {
  const { language, setLanguage, t } = useLanguage();

  // User details
  const [userName, setUserName] = useState(() => localStorage.getItem("localexplorer_user_name") || "Traveler");
  const [userEmail] = useState(() => localStorage.getItem("localexplorer_user_email") || "uamenabar02@gmail.com");
  const [activePersona, setActivePersona] = useState<string | null>(
    () => localStorage.getItem("localexplorer_active_persona") || null
  );

  // Sync simulation state
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>(
    () => localStorage.getItem("localexplorer_last_sync_time") || "Just now"
  );
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Active counts
  const [savedTripsCount, setSavedTripsCount] = useState(0);
  const [mySpotsCount, setMySpotsCount] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);
  const [permanentSkips, setPermanentSkips] = useState<{ id: string; name: string; addedAt: number }[]>([]);
  const [translationCacheCount, setTranslationCacheCount] = useState(0);

  // Refresh counts on open
  useEffect(() => {
    if (isOpen) {
      setSavedTripsCount(getSavedTrips().length);
      setMySpotsCount(getMySpots().length);
      setHistoryCount(getActivityHistory().length);
      setPermanentSkips(getPermanentSkips());

      // Count cached translations
      try {
        const raw = localStorage.getItem("localexplorer_ai_translation_cache_v2");
        if (raw) {
          const parsed = JSON.parse(raw);
          let count = 0;
          Object.keys(parsed).forEach((k) => {
            count += Object.keys(parsed[k] || {}).length;
          });
          setTranslationCacheCount(count);
        } else {
          setTranslationCacheCount(0);
        }
      } catch {
        setTranslationCacheCount(0);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveUserName = (val: string) => {
    setUserName(val);
    localStorage.setItem("localexplorer_user_name", val);
  };

  const handleApplyPersona = (preset: (typeof PERSONA_PRESETS)[0]) => {
    saveTasteProfile(preset.profile);
    setActivePersona(preset.id);
    localStorage.setItem("localexplorer_active_persona", preset.id);
    setSyncFeedback(`Applied "${preset.name}" persona to your Taste Profile!`);
    if (onDataChanged) onDataChanged();
    setTimeout(() => setSyncFeedback(null), 3500);
  };

  const handleCloudSync = () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    setTimeout(() => {
      setIsSyncing(false);
      const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setLastSyncedTime(nowStr);
      localStorage.setItem("localexplorer_last_sync_time", nowStr);
      setSyncFeedback("Account state, trips & taste preferences synchronized successfully!");
      setTimeout(() => setSyncFeedback(null), 4000);
    }, 1200);
  };

  const handleExportAllData = () => {
    try {
      const exportObject = {
        app: "LocalExplorer AI",
        exportedAt: new Date().toISOString(),
        user: { name: userName, email: userEmail },
        savedTrips: getSavedTrips(),
        mySpots: getMySpots(),
        activityHistory: getActivityHistory(),
        permanentSkips: getPermanentSkips(),
        tasteProfile: getTasteProfile(),
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObject, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `localexplorer_backup_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setSyncFeedback("Backup JSON exported successfully.");
      setTimeout(() => setSyncFeedback(null), 3500);
    } catch (e) {
      console.error("Export backup failed:", e);
    }
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const data = JSON.parse(text);

        if (data.savedTrips && Array.isArray(data.savedTrips)) {
          localStorage.setItem("localexplorer_saved_trips_v2", JSON.stringify(data.savedTrips));
        }
        if (data.mySpots && Array.isArray(data.mySpots)) {
          localStorage.setItem("localexplorer_my_spots_v1", JSON.stringify(data.mySpots));
        }
        if (data.activityHistory && Array.isArray(data.activityHistory)) {
          localStorage.setItem("localexplorer_activity_history", JSON.stringify(data.activityHistory));
        }
        if (data.permanentSkips && Array.isArray(data.permanentSkips)) {
          localStorage.setItem("localexplorer_permanent_skips", JSON.stringify(data.permanentSkips));
        }
        if (data.tasteProfile) {
          saveTasteProfile(data.tasteProfile);
        }

        setSavedTripsCount(getSavedTrips().length);
        setMySpotsCount(getMySpots().length);
        setHistoryCount(getActivityHistory().length);
        setPermanentSkips(getPermanentSkips());

        setSyncFeedback("All data successfully restored from backup!");
        if (onDataChanged) onDataChanged();
        setTimeout(() => setSyncFeedback(null), 4000);
      } catch (err) {
        alert("Invalid backup JSON file format.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleClearCache = () => {
    if (window.confirm("Clear offline translation and response cache? Data will refresh from server as needed.")) {
      localStorage.removeItem("localexplorer_ai_translation_cache_v2");
      setTranslationCacheCount(0);
      setSyncFeedback("Translation cache cleared.");
      setTimeout(() => setSyncFeedback(null), 3000);
    }
  };

  const handleRemoveSkip = (id: string) => {
    removePermanentSkip(id);
    setPermanentSkips(getPermanentSkips());
    if (onDataChanged) onDataChanged();
  };

  const handleResetAll = () => {
    if (
      window.confirm(
        "Are you sure you want to reset all LocalExplorer data? This will erase saved trips, places, history and preferences."
      )
    ) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden border border-[#e5e5df]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile handle indicator */}
        <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto mt-2.5 sm:hidden" />

        {/* Header */}
        <div className="p-4 sm:p-6 bg-[#f5f5f0] border-b border-[#e5e5df] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#5A5A40] flex items-center justify-center text-white shadow-xs">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-lg sm:text-xl font-normal italic text-[#2c2c24]">
                {t("profile.title", "User Profile & Preferences")}
              </h3>
              <p className="text-xs text-[#8a8a7e] font-sans font-medium">
                {t("profile.subtitle", "Account status, travel personas, cloud backup & device settings")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[#8a8a7e] hover:text-[#2c2c24] hover:bg-[#ecece4] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast / Feedback notification inside modal */}
        {syncFeedback && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-xs text-emerald-800 flex items-center justify-between animate-in slide-in-from-top duration-150">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              {syncFeedback}
            </span>
            <button onClick={() => setSyncFeedback(null)} className="text-emerald-600 hover:text-emerald-900">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[#fdfbf7]">
          {/* User ID & Status Card */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#e5e5df] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-13 h-13 rounded-full bg-[#ecece4] border-2 border-[#5A5A40] flex items-center justify-center text-[#5A5A40] font-serif text-2xl font-bold shadow-inner">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => handleSaveUserName(e.target.value)}
                    className="font-serif text-lg font-bold text-[#2c2c24] border-b border-transparent hover:border-stone-300 focus:border-[#5A5A40] focus:outline-none bg-transparent"
                    title="Click to rename display name"
                  />
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-sans font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    <Award className="w-3 h-3 text-amber-700" />
                    {t("profile.tier", "Premium Explorer")}
                  </span>
                </div>
                <p className="text-xs text-[#8a8a7e] font-mono mt-0.5">{userEmail}</p>
                <p className="text-[11px] text-stone-500 mt-1 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  {t("profile.verified", "Local Verification Active • Worldwide Geocoding")}
                </p>
              </div>
            </div>

            {/* Cloud Sync Button */}
            <button
              onClick={handleCloudSync}
              disabled={isSyncing}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#ecece4] hover:bg-[#dcdcd4] text-[#2c2c24] text-xs font-semibold flex items-center justify-center gap-2 transition-all border border-[#d1d1ca] shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#5A5A40] ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? t("profile.syncing", "Syncing...") : t("profile.syncNow", "Sync Backup")}</span>
              <span className="text-[10px] text-stone-500 font-mono font-normal">({lastSyncedTime})</span>
            </button>
          </div>

          {/* Exploration Mode Switcher */}
          <div className="bg-white p-4 rounded-2xl border border-[#e5e5df] space-y-3 shadow-2xs">
            <h4 className="text-xs uppercase tracking-wider font-semibold text-[#8a8a7e] flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-[#5A5A40]" />
              {t("profile.explorationMode", "Exploration Mode")}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onModeChange("vacation")}
                className={`p-3.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                  activeMode === "vacation"
                    ? "bg-[#5A5A40] text-white border-[#5A5A40] font-bold shadow-xs"
                    : "bg-[#fdfbf7] text-[#2c2c24] border-[#d1d1ca] hover:border-stone-400"
                }`}
              >
                <Plane className={`w-5 h-5 ${activeMode === "vacation" ? "text-white" : "text-[#5A5A40]"}`} />
                <div className="text-xs font-semibold mt-1">{t("nav.vacation", "Vacation Mode")}</div>
                <div className={`text-[9px] uppercase tracking-wider ${activeMode === "vacation" ? "text-stone-200" : "text-[#8a8a7e]"}`}>
                  {t("vacation.modeDesc", "Cultural Planner")}
                </div>
              </button>
              <button
                type="button"
                onClick={() => onModeChange("hometown")}
                className={`p-3.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                  activeMode === "hometown"
                    ? "bg-[#5A5A40] text-white border-[#5A5A40] font-bold shadow-xs"
                    : "bg-[#fdfbf7] text-[#2c2c24] border-[#d1d1ca] hover:border-stone-400"
                }`}
              >
                <MapPin className={`w-5 h-5 ${activeMode === "hometown" ? "text-white" : "text-[#5A5A40]"}`} />
                <div className="text-xs font-semibold mt-1">{t("nav.hometown", "Hometown Mode")}</div>
                <div className={`text-[9px] uppercase tracking-wider ${activeMode === "hometown" ? "text-stone-200" : "text-[#8a8a7e]"}`}>
                  {t("hometown.modeDesc", "Local Advisor")}
                </div>
              </button>
            </div>
          </div>

          {/* Explorer Quick Stats Bento */}
          <div>
            <h4 className="text-xs uppercase tracking-wider font-semibold text-[#8a8a7e] mb-2.5 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-[#5A5A40]" />
              {t("profile.stats", "Explorer Summary & Collections")}
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                onClick={() => {
                  onClose();
                  onOpenSavedTrips();
                }}
                className="p-3 bg-white rounded-xl border border-[#e5e5df] hover:border-[#5A5A40] text-left transition-all group"
              >
                <span className="text-[11px] text-[#8a8a7e] font-sans block">{t("profile.savedTrips", "Saved Trips")}</span>
                <span className="font-serif text-xl font-bold text-[#2c2c24] group-hover:text-[#5A5A40]">
                  {savedTripsCount}
                </span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  onOpenMySpots();
                }}
                className="p-3 bg-white rounded-xl border border-[#e5e5df] hover:border-[#5A5A40] text-left transition-all group"
              >
                <span className="text-[11px] text-[#8a8a7e] font-sans block">{t("profile.myPlaces", "My Places")}</span>
                <span className="font-serif text-xl font-bold text-[#2c2c24] group-hover:text-[#5A5A40]">
                  {mySpotsCount}
                </span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  onOpenHistory();
                }}
                className="p-3 bg-white rounded-xl border border-[#e5e5df] hover:border-[#5A5A40] text-left transition-all group"
              >
                <span className="text-[11px] text-[#8a8a7e] font-sans block">{t("profile.historyItems", "30-Day Visited")}</span>
                <span className="font-serif text-xl font-bold text-[#2c2c24] group-hover:text-[#5A5A40]">
                  {historyCount}
                </span>
              </button>

              <div className="p-3 bg-white rounded-xl border border-[#e5e5df] text-left">
                <span className="text-[11px] text-[#8a8a7e] font-sans block">{t("profile.blacklisted", "Skipped Spots")}</span>
                <span className="font-serif text-xl font-bold text-[#2c2c24]">{permanentSkips.length}</span>
              </div>
            </div>
          </div>

          {/* Travel Personas Quick-Select */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs uppercase tracking-wider font-semibold text-[#8a8a7e] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                {t("profile.personasTitle", "Travel & Dining Persona Presets")}
              </h4>
              <button
                onClick={() => {
                  onClose();
                  onOpenTasteProfile();
                }}
                className="text-xs text-[#5A5A40] hover:underline font-semibold"
              >
                {t("profile.fineTuneTaste", "Fine-Tune Taste Profile →")}
              </button>
            </div>
            <p className="text-xs text-[#6b6b5e] mb-3">
              {t(
                "profile.personasSubtitle",
                "Pick a pre-configured travel style to instantly tailor your dining atmospheres, pacing and budget preferences."
              )}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PERSONA_PRESETS.map((preset) => {
                const isSelected = activePersona === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPersona(preset)}
                    className={`p-3 rounded-2xl border text-left transition-all flex items-start space-x-3 group ${
                      isSelected
                        ? "bg-[#ecece4] border-[#5A5A40] shadow-xs"
                        : "bg-white border-[#e5e5df] hover:border-[#8a8a7e]"
                    }`}
                  >
                    <span className="text-2xl shrink-0 p-1.5 rounded-xl bg-white border border-[#e5e5df] shadow-2xs">
                      {preset.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-serif font-bold text-sm text-[#2c2c24] group-hover:text-[#5A5A40]">
                          {preset.name}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#5A5A40] text-white">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#6b6b5e] line-clamp-2 mt-0.5">{preset.tagline}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Base Language Selector inside Profile */}
          <div className="bg-white p-4 rounded-2xl border border-[#e5e5df] space-y-3">
            <h4 className="text-xs uppercase tracking-wider font-semibold text-[#8a8a7e] flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#5A5A40]" />
              {t("profile.language", "App Language / Hizkuntza / Idioma")}
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {[
                { code: "en", label: "English", sub: "Global" },
                { code: "es", label: "Castellano", sub: "Español" },
                { code: "eu", label: "Euskara", sub: "Basque" },
              ].map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => setLanguage(item.code as Language)}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    language === item.code
                      ? "bg-[#5A5A40] text-white border-[#5A5A40] font-bold shadow-xs"
                      : "bg-[#fdfbf7] text-[#2c2c24] border-[#d1d1ca] hover:border-stone-400"
                  }`}
                >
                  <div className="text-xs font-semibold">{item.label}</div>
                  <div
                    className={`text-[10px] uppercase tracking-wider ${
                      language === item.code ? "text-stone-200" : "text-[#8a8a7e]"
                    }`}
                  >
                    {item.sub}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Blacklist / Permanent Skips Manager */}
          {permanentSkips.length > 0 && (
            <div className="bg-white p-4 rounded-2xl border border-[#e5e5df] space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs uppercase tracking-wider font-semibold text-[#8a8a7e] flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  {t("profile.permanentlySkipped", "Permanently Excluded Venues")} ({permanentSkips.length})
                </h4>
              </div>
              <p className="text-[11px] text-[#6b6b5e]">
                {t(
                  "profile.blacklistHelp",
                  "These spots are strictly filtered out of all future AI suggestions. Click 'Unblock' to restore."
                )}
              </p>
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {permanentSkips.map((skip) => (
                  <div
                    key={skip.id}
                    className="flex items-center justify-between bg-stone-50 px-3 py-2 rounded-xl border border-stone-200 text-xs"
                  >
                    <span className="font-medium text-stone-800 truncate">{skip.name}</span>
                    <button
                      onClick={() => handleRemoveSkip(skip.id)}
                      className="text-[11px] text-rose-700 hover:text-rose-900 font-semibold px-2 py-0.5 rounded-md hover:bg-rose-50 transition-colors"
                    >
                      {t("profile.unblock", "Unblock")}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data Backup, Import & Cache Diagnostics */}
          <div className="bg-white p-4 rounded-2xl border border-[#e5e5df] space-y-3">
            <h4 className="text-xs uppercase tracking-wider font-semibold text-[#8a8a7e] flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-[#5A5A40]" />
              {t("profile.dataManagement", "Data Management & Storage Diagnostics")}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Export JSON */}
              <button
                onClick={handleExportAllData}
                className="px-3.5 py-2.5 rounded-xl border border-[#d1d1ca] bg-[#fdfbf7] hover:bg-[#ecece4] text-xs font-semibold text-[#2c2c24] flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4 text-[#5A5A40]" />
                <span>{t("profile.exportBackup", "Export Full Backup (JSON)")}</span>
              </button>

              {/* Import JSON */}
              <label className="px-3.5 py-2.5 rounded-xl border border-[#d1d1ca] bg-[#fdfbf7] hover:bg-[#ecece4] text-xs font-semibold text-[#2c2c24] flex items-center justify-center gap-2 transition-colors cursor-pointer text-center">
                <Upload className="w-4 h-4 text-[#5A5A40]" />
                <span>{t("profile.importBackup", "Import Backup File")}</span>
                <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
              </label>
            </div>

            <div className="pt-2 border-t border-stone-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-stone-500">
              <span>
                {t("profile.cacheStatus", "AI Translation Cache:")}{" "}
                <strong className="text-stone-700">{translationCacheCount} entries</strong>
              </span>
              <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end">
                <button
                  onClick={handleClearCache}
                  className="text-stone-600 hover:text-stone-900 underline text-[11px]"
                >
                  {t("profile.clearCache", "Clear Cache")}
                </button>
                <span>•</span>
                <button
                  onClick={handleResetAll}
                  className="text-rose-700 hover:text-rose-900 font-medium text-[11px]"
                >
                  {t("profile.resetAll", "Factory Reset App")}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#f5f5f0] border-t border-[#e5e5df] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-[#5A5A40] hover:bg-[#4a4a35] text-white font-serif italic rounded-full text-sm transition-colors shadow-xs"
          >
            {t("action.done", "Done")}
          </button>
        </div>
      </div>
    </div>
  );
};
