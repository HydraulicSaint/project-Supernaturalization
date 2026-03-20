import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { db } from "@/lib/db";
import { persistAdapterResult } from "@/lib/ingestion/persistence/persistAdapterResult";
import { importReferenceLayersFromManifest, type ReferenceManifest } from "@/lib/ingestion/enrichment/referenceImport";
import { markIssueReviewed, listRecentActivitySummary } from "@/lib/repositories/ingestionRunsRepository";
import { rerunEnrichmentForBatch } from "@/lib/ingestion/jobs/jobRunner";
import type { AuthenticatedOperator } from "@/lib/auth";
import { getCanonicalCase } from "@/lib/repositories/canonicalCasesRepository";

const hasDb = !!db;
const actorA: AuthenticatedOperator = { operatorId: "operator-a", username: "analyst1", displayName: "Analyst One", role: "operator", authSource: "test" };
const actorB: AuthenticatedOperator = { operatorId: "operator-b", username: "analyst2", displayName: "Analyst Two", role: "operator", authSource: "test" };

function writeRuntimeShapefileFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "roads-shapefile-"));
  const base = path.join(dir, "roads_sample");
  const encoded: Record<string, string> = {
    shp: "AAAnCgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAXugDAAADAAAA4XoUrkdxWMDD9Shcj0I+QHE9CtejcFjAhetRuB5FPkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAoAwAAAOF6FK5HcVjAw/UoXI9CPkBxPQrXo3BYwIXrUbgeRT5AAQAAAAIAAAAAAAAA4XoUrkdxWMDD9Shcj0I+QHE9CtejcFjAhetRuB5FPkA=",
    shx: "AAAnCgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAANugDAAADAAAA4XoUrkdxWMDD9Shcj0I+QHE9CtejcFjAhetRuB5FPkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADIAAAAo",
    dbf: "A34DCgEAAABhAGUAAAAAAAAAAAAAAAAAAAAAAAAAAABuYW1lAAAAAAAAAEMAAAAAMgAAAAAAAAAAAAAAAAAAAGNsYXNzAAAAAAAAQwAAAAAyAAAAAAAAAAAAAAAAAAAADSBUZXN0IFJvYWQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvY2FsICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg"
  };

  for (const [ext, value] of Object.entries(encoded)) {
    fs.writeFileSync(`${base}.${ext}`, Buffer.from(value, "base64"));
  }

  fs.writeFileSync(
    `${base}.prj`,
    'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]]'
  );

  return { dir, shpPath: `${base}.shp` };
}

async function resetDb() {
  if (!db) return;
  const schema = fs.readFileSync("db/schema.sql", "utf8");
  await db.query(schema);
  await db.query(`TRUNCATE TABLE operator_action_audit, case_conflict, ingestion_issue, reconciliation_decision, ingestion_job_run, environment_snapshot, location_event, case_source_link, case_canonical, source_record, source_snapshot, gis_hydrography, gis_roads, gis_trails, gis_admin_boundaries, gis_protected_areas, reference_layer_version RESTART IDENTITY CASCADE`);
}

test("db integration suite", { skip: !hasDb }, async () => {
  await resetDb();
  const runtimeShapefile = writeRuntimeShapefileFixture();

  const baseSnapshot = {
    sourceSystem: "manual" as const,
    sourceChannel: "json" as const,
    ingestionMode: "snapshot" as const,
    snapshotAt: new Date().toISOString(),
    metadata: { fixture: true }
  };

  const adapterA = {
    snapshot: baseSnapshot,
    records: [{ sourceRecordKey: "src-1", parsedPayload: { name: "Case A" }, parseConfidence: 0.91 }],
    candidates: [{
      canonicalCaseRef: "CASE-100",
      displayName: "Case A",
      sourceSystem: "manual" as const,
      caseStatus: "open",
      demographics: { age: 34, sex: "female" },
      locations: [{ eventType: "last_known", geometryWkt: "POINT(-97.77 30.26)", locationConfidence: "city_or_general_area" as const }],
      provenance: { fixture: "a" }
    }],
    issues: [{ severity: "error" as const, issueType: "parse_warning", message: "needs review" }]
  };

  const adapterB = {
    ...adapterA,
    records: [{ sourceRecordKey: "src-2", parsedPayload: { name: "Case A alt" }, parseConfidence: 0.8 }],
    candidates: [{
      ...adapterA.candidates[0],
      demographics: { age: 39, sex: "female" },
      outcome: "located"
    }]
  };

  await persistAdapterResult(adapterA, { actorId: actorA.operatorId });
  await persistAdapterResult(adapterA, { actorId: actorA.operatorId });
  await persistAdapterResult(adapterB, { actorId: actorB.operatorId });

  const caseRow = await db!.query(`SELECT id FROM case_canonical WHERE canonical_case_ref = 'CASE-100'`);
  const caseId = caseRow.rows[0].id as string;

  const locationDedup = await db!.query(`SELECT COUNT(*)::int AS count FROM location_event WHERE case_id = $1`, [caseId]);
  assert.equal(locationDedup.rows[0].count, 1, "location fingerprint idempotency must deduplicate equivalent event");

  const conflicts = await db!.query(`SELECT COUNT(*)::int AS count FROM case_conflict WHERE case_id = $1`, [caseId]);
  assert.ok(conflicts.rows[0].count >= 1, "conflicts should persist for multi-source contradictory updates");

  const decisions = await db!.query(`SELECT COUNT(*)::int AS count FROM reconciliation_decision WHERE case_id = $1`, [caseId]);
  assert.ok(decisions.rows[0].count >= 1, "reconciliation decisions must be recorded");

  const manifest: ReferenceManifest = {
    layers: [
      {
        layer_type: "roads",
        source_name: "roads-shape-fixture",
        effective_version: "v-test-shp",
        input_format: "shapefile",
        source_paths: [runtimeShapefile.shpPath],
        source_srid: 4326
      },
      {
        layer_type: "hydrography",
        source_name: "hydro-srid-transform",
        effective_version: "v-test-transform",
        input_format: "geojson",
        source_paths: ["fixtures/gis/layers/hydrography.geojson"],
        source_srid: 3857
      }
    ]
  };
  const importResult = await importReferenceLayersFromManifest(manifest, actorA);
  assert.equal(importResult[0].status, "imported");

  const sridCheck = await db!.query(`SELECT ST_SRID(geom) AS srid FROM gis_hydrography LIMIT 1`);
  assert.equal(sridCheck.rows[0].srid, 4326);

  const badGeomManifest: ReferenceManifest = {
    layers: [{
      layer_type: "roads",
      source_name: "roads-bad-geom",
      effective_version: "v-bad-geom",
      input_format: "geojson",
      source_paths: ["fixtures/gis/layers/admin_boundaries.geojson"]
    }]
  };
  const badGeom = await importReferenceLayersFromManifest(badGeomManifest, actorA);
  assert.equal(badGeom[0].status, "unsupported_geometry");

  const issue = await db!.query(`SELECT id FROM ingestion_issue ORDER BY created_at DESC LIMIT 1`);
  await markIssueReviewed(issue.rows[0].id, actorA, "reviewed in integration test");
  await rerunEnrichmentForBatch([caseId], actorB);

  const snapshots = await db!.query(`SELECT COUNT(*)::int AS count FROM environment_snapshot WHERE case_id = $1`, [caseId]);
  assert.ok(snapshots.rows[0].count >= 1, "enrichment snapshots should persist");

  await db!.query(`UPDATE reference_layer_version SET imported_at = now() - interval '2 days'`);
  const staleRows = await db!.query(`SELECT COUNT(*)::int AS count FROM environment_snapshot WHERE case_id = $1 AND stale_reference_data = true`, [caseId]);
  assert.ok(staleRows.rows[0].count >= 0);

  const actions = await db!.query(`SELECT actor_id, actor_display_name, action_type FROM operator_action_audit ORDER BY created_at DESC LIMIT 10`);
  assert.ok(actions.rows.some((r) => r.actor_id === actorA.operatorId));
  assert.ok(actions.rows.some((r) => r.actor_id === actorB.operatorId));

  const caseDetail = await getCanonicalCase(caseId) as any;
  assert.ok(caseDetail && caseDetail.relationshipSummary.sourceRecords >= 1);

  const activity = await listRecentActivitySummary();
  assert.ok(Array.isArray(activity.ingestionRuns));

  fs.rmSync(runtimeShapefile.dir, { recursive: true, force: true });
});
