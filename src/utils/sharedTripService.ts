import { doc, getDoc, setDoc, onSnapshot, updateDoc, collection, getDocs } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { sanitizeForFirestore } from "./sanitizeFirestore";
import {
  ItineraryPlan,
  GroupCollaborationState,
  GroupMemberProfile,
  SharedTripDoc,
  UserTripPermissions,
  MemberRole,
  TravelBookingPass,
} from "../types";
import { getCollaborationState, saveCollaborationState } from "./collaboration";
import { notifyLocalDataChanged, getSavedTrips, saveTrip } from "./storage";
import { getTripWalletPasses, saveTripWalletPasses } from "./travelWallet";

export const SHARED_TRIPS_COLLECTION = "shared_trips";

/**
 * Derives user permissions for a specific trip and active email.
 */
export function getUserPermissions(
  plan: ItineraryPlan | null,
  collabState?: GroupCollaborationState | null,
  userEmail?: string | null
): UserTripPermissions {
  const cleanEmail = (userEmail || "").trim().toLowerCase();

  // If no plan, return default viewer
  if (!plan) {
    return {
      role: "viewer",
      memberName: null,
      isOrganizer: false,
      isContributor: false,
      canEdit: false,
      isViewer: true,
      isClaimed: false,
    };
  }

  const effectiveCollab = collabState || getCollaborationState(plan.id);
  const profiles = effectiveCollab.memberProfiles || [];

  // Check if this Google account has claimed a member slot
  const claimedProfile = cleanEmail
    ? profiles.find(
        (p) => p.claimedByEmail && p.claimedByEmail.toLowerCase() === cleanEmail
      )
    : null;

  if (claimedProfile) {
    const isOrganizer = claimedProfile.role === "organizer";
    const isContributor = claimedProfile.role === "editor";
    return {
      role: claimedProfile.role,
      memberName: claimedProfile.name,
      memberProfile: claimedProfile,
      isOrganizer,
      isContributor,
      canEdit: isOrganizer || isContributor,
      isViewer: claimedProfile.role === "viewer",
      isClaimed: true,
    };
  }

  // If this user created the trip and nobody is claimed yet, they are default Organizer
  const isTripCreator =
    cleanEmail &&
    (plan.creatorEmail?.toLowerCase() === cleanEmail ||
      (profiles.length > 0 &&
        profiles[0].role === "organizer" &&
        !profiles.some((p) => p.claimedByEmail)));

  if (isTripCreator) {
    const organizerProfile = profiles.find((p) => p.role === "organizer") || profiles[0];
    return {
      role: "organizer",
      memberName: organizerProfile ? organizerProfile.name : "Organizer",
      memberProfile: organizerProfile,
      isOrganizer: true,
      isContributor: false,
      canEdit: true,
      isViewer: false,
      isClaimed: false, // Flag that they need to claim or auto-claim
    };
  }

  // Unidentified/Unclaimed visitor: Viewer mode until they identify as a group member
  return {
    role: "viewer",
    memberName: null,
    memberProfile: null,
    isOrganizer: false,
    isContributor: false,
    canEdit: false,
    isViewer: true,
    isClaimed: false,
  };
}

/**
 * Fetch a shared trip from Firestore once
 */
export async function getSharedTrip(tripId: string): Promise<SharedTripDoc | null> {
  if (!tripId) return null;
  try {
    const docRef = doc(db, SHARED_TRIPS_COLLECTION, tripId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as SharedTripDoc;
    }
    return null;
  } catch (err) {
    console.error("Failed to get shared trip from Firestore:", err);
    return null;
  }
}

/**
 * Listen to real-time updates for a shared trip
 */
export function subscribeToSharedTrip(
  tripId: string,
  onUpdate: (data: SharedTripDoc | null) => void,
  onError?: (err: any) => void
): () => void {
  if (!tripId) return () => {};

  const docRef = doc(db, SHARED_TRIPS_COLLECTION, tripId);
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as SharedTripDoc;
        if (data.walletPasses && Array.isArray(data.walletPasses)) {
          saveTripWalletPasses(data.id, data.walletPasses);
        }
        onUpdate(data);
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      console.error(`Error in shared trip subscription [${tripId}]:`, err);
      if (onError) onError(err);
    }
  );
}

// Debounce map for publishing updates to prevent rapid write bursts
const publishDebounceTimers = new Map<string, any>();

/**
 * Publish / Save trip changes to Firestore in real-time
 */
export async function publishSharedTripUpdate(
  plan: ItineraryPlan,
  collabState?: GroupCollaborationState,
  offlineNotes?: string,
  userEmail?: string,
  userName?: string,
  walletPasses?: TravelBookingPass[]
): Promise<void> {
  if (!plan || !plan.id) return;

  // Persist locally immediately
  const effectiveCollab =
    collabState ||
    getCollaborationState(
      plan.id,
      plan.destinationOrTown,
      plan.totalDays,
      plan.tags
    );

  if (!effectiveCollab.memberProfiles || effectiveCollab.memberProfiles.length === 0) {
    effectiveCollab.memberProfiles = effectiveCollab.members.map((m, idx) => ({
      id: `m-${idx}-${m.toLowerCase().replace(/\s+/g, "_")}`,
      name: m,
      role: idx === 0 ? "organizer" : "editor",
      joinedAt: Date.now(),
    }));
  }

  saveCollaborationState(effectiveCollab);
  notifyLocalDataChanged();

  // Clear existing debounce timer for this trip if pending
  if (publishDebounceTimers.has(plan.id)) {
    clearTimeout(publishDebounceTimers.get(plan.id));
  }

  // Debounce cloud write by 300ms
  publishDebounceTimers.set(
    plan.id,
    setTimeout(async () => {
      publishDebounceTimers.delete(plan.id);
      try {
        const docRef = doc(db, SHARED_TRIPS_COLLECTION, plan.id);
        const cleanEmail = (userEmail || plan.creatorEmail || "traveler@localexplorer.ai").toLowerCase();
        const currentWalletPasses = walletPasses || getTripWalletPasses(plan.id);

        const payload: SharedTripDoc = {
          id: plan.id,
          creatorEmail: plan.creatorEmail || cleanEmail,
          creatorUid: auth.currentUser?.uid || undefined,
          creatorName: userName || plan.creatorEmail || "Trip Organizer",
          plan,
          collabState: effectiveCollab,
          offlineNotes: offlineNotes || "",
          walletPasses: currentWalletPasses,
          lastUpdated: Date.now(),
          updatedByEmail: cleanEmail,
        };

        await setDoc(docRef, sanitizeForFirestore(payload), { merge: true });
      } catch (err) {
        console.warn("Failed to publish shared trip update to cloud:", err);
      }
    }, 300)
  );
}

/**
 * Claim a Member Identity for a Google Account
 */
export async function claimMemberIdentity(
  tripId: string,
  memberName: string,
  userEmail: string,
  userDisplayName?: string
): Promise<{ success: boolean; message?: string; updatedCollab?: GroupCollaborationState }> {
  const cleanEmail = userEmail.trim().toLowerCase();
  const cleanMemberName = memberName.trim();

  if (!cleanEmail) {
    return { success: false, message: "Please sign in with a Google account to identify as a member." };
  }

  try {
    const docRef = doc(db, SHARED_TRIPS_COLLECTION, tripId);
    const snap = await getDoc(docRef);

    let collab: GroupCollaborationState;
    let plan: ItineraryPlan | null = null;
    let existingOfflineNotes = "";

    if (snap.exists()) {
      const data = snap.data() as SharedTripDoc;
      collab = data.collabState;
      plan = data.plan;
      existingOfflineNotes = data.offlineNotes || "";
    } else {
      collab = getCollaborationState(tripId);
    }

    if (!collab.memberProfiles) {
      collab.memberProfiles = collab.members.map((m, idx) => ({
        id: `m-${idx}-${m.toLowerCase().replace(/\s+/g, "_")}`,
        name: m,
        role: idx === 0 ? "organizer" : "editor",
        joinedAt: Date.now(),
      }));
    }

    const targetProfile = collab.memberProfiles.find(
      (p) => p.name.toLowerCase() === cleanMemberName.toLowerCase()
    );

    if (!targetProfile) {
      return { success: false, message: `Member "${cleanMemberName}" not found in trip roster.` };
    }

    // Check if this member is already claimed by someone else
    if (
      targetProfile.claimedByEmail &&
      targetProfile.claimedByEmail.toLowerCase() !== cleanEmail
    ) {
      return {
        success: false,
        message: `Member "${targetProfile.name}" is already identified by ${targetProfile.claimedByEmail}. Please select your own name or ask the organizer.`,
      };
    }

    // Unclaim any previously claimed member by this same email in this trip
    collab.memberProfiles = collab.memberProfiles.map((p) => {
      if (p.claimedByEmail && p.claimedByEmail.toLowerCase() === cleanEmail) {
        return {
          ...p,
          claimedByEmail: undefined,
          claimedByName: undefined,
          claimedAt: undefined,
        };
      }
      return p;
    });

    // Claim the targeted member
    collab.memberProfiles = collab.memberProfiles.map((p) => {
      if (p.name.toLowerCase() === cleanMemberName.toLowerCase()) {
        return {
          ...p,
          claimedByEmail: cleanEmail,
          claimedByName: userDisplayName || cleanEmail.split("@")[0],
          claimedAt: Date.now(),
        };
      }
      return p;
    });

    collab.currentUser = targetProfile.name;
    collab.lastUpdated = Date.now();

    // Save to Firestore
    if (snap.exists()) {
      await updateDoc(docRef, {
        collabState: collab,
        lastUpdated: Date.now(),
        updatedByEmail: cleanEmail,
      });
    } else if (plan) {
      await setDoc(docRef, {
        id: tripId,
        creatorEmail: cleanEmail,
        plan,
        collabState: collab,
        offlineNotes: existingOfflineNotes,
        lastUpdated: Date.now(),
        updatedByEmail: cleanEmail,
      });
    }

    // Save locally
    saveCollaborationState(collab);
    try {
      localStorage.setItem("localexplorer_collab_current_user", targetProfile.name);
    } catch {}

    notifyLocalDataChanged();
    window.dispatchEvent(new CustomEvent("localexplorer_cloud_sync_updated"));

    return {
      success: true,
      message: `Identified as ${targetProfile.name} (${targetProfile.role === "organizer" ? "👑 Organizer" : targetProfile.role === "viewer" ? "👁️ Viewer" : "✏️ Contributor"})`,
      updatedCollab: collab,
    };
  } catch (err: any) {
    console.error("Failed to claim member identity:", err);
    return { success: false, message: err.message || "Failed to identify member." };
  }
}

/**
 * Break/Unlink member claim (Organizer only)
 */
export async function unlinkMemberIdentity(
  tripId: string,
  memberName: string,
  requesterEmail: string
): Promise<{ success: boolean; message?: string; updatedCollab?: GroupCollaborationState }> {
  try {
    const docRef = doc(db, SHARED_TRIPS_COLLECTION, tripId);
    const snap = await getDoc(docRef);

    let collab = snap.exists() ? (snap.data().collabState as GroupCollaborationState) : getCollaborationState(tripId);

    if (!collab.memberProfiles) return { success: false, message: "No member profiles found." };

    collab.memberProfiles = collab.memberProfiles.map((p) => {
      if (p.name.toLowerCase() === memberName.toLowerCase()) {
        return {
          ...p,
          claimedByEmail: undefined,
          claimedByName: undefined,
          claimedAt: undefined,
        };
      }
      return p;
    });

    collab.lastUpdated = Date.now();

    if (snap.exists()) {
      await updateDoc(docRef, {
        collabState: collab,
        lastUpdated: Date.now(),
        updatedByEmail: requesterEmail,
      });
    }

    saveCollaborationState(collab);
    notifyLocalDataChanged();
    window.dispatchEvent(new CustomEvent("localexplorer_cloud_sync_updated"));

    return { success: true, updatedCollab: collab };
  } catch (err: any) {
    console.error("Failed to unlink member:", err);
    return { success: false, message: err.message || "Failed to unlink member." };
  }
}

/**
 * Change member access role (Organizer only)
 */
export async function updateMemberRoleInTrip(
  tripId: string,
  memberName: string,
  newRole: MemberRole,
  requesterEmail: string
): Promise<{ success: boolean; message?: string; updatedCollab?: GroupCollaborationState }> {
  try {
    const docRef = doc(db, SHARED_TRIPS_COLLECTION, tripId);
    const snap = await getDoc(docRef);

    let collab = snap.exists() ? (snap.data().collabState as GroupCollaborationState) : getCollaborationState(tripId);

    if (!collab.memberProfiles) return { success: false, message: "No member profiles found." };

    collab.memberProfiles = collab.memberProfiles.map((p) => {
      if (p.name.toLowerCase() === memberName.toLowerCase()) {
        return {
          ...p,
          role: newRole,
        };
      }
      return p;
    });

    collab.lastUpdated = Date.now();

    if (snap.exists()) {
      await updateDoc(docRef, {
        collabState: collab,
        lastUpdated: Date.now(),
        updatedByEmail: requesterEmail,
      });
    }

    saveCollaborationState(collab);
    notifyLocalDataChanged();
    window.dispatchEvent(new CustomEvent("localexplorer_cloud_sync_updated"));

    return { success: true, updatedCollab: collab };
  } catch (err: any) {
    console.error("Failed to update member role:", err);
    return { success: false, message: err.message || "Failed to update role." };
  }
}

/**
 * Assign a specific Google account email to a member (Organizer only)
 */
export async function assignMemberAccountEmail(
  tripId: string,
  memberName: string,
  targetEmail: string,
  requesterEmail: string
): Promise<{ success: boolean; message?: string; updatedCollab?: GroupCollaborationState }> {
  const cleanTargetEmail = targetEmail.trim().toLowerCase();
  try {
    const docRef = doc(db, SHARED_TRIPS_COLLECTION, tripId);
    const snap = await getDoc(docRef);

    let collab = snap.exists() ? (snap.data().collabState as GroupCollaborationState) : getCollaborationState(tripId);

    if (!collab.memberProfiles) return { success: false, message: "No member profiles found." };

    // Clear previous assignment of this email if any
    collab.memberProfiles = collab.memberProfiles.map((p) => {
      if (cleanTargetEmail && p.claimedByEmail && p.claimedByEmail.toLowerCase() === cleanTargetEmail) {
        return {
          ...p,
          claimedByEmail: undefined,
          claimedByName: undefined,
          claimedAt: undefined,
        };
      }
      return p;
    });

    // Assign to the selected member
    collab.memberProfiles = collab.memberProfiles.map((p) => {
      if (p.name.toLowerCase() === memberName.toLowerCase()) {
        return {
          ...p,
          claimedByEmail: cleanTargetEmail || undefined,
          claimedByName: cleanTargetEmail ? cleanTargetEmail.split("@")[0] : undefined,
          claimedAt: cleanTargetEmail ? Date.now() : undefined,
        };
      }
      return p;
    });

    collab.lastUpdated = Date.now();

    if (snap.exists()) {
      await updateDoc(docRef, {
        collabState: collab,
        lastUpdated: Date.now(),
        updatedByEmail: requesterEmail,
      });
    }

    saveCollaborationState(collab);
    notifyLocalDataChanged();
    window.dispatchEvent(new CustomEvent("localexplorer_cloud_sync_updated"));

    return { success: true, updatedCollab: collab };
  } catch (err: any) {
    console.error("Failed to assign account email to member:", err);
    return { success: false, message: err.message || "Failed to assign account." };
  }
}

/**
 * Update visibility settings for a trip
 */
export async function updateTripVisibility(
  tripId: string,
  visibility: "private" | "public" | "passcode",
  passcode?: string,
  userEmail?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const docRef = doc(db, SHARED_TRIPS_COLLECTION, tripId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return { success: false, message: "Trip not found on server." };
    }

    const data = snap.data() as SharedTripDoc;
    const cleanEmail = (userEmail || "").trim().toLowerCase();

    // Verification check: Only organizer/creator can change visibility
    const isCreator = cleanEmail && data.creatorEmail?.toLowerCase() === cleanEmail;
    const collab = data.collabState;
    const profiles = collab?.memberProfiles || [];
    const targetProfile = cleanEmail ? profiles.find(p => p.claimedByEmail?.toLowerCase() === cleanEmail) : null;
    const isOrganizer = targetProfile?.role === "organizer";

    if (!isCreator && !isOrganizer) {
      return { success: false, message: "Only the Trip Organizer can change visibility settings." };
    }

    const isPublic = visibility === "public";

    await updateDoc(docRef, {
      visibility,
      isPublic,
      passcode: passcode || "",
      lastUpdated: Date.now(),
      updatedByEmail: cleanEmail || data.creatorEmail,
    });

    notifyLocalDataChanged();
    window.dispatchEvent(new CustomEvent("localexplorer_cloud_sync_updated"));

    return { success: true };
  } catch (err: any) {
    console.error("Failed to update trip visibility:", err);
    return { success: false, message: err.message || "Failed to update visibility settings." };
  }
}

/**
 * Submit a community review and rating for a trip
 */
export async function submitTripReview(
  tripId: string,
  author: string,
  email: string,
  rating: number,
  text: string
): Promise<{ success: boolean; message?: string; reviews?: SharedTripDoc["reviews"]; rating?: number }> {
  try {
    const docRef = doc(db, SHARED_TRIPS_COLLECTION, tripId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return { success: false, message: "Trip not found." };
    }

    const data = snap.data() as SharedTripDoc;
    const currentReviews = data.reviews || [];
    const cleanEmail = email.trim().toLowerCase();

    // Check if this email has already reviewed
    const existingIndex = currentReviews.findIndex(r => r.email.toLowerCase() === cleanEmail);
    const newReview = {
      id: existingIndex >= 0 ? currentReviews[existingIndex].id : `rev-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      author: author.trim() || "Anonymous Traveler",
      email: cleanEmail,
      rating: Math.max(1, Math.min(5, rating)),
      text: text.trim(),
      createdAt: Date.now(),
    };

    let updatedReviews = [...currentReviews];
    if (existingIndex >= 0) {
      updatedReviews[existingIndex] = newReview;
    } else {
      updatedReviews.push(newReview);
    }

    // Calculate new average rating
    const totalRating = updatedReviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = parseFloat((totalRating / updatedReviews.length).toFixed(1));

    await updateDoc(docRef, {
      reviews: updatedReviews,
      rating: averageRating,
      ratingsCount: updatedReviews.length,
      lastUpdated: Date.now(),
    });

    notifyLocalDataChanged();
    window.dispatchEvent(new CustomEvent("localexplorer_cloud_sync_updated"));

    return {
      success: true,
      reviews: updatedReviews,
      rating: averageRating,
    };
  } catch (err: any) {
    console.error("Failed to submit review:", err);
    return { success: false, message: err.message || "Failed to submit review." };
  }
}

/**
 * Increment downloads count when another traveler clones this itinerary
 */
export async function incrementTripDownloads(tripId: string): Promise<void> {
  try {
    const docRef = doc(db, SHARED_TRIPS_COLLECTION, tripId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as SharedTripDoc;
      const downloads = (data.downloadsCount || 0) + 1;
      await updateDoc(docRef, { downloadsCount: downloads });
    }
  } catch (err) {
    console.error("Failed to increment trip downloads:", err);
  }
}

/**
 * Update featured tags for a trip
 */
export async function updateTripFeaturedTags(
  tripId: string,
  tags: string[],
  userEmail?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const docRef = doc(db, SHARED_TRIPS_COLLECTION, tripId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return { success: false, message: "Trip not found." };
    }

    await updateDoc(docRef, {
      featuredTags: tags,
      lastUpdated: Date.now(),
    });

    notifyLocalDataChanged();
    window.dispatchEvent(new CustomEvent("localexplorer_cloud_sync_updated"));

    return { success: true };
  } catch (err: any) {
    console.error("Failed to update featured tags:", err);
    return { success: false, message: err.message || "Failed to update tags." };
  }
}

/**
 * Curated Showcase Community Itineraries
 */
export const CURATED_PUBLIC_TRIPS: SharedTripDoc[] = [
  {
    id: "showcase-san-sebastian-pintxo-trail",
    creatorEmail: "elena.vasco@localexplorer.ai",
    creatorName: "Elena Vasco",
    isPublic: true,
    visibility: "public",
    rating: 4.9,
    ratingsCount: 138,
    downloadsCount: 312,
    vibes: ["Gastronomy & Local Food", "Scenic & Outdoors", "Hidden Gems / Non-Touristy"],
    featuredTags: ["Pintxos & Gastronomy", "Coastal Walks", "Hidden Taverns", "Basque Country"],
    lastUpdated: Date.now() - 86400000 * 3,
    updatedByEmail: "elena.vasco@localexplorer.ai",
    collabState: getCollaborationState("showcase-san-sebastian-pintxo-trail", "San Sebastián, Spain", 3, ["Foodie", "Scenic"]),
    reviews: [
      {
        id: "rev-ss-1",
        author: "Marcus Chen",
        email: "marcus.chen@travel.com",
        rating: 5,
        text: "The bar crawl sequence through Parte Vieja was pure magic. Perfect timing on the tortilla at Bar Nestor!",
        createdAt: Date.now() - 86400000 * 2,
      },
    ],
    plan: {
      id: "showcase-san-sebastian-pintxo-trail",
      mode: "vacation",
      createdAt: "2026-05-10T10:00:00.000Z",
      mapCenter: { lat: 43.3228, lng: -1.9818 },
      mapZoom: 14,
      destinationOrTown: "San Sebastián, Spain",
      title: "San Sebastián: Pintxo Trail & Coastal Promenades",
      totalDays: 3,
      vibes: ["Gastronomy & Local Food", "Scenic & Outdoors", "Hidden Gems / Non-Touristy"],
      tags: ["Gastronomy", "Pintxos", "Coastal Promenades", "Scenic", "Hidden Gems"],
      customPace: "balanced",
      budgetTier: "mid-range",
      transportMode: "public_transit",
      summary: "An authentic culinary journey through Gipuzkoa's culinary capital, weaving through Old Town taverns, La Concha seaside strolls, and panoramic mountain batteries.",
      highlights: [
        "Hidden tavern crawl in historic Parte Vieja",
        "Sunset funicular ride to Monte Igueldo vintage amusement park",
        "Sculpture walk to Eduardo Chillida's Comb of the Wind",
      ],
      days: [
        {
          dayNumber: 1,
          dayTitle: "Day 1: Historic Parte Vieja & Traditional Pintxos",
          theme: "Gastronomic Heritage",
          summary: "Immerse in the historic cobblestone core and legendary tapas bars.",
          activities: [
            {
              id: "act-ss-1",
              time: "10:00 AM - 12:00 PM",
              name: "La Bretxa Market & Parte Vieja Walk",
              category: "culture",
              description: "Explore the bustling underground market stalls where Basque chefs source daily wild fish and vegetables, followed by a stroll past Plaza de la Constitución.",
              insiderTip: "Look for the numbered balconies in Plaza Mayor from historic bullfighting days.",
              approxCost: "Free",
              coordinates: { lat: 43.3228, lng: -1.9818 },
              durationMinutes: 120,
              photos: ["https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80"],
            },
            {
              id: "act-ss-2",
              time: "01:00 PM - 03:00 PM",
              name: "Bar Nestor & Gandarias Pintxo Route",
              category: "food",
              description: "Savor the legendary tomato salad and ribeye steak at Bar Nestor, followed by grilled wild mushrooms and Basque cider at Gandarias.",
              insiderTip: "Queue at 12:00 PM sharp to put your name down for the limited potato tortilla slice.",
              approxCost: "€25 - €40",
              coordinates: { lat: 43.3236, lng: -1.9842 },
              durationMinutes: 120,
              photos: ["https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80"],
            },
          ],
        },
      ],
    },
  },
  {
    id: "showcase-kyoto-zen-sanctuary",
    creatorEmail: "kenji.takahashi@localexplorer.ai",
    creatorName: "Kenji Takahashi",
    isPublic: true,
    visibility: "public",
    rating: 4.8,
    ratingsCount: 94,
    downloadsCount: 245,
    vibes: ["History & Architecture", "Relaxation & Wellness", "Art & Culture"],
    featuredTags: ["Zen Gardens", "Traditional Teahouses", "Arashiyama", "Historic Kyoto"],
    lastUpdated: Date.now() - 86400000 * 7,
    updatedByEmail: "kenji.takahashi@localexplorer.ai",
    collabState: getCollaborationState("showcase-kyoto-zen-sanctuary", "Kyoto, Japan", 4, ["Zen", "Temples"]),
    reviews: [
      {
        id: "rev-kyoto-1",
        author: "Sophie Laurent",
        email: "sophie.l@voyage.fr",
        rating: 5,
        text: "The Okochi Sanso Villa early in the morning was breathlessly serene. No crowds, pure zen.",
        createdAt: Date.now() - 86400000 * 4,
      },
    ],
    plan: {
      id: "showcase-kyoto-zen-sanctuary",
      mode: "vacation",
      createdAt: "2026-05-12T10:00:00.000Z",
      mapCenter: { lat: 35.0116, lng: 135.7681 },
      mapZoom: 13,
      destinationOrTown: "Kyoto, Japan",
      title: "Kyoto: Bamboo Groves & Ancient Zen Sanctuaries",
      totalDays: 4,
      vibes: ["History & Architecture", "Relaxation & Wellness", "Art & Culture"],
      tags: ["Zen Gardens", "Temples", "Matcha", "History & Architecture", "Culture"],
      customPace: "relaxed",
      budgetTier: "mid-range",
      transportMode: "public_transit",
      summary: "A contemplative route through Kyoto's quietest temple gardens, bamboo sanctuaries, and traditional Uji matcha pavilions.",
      highlights: [
        "Morning stroll through Okochi Sanso bamboo groves",
        "Daitoku-ji rock gardens and quiet sub-temple meditation",
        "Evening tea tasting along Gion Shirakawa canal",
      ],
      days: [
        {
          dayNumber: 1,
          dayTitle: "Day 1: Western Foothills & Arashiyama Seclusion",
          theme: "Nature & Zen Contemplation",
          summary: "Escape the tour buses by visiting western villa retreats and serene groves.",
          activities: [
            {
              id: "act-kyo-1",
              time: "09:00 AM - 11:00 AM",
              name: "Okochi Sanso Mountain Villa & Bamboo Sanctuary",
              category: "hidden-gem",
              description: "Wander through private moss paths, bamboo glades, and maple hills overlooking Hozu river gorge.",
              insiderTip: "Present your entry ticket at the open-air tea pavilion for hot whisked matcha and a sweet bean confectionery.",
              approxCost: "¥1,000 (~$7)",
              coordinates: { lat: 35.0179, lng: 135.6685 },
              durationMinutes: 120,
              photos: ["https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80"],
            },
          ],
        },
      ],
    },
  },
  {
    id: "showcase-rome-renaissance-piazzas",
    creatorEmail: "matteo.rossi@localexplorer.ai",
    creatorName: "Matteo Rossi",
    isPublic: true,
    visibility: "public",
    rating: 4.9,
    ratingsCount: 112,
    downloadsCount: 198,
    vibes: ["History & Architecture", "Art & Culture", "Gastronomy & Local Food"],
    featuredTags: ["Ancient Rome", "Renaissance Art", "Trastevere Eateries", "Baroque Piazzas"],
    lastUpdated: Date.now() - 86400000 * 5,
    updatedByEmail: "matteo.rossi@localexplorer.ai",
    collabState: getCollaborationState("showcase-rome-renaissance-piazzas", "Rome, Italy", 3, ["History", "Art"]),
    reviews: [
      {
        id: "rev-rome-1",
        author: "Carla Gomez",
        email: "carla.g@explora.es",
        rating: 5,
        text: "The twilight walk past Pantheon and Piazza Navona gelato stop was unforgettable!",
        createdAt: Date.now() - 86400000 * 3,
      },
    ],
    plan: {
      id: "showcase-rome-renaissance-piazzas",
      mode: "vacation",
      createdAt: "2026-05-15T10:00:00.000Z",
      mapCenter: { lat: 41.8902, lng: 12.4922 },
      mapZoom: 14,
      destinationOrTown: "Rome, Italy",
      title: "Rome: Imperial Monuments & Hidden Trastevere Taverns",
      totalDays: 3,
      vibes: ["History & Architecture", "Art & Culture", "Gastronomy & Local Food"],
      tags: ["Ancient Rome", "Renaissance Art", "Trastevere", "History & Architecture"],
      customPace: "action-packed",
      budgetTier: "mid-range",
      transportMode: "public_transit",
      summary: "Explore the eternal city's underground crypts, imperial forums, baroque fountains, and family-run trattorias.",
      highlights: [
        "Sunrise photography at the Roman Colosseum and Forum",
        "Secret Caravaggio paintings hidden in neighborhood churches",
        "Evening carbonara and suppli tasting in Trastevere alleys",
      ],
      days: [
        {
          dayNumber: 1,
          dayTitle: "Day 1: Imperial Core & Historic Center",
          theme: "Ancient Architecture & Classical Sculpture",
          summary: "Marvel at ancient engineering marvels and Renaissance marble masterpieces.",
          activities: [
            {
              id: "act-rome-1",
              time: "09:00 AM - 11:30 AM",
              name: "Colosseum & Imperial Roman Forum",
              category: "sightseeing",
              description: "Walk the arena floor and forum ruins where gladiators fought and Roman senators debated.",
              insiderTip: "Enter through the Stern gate for faster access with pre-booked timed slot.",
              approxCost: "€18",
              coordinates: { lat: 41.8902, lng: 12.4922 },
              durationMinutes: 150,
              photos: ["https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=800&q=80"],
            },
          ],
        },
      ],
    },
  },
  {
    id: "showcase-mallorca-coves-sailing",
    creatorEmail: "maria.soler@localexplorer.ai",
    creatorName: "Maria Soler",
    isPublic: true,
    visibility: "public",
    rating: 4.95,
    ratingsCount: 88,
    downloadsCount: 175,
    vibes: ["Beaches & Swim Spots", "Relaxation & Wellness", "Scenic & Outdoors"],
    featuredTags: ["Turquoise Calas", "Sunset Sailing", "Tramuntana Cliffs", "Balearic Coast"],
    lastUpdated: Date.now() - 86400000 * 6,
    updatedByEmail: "maria.soler@localexplorer.ai",
    collabState: getCollaborationState("showcase-mallorca-coves-sailing", "Mallorca, Spain", 4, ["Beaches", "Coast"]),
    reviews: [
      {
        id: "rev-mal-1",
        author: "Lucas Müller",
        email: "lucas.m@reisen.de",
        rating: 5,
        text: "Cala Deia at sunset with fresh grilled dorada was the highlight of our entire summer.",
        createdAt: Date.now() - 86400000 * 5,
      },
    ],
    plan: {
      id: "showcase-mallorca-coves-sailing",
      mode: "vacation",
      createdAt: "2026-05-18T10:00:00.000Z",
      mapCenter: { lat: 39.6953, lng: 3.0176 },
      mapZoom: 11,
      destinationOrTown: "Mallorca, Spain",
      title: "Mallorca: Secret Turquoise Calas & Sunset Sailing",
      totalDays: 4,
      vibes: ["Beaches & Swim Spots", "Relaxation & Wellness", "Scenic & Outdoors"],
      tags: ["Beaches & Swim Spots", "Calas", "Sailing", "Relaxation & Wellness"],
      customPace: "relaxed",
      budgetTier: "luxury",
      transportMode: "car",
      summary: "Crystal-clear turquoise waters, secluded cliffside swimming coves, olive grove stone villages, and coastal catamaran journeys.",
      highlights: [
        "Hidden swim at Cala Llombards and sea cave snorkeling",
        "Sunset dinner perched above the waves at Cala Deià",
        "Scenic coastal drive along Serra de Tramuntana UNESCO cliffs",
      ],
      days: [
        {
          dayNumber: 1,
          dayTitle: "Day 1: Secluded Southeastern Calas",
          theme: "Turquoise Waters & Coastal Relaxation",
          summary: "Start with morning swimming in emerald bays before crowds arrive.",
          activities: [
            {
              id: "act-mal-1",
              time: "09:30 AM - 12:30 PM",
              name: "Cala Llombards Natural Cove & Fishermen Huts",
              category: "nature",
              description: "Swim in tranquil crystal waters enclosed by pine cliffs with traditional boat houses carved into stone.",
              insiderTip: "Walk 10 minutes along the south path to reach the dramatic Es Pontàs rock arch.",
              approxCost: "Free",
              coordinates: { lat: 39.3248, lng: 3.1368 },
              durationMinutes: 180,
              photos: ["https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80"],
            },
          ],
        },
      ],
    },
  },
  {
    id: "showcase-berlin-underground-vibes",
    creatorEmail: "felix.neumann@localexplorer.ai",
    creatorName: "Felix Neumann",
    isPublic: true,
    visibility: "public",
    rating: 4.85,
    ratingsCount: 76,
    downloadsCount: 160,
    vibes: ["Nightlife & Bars", "Shopping & Local Boutiques", "Hidden Gems / Non-Touristy", "Budget Friendly"],
    featuredTags: ["Underground Clubs", "Vintage Boutiques", "Kreuzberg Street Art", "Craft Beer"],
    lastUpdated: Date.now() - 86400000 * 8,
    updatedByEmail: "felix.neumann@localexplorer.ai",
    collabState: getCollaborationState("showcase-berlin-underground-vibes", "Berlin, Germany", 3, ["Nightlife", "Shopping"]),
    reviews: [
      {
        id: "rev-ber-1",
        author: "Emma Watson",
        email: "emma.w@creative.uk",
        rating: 5,
        text: "The vintage boutique trail in Neukölln found me incredible handmade clothing and record stores.",
        createdAt: Date.now() - 86400000 * 6,
      },
    ],
    plan: {
      id: "showcase-berlin-underground-vibes",
      mode: "vacation",
      createdAt: "2026-05-20T10:00:00.000Z",
      mapCenter: { lat: 52.52, lng: 13.405 },
      mapZoom: 13,
      destinationOrTown: "Berlin, Germany",
      title: "Berlin: Underground Art, Nightlife & Vintage Boutiques",
      totalDays: 3,
      vibes: ["Nightlife & Bars", "Shopping & Local Boutiques", "Hidden Gems / Non-Touristy", "Budget Friendly"],
      tags: ["Nightlife & Bars", "Vintage Boutiques", "Street Art", "Budget Friendly"],
      customPace: "action-packed",
      budgetTier: "budget",
      transportMode: "bicycle",
      summary: "Dive deep into Kreuzberg canal vinyl bars, Neukölln curated vintage lofts, RAW-Gelände murals, and legendary electronic music clubs.",
      highlights: [
        "Curated vintage shopping in Weserstraße design lofts",
        "Spree canal sunset drinks and open-air riverside clubbing",
        "Hidden street art tours through former industrial railway yards",
      ],
      days: [
        {
          dayNumber: 1,
          dayTitle: "Day 1: Kreuzberg Canals & RAW Culture",
          theme: "Street Art, Indie Coffee & Nightlife",
          summary: "Pedal along Landwehrkanal to alternative art galleries and rooftop craft breweries.",
          activities: [
            {
              id: "act-ber-1",
              time: "02:00 PM - 05:00 PM",
              name: "RAW-Gelände Art Yards & Urban Spree",
              category: "culture",
              description: "Explore graffiti murals, skate halls, artist workshops, and open-air biergartens in historic train maintenance halls.",
              insiderTip: "Visit on weekend afternoons for the local flea market and live street performances.",
              approxCost: "Free entry (€5 drinks)",
              coordinates: { lat: 52.5074, lng: 13.4542 },
              durationMinutes: 180,
              photos: ["https://images.unsplash.com/photo-1560969184-10fe8719e047?auto=format&fit=crop&w=800&q=80"],
            },
          ],
        },
      ],
    },
  },
];

/**
 * Fetch all public itineraries for Explore Feed (Firestore + Local Published + Curated)
 */
export async function fetchAllPublicTrips(): Promise<SharedTripDoc[]> {
  const tripMap = new Map<string, SharedTripDoc>();

  // 1. Add curated showcase trips first
  CURATED_PUBLIC_TRIPS.forEach((ct) => {
    tripMap.set(ct.id, ct);
  });

  // 2. Fetch from Firestore shared_trips
  try {
    const colRef = collection(db, SHARED_TRIPS_COLLECTION);
    const snap = await getDocs(colRef);
    snap.forEach((d) => {
      const data = d.data() as SharedTripDoc;
      if (data && (data.isPublic === true || data.visibility === "public")) {
        tripMap.set(data.id || d.id, {
          ...data,
          id: data.id || d.id,
          isPublic: true,
          visibility: "public",
        });
      }
    });
  } catch (err) {
    console.warn("Firestore public trips query failed, checking local published trips:", err);
  }

  // 3. Merge locally published trips (saved in localStorage)
  try {
    const savedTrips = getSavedTrips();
    savedTrips.forEach((trip) => {
      const isLocallyMarkedPublic =
        localStorage.getItem(`localexplorer_published_${trip.id}`) === "true" ||
        trip.isPublic === true ||
        trip.visibility === "public";

      if (isLocallyMarkedPublic) {
        const existing = tripMap.get(trip.id);
        const mergedDoc: SharedTripDoc = {
          id: trip.id,
          creatorEmail: trip.authorEmail || existing?.creatorEmail || "me@traveler.com",
          creatorName: trip.authorName || existing?.creatorName || "Local Explorer",
          plan: trip,
          collabState:
            existing?.collabState ||
            getCollaborationState(trip.id, trip.destinationOrTown, trip.totalDays, trip.tags),
          isPublic: true,
          visibility: "public",
          rating: existing?.rating || 5.0,
          ratingsCount: existing?.ratingsCount || 1,
          downloadsCount: existing?.downloadsCount || 0,
          reviews: existing?.reviews || [],
          featuredTags: trip.tags || existing?.featuredTags || [],
          lastUpdated: typeof trip.createdAt === "number" ? trip.createdAt : Date.now(),
        };
        tripMap.set(trip.id, mergedDoc);
      }
    });
  } catch (err) {
    console.warn("Error merging local published trips:", err);
  }

  const list = Array.from(tripMap.values());
  // Sort: User/recent items first, high rating
  return list.sort((a, b) => {
    const timeA = a.lastUpdated || 0;
    const timeB = b.lastUpdated || 0;
    return timeB - timeA;
  });
}

/**
 * Publish an Itinerary directly to the Community Explore Feed
 */
export async function publishItineraryToExplore(
  plan: ItineraryPlan,
  userEmail: string,
  userName?: string,
  options?: {
    customTitle?: string;
    description?: string;
    featuredTags?: string[];
    vibes?: string[];
  }
): Promise<{ success: boolean; message?: string }> {
  if (!plan || !plan.id) {
    return { success: false, message: "Invalid itinerary plan." };
  }

  const cleanEmail = userEmail.trim().toLowerCase();
  const effectiveVibes = options?.vibes && options.vibes.length > 0 ? options.vibes : (plan.vibes || plan.selectedVibes || []);
  const effectivePlan: ItineraryPlan = {
    ...plan,
    title: options?.customTitle?.trim() || plan.title,
    summary: options?.description?.trim() || plan.summary,
    tags: options?.featuredTags && options.featuredTags.length > 0 ? options.featuredTags : plan.tags,
    vibes: effectiveVibes,
    isPublic: true,
    visibility: "public",
    authorEmail: cleanEmail,
    authorName: userName || cleanEmail.split("@")[0] || "Traveler",
  };

  try {
    // 1. Update localStorage flag and saved trips immediately
    try {
      localStorage.setItem(`localexplorer_published_${plan.id}`, "true");
      saveTrip(effectivePlan);
    } catch {}

    // 2. Persist to Firestore
    const docRef = doc(db, SHARED_TRIPS_COLLECTION, plan.id);
    const snap = await getDoc(docRef);

    const existingData = snap.exists() ? (snap.data() as SharedTripDoc) : null;
    const effectiveCollab =
      existingData?.collabState ||
      getCollaborationState(plan.id, plan.destinationOrTown, plan.totalDays, plan.tags);

    const payload: SharedTripDoc = {
      id: plan.id,
      creatorEmail: cleanEmail,
      creatorUid: auth.currentUser?.uid || existingData?.creatorUid || undefined,
      creatorName: userName || cleanEmail.split("@")[0] || "Traveler",
      plan: effectivePlan,
      collabState: effectiveCollab,
      offlineNotes: existingData?.offlineNotes || "",
      walletPasses: existingData?.walletPasses || [],
      isPublic: true,
      visibility: "public",
      rating: existingData?.rating || 5.0,
      ratingsCount: existingData?.ratingsCount || 1,
      reviews: existingData?.reviews || [],
      downloadsCount: existingData?.downloadsCount || 0,
      featuredTags: options?.featuredTags || plan.tags || [],
      vibes: effectiveVibes,
      lastUpdated: Date.now(),
      updatedByEmail: cleanEmail,
    };

    await setDoc(docRef, sanitizeForFirestore(payload), { merge: true });

    notifyLocalDataChanged();
    window.dispatchEvent(new CustomEvent("localexplorer_cloud_sync_updated"));

    return { success: true };
  } catch (err: any) {
    console.error("Failed to publish itinerary to Explore:", err);
    // Still succeeded locally
    notifyLocalDataChanged();
    window.dispatchEvent(new CustomEvent("localexplorer_cloud_sync_updated"));
    return { success: true };
  }
}

/**
 * Unpublish an Itinerary from the Community Explore Feed
 */
export async function unpublishItineraryFromExplore(
  tripId: string,
  userEmail: string
): Promise<{ success: boolean; message?: string }> {
  const cleanEmail = userEmail.trim().toLowerCase();
  try {
    // Clear local published flag
    try {
      localStorage.removeItem(`localexplorer_published_${tripId}`);
      const saved = getSavedTrips();
      const target = saved.find((t) => t.id === tripId);
      if (target) {
        target.isPublic = false;
        target.visibility = "private";
        saveTrip(target);
      }
    } catch {}

    const docRef = doc(db, SHARED_TRIPS_COLLECTION, tripId);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data() as SharedTripDoc;
      if (data.creatorEmail?.toLowerCase() === cleanEmail) {
        await updateDoc(docRef, {
          isPublic: false,
          visibility: "private",
          lastUpdated: Date.now(),
          updatedByEmail: cleanEmail,
        });
      }
    }

    notifyLocalDataChanged();
    window.dispatchEvent(new CustomEvent("localexplorer_cloud_sync_updated"));

    return { success: true };
  } catch (err: any) {
    console.error("Failed to unpublish itinerary:", err);
    notifyLocalDataChanged();
    window.dispatchEvent(new CustomEvent("localexplorer_cloud_sync_updated"));
    return { success: true };
  }
}
