import React, { useState, useEffect } from "react";
import { ItineraryPlan } from "../types";
import {
  X,
  Smartphone,
  Download,
  CheckSquare,
  CheckCircle,
  Circle,
  WifiOff,
  Lightbulb,
  MapPin,
  FileText,
  AlertTriangle,
  Sparkles,
  Calendar,
  Phone,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Zap,
  Utensils,
  Plus,
  Trash2,
  Globe,
  ShieldCheck,
  Info,
} from "lucide-react";
import {
  isPlanSavedOffline,
  savePlanForOffline,
  removeOfflinePlan,
  getOfflinePlanById,
  toggleOfflineActivityCompleted,
  updateOfflineNotes,
  downloadOfflinePackage,
} from "../utils/offlineStorage";
import { useLanguage } from "../context/LanguageContext";
import { TranslatedText } from "./TranslatedText";

interface CustomContact {
  id: string;
  name: string;
  phone: string;
  relation?: string;
}

interface OfflinePocketModalProps {
  plan: ItineraryPlan;
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (msg: string, type?: "success" | "info" | "error") => void;
  isInline?: boolean;
}

export const OfflinePocketModal: React.FC<OfflinePocketModalProps> = ({
  plan,
  isOpen,
  onClose,
  onShowToast,
  isInline = false,
}) => {
  const { t } = useLanguage();
  const [isSaved, setIsSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"viewer" | "notes" | "emergency">("viewer");
  const [selectedDayNum, setSelectedDayNum] = useState<number>(1);
  const [notes, setNotes] = useState<string>("");
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [filterUnvisitedOnly, setFilterUnvisitedOnly] = useState(false);
  const [expandedActIds, setExpandedActIds] = useState<Record<string, boolean>>({});
  const [copiedPhrase, setCopiedPhrase] = useState<string | null>(null);

  // Custom emergency contacts state
  const [customContacts, setCustomContacts] = useState<CustomContact[]>([]);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactRelation, setNewContactRelation] = useState("");

  const toggleExpandAct = (id: string) => {
    setExpandedActIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPhrase(label);
    onShowToast?.(`Copied: "${text}"`, "success");
    setTimeout(() => setCopiedPhrase(null), 2000);
  };

  useEffect(() => {
    if (isOpen || isInline) {
      const saved = isPlanSavedOffline(plan.id);
      setIsSaved(saved);
      const offlineData = getOfflinePlanById(plan.id);
      if (offlineData) {
        setNotes(offlineData.offlineNotes || "");
        setCompletedIds(offlineData.completedActivityIds || []);
      }

      // Load custom emergency contacts
      try {
        const stored = localStorage.getItem(`localexplorer_custom_contacts_${plan.id}`);
        if (stored) {
          setCustomContacts(JSON.parse(stored));
        }
      } catch (e) {
        console.error("Failed to load custom contacts", e);
      }
    }
  }, [isOpen, isInline, plan.id]);

  const handleAddCustomContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim() || !newContactPhone.trim()) return;

    const contact: CustomContact = {
      id: `contact-${Date.now()}`,
      name: newContactName.trim(),
      phone: newContactPhone.trim(),
      relation: newContactRelation.trim() || "Emergency Contact",
    };

    const updated = [...customContacts, contact];
    setCustomContacts(updated);
    localStorage.setItem(`localexplorer_custom_contacts_${plan.id}`, JSON.stringify(updated));
    setNewContactName("");
    setNewContactPhone("");
    setNewContactRelation("");
    onShowToast?.("Custom emergency contact saved offline!", "success");
  };

  const handleDeleteCustomContact = (id: string) => {
    const updated = customContacts.filter((c) => c.id !== id);
    setCustomContacts(updated);
    localStorage.setItem(`localexplorer_custom_contacts_${plan.id}`, JSON.stringify(updated));
  };

  if (!isOpen && !isInline) return null;

  const handleToggleSaveOffline = () => {
    if (isSaved) {
      removeOfflinePlan(plan.id);
      setIsSaved(false);
      onShowToast?.("Removed from offline pocket cache", "info");
    } else {
      savePlanForOffline(plan, notes);
      setIsSaved(true);
      onShowToast?.("Trip saved for 100% offline access!", "success");
    }
  };

  const handleToggleVisit = (actId: string) => {
    const isNowDone = toggleOfflineActivityCompleted(plan.id, actId);
    setCompletedIds((prev) =>
      isNowDone ? [...prev, actId] : prev.filter((id) => id !== actId)
    );
  };

  const handleNotesChange = (val: string) => {
    setNotes(val);
    updateOfflineNotes(plan.id, val);
  };

  const handleDownloadOfflineHTML = () => {
    downloadOfflinePackage(plan, notes);
    onShowToast?.("Standalone Offline Pocket Guide downloaded!", "success");
  };

  const currentDay = plan.days.find((d) => d.dayNumber === selectedDayNum) || plan.days[0];
  const totalActivities = plan.days.reduce((acc, d) => acc + d.activities.length, 0);
  const completedCount = completedIds.length;
  const progressPercent = Math.round((completedCount / (totalActivities || 1)) * 100);

  const displayedActivities = currentDay.activities.filter((act) => {
    if (!filterUnvisitedOnly) return true;
    return !completedIds.includes(act.id);
  });

  const content = (
    <div
      className={`bg-white rounded-3xl w-full flex flex-col ${
        isInline ? "" : "max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl border border-[#e5e5df]"
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header - Hidden on mobile if inline */}
      <div className={`p-4 sm:p-6 bg-[#2c2c24] text-white flex items-center justify-between border-b border-[#3a3a30] rounded-t-3xl ${isInline ? 'hidden md:flex' : 'flex'}`}>
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#5A5A40] flex items-center justify-center text-white shrink-0 shadow-xs">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h3 className="font-serif text-base sm:text-xl font-bold italic text-white truncate">
                {t("pocket.title", "Offline Pocket Companion")}
              </h3>
              <span className="text-[10px] font-sans font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 shrink-0 hidden sm:inline-block">
                {t("pocket.airplaneReady", "Airplane Mode Ready")}
              </span>
            </div>
            <p className="text-xs text-[#d1d1ca] font-sans truncate">
              {plan.destinationOrTown} • {plan.totalDays} {t("action.days", "Days")} • {t("pocket.zeroInternet", "Zero Internet Required")}
            </p>
          </div>
        </div>

        {!isInline && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#a8a89f] hover:text-white rounded-full hover:bg-white/10 transition-colors shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

        {/* Offline Cache Status Bar - Compact and single-line on mobile */}
        <div className="bg-[#f5f5f0] px-3 sm:px-5 py-2 sm:py-3 border-b border-[#e5e5df] flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs">
          <div className="flex items-center space-x-1.5 min-w-0">
            <span
              className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0 ${
                isSaved ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
              }`}
            />
            <span className="font-semibold text-[#2c2c24] truncate">
              {isSaved ? t("pocket.cached", "Cached") : t("pocket.notCached", "Not Cached")}
            </span>
            <span className="text-[#8a8a7e] hidden sm:inline truncate">
              • {t("pocket.visitedCount", { count: completedCount, total: totalActivities, percent: progressPercent })}
            </span>
          </div>

          <div className="flex items-center space-x-1.5 ml-auto shrink-0">
            <button
              type="button"
              onClick={handleToggleSaveOffline}
              className={`px-2.5 py-1 sm:px-3 sm:py-1 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-serif italic border transition-all shrink-0 whitespace-nowrap ${
                isSaved
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                  : "bg-[#5A5A40] text-white border-[#5A5A40] hover:bg-[#4a4a35]"
              }`}
            >
              {isSaved ? "✓ Cached" : "💾 Cache Trip"}
            </button>

            <button
              type="button"
              onClick={handleDownloadOfflineHTML}
              title="Download standalone offline HTML file"
              className="flex items-center space-x-1 px-2 py-1 sm:px-3 sm:py-1 rounded-lg sm:rounded-xl bg-white text-[#2c2c24] hover:bg-[#ecece4] border border-[#d1d1ca] font-serif italic text-[10px] sm:text-xs transition-colors shadow-2xs shrink-0 whitespace-nowrap"
            >
              <Download className="w-3 h-3 text-[#5A5A40]" />
              <span className="hidden sm:inline">{t("pocket.downloadHtml", "Download HTML File")}</span>
              <span className="inline sm:hidden">HTML</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs - Aligned with App Navigation Bar Aesthetic */}
        <div className="px-1 sm:px-6 py-3 border-b border-[#e5e5df]/60 bg-[#fafaf7]">
          <div className="bg-white p-1 rounded-2xl border border-[#e5e5df] w-full grid grid-cols-3 gap-0.5 sm:gap-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab("viewer")}
              className={`flex flex-col sm:flex-row items-center justify-center space-y-0.5 sm:space-y-0 sm:space-x-2 py-1.5 sm:py-2.5 px-0.5 sm:px-3 rounded-xl text-[10px] sm:text-xs font-semibold tracking-tight transition-all cursor-pointer text-center w-full min-w-0 ${
                activeTab === "viewer"
                  ? "bg-[#5A5A40] text-white shadow-xs font-bold"
                  : "text-[#6b6b5e] hover:text-[#2c2c24] hover:bg-[#f5f5f0]"
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden sm:inline">{t("pocket.tabChecklist", "Checklist & Schedule")}</span>
              <span className="inline sm:hidden truncate max-w-full"><TranslatedText text="Checklist" /></span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("notes")}
              className={`flex flex-col sm:flex-row items-center justify-center space-y-0.5 sm:space-y-0 sm:space-x-2 py-1.5 sm:py-2.5 px-0.5 sm:px-3 rounded-xl text-[10px] sm:text-xs font-semibold tracking-tight transition-all cursor-pointer text-center w-full min-w-0 ${
                activeTab === "notes"
                  ? "bg-[#5A5A40] text-white shadow-xs font-bold"
                  : "text-[#6b6b5e] hover:text-[#2c2c24] hover:bg-[#f5f5f0]"
              }`}
            >
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden sm:inline">{t("pocket.tabNotes", "Offline Notes")}</span>
              <span className="inline sm:hidden truncate max-w-full"><TranslatedText text="Notes" /></span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("emergency")}
              className={`flex flex-col sm:flex-row items-center justify-center space-y-0.5 sm:space-y-0 sm:space-x-2 py-1.5 sm:py-2.5 px-0.5 sm:px-3 rounded-xl text-[10px] sm:text-xs font-semibold tracking-tight transition-all cursor-pointer text-center w-full min-w-0 ${
                activeTab === "emergency"
                  ? "bg-[#5A5A40] text-white shadow-xs font-bold"
                  : "text-[#6b6b5e] hover:text-[#2c2c24] hover:bg-[#f5f5f0]"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-amber-500" />
              <span className="hidden sm:inline">{t("pocket.tabEmergency", "Emergency Info")}</span>
              <span className="inline sm:hidden truncate max-w-full"><TranslatedText text="Emergency" /></span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === "viewer" && (
            <div className="space-y-4">
              {/* Day Selector Dropdown */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-[#d1d1ca] shadow-3xs">
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <Calendar className="w-4 h-4 text-[#5A5A40] shrink-0" />
                  <span className="text-xs font-serif font-bold italic text-[#2c2c24] shrink-0"><TranslatedText text="Selected Day:" /></span>
                  <select
                    value={selectedDayNum}
                    onChange={(e) => setSelectedDayNum(Number(e.target.value))}
                    className="flex-1 min-w-[140px] bg-[#f5f5f0] text-xs font-serif italic font-bold text-[#2c2c24] px-2.5 py-1.5 rounded-xl border border-[#d1d1ca] focus:outline-none focus:border-[#5A5A40] cursor-pointer"
                  >
                    {plan.days.map((day) => (
                      <option key={day.dayNumber} value={day.dayNumber}>
                        Day {day.dayNumber}: {day.theme || day.dayTitle}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setFilterUnvisitedOnly(!filterUnvisitedOnly)}
                  className={`text-[11px] font-sans px-3 py-1.5 rounded-xl border transition-colors shrink-0 whitespace-nowrap ${
                    filterUnvisitedOnly
                      ? "bg-[#5A5A40] text-white border-[#5A5A40]"
                      : "bg-[#f5f5f0] text-[#6b6b5e] border-[#d1d1ca] hover:bg-[#ecece4]"
                  }`}
                >
                  {filterUnvisitedOnly ? t("pocket.showRemaining", "Showing Remaining") : t("pocket.showAll", "Show All")}
                </button>
              </div>

              {/* Current Day Header */}
              <div className="bg-[#f5f5f0] p-3 rounded-2xl border border-[#e5e5df]">
                <h4 className="font-serif font-bold italic text-sm text-[#2c2c24]">
                  <TranslatedText text={currentDay.dayTitle} />
                </h4>
                <p className="text-xs text-[#6b6b5e] italic font-serif mt-0.5">
                  "<TranslatedText text={currentDay.summary} />"
                </p>
              </div>

              {/* Activities Checklist */}
              <div className="space-y-3.5">
                {displayedActivities.length === 0 ? (
                  <div className="text-center py-10 bg-[#f5f5f0]/60 rounded-3xl border border-dashed border-[#d1d1ca] text-xs text-[#8a8a7e]">
                    {t("pocket.allVisited", "🎉 All spots for this day have been visited!")}
                  </div>
                ) : (
                  displayedActivities.map((act, idx) => {
                    const isCompleted = completedIds.includes(act.id);
                    const isExpanded = !!expandedActIds[act.id];
                    return (
                      <div
                        key={act.id || idx}
                        className={`rounded-2xl border transition-all duration-200 ${
                          isCompleted
                            ? "bg-emerald-50/30 border-emerald-200/80 opacity-70"
                            : "bg-white border-[#d1d1ca] shadow-2xs hover:border-[#5A5A40] hover:shadow-xs"
                        }`}
                      >
                        <div className="p-3.5 flex items-center justify-between gap-3">
                          <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                            {/* Larger, touch-optimized circular checkbox target */}
                            <button
                              type="button"
                              onClick={() => handleToggleVisit(act.id)}
                              className="p-1 -m-1 focus:outline-none shrink-0"
                              title={isCompleted ? "Mark unvisited" : "Mark visited"}
                            >
                              <div className="w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer">
                                {isCompleted ? (
                                  <CheckCircle className="w-5.5 h-5.5 text-emerald-600 fill-emerald-50/50" />
                                ) : (
                                  <div className="w-5.5 h-5.5 rounded-full border-2 border-[#8a8a7e] hover:border-[#5A5A40] bg-white" />
                                )}
                              </div>
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h5
                                  className={`font-serif text-sm font-semibold italic text-[#2c2c24] break-words whitespace-normal leading-snug cursor-pointer hover:text-[#5A5A40]`}
                                  onClick={() => toggleExpandAct(act.id)}
                                >
                                  <TranslatedText text={act.name} />
                                </h5>
                                <span className="text-[10px] font-mono font-bold bg-[#ecece4] px-2 py-0.5 rounded-md text-[#5A5A40] shrink-0 whitespace-nowrap">
                                  {act.time}
                                </span>
                              </div>
                              {act.address && !isExpanded && (
                                <p className="text-[10px] text-[#8a8a7e] truncate mt-0.5 font-sans">
                                  {act.address}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Expansion toggle caret */}
                          <button
                            type="button"
                            onClick={() => toggleExpandAct(act.id)}
                            className="p-1.5 rounded-lg text-[#8a8a7e] hover:text-[#2c2c24] hover:bg-[#f5f5f0] transition-colors shrink-0"
                            title={isExpanded ? "Collapse details" : "Expand pocket guidebook details"}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        {/* Collapsible Rich Guidebook Details panel */}
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-1 border-t border-[#ecece5] bg-[#fafaf7]/50 rounded-b-2xl space-y-3 text-xs">
                            {act.description && (
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8a8a7e] font-sans"><TranslatedText text="About Spot" /></span>
                                <p className="text-[#2c2c24] font-sans leading-relaxed break-words whitespace-normal">
                                  <TranslatedText text={act.description} />
                                </p>
                              </div>
                            )}

                            {act.mustSeeReason && (
                              <div className="p-2.5 bg-[#ecece4]/30 rounded-xl border border-[#d1d1ca]/50 space-y-0.5">
                                <span className="text-[10px] font-bold text-[#5A5A40] flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-[#5A5A40]" />
                                  <span><TranslatedText text="MUST-SEE REASON" /></span>
                                </span>
                                <p className="text-[#4a4a37] font-serif italic font-medium leading-relaxed">
                                  "<TranslatedText text={act.mustSeeReason} />"
                                </p>
                              </div>
                            )}

                            {act.address && (
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8a8a7e] font-sans"><TranslatedText text="Address & Coordinates" /></span>
                                <div className="flex items-center justify-between gap-2 p-2 bg-white rounded-xl border border-[#d1d1ca] min-w-0">
                                  <div className="flex items-center space-x-2 min-w-0">
                                    <MapPin className="w-3.5 h-3.5 text-[#5A5A40] shrink-0" />
                                    <span className="text-[11px] text-[#2c2c24] truncate">{act.address}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(act.address || "", act.name)}
                                    className="p-1 hover:bg-[#f5f5f0] text-[#8a8a7e] hover:text-[#2c2c24] rounded transition-colors shrink-0"
                                    title="Copy address"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}

                            <div className="flex items-center justify-between text-[10px] text-[#8a8a7e] pt-1">
                              <span className="capitalize font-mono"><TranslatedText text="Category" />: <TranslatedText text={act.category || "culture"} /></span>
                              {act.duration && <span><TranslatedText text="Duration" />: <TranslatedText text={act.duration} /></span>}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {activeTab === "notes" && (
            <div className="space-y-3">
              <div className="bg-[#f5f5f0] p-3 rounded-2xl border border-[#e5e5df] text-xs text-[#6b6b5e]">
                {t("pocket.notesTip", "💡 Notes entered here are saved locally on your device and will be included inside your downloaded offline guide.")}
              </div>
              <textarea
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder={t("pocket.notesPlaceholder", "Add door access codes, reservation numbers, emergency notes, metro card numbers, or local reminders here...")}
                rows={8}
                className="w-full p-3.5 border border-[#d1d1ca] rounded-2xl text-xs sm:text-sm font-sans focus:outline-none focus:border-[#5A5A40] bg-white leading-relaxed"
              />
            </div>
          )}

          {activeTab === "emergency" && (
            <div className="space-y-5 text-xs font-sans">
              {/* Emergency Hotlines Box */}
              <div className="bg-amber-50/50 border border-amber-200 p-4 rounded-2xl space-y-3">
                <div className="flex items-center space-x-2 text-amber-900 font-serif font-bold italic text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>{t("pocket.emergencyTitle", "Important Emergency Hotlines")}</span>
                </div>
                <p className="text-amber-950/80 leading-relaxed">
                  {t("pocket.emergencyDesc", "Tap to call directly from your smartphone or copy these local numbers to your contacts list:")}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs">
                  {[
                    { label: t("pocket.emergencyEU", "General Emergency (EU)"), num: "112", icon: "🚨" },
                    { label: t("pocket.medical", "Medical / Ambulance"), num: "061", icon: "🚑" },
                    { label: t("pocket.localPolice", "Local Police (Policía Local)"), num: "092", icon: "👮" },
                    { label: t("pocket.nationalPolice", "National Police / Guardia Civil"), num: "091", icon: "🚔" },
                  ].map((item) => (
                    <div
                      key={item.num}
                      className="bg-white p-3 rounded-xl border border-amber-200 flex items-center justify-between shadow-2xs hover:shadow-xs hover:border-amber-300 transition-all"
                    >
                      <div className="min-w-0">
                        <span className="text-[#8a8a7e] block text-[9px] uppercase font-bold tracking-wider">{item.label}</span>
                        <span className="font-serif italic font-bold text-lg text-amber-950 flex items-center gap-1.5 mt-0.5">
                          <span>{item.icon}</span>
                          <span>{item.num}</span>
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 shrink-0">
                        <a
                          href={`tel:${item.num}`}
                          className="p-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl transition-colors border border-rose-100"
                          title={`Call ${item.num} now`}
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(item.num, item.label)}
                          className="p-2 hover:bg-amber-50 text-[#8a8a7e] hover:text-[#2c2c24] rounded-xl transition-colors"
                          title="Copy number"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Custom User Emergency Contacts Sub-section */}
                <div className="pt-3 border-t border-amber-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-serif font-bold italic text-amber-950 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                      {t("pocket.customContactsTitle", "Custom Emergency Contacts & Embassy")}
                    </span>
                    <span className="text-[10px] text-amber-800 font-mono">{t("pocket.savedOffline", "Saved Offline")}</span>
                  </div>

                  {customContacts.length > 0 && (
                    <div className="space-y-1.5">
                      {customContacts.map((c) => (
                        <div
                          key={c.id}
                          className="bg-white p-2.5 rounded-xl border border-amber-200 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-semibold text-amber-950 font-serif italic">{c.name}</span>
                            <span className="text-[10px] text-[#8a8a7e] block font-sans">
                              {c.relation || "Contact"} • {c.phone}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <a
                              href={`tel:${c.phone}`}
                              className="p-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomContact(c.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Custom Contact Form */}
                  <form onSubmit={handleAddCustomContact} className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 pt-1">
                    <input
                      type="text"
                      value={newContactName}
                      onChange={(e) => setNewContactName(e.target.value)}
                      placeholder={t("pocket.contactNamePlaceholder", "Contact Name (e.g. US Embassy)")}
                      className="px-2.5 py-1.5 bg-white border border-amber-200 rounded-xl text-xs focus:outline-none focus:border-amber-500 font-sans"
                    />
                    <input
                      type="tel"
                      value={newContactPhone}
                      onChange={(e) => setNewContactPhone(e.target.value)}
                      placeholder={t("pocket.contactPhonePlaceholder", "Phone (+34 91 587 2200)")}
                      className="px-2.5 py-1.5 bg-white border border-amber-200 rounded-xl text-xs focus:outline-none focus:border-amber-500 font-sans"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-amber-800 text-white rounded-xl text-xs font-serif italic hover:bg-amber-900 transition-colors flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t("pocket.saveContact", "Save Contact")}</span>
                    </button>
                  </form>
                </div>
              </div>

              {/* Local Etiquette & Tipping Cheat-Sheet */}
              <div className="bg-[#f5f5f0] p-4 rounded-2xl border border-[#e5e5df] space-y-3">
                <div className="flex items-center space-x-2 text-[#2c2c24] font-serif font-bold italic text-sm">
                  <Utensils className="w-4 h-4 text-[#5A5A40] shrink-0" />
                  <span>{t("pocket.etiquetteTitle", "Local Etiquette, Tipping & Schedules")}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="bg-white p-3 rounded-xl border border-[#d1d1ca] space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#5A5A40] block">
                      {t("pocket.tippingTitle", "Tipping Customs")}
                    </span>
                    <p className="text-xs text-[#2c2c24] font-sans leading-snug">
                      {t("pocket.tippingDesc", "Tipping is optional. Rounding up or leaving 5–10% for exceptional dining service is customary. Service charge (IVA) is included by law.")}
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-[#d1d1ca] space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#5A5A40] block">
                      {t("pocket.mealtimesTitle", "Mealtime Schedules")}
                    </span>
                    <p className="text-xs text-[#2c2c24] font-sans leading-snug">
                      {t("pocket.mealtimesDesc", "Lunch: 1:30 PM – 4:00 PM. Dinner: 8:30 PM – 11:00 PM. Pintxos & tapas bars operate continuously from 12:30 PM.")}
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-[#d1d1ca] space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#5A5A40] block">
                      {t("pocket.shopHoursTitle", "Shop Hours & Rest")}
                    </span>
                    <p className="text-xs text-[#2c2c24] font-sans leading-snug">
                      {t("pocket.shopHoursDesc", "Independent boutiques close 2:00 PM – 5:00 PM for afternoon break. Most non-tourist shops remain closed on Sundays.")}
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-[#d1d1ca] space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#5A5A40] block">
                      {t("pocket.tapWaterTitle", "Tap Water & Restrooms")}
                    </span>
                    <p className="text-xs text-[#2c2c24] font-sans leading-snug">
                      {t("pocket.tapWaterDesc", "Tap water ('agua del grifo') is 100% safe to drink. Public fountains ('fuentes') in parks are drinkable unless marked 'No potable'.")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Power Plugs & Voltage Cheat-Sheet */}
              <div className="bg-[#f5f5f0] p-4 rounded-2xl border border-[#e5e5df] space-y-3">
                <div className="flex items-center space-x-2 text-[#2c2c24] font-serif font-bold italic text-sm">
                  <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{t("pocket.powerTitle", "Power Plugs, Voltage & Utilities")}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div className="bg-white p-2.5 rounded-xl border border-[#d1d1ca] text-center">
                    <span className="text-[9px] uppercase font-bold text-[#8a8a7e] block">{t("pocket.voltageLabel", "Voltage")}</span>
                    <span className="font-serif italic font-bold text-sm text-[#2c2c24]">230V / 50Hz</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-[#d1d1ca] text-center">
                    <span className="text-[9px] uppercase font-bold text-[#8a8a7e] block">{t("pocket.plugTypeLabel", "Plug Type")}</span>
                    <span className="font-serif italic font-bold text-sm text-[#2c2c24]">Type C & F</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-[#d1d1ca] text-center col-span-2 sm:col-span-1">
                    <span className="text-[9px] uppercase font-bold text-[#8a8a7e] block">{t("pocket.adapterNeededLabel", "Adapter Needed?")}</span>
                    <span className="font-serif italic font-bold text-sm text-[#5A5A40]">{t("pocket.europlugStandard", "Europlug standard")}</span>
                  </div>
                </div>
              </div>

              {/* Essential Phrases & Survival Vocab Cheat-Sheet */}
              <div className="bg-[#f5f5f0] p-4 rounded-2xl border border-[#e5e5df] space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-serif font-bold italic text-[#2c2c24] text-sm flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-[#5A5A40]" />
                    <span>{t("pocket.phrasesTitle", "Essential Survival Phrases")}</span>
                  </h5>
                  <span className="text-[10px] font-sans font-semibold uppercase px-2 py-0.5 rounded-full bg-white text-[#5A5A40] border border-[#d1d1ca]">
                    <TranslatedText text="Tap to Copy" />
                  </span>
                </div>
                
                <div className="space-y-2">
                  {[
                    { foreign: "¡Ayuda! / Laguntza!", native: "Help!", cat: "emergency" },
                    { foreign: "¿Dónde está la farmacia / hospital?", native: "Where is the pharmacy / hospital?", cat: "emergency" },
                    { foreign: "Hola / Kaixo", native: "Hello", cat: "greeting" },
                    { foreign: "Muchas gracias / Eskerrik asko", native: "Thank you very much", cat: "politeness" },
                    { foreign: "La cuenta, por favor", native: "The bill, please", cat: "dining" },
                    { foreign: "¿Dónde está...? / Non dago...?", native: "Where is...?", cat: "transit" },
                    { foreign: "¿Habla inglés? / Ingeleraz badakizu?", native: "Do you speak English?", cat: "transit" },
                    { foreign: "¿Cuánto cuesta esto?", native: "How much does this cost?", cat: "dining" },
                  ].map((p, pIdx) => (
                    <div
                      key={pIdx}
                      onClick={() => copyToClipboard(p.foreign, p.native)}
                      className="group flex items-center justify-between p-2.5 bg-white rounded-xl border border-[#d1d1ca] hover:border-[#5A5A40] cursor-pointer hover:shadow-2xs transition-all"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-semibold text-xs text-[#2c2c24] font-serif italic break-words whitespace-normal block">
                            {p.foreign}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#6b6b5e] font-sans block mt-0.5">
                          {p.native}
                        </span>
                      </div>
                      <div className="text-[#8a8a7e] group-hover:text-[#5A5A40] p-1.5 bg-[#f5f5f0]/50 rounded-lg group-hover:bg-[#ecece4] transition-colors shrink-0">
                        <Copy className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-[#f5f5f0] border-t border-[#e5e5df] flex items-center justify-between text-xs rounded-b-3xl">
          <span className="text-[#8a8a7e] font-sans truncate">
            {t("pocket.readyOffline", { dest: plan.destinationOrTown })}
          </span>
          {!isInline && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#5A5A40] text-white font-serif italic hover:bg-[#4a4a35] transition-colors shadow-2xs shrink-0 ml-2"
            >
              {t("action.done", "Done")}
            </button>
          )}
        </div>
      </div>
  );

  if (isInline) {
    return content;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-20 select-none"
      onClick={onClose}
    >
      {content}
    </div>
  );
};
