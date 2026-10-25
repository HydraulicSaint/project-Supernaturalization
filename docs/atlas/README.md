# ARGUS | ATLAS development slice

Run Node 20+ and `npm ci`, then `npm run dev`; open http://localhost:3000/atlas. PostgreSQL, FIRMS keys and a wallpaper host are unnecessary. Existing / and /admin are preserved.

Start with Info / Attributions. Enable network terrain to load real Needle Mountains relief from the attributed public Mapzen/AWS Terrarium source (no key); without it, the view is an explicitly labeled blank schematic. Tile requests disclose the viewed area to AWS. This is not a live feed. All three events are static simulated fixtures with source timestamps, confidence and uncertainty; synthetic confidence does not verify anything.

- Play/pause: start or stop automatic travel. Movement is off initially and disabled with OS reduced motion. Hidden/unfocused tabs stop travel.
- Next POI: queue the next deterministic viewpoint; Play travels to it.
- Overview: return to a strategic view. Ambient, Survey and Analysis change overlay density independently of the camera.
- Analysis: manual drag/zoom pauses travel; inspect event details or edit the local JSON wander profile. Load current profile, edit, then Apply & save. Invalid bounds/excluded POIs are rejected. Local storage failures retain session settings.
- Fullscreen: browser convenience; Escape exits. Lively is not required.

Profile uses one bounding box, three curated POIs, seed and one rectangular exclusion. Exclusions filter destinations and events; they do not yet constrain every camera path or manual movement inside the outer box. Event halos are symbolic, not metrically accurate buffers. Terrain has no offline cache, obstruction avoidance or preloading guarantee. Context loss pauses with a reload message; toggle terrain to recreate the renderer. No Windows host/game-mode integration, event diversions, time playback, polygon profiles, quality panel or real data API yet.

The layout uses a full viewport canvas and bounded overlays, intended for 16:9 and 5120×1440; browser visual verification and low-power profiling remain required. No screenshots or performance figures are claimed without measurements. See architecture.md for decisions, licensing, API contract and Phase 2 backlog.

Validation commands: `npm run typecheck`, `npm test`, `npm run build`, `npm run lint`. DB integration requires configured PostGIS. Initial dependency install was blocked by the execution environment proxy; final results are recorded in the draft PR.

Validation result (2026-10-25): typecheck and production build passed; `node --import tsx --test --test-isolation=none tests/*.test.ts` passed 30 tests, with one DB suite skipped (no PostGIS). The normal tsx CLI could not open its sandbox IPC socket; the Node loader command runs the same test sources. Lint enters the existing ESLint setup prompt and is not a completed lint pass. Browser visuals, terrain access and performance remain unverified. Production /atlas first-load JS: approximately 300 kB (Next build report); this is bundle size, not a GPU measurement.
