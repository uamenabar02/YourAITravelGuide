import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { sanitizeForFirestore } from "./sanitizeFirestore";
import { withTimeout } from "./promiseTimeout";
import { CommunitySpotDoc, CommunitySpotReview, ItineraryPlan, ActivitySpot, ActivityCategory } from "../types";

export const COMMUNITY_SPOTS_COLLECTION = "community_spots";

// Curated Initial Community Spots for Explore
export const CURATED_COMMUNITY_SPOTS: CommunitySpotDoc[] = [
  {
    id: "spot-ss-bar-nestor",
    name: "Bar Nestor — Iconic Tortilla & Txuleta",
    category: "food",
    description: "Legendary tavern in San Sebastián's Old Town, celebrated for serving only four things perfectly: legendary potato tortilla, tomato salad, roasted padrón peppers, and prime ribeye steak.",
    insiderTip: "Queue at 12:00 PM for lunch or 7:00 PM for dinner to put your name down for one of the coveted 16 daily tortilla slices.",
    cityOrRegion: "San Sebastián, Spain",
    neighborhood: "Parte Vieja",
    address: "Artekale Kalea, 11, 20003 Donostia, Gipuzkoa",
    approxCost: "€15 - €35",
    coordinates: { lat: 43.3236, lng: -1.9842 },
    durationMinutes: 60,
    rating: 4.9,
    ratingsCount: 184,
    tags: ["Pintxos", "Historic", "Foodie Must", "Txakoli"],
    imageUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
    creatorEmail: "elena.vasco@localexplorer.ai",
    creatorName: "Elena Vasco",
    creatorAvatar: "foodie",
    likesCount: 142,
    likedBy: [],
    importsCount: 89,
    createdAt: Date.now() - 86400000 * 15,
    lastUpdated: Date.now() - 86400000 * 15,
    reviews: [
      {
        id: "rev-ss-1",
        author: "Marco Rossi",
        email: "marco.rossi@traveler.com",
        rating: 5,
        text: "The tomato salad with sea salt and olive oil is an absolute revelation. Unbeatable atmosphere!",
        createdAt: Date.now() - 86400000 * 5,
      },
    ],
  },
  {
    id: "spot-ss-urgull-vista",
    name: "Monte Urgull Castle & Hidden Panoramic Battery",
    category: "nature",
    description: "A forested coastal hill rising directly above the ocean, with 12th-century fortress walls, shaded stone staircases, and staggering panoramic vistas over La Concha Bay.",
    insiderTip: "Walk up the rear path starting behind the San Telmo Museum for breezy coastal views and tranquil shaded benches.",
    cityOrRegion: "San Sebastián, Spain",
    neighborhood: "Monte Urgull",
    address: "Urgull Mendia, 20003 Donostia",
    approxCost: "Free",
    coordinates: { lat: 43.3248, lng: -1.9877 },
    durationMinutes: 75,
    rating: 4.8,
    ratingsCount: 96,
    tags: ["Scenic View", "Sunset", "Fortress", "Coastal Walk"],
    imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
    creatorEmail: "uamenabar02@gmail.com",
    creatorName: "Unai Amenabar",
    creatorAvatar: "compass",
    likesCount: 118,
    likedBy: [],
    importsCount: 72,
    createdAt: Date.now() - 86400000 * 20,
    lastUpdated: Date.now() - 86400000 * 20,
    reviews: [],
  },
  {
    id: "spot-kyoto-okochi",
    name: "Okochi Sanso Villa & Secluded Teahouse",
    category: "hidden-gem",
    description: "Former private mountain villa of silent film star Denjiro Okochi, overlooking Arashiyama gorge with pristine moss gardens and maple canopies.",
    insiderTip: "Your admission ticket includes a complimentary bowl of freshly whisked Uji matcha and a traditional sweet in the tranquil bamboo pavilion.",
    cityOrRegion: "Kyoto, Japan",
    neighborhood: "Arashiyama",
    address: "8 Sagaogurayama Tabuchiyamacho, Ukyo Ward, Kyoto",
    approxCost: "¥1,000 (~$7)",
    coordinates: { lat: 35.0179, lng: 135.6685 },
    durationMinutes: 90,
    rating: 4.9,
    ratingsCount: 112,
    tags: ["Zen Garden", "Tea Ceremony", "Heritage", "Quiet Sanctuary"],
    imageUrl: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80",
    creatorEmail: "kenji.takahashi@localexplorer.ai",
    creatorName: "Kenji Takahashi",
    creatorAvatar: "mountain",
    likesCount: 95,
    likedBy: [],
    importsCount: 64,
    createdAt: Date.now() - 86400000 * 30,
    lastUpdated: Date.now() - 86400000 * 30,
    reviews: [],
  },
  {
    id: "spot-paris-marche-aligre",
    name: "Marché d'Aligre & Hidden Wine Cave",
    category: "food",
    description: "One of the oldest, most vibrant food markets in Paris, overflowing with artisan cheese mongers, roasted chicken sellers, and natural wine bistros.",
    insiderTip: "Step into Le Baron Rouge on the corner with an empty bottle to fill straight from their oak wine barrels for just a few euros.",
    cityOrRegion: "Paris, France",
    neighborhood: "12th Arrondissement",
    address: "Rue d'Aligre, 75012 Paris",
    approxCost: "€10 - €25",
    coordinates: { lat: 48.8492, lng: 2.3789 },
    durationMinutes: 90,
    rating: 4.7,
    ratingsCount: 78,
    tags: ["Artisan Market", "Cheese & Wine", "Authentic Local"],
    imageUrl: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80",
    creatorEmail: "sophie.laurent@localexplorer.ai",
    creatorName: "Sophie Laurent",
    creatorAvatar: "coffee",
    likesCount: 84,
    likedBy: [],
    importsCount: 51,
    createdAt: Date.now() - 86400000 * 10,
    lastUpdated: Date.now() - 86400000 * 10,
    reviews: [],
  },
  {
    id: "spot-oaxaca-hierve",
    name: "Hierve el Agua Petrified Waterfalls & Mineral Springs",
    category: "nature",
    description: "Natural rock calcifications that look like sweeping petrified waterfalls, with natural infinity spring pools perched over deep Oaxacan canyons.",
    insiderTip: "Hire a collective taxi early at 7:30 AM from Mitla to soak in the turquoise cliff-edge infinity pool before the tour buses arrive.",
    cityOrRegion: "Oaxaca, Mexico",
    neighborhood: "San Isidro Roaguía",
    address: "Carretera a Hierve el Agua, Oaxaca",
    approxCost: "$50 MXN (~$3)",
    coordinates: { lat: 16.8659, lng: -96.2755 },
    durationMinutes: 120,
    rating: 4.9,
    ratingsCount: 156,
    tags: ["Nature Wonder", "Natural Pools", "Photography", "Day Trip"],
    imageUrl: "https://images.unsplash.com/photo-1518638150340-f706e86654de?auto=format&fit=crop&w=800&q=80",
    creatorEmail: "mateo.gomez@localexplorer.ai",
    creatorName: "Mateo Gomez",
    creatorAvatar: "wave",
    likesCount: 160,
    likedBy: [],
    importsCount: 93,
    createdAt: Date.now() - 86400000 * 40,
    lastUpdated: Date.now() - 86400000 * 40,
    reviews: [],
  },
  {
    id: "spot-barcelona-bunkers",
    name: "Bunkers del Carmel Panoramic Viewpoint",
    category: "sightseeing",
    description: "Former Spanish Civil War anti-aircraft defense post offering an unobstructed 360-degree panoramic vista across Barcelona to the Mediterranean Sea.",
    insiderTip: "Bring a small picnic with Spanish olives, manchego cheese, and sparkling water for golden hour just before dusk.",
    cityOrRegion: "Barcelona, Spain",
    neighborhood: "El Carmel",
    address: "Carrer de Marià Labèrnia, s/n, 08032 Barcelona",
    approxCost: "Free",
    coordinates: { lat: 41.4194, lng: 2.1618 },
    durationMinutes: 75,
    rating: 4.8,
    ratingsCount: 140,
    tags: ["360 Skyline", "Sunset Spot", "Secret Vista", "Picnic"],
    imageUrl: "https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=800&q=80",
    creatorEmail: "elena.vasco@localexplorer.ai",
    creatorName: "Elena Vasco",
    creatorAvatar: "foodie",
    likesCount: 135,
    likedBy: [],
    importsCount: 88,
    createdAt: Date.now() - 86400000 * 18,
    lastUpdated: Date.now() - 86400000 * 18,
    reviews: [],
  },
];

/**
 * Fetch all community spots from Firestore or fallback to curated list
 * Protected with a 2500ms safety timeout to prevent hanging on mobile/WebView networks
 */
export async function fetchCommunitySpots(): Promise<CommunitySpotDoc[]> {
  try {
    const colRef = collection(db, COMMUNITY_SPOTS_COLLECTION);
    const snap = await withTimeout(getDocs(colRef), 2500, null, "fetchCommunitySpots");

    if (!snap || snap.empty) {
      return CURATED_COMMUNITY_SPOTS;
    }

    const fetched: CommunitySpotDoc[] = [];
    snap.forEach((d) => {
      fetched.push(d.data() as CommunitySpotDoc);
    });

    // Merge with any missing curated items
    const idSet = new Set(fetched.map((s) => s.id));
    CURATED_COMMUNITY_SPOTS.forEach((cs) => {
      if (!idSet.has(cs.id)) {
        fetched.push(cs);
      }
    });

    // Sort by likes + rating descending
    return fetched.sort((a, b) => (b.likesCount || 0) + (b.rating || 0) * 10 - ((a.likesCount || 0) + (a.rating || 0) * 10));
  } catch (err) {
    console.warn("Using local curated community spots fallback:", err);
    return CURATED_COMMUNITY_SPOTS;
  }
}

/**
 * Publish a new spot to the Community Explore section
 */
export async function publishSpotToCommunity(
  spot: Partial<CommunitySpotDoc>,
  cityOrRegion: string,
  userEmail: string,
  userName: string,
  userAvatar?: string
): Promise<{ success: boolean; spot?: CommunitySpotDoc; message?: string }> {
  try {
    const cleanEmail = userEmail.trim().toLowerCase();
    const spotId = spot.id || `spot-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const docRef = doc(db, COMMUNITY_SPOTS_COLLECTION, spotId);

    const spotPhotos = (spot.photos && spot.photos.length > 0)
      ? spot.photos
      : (spot.imageUrl ? [spot.imageUrl] : []);

    const newSpot: CommunitySpotDoc = {
      id: spotId,
      name: spot.name || "Curated Explorer Spot",
      category: spot.category || "hidden-gem",
      description: spot.description || "A remarkable spot shared by a local traveler.",
      insiderTip: spot.insiderTip || "",
      cityOrRegion: cityOrRegion.trim() || spot.cityOrRegion || "Global Destination",
      neighborhood: spot.neighborhood || "",
      address: spot.address || "",
      approxCost: spot.approxCost || "Varies",
      coordinates: spot.coordinates || { lat: 43.3236, lng: -1.9842 },
      durationMinutes: spot.durationMinutes || 60,
      rating: spot.rating || 5.0,
      ratingsCount: spot.ratingsCount || 1,
      tags: spot.tags || ["Community Gem", "Traveler Pick"],
      imageUrl: spotPhotos[0] || spot.imageUrl || "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
      photos: spotPhotos.length > 0 ? spotPhotos : undefined,
      creatorEmail: cleanEmail,
      creatorUid: auth.currentUser?.uid || undefined,
      creatorName: userName || "Local Explorer",
      creatorAvatar: userAvatar || "compass",
      likesCount: 1,
      likedBy: [cleanEmail],
      importsCount: 0,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      reviews: [],
    };

    await setDoc(docRef, sanitizeForFirestore(newSpot), { merge: true });
    window.dispatchEvent(new CustomEvent("localexplorer_cloud_sync_updated"));

    return { success: true, spot: newSpot };
  } catch (err: any) {
    console.error("Failed to publish spot to community:", err);
    return { success: false, message: err.message || "Failed to publish spot." };
  }
}

/**
 * Toggle Like on a Community Spot
 */
export async function toggleLikeCommunitySpot(
  spotId: string,
  userEmail: string
): Promise<{ liked: boolean; likesCount: number }> {
  const cleanEmail = userEmail.trim().toLowerCase();
  try {
    const docRef = doc(db, COMMUNITY_SPOTS_COLLECTION, spotId);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data() as CommunitySpotDoc;
      const likedBy = data.likedBy || [];
      const hasLiked = likedBy.includes(cleanEmail);
      const updatedLikedBy = hasLiked ? likedBy.filter((e) => e !== cleanEmail) : [...likedBy, cleanEmail];
      const newCount = Math.max(0, updatedLikedBy.length);

      await updateDoc(docRef, {
        likedBy: updatedLikedBy,
        likesCount: newCount,
        lastUpdated: Date.now(),
      });

      return { liked: !hasLiked, likesCount: newCount };
    }
  } catch (err) {
    console.warn("Failed to toggle spot like on server:", err);
  }
  return { liked: true, likesCount: 1 };
}

/**
 * Submit review for a Community Spot
 */
export async function submitSpotReview(
  spotId: string,
  author: string,
  email: string,
  rating: number,
  text: string
): Promise<{ success: boolean; reviews?: CommunitySpotReview[]; rating?: number }> {
  try {
    const docRef = doc(db, COMMUNITY_SPOTS_COLLECTION, spotId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return { success: false };
    }

    const data = snap.data() as CommunitySpotDoc;
    const currentReviews = data.reviews || [];
    const cleanEmail = email.trim().toLowerCase();

    const newReview: CommunitySpotReview = {
      id: `srev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      author: author.trim() || "Traveler",
      email: cleanEmail,
      rating: Math.max(1, Math.min(5, rating)),
      text: text.trim(),
      createdAt: Date.now(),
    };

    const updatedReviews = [newReview, ...currentReviews];
    const totalScore = updatedReviews.reduce((sum, r) => sum + r.rating, 0);
    const newAverage = Number((totalScore / updatedReviews.length).toFixed(1));

    await updateDoc(docRef, {
      reviews: updatedReviews,
      rating: newAverage,
      ratingsCount: updatedReviews.length,
      lastUpdated: Date.now(),
    });

    return { success: true, reviews: updatedReviews, rating: newAverage };
  } catch (err) {
    console.error("Failed to submit spot review:", err);
    return { success: false };
  }
}

/**
 * Import a Community Spot directly into an Active Itinerary Plan at a specific Day Number
 */
export function importCommunitySpotToPlan(
  spot: CommunitySpotDoc,
  plan: ItineraryPlan,
  targetDayNumber: number
): ItineraryPlan {
  const updatedDays = plan.days.map((day) => {
    if (day.dayNumber !== targetDayNumber) return day;

    const spotPhotos = (spot.photos && spot.photos.length > 0)
      ? spot.photos
      : (spot.imageUrl ? [spot.imageUrl] : []);

    const newActivity: ActivitySpot = {
      id: `imported-${spot.id}-${Date.now()}`,
      name: spot.name,
      category: spot.category,
      description: spot.description,
      insiderTip: spot.insiderTip || `Recommended by explorer ${spot.creatorName} (${spot.cityOrRegion})`,
      approxCost: spot.approxCost,
      rating: spot.rating,
      coordinates: spot.coordinates || { lat: 43.3236, lng: -1.9842 },
      address: spot.address,
      durationMinutes: spot.durationMinutes || 60,
      time: "Flexible Time",
      tags: spot.tags || ["Community Spot"],
      photos: spotPhotos.length > 0 ? spotPhotos : undefined,
    };

    return {
      ...day,
      activities: [...(day.activities || []), newActivity],
    };
  });

  // Track increment on server
  try {
    const docRef = doc(db, COMMUNITY_SPOTS_COLLECTION, spot.id);
    updateDoc(docRef, {
      importsCount: (spot.importsCount || 0) + 1,
    }).catch(() => {});
  } catch {}

  return {
    ...plan,
    days: updatedDays,
  };
}
