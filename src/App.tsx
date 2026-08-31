import React, { useState, useEffect } from "react";
import { Navbar } from "./components/Navbar";
import { BottomNav } from "./components/BottomNav";
import { VacationForm } from "./components/VacationForm";
import { HometownForm } from "./components/HometownForm";
import { ItineraryDisplay } from "./components/ItineraryDisplay";
import { SavedTripsDrawer } from "./components/SavedTripsDrawer";
import { ActivityHistoryModal } from "./components/ActivityHistoryModal";
import { ExportModal } from "./components/ExportModal";
import { GoogleMapsExportModal } from "./components/GoogleMapsExportModal";
import { ActivitySwiperModal } from "./components/ActivitySwiperModal";
import { MySpotsModal } from "./components/MySpotsModal";
import { TasteProfileModal } from "./components/TasteProfileModal";
import { UserProfileModal } from "./components/UserProfileModal";
import { GenerationProgressModal } from "./components/GenerationProgressModal";
import { HelpChatbotModal } from "./components/HelpChatbotModal";
import { ExploreFeed } from "./components/ExploreFeed";
import { ToastContainer, ToastMessage } from "./components/Toast";
import { SyncStatusBanner } from "./components/SyncStatusBanner";
import { AppMode, ItineraryPlan, VacationPreferences, HometownPreferences, ActivitySpot, CandidateSpot } from "./types";
import { SAMPLE_VACATION_PLAN, SAMPLE_HOMETOWN_PLAN } from "./utils/curatedData";
import {
  getSavedTrips,
  saveTrip,
  deleteSavedTrip,
  isTripSaved,
  recordPlanActivities,
  getActivityHistory,
  getRecentExcludedPlaces,
  getPermanentSkipNames,
  addPermanentSkip,
  getMySpots,
  getTasteProfile,
  getCurrentSessionPlan,
  saveCurrentSessionPlan,
} from "./utils/storage";
import { parseShareableUrl } from "./utils/sharing";
import { loadAISettings } from "./utils/aiConfig";
import { getKnownSpotsForDestination } from "./utils/destinations";
import { subscribeToSharedTrip, publishSharedTripUpdate } from "./utils/sharedTripService";

async function safeFetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const contentType = res.headers.get("content-type") || "";
  
  if (!res.ok || !contentType.includes("application/json")) {
    const text = await res.text();
    let errJson: any = null;
    try {
      errJson = JSON.parse(text);
    } catch {}
    const msg = errJson?.error || (res.ok ? "Server returned non-JSON response" : `Server HTTP ${res.status}`);
    throw new Error(msg);
  }

  return (await res.json()) as T;
}
import { Compass, Eye, EyeOff, Plane, MapPin } from "lucide-react";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { PreferencesProvider } from "./context/PreferencesContext";

function AppContent() {
  const { t } = useLanguage();
  const { syncUserDataWithCloud } = useAuth();
  const [currentPlan, setCurrentPlan] = useState<ItineraryPlan>(() => {
    const shared = parseShareableUrl();
    if (shared) return shared;
    const activeSession = getCurrentSessionPlan();
    if (activeSession) return activeSession;
    return SAMPLE_VACATION_PLAN;
  });
  const [activeMode, setActiveMode] = useState<AppMode>(() => {
    const shared = parseShareableUrl();
    if (shared) return shared.mode;
    const activeSession = getCurrentSessionPlan();
    if (activeSession) return activeSession.mode;
    return "vacation";
  });
  const [isLoading, setIsLoading] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<"form" | "itinerary" | "explore" | "saved" | "profile">("form");
  const [isFormVisible, setIsFormVisible] = useState(false);

  // Modals and Drawers
  const [isSavedDrawerOpen, setIsSavedDrawerOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isGoogleMapsExportOpen, setIsGoogleMapsExportOpen] = useState(false);
  const [isMySpotsOpen, setIsMySpotsOpen] = useState(false);
  const [mySpotsCount, setMySpotsCount] = useState(0);
  const [isTasteProfileOpen, setIsTasteProfileOpen] = useState(false);
  const [hasTasteProfile, setHasTasteProfile] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Swiper Modal State
  const [isSwiperOpen, setIsSwiperOpen] = useState(false);
  const [candidateSpots, setCandidateSpots] = useState<CandidateSpot[]>([]);
  const [pendingVacationPrefs, setPendingVacationPrefs] = useState<VacationPreferences | null>(null);

  // Storage states
  const [savedTrips, setSavedTrips] = useState<ItineraryPlan[]>([]);
  const [historyCount, setHistoryCount] = useState<number>(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Initial Load: check for shared URL trip, active session, or load saved trips
  useEffect(() => {
    const loadedSaved = getSavedTrips();
    setSavedTrips(loadedSaved);
    setHistoryCount(getActivityHistory().length);
    setMySpotsCount(getMySpots().length);
    setHasTasteProfile(getTasteProfile() !== null);

    const shared = parseShareableUrl();
    if (shared) {
      setCurrentPlan(shared);
      setActiveMode(shared.mode);
      saveCurrentSessionPlan(shared);
      addToast("success", `Loaded shared itinerary for ${shared.destinationOrTown}!`);
      setActiveMobileTab("itinerary");
    } else {
      const activeSession = getCurrentSessionPlan();
      if (activeSession) {
        setCurrentPlan(activeSession);
        setActiveMode(activeSession.mode);
        setActiveMobileTab("itinerary");
      }
    }
  }, []);

  // Listen to live cloud sync updates across devices & tabs
  useEffect(() => {
    const handleCloudSync = () => {
      queueMicrotask(() => {
        const refreshedSaved = getSavedTrips();
        setSavedTrips(refreshedSaved);
        setHistoryCount(getActivityHistory().length);
        setMySpotsCount(getMySpots().length);
        setHasTasteProfile(getTasteProfile() !== null);
        const activeSession = getCurrentSessionPlan();
        if (activeSession) {
          setCurrentPlan((prev) => {
            if (!prev || prev.id !== activeSession.id) {
              return activeSession;
            }
            return prev;
          });
          setActiveMode(activeSession.mode);
        }
      });
    };

    window.addEventListener("localexplorer_cloud_sync_updated", handleCloudSync);
    return () => {
      window.removeEventListener("localexplorer_cloud_sync_updated", handleCloudSync);
    };
  }, []);

  // Automatically persist current itinerary session whenever it changes
  useEffect(() => {
    if (currentPlan) {
      saveCurrentSessionPlan(currentPlan);
    }
  }, [currentPlan]);

  // Real-time Firestore Sync for Shared Trip Collaboration
  useEffect(() => {
    if (!currentPlan?.id) return;

    const unsubscribe = subscribeToSharedTrip(currentPlan.id, (sharedDoc) => {
      if (sharedDoc && sharedDoc.plan) {
        setCurrentPlan(sharedDoc.plan);
        saveCurrentSessionPlan(sharedDoc.plan);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentPlan?.id]);

  const addToast = (type: "success" | "error" | "info", message: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Trigger Vacation Flow: If Swiper is enabled, fetch candidates and show swiper first!
  const handleVacationSubmit = async (prefs: VacationPreferences) => {
    if (prefs.enableSwiper) {
      setIsLoading(true);
      setPendingVacationPrefs(prefs);
      try {
        const destName = prefs.isMultiDestination && prefs.destinations && prefs.destinations.length > 0
          ? prefs.destinations[0].city
          : prefs.destination;

        // Try fetching candidate spots from server passing full user preferences
        const res = await fetch("/api/generate-candidates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            destination: destName,
            count: 12,
            vibes: prefs.vibes,
            budgetTier: prefs.budgetTier,
            budgetType: prefs.budgetType,
            exactBudgetPerDay: prefs.exactBudgetPerDay,
            currency: prefs.currency,
            pace: prefs.pace,
            userSpots: getMySpots(),
            tasteProfile: getTasteProfile() || undefined,
          }),
        });

        let spots: CandidateSpot[] = [];
        if (res.ok) {
          spots = await res.json();
        }

        // If server returned empty or failed, fallback to curated candidates adapted to vibes & budget
        if (!spots || spots.length === 0) {
          spots = getKnownSpotsForDestination(destName, prefs.vibes, prefs.budgetTier);
        }

        setCandidateSpots(spots);
        setIsSwiperOpen(true);
        addToast("info", `Discovering top spots for ${destName}. Swipe right to like!`);
      } catch (err) {
        console.warn("Could not fetch online candidates, using curated offline list:", err);
        const fallbackSpots = getKnownSpotsForDestination(prefs.destination, prefs.vibes, prefs.budgetTier);
        setCandidateSpots(fallbackSpots);
        setIsSwiperOpen(true);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Direct generation without swiper
      executeGenerateVacation(prefs);
    }
  };

  // Called when user finishes swiping or closes swiper
  const handleFinishSwiping = (likedSpots: ActivitySpot[], skippedSpots: ActivitySpot[] = []) => {
    setIsSwiperOpen(false);
    if (pendingVacationPrefs) {
      const updatedPrefs = {
        ...pendingVacationPrefs,
        likedSpots,
        skippedSpots,
      };
      setPendingVacationPrefs(updatedPrefs);
      executeGenerateVacation(updatedPrefs, likedSpots, skippedSpots);
    }
  };

  // Generate Vacation Plan Execution
  const executeGenerateVacation = async (
    prefs: VacationPreferences,
    preferredSpots?: ActivitySpot[],
    rejectedSpots?: ActivitySpot[]
  ) => {
    setIsLoading(true);
    const finalLikedSpots = preferredSpots && preferredSpots.length > 0
      ? preferredSpots
      : prefs.likedSpots || [];

    const finalSkippedSpots = rejectedSpots && rejectedSpots.length > 0
      ? rejectedSpots
      : prefs.skippedSpots || [];

    const finalPrefs: VacationPreferences = {
      ...prefs,
      likedSpots: finalLikedSpots,
      skippedSpots: finalSkippedSpots,
      permanentSkips: getPermanentSkipNames(),
      userSpots: getMySpots(),
      tasteProfile: getTasteProfile() || undefined,
      aiSettings: loadAISettings(),
    };

    try {
      const newPlan = await safeFetchJson<ItineraryPlan>("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "vacation",
          vacationPrefs: finalPrefs,
        }),
      });

      const planWithAccommodation: ItineraryPlan = {
        ...newPlan,
        vibes: (finalPrefs.vibes && finalPrefs.vibes.length > 0) ? finalPrefs.vibes : (newPlan.vibes || newPlan.tags || []),
        selectedVibes: finalPrefs.vibes || [],
        customPace: finalPrefs.pace || newPlan.customPace,
        budgetTier: finalPrefs.budgetTier || newPlan.budgetTier,
        transportMode: (finalPrefs.transportModes && finalPrefs.transportModes[0]) || finalPrefs.transportMode || newPlan.transportMode,
        transportModes: finalPrefs.transportModes || newPlan.transportModes,
        accommodation: newPlan.accommodation || finalPrefs.accommodation,
      };
      setCurrentPlan(planWithAccommodation);
      saveTrip(planWithAccommodation);
      setSavedTrips(getSavedTrips());
      syncUserDataWithCloud(true);
      setActiveMobileTab("itinerary");
      addToast("success", `Generated ${newPlan.totalDays}-day itinerary for ${newPlan.destinationOrTown}! Saved & Synced.`);

      // Smooth scroll to display
      setTimeout(() => {
        const el = document.getElementById("itinerary-results-section");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err: any) {
      console.error("Vacation generation error:", err);
      addToast("error", "Could not connect to generator. Loaded curated fallback.");
      // Fallback update
      const fallbackPlan = {
        ...SAMPLE_VACATION_PLAN,
        destinationOrTown: prefs.destination,
        title: `${prefs.duration}-Day ${prefs.destination} Travel Itinerary`,
        accommodation: prefs.accommodation,
      };
      setCurrentPlan(fallbackPlan);
      saveTrip(fallbackPlan);
      setSavedTrips(getSavedTrips());
      syncUserDataWithCloud(true);
      setActiveMobileTab("itinerary");
    } finally {
      setIsLoading(false);
    }
  };

  // Generate Hometown Plan Handler
  const handleGenerateHometown = async (prefs: HometownPreferences) => {
    setIsLoading(true);
    try {
      const newPlan = await safeFetchJson<ItineraryPlan>("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "hometown",
          hometownPrefs: {
            ...prefs,
            userSpots: getMySpots(),
            tasteProfile: getTasteProfile() || undefined,
            aiSettings: loadAISettings(),
          },
        }),
      });

      const planWithAccommodation: ItineraryPlan = {
        ...newPlan,
        accommodation: newPlan.accommodation || prefs.accommodation,
      };
      setCurrentPlan(planWithAccommodation);
      setActiveMobileTab("itinerary");
      addToast("success", `Found local ${prefs.occasion || "neighborhood"} spots within ${prefs.radiusKm}km of ${prefs.location}!`);

      setTimeout(() => {
        const el = document.getElementById("itinerary-results-section");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err: any) {
      console.error("Hometown generation error:", err);
      addToast("error", "Could not generate local guide. Loaded neighborhood fallback.");
      const fallbackHometown = {
        ...SAMPLE_HOMETOWN_PLAN,
        destinationOrTown: prefs.location,
        title: `Local Explorer: ${prefs.occasion} in ${prefs.location}`,
        accommodation: prefs.accommodation,
      };
      setCurrentPlan(fallbackHometown);
      setActiveMobileTab("itinerary");
    } finally {
      setIsLoading(false);
    }
  };

  // Permanently exclude a spot: never suggest it again in any future plan
  const handleSkipPermanently = (activity: ActivitySpot, dayNumber: number) => {
    addPermanentSkip(activity.name);
    handleUpdatePlan({
      ...currentPlan,
      days: currentPlan.days.map((day) =>
        day.dayNumber === dayNumber
          ? { ...day, activities: day.activities.filter((a) => a.id !== activity.id) }
          : day
      ),
    });
    addToast("info", `"${activity.name}" will never be suggested again. Manage it in History → Permanent Skips.`);
  };

  // Swap Single Activity Spot Handler
  const handleSwapActivity = async (
    activity: ActivitySpot,
    dayNumber: number,
    options?: { isIndoorOnly?: boolean; customRequirement?: string }
  ) => {
    try {
      const dayObj = currentPlan.days.find((d) => d.dayNumber === dayNumber);
      const actIndex = dayObj ? dayObj.activities.findIndex((a) => a.id === activity.id) : -1;
      const priorActivity = actIndex > 0 && dayObj ? dayObj.activities[actIndex - 1] : null;
      const posteriorActivity =
        actIndex >= 0 && dayObj && actIndex < dayObj.activities.length - 1
          ? dayObj.activities[actIndex + 1]
          : null;

      // Collect all activity names currently in the entire itinerary across all days
      const allItineraryActivityNames = currentPlan.days.flatMap((d) =>
        d.activities.map((a) => a.name)
      );

      const newSpot = await safeFetchJson<ActivitySpot>("/api/swap-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationOrTown: currentPlan.destinationOrTown,
          mode: currentPlan.mode,
          dayNumber,
          timeSlot: activity.time,
          currentActivityName: activity.name,
          category: activity.category,
          priorActivity,
          posteriorActivity,
          allItineraryActivityNames,
          vibes: currentPlan.tags || [],
          budgetTier: currentPlan.budgetTier,
          pace: currentPlan.customPace,
          groupSize: currentPlan.groupSize || pendingVacationPrefs?.groupSize,
          meansOfTransport: (pendingVacationPrefs?.transportModes || []).join(", ") || "Public Transit & Walking",
          excludedPlaces: getRecentExcludedPlaces(currentPlan.destinationOrTown),
          permanentSkips: getPermanentSkipNames(),
          userSpots: getMySpots(),
          tasteProfile: getTasteProfile() || undefined,
          isIndoorOnly: options?.isIndoorOnly,
          customRequirement: options?.customRequirement,
        }),
      });

      // Replace the activity inside currentPlan state
      handleUpdatePlan({
        ...currentPlan,
        days: currentPlan.days.map((day) => {
          if (day.dayNumber !== dayNumber) return day;
          return {
            ...day,
            activities: day.activities.map((act) => (act.id === activity.id ? newSpot : act)),
          };
        }),
      });

      if (options?.isIndoorOnly) {
        addToast("success", `☔ Rainy Day Swap: Replaced "${activity.name}" with covered indoor spot "${newSpot.name}"!`);
      } else {
        addToast("success", `Replaced "${activity.name}" with "${newSpot.name}"!`);
      }
    } catch (err) {
      console.error("Failed to swap spot:", err);
      addToast("error", "Could not swap spot right now. Please try again.");
    }
  };

  // Update Itinerary Plan (from user edits, additions, deletions, reorders)
  const handleUpdatePlan = (updatedPlan: ItineraryPlan) => {
    setCurrentPlan(updatedPlan);

    // If currently saved, keep storage in sync
    if (isTripSaved(updatedPlan.id)) {
      saveTrip(updatedPlan);
      setSavedTrips(getSavedTrips());
    }
    syncUserDataWithCloud(true);

    // Publish to shared_trips on Firestore for real-time group collaboration
    publishSharedTripUpdate(updatedPlan);
  };

  // Save Trip Toggle Handler
  const handleSaveTrip = () => {
    if (isTripSaved(currentPlan.id)) {
      deleteSavedTrip(currentPlan.id);
      const updated = getSavedTrips();
      setSavedTrips(updated);
      syncUserDataWithCloud(true);
      addToast("info", `Removed "${currentPlan.title}" from My Trips.`);
    } else {
      saveTrip(currentPlan);
      const updated = getSavedTrips();
      setSavedTrips(updated);
      syncUserDataWithCloud(true);
      addToast("success", `Saved "${currentPlan.title}" to My Trips! Synced with cloud.`);
    }
  };

  // Delete Saved Trip Handler
  const handleDeleteTrip = (id: string) => {
    deleteSavedTrip(id);
    setSavedTrips(getSavedTrips());
    syncUserDataWithCloud(true);
    addToast("info", "Removed trip from saved collection.");
  };

  // Load Saved Trip Handler
  const handleSelectSavedTrip = (trip: ItineraryPlan) => {
    setCurrentPlan(trip);
    setActiveMode(trip.mode);
    setActiveMobileTab("itinerary");
    addToast("info", `Opened saved itinerary: "${trip.title}"`);
  };

  // Reiterate Plan Handler (Completes empty slots starting from user-edited itinerary)
  const handleReiteratePlan = async (instructions?: string) => {
    if (!currentPlan) return;
    setIsLoading(true);
    try {
      const newPlan = await safeFetchJson<ItineraryPlan>("/api/reiterate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: currentPlan,
          instructions,
          excludedPlaces: getRecentExcludedPlaces(currentPlan.destinationOrTown),
          permanentSkips: getPermanentSkipNames(),
          tasteProfile: getTasteProfile() || undefined,
          userSpots: getMySpots(),
          transportModes: pendingVacationPrefs?.transportModes || currentPlan.transportModes || [],
          arrivalHour: pendingVacationPrefs?.arrivalHour || currentPlan.arrivalHour,
          departureHour: pendingVacationPrefs?.departureHour || currentPlan.departureHour,
        }),
      });

      setCurrentPlan(newPlan);
      if (isTripSaved(newPlan.id)) {
        saveTrip(newPlan);
        setSavedTrips(getSavedTrips());
      }
      addToast("success", "Itinerary reiterated! Empty slots auto-filled while preserving your edits.");
    } catch (err: any) {
      console.error("Reiteration error:", err);
      addToast("error", "Failed to reiterate itinerary. Keeping current edits.");
    } finally {
      setIsLoading(false);
    }
  };

  // Visited State Changed Handler
  const handleVisitedChanged = (_activity: ActivitySpot, isVisited: boolean) => {
    setHistoryCount(getActivityHistory().length);
    if (isVisited) {
      addToast("success", `Marked as visited! Saved to 30-Day Memory.`);
    } else {
      addToast("info", `Removed from 30-Day Memory.`);
    }
  };

  const isCurrentSaved = isTripSaved(currentPlan.id);

  const handleScrollToForm = () => {
    setIsMySpotsOpen(false);
    setIsSavedDrawerOpen(false);
    setIsProfileOpen(false);
    setActiveMobileTab("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleScrollToItinerary = () => {
    setIsMySpotsOpen(false);
    setIsSavedDrawerOpen(false);
    setIsProfileOpen(false);
    setActiveMobileTab("itinerary");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleToggleMySpots = () => {
    setIsSavedDrawerOpen(false);
    setIsProfileOpen(false);
    setIsMySpotsOpen((prev) => !prev);
  };

  const handleToggleSavedTrips = () => {
    setIsMySpotsOpen(false);
    setIsProfileOpen(false);
    setIsSavedDrawerOpen((prev) => !prev);
  };

  const handleToggleProfile = () => {
    setIsMySpotsOpen(false);
    setIsSavedDrawerOpen(false);
    setIsProfileOpen((prev) => !prev);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f0] flex flex-col selection:bg-[#5A5A40] selection:text-white font-sans text-[#2c2c24] pb-16 md:pb-0">
      {/* Top Sticky Navigation */}
      <Navbar
        activeMode={activeMode}
        onModeChange={(mode) => {
          setActiveMode(mode);
          setActiveMobileTab("form");
          if (mode === "vacation" && currentPlan.mode !== "vacation") {
            setCurrentPlan(SAMPLE_VACATION_PLAN);
          } else if (mode === "hometown" && currentPlan.mode !== "hometown") {
            setCurrentPlan(SAMPLE_HOMETOWN_PLAN);
          }
        }}
        savedTripsCount={savedTrips.length}
        onOpenSavedTrips={handleToggleSavedTrips}
        historyCount={historyCount}
        onOpenHistory={() => setIsHistoryModalOpen(true)}
        onOpenMySpots={() => setIsMySpotsOpen(true)}
        mySpotsCount={mySpotsCount}
        onOpenTasteProfile={() => setIsTasteProfileOpen(true)}
        hasTasteProfile={hasTasteProfile}
        onOpenExport={() => setIsExportModalOpen(true)}
        onOpenProfile={handleToggleProfile}
        hasActiveTrip={!!currentPlan}
        isExploreOpen={activeMobileTab === "explore"}
        onOpenExplore={() => {
          setActiveMobileTab("explore");
          setIsProfileOpen(false);
          setIsSavedDrawerOpen(false);
        }}
      />

      <SyncStatusBanner />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6 sm:space-y-8">
        {/* Top Preference Form Section */}
        <section id="generator-form-section" className={`no-print scroll-mt-18 space-y-4 ${activeMobileTab === "form" ? "block" : activeMobileTab === "explore" ? "hidden" : "hidden md:block"}`}>
          {/* Elegant Show/Hide Planner Toggle Card (Only on PC) */}
          <div className="hidden md:flex items-center justify-between bg-white border border-[#e5e5df] rounded-2xl p-4 shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#f5f5f0] rounded-xl border border-[#d1d1ca] text-[#5A5A40] shrink-0">
                {activeMode === "vacation" ? (
                  <Plane className="w-4 h-4" />
                ) : (
                  <MapPin className="w-4 h-4" />
                )}
              </div>
              <div>
                <h2 className="font-serif text-sm sm:text-base font-semibold italic text-[#2c2c24] leading-tight">
                  {activeMode === "vacation" ? t("planner.vacationTitle", "Vacation Itinerary Planner") : t("planner.hometownTitle", "Hometown Local Guide")}
                </h2>
                <p className="text-[11px] sm:text-xs text-[#8a8a7e] font-sans mt-0.5">
                  {isFormVisible
                    ? t("planner.collapsedDescOpen", "Configure your personal vibes, transport, dates and pace below to craft your custom AI itinerary.")
                    : t("planner.collapsedDescClosed", "The planner panel is collapsed. Click 'Show Planner' on the right to reveal your preferences.")}
                </p>
              </div>
            </div>

            <button
              id="btn-toggle-planner"
              onClick={() => setIsFormVisible(!isFormVisible)}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl border border-[#d1d1ca] hover:border-[#5A5A40] text-xs font-semibold text-[#5a5a4c] hover:text-[#5A5A40] hover:bg-[#f5f5f0] transition-all duration-200 cursor-pointer shadow-3xs"
            >
              {isFormVisible ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-[#5A5A40]" />
                  <span>{t("planner.hide", "Hide Planner")}</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-[#5A5A40]" />
                  <span>{t("planner.show", "Show Planner")}</span>
                </>
              )}
            </button>
          </div>

          <div className={`${isFormVisible ? "block" : "md:hidden"}`}>
            {activeMode === "vacation" ? (
              <VacationForm onSubmit={handleVacationSubmit} isLoading={isLoading} />
            ) : (
              <HometownForm
                onSubmit={handleGenerateHometown}
                isLoading={isLoading}
                onOpenHistory={() => setIsHistoryModalOpen(true)}
              />
            )}
          </div>
        </section>

        {/* Community Explore Feed Section */}
        <section id="explore-community-section" className={`scroll-mt-18 ${activeMobileTab === "explore" ? "block" : "hidden"}`}>
          <ExploreFeed
            currentPlan={currentPlan}
            onSelectTrip={(clonedPlan) => {
              setCurrentPlan(clonedPlan);
              setActiveMode(clonedPlan.mode);
              setActiveMobileTab("itinerary");
              setSavedTrips(getSavedTrips()); // Refresh saved trips list
            }}
            onUpdatePlan={handleUpdatePlan}
            onShowToast={addToast}
          />
        </section>

        {/* Results / Active Itinerary Section */}
        <section id="itinerary-results-section" className={`scroll-mt-18 ${activeMobileTab === "itinerary" ? "block" : activeMobileTab === "explore" ? "hidden" : "hidden md:block"}`}>
          <ItineraryDisplay
            plan={currentPlan}
            isSaved={isCurrentSaved}
            onSaveTrip={handleSaveTrip}
            onOpenExport={() => setIsExportModalOpen(true)}
            onSwapActivity={handleSwapActivity}
            onUpdatePlan={handleUpdatePlan}
            onSkipPermanently={handleSkipPermanently}
            onReiteratePlan={handleReiteratePlan}
            onVisitedChanged={handleVisitedChanged}
          />
        </section>

        {/* Saved Journeys Section (Inline on Mobile) */}
        <section id="saved-section-inline" className={`no-print scroll-mt-18 ${activeMobileTab === "saved" ? "block" : "hidden"}`}>
          <SavedTripsDrawer
            isInline={true}
            savedTrips={savedTrips}
            onSelectTrip={(trip) => {
              handleSelectSavedTrip(trip);
              setActiveMobileTab("itinerary");
            }}
            onDeleteTrip={handleDeleteTrip}
          />
        </section>

        {/* User Profile & Settings Section (Inline on Mobile) */}
        <section id="profile-section-inline" className={`no-print scroll-mt-18 ${activeMobileTab === "profile" ? "block" : "hidden"}`}>
          <UserProfileModal
            isInline={true}
            onOpenTasteProfile={() => setIsTasteProfileOpen(true)}
            onOpenMySpots={() => setIsMySpotsOpen(true)}
            onOpenSavedTrips={() => setActiveMobileTab("saved")}
            onOpenHistory={() => setIsHistoryModalOpen(true)}
            onSelectTrip={(trip) => {
              setCurrentPlan(trip);
              setActiveMode(trip.mode);
              setActiveMobileTab("itinerary");
            }}
            onDataChanged={() => {
              setSavedTrips(getSavedTrips());
              setHistoryCount(getActivityHistory().length);
              setMySpotsCount(getMySpots().length);
              setHasTasteProfile(getTasteProfile() !== null);
            }}
            activeMode={activeMode}
            onModeChange={(mode) => {
              setActiveMode(mode);
              setActiveMobileTab("form");
              if (mode === "vacation" && currentPlan.mode !== "vacation") {
                setCurrentPlan(SAMPLE_VACATION_PLAN);
              } else if (mode === "hometown" && currentPlan.mode !== "hometown") {
                setCurrentPlan(SAMPLE_HOMETOWN_PLAN);
              }
            }}
          />
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#e5e5df] py-8 text-center text-xs text-[#8a8a7e] no-print mt-14 mb-12 md:mb-0">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2.5">
            <Compass className="w-4 h-4 text-[#5A5A40]" />
            <span className="font-serif italic font-medium text-sm text-[#2c2c24]">LocalExplorer AI</span>
            <span>— {t("nav.subtitle", "Cultural Trip Planner & Hometown Guide")}</span>
          </div>
          <div className="flex items-center space-x-4 text-[#8a8a7e] font-serif italic text-xs">
            <span>Powered by Gemini & OpenStreetMap</span>
            <span>•</span>
            <button onClick={() => setIsHistoryModalOpen(true)} className="hover:text-[#2c2c24] underline transition-colors cursor-pointer">
              {t("nav.history", "30-Day History")} ({historyCount})
            </button>
            <span>•</span>
            <button onClick={() => setIsSavedDrawerOpen(true)} className="hover:text-[#2c2c24] underline transition-colors cursor-pointer">
              {t("nav.savedTrips", "Saved Trips")} ({savedTrips.length})
            </button>
            <span>•</span>
            <button onClick={() => setIsProfileOpen(true)} className="hover:text-[#2c2c24] underline transition-colors cursor-pointer">
              {t("profile.title", "Profile & Settings")}
            </button>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav
        activeMobileTab={activeMobileTab}
        activeMode={activeMode}
        onModeChange={(mode) => {
          setActiveMode(mode);
          setActiveMobileTab("form");
          if (mode === "vacation" && currentPlan.mode !== "vacation") {
            setCurrentPlan(SAMPLE_VACATION_PLAN);
          } else if (mode === "hometown" && currentPlan.mode !== "hometown") {
            setCurrentPlan(SAMPLE_HOMETOWN_PLAN);
          }
        }}
        onScrollToForm={handleScrollToForm}
        onScrollToItinerary={handleScrollToItinerary}
        onScrollToExplore={() => {
          setActiveMobileTab("explore");
          setIsSavedDrawerOpen(false);
          setIsProfileOpen(false);
        }}
        hasActiveTrip={!!currentPlan}
        savedTripsCount={savedTrips.length}
        isSavedOpen={activeMobileTab === "saved"}
        onOpenSavedTrips={() => {
          setActiveMobileTab("saved");
          setIsSavedDrawerOpen(false);
          setIsProfileOpen(false);
          setIsMySpotsOpen(false);
          setIsTasteProfileOpen(false);
        }}
        mySpotsCount={mySpotsCount}
        isMySpotsOpen={false}
        onOpenMySpots={() => {}}
        isProfileOpen={activeMobileTab === "profile"}
        onOpenProfile={() => {
          setActiveMobileTab("profile");
          setIsSavedDrawerOpen(false);
          setIsProfileOpen(false);
          setIsMySpotsOpen(false);
          setIsTasteProfileOpen(false);
        }}
        hasTasteProfile={hasTasteProfile}
      />

      {/* Drawers & Modals */}
      <SavedTripsDrawer
        isOpen={isSavedDrawerOpen}
        onClose={() => setIsSavedDrawerOpen(false)}
        savedTrips={savedTrips}
        onSelectTrip={handleSelectSavedTrip}
        onDeleteTrip={handleDeleteTrip}
      />

      <ActivityHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        onHistoryUpdated={() => setHistoryCount(getActivityHistory().length)}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        plan={currentPlan}
        onOpenGoogleMapsExport={() => setIsGoogleMapsExportOpen(true)}
      />

      <GoogleMapsExportModal
        isOpen={isGoogleMapsExportOpen}
        onClose={() => setIsGoogleMapsExportOpen(false)}
        plan={currentPlan}
      />

      {/* My Places: user-provided bars, cafés & restaurants */}
      <MySpotsModal
        isOpen={isMySpotsOpen}
        onClose={() => {
          setIsMySpotsOpen(false);
          setMySpotsCount(getMySpots().length);
        }}
        defaultTown={currentPlan?.destinationOrTown?.split(",")[0] || ""}
      />

      {/* Taste Profile: how the user likes to eat & drink */}
      <TasteProfileModal
        isOpen={isTasteProfileOpen}
        onClose={() => setIsTasteProfileOpen(false)}
        onSaved={() => setHasTasteProfile(getTasteProfile() !== null)}
      />

      {/* User Profile & Preferences Center */}
      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onOpenTasteProfile={() => setIsTasteProfileOpen(true)}
        onOpenMySpots={() => setIsMySpotsOpen(true)}
        onOpenSavedTrips={() => setIsSavedDrawerOpen(true)}
        onOpenHistory={() => setIsHistoryModalOpen(true)}
        onSelectTrip={(trip) => {
          setCurrentPlan(trip);
          setActiveMode(trip.mode);
          setActiveMobileTab("itinerary");
          setIsProfileOpen(false);
        }}
        onDataChanged={() => {
          setSavedTrips(getSavedTrips());
          setHistoryCount(getActivityHistory().length);
          setMySpotsCount(getMySpots().length);
          setHasTasteProfile(getTasteProfile() !== null);
        }}
        activeMode={activeMode}
        onModeChange={(mode) => {
          setActiveMode(mode);
          setActiveMobileTab("form");
          if (mode === "vacation" && currentPlan.mode !== "vacation") {
            setCurrentPlan(SAMPLE_VACATION_PLAN);
          } else if (mode === "hometown" && currentPlan.mode !== "hometown") {
            setCurrentPlan(SAMPLE_HOMETOWN_PLAN);
          }
        }}
      />

      {/* Activity Discovery Swiper Modal */}
      {isSwiperOpen && (
        <ActivitySwiperModal
          destination={
            pendingVacationPrefs?.isMultiDestination && pendingVacationPrefs.destinations?.[0]
              ? pendingVacationPrefs.destinations[0].city
              : pendingVacationPrefs?.destination || "Destination"
          }
          candidates={candidateSpots}
          isOpen={isSwiperOpen}
          onClose={() => setIsSwiperOpen(false)}
          onFinishSwiping={handleFinishSwiping}
        />
      )}

      {/* Live AI Generation Progress Modal */}
      <GenerationProgressModal
        isOpen={isLoading && !isSwiperOpen}
        destination={pendingVacationPrefs?.destination || currentPlan?.destinationOrTown || "Destination"}
        days={pendingVacationPrefs?.duration || currentPlan?.totalDays || 3}
        mode={activeMode}
      />

      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />

      {/* Floating Help & Guide Chatbot Button */}
      {!isHelpOpen && (
        <div className="fixed bottom-20 md:bottom-6 right-6 z-40 no-print">
          <button
            onClick={() => setIsHelpOpen(true)}
            className="bg-[#5A5A40] hover:bg-[#4a4a34] text-white p-3.5 rounded-full shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-2 group cursor-pointer border border-white/20"
            title="Help & Guide Assistant"
          >
            <span className="w-5 h-5 flex items-center justify-center font-bold text-sm">?</span>
            <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap text-xs font-medium px-0 group-hover:px-1">
              Help & Guide
            </span>
          </button>
        </div>
      )}

      {/* Help Chatbot Modal */}
      <HelpChatbotModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <PreferencesProvider>
          <AppContent />
        </PreferencesProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

