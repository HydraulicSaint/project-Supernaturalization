import { db } from "@/lib/db";
import { enrichLocationFromPointWkt } from "@/lib/ingestion/enrichment/geospatialEnrichment";
import { markStaleEnvironmentSnapshots } from "@/lib/ingestion/enrichment/referenceLayers";
import { demoCases } from "@/lib/ingestion/demoStore";
import { persistAdapterResult } from "@/lib/ingestion/persistence/persistAdapterResult";
import { AdapterResult } from "@/lib/ingestion/types";
import { recordHash } from "@/lib/ingestion/utils/hash";

export type RunIngestionJobInput = {
  jobType: string;
  sourceSystem: string;
  triggerMode: "manual" | "schedule" | "rerun";
  maxAttempts?: number;
  payload: AdapterResult;
};

export function buildIngestionJobKey(input: Pick<RunIngestionJobInput, "jobType" | "sourceSystem" | "payload">) {
  return `${input.jobType}:${input.sourceSystem}:${recordHash(input.payload.snapshot)}`;
}

export async function runIngestionJob(input: RunIngestionJobInput) {
  if (!db) {
    throw new Error("DATABASE_URL is required for durable ingestion jobs");
  }

  const jobKey = buildIngestionJobKey(input);
  const maxAttempts = Math.max(1, input.maxAttempts ?? 3);

  const lockRes = await db.query(`SELECT pg_try_advisory_lock(hashtext($1)) AS locked`, [jobKey]);
  if (!lockRes.rows[0]?.locked) {
    return { status: "skipped", reason: "equivalent_job_in_progress" };
  }

  try {
    const existingSuccess = await db.query(
      `SELECT id, summary FROM ingestion_job_run WHERE job_key = $1 AND status = 'success' ORDER BY started_at DESC LIMIT 1`,
      [jobKey]
    );
    if (existingSuccess.rowCount) {
      return {
        status: "skipped",
        reason: "already_succeeded",
        runId: existingSuccess.rows[0].id,
        summary: existingSuccess.rows[0].summary
      };
    }

    let lastError: unknown = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const runRes = await db.query(
        `INSERT INTO ingestion_job_run (job_key, job_type, source_system, status, attempt, trigger_mode, summary)
         VALUES ($1,$2,$3,'running',$4,$5,$6)
         RETURNING id`,
        [jobKey, input.jobType, input.sourceSystem, attempt, input.triggerMode, JSON.stringify({})]
      );
      const runId = runRes.rows[0].id as string;

      try {
        const persisted = await persistAdapterResult(input.payload, { jobRunId: runId });
        const summary = {
          snapshotId: persisted.snapshotId,
          recordCount: persisted.recordCount,
          canonicalCount: persisted.canonicalCount,
          missingMarkedCount: persisted.missingMarkedCount
        };
        await db.query(
          `UPDATE ingestion_job_run
           SET status = 'success', finished_at = now(), summary = $2, error_message = NULL
           WHERE id = $1`,
          [runId, JSON.stringify(summary)]
        );
        return { status: "success", runId, attempt, summary };
      } catch (error) {
        lastError = error;
        const isLastAttempt = attempt >= maxAttempts;
        await db.query(
          `UPDATE ingestion_job_run
           SET status = $2, finished_at = now(), error_message = $3,
               summary = jsonb_build_object('retryable', $4, 'attempt', $5)
           WHERE id = $1`,
          [runId, isLastAttempt ? "failed" : "retrying", error instanceof Error ? error.message : String(error), !isLastAttempt, attempt]
        );
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  } finally {
    await db.query(`SELECT pg_advisory_unlock(hashtext($1))`, [jobKey]);
  }
}

export async function rerunEnrichmentForCase(caseId: string) {
  if (!db) {
    const found = demoCases.find((item) => item.id === caseId);
    if (!found) return { ok: false, message: "case not found" };
    const pointWkt = found.locations?.find((location) => location.geometryWkt)?.geometryWkt;
    if (!pointWkt) return { ok: false, message: "no geometry available for enrichment" };
    const enrichment = await enrichLocationFromPointWkt(pointWkt);
    return { ok: true, caseId, reEnriched: 1, enrichment };
  }

  const locations = await db.query(
    `SELECT le.id, ST_AsText(le.geometry) AS geometry_wkt
     FROM location_event le
     WHERE le.case_id = $1 AND le.geometry IS NOT NULL`,
    [caseId]
  );

  let count = 0;
  for (const row of locations.rows) {
    const enrichment = await enrichLocationFromPointWkt(row.geometry_wkt);
    await db.query(
      `INSERT INTO environment_snapshot
      (case_id, location_event_id, source, nearest_water_m, nearest_trail_m, nearest_road_m, elevation_m, admin_membership, park_membership, confidence_score, reference_layer_snapshot, stale_reference_data, provenance)
      VALUES ($1,$2,'postgis_reference_layers',$3,$4,$5,$6,$7,$8,$9,$10,false,$11)
      ON CONFLICT (location_event_id, source)
      DO UPDATE SET nearest_water_m = EXCLUDED.nearest_water_m,
                    nearest_trail_m = EXCLUDED.nearest_trail_m,
                    nearest_road_m = EXCLUDED.nearest_road_m,
                    elevation_m = EXCLUDED.elevation_m,
                    admin_membership = EXCLUDED.admin_membership,
                    park_membership = EXCLUDED.park_membership,
                    reference_layer_snapshot = EXCLUDED.reference_layer_snapshot,
                    stale_reference_data = false,
                    provenance = EXCLUDED.provenance,
                    captured_at = now()`,
      [
        caseId,
        row.id,
        enrichment.nearestWaterMeters ?? null,
        enrichment.nearestTrailMeters ?? null,
        enrichment.nearestRoadMeters ?? null,
        enrichment.elevationMeters ?? null,
        JSON.stringify(enrichment.adminMembership ?? {}),
        JSON.stringify(enrichment.protectedAreaMembership ?? {}),
        0.8,
        JSON.stringify(enrichment.referenceLayerSnapshot ?? {}),
        JSON.stringify({ method: enrichment.method, rerun: true })
      ]
    );
    count += 1;
  }

  return { ok: true, caseId, reEnriched: count };
}

export async function rerunEnrichmentForStale() {
  if (!db) return { ok: false, message: "DATABASE_URL required" };
  await markStaleEnvironmentSnapshots();
  const stale = await db.query(`SELECT DISTINCT case_id FROM environment_snapshot WHERE stale_reference_data = true AND case_id IS NOT NULL`);
  let cases = 0;
  for (const row of stale.rows) {
    await rerunEnrichmentForCase(row.case_id);
    cases += 1;
  }
  return { ok: true, cases };
}

export async function rerunEnrichmentForBatch(caseIds: string[]) {
  let cases = 0;
  for (const caseId of caseIds) {
    const res = await rerunEnrichmentForCase(caseId);
    if (res.ok) cases += 1;
  }
  return { ok: true, cases };
}
