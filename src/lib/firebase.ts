import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken, AppCheck } from "firebase/app-check";
import config from "../../firebase-applet-config.json";

// Initialize Firebase App
const app = initializeApp({
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId,
});

// Initialize Authentication and Firestore (with designated custom Database ID)
export const auth = getAuth(app);

let dbInstance;
try {
  const dbId = config.firestoreDatabaseId;
  dbInstance = dbId && dbId !== "(default)" ? getFirestore(app, dbId) : getFirestore(app);
} catch (err) {
  console.warn("Firestore custom database initialization warning, using default:", err);
  dbInstance = getFirestore(app);
}

export const db = dbInstance;

let appCheckInstance: AppCheck | null = null;

if (typeof window !== "undefined") {
  try {
    const siteKey = (import.meta as any).env?.VITE_FIREBASE_APPCHECK_SITE_KEY;
    if (siteKey) {
      appCheckInstance = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } else if (process.env.NODE_ENV !== "production") {
      // Set debug token for dev environment if enabled
      (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
  } catch (e) {
    console.warn("[App Check] Client init notice:", e);
  }
}

export async function getAppCheckHeaderToken(): Promise<string | null> {
  if (!appCheckInstance) return null;
  try {
    const res = await getToken(appCheckInstance, false);
    return res.token;
  } catch (_e) {
    return null;
  }
}


