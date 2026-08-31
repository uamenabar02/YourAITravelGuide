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
  ExternalLink,
  Laptop,
  Smartphone,
  Zap,
  Cloud,
  MessageSquare,
  Users,
  Camera,
  Star,
  Check,
  Plus,
  Share2,
  Volume2,
  LogOut,
  LogIn,
} from "lucide-react";
import { useLanguage, Language, PRIMARY_LANGUAGES, WORLD_LANGUAGES, ALL_LANGUAGES } from "../context/LanguageContext";
import {
  getSavedTrips,
  getMySpots,
  getActivityHistory,
  getPermanentSkips,
  removePermanentSkip,
  getTasteProfile,
  saveTasteProfile,
} from "../utils/storage";
import { TasteProfile, BudgetTier, PaceType, AppMode, SharedTripDoc, CommunitySpotDoc, ItineraryPlan } from "../types";
import { useAuth } from "../context/AuthContext";
import { TasteProfileModal } from "./TasteProfileModal";
import { MySpotsModal } from "./MySpotsModal";
import { ActivityHistoryModal } from "./ActivityHistoryModal";
import { PublishTripModal } from "./PublishTripModal";
import { CreatorProfileModal } from "./CreatorProfileModal";
import { getUserPublicTrips, getUserReviewsAcrossTrips } from "../utils/socialService";
import { fetchCommunitySpots } from "../utils/communitySpotService";
import { unpublishItineraryFromExplore } from "../utils/sharedTripService";
import { TranslatedText } from "./TranslatedText";
import { AIModelManagerSection } from "./AIModelManagerSection";
import { RegionalPreferencesSection } from "./RegionalPreferencesSection";

interface UserProfileModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onOpenTasteProfile: () => void;
  onOpenMySpots: () => void;
  onOpenSavedTrips: () => void;
  onOpenHistory: () => void;
  onDataChanged?: () => void;
  onSelectTrip?: (trip: ItineraryPlan) => void;
  activeMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  isInline?: boolean;
}

const AVATAR_PRESETS = [
  { id: "compass", emoji: "🧭", label: "Explorer" },
  { id: "foodie", emoji: "🍢", label: "Gastronomy" },
  { id: "mountain", emoji: "⛰️", label: "Mountain" },
  { id: "wave", emoji: "🌊", label: "Coastal" },
  { id: "coffee", emoji: "☕", label: "Café Lover" },
  { id: "camera", emoji: "📷", label: "Photographer" },
  { id: "sunset", emoji: "🌅", label: "Golden Hour" },
  { id: "map", emoji: "🗺️", label: "Cartographer" },
];

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
  isOpen = false,
  onClose = () => {},
  onOpenTasteProfile,
  onOpenMySpots,
  onOpenSavedTrips,
  onOpenHistory,
  onDataChanged,
  onSelectTrip,
  activeMode,
  onModeChange,
  isInline = false,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const {
    user,
    profile,
    activeEmail,
    autoSyncEnabled,
    syncStatus,
    lastSyncTime,
    sessionId,
    setAutoSyncEnabled,
    signUp,
    signIn,
    signInWithGoogle,
    switchUserAccount,
    logout,
    updateProfileName,
    updateExtendedProfile,
    toggleFollowUser,
    syncUserDataWithCloud,
    updateActivePersona,
  } = useAuth();

  // Sub-view router state inside user profile modal
  const [activeSubView, setActiveSubView] = useState<"profile" | "taste" | "spots" | "history">("profile");

  // Profile Main Tab: details | portfolio | reviews | taste | cloud
  const [profileTab, setProfileTab] = useState<"identity" | "portfolio" | "reviews" | "taste" | "cloud">("identity");

  // Form states for profile editing
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editHomeCity, setEditHomeCity] = useState("");
  const [editTravelStyle, setEditTravelStyle] = useState("");
  const [editSocial, setEditSocial] = useState("");
  const [editAvatarPreset, setEditAvatarPreset] = useState("compass");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [showCustomAvatarInput, setShowCustomAvatarInput] = useState(false);

  // Social & Portfolio data
  const [myPublicTrips, setMyPublicTrips] = useState<SharedTripDoc[]>([]);
  const [myPublicSpots, setMyPublicSpots] = useState<CommunitySpotDoc[]>([]);
  const [myReviews, setMyReviews] = useState<
    Array<{ tripId: string; tripTitle: string; destination: string; rating: number; text: string; createdAt: number }>
  >([]);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);

  // Modals inside Profile
  const [tripToPublish, setTripToPublish] = useState<ItineraryPlan | null>(null);
  const [inspectCreatorEmail, setInspectCreatorEmail] = useState<string | null>(null);
  const [showFollowingList, setShowFollowingList] = useState(false);

  // Authentication UI state
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  // User details derived from real session
  const userName = profile?.name || user?.displayName || localStorage.getItem("localexplorer_user_name") || "Traveler";
  const userEmail = activeEmail || profile?.email || user?.email || "uamenabar02@gmail.com";
  const isLoggedIn = Boolean(user || (activeEmail && !activeEmail.startsWith("guest_")));
  const activePersona = profile?.activePersona || localStorage.getItem("localexplorer_active_persona") || null;

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Active counts
  const [savedTripsCount, setSavedTripsCount] = useState(0);
  const [mySpotsCount, setMySpotsCount] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);
  const [permanentSkips, setPermanentSkips] = useState<{ id: string; name: string; addedAt: number }[]>([]);

  // Voice Preference State
  const [voicePreference, setVoicePreference] = useState<string>(() => {
    return localStorage.getItem("localexplorer_voice_preference") || "natural";
  });

  const handleVoicePrefChange = (pref: string) => {
    setVoicePreference(pref);
    localStorage.setItem("localexplorer_voice_preference", pref);
  };

  // Advanced Voice Personas & Speed State
  const [voicePersona, setVoicePersona] = useState<string>(() => {
    return localStorage.getItem("localexplorer_voice_persona") || "aria";
  });
  const [voiceSpeed, setVoiceSpeed] = useState<string>(() => {
    return localStorage.getItem("localexplorer_voice_speed") || "0.95";
  });
  const [isPreviewingVoice, setIsPreviewingVoice] = useState<boolean>(false);

  const handlePersonaChange = (personaId: string) => {
    setVoicePersona(personaId);
    localStorage.setItem("localexplorer_voice_persona", personaId);
  };

  const handleSpeedChange = (speedVal: string) => {
    setVoiceSpeed(speedVal);
    localStorage.setItem("localexplorer_voice_speed", speedVal);
  };

  const handlePreviewVoice = () => {
    if (!("speechSynthesis" in window)) {
      alert("Text-to-speech is not supported in your browser.");
      return;
    }

    window.speechSynthesis.cancel();
    const sampleText = "Hello! I am your AI local guide companion. I am ready to help you explore amazing spots and craft unforgettable journeys.";
    const utterance = new SpeechSynthesisUtterance(sampleText);
    utterance.rate = parseFloat(voiceSpeed) || 0.95;

    if (voicePersona === "orion") utterance.pitch = 0.85;
    else if (voicePersona === "atlas") utterance.pitch = 0.80;
    else if (voicePersona === "nova") utterance.pitch = 1.15;
    else if (voicePersona === "zephyr") utterance.pitch = 0.95;
    else if (voicePersona === "sol") utterance.pitch = 1.05;
    else utterance.pitch = 1.08;

    try {
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const isFemale = ["aria", "nova", "sol"].includes(voicePersona);
        const isMale = ["orion", "zephyr", "atlas"].includes(voicePersona);

        let matched = null;
        if (isFemale) {
          matched = voices.find((v) => /female|woman|zira|victoria|samantha|karen|aria|nova|google.*female/i.test(v.name));
        } else if (isMale) {
          matched = voices.find((v) => /male|man|david|george|daniel|mark|orion|atlas|google.*male/i.test(v.name));
        }
        if (matched || voices[0]) {
          utterance.voice = matched || voices[0];
        }
      }
    } catch {}

    utterance.onend = () => setIsPreviewingVoice(false);
    utterance.onerror = () => setIsPreviewingVoice(false);

    window.speechSynthesis.speak(utterance);
    setIsPreviewingVoice(true);
  };

  // Initialize form fields from profile
  useEffect(() => {
    setEditName(profile?.name || localStorage.getItem("localexplorer_user_name") || "Traveler");
    setEditBio(profile?.bio || localStorage.getItem("localexplorer_user_bio") || "");
    setEditHomeCity(profile?.homeCity || localStorage.getItem("localexplorer_user_home_city") || "");
    setEditTravelStyle(profile?.travelStyle || localStorage.getItem("localexplorer_user_travel_style") || "Culinary & Cultural Explorer");
    setEditSocial(profile?.websiteOrSocial || localStorage.getItem("localexplorer_user_social") || "");
    setEditAvatarPreset(profile?.avatarPreset || localStorage.getItem("localexplorer_user_avatar_preset") || "compass");
    setEditAvatarUrl(profile?.avatarUrl || localStorage.getItem("localexplorer_user_avatar_url") || "");
  }, [profile, isOpen]);

  // Load portfolio and reviews
  const loadUserCommunityData = async () => {
    if (!userEmail) return;
    setLoadingPortfolio(true);
    try {
      const [trips, allSpots, reviews] = await Promise.all([
        getUserPublicTrips(userEmail),
        fetchCommunitySpots(),
        getUserReviewsAcrossTrips(userEmail),
      ]);
      setMyPublicTrips(trips);
      setMyPublicSpots(allSpots.filter((s) => s.creatorEmail?.toLowerCase() === userEmail.toLowerCase()));
      setMyReviews(reviews);
    } catch (e) {
      console.error("Error loading user community portfolio:", e);
    } finally {
      setLoadingPortfolio(false);
    }
  };

  useEffect(() => {
    if (isOpen || isInline) {
      loadUserCommunityData();
    }
  }, [isOpen, isInline, userEmail, profileTab]);

  // Refresh counts on open or on cloud sync update
  useEffect(() => {
    if (!isOpen && !isInline) return;

    const refreshCounts = () => {
      queueMicrotask(() => {
        setSavedTripsCount(getSavedTrips().length);
        setMySpotsCount(getMySpots().length);
        setHistoryCount(getActivityHistory().length);
        setPermanentSkips(getPermanentSkips());
      });
    };

    refreshCounts();
    window.addEventListener("localexplorer_cloud_sync_updated", refreshCounts);
    return () => {
      window.removeEventListener("localexplorer_cloud_sync_updated", refreshCounts);
    };
  }, [isOpen, isInline]);

  if (!isInline && !isOpen) return null;

  // Save profile modifications
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateExtendedProfile({
        name: editName.trim() || "Traveler",
        bio: editBio.trim(),
        homeCity: editHomeCity.trim(),
        travelStyle: editTravelStyle.trim(),
        websiteOrSocial: editSocial.trim(),
        avatarPreset: editAvatarPreset,
        avatarUrl: editAvatarUrl.trim(),
      });
      setSyncFeedback("Profile updated and synced to cloud!");
      setTimeout(() => setSyncFeedback(null), 3000);
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      setSyncFeedback("Failed to save profile.");
    }
  };

  // Unpublish trip handler
  const handleUnpublishTrip = async (tripId: string) => {
    if (!window.confirm("Remove this itinerary from the Community Explore Feed?")) return;
    try {
      const res = await unpublishItineraryFromExplore(tripId, userEmail);
      if (res.success) {
        setMyPublicTrips((prev) => prev.filter((t) => t.id !== tripId));
        setSyncFeedback("Itinerary unpublished from Explore.");
        setTimeout(() => setSyncFeedback(null), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleApplyPersona = async (preset: (typeof PERSONA_PRESETS)[0]) => {
    saveTasteProfile(preset.profile);
    await updateActivePersona(preset.id);
    setSyncFeedback(`Applied "${preset.name}" persona to your Taste Profile!`);
    if (onDataChanged) onDataChanged();
    setTimeout(() => setSyncFeedback(null), 3500);
  };

  const handleCloudSync = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      await syncUserDataWithCloud();
      setSyncFeedback("All journeys, places, taste preferences & history are synchronized in real-time with Firestore!");
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      setSyncFeedback(`Cloud sync error: ${err.message || err}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncFeedback(null), 4000);
    }
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
          localStorage.setItem("localexplorer_saved_trips_v1", JSON.stringify(data.savedTrips));
        }
        if (data.mySpots && Array.isArray(data.mySpots)) {
          localStorage.setItem("localexplorer_my_spots_v1", JSON.stringify(data.mySpots));
        }
        if (data.activityHistory && Array.isArray(data.activityHistory)) {
          localStorage.setItem("localexplorer_activity_history_v1", JSON.stringify(data.activityHistory));
        }
        if (data.permanentSkips && Array.isArray(data.permanentSkips)) {
          localStorage.setItem("localexplorer_permanent_skips_v1", JSON.stringify(data.permanentSkips));
        }
        if (data.tasteProfile) {
          saveTasteProfile(data.tasteProfile);
        }

        setSavedTripsCount(getSavedTrips().length);
        setMySpotsCount(getMySpots().length);
        setHistoryCount(getActivityHistory().length);
        setPermanentSkips(getPermanentSkips());

        setSyncFeedback("All data successfully restored and synced!");
        syncUserDataWithCloud();
        if (onDataChanged) onDataChanged();
        setTimeout(() => setSyncFeedback(null), 4000);
      } catch (err) {
        alert("Invalid backup JSON file format.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Following list
  const followingList: string[] = profile?.following || [];
  const followersList: string[] = profile?.followers || [];

  // Authentication Actions
  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setAuthSuccess(null);
    try {
      await signInWithGoogle();
      setAuthSuccess("Signed in with Google successfully!");
      if (onDataChanged) onDataChanged();
      setTimeout(() => setAuthSuccess(null), 4000);
    } catch (err: any) {
      setAuthError("Google Sign-In error: " + (err.message || String(err)));
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    if (!formEmail.trim() || !formPassword) {
      setAuthError("Please enter both email and password.");
      return;
    }
    try {
      if (authMode === "signup") {
        await signUp(formEmail.trim(), formPassword, formName.trim() || "Traveler");
        setAuthSuccess(`Account created successfully for ${formEmail.trim()}!`);
      } else {
        await signIn(formEmail.trim(), formPassword);
        setAuthSuccess(`Welcome back, ${formEmail.trim()}!`);
      }
      setFormPassword("");
      if (onDataChanged) onDataChanged();
      setTimeout(() => setAuthSuccess(null), 4000);
    } catch (err: any) {
      setAuthError("Authentication error: " + (err.message || String(err)));
    }
  };

  const handleSwitchAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    if (!formEmail.trim()) return;
    try {
      await switchUserAccount(formEmail.trim(), formName.trim() || undefined);
      setAuthSuccess(`Active account switched to ${formEmail.trim()}`);
      setShowAccountSwitcher(false);
      if (onDataChanged) onDataChanged();
      setTimeout(() => setAuthSuccess(null), 4000);
    } catch (err: any) {
      setAuthError("Failed to switch account: " + (err.message || String(err)));
    }
  };

  const handleLogout = async () => {
    setAuthError(null);
    setAuthSuccess(null);
    try {
      await logout();
      setAuthSuccess("Logged out successfully. Switched to guest mode.");
      if (onDataChanged) onDataChanged();
      setTimeout(() => setAuthSuccess(null), 4000);
    } catch (err: any) {
      setAuthError("Logout error: " + (err.message || String(err)));
    }
  };

  const mainModalContent = (
    <div className={`flex flex-col w-full ${isInline ? "h-auto md:h-full md:overflow-hidden" : "h-full overflow-hidden"}`}>
      {/* Header */}
      <div className="p-5 sm:p-6 bg-white border-b border-[#e5e5df]/60 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div className="space-y-2">
          <h1 className="font-serif text-2xl sm:text-4xl md:text-5xl font-normal italic text-[#2c2c24] leading-tight tracking-tight">
            <TranslatedText text="Traveler Profile & Settings" />
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#8a8a7e] font-bold uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#f5f5f0] border border-[#d1d1ca] flex items-center justify-center text-sm shadow-2xs shrink-0">
                {editAvatarUrl ? (
                  <img
                    src={editAvatarUrl}
                    alt={editName}
                    className="w-full h-full object-cover rounded-xl"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span>{AVATAR_PRESETS.find((a) => a.id === editAvatarPreset)?.emoji || "🧭"}</span>
                )}
              </div>
              <span className="text-[#2c2c24]">{editName || "Traveler"}</span>
            </div>
            <span className="text-stone-300">•</span>
            <span>{userEmail}</span>
            {editHomeCity && (
              <>
                <span className="text-stone-300">•</span>
                <span className="flex items-center gap-1 text-[#5A5A40]">
                  <MapPin className="w-3.5 h-3.5" />
                  {editHomeCity}
                </span>
              </>
            )}
            <span className="text-stone-300">•</span>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#5A5A40]/10 text-[#5A5A40] border border-[#d1d1ca]">
              PRO EXPLORER
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-end md:self-center">
          {!isInline && (
            <button
              id="close-profile-modal-btn"
              onClick={onClose}
              className="p-2 text-[#5A5A40] hover:bg-[#f5f5f0] border border-[#d1d1ca] rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Sync / Feedback Toast */}
      {syncFeedback && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2.5 text-xs text-emerald-900 flex items-center justify-between animate-fade-in shrink-0">
          <span className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {syncFeedback}
          </span>
          <button onClick={() => setSyncFeedback(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Tab Bar */}
      <div className="border-b border-stone-200 bg-stone-50 px-1 sm:px-6 shrink-0">
        <div className="grid grid-cols-5 gap-0.5 sm:gap-2 w-full">
          {[
            { id: "identity", label: "Profile", fullLabel: "Personal Profile", icon: User },
            { id: "portfolio", label: "Portfolio", fullLabel: "Public Portfolio", icon: Compass },
            { id: "reviews", label: "Reviews", fullLabel: "My Reviews", icon: MessageSquare },
            { id: "taste", label: "Prefs", fullLabel: "Preferences", icon: Sliders },
            { id: "cloud", label: "Sync", fullLabel: "Sync & Data", icon: Database },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setProfileTab(tab.id as any)}
                className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 py-2 sm:py-3 px-0.5 sm:px-3.5 text-[10px] sm:text-sm font-semibold border-b-2 transition-colors text-center w-full min-w-0 ${
                  profileTab === tab.id
                    ? "border-emerald-600 text-emerald-800 bg-white font-bold"
                    : "border-transparent text-stone-500 hover:text-stone-800"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline"><TranslatedText text={tab.fullLabel} /></span>
                <span className="sm:hidden truncate max-w-full"><TranslatedText text={tab.label} /></span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable Body Content */}
      <div className={`flex-1 p-4 sm:p-6 space-y-6 bg-stone-50/40 ${isInline ? "md:overflow-y-auto overflow-visible" : "overflow-y-auto"}`}>
        {/* TAB 1: IDENTITY & PROFILE EDITING */}
        {profileTab === "identity" && (
          <form onSubmit={handleSaveProfile} className="space-y-5 max-w-2xl mx-auto">
            {/* Status Feedback Banners */}
            {authError && (
              <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl text-xs text-red-950 flex items-start space-x-2.5 animate-fade-in">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold"><TranslatedText text="Authentication Error" /></p>
                  <p>{authError}</p>
                </div>
              </div>
            )}

            {authSuccess && (
              <div className="p-4 bg-emerald-50 border-2 border-emerald-200 rounded-2xl text-xs text-emerald-950 flex items-start space-x-2.5 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold"><TranslatedText text="Success" /></p>
                  <p>{authSuccess}</p>
                </div>
              </div>
            )}

            {/* Active Account & Authentication Fusion Card */}
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center font-bold shrink-0">
                    <User className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-stone-500 block">
                      <TranslatedText text="Active Account" />
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-bold text-stone-900 truncate max-w-[220px]">{userEmail}</span>
                      {isLoggedIn ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 shrink-0">
                          <TranslatedText text="Signed In" />
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 shrink-0">
                          <TranslatedText text="Guest Mode" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {isLoggedIn && (
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold transition-all border border-red-200 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span><TranslatedText text="Logout" /></span>
                    </button>
                  )}
                </div>
              </div>

              {/* Sub-bar showing Cloud Sync status and Switch Account option */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-600 flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Firestore Cloud Sync: <strong>{syncStatus}</strong></span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowAccountSwitcher(!showAccountSwitcher)}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                >
                  {showAccountSwitcher ? "Hide Switcher" : "Switch Account Email"}
                </button>
              </div>

              {/* Account Switcher Form */}
              {showAccountSwitcher && (
                <div className="pt-2 space-y-3 border-t border-stone-100">
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                    <TranslatedText text="Switch Account Email" />
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="e.g. explorer@domain.com"
                      className="flex-1 px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={(e) => handleSwitchAccountSubmit(e as any)}
                      className="px-4 py-2 bg-[#5A5A40] text-white rounded-xl text-xs font-bold hover:bg-[#4a4a35] transition-colors cursor-pointer"
                    >
                      <TranslatedText text="Switch" />
                    </button>
                  </div>
                </div>
              )}

              {/* UNLESS LOGGED IN: SHOW GOOGLE & EMAIL SIGN IN FORMS */}
              {!isLoggedIn && (
                <div className="pt-4 border-t border-stone-200 space-y-4">
                  <div className="space-y-1">
                    <h5 className="font-bold text-stone-900 text-sm font-serif">
                      <TranslatedText text="Sign In or Create Account" />
                    </h5>
                    <p className="text-xs text-stone-500">
                      <TranslatedText text="Sign in with your Google account or email credentials to preserve your custom itineraries, personal spots, and community statistics." />
                    </p>
                  </div>

                  {/* Google SSO Button */}
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    className="w-full py-2.5 px-4 bg-white hover:bg-stone-50 text-stone-800 border-2 border-stone-300 rounded-xl text-xs sm:text-sm font-bold shadow-2xs transition-all flex items-center justify-center space-x-2.5 cursor-pointer active:scale-98"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span><TranslatedText text="Continue with Google Account" /></span>
                  </button>

                  <div className="relative flex items-center justify-center">
                    <div className="border-t border-stone-200 w-full" />
                    <span className="bg-white px-3 text-[10px] font-bold text-stone-400 uppercase tracking-wider absolute">
                      <TranslatedText text="Or Email & Password" />
                    </span>
                  </div>

                  {/* Mode Switcher */}
                  <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200">
                    <button
                      type="button"
                      onClick={() => setAuthMode("signin")}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        authMode === "signin"
                          ? "bg-white text-stone-900 shadow-xs"
                          : "text-stone-500 hover:text-stone-800"
                      }`}
                    >
                      <TranslatedText text="Sign In" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode("signup")}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        authMode === "signup"
                          ? "bg-white text-stone-900 shadow-xs"
                          : "text-stone-500 hover:text-stone-800"
                      }`}
                    >
                      <TranslatedText text="Create Account" />
                    </button>
                  </div>

                  {/* Email & Password Form */}
                  <div className="space-y-3.5">
                    {authMode === "signup" && (
                      <div>
                        <label className="block text-xs font-bold text-stone-700 mb-1">
                          <TranslatedText text="Full Name" />
                        </label>
                        <input
                          type="text"
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          placeholder="e.g. Unai Amenabar"
                          className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        <TranslatedText text="Email Address" />
                      </label>
                      <input
                        type="email"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        <TranslatedText text="Password" />
                      </label>
                      <input
                        type="password"
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleEmailAuthSubmit(e as any)}
                      className="w-full py-2.5 bg-[#5A5A40] hover:bg-[#4a4a35] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                    >
                      {authMode === "signin" ? (
                        <TranslatedText text="Sign In to Account" />
                      ) : (
                        <TranslatedText text="Create New Account" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
            {/* Avatar Selection Card */}
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                <TranslatedText text="Choose Profile Picture / Avatar" />
              </label>

              {/* Avatar Presets Grid */}
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {AVATAR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setEditAvatarPreset(preset.id);
                      setEditAvatarUrl("");
                    }}
                    className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                      editAvatarPreset === preset.id && !editAvatarUrl
                        ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500/20"
                        : "border-stone-200 bg-stone-50 hover:bg-white"
                    }`}
                  >
                    <span className="text-2xl">{preset.emoji}</span>
                    <span className="text-[10px] font-medium text-stone-600">{preset.label}</span>
                  </button>
                ))}
              </div>

              {/* Custom Image URL Toggle */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustomAvatarInput(!showCustomAvatarInput)}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <TranslatedText text="Or enter custom image URL" />
                </button>

                {showCustomAvatarInput && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="url"
                      value={editAvatarUrl}
                      onChange={(e) => setEditAvatarUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/... or profile image link"
                      className="flex-1 px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Profile Fields */}
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
                    <TranslatedText text="Display Name" />
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm font-semibold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    placeholder="e.g. Unai Amenabar"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
                    <TranslatedText text="Home City / Base" />
                  </label>
                  <input
                    type="text"
                    value={editHomeCity}
                    onChange={(e) => setEditHomeCity(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    placeholder="e.g. San Sebastián, Basque Country"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
                  <TranslatedText text="Traveler Bio & Description" />
                </label>
                <textarea
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 leading-relaxed"
                  placeholder="Share a short introduction about your travel philosophy, favorite food, favorite destinations, and secret tips..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
                    <TranslatedText text="Travel Style" />
                  </label>
                  <input
                    type="text"
                    value={editTravelStyle}
                    onChange={(e) => setEditTravelStyle(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    placeholder="e.g. Culinary & Cultural Explorer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
                    <TranslatedText text="Website or Social Link" />
                  </label>
                  <input
                    type="text"
                    value={editSocial}
                    onChange={(e) => setEditSocial(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    placeholder="e.g. instagram.com/unai_travels"
                  />
                </div>
              </div>

              {/* Community Badges & Social Stats */}
              <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-stone-500">Badges:</span>
                  <span className="px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200 flex items-center gap-1">
                    <Award className="w-3 h-3 text-emerald-600" />
                    Local Resident
                  </span>
                  <span className="px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200 flex items-center gap-1">
                    <Compass className="w-3 h-3 text-emerald-600" />
                    Verified Explorer
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs font-medium text-stone-600">
                  <button
                    type="button"
                    onClick={() => setShowFollowingList(true)}
                    className="hover:text-emerald-700 font-semibold"
                  >
                    <span className="text-stone-900 font-bold">{followingList.length}</span> Following
                  </button>
                  <span>•</span>
                  <span>
                    <span className="text-stone-900 font-bold">{followersList.length}</span> Followers
                  </span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white text-sm font-semibold rounded-xl shadow-md shadow-emerald-800/20 transition-all flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <TranslatedText text="Save Profile Changes" />
                </button>
              </div>
            </div>
          </form>
        )}

        {/* TAB 2: PUBLIC PORTFOLIO */}
        {profileTab === "portfolio" && (
          <div className="space-y-6 max-w-3xl mx-auto">
            {/* Header & Quick Publish Button */}
            <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
              <div>
                <h4 className="font-bold text-stone-900 text-base font-serif">
                  <TranslatedText text="Your Public Itineraries on Explore" />
                </h4>
                <p className="text-xs text-stone-500">
                  <TranslatedText text="Routes and secret spots you have shared with the global explorer community" />
                </p>
              </div>
              <button
                onClick={() => {
                  const saved = getSavedTrips();
                  if (saved.length > 0) {
                    setTripToPublish(saved[0]);
                  } else {
                    alert("You don't have any saved itineraries yet. Create one first!");
                  }
                }}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <TranslatedText text="Publish Saved Trip" />
              </button>
            </div>

            {loadingPortfolio ? (
              <div className="py-12 text-center text-stone-500">
                <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs">Loading portfolio...</p>
              </div>
            ) : myPublicTrips.length === 0 ? (
              <div className="text-center py-12 px-4 bg-white rounded-2xl border border-dashed border-stone-200 space-y-3">
                <Compass className="w-10 h-10 text-stone-300 mx-auto" />
                <h4 className="font-bold text-stone-800 text-sm">
                  <TranslatedText text="No public itineraries published yet" />
                </h4>
                <p className="text-xs text-stone-500 max-w-sm mx-auto">
                  <TranslatedText text="Share your curated travel itineraries to help fellow explorers discover secret taverns and hidden viewpoints!" />
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myPublicTrips.map((trip) => (
                  <div
                    key={trip.id}
                    className="bg-white rounded-xl border border-stone-200 shadow-xs p-4 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h4 className="font-bold text-stone-900 text-sm line-clamp-1">{trip.plan.title}</h4>
                        <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full text-xs font-bold">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span>{trip.rating?.toFixed(1) || "5.0"}</span>
                        </div>
                      </div>
                      <p className="text-xs text-stone-600 line-clamp-2 mb-3 leading-relaxed">
                        {trip.plan.summary}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-stone-500 mb-3">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-stone-400" />
                          {trip.plan.destinationOrTown}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Download className="w-3 h-3 text-stone-400" />
                          {trip.downloadsCount || 0} downloads
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
                      {onSelectTrip && (
                        <button
                          onClick={() => {
                            onSelectTrip(trip.plan);
                            onClose();
                          }}
                          className="flex-1 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold transition-colors"
                        >
                          <TranslatedText text="Open" />
                        </button>
                      )}
                      <button
                        onClick={() => handleUnpublishTrip(trip.id)}
                        className="py-1.5 px-3 bg-stone-100 hover:bg-red-50 hover:text-red-700 text-stone-600 rounded-lg text-xs font-semibold transition-colors"
                      >
                        <TranslatedText text="Unpublish" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* My Shared Spots section */}
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
              <h4 className="font-bold text-stone-900 text-base font-serif">
                <TranslatedText text="Your Shared Community Spots" />
              </h4>
              {myPublicSpots.length === 0 ? (
                <p className="text-xs text-stone-500 italic">
                  <TranslatedText text="You haven't shared individual spots yet. Use the 'Share a Spot' button in Explore!" />
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {myPublicSpots.map((spot) => (
                    <div key={spot.id} className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs">
                      <div className="font-bold text-stone-900">{spot.name}</div>
                      <div className="text-stone-500 text-[11px] mt-0.5">{spot.cityOrRegion} • {spot.category}</div>
                      {spot.insiderTip && (
                        <div className="mt-1 text-[11px] text-amber-900 bg-amber-50 p-1.5 rounded-md">
                          💡 {spot.insiderTip}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: REVIEWS GIVEN */}
        {profileTab === "reviews" && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
              <h4 className="font-bold text-stone-900 text-base font-serif">
                <TranslatedText text="Reviews You've Written" />
              </h4>
              <p className="text-xs text-stone-500">
                <TranslatedText text="Feedback and tips you provided to other travelers in the community" />
              </p>
            </div>

            {myReviews.length === 0 ? (
              <div className="text-center py-12 px-4 bg-white rounded-2xl border border-dashed border-stone-200">
                <MessageSquare className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                <p className="text-stone-600 font-medium text-sm">
                  <TranslatedText text="You haven't written any reviews yet." />
                </p>
                <p className="text-xs text-stone-400 mt-1">
                  <TranslatedText text="Rate and comment on itineraries in the Explore tab to guide other travelers!" />
                </p>
              </div>
            ) : (
              myReviews.map((rev, idx) => (
                <div key={idx} className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-stone-900 text-sm flex items-center gap-1.5">
                      <Compass className="w-4 h-4 text-emerald-600" />
                      <span>{rev.tripTitle}</span>
                      <span className="text-stone-400 text-xs font-normal">({rev.destination})</span>
                    </div>
                    <div className="flex items-center gap-1 text-amber-500 text-xs font-bold bg-amber-50 px-2 py-0.5 rounded-md">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>{rev.rating} / 5</span>
                    </div>
                  </div>
                  <p className="text-xs text-stone-700 bg-stone-50 p-2.5 rounded-lg border border-stone-100 leading-relaxed">
                    "{rev.text}"
                  </p>
                  <div className="text-[11px] text-stone-400 text-right">
                    {new Date(rev.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 4: PREFERENCES & AI MODEL SELECTION */}
        {profileTab === "taste" && (
          <div className="space-y-6 max-w-3xl mx-auto">
            {/* Currency & Regional Preferences */}
            <RegionalPreferencesSection />

            {/* AI Models & Personal Keys Manager */}
            <AIModelManagerSection />

            {/* Travel Personas */}
            <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
              <div>
                <h4 className="font-bold text-stone-900 text-base font-serif">
                  <TranslatedText text="Choose Your Travel Persona" />
                </h4>
                <p className="text-xs text-stone-500">
                  <TranslatedText text="One-click presets tailored for your itinerary speed, dining style, and budget" />
                </p>
              </div>
              <button
                onClick={onOpenTasteProfile}
                className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1"
              >
                <Sliders className="w-3.5 h-3.5 text-stone-600" />
                <TranslatedText text="Full Taste Profile" />
              </button>
            </div>

            {/* Audio Guide & Human Voice Style Setting */}
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-emerald-700" />
                  <h4 className="font-bold text-stone-900 text-base font-serif">
                    <TranslatedText text="AI Voice Companion & Personas" />
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={handlePreviewVoice}
                  disabled={isPreviewingVoice}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isPreviewingVoice
                      ? "bg-amber-100 text-amber-900 border border-amber-300 animate-pulse"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  }`}
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{isPreviewingVoice ? "Previewing..." : "Preview Voice"}</span>
                </button>
              </div>
              <p className="text-xs text-stone-500">
                <TranslatedText text="Choose your narrator's persona voice (different styles for women, men, and guides) and reading speed." />
              </p>

              {/* Persona Options */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-700 block">
                  <TranslatedText text="Voice Persona" />
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: "aria", name: "Aria", desc: "Warm & Friendly (Female)", icon: "👩‍🦰" },
                    { id: "orion", name: "Orion", desc: "Deep & Calm (Male)", icon: "👨‍🦱" },
                    { id: "nova", name: "Nova", desc: "Bright & Energetic (Female)", icon: "🌟" },
                    { id: "zephyr", name: "Zephyr", desc: "Smooth & Conversational (Male)", icon: "🧭" },
                    { id: "sol", name: "Sol", desc: "Articulate & Professional (Female)", icon: "☀️" },
                    { id: "atlas", name: "Atlas", desc: "Authoritative & Rich (Male)", icon: "🏔️" },
                  ].map((p) => {
                    const isSelected = voicePersona === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handlePersonaChange(p.id)}
                        className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 cursor-pointer ${
                          isSelected
                            ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-stone-900"
                            : "bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700"
                        }`}
                      >
                        <span className="text-xl shrink-0">{p.icon}</span>
                        <div className="min-w-0">
                          <div className="font-bold text-xs truncate">{p.name}</div>
                          <div className="text-[10px] text-stone-500 truncate">{p.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reading Pace / Speed Slider */}
              <div className="space-y-2 pt-2 border-t border-stone-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-700">
                    <TranslatedText text="Reading Speed (Pace)" />
                  </label>
                  <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    {voiceSpeed}x
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0.75"
                    max="1.3"
                    step="0.05"
                    value={voiceSpeed}
                    onChange={(e) => handleSpeedChange(e.target.value)}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                </div>
                <div className="flex justify-between text-[10px] text-stone-400 font-medium">
                  <span>0.75x (Relaxed)</span>
                  <span>1.0x (Standard)</span>
                  <span>1.3x (Fast)</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PERSONA_PRESETS.map((preset) => {
                const isActive = activePersona === preset.id;
                return (
                  <div
                    key={preset.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                      isActive
                        ? "bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20"
                        : "bg-white border-stone-200 hover:border-stone-300"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{preset.emoji}</span>
                          <span className="font-bold text-stone-900 text-sm">{preset.name}</span>
                        </div>
                        {isActive && (
                          <span className="px-2 py-0.5 bg-emerald-600 text-white rounded-full text-[10px] font-bold">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-600 leading-relaxed mb-3">{preset.tagline}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleApplyPersona(preset)}
                      className={`w-full py-2 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? "bg-emerald-700 text-white shadow-xs"
                          : "bg-stone-100 hover:bg-stone-200 text-stone-800"
                      }`}
                    >
                      {isActive ? "Currently Applied" : `Apply "${preset.name}"`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 5: MULTI-SESSION CLOUD SYNC & DATA */}
        {profileTab === "cloud" && (
          <div className="space-y-5 max-w-2xl mx-auto">
            {/* Cloud Sync Status */}
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-stone-900 text-sm">
                    <TranslatedText text="Cloud Firestore Synchronization" />
                  </h4>
                  <p className="text-xs text-stone-500">
                    <TranslatedText text="Real-time multi-device sync across all sessions" />
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloudSync}
                  disabled={isSyncing}
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                  <TranslatedText text="Sync Now" />
                </button>
              </div>

              <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">Sync Status:</span>
                  <span className="font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Connected & Synchronized
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">Last Synced Time:</span>
                  <span className="font-medium text-stone-800">{lastSyncTime || "Just now"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">Active Document ID:</span>
                  <span className="font-mono text-[11px] text-stone-600 truncate max-w-[200px]">
                    user_{userEmail.replace(/[^a-z0-9]/g, "_")}
                  </span>
                </div>
              </div>
            </div>

            {/* JSON Backup & Restore */}
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
              <h4 className="font-bold text-stone-900 text-sm">
                <TranslatedText text="Data Backup & JSON Export" />
              </h4>
              <p className="text-xs text-stone-500 leading-relaxed">
                <TranslatedText text="Export your entire travel archive (trips, spots, taste profile, and history) as a standalone JSON file." />
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleExportAllData}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <TranslatedText text="Export JSON Backup" />
                </button>

                <label className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <TranslatedText text="Restore Backup" />
                  <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FOLLOWING LIST MODAL */}
      {showFollowingList && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setShowFollowingList(false)}
        >
          <div
            className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-stone-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-stone-900 font-serif">
                <TranslatedText text="Explorers You Follow" /> ({followingList.length})
              </h3>
              <button onClick={() => setShowFollowingList(false)} className="p-1 text-stone-400 hover:text-stone-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {followingList.length === 0 ? (
                <p className="text-xs text-stone-500 italic text-center py-4">
                  <TranslatedText text="You are not following any explorers yet. Discover authors in the Explore tab!" />
                </p>
              ) : (
                followingList.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between p-2.5 bg-stone-50 rounded-xl border border-stone-200 text-xs"
                  >
                    <button
                      onClick={() => {
                        setInspectCreatorEmail(email);
                        setShowFollowingList(false);
                      }}
                      className="font-semibold text-stone-800 hover:text-emerald-700 truncate"
                    >
                      {email}
                    </button>
                    <button
                      onClick={async () => {
                        await toggleFollowUser(email);
                      }}
                      className="px-2.5 py-1 bg-stone-200 hover:bg-red-50 hover:text-red-700 rounded-lg text-[11px] font-semibold text-stone-700 transition-colors"
                    >
                      Unfollow
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* PUBLISH TRIP MODAL LAUNCHER */}
      {tripToPublish && (
        <PublishTripModal
          isOpen={Boolean(tripToPublish)}
          onClose={() => setTripToPublish(null)}
          trip={tripToPublish}
          onPublished={() => loadUserCommunityData()}
        />
      )}

      {/* CREATOR PROFILE INSPECTOR */}
      {inspectCreatorEmail && (
        <CreatorProfileModal
          isOpen={Boolean(inspectCreatorEmail)}
          onClose={() => setInspectCreatorEmail(null)}
          creatorEmail={inspectCreatorEmail}
          onSelectTrip={onSelectTrip}
        />
      )}
    </div>
  );

  if (isInline) {
    return (
      <div className="bg-white md:rounded-3xl md:border md:border-[#e5e5df] md:shadow-sm flex flex-col overflow-hidden max-w-3xl mx-auto w-full animate-in fade-in duration-200 md:h-[760px] md:max-h-[88vh] md:min-h-[580px] h-auto min-h-screen -mx-3 px-3 sm:mx-0 sm:px-0">
        {mainModalContent}
      </div>
    );
  }

  return (
    <div
      id="user-profile-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        id="user-profile-modal-container"
        className="relative w-full max-w-3xl h-[88vh] max-h-[780px] min-h-[560px] sm:min-h-[640px] bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {mainModalContent}
      </div>
    </div>
  );
};
