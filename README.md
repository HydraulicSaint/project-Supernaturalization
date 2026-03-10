# Supernaturalization Ingestion Foundation

Evidence-first ingestion and normalization foundation for a geospatial missing-person investigation platform.

## Architecture Summary

- **Web app/API**: Next.js (App Router) provides internal inspection APIs and a basic admin inspection page.
- **Data layer**: PostgreSQL + PostGIS schema with explicit separation of immutable snapshots, parsed records, canonical entities, links, location events, enrichment, and operational logs.
- **Ingestion framework**:
  - adapters (source-specific parsing)
  - normalization/merge (deterministic canonicalization)
  - diff/reconciliation (snapshot hash comparison)
  - jobs (async/retry-friendly orchestration stubs)
  - enrichment (PostGIS-backed nearest-feature flow with fallback)
- **Operator ergonomics**: sample fixtures, import script, and inspection endpoints for cases/runs/issues.

## Repository Structure

- `app/api/internal/*`: minimal internal APIs for canonical case inspection, run/issues audit, and enrichment trigger.
- `app/admin/page.tsx`: queue-oriented internal review console.
- `lib/ingestion/adapters`: CSV, RSS, HTML scaffold, PDF scaffold, manual JSON scaffold.
- `lib/ingestion/normalization`: canonical merge logic.
- `lib/ingestion/diff`: snapshot diffing by key+hash.
- `lib/ingestion/enrichment`: geospatial enrichment service.
- `lib/ingestion/jobs`: job entrypoints.
- `lib/repositories`: DB-backed repositories with fixture fallback.
- `db/migrations`: migration-first SQL schema.
- `fixtures`: NamUs-style CSV and NPS-style RSS samples.
- `docs`: operator docs.

## Data Model (Implemented)

Core tables in `db/migrations/001_foundation.sql`:
- `source_snapshot`
- `source_record`
- `case_canonical`
- `case_source_link`
- `location_event`
- `environment_snapshot`
- `derived_metric`
- `ingestion_job_run`
- `ingestion_issue`

Location fields support imprecision and method tracking:
- `reported_location_text`
- `geometry`, `geometry_type`
- `geom_method`
- `precision_meters`
- `location_confidence` enum ladder
- centroid fallback (`is_centroid`)

## Local Development

### 1) Start dependencies

```bash
docker compose up -d
```

### 2) Install and run app

```bash
npm install
npm run dev
```

### 3) Run sample ingest pipeline

```bash
npm run import:sample
```

### 4) Run tests

```bash
npm test
```

### 5) Load baseline GIS reference layers

```bash
npm run import:reference-gis
```

## Ingestion and Reconciliation

- Snapshot ingestion is modeled as **append-only snapshot + diff**, never perfect live-state.
- Raw payload/text/binary is stored in `source_snapshot`.
- Parsed items are stored in `source_record` with `record_hash` for diffing.
- Diff states: `added`, `changed`, `missing`, `unchanged`.
- Missing source records represent **visibility transitions** (not hard delete of canonical case).

## Minimal Internal API

- `GET /api/internal/cases`
  - Filters: `source`, `state`, `status`, `confidenceMin`
- `GET /api/internal/cases/:id`
- `GET /api/internal/ingestion/runs`
- `GET /api/internal/ingestion/issues`
- `GET /api/internal/conflicts`
- `GET /api/internal/ingestion/decisions`
- `GET /api/internal/enrichment/snapshots`
- `GET /api/internal/source-extractions`
- `POST /api/internal/enrichment/rerun` `{ "caseId": "...", "actorId": "ops-user" }`
- `POST /api/internal/reference/layers` (manifest-driven reference import)

## Confidence and Provenance

- Source-level confidence: `case_canonical.source_confidence`
- Field/link confidence: `case_source_link.field_confidence`, `link_confidence`
- Location confidence ladder: `location_confidence_ladder` enum
- Provenance JSON is carried across core entities (`case_canonical`, `location_event`, `environment_snapshot`, `derived_metric`)
- Inferred values are explicitly marked (`inferred_fields`, `is_inferred`)

## What is fully implemented

- Schema + migration for ingestion foundation
- Deterministic CSV (NamUs-style) adapter
- Deterministic RSS (NPS-style feed) adapter
- Snapshot hashing + diff logic
- Canonical merge logic
- Geospatial enrichment service interface with one real PostGIS nearest-feature query flow
- Minimal inspectable API + admin page
- Fixtures + sample import script + core ingestion tests

## What is stubbed

- HTML and PDF document adapters (scaffold only)
- Durable job queue (currently entrypoint pattern, no external queue backend)
- Persisting all ingestion outputs into DB in one orchestrated transaction worker
- Full remote sensing/environment providers beyond initial interfaces

## Recommended next steps (priority order)

1. Implement durable worker queue (BullMQ/Temporal) for ingestion + enrichment retries.
2. Add full DB write pipeline (snapshot -> records -> links -> canonical merge upserts).
3. Expand NPS document extraction pipeline (HTML selectors + PDF text parser before OCR fallback).
4. Add NCMEC poster/feed adapter with poster provenance semantics.
5. Add reference GIS ingestion tables (`gis_roads`, `gis_trails`, `gis_hydro`, `gis_boundaries`, DEM tiles).
6. Expand FGDB read support via GDAL-enabled environments and integration coverage.
7. Add middleware-backed authentication so actor identity is sourced from auth context, not request body/header.
