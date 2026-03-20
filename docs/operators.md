# Operator Runbook

## Internal auth model (first-party)

The internal/admin mutation APIs now require authenticated operator identity via a signed, HTTP-only session cookie.

### Login flow

1. Ensure `DATABASE_URL` is set and schema/migrations are applied.
2. `POST /api/internal/auth/login` with JSON body:
   - `username`
   - `password`
3. On success, server sets `internal_operator_session` cookie.
4. Optional identity check: `GET /api/internal/auth/me`.
5. Logout: `POST /api/internal/auth/logout`.

### Seeded local identities

`POST /api/internal/auth/login` triggers lightweight bootstrap (if missing):
- `analyst1` / `analyst1-change-me` (role: operator)
- `admin1` / `admin1-change-me` (role: admin)

> Replace passwords immediately in non-demo environments.

### Upgrade path

Current model is intentionally minimal (local password + signed cookie) and can be replaced with SSO/OIDC by swapping:
- credential verification in `authenticateOperator`
- session payload issuer/validator in `lib/auth.ts`
while preserving the same authenticated operator context shape.

## Authenticated identity propagation and audit

All mutation actions now use authenticated identity context, not header/body actor fallback:
- `PATCH /api/internal/ingestion/issues`
- `PATCH /api/internal/conflicts`
- `POST /api/internal/enrichment/rerun`
- `POST /api/internal/reference/layers`

Audit writes to `operator_action_audit` include:
- `actor_id` (stable operator id)
- `actor_display_name`
- `auth_source`
- `action_type`
- `target_entity_type`
- `target_entity_id`
- `created_at`
- optional `notes` and structured `context`

## Evidence drilldowns

### Case drilldown page

Use `/admin/cases/{caseId}` to trace full evidence chain for a case:
- source records
- active conflicts
- reconciliation decisions
- location events (with geometry WKT)
- environment snapshots (with stale markers)
- ingestion issues tied to source records
- operator actions tied to case/entity context

### API drilldown payload

- `GET /api/internal/cases/{id}` now returns:
  - `case`
  - `relationshipSummary`
  - `links`
  - `conflicts`
  - `reconciliationDecisions`
  - `locations`
  - `environment`
  - `ingestionIssues`
  - `operatorActions`

## Operational activity visibility

- Recent action feed + summary:
  - `GET /api/internal/activity/recent`
- Includes:
  - recent operator actions
  - recent ingestion runs
  - recent re-enrichment actions
  - recent reconciliation decisions
  - recent high-severity issues/conflicts

## Reference-layer import/versioning

1. Prepare manifest (see `fixtures/gis/reference_manifest.json`):
   - `layer_type`
   - `source_name`
   - `effective_version`
   - `input_format` (`geojson`, `shapefile`, `fgdb`)
   - `source_paths`
   - optional `layer_name`
   - optional `source_srid`
   - optional `provenance_notes`
2. Run import:
   - `npm run import:reference-gis -- fixtures/gis/reference_manifest.json`
3. Validate inventory/history:
   - `GET /api/internal/reference/layers`

Behavior notes:
- deterministic by `(layer_type, effective_version)`
- repeated import of same version replaces features for that version id
- GeoJSON and shapefile supported in current runtime
- FGDB records structured unsupported issues unless GDAL/ogr2ogr is available

## DB-backed integration tests

Local deterministic path:
1. Start Postgres/PostGIS:
   - `docker compose up -d`
2. Apply schema:
   - `psql "$DATABASE_URL" -f db/schema.sql`
3. Run integration test:
   - `npm run test:integration`

Integration coverage includes:
- adapter-output transactional persistence
- reconciliation decision persistence
- location-event idempotency fingerprints
- shapefile import to real PostGIS tables
- SRID transform handling
- geometry type validation handling
- enrichment snapshot persistence
- stale-enrichment detection path invocation
- conflict persistence for multi-source competing values
- authenticated operator audit persistence

## Internal queue usage

- `/admin` evidence board aggregates:
  - unreviewed issues/conflicts
  - stale enrichment
  - low-confidence source extraction
  - recent reconciliation decisions
  - recent operator actions

## Deferred (this phase)

- SSO/OIDC integration
- granular RBAC policy engine
- OCR fallback in ingestion critical path
- FGDB full import without GDAL runtime
