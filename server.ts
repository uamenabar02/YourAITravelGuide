import express from "express";
import path from "path";
import http from "http";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import { createServer as createViteServer } from "vite";
import {
  generateVacationItinerary,
  generateHometownItinerary,
  reiterateItineraryPlan,
  swapActivitySpot,
  swapActivitySpotAlternatives,
  generateCandidateSpots,
  fetchActivityDeepDetails,
  chatWithActivityGuide,
  translateText,
  chatWithHelpAssistant,
} from "./server/geminiService.js";
import { geocodeSpot } from "./server/geocoder.js";
import { getRealPhotosForSpot } from "./server/photoService.js";
import { testAIModelConnection, fetchAvailableModelsForProvider } from "./server/aiTester.js";
import { requireAuth, AuthedRequest } from "./server/middleware/requireAuth.js";
import { requireAppCheck } from "./server/middleware/requireAppCheck.js";
import { rateLimit, ipRateLimiter } from "./server/middleware/rateLimit.js";

dotenv.config();

const translationCache = new Map<string, string | string[]>();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Security Headers (Disable frameguard so AI Studio preview iframe can embed app)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      frameguard: false,
    })
  );

  // CORS Configuration
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (
          origin.includes("localhost") ||
          origin.includes("127.0.0.1") ||
          origin.includes("run.app") ||
          origin.includes("e2b.app") ||
          origin.includes("firebaseapp.com") ||
          origin.includes("web.app") ||
          origin.includes("ai.studio") ||
          origin.includes("google.com") ||
          origin.includes("googleusercontent.com")
        ) {
          return cb(null, true);
        }
        return cb(null, true);
      },
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Firebase-AppCheck"],
    })
  );

  // IP Rate Limit Backstop & Payload Limits
  app.use(ipRateLimiter);
  app.use(express.json({ limit: "1mb" }));

  // API Health Route (Public, Unauthenticated)
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
    });
  });

  // Common middleware stack for authenticated API routes
  const authedStack = [requireAuth, requireAppCheck];

  // Test Personal / System AI Model Connection
  app.post("/api/ai/test", authedStack, rateLimit("ai-test"), async (req: AuthedRequest, res) => {
    try {
      const result = await testAIModelConnection(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to test AI model." });
    }
  });

  // Dynamically Fetch Available Models for Provider/Key/URL
  app.post("/api/ai/fetch-models", authedStack, rateLimit("ai-fetch-models"), async (req: AuthedRequest, res) => {
    try {
      const result = await fetchAvailableModelsForProvider(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, models: [], message: err.message || "Failed to fetch models." });
    }
  });

  // Generate Candidates for Activity Swiper
  app.post("/api/generate-candidates", authedStack, rateLimit("generate-candidates"), async (req: AuthedRequest, res) => {
    try {
      const { destination, count, vibes, budgetTier, exactBudgetPerDay, currency, pace, userSpots, tasteProfile } =
        req.body;
      if (!destination) {
        return res.status(400).json({ error: "Destination is required." });
      }
      const candidates = await generateCandidateSpots(
        destination,
        count || 12,
        vibes || [],
        budgetTier,
        exactBudgetPerDay,
        currency || "€",
        pace,
        Array.isArray(userSpots) ? userSpots : [],
        tasteProfile || null
      );
      res.json(candidates);
    } catch (err: any) {
      console.error("Error generating candidates:", err);
      res.status(500).json({ error: err.message || "Failed to generate candidates." });
    }
  });

  // Generate Itinerary (Vacation or Hometown)
  app.post("/api/generate-plan", authedStack, rateLimit("generate-plan"), async (req: AuthedRequest, res) => {
    try {
      const { mode, vacationPrefs, hometownPrefs } = req.body;

      if (mode === "vacation") {
        if (!vacationPrefs || !vacationPrefs.destination) {
          return res.status(400).json({ error: "Destination is required for vacation mode." });
        }
        const plan = await generateVacationItinerary(vacationPrefs);
        return res.json(plan);
      } else if (mode === "hometown") {
        if (!hometownPrefs || !hometownPrefs.location) {
          return res.status(400).json({ error: "Location is required for hometown mode." });
        }
        const plan = await generateHometownItinerary(hometownPrefs);
        return res.json(plan);
      } else {
        return res.status(400).json({ error: "Invalid mode specified. Must be 'vacation' or 'hometown'." });
      }
    } catch (err: any) {
      console.error("Error generating plan:", err);
      res.status(500).json({ error: err.message || "Failed to generate itinerary." });
    }
  });

  // Swap Single Activity Spot
  app.post("/api/swap-activity", authedStack, rateLimit("swap-activity"), async (req: AuthedRequest, res) => {
    try {
      const swapReq = req.body;
      if (!swapReq.destinationOrTown || !swapReq.currentActivityName) {
        return res.status(400).json({ error: "Destination and current activity name are required." });
      }
      const newSpot = await swapActivitySpot(swapReq);
      res.json(newSpot);
    } catch (err: any) {
      console.error("Error swapping activity:", err);
      res.status(500).json({ error: err.message || "Failed to swap activity." });
    }
  });

  // Propose 3 swap alternatives
  app.post("/api/swap-alternatives", authedStack, rateLimit("swap-alternatives"), async (req: AuthedRequest, res) => {
    try {
      const swapReq = req.body;
      if (!swapReq.destinationOrTown || !swapReq.currentActivityName) {
        return res.status(400).json({ error: "Destination and current activity name are required." });
      }
      const alternatives = await swapActivitySpotAlternatives(swapReq);
      res.json(alternatives);
    } catch (err: any) {
      console.error("Error generating swap alternatives:", err);
      res.status(500).json({ error: err.message || "Failed to generate alternatives." });
    }
  });

  // Reiterate / Refine Itinerary Starting from User's Edited Plan
  app.post("/api/reiterate-plan", authedStack, rateLimit("reiterate-plan"), async (req: AuthedRequest, res) => {
    try {
      const {
        plan,
        instructions,
        excludedPlaces,
        permanentSkips,
        tasteProfile,
        userSpots,
        transportModes,
        arrivalHour,
        departureHour,
        accommodation,
        accommodations,
        startDate,
        weatherForecast,
      } = req.body;
      if (!plan || !plan.destinationOrTown || !plan.days) {
        return res.status(400).json({ error: "Invalid plan provided for reiteration." });
      }
      const newPlan = await reiterateItineraryPlan(plan, instructions, {
        excludedPlaces,
        permanentSkips,
        tasteProfile,
        userSpots,
        transportModes,
        arrivalHour: arrivalHour || plan.arrivalHour,
        departureHour: departureHour || plan.departureHour,
        accommodation: accommodation || plan.accommodation,
        accommodations: accommodations || plan.accommodations,
        startDate: startDate || plan.startDate,
        weatherForecast: weatherForecast || plan.weatherForecast,
      });
      res.json(newPlan);
    } catch (err: any) {
      console.error("Error reiterating plan:", err);
      res.status(500).json({ error: err.message || "Failed to reiterate itinerary." });
    }
  });

  // Deep Activity Details, Historical Context, Anecdotes, & Sub-spots
  app.post("/api/activity-details", authedStack, rateLimit("activity-details"), async (req: AuthedRequest, res) => {
    try {
      const { spotName, destination, category, address, description, coordinates } = req.body;
      if (!spotName || !destination) {
        return res.status(400).json({ error: "spotName and destination are required" });
      }
      const details = await fetchActivityDeepDetails({
        spotName,
        destination,
        category,
        address,
        description,
        coordinates,
      });
      res.json(details);
    } catch (err: any) {
      console.error("Error fetching activity deep details:", err);
      res.status(500).json({ error: err.message || "Failed to fetch activity details." });
    }
  });

  // Dedicated Local Guide / Travel Agent AI Chatbot for a specific activity
  app.post("/api/activity-chat", authedStack, rateLimit("activity-chat"), async (req: AuthedRequest, res) => {
    try {
      const { messages, spotContext } = req.body;
      if (!messages || !spotContext || !spotContext.spotName) {
        return res.status(400).json({ error: "messages and spotContext are required" });
      }
      const result = await chatWithActivityGuide({
        messages,
        spotContext,
      });
      res.json(result);
    } catch (err: any) {
      console.error("Error in activity chat:", err);
      res.status(500).json({ error: err.message || "Failed to chat with local guide." });
    }
  });

  // Dedicated Chatbot Assistant for Application Help & Feature Guidance
  app.post("/api/help-chat", authedStack, rateLimit("help-chat"), async (req: AuthedRequest, res) => {
    try {
      const { messages, aiSettings } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "messages is required and must be an array" });
      }
      const reply = await chatWithHelpAssistant(messages, aiSettings);
      res.json({ reply });
    } catch (err: any) {
      console.error("Error in help chat:", err);
      res.status(500).json({ error: err.message || "Failed to chat with help assistant." });
    }
  });

  // Translate text or array of texts dynamically using Gemini
  app.post("/api/translate", authedStack, rateLimit("translate"), async (req: AuthedRequest, res) => {
    try {
      const { text, targetLanguage } = req.body;
      if (!text || !targetLanguage) {
        return res.status(400).json({ error: "text and targetLanguage are required." });
      }
      if (targetLanguage === "en") {
        return res.json({ translation: text });
      }

      const cacheKey = `${targetLanguage}:${typeof text === "string" ? text : JSON.stringify(text)}`;
      if (translationCache.has(cacheKey)) {
        return res.json({ translation: translationCache.get(cacheKey) });
      }

      const translation = await translateText(text, targetLanguage);
      if (translation) {
        translationCache.set(cacheKey, translation);
      }
      res.json({ translation: translation || text });
    } catch (err: any) {
      console.warn("Translation fallback engaged:", err?.message || err);
      res.json({ translation: req.body?.text || "" });
    }
  });

  // Real-world photo resolver using Wikimedia Commons & Wikipedia
  app.get("/api/place-photos", authedStack, rateLimit("place-photos"), async (req: AuthedRequest, res) => {
    try {
      const spotName = String(req.query.spotName || "").trim();
      const destination = String(req.query.destination || "").trim();
      const category = String(req.query.category || "").trim();
      const lat = req.query.lat ? Number(req.query.lat) : undefined;
      const lng = req.query.lng ? Number(req.query.lng) : undefined;

      if (!spotName) {
        return res.status(400).json({ error: "spotName is required" });
      }

      const coords = lat && lng && !isNaN(lat) && !isNaN(lng) ? { lat, lng } : undefined;
      const photos = await getRealPhotosForSpot(spotName, destination, category, coords);
      res.set("Cache-Control", "private, max-age=86400");
      res.json({ photos });
    } catch (err: any) {
      console.error("Error resolving real place photos:", err);
      res.status(500).json({ error: "Failed to resolve photos" });
    }
  });

  // Dynamic geocoding (Nominatim): resolve any named place to coordinates.
  app.get("/api/geocode", authedStack, rateLimit("geocode"), async (req: AuthedRequest, res) => {
    try {
      const q = String(req.query.q || "").trim();
      const context = String(req.query.context || "").trim();
      if (!q) {
        return res.status(400).json({ error: "q query parameter is required" });
      }
      const result = await geocodeSpot(q, context);
      if (!result) {
        return res.status(404).json({ error: "No geocoding results for this place." });
      }
      res.set("Cache-Control", "private, max-age=86400");
      res.json(result);
    } catch (err: any) {
      console.error("Error geocoding:", err);
      res.status(500).json({ error: "Could not geocode this place right now." });
    }
  });

  // Live Weather & Geolocation helper
  app.get("/api/weather", authedStack, rateLimit("weather"), async (req: AuthedRequest, res) => {
    try {
      const { lat, lng } = req.query;
      if (!lat || !lng) {
        return res.status(400).json({ error: "lat and lng query parameters are required" });
      }
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m`;
      const response = await fetch(weatherUrl);
      if (!response.ok) {
        throw new Error("Weather API request failed");
      }
      const data = await response.json();
      res.set("Cache-Control", "private, max-age=3600");
      res.json(data);
    } catch (err: any) {
      console.error("Error fetching weather:", err);
      res.status(500).json({ error: "Could not fetch weather" });
    }
  });

  // Shared HTTP server
  const httpServer = http.createServer(app);
  httpServer.timeout = 30000; // 30s connection timeout

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: {
          server: httpServer,
        },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`LocalExplorer AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
