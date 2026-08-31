import React, { useState } from "react";
import { X, Compass, Globe, Sparkles, Tag, Check, AlertCircle } from "lucide-react";
import { ItineraryPlan } from "../types";
import { publishItineraryToExplore } from "../utils/sharedTripService";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { TranslatedText } from "./TranslatedText";

const PUBLISH_VIBE_PRESETS = [
  { id: "Gastronomy & Local Food", label: "Gastronomy & Local Food", icon: "🍜" },
  { id: "History & Architecture", label: "History & Architecture", icon: "🏛️" },
  { id: "Hidden Gems / Non-Touristy", label: "Hidden Gems / Non-Touristy", icon: "💎" },
  { id: "Scenic & Outdoors", label: "Scenic & Outdoors", icon: "🌲" },
  { id: "Beaches & Swim Spots", label: "Beaches & Swim Spots", icon: "🏖️" },
  { id: "Art & Culture", label: "Art & Culture", icon: "🎨" },
  { id: "Regional Excursions & Viewpoints", label: "Regional Excursions & Viewpoints", icon: "🚗" },
  { id: "Shopping & Local Boutiques", label: "Shopping & Local Boutiques", icon: "🛍️" },
  { id: "Family Friendly", label: "Family Friendly", icon: "👨‍👩‍👧" },
  { id: "Budget Friendly", label: "Budget Friendly", icon: "🏷️" },
  { id: "Nightlife & Bars", label: "Nightlife & Bars", icon: "🍸" },
  { id: "Relaxation & Wellness", label: "Relaxation & Wellness", icon: "🌿" },
];

interface PublishTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: ItineraryPlan | null;
  onPublished?: () => void;
  onShowToast?: (msg: string, type?: "success" | "info" | "error") => void;
}

export const PublishTripModal: React.FC<PublishTripModalProps> = ({
  isOpen,
  onClose,
  trip,
  onPublished,
  onShowToast,
}) => {
  const { t } = useLanguage();
  const { profile, user, activeEmail } = useAuth();

  const [title, setTitle] = useState(trip?.title || "");
  const [description, setDescription] = useState(trip?.summary || "");
  const [tagsInput, setTagsInput] = useState((trip?.tags || []).join(", "));
  const [selectedVibes, setSelectedVibes] = useState<string[]>(
    trip?.vibes || trip?.selectedVibes || []
  );
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state when trip prop changes
  React.useEffect(() => {
    if (trip) {
      setTitle(trip.title);
      setDescription(trip.summary);
      setTagsInput((trip.tags || []).join(", "));
      setSelectedVibes(trip.vibes || trip.selectedVibes || []);
    }
  }, [trip]);

  if (!isOpen || !trip) return null;

  const authorEmail = (activeEmail || user?.email || profile?.email || "uamenabar02@gmail.com").trim().toLowerCase();
  const authorName = profile?.name || user?.displayName || localStorage.getItem("localexplorer_user_name") || "Traveler";

  const toggleVibe = (vibeId: string) => {
    setSelectedVibes((prev) =>
      prev.includes(vibeId) ? prev.filter((v) => v !== vibeId) : [...prev, vibeId]
    );
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please enter an itinerary title.");
      return;
    }

    setIsPublishing(true);
    setError(null);

    const parsedTags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    try {
      const res = await publishItineraryToExplore(trip, authorEmail, authorName, {
        customTitle: title.trim(),
        description: description.trim(),
        featuredTags: parsedTags.length > 0 ? parsedTags : ["Community Pick", "Local Explorer"],
        vibes: selectedVibes.length > 0 ? selectedVibes : (trip.vibes || trip.tags || []),
      });

      if (res.success) {
        if (onShowToast) {
          onShowToast("Itinerary published to Community Explore feed!", "success");
        }
        if (onPublished) onPublished();
        onClose();
      } else {
        setError(res.message || "Failed to publish itinerary.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div
      id="publish-trip-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        id="publish-trip-modal-content"
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white border-b border-[#e5e5df]/60 text-[#2c2c24] px-6 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#f5f5f0] border border-[#d1d1ca] rounded-xl">
              <Globe className="w-5 h-5 text-[#5A5A40]" />
            </div>
            <div>
              <h3 className="font-bold text-lg font-serif text-[#2c2c24]">
                <TranslatedText text="Publish Itinerary to Explore" />
              </h3>
              <p className="text-xs text-[#8a8a7e]">
                <TranslatedText text="Share your curated route with the global explorer community" />
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#5A5A40] hover:bg-[#f5f5f0] border border-[#d1d1ca] rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handlePublish} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
              <TranslatedText text="Itinerary Title" />
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent font-medium"
              placeholder="e.g., Hidden Pintxos & Coastal Cliffs of San Sebastián"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
              <TranslatedText text="Description & Highlights" />
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent leading-relaxed"
              placeholder="Share what makes this itinerary special, local food recommendations, best times to visit..."
            />
          </div>

          {/* Travel Interests & Vibes metadata pills */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5 flex items-center justify-between">
              <span>
                <TranslatedText text="Travel Interests & Vibes Metadata" />
              </span>
              <span className="text-[11px] text-emerald-700 font-semibold">
                {selectedVibes.length} <TranslatedText text="selected" />
              </span>
            </label>
            <p className="text-[11px] text-stone-500 mb-2">
              <TranslatedText text="These metadata tags enable travelers to find your itinerary via Advanced Filters." />
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PUBLISH_VIBE_PRESETS.map((vibe) => {
                const isSelected = selectedVibes.includes(vibe.id);
                return (
                  <button
                    key={vibe.id}
                    type="button"
                    onClick={() => toggleVibe(vibe.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-emerald-700 text-white shadow-xs"
                        : "bg-stone-100 hover:bg-stone-200 text-stone-700"
                    }`}
                  >
                    <span>{vibe.icon}</span>
                    <TranslatedText text={vibe.label} />
                    {isSelected && <Check className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5 flex items-center justify-between">
              <span>
                <TranslatedText text="Community Tags (comma separated)" />
              </span>
              <span className="text-[11px] text-stone-400 font-normal">Optional</span>
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
              placeholder="e.g. Gastronomy, Pintxos, Sunset Views, 3 Days"
            />
          </div>

          <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-xl text-xs text-emerald-900 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-950">
                <TranslatedText text="Published Itinerary Benefits" />
              </p>
              <p className="text-emerald-800 text-[11px] leading-relaxed mt-0.5">
                <TranslatedText text="Other travelers will be able to discover, review, rate, and import your route. You can manage or unpublish this itinerary anytime from your Profile." />
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors"
            >
              <TranslatedText text="Cancel" />
            </button>
            <button
              type="submit"
              disabled={isPublishing}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 active:scale-95 rounded-xl shadow-md shadow-emerald-800/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isPublishing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <TranslatedText text="Publishing..." />
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4" />
                  <TranslatedText text="Publish to Explore" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
