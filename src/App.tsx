import React, { useState, useEffect } from "react";
import { Navbar } from "./components/Navbar";
import { VacationForm } from "./components/VacationForm";
import { HometownForm } from "./components/HometownForm";
import { ItineraryDisplay } from "./components/ItineraryDisplay";
import { SavedTripsDrawer } from "./components/SavedTripsDrawer";
import { ActivityHistoryModal } from "./components/ActivityHistoryModal";
import { ExportModal } from "./components/ExportModal";
import { ActivitySwiperModal } from "./components/ActivitySwiperModal";
import { MySpotsModal } from "./components/MySpotsModal";
import { TasteProfileModal } from "./components/TasteProfileModal";
import { ToastContainer, ToastMessage } from "./components/Toast";
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
} from "./utils/storage";
import { parseShareableUrl } from "./utils/sharing";
import { getKnownSpotsForDestination } from "./utils/destinations";
import { Compass } from "lucide-react";

export default function App() {
  const [activeMode, setActiveMode] = useState<AppMode>("vacation");
  const [currentPlan, setCurrentPlan] = useState<ItineraryPlan>(SAMPLE_VACATION_PLAN);
  const [isLoading, setIsLoading] = useState(false);

  // Modals and Drawers
  const [isSavedDrawerOpen, setIsSavedDrawerOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isMySpotsOpen, setIsMySpotsOpen] = useState(false);
  const [mySpotsCount, setMySpotsCount] = useState(0);
  const [isTasteProfileOpen, setIsTasteProfileOpen] = useState(false);
  const [hasTasteProfile, setHasTasteProfile] = useState(false);

  // Swiper Modal State
  const [isSwiperOpen, setIsSwiperOpen] = useState(false);
  const [candidateSpots, setCandidateSpots] = useState<CandidateSpot[]>([]);
  const [pendingVacationPrefs, setPendingVacationPrefs] = useState<VacationPreferences | null>(null);

  // Storage states
  const [savedTrips, setSavedTrips] = useState<ItineraryPlan[]>([]);
  const [historyCount, setHistoryCount] = useState<number>(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Initial Load: check for shared URL trip or load saved trips
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
      addToast("success", `Loaded shared itinerary for ${shared.destinationOrTown}!`);
    }
    // NOTE: The bundled SAMPLE plans are intentionally NOT recorded into the
    // 30-day activity history. Doing so polluted the anti-repeat dedup memory
    // with demo data before the user had generated anything.
  }, []);

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
    };

    try {
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "vacation",
          vacationPrefs: finalPrefs,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const newPlan: ItineraryPlan = await res.json();
      setCurrentPlan(newPlan);
      recordPlanActivities(newPlan);
      setHistoryCount(getActivityHistory().length);
      addToast("success", `Generated ${newPlan.totalDays}-day itinerary for ${newPlan.destinationOrTown}!`);

      // Smooth scroll to display
      setTimeout(() => {
        const el = document.getElementById("itinerary-results-section");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err: any) {
      console.error("Vacation generation error:", err);
      addToast("error", "Could not connect to generator. Loaded curated fallback.");
      // Fallback update
      setCurrentPlan({
        ...SAMPLE_VACATION_PLAN,
        destinationOrTown: prefs.destination,
        title: `${prefs.duration}-Day ${prefs.destination} Travel Itinerary`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Generate Hometown Plan Handler
  const handleGenerateHometown = async (prefs: HometownPreferences) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "hometown",
          hometownPrefs: {
            ...prefs,
            userSpots: getMySpots(),
            tasteProfile: getTasteProfile() || undefined,
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const newPlan: ItineraryPlan = await res.json();
      setCurrentPlan(newPlan);
      recordPlanActivities(newPlan);
      setHistoryCount(getActivityHistory().length);
      addToast("success", `Found local ${prefs.occasion} spots within ${prefs.radiusKm}km of ${prefs.location}!`);

      setTimeout(() => {
        const el = document.getElementById("itinerary-results-section");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err: any) {
      console.error("Hometown generation error:", err);
      addToast("error", "Could not generate local guide. Loaded neighborhood fallback.");
      setCurrentPlan({
        ...SAMPLE_HOMETOWN_PLAN,
        destinationOrTown: prefs.location,
        title: `Local Explorer: ${prefs.occasion} in ${prefs.location}`,
      });
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
  const handleSwapActivity = async (activity: ActivitySpot, dayNumber: number) => {
    try {
      const res = await fetch("/api/swap-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationOrTown: currentPlan.destinationOrTown,
          mode: currentPlan.mode,
          dayNumber,
          timeSlot: activity.time,
          currentActivityName: activity.name,
          category: activity.category,
          vibes: currentPlan.tags || [],
          budgetTier: currentPlan.budgetTier,
          excludedPlaces: [
            ...getRecentExcludedPlaces(currentPlan.destinationOrTown),
            ...getPermanentSkipNames(),
          ],
          userSpots: getMySpots(),
          tasteProfile: getTasteProfile() || undefined,
        }),
      });

      if (!res.ok) throw new Error("Swap request failed");
      const newSpot: ActivitySpot = await res.json();

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

      addToast("success", `Replaced "${activity.name}" with "${newSpot.name}"!`);
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
  };

  // Save Trip Toggle Handler
  const handleSaveTrip = () => {
    saveTrip(currentPlan);
    const updated = getSavedTrips();
    setSavedTrips(updated);
    addToast("success", `Saved "${currentPlan.title}" to My Trips for offline access!`);
  };

  // Delete Saved Trip Handler
  const handleDeleteTrip = (id: string) => {
    deleteSavedTrip(id);
    setSavedTrips(getSavedTrips());
    addToast("info", "Removed trip from saved collection.");
  };

  // Load Saved Trip Handler
  const handleSelectSavedTrip = (trip: ItineraryPlan) => {
    setCurrentPlan(trip);
    setActiveMode(trip.mode);
    addToast("info", `Opened saved itinerary: "${trip.title}"`);
  };

  const isCurrentSaved = isTripSaved(currentPlan.id);

  return (
    <div className="min-h-screen bg-[#f5f5f0] flex flex-col selection:bg-[#5A5A40] selection:text-white font-sans text-[#2c2c24]">
      {/* Top Sticky Navigation */}
      <Navbar
        activeMode={activeMode}
        onModeChange={(mode) => {
          setActiveMode(mode);
          if (mode === "vacation" && currentPlan.mode !== "vacation") {
            setCurrentPlan(SAMPLE_VACATION_PLAN);
          } else if (mode === "hometown" && currentPlan.mode !== "hometown") {
            setCurrentPlan(SAMPLE_HOMETOWN_PLAN);
          }
        }}
        savedTripsCount={savedTrips.length}
        onOpenSavedTrips={() => setIsSavedDrawerOpen(true)}
        historyCount={historyCount}
        onOpenHistory={() => setIsHistoryModalOpen(true)}
        onOpenMySpots={() => setIsMySpotsOpen(true)}
        mySpotsCount={mySpotsCount}
        onOpenTasteProfile={() => setIsTasteProfileOpen(true)}
        hasTasteProfile={hasTasteProfile}
        onOpenExport={() => setIsExportModalOpen(true)}
        hasActiveTrip={!!currentPlan}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
        {/* Top Preference Form Section */}
        <section className="no-print">
          {activeMode === "vacation" ? (
            <VacationForm onSubmit={handleVacationSubmit} isLoading={isLoading} />
          ) : (
            <HometownForm
              onSubmit={handleGenerateHometown}
              isLoading={isLoading}
              onOpenHistory={() => setIsHistoryModalOpen(true)}
            />
          )}
        </section>

        {/* Results / Active Itinerary Section */}
        <section id="itinerary-results-section" className="scroll-mt-20">
          <ItineraryDisplay
            plan={currentPlan}
            isSaved={isCurrentSaved}
            onSaveTrip={handleSaveTrip}
            onOpenExport={() => setIsExportModalOpen(true)}
            onSwapActivity={handleSwapActivity}
            onUpdatePlan={handleUpdatePlan}
            onSkipPermanently={handleSkipPermanently}
          />
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#e5e5df] py-8 text-center text-xs text-[#8a8a7e] no-print mt-14">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2.5">
            <Compass className="w-4 h-4 text-[#5A5A40]" />
            <span className="font-serif italic font-medium text-sm text-[#2c2c24]">LocalExplorer AI</span>
            <span>— Cross-Platform Trip Planner & Cultural Guide</span>
          </div>
          <div className="flex items-center space-x-4 text-[#8a8a7e] font-serif italic text-xs">
            <span>Powered by Gemini & OpenStreetMap</span>
            <span>•</span>
            <button onClick={() => setIsHistoryModalOpen(true)} className="hover:text-[#2c2c24] underline transition-colors">
              30-Day History ({historyCount})
            </button>
            <span>•</span>
            <button onClick={() => setIsSavedDrawerOpen(true)} className="hover:text-[#2c2c24] underline transition-colors">
              Saved Journeys ({savedTrips.length})
            </button>
          </div>
        </div>
      </footer>

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

      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
}
