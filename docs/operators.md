# Operator Runbook

## Internal UX/navigation overview

The internal admin/operator experience is now organized around operator workflows instead of raw tables:

- `/admin` → **Evidence Board**
  - top summary strip for unreviewed issues, unreviewed conflicts, stale enrichment, low-confidence extractions, recent operator actions, and latest ingestion activity
  - high-signal action panels with preview rows and drilldown links
- `/admin/issues` → **Review Issues**
- `/admin/conflicts` → **Review Conflicts**
- `/admin/stale-enrichment` → **Refresh Stale Enrichment**
- `/admin/recent-changes` → **Inspect Recent Changes**
- `/admin/cases` → **Browse Cases**
- `/admin/reference-layers` → **Reference Layers**

Case drilldowns at `/admin/cases/[id]` are ordered as an evidence chain:
1. case summary/header
2. active issues/conflicts
3. source records / evidence sources
4. reconciliation decisions
5. location events
6. environment/enrichment snapshots with layer-version provenance
7. operator actions/history

## Intended operator workflow through the evidence board

1. Start at `/admin` and scan the summary strip.
2. Open the most urgent panel:
   - **Review Issues** for ingestion and extraction QA blockers
   - **Review Conflicts** for contradictory evidence
   - **Refresh Stale Enrichment** when layer versions changed
   - **Inspect Recent Changes** to understand what changed before re-entering a queue
3. From a queue row, open the linked case evidence page.
4. Use the case anchor navigation to move through the evidence chain without losing provenance.
5. Review direct values, normalized values, source payloads, reconciliation decisions, and audit history before taking action.

## Queue, drilldown, and review flow usage

### Issues queue

- list: `GET /api/internal/ingestion/issues?reviewed=unreviewed&sort=severity&limit=50&offset=0`
- intended use:
  - start with highest severity parser or ingestion problems
  - inspect linked case/source context
  - mark reviewed from the queue when the issue is understood and documented

### Conflicts queue

- list: `GET /api/internal/conflicts?reviewStatus=unreviewed&sort=severity&limit=50&offset=0`
- intended use:
  - open the linked case
  - compare direct vs normalized values
  - leave the contradiction visible; do not treat review as silent auto-resolution

### Stale enrichment queue

- list: `GET /api/internal/enrichment/snapshots?stale=true&limit=50&offset=0`
- intended use:
  - confirm which cases/snapshots are stale
  - open the case drilldown to inspect stored layer-version provenance
  - trigger case/batch/all-stale re-enrichment via the existing rerun endpoints when operationally appropriate

### Recent changes

- intended use:
  - inspect recent reconciliation decisions
  - inspect low-confidence extractions
  - inspect operator actions and recent ingestion runs together
  - use this page before and after queue work to maintain situational awareness

### Case drilldowns

Use `/admin/cases/[id]` when you need the complete evidence chain for a single case. The UX pass intentionally replaces JSON-heavy dumps with structured sections and expandable detail panels while keeping raw payloads and provenance one click away.

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

## What was intentionally not changed in this UX phase

- no public-facing product expansion
- no speculative analytics, anomaly scoring, or paranormal framing
- no backend architecture rewrite; only thin view-model and presentation helpers were added
- no reduction in provenance, conflict visibility, or auditability
- no direct canonical-field editing workflow
- no OCR workflow in the ingestion critical path
- no FGDB full read/import in environments without GDAL support
- no automated contradiction resolution

## Recommended next priorities

1. Add richer queue filters/sort affordances bound to URL params for heavy operator throughput.
2. Add authenticated operator identity wiring from internal auth/session context into review actions so UI feedback reflects the signed-in actor.
3. Add rerun controls with explicit success/error to stale-enrichment and case pages.
4. Expand case drilldowns with linked source-document previews where available.
5. Add pagination controls and saved queue views for larger operational datasets.
