import React, { useState, useEffect, useMemo } from "react";
import {
  getActivityHistory,
  removeHistoryItem,
  clearActivityHistory,
  getPermanentSkips,
  removePermanentSkip,
  moveHistoryItemToPermanentSkips,
  movePermanentSkipToHistory,
} from "../utils/storage";
import { ActivityHistoryItem, PermanentSkip } from "../types";
import {
  X,
  History,
  Trash2,
  MapPin,
  Clock,
  Ban,
  RefreshCw,
  ArrowLeft,
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  ArrowRightLeft,
  RotateCcw,
} from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";

interface ActivityHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onHistoryUpdated: () => void;
  isInline?: boolean;
  onBack?: () => void;
}

export const ActivityHistoryModal: React.FC<ActivityHistoryModalProps> = ({
  isOpen,
  onClose,
  onHistoryUpdated,
  isInline = false,
  onBack,
}) => {
  const { t } = useLanguage();
  const { activeEmail, syncStatus, lastSyncTime, syncUserDataWithCloud } = useAuth();
  const [items, setItems] = useState<ActivityHistoryItem[]>([]);
  const [skips, setSkips] = useState<PermanentSkip[]>([]);
  const [activeTab, setActiveTab] = useState<"recent" | "permanent">("recent");
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  // Search Engine & Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTimeframe, setSelectedTimeframe] = useState<"all" | "24h" | "7d" | "30d">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "az" | "location">("newest");

  const refreshLocalState = () => {
    setItems(getActivityHistory());
    setSkips(getPermanentSkips());
  };

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    try {
      await syncUserDataWithCloud(true);
      refreshLocalState();
    } finally {
      setTimeout(() => setIsManualSyncing(false), 500);
    }
  };

  useEffect(() => {
    if (!isOpen && !isInline) return;

    refreshLocalState();

    const handleSync = () => {
      queueMicrotask(() => {
        refreshLocalState();
      });
    };

    window.addEventListener("localexplorer_cloud_sync_updated", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("localexplorer_cloud_sync_updated", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, [isOpen, isInline]);

  const handleRemove = (id: string) => {
    removeHistoryItem(id);
    refreshLocalState();
    onHistoryUpdated();
  };

  const handleRemoveSkip = (id: string) => {
    removePermanentSkip(id);
    refreshLocalState();
  };

  const handleMoveToSkips = (item: ActivityHistoryItem) => {
    moveHistoryItemToPermanentSkips(item);
    refreshLocalState();
    onHistoryUpdated();
  };

  const handleMoveToMemory = (skip: PermanentSkip) => {
    movePermanentSkipToHistory(skip, "Local Area");
    refreshLocalState();
    onHistoryUpdated();
  };

  const handleClearAll = () => {
    if (window.confirm(t("history.clearConfirm", "Clear all 30-day activity history? The app will reset the anti-repeat memory filter."))) {
      clearActivityHistory();
      setItems([]);
      onHistoryUpdated();
    }
  };

  const hasActiveAdvancedFilters = selectedCategory !== "all" || selectedTimeframe !== "all" || sortBy !== "newest";

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedTimeframe("all");
    setSortBy("newest");
  };

  // Filtered & Sorted Memory Items
  const filteredItems = useMemo(() => {
    let result = [...items];
    const q = searchQuery.trim().toLowerCase();

    if (q) {
      result = result.filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          it.location.toLowerCase().includes(q) ||
          it.category.toLowerCase().includes(q)
      );
    }

    if (selectedCategory !== "all") {
      result = result.filter((it) => it.category.toLowerCase() === selectedCategory.toLowerCase());
    }

    const now = Date.now();
    if (selectedTimeframe === "24h") {
      result = result.filter((it) => now - it.timestamp <= 24 * 60 * 60 * 1000);
    } else if (selectedTimeframe === "7d") {
      result = result.filter((it) => now - it.timestamp <= 7 * 24 * 60 * 60 * 1000);
    } else if (selectedTimeframe === "30d") {
      result = result.filter((it) => now - it.timestamp <= 30 * 24 * 60 * 60 * 1000);
    }

    result.sort((a, b) => {
      if (sortBy === "newest") return b.timestamp - a.timestamp;
      if (sortBy === "oldest") return a.timestamp - b.timestamp;
      if (sortBy === "az") return a.name.localeCompare(b.name);
      if (sortBy === "location") return a.location.localeCompare(b.location);
      return 0;
    });

    return result;
  }, [items, searchQuery, selectedCategory, selectedTimeframe, sortBy]);

  // Filtered & Sorted Permanent Skips
  const filteredSkips = useMemo(() => {
    let result = [...skips];
    const q = searchQuery.trim().toLowerCase();

    if (q) {
      result = result.filter((sk) => sk.name.toLowerCase().includes(q));
    }

    const now = Date.now();
    if (selectedTimeframe === "24h") {
      result = result.filter((sk) => now - sk.addedAt <= 24 * 60 * 60 * 1000);
    } else if (selectedTimeframe === "7d") {
      result = result.filter((sk) => now - sk.addedAt <= 7 * 24 * 60 * 60 * 1000);
    } else if (selectedTimeframe === "30d") {
      result = result.filter((sk) => now - sk.addedAt <= 30 * 24 * 60 * 60 * 1000);
    }

    result.sort((a, b) => {
      if (sortBy === "newest") return b.addedAt - a.addedAt;
      if (sortBy === "oldest") return a.addedAt - b.addedAt;
      if (sortBy === "az") return a.name.localeCompare(b.name);
      return 0;
    });

    return result;
  }, [skips, searchQuery, selectedTimeframe, sortBy]);

  const content = (
    <div className={`bg-white ${isInline ? "w-full" : "rounded-3xl max-w-lg w-full shadow-2xl border border-[#e5e5df] max-h-[88vh]"} overflow-hidden flex flex-col`}>
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-[#e5e5df] flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {isInline && onBack && (
            <button
              onClick={onBack}
              className="p-2 -ml-2 rounded-full text-[#8a8a7e] hover:text-[#2c2c24] hover:bg-[#ecece4] transition-colors shrink-0 mr-1 cursor-pointer"
              title="Back to User Profile"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
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
        {!isInline && (
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[#8a8a7e] hover:text-[#2c2c24] hover:bg-[#ecece4] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Tab Switcher */}
      <div className="px-5 sm:px-6 pt-4 pb-2">
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

      {/* Search Engine & Expandable Advanced Options */}
      <div className="px-5 sm:px-6 py-2.5 border-b border-[#e5e5df] bg-[#fafaf8] space-y-2">
        {/* Basic Search Input */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8a8a7e] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("history.searchPlaceholder", "Search spots by name, neighborhood, or category...")}
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40] transition-shadow placeholder:text-[#8a8a7e]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-[#8a8a7e] hover:text-[#2c2c24] rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`px-3 py-2 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-colors shrink-0 ${
              showAdvanced || hasActiveAdvancedFilters
                ? "bg-[#5A5A40] text-white border-[#5A5A40]"
                : "bg-white text-[#2c2c24] border-[#d1d1ca] hover:bg-[#ecece4]"
            }`}
            title="Toggle Advanced Filter Controls"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t("history.advancedFilters", "Filters")}</span>
            {hasActiveAdvancedFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />
            )}
            {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Expandable Advanced Options */}
        {showAdvanced && (
          <div className="p-3 bg-white rounded-2xl border border-[#e5e5df] shadow-2xs space-y-3 animate-in fade-in-50 duration-150">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              {/* Category Filter (Active Tab: Memory only) */}
              {activeTab === "recent" && (
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-[#8a8a7e] mb-1">
                    {t("history.filterCategory", "Category")}
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[#d1d1ca] bg-[#f5f5f0] text-xs text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                  >
                    <option value="all">{t("history.filterAllCategories", "All Categories")}</option>
                    <option value="food">Food & Tapas</option>
                    <option value="culture">Culture & Arts</option>
                    <option value="nature">Nature & Outdoors</option>
                    <option value="sightseeing">Sightseeing</option>
                    <option value="hidden-gem">Hidden Gems</option>
                    <option value="shopping">Shopping</option>
                    <option value="nightlife">Nightlife</option>
                  </select>
                </div>
              )}

              {/* Timeframe Filter */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-[#8a8a7e] mb-1">
                  {t("history.filterTime", "Timeframe")}
                </label>
                <select
                  value={selectedTimeframe}
                  onChange={(e) => setSelectedTimeframe(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#d1d1ca] bg-[#f5f5f0] text-xs text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                >
                  <option value="all">{t("history.filterAllTime", "All Time")}</option>
                  <option value="24h">{t("history.filter24h", "Past 24 Hours")}</option>
                  <option value="7d">{t("history.filter7d", "Past 7 Days")}</option>
                  <option value="30d">{t("history.filter30d", "Past 30 Days")}</option>
                </select>
              </div>

              {/* Sort Order */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-[#8a8a7e] mb-1">
                  {t("history.sortBy", "Sort By")}
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#d1d1ca] bg-[#f5f5f0] text-xs text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                >
                  <option value="newest">{t("history.sortNewest", "Newest First")}</option>
                  <option value="oldest">{t("history.sortOldest", "Oldest First")}</option>
                  <option value="az">{t("history.sortAZ", "Name (A-Z)")}</option>
                  {activeTab === "recent" && (
                    <option value="location">{t("history.sortLocation", "Location (A-Z)")}</option>
                  )}
                </select>
              </div>
            </div>

            {hasActiveAdvancedFilters && (
              <div className="flex justify-end pt-1 border-t border-[#e5e5df]">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-[11px] text-[#5A5A40] hover:text-[#2c2c24] flex items-center gap-1 font-medium hover:underline"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{t("history.clearFilters", "Reset Filters")}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* TAB 1: 30-Day Memory */}
      {activeTab === "recent" && (
        <>
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
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-2xl border border-[#e5e5df] p-6">
                <Search className="w-7 h-7 text-[#d1d1ca] mx-auto mb-2" />
                <p className="font-serif text-sm italic text-[#2c2c24]">{t("history.noSearchResults", "No spots match your search criteria")}</p>
                <button
                  onClick={handleResetFilters}
                  className="mt-3 text-xs text-[#5A5A40] font-semibold underline hover:text-[#2c2c24]"
                >
                  {t("history.clearFilters", "Clear Filters")}
                </button>
              </div>
            ) : (
              filteredItems.map((item) => {
                const daysAgo = Math.floor((Date.now() - item.timestamp) / (24 * 60 * 60 * 1000));
                return (
                  <div
                    key={item.id}
                    className="bg-white p-3.5 rounded-2xl border border-[#e5e5df] flex items-center justify-between gap-3 text-xs shadow-2xs hover:border-[#d1d1ca] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-serif italic font-medium text-sm text-[#2c2c24] truncate">{item.name}</div>
                      <div className="flex items-center space-x-2 text-[11px] text-[#8a8a7e] mt-0.5">
                        <span className="capitalize font-medium text-[#5A5A40] bg-[#ecece4] px-2 py-0.5 rounded-full border border-[#d1d1ca]">
                          {item.category}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5 truncate">
                          <MapPin className="w-3 h-3 text-[#5A5A40] shrink-0" />
                          <span className="truncate">{item.location}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5 shrink-0">
                          <Clock className="w-3 h-3 text-[#8a8a7e]" />
                          {daysAgo === 0 ? t("history.today", "Today") : t("history.daysAgo", "{days}d ago").replace("{days}", daysAgo.toString())}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Button to Move to Permanent Skips */}
                      <button
                        type="button"
                        onClick={() => handleMoveToSkips(item)}
                        title={t("history.moveToSkips", "Move to Permanent Skips (never suggest again)")}
                        className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Ban className="w-3 h-3" />
                        <span className="hidden sm:inline">{t("history.tabSkips", "To Skips").replace(" ({count})", "")}</span>
                      </button>

                      {/* Delete from memory */}
                      <button
                        onClick={() => handleRemove(item.id)}
                        title="Allow this spot to be recommended again"
                        className="p-1.5 text-[#8a8a7e] hover:text-rose-600 hover:bg-[#ecece4] rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="p-4 bg-[#f5f5f0] border-t border-[#e5e5df] flex justify-between items-center text-xs">
              <span className="text-[#8a8a7e] font-serif italic">
                {filteredItems.length !== items.length
                  ? `Showing ${filteredItems.length} of ${items.length} spots`
                  : t("history.spotsTracked", "{count} spots tracked").replace("{count}", items.length.toString())}
              </span>
              <button
                onClick={handleClearAll}
                className="text-rose-700 hover:text-rose-900 font-medium px-3 py-1 rounded-full hover:bg-rose-50 transition-colors cursor-pointer"
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
            ) : filteredSkips.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-2xl border border-[#e5e5df] p-6">
                <Search className="w-7 h-7 text-[#d1d1ca] mx-auto mb-2" />
                <p className="font-serif text-sm italic text-[#2c2c24]">{t("history.noSearchResults", "No spots match your search criteria")}</p>
                <button
                  onClick={handleResetFilters}
                  className="mt-3 text-xs text-[#5A5A40] font-semibold underline hover:text-[#2c2c24]"
                >
                  {t("history.clearFilters", "Clear Filters")}
                </button>
              </div>
            ) : (
              filteredSkips.map((skip) => (
                <div
                  key={skip.id}
                  className="bg-white p-3.5 rounded-2xl border border-[#e5e5df] flex items-center justify-between gap-3 text-xs shadow-2xs hover:border-[#d1d1ca] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-serif italic font-medium text-sm text-[#2c2c24] truncate">{skip.name}</div>
                    <div className="flex items-center space-x-2 text-[11px] text-[#8a8a7e] mt-0.5">
                      <span className="flex items-center gap-0.5 text-rose-600 font-medium">
                        <Ban className="w-3 h-3 text-rose-500" />
                        <span>{t("history.excluded", "Excluded forever")}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-3 h-3 text-[#8a8a7e]" />
                        {t("history.addedOn", "added {date}").replace("{date}", new Date(skip.addedAt).toLocaleDateString())}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Button to Move to 30-Day Memory */}
                    <button
                      type="button"
                      onClick={() => handleMoveToMemory(skip)}
                      title={t("history.moveToMemory", "Move to 30-Day Memory (allow after 30 days)")}
                      className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Clock className="w-3 h-3 text-emerald-600" />
                      <span className="hidden sm:inline">{t("history.tabMemory", "To Memory").replace(" ({count})", "")}</span>
                    </button>

                    {/* Delete permanently */}
                    <button
                      onClick={() => handleRemoveSkip(skip.id)}
                      title="Allow this place to be suggested again"
                      className="p-1.5 text-[#8a8a7e] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {skips.length > 0 && (
            <div className="p-4 bg-[#f5f5f0] border-t border-[#e5e5df] flex justify-between items-center text-xs">
              <span className="text-[#8a8a7e] font-serif italic">
                {filteredSkips.length !== skips.length
                  ? `Showing ${filteredSkips.length} of ${skips.length} exclusions`
                  : t("history.skipsCount", "{count} places permanently excluded").replace("{count}", skips.length.toString())}
              </span>
            </div>
          )}
        </>
      )}

      {/* Inline Back button footer helper */}
      {isInline && onBack && (
        <div className="p-4 bg-white border-t border-[#e5e5df] flex justify-end">
          <button
            onClick={onBack}
            className="px-5 py-2 bg-[#5A5A40] hover:bg-[#4a4a35] text-white text-xs font-serif italic rounded-full transition-colors cursor-pointer"
          >
            Back to Profile
          </button>
        </div>
      )}

      {/* Footer Cloud Sync Bar */}
      <div className="px-4 py-2.5 bg-white border-t border-[#e5e5df] flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${syncStatus === "synced" ? "bg-emerald-500" : syncStatus === "syncing" ? "bg-amber-500 animate-ping" : "bg-[#8a8a7e]"}`} />
          <div className="truncate">
            <p className="text-[11px] font-medium text-[#2c2c24] truncate">
              {activeEmail}
            </p>
            <p className="text-[10px] text-[#8a8a7e]">
              Cloud Sync: {lastSyncTime}
            </p>
          </div>
        </div>

        <button
          onClick={handleManualSync}
          disabled={isManualSyncing || syncStatus === "syncing"}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full border border-[#d1d1ca] hover:bg-[#ecece4] text-[#2c2c24] font-medium text-xs transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isManualSyncing || syncStatus === "syncing" ? "animate-spin text-[#5A5A40]" : "text-[#8a8a7e]"}`} />
          <span>{isManualSyncing ? "Syncing..." : "Sync"}</span>
        </button>
      </div>
    </div>
  );

  if (!isOpen && !isInline) return null;

  if (isInline) {
    return (
      <div className="w-full no-print animate-fade-in">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#2c2c24]/40 backdrop-blur-xs flex items-center justify-center p-4 no-print animate-fade-in">
      {content}
    </div>
  );
};
