# ADR 001: isolated ATLAS observer

Status: initial implementation, 2026-10-25. Addresses #10; Phase 1 remains subject to browser and terrain validation.

## Repository audit

Primary source audited at main tree d7422fb05f359a298d986df8648d2e0066ee714d (retrieved through GitHub connector). Next 14.2.5 / React 18, MapLibre ^4.7.1 and deck.gl ^9 already exist. InvestigationMap owns a MapLibre instance plus deck scatterplots, uses demo tiles, and has no terrain/director abstraction. app/page.tsx uses mock investigation events. Preserve it and the operational routes.

lib/types.ts describes case-associated locations and named people, not a public environmental observation contract. db/schema.sql and migrations provide PostGIS geometries, source snapshots/records, reconciliation, confidence, reference-layer versions, derived metrics, and operator audit. These remain authoritative; no migrations are needed here. Internal APIs use lib/auth.ts signed HTTP-only operator sessions. Public /api/cases is not a wallpaper feed and is not used by ATLAS. Operator workflows are documented in docs/operators.md. Existing node:test/tsx tests cover auth, ingestion, reconciliation, GIS import and optional DB integration. Scripts expose lint, typecheck, test and build; lint lacks an installed ESLint configuration/dependency.

Related project-ARGUS audit: README, argus/storage.py, scanner/live_ping.py and alerts.py inspected. Python scanner fetches FIRMS, classifies thermal anomalies, persists scan_runs/tiles/detections in SQLite and optionally dispatches alerts. acq_datetime and created_at are distinct timestamps; confidence and anomaly score are distinct values. No suitable public read API was established from these inspected files. Do not import Python, scan from the browser, share SQLite directly, or interpret an anomaly score as verification.

## Decision and modules

Add /atlas, components/atlas/Atlas.tsx and scoped CSS. Reuse installed MapLibre directly; deck.gl is unnecessary for three synthetic points. Keep a single renderer across presentation changes. lib/atlas/director.ts is a deterministic pure state machine and serializable bounds profile with seeded round-robin coverage and exclusions. lib/atlas/observations.ts owns synthetic fixtures and an explicit public field projection. No backend requests, geolocation, account, paid service or new dependency.

Camera target selection and event filtering enforce profile bounds/exclusions. MapLibre maxBounds constrains manual center movement to the rectangular wander area. Exclusions currently prohibit destinations/events; they do NOT constrain every visible pixel, manual movement or the interpolated path. Full polygon route avoidance and terrain obstruction checks remain acceptance gaps. Presentation is orthogonal to the director; changing density must never call a camera method. Pause stops the animation; resume restarts the current phase from the actual camera location. Next chooses the next eligible POI; while paused it queues that target until Play. Reduced motion prohibits automatic travel. Hidden/unfocused pages stop travel. No unsupported claim of detecting Windows game mode.

## Terrain and licensing

Default is a self-contained blank geographic schematic with simulated markers, explicitly not real elevation. Opt-in Mapzen Terrarium tiles from AWS elevation-tiles-prod provide actual elevation without an API key. Encoding is terrarium, max zoom 14, exaggeration 1; hillshade uses the same DEM. Attribution: https://github.com/tilezen/joerd/blob/master/docs/attribution.md and https://registry.opendata.aws/terrain-tiles/. The elevation mosaic has multiple upstream licenses/attributions; this is not a blanket claim of public domain. Preserve provider/source attribution and review terms before redistributing tiles. No tiles or game assets bundled. MapLibre is BSD-3-Clause. Network use is explicit because tile coordinates disclose viewed geography. Runtime tile failure leaves synthetic data intact and reports a warning.

## Future read contract

Phase 2 should provide a versioned read-only normalized envelope: observations[], attribution[], generatedAt, cachedAt, expiresAt, nextCursor. Queries: bbox OR radius, from/to, category, bounded page size. Observation fields: id, category, source, geometry/precision, occurredAt, observedAt, sourceTimestamp, confidence, provenance, display priority, simulated/inferred flags. Keep anomaly score separately named. Query existing spatial indexes, retain provenance references, and apply an explicit public source allowlist and spatial coarsening BEFORE serialization. Private cases/notes/tokens never enter this adapter. Authenticate private endpoints with existing sessions. Propose bounded backend cache (initially 5 minutes), source-aware freshness and conditional requests; no browser scanner/polling. ARGUS export/API changes belong in a separate ARGUS issue/PR when implemented.

## Risks and sequence

1. Validate pure director/profile/privacy behavior; then typecheck/build and browser interaction.
2. Verify AWS coverage, licenses and terrain rendering around all three POIs on normal and ultrawide displays.
3. Measure frame time, memory, tile count and idle GPU use on low-power hardware. Current caps: zoom 14, tile cache 128, no perpetual animation loop outside MapLibre transitions, no data polling.
4. Complete terrain-aware paths, exclusion path rules, adjustable quality, context recovery, preloading and screenshot evidence before declaring all Phase 1 acceptance met.
5. Lively assessment: browser fullscreen is available now. Lively can host the compiled web route via URL, but packaging/offline tile licensing, host pause callbacks and Windows fullscreen-game throttling need a separate Windows test. No host dependency in core.

Development environment initially could not reach its shell proxy. Source retrieval used the GitHub connector rather than bypassing networking. See README validation record for actual checks; no performance or visual pass is inferred from unit tests.
