# Operator Runbook

## Reference-layer import/versioning

1. Prepare a manifest file (see `fixtures/gis/reference_manifest.json`) with per-layer entries including:
   - `layer_type`
   - `source_name`
   - `effective_version`
   - `input_format` (`geojson`, `shapefile`, `fgdb`)
   - `source_paths`
   - optional `layer_name` for multi-layer sources
   - optional `source_srid`
   - `provenance_notes`
2. Run import:
   - `npm run import:reference-gis -- fixtures/gis/reference_manifest.json`
3. Validate inventory/history:
   - `GET /api/internal/reference/layers`
4. Import behavior notes:
   - deterministic by `(layer_type, effective_version)`
   - repeated import of same version replaces features for that version id
   - spatial indexes remain at table level
   - GeoJSON and shapefile are supported now via the same manifest path.
   - FGDB receives structured unsupported issues in current runtime (unless GDAL/ogr2ogr is added).

## Re-enrichment workflow

- Enrichment snapshots persist a `reference_layer_snapshot` and `stale_reference_data` flag.
- Stale detection compares stored layer versions to current latest versions per layer type.
- Trigger paths:
  - single case: `POST /api/internal/enrichment/rerun {"caseId":"..."}`
  - batch cases: `POST /api/internal/enrichment/rerun {"mode":"batch","caseIds":["..."]}`
  - all stale: `POST /api/internal/enrichment/rerun {"mode":"stale"}`
- Review stale rows:
  - `GET /api/internal/enrichment/snapshots?stale=true`

## NPS/public document extraction

Supported now:
- HTML pages
- text-extractable PDFs

Not in critical path:
- OCR (deferred)

Document ingestion endpoint:
- `POST /api/internal/ingestion/documents`
- accepts URL manifest entries and optional `fixturePath` for local operator-driven ingestion/testing.

Extraction outputs include:
- confidence per field
- explicit inferred-vs-direct separation in provenance
- structured ingestion issues for partial parse misses

## Contradictions/conflicts

Conflicts are persisted to `case_conflict` and surfaced in API/admin views.
Current conflict primitives:
- conflicting status, missing date, location description/narrative
- conflicting demographics: age, sex/gender, race/ethnicity, height, weight
- conflicting outcomes: found alive/deceased and recovery/resolution-level disagreement
- conflicting identifiers/jurisdiction: case identifier mismatch and park disagreement

Storage behavior:
- directly observed competing values are persisted in `competing_values`
- normalized counterparts are persisted in `normalized_competing_values`
- system does not auto-resolve contradictions

Review workflow:
- list: `GET /api/internal/conflicts`
- filter: `reviewStatus`, `severity`, `caseId`
- mark reviewed: `PATCH /api/internal/conflicts {"conflictId":"..."}`

## Operator QA review actions

- mark ingestion issue reviewed:
  - `PATCH /api/internal/ingestion/issues {"issueId":"...","reviewedBy":"ops-user"}`
- mark conflict reviewed:
  - `PATCH /api/internal/conflicts {"conflictId":"...","reviewedBy":"ops-user"}`
- trigger re-enrichment:
  - endpoints listed above
- trigger document ingestion from URL/fixture manifest:
  - `POST /api/internal/ingestion/documents`

Audit identity:
- actor identity can be passed in `reviewedBy`/`actorId` request body fields or `x-operator-id` header
- actor-linked events are persisted to `operator_action_audit`

## Internal queue usage

- issues queue: `GET /api/internal/ingestion/issues?reviewed=unreviewed&sort=severity&limit=50&offset=0`
- conflicts queue: `GET /api/internal/conflicts?reviewStatus=unreviewed&sort=severity&limit=50&offset=0`
- stale enrichment queue: `GET /api/internal/enrichment/snapshots?stale=true&limit=50&offset=0`
- low-confidence extractions: `GET /api/internal/source-extractions?confidenceMax=0.75&limit=50&offset=0`
- recent reconciliation decisions: `GET /api/internal/ingestion/decisions?limit=50&offset=0`

## Intentionally deferred (this phase)

- direct canonical-field editing UI/actions
- OCR workflow in ingestion critical path
- FGDB full read/import in environments without GDAL support
- automated contradiction resolution (operators review; system does not silently overwrite)

## Recommended next priorities

1. Add shapefile/FGDB import adapters feeding the same manifest model.
2. Expand conflict primitives for demographics/outcome with structured value normalizers.
3. Add operator-side pagination and drilldown views for large issue/conflict queues.
4. Add audit actor identity propagation from internal auth context.
5. Introduce offline OCR sidecar for PDF fallback with explicit provenance separation.
