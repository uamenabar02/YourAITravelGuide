import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
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

