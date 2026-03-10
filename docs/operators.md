# Operator Runbook

## Importing snapshots

1. Place incoming source files under a dated intake folder.
2. Run adapter-specific import command (sample: `npm run import:sample`).
3. Verify snapshot metadata and issues through:
   - `GET /api/internal/ingestion/runs`
   - `GET /api/internal/ingestion/issues`

## Reconciliation behavior

- Every run creates a new `source_snapshot` candidate state.
- `source_record.record_hash` is compared to prior snapshot state by record key.
- Missing records are marked as no longer visible; canonical cases are retained.

## Confidence/provenance inspection

- Case/source confidence appears in canonical payloads and case-source links.
- Location confidence uses explicit ladder values; centroid approximations are flagged.
- Derived/enrichment outputs include provenance JSON for method/source traceability.

## Failure handling

- Parsing and field confidence issues should be captured in `ingestion_issue`.
- Issues are recoverable by default and should not fail whole ingestion jobs unless configured.
