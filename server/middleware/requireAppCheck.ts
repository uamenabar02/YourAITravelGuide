import type { Request, Response, NextFunction } from "express";
import { adminAppCheck } from "../firebaseAdmin.js";

export async function requireAppCheck(req: Request, res: Response, next: NextFunction) {
  const appCheckToken = req.headers["x-firebase-appcheck"] as string;

  if (!appCheckToken) {
    // Audit mode: Allow traffic if token isn't present yet, but log note
    return next();
  }

  try {
    await adminAppCheck.verifyToken(appCheckToken);
    next();
  } catch (err: any) {
    console.warn("[App Check] Token validation note:", err?.message || err);
    next();
  }
}
