import express from "express";
import path from "path";
import http from "http";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import {
  generateVacationItinerary,
  generateHometownItinerary,
  swapActivitySpot,
  generateCandidateSpots,
} from "./server/geminiService.js";
import { geocodeSpot } from "./server/geocoder.js";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "10mb" }));

  // API Routes
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
    });
  });

  // Generate Candidates for Activity Swiper
  app.post("/api/generate-candidates", async (req, res) => {
    try {
      const { destination, count, vibes, budgetTier, exactBudgetPerDay, currency, pace, userSpots } = req.body;
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
        Array.isArray(userSpots) ? userSpots : []
      );
      res.json(candidates);
    } catch (err: any) {
      console.error("Error generating candidates:", err);
      res.status(500).json({ error: err.message || "Failed to generate candidates." });
    }
  });

  // Generate Itinerary (Vacation or Hometown)
  app.post("/api/generate-plan", async (req, res) => {
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
  app.post("/api/swap-activity", async (req, res) => {
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

  // Dynamic geocoding (Nominatim): resolve any named place to coordinates.
  // Used by "My Places" and anywhere the app must not depend on static data.
  app.get("/api/geocode", async (req, res) => {
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
      res.json(result);
    } catch (err: any) {
      console.error("Error geocoding:", err);
      res.status(500).json({ error: "Could not geocode this place right now." });
    }
  });

  // Live Weather & Geolocation helper (Open-Meteo & Nominatim proxy if needed)
  app.get("/api/weather", async (req, res) => {
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
      res.json(data);
    } catch (err: any) {
      console.error("Error fetching weather:", err);
      res.status(500).json({ error: "Could not fetch weather" });
    }
  });

  // Shared HTTP server so the Vite HMR websocket can be served from the SAME
  // port as the app. This is required for the app to work behind a reverse
  // proxy / preview host (only one port is exposed), and keeps local dev working.
  const httpServer = http.createServer(app);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        // Allow the sandboxed preview host (and any origin) so the dev app is
        // reachable through the proxied *.e2b.app preview URL.
        allowedHosts: true,
        hmr: {
          // Serve HMR upgrades on the main app server/port rather than a
          // separate port that a proxy may not expose.
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

