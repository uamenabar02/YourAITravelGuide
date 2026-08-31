import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  MapPin,
  Tag,
  Check,
  AlertCircle,
  DollarSign,
  Clock,
  Camera,
  Image as ImageIcon,
  Upload,
  Plus,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { ActivityCategory, ActivitySpot, CommunitySpotDoc } from "../types";
import { publishSpotToCommunity } from "../utils/communitySpotService";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { TranslatedText } from "./TranslatedText";

interface PublishSpotModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCity?: string;
  initialActivity?: ActivitySpot | null;
  onPublished?: (spot?: CommunitySpotDoc) => void;
  onShowToast?: (msg: string, type?: "success" | "info" | "error") => void;
}

const PHOTO_PRESETS: Array<{ label: string; url: string }> = [
  {
    label: "🍷 Pintxos & Wine Bar",
    url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
  },
  {
    label: "🌊 Coastal Ocean Vista",
    url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
  },
  {
    label: "🍵 Zen Garden & Teahouse",
    url: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80",
  },
  {
    label: "☕ Artisan Coffee Roastery",
    url: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80",
  },
  {
    label: "🏛️ Historic Architecture",
    url: "https://images.unsplash.com/photo-1513584684374-8bab748fbf90?auto=format&fit=crop&w=800&q=80",
  },
  {
    label: "🌅 Golden Hour Viewpoint",
    url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80",
  },
];

export const PublishSpotModal: React.FC<PublishSpotModalProps> = ({
  isOpen,
  onClose,
  defaultCity,
  initialActivity,
  onPublished,
  onShowToast,
}) => {
  const { t } = useLanguage();
  const { profile, user, activeEmail } = useAuth();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<ActivityCategory>("food");
  const [cityOrRegion, setCityOrRegion] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [description, setDescription] = useState("");
  const [insiderTip, setInsiderTip] = useState("");
  const [approxCost, setApproxCost] = useState("€10 - €20");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [tagsInput, setTagsInput] = useState("");
  
  // Photos state
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoUrlInput, setPhotoUrlInput] = useState("");
  const [showPhotoPresets, setShowPhotoPresets] = useState(false);

  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form values whenever opened or initialActivity changes
  useEffect(() => {
    if (!isOpen) return;

    if (initialActivity) {
      setName(initialActivity.name || "");
      setCategory(initialActivity.category || "hidden-gem");
      setCityOrRegion(defaultCity || initialActivity.address || "");
      setNeighborhood(initialActivity.address || "");
      setDescription(initialActivity.description || "");
      setInsiderTip(initialActivity.insiderTip || "");
      setApproxCost(initialActivity.approxCost || "Free");
      setDurationMinutes(initialActivity.durationMinutes || 60);
      setTagsInput((initialActivity.tags || []).join(", "));

      // Check for user-saved photos in localStorage or initialActivity.photos
      let loadedPhotos: string[] = [];
      try {
        const cachedPhotos = localStorage.getItem(`act_user_photos_${initialActivity.id}`);
        if (cachedPhotos) {
          loadedPhotos = JSON.parse(cachedPhotos);
        }
      } catch {}

      if (loadedPhotos.length === 0 && initialActivity.photos && initialActivity.photos.length > 0) {
        loadedPhotos = initialActivity.photos;
      }
      setPhotos(loadedPhotos);
    } else {
      setName("");
      setCategory("food");
      setCityOrRegion(defaultCity || "");
      setNeighborhood("");
      setDescription("");
      setInsiderTip("");
      setApproxCost("€10 - €20");
      setDurationMinutes(60);
      setTagsInput("");
      setPhotos([]);
    }
    setPhotoUrlInput("");
    setShowPhotoPresets(false);
    setError(null);
  }, [isOpen, initialActivity, defaultCity]);

  if (!isOpen) return null;

  const authorEmail = (activeEmail || user?.email || profile?.email || "uamenabar02@gmail.com").trim().toLowerCase();
  const authorName = profile?.name || user?.displayName || localStorage.getItem("localexplorer_user_name") || "Traveler";
  const authorAvatar = profile?.avatarPreset || "compass";

  // Photo handlers
  const handleAddPhotoUrl = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const url = photoUrlInput.trim();
    if (!url) return;
    if (!photos.includes(url)) {
      setPhotos([...photos, url]);
    }
    setPhotoUrlInput("");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result as string;
          if (result && !photos.includes(result)) {
            setPhotos((prev) => [...prev, result]);
          }
        };
        reader.readAsDataURL(file);
      }
    }
    // Reset file input
    e.target.value = "";
  };

  const handleRemovePhoto = (indexToRemove: number) => {
    setPhotos(photos.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSetPrimaryPhoto = (indexToMakePrimary: number) => {
    if (indexToMakePrimary === 0) return;
    const selected = photos[indexToMakePrimary];
    const rest = photos.filter((_, idx) => idx !== indexToMakePrimary);
    setPhotos([selected, ...rest]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter the name of the place or activity.");
      return;
    }
    if (!cityOrRegion.trim()) {
      setError("Please specify the city or region.");
      return;
    }

    setIsPublishing(true);
    setError(null);

    const parsedTags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    try {
      const res = await publishSpotToCommunity(
        {
          name: name.trim(),
          category,
          neighborhood: neighborhood.trim(),
          description: description.trim() || "An authentic spot shared by a local traveler.",
          insiderTip: insiderTip.trim(),
          approxCost: approxCost.trim(),
          durationMinutes: Number(durationMinutes) || 60,
          tags: parsedTags.length > 0 ? parsedTags : ["Community Spot", "Local Gem"],
          photos: photos.length > 0 ? photos : undefined,
          imageUrl: photos.length > 0 ? photos[0] : undefined,
        },
        cityOrRegion.trim(),
        authorEmail,
        authorName,
        authorAvatar
      );

      if (res.success) {
        // If this was from an existing itinerary activity, sync photos locally
        if (initialActivity && initialActivity.id) {
          try {
            localStorage.setItem(`act_user_photos_${initialActivity.id}`, JSON.stringify(photos));
          } catch {}
        }

        if (onShowToast) {
          onShowToast("Spot published to Community Explore with photos!", "success");
        }
        if (onPublished) onPublished(res.spot);
        onClose();
      } else {
        setError(res.message || "Failed to share spot.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div
      id="publish-spot-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        id="publish-spot-modal-content"
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white border-b border-[#e5e5df]/60 text-[#2c2c24] px-6 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#f5f5f0] border border-[#d1d1ca] rounded-xl">
              <Sparkles className="w-5 h-5 text-[#5A5A40]" />
            </div>
            <div>
              <h3 className="font-bold text-lg font-serif text-[#2c2c24]">
                <TranslatedText text={initialActivity ? "Publish Activity to Explore" : "Share a Community Spot"} />
              </h3>
              <p className="text-xs text-[#8a8a7e]">
                <TranslatedText text="Recommend an authentic place, tavern, or viewpoint to travelers worldwide" />
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
              <TranslatedText text="Spot Name" />
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent font-medium"
              placeholder="e.g., Bar Nestor Pintxo Bar"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                <TranslatedText text="Category" />
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ActivityCategory)}
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="food">🍴 Food & Dining</option>
                <option value="hidden-gem">💎 Hidden Gem</option>
                <option value="nature">🌿 Nature & Scenic</option>
                <option value="sightseeing">🏛️ Sightseeing</option>
                <option value="nightlife">🍸 Nightlife & Drinks</option>
                <option value="shopping">🛍️ Artisan & Markets</option>
                <option value="culture">🎨 Culture & Art</option>
                <option value="cafe">☕ Café & Roastery</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                <TranslatedText text="City / Region" />
              </label>
              <input
                type="text"
                value={cityOrRegion}
                onChange={(e) => setCityOrRegion(e.target.value)}
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                placeholder="e.g. San Sebastián, Spain"
                required
              />
            </div>
          </div>

          {/* User Photos & Pictures Section */}
          <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-emerald-700" />
                <TranslatedText text="User Pictures & Photography" />
                <span className="text-[11px] font-normal text-stone-500 font-sans">({photos.length})</span>
              </label>
              <button
                type="button"
                onClick={() => setShowPhotoPresets(!showPhotoPresets)}
                className="text-[11px] text-emerald-700 hover:text-emerald-900 font-semibold underline"
              >
                {showPhotoPresets ? "Hide Presets" : "✦ Curated Presets"}
              </button>
            </div>

            {/* Presets Row */}
            {showPhotoPresets && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2.5 bg-white border border-stone-200 rounded-xl">
                {PHOTO_PRESETS.map((preset, pIdx) => (
                  <button
                    key={pIdx}
                    type="button"
                    onClick={() => {
                      if (!photos.includes(preset.url)) {
                        setPhotos([...photos, preset.url]);
                      }
                    }}
                    className="flex items-center gap-2 p-1.5 rounded-lg border border-stone-200 hover:border-emerald-500 hover:bg-emerald-50/50 text-left transition-all group"
                  >
                    <img
                      src={preset.url}
                      alt={preset.label}
                      className="w-8 h-8 rounded-md object-cover shrink-0"
                    />
                    <span className="text-[11px] font-medium text-stone-700 group-hover:text-emerald-900 truncate">
                      {preset.label}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Photo URLs / File Upload Inputs */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="url"
                  value={photoUrlInput}
                  onChange={(e) => setPhotoUrlInput(e.target.value)}
                  placeholder="Paste photo URL (https://...)"
                  className="flex-1 px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddPhotoUrl();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleAddPhotoUrl()}
                  className="px-3 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-semibold rounded-xl transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 inline mr-1" />
                  Add
                </button>
              </div>

              {/* Upload from device */}
              <label className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-semibold rounded-xl cursor-pointer transition-colors shrink-0">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Device Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Photo Thumbnails Preview List */}
            {photos.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 pt-1">
                {photos.map((url, idx) => (
                  <div
                    key={idx}
                    className="relative group rounded-xl overflow-hidden border border-stone-300 bg-stone-200 aspect-video shadow-2xs"
                  >
                    <img
                      src={url}
                      alt={`Spot ${idx + 1}`}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    {idx === 0 && (
                      <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded backdrop-blur-xs">
                        Cover Photo
                      </span>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-1">
                      {idx !== 0 && (
                        <button
                          type="button"
                          onClick={() => handleSetPrimaryPhoto(idx)}
                          title="Set as Cover"
                          className="p-1 bg-white/90 hover:bg-white text-stone-900 rounded text-[10px] font-bold shadow-xs"
                        >
                          Cover
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        title="Remove Photo"
                        className="p-1 bg-red-600/90 hover:bg-red-600 text-white rounded shadow-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-stone-500 italic">
                No custom photos added yet. Add URLs or upload photos to make your spot stand out in Explore and Details & Guide!
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                <TranslatedText text="Neighborhood / District" />
              </label>
              <input
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                placeholder="e.g. Parte Vieja"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                <TranslatedText text="Approx Cost" />
              </label>
              <input
                type="text"
                value={approxCost}
                onChange={(e) => setApproxCost(e.target.value)}
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                placeholder="e.g. €15 - €25 or Free"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
              <TranslatedText text="Description" />
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              placeholder="What makes this place authentic or special?"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-amber-800 mb-1.5">
              💡 <TranslatedText text="Insider Tip for Travelers" />
            </label>
            <input
              type="text"
              value={insiderTip}
              onChange={(e) => setInsiderTip(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-amber-50/50 border border-amber-300 rounded-xl text-sm text-amber-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="e.g., Arrive 15 minutes before opening to order the legendary tortilla slice"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
              <TranslatedText text="Tags (comma separated)" />
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              placeholder="e.g. Pintxos, Historic, Must-Try"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors"
            >
              <TranslatedText text="Cancel" />
            </button>
            <button
              type="submit"
              disabled={isPublishing}
              className="px-5 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 active:scale-95 rounded-xl shadow-md shadow-emerald-800/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isPublishing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <TranslatedText text="Publishing..." />
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <TranslatedText text={initialActivity ? "Publish Activity" : "Share Spot"} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
