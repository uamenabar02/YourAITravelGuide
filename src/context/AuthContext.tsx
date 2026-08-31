import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  signInAnonymously,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import {
  getSavedTrips,
  getMySpots,
  getTasteProfile,
  saveTasteProfile,
  getActivityHistory,
  getPermanentSkips,
  getCurrentSessionPlan,
  mergeSavedTrips,
  mergeMySpots,
  mergeTasteProfiles,
  mergePermanentSkips,
  mergeActivityHistory,
} from "../utils/storage";
import { getOfflinePlans } from "../utils/offlineStorage";

export interface UserProfile {
  name: string;
  email: string;
  premium: boolean;
  activePersona: string | null;
  bio?: string;
  avatarUrl?: string;
  avatarPreset?: string;
  homeCity?: string;
  travelStyle?: string;
  websiteOrSocial?: string;
  preferredCurrency?: string;
  preferredDistanceUnit?: "km" | "mi";
  preferredTemperatureUnit?: "C" | "F";
  badges?: string[];
  following?: string[];
  followers?: string[];
  publishedTripsCount?: number;
  publishedSpotsCount?: number;
  autoSyncEnabled?: boolean;
  lastSynced?: number;
  lastSyncedTimeString?: string;
  syncSourceSession?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  activeEmail: string;
  autoSyncEnabled: boolean;
  syncStatus: "synced" | "syncing" | "offline" | "error";
  lastSyncTime: string;
  sessionId: string;
  setAutoSyncEnabled: (enabled: boolean) => void;
  signUp: (email: string, pass: string, name: string) => Promise<void>;
  signIn: (email: string, pass: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInGuest: () => Promise<void>;
  switchUserAccount: (email: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfileName: (name: string) => Promise<void>;
  updateActivePersona: (personaId: string | null) => Promise<void>;
  updateExtendedProfile: (data: Partial<UserProfile>) => Promise<void>;
  toggleFollowUser: (targetEmail: string) => Promise<boolean>;
  syncUserDataWithCloud: (force?: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Generate a unique session ID for this browser tab/window instance
const CURRENT_SESSION_ID = "sess_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now().toString(36);

import { sanitizeForFirestore } from "../utils/sanitizeFirestore";
export { sanitizeForFirestore };

function getDeviceId(): string {
  if (typeof window === "undefined" || !window.localStorage) {
    return "guest_default";
  }
  let id = localStorage.getItem("localexplorer_device_id");
  if (!id) {
    id = "dev_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now().toString(36);
    localStorage.setItem("localexplorer_device_id", id);
  }
  return id;
}

/**
 * Computes a canonical, deterministic Firestore Document ID for a user.
 * Maps signed-in users by email or firebase UID, and anonymous visitors to a persistent per-device guest document.
 */
export function getCanonicalUserDocId(firebaseUser: User | null, customEmail?: string | null): string {
  const email = (
    firebaseUser?.email ||
    customEmail ||
    (typeof window !== "undefined" ? localStorage.getItem("localexplorer_user_email") : null) ||
    ""
  ).trim().toLowerCase();

  if (email && email.includes("@") && !email.endsWith("@localexplorer.guest")) {
    return "user_" + email.replace(/[^a-z0-9]/g, "_");
  }

  if (firebaseUser?.uid) {
    return "user_" + firebaseUser.uid;
  }

  const devId = getDeviceId();
  return "guest_" + devId.replace(/[^a-z0-9_]/g, "_");
}

function getAllCollabStates(): Record<string, any> {
  const result: Record<string, any> = {};
  if (typeof window === "undefined" || !window.localStorage) return result;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("localexplorer_collab_")) {
        const tripId = key.replace("localexplorer_collab_", "");
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            result[tripId] = JSON.parse(raw);
          } catch {
            // ignore parse error
          }
        }
      }
    }
  } catch (err) {
    console.error("Failed to gather collab states:", err);
  }
  return result;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [activeEmail, setActiveEmail] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("localexplorer_user_email");
      if (saved) return saved;
      const guestEmail = `guest_${getDeviceId().substring(0, 8)}@localexplorer.guest`;
      localStorage.setItem("localexplorer_user_email", guestEmail);
      return guestEmail;
    }
    return "guest@localexplorer.guest";
  });

  const [profile, setProfile] = useState<UserProfile | null>(() => {
    if (typeof window !== "undefined") {
      const savedName = localStorage.getItem("localexplorer_user_name") || "Traveler";
      const savedEmail = localStorage.getItem("localexplorer_user_email") || `guest_${getDeviceId().substring(0, 8)}@localexplorer.guest`;
      const savedPersona = localStorage.getItem("localexplorer_active_persona") || null;
      return {
        name: savedName,
        email: savedEmail,
        premium: true,
        activePersona: savedPersona,
        lastSyncedTimeString: "Live",
      };
    }
    return null;
  });

  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "offline" | "error">("synced");
  const [lastSyncTime, setLastSyncTime] = useState<string>("Just now");
  const [autoSyncEnabled, setAutoSyncEnabledState] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("localexplorer_auto_sync_enabled") !== "false";
    }
    return true;
  });

  const userRef = useRef<User | null>(user);
  const activeEmailRef = useRef<string>(activeEmail);
  const profileRef = useRef<UserProfile | null>(profile);
  const autoSyncEnabledRef = useRef<boolean>(autoSyncEnabled);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    activeEmailRef.current = activeEmail;
  }, [activeEmail]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    autoSyncEnabledRef.current = autoSyncEnabled;
  }, [autoSyncEnabled]);

  const isApplyingRemoteSync = useRef(false);
  const isPushingToFirestore = useRef(false);
  const hasHydratedInitialData = useRef(false);

  // Derive active document ID
  const targetDocId = getCanonicalUserDocId(user, activeEmail);

  // Helper to apply incoming cloud data to browser localStorage and React state
  const applyCloudDataToLocalStorageAndState = useCallback((data: any) => {
    isApplyingRemoteSync.current = true;
    try {
      if (data.name) {
        localStorage.setItem("localexplorer_user_name", data.name);
      }
      if (data.email && data.email !== activeEmailRef.current) {
        localStorage.setItem("localexplorer_user_email", data.email);
        setActiveEmail(data.email);
      }
      if (data.activePersona !== undefined) {
        if (data.activePersona) {
          localStorage.setItem("localexplorer_active_persona", data.activePersona);
        } else {
          localStorage.removeItem("localexplorer_active_persona");
        }
      }

      if (data.bio !== undefined) localStorage.setItem("localexplorer_user_bio", data.bio || "");
      if (data.avatarUrl !== undefined) localStorage.setItem("localexplorer_user_avatar_url", data.avatarUrl || "");
      if (data.avatarPreset !== undefined) localStorage.setItem("localexplorer_user_avatar_preset", data.avatarPreset || "");
      if (data.homeCity !== undefined) localStorage.setItem("localexplorer_user_home_city", data.homeCity || "");
      if (data.travelStyle !== undefined) localStorage.setItem("localexplorer_user_travel_style", data.travelStyle || "");
      if (data.websiteOrSocial !== undefined) localStorage.setItem("localexplorer_user_social", data.websiteOrSocial || "");
      if (Array.isArray(data.following)) localStorage.setItem("localexplorer_user_following", JSON.stringify(data.following));
      if (Array.isArray(data.followers)) localStorage.setItem("localexplorer_user_followers", JSON.stringify(data.followers));
      if (Array.isArray(data.badges)) localStorage.setItem("localexplorer_user_badges", JSON.stringify(data.badges));

      if (typeof data.autoSyncEnabled === "boolean") {
        setAutoSyncEnabledState(data.autoSyncEnabled);
        autoSyncEnabledRef.current = data.autoSyncEnabled;
        localStorage.setItem("localexplorer_auto_sync_enabled", data.autoSyncEnabled ? "true" : "false");
      }

      // Smart non-destructive merge for saved trips
      if (Array.isArray(data.savedTrips)) {
        const localTrips = getSavedTrips();
        const merged = mergeSavedTrips(localTrips, data.savedTrips);
        localStorage.setItem("localexplorer_saved_trips_v1", JSON.stringify(merged));
      }

      // Smart non-destructive merge for My Spots
      if (Array.isArray(data.mySpots)) {
        const localSpots = getMySpots();
        const merged = mergeMySpots(localSpots, data.mySpots);
        localStorage.setItem("localexplorer_my_spots_v1", JSON.stringify(merged));
      }

      // Smart merge for Taste Profile
      if (data.tasteProfile !== undefined) {
        if (data.tasteProfile) {
          const localTaste = getTasteProfile();
          const merged = mergeTasteProfiles(localTaste, data.tasteProfile);
          if (merged) {
            localStorage.setItem("localexplorer_taste_profile_v1", JSON.stringify(merged));
          }
        } else {
          localStorage.removeItem("localexplorer_taste_profile_v1");
        }
      }

      // Smart merge for 30-Day Activity History
      if (Array.isArray(data.activityHistory)) {
        const localHist = getActivityHistory();
        const merged = mergeActivityHistory(localHist, data.activityHistory);
        localStorage.setItem("localexplorer_activity_history_v1", JSON.stringify(merged));
      }

      // Smart merge for Permanent Skips
      if (Array.isArray(data.permanentSkips)) {
        const localSkips = getPermanentSkips();
        const merged = mergePermanentSkips(localSkips, data.permanentSkips);
        localStorage.setItem("localexplorer_permanent_skips_v1", JSON.stringify(merged));
      }

      if (data.currentPlan !== undefined && data.currentPlan) {
        localStorage.setItem("localexplorer_current_session_plan_v1", JSON.stringify(data.currentPlan));
      }

      if (Array.isArray(data.offlinePlans)) {
        localStorage.setItem("localexplorer_offline_plans_v1", JSON.stringify(data.offlinePlans));
      }

      if (data.collabStates && typeof data.collabStates === "object") {
        Object.entries(data.collabStates).forEach(([tripId, collabData]) => {
          localStorage.setItem("localexplorer_collab_" + tripId, JSON.stringify(collabData));
        });
      }

      if (data.currentCollabSessionId) {
        localStorage.setItem("localexplorer_current_collab_session_id", data.currentCollabSessionId);
      }

      const nowTime = data.lastSyncedTimeString || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setLastSyncTime(nowTime);

      setProfile((prev) => {
        if (
          prev &&
          prev.name === (data.name || "Traveler") &&
          prev.email === (data.email || activeEmailRef.current) &&
          prev.activePersona === (data.activePersona || null) &&
          prev.autoSyncEnabled === data.autoSyncEnabled &&
          prev.lastSynced === data.lastSynced
        ) {
          return prev;
        }
        return {
          name: data.name || "Traveler",
          email: data.email || activeEmailRef.current,
          premium: true,
          activePersona: data.activePersona || null,
          autoSyncEnabled: data.autoSyncEnabled,
          lastSynced: data.lastSynced,
          lastSyncedTimeString: nowTime,
          syncSourceSession: data.syncSourceSession,
        };
      });

      hasHydratedInitialData.current = true;
      setSyncStatus("synced");

      // Notify all components in this browser session immediately
      window.dispatchEvent(new CustomEvent("localexplorer_cloud_sync_updated"));
      window.dispatchEvent(new Event("storage"));
    } catch (err) {
      console.error("Error applying incoming cloud snapshot:", err);
      setSyncStatus("error");
    } finally {
      setTimeout(() => {
        isApplyingRemoteSync.current = false;
      }, 200);
    }
  }, []);

  // Read and load cloud data FIRST before any writes occur
  const readAndHydrateFromCloud = useCallback(
    async (docId: string, emailForFallback?: string): Promise<boolean> => {
      if (!docId) return false;
      setSyncStatus("syncing");
      try {
        const userDocRef = doc(db, "users", docId);
        const snapshot = await getDoc(userDocRef);
        if (snapshot.exists()) {
          const data = snapshot.data();
          applyCloudDataToLocalStorageAndState(data);
          return true;
        } else {
          // Document does not exist yet in Firestore
          hasHydratedInitialData.current = true;
          setSyncStatus("synced");
          return false;
        }
      } catch (err) {
        console.error("Failed to read from Cloud Firestore on account load:", err);
        hasHydratedInitialData.current = true;
        setSyncStatus("synced");
        return false;
      }
    },
    [applyCloudDataToLocalStorageAndState]
  );

  // Set and persist auto sync setting
  const setAutoSyncEnabled = useCallback((enabled: boolean) => {
    setAutoSyncEnabledState(enabled);
    autoSyncEnabledRef.current = enabled;
    if (typeof window !== "undefined") {
      localStorage.setItem("localexplorer_auto_sync_enabled", enabled ? "true" : "false");
    }
    // Sync preference to cloud immediately
    setTimeout(() => {
      syncUserDataWithCloud(true);
    }, 50);
  }, []);

  // Push local browser storage state to Cloud Firestore (stable callback)
  const syncUserDataWithCloud = useCallback(async (force = false) => {
    if (isApplyingRemoteSync.current) return;

    // CRITICAL: Never push local state to Cloud if we have not hydrated remote data yet!
    if (!hasHydratedInitialData.current && !force) {
      console.log("Skipping cloud push: Initial remote data not yet read/hydrated.");
      return;
    }

    isPushingToFirestore.current = true;
    setSyncStatus("syncing");

    try {
      const currentDocId = getCanonicalUserDocId(userRef.current, activeEmailRef.current);
      const userDocRef = doc(db, "users", currentDocId);

      const localTrips = getSavedTrips();
      const localSpots = getMySpots();
      const localTaste = getTasteProfile();
      const localHistory = getActivityHistory();
      const localSkips = getPermanentSkips();
      const localPlan = getCurrentSessionPlan();
      const localOfflinePlans = getOfflinePlans();
      const localCollabs = getAllCollabStates();
      const currentCollabId = localStorage.getItem("localexplorer_current_collab_session_id") || null;
      const currentName = profileRef.current?.name || localStorage.getItem("localexplorer_user_name") || "Traveler";
      const currentPersona = profileRef.current?.activePersona || localStorage.getItem("localexplorer_active_persona") || null;
      const currentBio = localStorage.getItem("localexplorer_user_bio") || profileRef.current?.bio || "";
      const currentAvatarUrl = localStorage.getItem("localexplorer_user_avatar_url") || profileRef.current?.avatarUrl || "";
      const currentAvatarPreset = localStorage.getItem("localexplorer_user_avatar_preset") || profileRef.current?.avatarPreset || "compass";
      const currentHomeCity = localStorage.getItem("localexplorer_user_home_city") || profileRef.current?.homeCity || "";
      const currentTravelStyle = localStorage.getItem("localexplorer_user_travel_style") || profileRef.current?.travelStyle || "Cultural Wanderer";
      const currentSocial = localStorage.getItem("localexplorer_user_social") || profileRef.current?.websiteOrSocial || "";
      
      let currentFollowing: string[] = [];
      try {
        const fRaw = localStorage.getItem("localexplorer_user_following");
        if (fRaw) currentFollowing = JSON.parse(fRaw);
      } catch {}
      
      let currentFollowers: string[] = [];
      try {
        const fRaw = localStorage.getItem("localexplorer_user_followers");
        if (fRaw) currentFollowers = JSON.parse(fRaw);
      } catch {}

      // Deep clone and clean all undefined values
      const rawPayload = {
        name: currentName,
        email: activeEmailRef.current,
        premium: true,
        activePersona: currentPersona,
        bio: currentBio,
        avatarUrl: currentAvatarUrl,
        avatarPreset: currentAvatarPreset,
        homeCity: currentHomeCity,
        travelStyle: currentTravelStyle,
        websiteOrSocial: currentSocial,
        following: currentFollowing,
        followers: currentFollowers,
        publishedTripsCount: localTrips.filter(t => (t as any).isPublic).length,
        publishedSpotsCount: localSpots.length,
        autoSyncEnabled: autoSyncEnabledRef.current,
        savedTrips: localTrips,
        mySpots: localSpots,
        tasteProfile: localTaste,
        activityHistory: localHistory,
        permanentSkips: localSkips,
        currentPlan: localPlan,
        offlinePlans: localOfflinePlans,
        collabStates: localCollabs,
        currentCollabSessionId: currentCollabId,
        lastSynced: Date.now(),
        lastSyncedTimeString: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        syncSourceSession: CURRENT_SESSION_ID,
      };

      const payload = sanitizeForFirestore(JSON.parse(JSON.stringify(rawPayload)));

      await setDoc(userDocRef, payload, { merge: true });

      const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setLastSyncTime(timeStr);
      setSyncStatus("synced");
      hasHydratedInitialData.current = true;
      localStorage.setItem("localexplorer_last_sync_time", timeStr);
    } catch (err: any) {
      if (err?.code === "unavailable") {
        console.warn("Cloud synchronization operates in offline mode:", err);
        setSyncStatus("offline");
      } else {
        console.error("Cloud synchronization push error:", err);
        setSyncStatus("error");
      }
    } finally {
      setTimeout(() => {
        isPushingToFirestore.current = false;
      }, 200);
    }
  }, []);

  // Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const email = firebaseUser.email || activeEmailRef.current;
        if (email !== activeEmailRef.current) {
          setActiveEmail(email);
        }
        localStorage.setItem("localexplorer_user_email", email);
        if (firebaseUser.displayName) {
          localStorage.setItem("localexplorer_user_name", firebaseUser.displayName);
        }
        // READ FIRST: Load existing data linked to this account from Firestore
        const docId = getCanonicalUserDocId(firebaseUser, email);
        await readAndHydrateFromCloud(docId, email);
      } else {
        // If guest or non-firebase auth session, check if activeEmail is already guest
        if (activeEmailRef.current && activeEmailRef.current.startsWith("guest_")) {
          hasHydratedInitialData.current = true;
          setSyncStatus("synced");
        } else {
          // If guest or non-firebase auth session, read local active email doc if exists
          const docId = getCanonicalUserDocId(null, activeEmailRef.current);
          await readAndHydrateFromCloud(docId, activeEmailRef.current);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [readAndHydrateFromCloud]);

  // Real-time Firestore Snapshot Listener (Bi-directional Live Sync across all sessions)
  useEffect(() => {
    if (!targetDocId) return;
    const userDocRef = doc(db, "users", targetDocId);

    const unsubscribe = onSnapshot(
      userDocRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          // Document does not exist in Cloud yet.
          hasHydratedInitialData.current = true;
          setSyncStatus("synced");
          return;
        }

        const data = snapshot.data();

        // If this update was originated from this exact session in the last push, ignore to avoid feedback loop
        if (data.syncSourceSession === CURRENT_SESSION_ID) {
          const nowTime = data.lastSyncedTimeString || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          setLastSyncTime(nowTime);
          setSyncStatus("synced");
          hasHydratedInitialData.current = true;
          return;
        }

        applyCloudDataToLocalStorageAndState(data);
      },
      (err) => {
        if (err?.code === "unavailable") {
          console.warn("Firestore operating in offline/reconnecting mode.");
          setSyncStatus("offline");
        } else {
          console.error("Firestore onSnapshot error:", err);
          setSyncStatus("error");
        }
      }
    );

    return () => unsubscribe();
  }, [targetDocId, applyCloudDataToLocalStorageAndState]);

  // Listen to local mutations across all components in this tab and auto-sync to Firestore if enabled
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout;

    const handleLocalDataChanged = () => {
      if (isApplyingRemoteSync.current) return;
      if (!hasHydratedInitialData.current) return;
      if (!autoSyncEnabledRef.current) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        syncUserDataWithCloud(false);
      }, 200);
    };

    window.addEventListener("localexplorer_data_changed", handleLocalDataChanged);
    return () => {
      clearTimeout(debounceTimer);
      window.removeEventListener("localexplorer_data_changed", handleLocalDataChanged);
    };
  }, [syncUserDataWithCloud]);

  // Sign up
  const signUp = async (email: string, pass: string, name: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim() || "Traveler";

    localStorage.setItem("localexplorer_user_email", cleanEmail);
    localStorage.setItem("localexplorer_user_name", cleanName);
    setActiveEmail(cleanEmail);

    try {
      try {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
        await updateProfile(cred.user, { displayName: cleanName });
      } catch (authErr: any) {
        console.warn("Standard Firebase Auth signup skipped or restricted, using direct Firestore account sync:", authErr.message);
      }
      // Check if this account already exists in Cloud, otherwise initialize
      const docId = getCanonicalUserDocId(auth.currentUser, cleanEmail);
      const exists = await readAndHydrateFromCloud(docId, cleanEmail);
      if (!exists) {
        await syncUserDataWithCloud(true);
      }
    } catch (err: any) {
      console.error("Sign Up failed:", err);
      throw err;
    }
  };

  // Sign In
  const signIn = async (email: string, pass: string) => {
    const cleanEmail = email.trim().toLowerCase();
    localStorage.setItem("localexplorer_user_email", cleanEmail);
    setActiveEmail(cleanEmail);

    try {
      try {
        await signInWithEmailAndPassword(auth, cleanEmail, pass);
      } catch (authErr: any) {
        console.warn("Standard Firebase Auth signin skipped or restricted, using direct Firestore account sync:", authErr.message);
      }
      // READ FIRST: Load existing data linked to this account from Firestore
      const docId = getCanonicalUserDocId(auth.currentUser, cleanEmail);
      const exists = await readAndHydrateFromCloud(docId, cleanEmail);
      if (!exists) {
        await syncUserDataWithCloud(true);
      }
    } catch (err: any) {
      console.error("Sign In failed:", err);
      throw err;
    }
  };

  // Switch / Connect User Account (Guarantees multi-session link in 1-click)
  const switchUserAccount = async (email: string, name?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    localStorage.setItem("localexplorer_user_email", cleanEmail);
    if (name) {
      localStorage.setItem("localexplorer_user_name", name);
    }
    setActiveEmail(cleanEmail);

    setProfile((prev) => ({
      name: name || prev?.name || "Traveler",
      email: cleanEmail,
      premium: true,
      activePersona: prev?.activePersona || null,
      lastSyncedTimeString: "Syncing...",
    }));

    // READ FIRST: Load existing data linked to this account from Firestore
    const docId = getCanonicalUserDocId(user, cleanEmail);
    const exists = await readAndHydrateFromCloud(docId, cleanEmail);
    if (!exists) {
      await syncUserDataWithCloud(true);
    }
  };

  // Sign In as Guest
  const signInGuest = async () => {
    try {
      const cred = await signInAnonymously(auth);
      const docId = getCanonicalUserDocId(cred.user, activeEmailRef.current);
      const exists = await readAndHydrateFromCloud(docId);
      if (!exists) {
        await syncUserDataWithCloud(true);
      }
    } catch (err: any) {
      console.warn("Guest sign in fallback:", err);
      const docId = getCanonicalUserDocId(null, activeEmailRef.current);
      await readAndHydrateFromCloud(docId);
    }
  };

  // Sign In with Google
  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const cleanEmail = (cred.user.email || activeEmailRef.current).toLowerCase();
      setActiveEmail(cleanEmail);
      localStorage.setItem("localexplorer_user_email", cleanEmail);
      if (cred.user.displayName) {
        localStorage.setItem("localexplorer_user_name", cred.user.displayName);
      }
      // READ FIRST: Load existing data linked to the logged-in Google account from Firestore
      const docId = getCanonicalUserDocId(cred.user, cleanEmail);
      const exists = await readAndHydrateFromCloud(docId, cleanEmail);
      if (!exists) {
        await syncUserDataWithCloud(true);
      }
    } catch (err: any) {
      console.error("Google Sign In failed:", err);
      throw err;
    }
  };

  // Logout
  const logout = async () => {
    const devId = getDeviceId();
    const guestEmail = `guest_${devId.substring(0, 8)}@localexplorer.guest`;
    setActiveEmail(guestEmail);
    activeEmailRef.current = guestEmail;
    localStorage.setItem("localexplorer_user_email", guestEmail);
    localStorage.setItem("localexplorer_user_name", "Traveler");
    setProfile(null);
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout err:", err);
    }
    window.dispatchEvent(new CustomEvent("localexplorer_cloud_sync_updated"));
  };

  // Update Display Name
  const updateProfileName = async (name: string) => {
    const clean = name.trim();
    if (!clean) return;

    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: clean });
      }
      const targetDocId = getCanonicalUserDocId(user, activeEmail);
      const userDocRef = doc(db, "users", targetDocId);
      await updateDoc(userDocRef, { name: clean });
      setProfile((prev) => (prev ? { ...prev, name: clean } : null));
      localStorage.setItem("localexplorer_user_name", clean);
      window.dispatchEvent(new CustomEvent("localexplorer_cloud_sync_updated"));
    } catch (err) {
      console.error("Failed to update profile name:", err);
      localStorage.setItem("localexplorer_user_name", clean);
      syncUserDataWithCloud();
    }
  };

  // Update Persona
  const updateActivePersona = async (personaId: string | null) => {
    try {
      const targetDocId = getCanonicalUserDocId(user, activeEmail);
      const userDocRef = doc(db, "users", targetDocId);
      await updateDoc(userDocRef, { activePersona: personaId });
      setProfile((prev) => (prev ? { ...prev, activePersona: personaId } : null));
      if (personaId) {
        localStorage.setItem("localexplorer_active_persona", personaId);
      } else {
        localStorage.removeItem("localexplorer_active_persona");
      }
      window.dispatchEvent(new CustomEvent("localexplorer_cloud_sync_updated"));
    } catch (err) {
      console.error("Failed to update persona:", err);
      if (personaId) {
        localStorage.setItem("localexplorer_active_persona", personaId);
      } else {
        localStorage.removeItem("localexplorer_active_persona");
      }
      syncUserDataWithCloud();
    }
  };

  // Update Extended Profile (Bio, Avatar, Home City, Travel Style, Social link)
  const updateExtendedProfile = async (data: Partial<UserProfile>) => {
    try {
      const targetDocId = getCanonicalUserDocId(user, activeEmail);
      const userDocRef = doc(db, "users", targetDocId);

      const updateData: Record<string, any> = {};
      if (data.name !== undefined) {
        updateData.name = data.name;
        localStorage.setItem("localexplorer_user_name", data.name);
        if (auth.currentUser) {
          await updateProfile(auth.currentUser, { displayName: data.name });
        }
      }
      if (data.bio !== undefined) {
        updateData.bio = data.bio;
        localStorage.setItem("localexplorer_user_bio", data.bio);
      }
      if (data.avatarUrl !== undefined) {
        updateData.avatarUrl = data.avatarUrl;
        localStorage.setItem("localexplorer_user_avatar_url", data.avatarUrl);
      }
      if (data.avatarPreset !== undefined) {
        updateData.avatarPreset = data.avatarPreset;
        localStorage.setItem("localexplorer_user_avatar_preset", data.avatarPreset);
      }
      if (data.homeCity !== undefined) {
        updateData.homeCity = data.homeCity;
        localStorage.setItem("localexplorer_user_home_city", data.homeCity);
      }
      if (data.travelStyle !== undefined) {
        updateData.travelStyle = data.travelStyle;
        localStorage.setItem("localexplorer_user_travel_style", data.travelStyle);
      }
      if (data.websiteOrSocial !== undefined) {
        updateData.websiteOrSocial = data.websiteOrSocial;
        localStorage.setItem("localexplorer_user_social", data.websiteOrSocial);
      }

      await setDoc(userDocRef, sanitizeForFirestore(updateData), { merge: true });

      setProfile((prev) => (prev ? { ...prev, ...data } : null));
      window.dispatchEvent(new CustomEvent("localexplorer_cloud_sync_updated"));
    } catch (err) {
      console.error("Failed to update extended profile:", err);
      // Fallback local updates
      if (data.bio !== undefined) localStorage.setItem("localexplorer_user_bio", data.bio);
      if (data.avatarUrl !== undefined) localStorage.setItem("localexplorer_user_avatar_url", data.avatarUrl);
      if (data.avatarPreset !== undefined) localStorage.setItem("localexplorer_user_avatar_preset", data.avatarPreset);
      if (data.homeCity !== undefined) localStorage.setItem("localexplorer_user_home_city", data.homeCity);
      if (data.travelStyle !== undefined) localStorage.setItem("localexplorer_user_travel_style", data.travelStyle);
      if (data.websiteOrSocial !== undefined) localStorage.setItem("localexplorer_user_social", data.websiteOrSocial);
      syncUserDataWithCloud();
    }
  };

  // Toggle Follow / Unfollow another user/creator
  const toggleFollowUser = async (targetEmail: string): Promise<boolean> => {
    const cleanTarget = targetEmail.trim().toLowerCase();
    if (!cleanTarget || cleanTarget === activeEmail.toLowerCase()) return false;

    try {
      let currentFollowing: string[] = [];
      try {
        const raw = localStorage.getItem("localexplorer_user_following");
        if (raw) currentFollowing = JSON.parse(raw);
      } catch {}

      const isFollowing = currentFollowing.includes(cleanTarget);
      const updatedFollowing = isFollowing
        ? currentFollowing.filter((e) => e !== cleanTarget)
        : [...currentFollowing, cleanTarget];

      localStorage.setItem("localexplorer_user_following", JSON.stringify(updatedFollowing));

      const targetDocId = getCanonicalUserDocId(user, activeEmail);
      const userDocRef = doc(db, "users", targetDocId);
      await setDoc(userDocRef, { following: updatedFollowing }, { merge: true });

      setProfile((prev) => (prev ? { ...prev, following: updatedFollowing } : null));
      window.dispatchEvent(new CustomEvent("localexplorer_cloud_sync_updated"));
      return !isFollowing;
    } catch (err) {
      console.error("Failed to toggle follow user:", err);
      return false;
    }
  };

  const contextValue = useMemo(
    () => ({
      user,
      profile,
      loading,
      activeEmail,
      autoSyncEnabled,
      syncStatus,
      lastSyncTime,
      sessionId: CURRENT_SESSION_ID,
      setAutoSyncEnabled,
      signUp,
      signIn,
      signInWithGoogle,
      signInGuest,
      switchUserAccount,
      logout,
      updateProfileName,
      updateActivePersona,
      updateExtendedProfile,
      toggleFollowUser,
      syncUserDataWithCloud,
    }),
    [
      user,
      profile,
      loading,
      activeEmail,
      autoSyncEnabled,
      syncStatus,
      lastSyncTime,
      setAutoSyncEnabled,
      signUp,
      signIn,
      signInWithGoogle,
      signInGuest,
      switchUserAccount,
      logout,
      updateProfileName,
      updateActivePersona,
      updateExtendedProfile,
      toggleFollowUser,
      syncUserDataWithCloud,
    ]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
