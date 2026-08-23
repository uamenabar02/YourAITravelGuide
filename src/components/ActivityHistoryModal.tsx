import React, { useState, useEffect } from "react";
import {
  getActivityHistory,
  removeHistoryItem,
  clearActivityHistory,
  getPermanentSkips,
  removePermanentSkip,
} from "../utils/storage";
import { ActivityHistoryItem, PermanentSkip } from "../types";
import { X, History, Trash2, ShieldCheck, MapPin, Clock, Ban } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

interface ActivityHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onHistoryUpdated: () => void;
}

export const ActivityHistoryModal: React.FC<ActivityHistoryModalProps> = ({
  isOpen,
  onClose,
  onHistoryUpdated,
}) => {
  const { t } = useLanguage();
  const [items, setItems] = useState<ActivityHistoryItem[]>([]);
  const [skips, setSkips] = useState<PermanentSkip[]>([]);
  const [activeTab, setActiveTab] = useState<"recent" | "permanent">("recent");

  useEffect(() => {
    if (isOpen) {
      setItems(getActivityHistory());
      setSkips(getPermanentSkips());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRemove = (id: string) => {
    removeHistoryItem(id);
    setItems(getActivityHistory());
    onHistoryUpdated();
  };

  const handleRemoveSkip = (id: string) => {
    removePermanentSkip(id);
    setSkips(getPermanentSkips());
  };

  const handleClearAll = () => {
    if (window.confirm(t("history.clearConfirm", "Clear all 30-day activity history? The app will reset the anti-repeat memory filter."))) {
      clearActivityHistory();
      setItems([]);
      onHistoryUpdated();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#2c2c24]/40 backdrop-blur-xs flex items-center justify-center p-4 no-print animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-[#e5e5df] overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#e5e5df] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-[#ecece4] text-[#5A5A40]">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-2xl font-light italic text-[#2c2c24]">
                {t("history.title", "Memory & Exclusions")}
              </h3>
              <p className="text-xs text-[#8a8a7e] font-sans">
                {t("history.subtitle", "What LocalExplorer AI remembers — and what it must never suggest again")}
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

        {/* Tab Switcher */}
        <div className="px-5 sm:px-6 pt-4">
          <div className="flex rounded-xl bg-[#ecece4] p-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("recent")}
              className={`flex-1 py-2 rounded-lg font-medium transition-all flex items-center justify-center space-x-1.5 ${
                activeTab === "recent"
                  ? "bg-white text-[#2c2c24] shadow-xs font-semibold"
                  : "text-[#6b6b5e] hover:text-[#2c2c24]"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{t("history.tabMemory", "30-Day Memory ({count})").replace("{count}", items.length.toString())}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("permanent")}
              className={`flex-1 py-2 rounded-lg font-medium transition-all flex items-center justify-center space-x-1.5 ${
                activeTab === "permanent"
                  ? "bg-white text-[#2c2c24] shadow-xs font-semibold"
                  : "text-[#6b6b5e] hover:text-[#2c2c24]"
              }`}
            >
              <Ban className="w-3.5 h-3.5" />
              <span>{t("history.tabSkips", "Permanent Skips ({count})").replace("{count}", skips.length.toString())}</span>
            </button>
          </div>
        </div>

        {/* TAB 1: 30-Day Memory */}
        {activeTab === "recent" && (
          <>
            {/* Informational Banner */}
            <div className="mx-5 sm:mx-6 mt-4 bg-[#ecece4] p-4 border border-[#d1d1ca] rounded-2xl flex items-start space-x-2.5 text-xs text-[#2c2c24]">
              <ShieldCheck className="w-4 h-4 text-[#5A5A40] shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                {t("history.memoryDesc", "To keep your adventures fresh, LocalExplorer AI remembers suggested spots and hides them for 30 days. Remove individual spots below if you'd like them re-suggested sooner.")}
              </div>
            </div>

            {/* History List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-2.5 bg-[#f5f5f0]/40">
              {items.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-8 h-8 text-[#d1d1ca] mx-auto mb-2 stroke-1" />
                  <p className="font-serif text-base italic text-[#2c2c24]">{t("history.noHistory", "No activity history yet")}</p>
                  <p className="text-xs text-[#8a8a7e] mt-0.5">
                    {t("history.noHistorySub", "As you explore local itineraries, suggested spots are logged here.")}
                  </p>
                </div>
              ) : (
                items.map((item) => {
                  const daysAgo = Math.floor((Date.now() - item.timestamp) / (24 * 60 * 60 * 1000));
                  return (
                    <div
                      key={item.id}
                      className="bg-white p-3.5 rounded-2xl border border-[#e5e5df] flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-serif italic font-medium text-sm text-[#2c2c24] truncate">{item.name}</div>
                        <div className="flex items-center space-x-2 text-[11px] text-[#8a8a7e] mt-0.5">
                          <span className="capitalize font-medium text-[#5A5A40] bg-[#ecece4] px-2 py-0.5 rounded-full border border-[#d1d1ca]">
                            {item.category}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            <MapPin className="w-3 h-3 text-[#5A5A40]" />
                            {item.location}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-3 h-3 text-[#8a8a7e]" />
                            {daysAgo === 0 ? t("history.today", "Today") : t("history.daysAgo", "{days}d ago").replace("{days}", daysAgo.toString())}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleRemove(item.id)}
                        title="Allow this spot to be recommended again"
                        className="p-1.5 text-[#8a8a7e] hover:text-rose-600 hover:bg-[#ecece4] rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="p-4 bg-[#f5f5f0] border-t border-[#e5e5df] flex justify-between items-center text-xs">
                <span className="text-[#8a8a7e] font-serif italic">{t("history.spotsTracked", "{count} spots tracked").replace("{count}", items.length.toString())}</span>
                <button
                  onClick={handleClearAll}
                  className="text-rose-700 hover:text-rose-900 font-medium px-3 py-1 rounded-full hover:bg-rose-50 transition-colors"
                >
                  {t("history.resetMemory", "Reset Memory (Clear All)")}
                </button>
              </div>
            )}
          </>
        )}

        {/* TAB 2: Permanent Skips */}
        {activeTab === "permanent" && (
          <>
            {/* Informational Banner */}
            <div className="mx-5 sm:mx-6 mt-4 bg-[#ecece4] p-4 border border-[#d1d1ca] rounded-2xl flex items-start space-x-2.5 text-xs text-[#2c2c24]">
              <Ban className="w-4 h-4 text-[#5A5A40] shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                {t("history.skipsDesc", "Places you never want suggested again — anywhere, ever. Add to this list with the Ban button on any activity, or remove entries below to allow them back.")}
              </div>
            </div>

            {/* Permanent Skips List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-2.5 bg-[#f5f5f0]/40">
              {skips.length === 0 ? (
                <div className="text-center py-12">
                  <Ban className="w-8 h-8 text-[#d1d1ca] mx-auto mb-2 stroke-1" />
                  <p className="font-serif text-base italic text-[#2c2c24]">{t("history.noSkips", "No permanent exclusions")}</p>
                  <p className="text-xs text-[#8a8a7e] mt-0.5 max-w-xs mx-auto">
                    {t("history.noSkipsSub", "Use the Ban button on any activity card (\"never suggest again\") and it will be excluded from every future plan.")}
                  </p>
                </div>
              ) : (
                skips.map((skip) => (
                  <div
                    key={skip.id}
                    className="bg-white p-3.5 rounded-2xl border border-[#e5e5df] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-serif italic font-medium text-sm text-[#2c2c24] truncate">{skip.name}</div>
                      <div className="flex items-center space-x-2 text-[11px] text-[#8a8a7e] mt-0.5">
                        <span className="flex items-center gap-0.5">
                          <Ban className="w-3 h-3 text-rose-400" />
                          <span>{t("history.excluded", "Excluded forever")}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-3 h-3 text-[#8a8a7e]" />
                          {t("history.addedOn", "added {date}").replace("{date}", new Date(skip.addedAt).toLocaleDateString())}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveSkip(skip.id)}
                      title="Allow this place to be suggested again"
                      className="p-1.5 text-[#8a8a7e] hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {skips.length > 0 && (
              <div className="p-4 bg-[#f5f5f0] border-t border-[#e5e5df] flex justify-between items-center text-xs">
                <span className="text-[#8a8a7e] font-serif italic">
                  {t("history.skipsCount", "{count} places permanently excluded").replace("{count}", skips.length.toString())}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
