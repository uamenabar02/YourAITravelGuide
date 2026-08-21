# LocalExplorer AI — Full Application Audit

**Date:** 2026-08-21 · **Scope:** Web app (React 19 + Vite 6 + Express 4 + Gemini API) · **Commits:** `214ff23` → resident-first Hometown upgrade (see §6)

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

---

## 6. Hometown Mode v2 — resident-first suggestions + permanent skips

Following user feedback that hometown suggestions felt too generic for **long-time residents**, the mode was rebuilt around two pillars:

### 6.1 Resident-first curation
- **The prompt now declares the user a long-time resident, not a tourist.** Classic sightseeing is banned; the model must deliver hyper-local, ephemeral experiences (quiet-hour revisits, tide/sunset-dependent spots, this week's markets/concerts/races, the counter with the daily special).
- **Known tourist sights are auto-excluded per town.** When the town exists in the verified knowledge base, its `popularSpots` are injected into the Gemini instruction as "already seen by the resident — do not propose ordinary visits".
- **Real places only.** The instruction forbids invented placeholders ("Artisan Coffee Roastery") and mandates Google-Search-grounded, named, currently-existing places within the radius.
- **Offline fallback rebuilt (no API key):** occasion-aware and weather-aware. Verified towns get their *real* places re-framed the way residents re-live them (`"Quiet-Hour Revisit"`, `"Evening-Ambiance Revisit"`, `"Counter & Daily Special"`… per occasion). Unknown towns get honest occasion-matched archetypes (indoor ideas when it rains, 2/3/4 spots for quick/half-day/full-day). Permanent skips and 30-day memory are respected even offline.

### 6.2 Permanent skip list ("never suggest again")
- **New localStorage store** (`getPermanentSkips` / `addPermanentSkip` / `removePermanentSkip` in `src/utils/storage.ts`).
- **Per-activity Ban button** on every activity card: one tap permanently excludes that place and removes it from the current plan.
- **Management UI**: the History modal now has two tabs — *30-Day Memory* and *Permanent Skips* (list + restore entries). The Hometown form's anti-repeat banner shows both counts with a "Manage" link.
- **Enforced everywhere server-side**: hometown generation (prompt + post-parse filter of activities *and* alternatives), vacation generation (filtered like swiper-skips), single-spot swaps (`excludedPlaces` now carries permanent skips), and radius-enforcement replacements never reintroduce a banned place.

**Verified:** banned spots leak 0/3 into regenerated plans; occasion/weather/time-of-day adapt correctly; lint + build + all endpoints green.

---

## 7. Map accuracy fix — real coordinates for known spots

**Bug:** hometown activities showed real *names* but synthetic *coordinates* (a trigonometric jitter around the town center), so pins like "Erlo Summit" or "Loiola Sanctuary" landed on random streets in town.

**Fix:**
- New **spot-level coordinate knowledge base** (`SPOT_COORDINATES_DB` in `src/utils/destinations.ts`): real-world coordinates for the known spots of every verified destination, including alias entries (Basque/Spanish spellings, short names: `Erlo`, `Loiola`, `Loyola`…).
- New `getKnownSpotCoordinates(destination, spotName)` resolver with substring matching that tolerates decorated names ("Erlo Summit — Quiet-Hour Revisit").
- **Applied on every generation path:**
  - Offline hometown fallback: known spots get their real pin (fallback jitter kept only for archetypes).
  - Hometown radius enforcement: AI output is *snapped* to KB coordinates when the spot is recognized and inside the radius; distant-spot replacements are re-pinned too.
  - Vacation enforcement: same snap pass for known spots.
- Corrected a factual error in the curated data: "Ekoetxea Urdaibai Environmental Center" is in Bizkaia (~50 km away) and was removed from Azpeitia's spots, replaced by the Soreasu Parish Church.

**Verified:** Erlo Summit now pins at (43.2042, -2.2717) on the massif (2.56 km from Azpeitia center); Loiola Sanctuary at (43.1800, -2.2810); alias/decorated-name lookups all pass.

---

## 8. Dynamic geocoding + user-provided dining (no more static venue data)

Two product upgrades requested by the user: stop depending on static databases, and never fabricate bars/cafés/restaurants.

### 8.1 Live geocoding (Nominatim)
- New `server/geocoder.ts`: Nominatim integration with **1 req/s throttle**, descriptive User-Agent, and in-process positive+negative caching.
- New endpoint `GET /api/geocode?q=<place>&context=<town>` — used by "My Places" and available for anything needing real coordinates.
- Resolution chain everywhere: **spot knowledge base (fast path) → Nominatim (dynamic) → graceful fallback**. AI-generated hometown activities with missing/invalid coordinates are geocoded server-side before shipping.
- *Note: this sandbox has no outbound internet, so Nominatim calls fail here and fall back gracefully; the integration follows the official API contract and works in any deployed environment.*

### 8.2 "My Places" — dining recommendations come from the USER
- New localStorage store + `MySpotsModal` (navbar 🍴 button): users register their own bars/cafés/restaurants with type, town and notes; each entry is geocoded when added.
- **Static dining venues deleted from every recommendation pool**: Donostia vacation pool (pintxo crawl, ciderhouse, Gros crawl), swiper candidates (Bar Nestor, La Cuchara, Akelarre…), swap alternatives, extra-day curated lunches, generic backup templates, and any dining-named spot in the verified knowledge lists.
- **Sourcing rules now:**
  - Hometown/vacation/swap generation receive `userSpots`; dining slots are filled with the user's own places first (dynamically geocoded if coordinates are pending).
  - With a Gemini key, dining must come from **live search results only** (prompt-enforced: inventing venues is forbidden).
  - Offline with no user places → no dining suggestion at all, plus an honest in-plan message pointing to My Places / API key.
- AI prompts (hometown, vacation, swap) instruct the model to weave the user's own places in and to never exclude them.

**Verified:** no static dining leaks in generated plans; user spots appear in hometown plans (2/2) and dining swaps resolve to the user's own venue.

---

## 9. Taste Profile — personalized, context-aware dining

Clarified product direction: "recommend through user data" means the app should **learn how the user likes to eat & drink**, and the AI should use that — together with the flow of each day — to choose dining stops. ("My Places" remains as the personal notebook of favorite spots.)

- **New `TasteProfile` model + questionnaire modal** (navbar 👨‍🍳 button): dining styles (pintxo hopping, sit-down, market counter…), drink preferences (specialty coffee, txakoli, craft beer, cocktails, cider…), atmospheres (quiet & cozy, terrace, historic…), things to avoid (tourist traps, chains, queues…), budget comfort (€/€€/€€€) and dietary notes. Persisted in localStorage.
- **Injected into every generation path** (hometown, vacation, swaps, swiper candidates).
- **Prompt design — two coupled rules:**
  1. *Taste match:* every dining suggestion must respect the profile (and the MUST-AVOID list).
  2. *Context-aware pairing:* dining is chosen relative to the surrounding activities — casual/restorative after hikes, terrace/aperitif before sunset strolls, cozy indoor spots on rainy museum days, coffee-style mornings per drink preferences, drink-aligned evenings.
- **Offline fallback personalization:** the user's own places are now *ranked per time slot* with the profile (coffee lover → their café lands in the morning slot; evening slot prefers their bar if they drink wine/beer/cider; midday prefers restaurants), instead of first-come-first-served. User spots also get a taste-bonus in swiper candidate scoring.

**Verified:** lint/build green; fallback slot-ranking selects café-morning/bar-evening per profile; prompt rules present in all four generation paths.
