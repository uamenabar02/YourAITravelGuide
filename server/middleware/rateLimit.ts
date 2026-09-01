import type { Request, Response, NextFunction } from "express";
import { AuthedRequest } from "./requireAuth.js";
import { adminFirestore } from "../firebaseAdmin.js";

export interface QuotaRule {
  weight: number;
  anonDaily: number;
  signedDaily: number;
  burstPerMin: number;
}

export const ENDPOINT_QUOTAS: Record<string, QuotaRule> = {
  "generate-plan": { weight: 10, anonDaily: 8, signedDaily: 30, burstPerMin: 2 },
  "reiterate-plan": { weight: 10, anonDaily: 5, signedDaily: 20, burstPerMin: 1 },
  "generate-candidates": { weight: 4, anonDaily: 20, signedDaily: 60, burstPerMin: 4 },
  "swap-activity": { weight: 4, anonDaily: 30, signedDaily: 100, burstPerMin: 6 },
  "swap-alternatives": { weight: 4, anonDaily: 30, signedDaily: 100, burstPerMin: 6 },
  "activity-details": { weight: 5, anonDaily: 30, signedDaily: 100, burstPerMin: 6 },
  "activity-chat": { weight: 2, anonDaily: 50, signedDaily: 200, burstPerMin: 10 },
  "help-chat": { weight: 2, anonDaily: 30, signedDaily: 100, burstPerMin: 6 },
  "translate": { weight: 1, anonDaily: 100, signedDaily: 400, burstPerMin: 30 },
  "ai-test": { weight: 3, anonDaily: 10, signedDaily: 30, burstPerMin: 3 },
  "ai-fetch-models": { weight: 1, anonDaily: 10, signedDaily: 30, burstPerMin: 3 },
  "geocode": { weight: 0, anonDaily: 200, signedDaily: 800, burstPerMin: 30 },
  "weather": { weight: 0, anonDaily: 200, signedDaily: 800, burstPerMin: 30 },
  "place-photos": { weight: 0, anonDaily: 200, signedDaily: 800, burstPerMin: 30 },
};

// In-memory sliding window store for burst rate limiting
interface BurstEntry {
  timestamps: number[];
}
const burstStore = new Map<string, BurstEntry>();

// In-memory IP backstop store
const ipStore = new Map<string, number[]>();

// In-memory cache for daily counts to avoid latency on every request
interface DailyCache {
  dateStr: string;
  counts: Record<string, number>;
}
const dailyStore = new Map<string, DailyCache>();

function getUtcDateStr(): string {
  const d = new Date();
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

function cleanExpiredBurstEntries() {
  const now = Date.now();
  const windowMs = 60 * 1000;
  for (const [key, entry] of burstStore.entries()) {
    entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs);
    if (entry.timestamps.length === 0) {
      burstStore.delete(key);
    }
  }
  for (const [ip, tsList] of ipStore.entries()) {
    const valid = tsList.filter((ts) => now - ts < windowMs);
    if (valid.length === 0) ipStore.delete(ip);
    else ipStore.set(ip, valid);
  }
}

// Cleanup periodically
setInterval(cleanExpiredBurstEntries, 30 * 1000);

export function ipRateLimiter(req: Request, res: Response, next: NextFunction) {
  const rawIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown-ip";
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxReqPerMin = 120;

  let tsList = ipStore.get(rawIp) || [];
  tsList = tsList.filter((ts) => now - ts < windowMs);

  if (tsList.length >= maxReqPerMin) {
    res.set("Retry-After", "30");
    return res.status(429).json({ error: "Too many requests from this IP address. Please wait a minute." });
  }

  tsList.push(now);
  ipStore.set(rawIp, tsList);
  next();
}

export function rateLimit(endpointKey: string) {
  const quota = ENDPOINT_QUOTAS[endpointKey] || { weight: 1, anonDaily: 50, signedDaily: 200, burstPerMin: 10 };

  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const uid = req.uid;
    if (!uid) {
      return res.status(401).json({ error: "Unauthenticated" });
    }

    const isAnon = !!req.isAnonymous;
    const dailyCap = isAnon ? quota.anonDaily : quota.signedDaily;
    const burstCap = quota.burstPerMin;
    const now = Date.now();
    const windowMs = 60 * 1000;
    const todayStr = getUtcDateStr();

    // 1. Burst Rate Limit Check
    const burstKey = `${uid}:${endpointKey}`;
    let burstEntry = burstStore.get(burstKey) || { timestamps: [] };
    burstEntry.timestamps = burstEntry.timestamps.filter((ts) => now - ts < windowMs);

    if (burstEntry.timestamps.length >= burstCap) {
      const oldest = burstEntry.timestamps[0];
      const retryAfterSec = Math.ceil((windowMs - (now - oldest)) / 1000);
      res.set("Retry-After", String(Math.max(retryAfterSec, 1)));
      return res.status(429).json({
        error: `Burst limit reached for ${endpointKey}. Please wait ${retryAfterSec}s before retrying.`,
        retryAfter: retryAfterSec,
      });
    }

    // 2. Daily Quota Check
    let userCache = dailyStore.get(uid);
    if (!userCache || userCache.dateStr !== todayStr) {
      userCache = { dateStr: todayStr, counts: {} };
      dailyStore.set(uid, userCache);
    }

    const currentDailyCount = userCache.counts[endpointKey] || 0;
    if (currentDailyCount >= dailyCap) {
      // Calculate seconds until UTC midnight
      const tomorrow = new Date();
      tomorrow.setUTCHours(24, 0, 0, 0);
      const secondsUntilReset = Math.ceil((tomorrow.getTime() - now) / 1000);

      res.set("Retry-After", String(secondsUntilReset));
      return res.status(429).json({
        error: "Daily usage limit reached. Please try again tomorrow or sign in for higher limits.",
        retryAfter: secondsUntilReset,
        isAnonymous: isAnon,
      });
    }

    // Reserve token
    burstEntry.timestamps.push(now);
    burstStore.set(burstKey, burstEntry);
    userCache.counts[endpointKey] = currentDailyCount + 1;

    // Asynchronously log / update Firestore rate limit counter doc
    persistDailyUsageToFirestore(uid, todayStr, endpointKey, userCache.counts[endpointKey]).catch((e) => {
      console.warn(`[RateLimit] Async Firestore counter sync note:`, e?.message || e);
    });

    const remaining = Math.max(0, dailyCap - userCache.counts[endpointKey]);
    res.set("X-RateLimit-Remaining", String(remaining));
    next();
  };
}

async function persistDailyUsageToFirestore(uid: string, dateStr: string, endpointKey: string, newCount: number) {
  try {
    const docRef = adminFirestore.collection("rate_limits").doc(uid);
    // Set 7-day TTL expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await docRef.set(
      {
        date: dateStr,
        counts: {
          [endpointKey]: newCount,
        },
        expiresAt: expiresAt.getTime(),
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  } catch (e) {
    // Non-blocking firestore sync note
  }
}
