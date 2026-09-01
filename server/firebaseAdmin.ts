import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getAppCheck } from "firebase-admin/app-check";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

let projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT || "sage-box-298sv";

try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed.projectId) {
      projectId = parsed.projectId;
    }
  }
} catch (e) {
  console.warn("Could not parse firebase-applet-config.json for Firebase Admin SDK:", e);
}

if (!getApps().length) {
  try {
    initializeApp({
      projectId,
    });
    console.log(`[Firebase Admin] Initialized for project: ${projectId}`);
  } catch (err: any) {
    console.error("[Firebase Admin] Initialization failed:", err?.message || err);
  }
}

export const adminAuth = getAuth();
export const adminAppCheck = getAppCheck();
export const adminFirestore = getFirestore();
