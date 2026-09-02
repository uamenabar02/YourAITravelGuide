import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, getFirestore } from "firebase/firestore";
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

// Initialize Authentication and Firestore (using configured database ID with long-polling fallback for iframe support)
export const auth = getAuth(app);

const databaseId = config.firestoreDatabaseId;
let dbInstance;

try {
  const settings = {
    experimentalAutoDetectLongPolling: true,
  };
  if (databaseId && databaseId !== "(default)") {
    dbInstance = initializeFirestore(app, settings, databaseId);
  } else {
    dbInstance = initializeFirestore(app, settings);
  }
} catch (_err) {
  dbInstance = databaseId && databaseId !== "(default)" ? getFirestore(app, databaseId) : getFirestore(app);
}

export const db = dbInstance;

let appCheckInstance: AppCheck | null = null;

if (typeof window !== "undefined") {
  try {
    const siteKey = (import.meta as any).env?.VITE_FIREBASE_APPCHECK_SITE_KEY || config.recaptchaSiteKey;
    if (siteKey && siteKey.trim() !== "") {
      appCheckInstance = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
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


