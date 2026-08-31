import React, { useEffect, useState } from "react";
import { X, Plus, Trash2, MapPin, Utensils, Coffee, Wine, Star, Loader2, AlertCircle, CheckCircle2, RefreshCw, ArrowLeft } from "lucide-react";
import { UserSpot } from "../types";
import { getMySpots, addMySpot, removeMySpot } from "../utils/storage";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";

interface MySpotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTown?: string;
  isInline?: boolean;
  onBack?: () => void;
}

const CATEGORY_META: Record<UserSpot["category"], { label: string; Icon: any }> = {
  bar: { label: "Bar", Icon: Wine },
  cafe: { label: "Café", Icon: Coffee },
  restaurant: { label: "Restaurant", Icon: Utensils },
  other: { label: "Other favorite", Icon: Star },
};

export const MySpotsModal: React.FC<MySpotsModalProps> = ({
  isOpen,
  onClose,
  defaultTown = "",
  isInline = false,
  onBack,
}) => {
  const { t } = useLanguage();
  const { activeEmail, syncStatus, lastSyncTime, syncUserDataWithCloud } = useAuth();
  const [spots, setSpots] = useState<UserSpot[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<UserSpot["category"]>("cafe");
  const [town, setTown] = useState(defaultTown);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "ok" | "warn" | "error"; message: string } | null>(null);
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    try {
      await syncUserDataWithCloud(true);
    } finally {
      setTimeout(() => setIsManualSyncing(false), 500);
    }
  };

  useEffect(() => {
    if (!isOpen && !isInline) return;

    setSpots(getMySpots());
    if (defaultTown) setTown(defaultTown);
    setShowAddForm(false);

    const handleSync = () => {
      queueMicrotask(() => {
        setSpots(getMySpots());
      });
    };

    window.addEventListener("localexplorer_cloud_sync_updated", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("localexplorer_cloud_sync_updated", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, [isOpen, defaultTown, isInline]);

  if (!isOpen && !isInline) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;

    setIsSaving(true);
    setStatus(null);

    // Dynamically geocode the place via the server (Nominatim) — no static DB
    let coordinates: { lat: number; lng: number } | undefined;
    let geocoded = false;
    try {
      const q = encodeURIComponent(cleanName);
      const ctx = encodeURIComponent(town.trim());
      const res = await fetch(`/api/geocode?q=${q}&context=${ctx}`);
      if (res.ok) {
        const data = await res.json();
        if (typeof data.lat === "number" && typeof data.lng === "number") {
          coordinates = { lat: data.lat, lng: data.lng };
          geocoded = true;
        }
      }
    } catch {
      // offline or geocoder unavailable — save without coordinates
    }

    addMySpot({
      name: cleanName,
      category,
      town: town.trim() || undefined,
      notes: notes.trim() || undefined,
      coordinates,
    });

    setSpots(getMySpots());
    setName("");
    setNotes("");
    setIsSaving(false);
    setShowAddForm(false);
    setStatus(
      geocoded
        ? { type: "ok", message: t("spots.addSuccess", "Added and located on the map.") }
        : {
            type: "warn",
            message: t(
              "spots.addWarn",
              "Added, but could not locate it right now. It will be geocoded again when it gets recommended."
            ),
          }
    );
  };

  const handleRemove = (id: string) => {
    if (window.confirm(t("spots.deleteConfirm", "Delete this place?"))) {
      removeMySpot(id);
      setSpots(getMySpots());
    }
  };

  const content = (
    <div className={`bg-white w-full ${isInline ? "" : "h-full md:h-auto md:max-w-lg md:rounded-3xl shadow-2xl border-0 md:border md:border-[#e5e5df] md:max-h-[88vh]"} overflow-hidden flex flex-col`}>
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-[#e5e5df] flex items-center justify-between shrink-0 bg-[#f5f5f0]/50">
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
          <div className="p-2.5 rounded-xl bg-[#ecece4] text-[#5A5A40]">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif text-xl sm:text-2xl font-light italic text-[#2c2c24]">{t("spots.title", "My Places")}</h3>
            <p className="text-xs text-[#8a8a7e] font-sans">
              {t("spots.subtitle", "Your own bars, cafés & restaurants — the only source for dining recommendations")}
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

      {/* Add Place Bar / Toggle */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between shrink-0 bg-white">
        <span className="text-xs font-serif italic text-[#8a8a7e]">
          {spots.length} saved place{spots.length !== 1 ? "s" : ""}
        </span>
        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#5A5A40] text-white rounded-xl text-xs font-serif italic hover:bg-[#4a4a35] transition-colors shadow-2xs cursor-pointer"
        >
          {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          <span>{showAddForm ? t("action.cancel", "Cancel") : t("spots.btnAdd", "+ Add Place")}</span>
        </button>
      </div>

      {/* Add form (hidden by default) */}
      {showAddForm && (
        <form onSubmit={handleAdd} className="mx-5 my-2 p-4 bg-[#f5f5f0] border border-[#d1d1ca] rounded-2xl space-y-3 shrink-0 animate-in fade-in-10">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-1.5">
                {t("spots.formName", "Place name *")}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("spots.placeholderName", "e.g. Bar Iruña, Kafé Bergara…")}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#d1d1ca] bg-white text-sm text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-1.5">
                {t("spots.formType", "Type")}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as UserSpot["category"])}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#d1d1ca] bg-white text-sm text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
              >
                <option value="cafe">{t("spots.category.cafe", "Café")}</option>
                <option value="bar">{t("spots.category.bar", "Bar")}</option>
                <option value="restaurant">{t("spots.category.restaurant", "Restaurant")}</option>
                <option value="other">{t("spots.category.other", "Other favorite")}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-1.5">
                {t("spots.formTown", "Town / Area")}
              </label>
              <input
                type="text"
                value={town}
                onChange={(e) => setTown(e.target.value)}
                placeholder={t("spots.placeholderTown", "e.g. Bilbao, Spain")}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#d1d1ca] bg-white text-sm text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-1.5">
                {t("spots.formNote", "Note (optional)")}
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("spots.placeholderNote", "e.g. best tortilla on Fridays")}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#d1d1ca] bg-white text-sm text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="text-[11px] leading-snug">
              {status && (
                <span
                  className={`flex items-center gap-1.5 font-medium ${
                    status.type === "ok"
                      ? "text-emerald-700"
                      : status.type === "warn"
                      ? "text-amber-700"
                      : "text-rose-700"
                  }`}
                >
                  {status.type === "ok" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  )}
                  {status.message}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-2 text-xs font-serif italic text-[#6b6b5e] hover:bg-[#ecece4] rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || !name.trim()}
                className="px-4 py-2 rounded-xl bg-[#5A5A40] text-white text-xs font-serif italic flex items-center space-x-1.5 hover:bg-[#4a4a35] transition-colors disabled:opacity-50 shrink-0"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{isSaving ? t("spots.btnSaving", "Locating…") : t("spots.btnAdd", "Save Place")}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto p-5 space-y-2.5 bg-[#f5f5f0]/40">
        {spots.length === 0 ? (
          <div className="text-center py-10">
            <Coffee className="w-8 h-8 text-[#d1d1ca] mx-auto mb-2 stroke-1" />
            <p className="font-serif text-base italic text-[#2c2c24]">{t("spots.empty", "No places saved yet")}</p>
            <p className="text-xs text-[#8a8a7e] mt-0.5 max-w-xs mx-auto">
              {t("spots.emptyDesc", "Add your favorite café, bar or restaurant above and plans will be built around them.")}
            </p>
          </div>
        ) : (
          spots.map((spot) => {
            const meta = CATEGORY_META[spot.category] || CATEGORY_META.other;
            const categoryLabel = t(`spots.category.${spot.category}`, meta.label);
            return (
              <div
                key={spot.id}
                className="bg-white p-3.5 rounded-2xl border border-[#e5e5df] flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-start space-x-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#ecece4] text-[#5A5A40] flex items-center justify-center shrink-0 border border-[#d1d1ca]">
                    <meta.Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-serif italic font-medium text-sm text-[#2c2c24] truncate">
                      {spot.name}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#8a8a7e] mt-0.5">
                      <span className="capitalize font-medium text-[#5A5A40] bg-[#ecece4] px-2 py-0.5 rounded-full border border-[#d1d1ca]">
                        {categoryLabel}
                      </span>
                      {spot.town && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-3 h-3 text-[#5A5A40]" />
                          {spot.town}
                        </span>
                      )}
                      {spot.coordinates ? (
                        <span className="text-emerald-700">{t("spots.located", "located")}</span>
                      ) : (
                        <span className="text-amber-700">{t("spots.pending", "pending location")}</span>
                      )}
                      {spot.notes && <span className="italic text-[#6b6b5e]">“{spot.notes}”</span>}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(spot.id)}
                  title={t("spots.deleteConfirm", "Delete this place?")}
                  className="p-1.5 text-[#8a8a7e] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-4 bg-[#f5f5f0] border-t border-[#e5e5df] flex justify-between items-center text-xs">
        <span className="text-[#8a8a7e] font-serif italic">
          {t("spots.footer", "{count} places saved — they power your dining recommendations").replace("{count}", spots.length.toString())}
        </span>
        <button
          onClick={isInline && onBack ? onBack : onClose}
          className="px-4 py-2 bg-[#5A5A40] hover:bg-[#4a4a35] text-white text-xs font-serif italic rounded-full transition-colors cursor-pointer"
        >
          {isInline && onBack ? "Back" : t("spots.done", "Done")}
        </button>
      </div>

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

  if (isInline) {
    return (
      <div className="w-full no-print animate-fade-in">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 top-0 bottom-[58px] md:inset-0 z-40 md:z-50 bg-[#2c2c24]/40 md:backdrop-blur-xs flex items-center justify-center p-0 md:p-4 no-print animate-fade-in">
      {content}
    </div>
  );
};
