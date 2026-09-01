import type { Request, Response, NextFunction } from "express";
import { adminAppCheck } from "../firebaseAdmin.js";

export async function requireAppCheck(req: Request, res: Response, next: NextFunction) {
  const appCheckToken = req.headers["x-firebase-appcheck"] as string;

  if (!appCheckToken) {
    if (process.env.ENFORCE_APP_CHECK === "true" || process.env.NODE_ENV === "production") {
      return res.status(401).json({ error: "App Check token missing." });
    }
    return next();
  }

  try {
    await adminAppCheck.verifyToken(appCheckToken);
    return next();
  } catch (err: any) {
    console.warn("[App Check] Token verification failed:", err?.message || err);
    return res.status(403).json({ error: "Invalid App Check token." });
  }
}
