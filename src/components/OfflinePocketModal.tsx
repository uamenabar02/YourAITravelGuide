import React, { useState, useEffect } from "react";
import { ItineraryPlan } from "../types";
import {
  X,
  Smartphone,
  Download,
  CheckCircle,
  Circle,
  WifiOff,
  Lightbulb,
  MapPin,
  FileText,
  AlertTriangle,
  Sparkles,
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

interface OfflinePocketModalProps {
  plan: ItineraryPlan;
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (msg: string, type?: "success" | "info" | "error") => void;
}

export const OfflinePocketModal: React.FC<OfflinePocketModalProps> = ({
  plan,
  isOpen,
  onClose,
  onShowToast,
}) => {
  const { t } = useLanguage();
  const [isSaved, setIsSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"viewer" | "notes" | "emergency">("viewer");
  const [selectedDayNum, setSelectedDayNum] = useState<number>(1);
  const [notes, setNotes] = useState<string>("");
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [filterUnvisitedOnly, setFilterUnvisitedOnly] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const saved = isPlanSavedOffline(plan.id);
      setIsSaved(saved);
      const offlineData = getOfflinePlanById(plan.id);
      if (offlineData) {
        setNotes(offlineData.offlineNotes || "");
        setCompletedIds(offlineData.completedActivityIds || []);
      }
    }
  }, [isOpen, plan.id]);

  if (!isOpen) return null;

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-20 select-none"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-[#e5e5df] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-6 bg-[#2c2c24] text-white flex items-center justify-between border-b border-[#3a3a30]">
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

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#a8a89f] hover:text-white rounded-full hover:bg-white/10 transition-colors shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Offline Cache Status Bar */}
        <div className="bg-[#f5f5f0] px-4 sm:px-5 py-3 border-b border-[#e5e5df] flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center space-x-2 min-w-0">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                isSaved ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
              }`}
            />
            <span className="font-semibold text-[#2c2c24] truncate">
              {isSaved ? t("pocket.cached", "Cached in Browser Storage") : t("pocket.notCached", "Not Cached Yet")}
            </span>
            <span className="text-[#8a8a7e] hidden sm:inline truncate">
              • {t("pocket.visitedCount", { count: completedCount, total: totalActivities, percent: progressPercent })}
            </span>
          </div>

          <div className="flex items-center space-x-2 ml-auto shrink-0">
            <button
              type="button"
              onClick={handleToggleSaveOffline}
              className={`px-3 py-1 rounded-xl text-xs font-serif italic border transition-all shrink-0 whitespace-nowrap ${
                isSaved
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                  : "bg-[#5A5A40] text-white border-[#5A5A40] hover:bg-[#4a4a35]"
              }`}
            >
              {isSaved ? t("pocket.cachedBtn", "✓ Cached Offline") : t("pocket.cacheBtn", "💾 Cache Trip in Browser")}
            </button>

            <button
              type="button"
              onClick={handleDownloadOfflineHTML}
              title="Download a self-contained offline HTML file that opens anywhere"
              className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-white text-[#2c2c24] hover:bg-[#ecece4] border border-[#d1d1ca] font-serif italic text-xs transition-colors shadow-2xs shrink-0 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-[#5A5A40]" />
              <span>{t("pocket.downloadHtml", "Download HTML File")}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center px-4 sm:px-5 pt-3 border-b border-[#e5e5df] space-x-3 sm:space-x-4 text-xs font-serif italic overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab("viewer")}
            className={`pb-2.5 border-b-2 font-medium transition-all shrink-0 whitespace-nowrap ${
              activeTab === "viewer"
                ? "border-[#5A5A40] text-[#5A5A40] font-bold"
                : "border-transparent text-[#8a8a7e] hover:text-[#2c2c24]"
            }`}
          >
            {t("pocket.tabChecklist", "📋 Pocket Checklist & Schedule")}
          </button>
          <button
            onClick={() => setActiveTab("notes")}
            className={`pb-2.5 border-b-2 font-medium transition-all shrink-0 whitespace-nowrap ${
              activeTab === "notes"
                ? "border-[#5A5A40] text-[#5A5A40] font-bold"
                : "border-transparent text-[#8a8a7e] hover:text-[#2c2c24]"
            }`}
          >
            {t("pocket.tabNotes", "📝 Offline Notes & Memos")}
          </button>
          <button
            onClick={() => setActiveTab("emergency")}
            className={`pb-2.5 border-b-2 font-medium transition-all shrink-0 whitespace-nowrap ${
              activeTab === "emergency"
                ? "border-[#5A5A40] text-[#5A5A40] font-bold"
                : "border-transparent text-[#8a8a7e] hover:text-[#2c2c24]"
            }`}
          >
            {t("pocket.tabEmergency", "🚨 Emergency & Offline Info")}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === "viewer" && (
            <div className="space-y-4">
              {/* Day Selector Tabs */}
              <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
                <div className="flex items-center space-x-1.5">
                  {plan.days.map((day) => (
                    <button
                      key={day.dayNumber}
                      onClick={() => setSelectedDayNum(day.dayNumber)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-serif italic transition-all shrink-0 whitespace-nowrap ${
                        selectedDayNum === day.dayNumber
                          ? "bg-[#5A5A40] text-white font-semibold shadow-xs"
                          : "bg-[#f5f5f0] text-[#2c2c24] border border-[#d1d1ca] hover:bg-[#ecece4]"
                      }`}
                    >
                      {t("nav.vacation", "Day")} {day.dayNumber}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setFilterUnvisitedOnly(!filterUnvisitedOnly)}
                  className={`text-[11px] font-sans px-2.5 py-1 rounded-lg border transition-colors shrink-0 whitespace-nowrap ${
                    filterUnvisitedOnly
                      ? "bg-[#5A5A40] text-white border-[#5A5A40]"
                      : "bg-white text-[#6b6b5e] border-[#d1d1ca]"
                  }`}
                >
                  {filterUnvisitedOnly ? t("pocket.showRemaining", "Showing Remaining") : t("pocket.showAll", "Show All")}
                </button>
              </div>

              {/* Current Day Header */}
              <div className="bg-[#f5f5f0] p-3 rounded-2xl border border-[#e5e5df]">
                <h4 className="font-serif font-bold italic text-sm text-[#2c2c24]">
                  {currentDay.dayTitle}
                </h4>
                <p className="text-xs text-[#6b6b5e] italic font-serif mt-0.5">
                  "{currentDay.summary}"
                </p>
              </div>

              {/* Activities Checklist */}
              <div className="space-y-3">
                {displayedActivities.length === 0 ? (
                  <div className="text-center py-8 bg-[#f5f5f0]/60 rounded-2xl border border-dashed border-[#d1d1ca] text-xs text-[#8a8a7e]">
                    {t("pocket.allVisited", "🎉 All spots for this day have been visited!")}
                  </div>
                ) : (
                  displayedActivities.map((act, idx) => {
                    const isCompleted = completedIds.includes(act.id);
                    return (
                      <div
                        key={act.id || idx}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          isCompleted
                            ? "bg-emerald-50/50 border-emerald-200 opacity-75"
                            : "bg-white border-[#d1d1ca] shadow-2xs hover:border-[#5A5A40]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => handleToggleVisit(act.id)}
                            className="flex items-start space-x-3 text-left flex-1 min-w-0"
                          >
                            <div className="mt-0.5 shrink-0">
                              {isCompleted ? (
                                <CheckCircle className="w-5 h-5 text-emerald-600" />
                              ) : (
                                <Circle className="w-5 h-5 text-[#8a8a7e] hover:text-[#5A5A40]" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center space-x-2">
                                <h5
                                  className={`font-serif text-sm font-semibold italic text-[#2c2c24] truncate ${
                                    isCompleted ? "line-through text-[#8a8a7e]" : ""
                                  }`}
                                >
                                  {act.name}
                                </h5>
                                <span className="text-[10px] font-sans font-bold bg-[#ecece4] px-2 py-0.5 rounded-md text-[#5A5A40] shrink-0">
                                  {act.time}
                                </span>
                              </div>
                              <p className="text-xs text-[#2c2c24]/90 mt-1 font-sans leading-relaxed">
                                {act.description}
                              </p>
                            </div>
                          </button>
                        </div>

                        {act.insiderTip && (
                          <div className="mt-2.5 bg-[#ecece4] p-2 rounded-xl text-xs flex items-start space-x-2 border border-[#d1d1ca]">
                            <Lightbulb className="w-3.5 h-3.5 text-[#5A5A40] shrink-0 mt-0.5" />
                            <span className="text-[#2c2c24] font-sans">{act.insiderTip}</span>
                          </div>
                        )}

                        {act.address && (
                          <div className="mt-2 text-[11px] text-[#8a8a7e] flex items-center space-x-1">
                            <MapPin className="w-3 h-3 text-[#5A5A40] shrink-0" />
                            <span className="truncate">{act.address}</span>
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
            <div className="space-y-4 text-xs font-sans">
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl space-y-2">
                <div className="flex items-center space-x-2 text-amber-900 font-serif font-bold italic text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>{t("pocket.emergencyTitle", "Important Emergency Hotlines")}</span>
                </div>
                <p className="text-amber-950">
                  {t("pocket.emergencyDesc", "Save or write down these local contacts before embarking without internet:")}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-xs">
                  <div className="bg-white p-2.5 rounded-xl border border-amber-200">
                    <span className="text-[#8a8a7e] block text-[10px] uppercase font-bold">{t("pocket.emergencyEU", "General Emergency (EU)")}</span>
                    <span className="font-bold text-base text-amber-900">112</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-amber-200">
                    <span className="text-[#8a8a7e] block text-[10px] uppercase font-bold">{t("pocket.medical", "Medical / Ambulance")}</span>
                    <span className="font-bold text-base text-amber-900">061</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-amber-200">
                    <span className="text-[#8a8a7e] block text-[10px] uppercase font-bold">{t("pocket.localPolice", "Local Police (Policía Local)")}</span>
                    <span className="font-bold text-base text-amber-900">092</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-amber-200">
                    <span className="text-[#8a8a7e] block text-[10px] uppercase font-bold">{t("pocket.nationalPolice", "National Police")}</span>
                    <span className="font-bold text-base text-amber-900">091</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#f5f5f0] p-4 rounded-2xl border border-[#e5e5df] space-y-2">
                <h5 className="font-serif font-bold italic text-[#2c2c24] text-sm">
                  {t("pocket.phrasesTitle", "Essential Local Phrases (Spanish / Basque)")}
                </h5>
                <ul className="space-y-1 text-xs text-[#2c2c24]">
                  <li>• <strong>Hello:</strong> Hola / Kaixo</li>
                  <li>• <strong>Thank you very much:</strong> Muchas gracias / Eskerrik asko</li>
                  <li>• <strong>The bill, please:</strong> La cuenta, por favor</li>
                  <li>• <strong>Where is...?:</strong> ¿Dónde está...? / Non dago...?</li>
                  <li>• <strong>Do you speak English?:</strong> ¿Habla inglés?</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-[#f5f5f0] border-t border-[#e5e5df] flex items-center justify-between text-xs">
          <span className="text-[#8a8a7e] font-sans truncate">
            {t("pocket.readyOffline", { dest: plan.destinationOrTown })}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#5A5A40] text-white font-serif italic hover:bg-[#4a4a35] transition-colors shadow-2xs shrink-0 ml-2"
          >
            {t("action.done", "Done")}
          </button>
        </div>
      </div>
    </div>
  );
};
