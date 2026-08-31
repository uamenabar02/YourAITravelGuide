import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { PublicUserProfile, SharedTripDoc, CommunitySpotDoc } from "../types";
import { SHARED_TRIPS_COLLECTION } from "./sharedTripService";
import { COMMUNITY_SPOTS_COLLECTION } from "./communitySpotService";

// Seed/Curated Community Creators
export const CURATED_CREATORS: PublicUserProfile[] = [
  {
    id: "user_elena_vasco_gmail_com",
    email: "elena.vasco@localexplorer.ai",
    name: "Elena Vasco",
    avatarPreset: "foodie",
    bio: "San Sebastián native & culinary journalist. Dedicated to secret pintxo bars, organic txakoli vineyards, and coastal cliff trails.",
    homeCity: "San Sebastián, Spain",
    travelStyle: "Culinary Explorer",
    websiteOrSocial: "instagram.com/elenavasco_eats",
    badges: ["Local Resident", "Top Gastronomy Guide", "Verified Explorer"],
    followers: ["uamenabar02@gmail.com", "kenji.takahashi@localexplorer.ai"],
    following: ["uamenabar02@gmail.com"],
    publishedTripsCount: 4,
    publishedSpotsCount: 12,
    joinedAt: Date.now() - 86400000 * 180,
  },
  {
    id: "user_kenji_takahashi_gmail_com",
    email: "kenji.takahashi@localexplorer.ai",
    name: "Kenji Takahashi",
    avatarPreset: "mountain",
    bio: "Architecture photographer and tea connoisseur living in Kyoto. Sharing tranquil temple walks, artisan pottery studios, and quiet gardens.",
    homeCity: "Kyoto, Japan",
    travelStyle: "Cultural Wanderer",
    websiteOrSocial: "kenjitakahashi.photo",
    badges: ["Heritage Master", "Zen Sanctuary Curator"],
    followers: ["uamenabar02@gmail.com", "sophie.laurent@localexplorer.ai"],
    following: ["elena.vasco@localexplorer.ai"],
    publishedTripsCount: 3,
    publishedSpotsCount: 8,
    joinedAt: Date.now() - 86400000 * 240,
  },
  {
    id: "user_sophie_laurent_gmail_com",
    email: "sophie.laurent@localexplorer.ai",
    name: "Sophie Laurent",
    avatarPreset: "coffee",
    bio: "Parisian art curator & flea market enthusiast. Passionate about hidden courtyard bistros, natural wine cellars, and indie bookshops.",
    homeCity: "Paris, France",
    travelStyle: "Art & Vintage Hunter",
    websiteOrSocial: "parisby-sophie.fr",
    badges: ["Paris Insider", "Wine & Dine Pro"],
    followers: ["elena.vasco@localexplorer.ai"],
    following: ["kenji.takahashi@localexplorer.ai", "uamenabar02@gmail.com"],
    publishedTripsCount: 5,
    publishedSpotsCount: 15,
    joinedAt: Date.now() - 86400000 * 300,
  },
  {
    id: "user_mateo_gomez_gmail_com",
    email: "mateo.gomez@localexplorer.ai",
    name: "Mateo Gomez",
    avatarPreset: "wave",
    bio: "Backpacker and eco-guide through Mexico & Central America. Specializing in off-grid petrified waterfalls, mezcal distilleries, and surf breaks.",
    homeCity: "Oaxaca, Mexico",
    travelStyle: "Wild Nature Backpacker",
    websiteOrSocial: "mateo-eco-routes.org",
    badges: ["Trail Pioneer", "Eco-Travel Ambassador"],
    followers: ["uamenabar02@gmail.com"],
    following: ["elena.vasco@localexplorer.ai"],
    publishedTripsCount: 2,
    publishedSpotsCount: 9,
    joinedAt: Date.now() - 86400000 * 90,
  },
  {
    id: "user_clara_moretti_gmail_com",
    email: "clara.moretti@localexplorer.ai",
    name: "Clara Moretti",
    avatarPreset: "compass",
    bio: "Architect & slow-travel writer based in Rome. Mapping tranquil piazzas, underground cisterns, and multi-generational trattorias.",
    homeCity: "Rome, Italy",
    travelStyle: "Slow Living & Heritage",
    websiteOrSocial: "claramoretti.it",
    badges: ["Historic Architecture Pro", "Slow Travel Advocate"],
    followers: ["sophie.laurent@localexplorer.ai", "uamenabar02@gmail.com"],
    following: ["kenji.takahashi@localexplorer.ai"],
    publishedTripsCount: 3,
    publishedSpotsCount: 11,
    joinedAt: Date.now() - 86400000 * 120,
  },
];

/**
 * Fetch all creators from Firestore and seed curated creators
 */
export async function fetchCommunityCreators(): Promise<PublicUserProfile[]> {
  try {
    const colRef = collection(db, "users");
    const snap = await getDocs(colRef);

    const creatorsMap = new Map<string, PublicUserProfile>();

    // Add curated seeds
    CURATED_CREATORS.forEach((c) => {
      creatorsMap.set(c.email.toLowerCase(), c);
    });

    snap.forEach((d) => {
      const data = d.data();
      if (data.email) {
        const cleanEmail = data.email.toLowerCase();
        const existing = creatorsMap.get(cleanEmail);
        creatorsMap.set(cleanEmail, {
          id: d.id,
          email: cleanEmail,
          name: data.name || (existing ? existing.name : "Traveler"),
          bio: data.bio || (existing ? existing.bio : ""),
          avatarUrl: data.avatarUrl || (existing ? existing.avatarUrl : ""),
          avatarPreset: data.avatarPreset || (existing ? existing.avatarPreset : "compass"),
          homeCity: data.homeCity || (existing ? existing.homeCity : ""),
          travelStyle: data.travelStyle || (existing ? existing.travelStyle : "Cultural Wanderer"),
          websiteOrSocial: data.websiteOrSocial || (existing ? existing.websiteOrSocial : ""),
          badges: data.badges || (existing ? existing.badges : ["Local Explorer"]),
          followers: data.followers || (existing ? existing.followers : []),
          following: data.following || (existing ? existing.following : []),
          publishedTripsCount: data.publishedTripsCount || (existing ? existing.publishedTripsCount : 0),
          publishedSpotsCount: data.publishedSpotsCount || (existing ? existing.publishedSpotsCount : 0),
          joinedAt: data.lastSynced || Date.now(),
        });
      }
    });

    return Array.from(creatorsMap.values());
  } catch (err) {
    console.warn("Using curated creators fallback:", err);
    return CURATED_CREATORS;
  }
}

/**
 * Get Public User Profile by email
 */
export async function getPublicUserProfile(email: string): Promise<PublicUserProfile | null> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return null;

  // Check curated seeds first
  const curated = CURATED_CREATORS.find((c) => c.email.toLowerCase() === cleanEmail);

  try {
    const canonicalId = "user_" + cleanEmail.replace(/[^a-z0-9]/g, "_");
    const docRef = doc(db, "users", canonicalId);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data();
      return {
        id: canonicalId,
        email: cleanEmail,
        name: data.name || (curated ? curated.name : "Traveler"),
        bio: data.bio || (curated ? curated.bio : ""),
        avatarUrl: data.avatarUrl || (curated ? curated.avatarUrl : ""),
        avatarPreset: data.avatarPreset || (curated ? curated.avatarPreset : "compass"),
        homeCity: data.homeCity || (curated ? curated.homeCity : ""),
        travelStyle: data.travelStyle || (curated ? curated.travelStyle : "Cultural Wanderer"),
        websiteOrSocial: data.websiteOrSocial || (curated ? curated.websiteOrSocial : ""),
        badges: data.badges || (curated ? curated.badges : ["Local Explorer"]),
        followers: data.followers || (curated ? curated.followers : []),
        following: data.following || (curated ? curated.following : []),
        publishedTripsCount: data.publishedTripsCount || (curated ? curated.publishedTripsCount : 0),
        publishedSpotsCount: data.publishedSpotsCount || (curated ? curated.publishedSpotsCount : 0),
        joinedAt: data.lastSynced || Date.now(),
      };
    }
  } catch (err) {
    console.warn("Failed to fetch public profile from Firestore:", err);
  }

  return (
    curated || {
      id: "user_" + cleanEmail.replace(/[^a-z0-9]/g, "_"),
      email: cleanEmail,
      name: cleanEmail.split("@")[0],
      avatarPreset: "compass",
      bio: "Active traveler exploring authentic local cultures.",
      homeCity: "Global Nomad",
      travelStyle: "Cultural Wanderer",
      badges: ["Explorer"],
      followers: [],
      following: [],
      publishedTripsCount: 0,
      publishedSpotsCount: 0,
    }
  );
}

/**
 * Fetch all public itineraries created by a specific user
 */
export async function getUserPublicTrips(userEmail: string): Promise<SharedTripDoc[]> {
  const cleanEmail = userEmail.trim().toLowerCase();
  try {
    const colRef = collection(db, SHARED_TRIPS_COLLECTION);
    const snap = await getDocs(colRef);
    const trips: SharedTripDoc[] = [];

    snap.forEach((d) => {
      const data = d.data() as SharedTripDoc;
      if (
        data.creatorEmail?.toLowerCase() === cleanEmail &&
        (data.isPublic || data.visibility === "public")
      ) {
        trips.push(data);
      }
    });

    return trips;
  } catch (err) {
    console.warn("Failed to fetch user public trips:", err);
    return [];
  }
}

/**
 * Fetch all reviews written by a specific user across all shared trips
 */
export async function getUserReviewsAcrossTrips(
  userEmail: string
): Promise<Array<{ tripId: string; tripTitle: string; destination: string; rating: number; text: string; createdAt: number }>> {
  const cleanEmail = userEmail.trim().toLowerCase();
  try {
    const colRef = collection(db, SHARED_TRIPS_COLLECTION);
    const snap = await getDocs(colRef);
    const reviews: Array<{ tripId: string; tripTitle: string; destination: string; rating: number; text: string; createdAt: number }> = [];

    snap.forEach((d) => {
      const data = d.data() as SharedTripDoc;
      if (Array.isArray(data.reviews)) {
        data.reviews.forEach((r) => {
          if (r.email.toLowerCase() === cleanEmail) {
            reviews.push({
              tripId: data.id,
              tripTitle: data.plan?.title || "Itinerary",
              destination: data.plan?.destinationOrTown || "Destination",
              rating: r.rating,
              text: r.text,
              createdAt: r.createdAt,
            });
          }
        });
      }
    });

    return reviews.sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) {
    console.warn("Failed to fetch user reviews:", err);
    return [];
  }
}
