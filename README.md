# Supernaturalization: Geospatial Investigation Platform

Initial implementation of a wilderness/remote missing-person investigation platform.

## Stack
- **Frontend**: Next.js (React), MapLibre GL JS, deck.gl overlays
- **Backend API**: Next.js Route Handlers (Node runtime)
- **Data**: PostgreSQL + PostGIS schema in `db/schema.sql`

## Core capabilities in this milestone
- Interactive map with MapLibre basemap and deck.gl high-density event overlay.
- Filter rail for status and biome narrowing.
- Case detail drawer with confidence badges and per-field source linkage.
- Provenance/source panel with source citations and trust scores.
- Timeline controls to scrub visible geospatial events.
- Structured import endpoint for case intake (`POST /api/cases`).
- Normalized data model split across:
  - `cases`
  - `source_records`
  - `location_events`
  - `environmental_snapshots`
  - `field_provenance`

## API
- `GET /api/cases` list cases (DB-backed when `DATABASE_URL` exists, otherwise mock).
- `GET /api/cases/:id` returns a case bundle.
- `POST /api/cases` validates structured import payload for ingestion pipeline handoff.

## Ingestion target design
Authoritative GIS overlays expected in ETL workers:
- Administrative and park boundaries
- Hydrography
- Elevation/terrain derivatives
- Trail network

These overlays enrich `environmental_snapshots` and should attach provenance in `field_provenance`.

## Future expansion
Schema includes `extracted_claims` to support:
- AI-assisted extraction
- contradiction detection
- environmental correlation analysis

## Run
```bash
npm install
npm run dev
```
