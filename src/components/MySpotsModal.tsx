import React, { useEffect, useState } from "react";
import { X, Plus, Trash2, MapPin, Utensils, Coffee, Wine, Star, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { UserSpot } from "../types";
import { getMySpots, addMySpot, removeMySpot } from "../utils/storage";

interface MySpotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTown?: string;
}

const CATEGORY_META: Record<UserSpot["category"], { label: string; Icon: any }> = {
  bar: { label: "Bar", Icon: Wine },
  cafe: { label: "Café", Icon: Coffee },
  restaurant: { label: "Restaurant", Icon: Utensils },
  other: { label: "Other favorite", Icon: Star },
};

export const MySpotsModal: React.FC<MySpotsModalProps> = ({ isOpen, onClose, defaultTown = "" }) => {
  const [spots, setSpots] = useState<UserSpot[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<UserSpot["category"]>("cafe");
  const [town, setTown] = useState(defaultTown);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "ok" | "warn" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSpots(getMySpots());
      if (defaultTown) setTown(defaultTown);
    }
  }, [isOpen, defaultTown]);

  if (!isOpen) return null;

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
    setStatus(
      geocoded
        ? { type: "ok", message: "Added and located on the map." }
        : {
            type: "warn",
            message:
              "Added, but could not locate it right now. It will be geocoded again when it gets recommended.",
          }
    );
  };

  const handleRemove = (id: string) => {
    removeMySpot(id);
    setSpots(getMySpots());
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#2c2c24]/40 backdrop-blur-xs flex items-center justify-center p-4 no-print animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-[#e5e5df] overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#e5e5df] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-[#ecece4] text-[#5A5A40]">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-2xl font-light italic text-[#2c2c24]">My Places</h3>
              <p className="text-xs text-[#8a8a7e] font-sans">
                Your own bars, cafés & restaurants — the only source for dining recommendations
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

        {/* Why this exists */}
        <div className="mx-5 sm:mx-6 mt-4 bg-[#ecece4] p-3.5 border border-[#d1d1ca] rounded-2xl text-xs text-[#2c2c24] leading-relaxed">
          LocalExplorer never invents bars, cafés or restaurants from a built-in list. Dining
          suggestions come from <strong>places you add here</strong> or from live AI search —
          everything is located dynamically on the map.
        </div>

        {/* Add form */}
        <form onSubmit={handleAdd} className="mx-5 sm:mx-6 mt-4 p-4 bg-[#f5f5f0] border border-[#e5e5df] rounded-2xl space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-1.5">
                Place name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bar Iruña, Kafé Bergara…"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#d1d1ca] bg-white text-sm text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-1.5">
                Type
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as UserSpot["category"])}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#d1d1ca] bg-white text-sm text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
              >
                <option value="cafe">Café</option>
                <option value="bar">Bar</option>
                <option value="restaurant">Restaurant</option>
                <option value="other">Other favorite</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-1.5">
                Town / Area
              </label>
              <input
                type="text"
                value={town}
                onChange={(e) => setTown(e.target.value)}
                placeholder="e.g. Bilbao, Spain"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#d1d1ca] bg-white text-sm text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-1.5">
                Note (optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. best tortilla on Fridays"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#d1d1ca] bg-white text-sm text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
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
            <button
              type="submit"
              disabled={isSaving || !name.trim()}
              className="px-4 py-2.5 rounded-xl bg-[#5A5A40] text-white text-xs font-serif italic flex items-center space-x-1.5 hover:bg-[#4a4a35] transition-colors disabled:opacity-50 shrink-0"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{isSaving ? "Locating…" : "Add Place"}</span>
            </button>
          </div>
        </form>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2.5 bg-[#f5f5f0]/40">
          {spots.length === 0 ? (
            <div className="text-center py-10">
              <Coffee className="w-8 h-8 text-[#d1d1ca] mx-auto mb-2 stroke-1" />
              <p className="font-serif text-base italic text-[#2c2c24]">No places saved yet</p>
              <p className="text-xs text-[#8a8a7e] mt-0.5 max-w-xs mx-auto">
                Add your favorite café, bar or restaurant above and plans will be built around them.
              </p>
            </div>
          ) : (
            spots.map((spot) => {
              const meta = CATEGORY_META[spot.category] || CATEGORY_META.other;
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
                          {meta.label}
                        </span>
                        {spot.town && (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="w-3 h-3 text-[#5A5A40]" />
                            {spot.town}
                          </span>
                        )}
                        {spot.coordinates ? (
                          <span className="text-emerald-700">located</span>
                        ) : (
                          <span className="text-amber-700">pending location</span>
                        )}
                        {spot.notes && <span className="italic text-[#6b6b5e]">“{spot.notes}”</span>}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(spot.id)}
                    title="Remove this place"
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
            {spots.length} places saved — they power your dining recommendations
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#5A5A40] hover:bg-[#4a4a35] text-white text-xs font-serif italic rounded-full transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
