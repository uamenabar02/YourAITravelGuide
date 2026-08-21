# LocalExplorer AI — Full Application Audit

**Date:** 2026-08-21 · **Scope:** Web app (React 19 + Vite 6 + Express 4 + Gemini API) · **Commit:** `214ff23`

This audit covers every source file (~9,200 lines): `server.ts`, `server/geminiService.ts` (2,200 lines),
all 17 components, utilities, types, config, and build pipeline. Issues were found via static analysis
**and** runtime testing (type check, production build, live API smoke tests, production-mode server test).

---

## 1. Architecture overview

```
Browser (React 19 SPA)                          Express server (server.ts)
├── VacationForm / HometownForm   ──POST──►     /api/generate-plan        → Gemini 2.5 Flash
├── ActivitySwiperModal           ──POST──►     /api/generate-candidates  → Gemini 2.5 Flash
├── ItineraryDisplay / DayCard    ──POST──►     /api/swap-activity        → Gemini 2.5 Flash
├── InteractiveMap (Leaflet/OSM)                /api/weather (proxy)      → Open-Meteo
├── localStorage: saved trips + 30-day history  /api/health
└── Export: share-URL / ICS / Markdown / JSON / print
```

Every Gemini call has a **curated offline fallback**, so the app degrades gracefully with no API key.

---

## 2. Critical bugs found & FIXED (commit `214ff23`)

### 2.1 Server / deployment
| # | Bug | Impact | Fix |
|---|-----|--------|-----|
| S1 | Vite dev middleware rejected non-localhost hosts | App unreachable behind any reverse proxy / preview host (HTTP 403) | `allowedHosts: true` |
| S2 | HMR websocket ran on a separate port (24678) | Hot reload broken behind single-port proxies | HMR served on the main HTTP server |
| S3 | Port hard-coded to 3000 | No deployment flexibility | `process.env.PORT \|\| 3000` |

### 2.2 AI service (`server/geminiService.ts`)
| # | Bug | Impact | Fix |
|---|-----|--------|-----|
| A1 | `gemini-1.5-flash` used as fallback model | **Shut down by Google on Sep 29, 2025** — fallback chain always failed | Current GA models (`gemini-2.5-flash`, `gemini-2.5-flash-lite`), env-overridable |
| A2 | `gemini-3.7-flash` used for candidates & swap | **Model does not exist** — both endpoints *always* errored and fell back | Replaced with GA model |
| A3 | Generic fallback returned the *same* spot every call | Itineraries for any non-curated city were **6–35 duplicates of one activity** (verified: Kyoto 3-day returned the identical spot 6×) | Varied 12-template pool + exact-name dedup signatures; verified 35/35 unique on a 7-day stress test |
| A4 | No validation of AI response shape | Malformed model output (`days` missing) would crash the client | Shape validation before shipping |
| A5 | Arrival-hour constraint built slots like `22:00 - 19:30` | Inverted/impossible schedules for late arrivals | Slot builder with monotonic clamping |
| A6 | Departure constraint produced `08:30 AM - 06:00` for early flights | Inverted farewell window | Farewell start clamped to `departure − 1.5h` |
| A7 | Pervasive malformed time strings (`"13:00 PM"`, `"14:30 PM - 16:30 PM"`, `"19:30 PM"`) shown verbatim in UI/exports | Unprofessional display, sort edge-cases | New shared `src/utils/time.ts` (`parseTimeToHours`, `normalizeTimeSlot`, `formatHoursTo12`) applied on server output **and** client render; all literals corrected |

### 2.3 UI / state bugs
| # | Bug | Impact | Fix |
|---|-----|--------|-----|
| U1 | Day title/theme editor **mutated props directly** (`day.dayTitle = …`) | Edits never reached React state → lost from saved trips, exports, re-render; stale fields on day switch | Immutable `onUpdateDayHeader` path through plan state + prop-sync effects |
| U2 | Activity reorder mutated activity objects in place | Fragile re-rendering | New objects created |
| U3 | Leaflet attribution control added **after** tile layer | OSM attribution never rendered (OSM tile-policy violation) | Controls registered before tiles |
| U4 | `fitBounds()` re-ran on every marker selection | Clicking a map pin zoomed straight back out (`panTo` cancelled) | Bounds fitted only when plan/day filter changes |
| U5 | No `invalidateSize()` on fullscreen toggle | Half-grey broken map in fullscreen | `invalidateSize()` after toggle |
| U6 | ICS export: `toISOString()` + `Z` on local wall-clock times | Every calendar event **shifted by the user's UTC offset** in Google/Apple/Outlook | RFC 5545 rewrite: floating local times, CRLF, text escaping, 75-octet folding, real activity start times (was synthetic `9 + 3×index` grid) |
| U7 | `parseShareableUrl` accepted any JSON | Corrupted/truncated share links could crash the app | Shape validation |
| U8 | `navigator.clipboard.writeText` with no fallback | Copy silently failed on non-HTTPS origins | `execCommand` fallback |
| U9 | GPS failure silently reset the town field to "Azpeitia, Spain" | User confusion | Inline error messages (permission denied vs timeout) |
| U10 | Sample Kyoto itinerary recorded into the 30-day "visited" history on first load | Anti-repeat memory polluted with 17 demo spots before the user did anything; history badge showed fake counts | Removed |
| U11 | Components referenced `tailwindcss-animate` classes (`animate-in`, `fade-in-*`, `slide-in-from-bottom-3`, `animate-slide-up`) that were never installed | All modal/toast entrance animations dead | Hand-rolled CSS equivalents (+ `prefers-reduced-motion`) |
| U12 | Duplicate `CandidateSpot` interface declaration; duplicated `parseTimeToHours` in 3 places | Type-declaration merging risk, drift | Merged; single shared util |

**Verification after fixes:** `tsc --noEmit` ✅ · `vite build` + esbuild server bundle ✅ · all 4 API endpoints ✅ ·
dev + production server modes ✅ · preview-host reachability ✅ · dedup stress test (7 days × 5 activities) ✅.

---

## 3. Known issues NOT fixed (decisions needed)

### High priority
1. **No rate limiting / auth on `/api/*`.** Anyone who discovers the URL can burn your Gemini quota. Add at minimum an IP-based limiter (e.g. `express-rate-limit`) before public deployment.
2. **Shareable URLs embed the full plan as base64.** A rich 7-day plan easily exceeds 100 KB — past the URL limits of WhatsApp/e-mail clients/some CDNs. Consider a server-side store with short IDs (`/t/:id`) later.
3. **Fallback for unknown destinations is generic** (by design of the offline mode, but "Local History Museum & Craft Exhibition" is obviously placeholder content). Acceptable as a no-key fallback; real generation needs `GEMINI_API_KEY` in `.env`.
4. **`/api/weather` endpoint exists but is unused** — the client calls Open-Meteo directly (CORS is fine). Either use the proxy (hides user IPs) or delete the endpoint.

### Medium
5. **Multi-destination trips**: per-stop arrival/departure hours are collected in the form but only editable implicitly; day allocation per stop is delegated entirely to the model (no deterministic split).
6. **"Mark Visited"** on activity cards is ephemeral UI state — it never feeds the 30-day history (only generated plans do). Wire it to `recordActivityVisit` if that's the intent.
7. **Exact-budget input** snaps to a minimum of 5 when cleared (cosmetic).
8. **`getKnownSpotsForDestination` fallback** returns only 4–5 candidates for unknown towns, so the swiper feels thin without an API key.
9. **Nominatim calls from the browser** lack a custom User-Agent (their usage policy asks for one); volume is low, but worth proxying server-side eventually.

### Low / polish
10. No test suite (none existed; recommend Vitest for `time.ts`, `sharing.ts`, dedup logic — the bugs fixed here are exactly the kind tests catch).
11. TypeScript runs non-strict (`strict: false` implicit); enabling `strict` + `noUnusedLocals` would prevent several bug classes found here.
12. Bundle is one 545 KB chunk (Leaflet + confetti + motion); code-splitting the map would help first paint.
13. Modals lack ESC-to-close and focus trapping (a11y); mode switch lacks `aria-pressed`.
14. Map legend shows 5 of 10 categories.
15. `package.json` name is still `react-example`; several `@types/*` live in `dependencies` instead of `devDependencies`.

---

## 4. Smartphone-app readiness notes

Since mobile development is next, these current design choices matter:
- **All persistence is `localStorage`** — abstract `src/utils/storage.ts` behind an interface now so a mobile build can swap in SQLite/AsyncStorage.
- **The server API is already client-agnostic** (JSON in/out) — a native app can reuse `/api/generate-plan`, `/api/generate-candidates`, `/api/swap-activity` unchanged.
- **Share-URL strategy (§3.2)** becomes even more important cross-platform; move to server-stored trips before shipping mobile.
- **Leaflet + OSM** translates well to mobile via `react-native-maps`/MapLibre; the `CategoryColors` and transit-connector model are portable.
- **Geolocation + weather** flows (HometownForm) map 1:1 to native permissions APIs.

---

## 5. How to run

```bash
npm install          # or bun install (repo ships bun.lock)
cp .env.example .env # add your GEMINI_API_KEY for real AI generation
npm run dev          # dev server on :3000 (PORT overridable)
npm run build && npm start   # production
npm run lint         # tsc --noEmit
```

Without a key, every endpoint still returns curated offline content (now deduplicated and correctly formatted).
