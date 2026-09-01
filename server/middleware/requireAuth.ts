import type { Request, Response, NextFunction } from "express";
import { adminAuth } from "../firebaseAdmin.js";

export interface AuthedRequest extends Request {
  uid?: string;
  tokenEmail?: string | null;
  isAnonymous?: boolean;
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const idToken = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!idToken) {
    return res.status(401).json({ error: "Missing authentication token. Bearer token required." });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    req.uid = decoded.uid;
    req.tokenEmail = decoded.email ?? null;
    req.isAnonymous = decoded.firebase?.sign_in_provider === "anonymous";
    next();
  } catch (err: any) {
    console.warn("[Auth Middleware] ID Token verification failed:", err?.message || err);
    return res.status(401).json({ error: "Invalid or expired authentication session." });
  }
}
