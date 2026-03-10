import { db } from "@/lib/db";
import { demoIssues, demoSnapshots } from "@/lib/ingestion/demoStore";
import { listReferenceLayerVersions, markStaleEnvironmentSnapshots } from "@/lib/ingestion/enrichment/referenceLayers";

export async function listIngestionRuns() {
  if (!db) {
    return demoSnapshots.map((snapshot, idx) => ({
      id: `run-${idx + 1}`,
      job_type: `${snapshot.sourceSystem}_${snapshot.sourceChannel}_ingest`,
      status: "success",
      started_at: snapshot.snapshotAt,
      finished_at: snapshot.snapshotAt,
      summary: { snapshotId: snapshot.id }
    }));
  }

  const { rows } = await db.query(`SELECT * FROM ingestion_job_run ORDER BY started_at DESC LIMIT 200`);
  return rows;
}

export async function listIngestionIssues(filters: { severity?: string; reviewed?: string } = {}) {
  if (!db) return demoIssues;
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (filters.severity) {
    values.push(filters.severity);
    clauses.push(`severity = $${values.length}`);
  }
  if (filters.reviewed === "reviewed") clauses.push(`review_status = 'reviewed'`);
  if (filters.reviewed === "unreviewed") clauses.push(`review_status = 'unreviewed'`);
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const { rows } = await db.query(`SELECT * FROM ingestion_issue ${where} ORDER BY created_at DESC LIMIT 500`, values);
  return rows;
}

export async function markIssueReviewed(issueId: string, reviewedBy = "operator") {
  if (!db) return { ok: false };
  await db.query(`UPDATE ingestion_issue SET review_status = 'reviewed', reviewed_by = $2, reviewed_at = now() WHERE id = $1`, [issueId, reviewedBy]);
  return { ok: true };
}

export async function listMergeDecisions(caseId?: string) {
  if (!db) return [];
  const values: unknown[] = [];
  const where = caseId ? (values.push(caseId), `WHERE case_id = $1`) : "";
  const { rows } = await db.query(`SELECT * FROM reconciliation_decision ${where} ORDER BY created_at DESC LIMIT 500`, values);
  return rows;
}

export async function listSpatialEnrichmentSnapshots(filters: { stale?: string } = {}) {
  if (!db) return [];
  await markStaleEnvironmentSnapshots();
  const staleWhere = filters.stale === "true" ? "AND stale_reference_data = true" : filters.stale === "false" ? "AND stale_reference_data = false" : "";
  const { rows } = await db.query(
    `SELECT * FROM environment_snapshot WHERE source = 'postgis_reference_layers' ${staleWhere} ORDER BY captured_at DESC LIMIT 500`
  );
  return rows;
}

export async function listReferenceLayerInventory() {
  return listReferenceLayerVersions();
}

export async function listConflicts(filters: { reviewStatus?: string; severity?: string; caseId?: string } = {}) {
  if (!db) return [];
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (filters.reviewStatus) {
    values.push(filters.reviewStatus);
    clauses.push(`review_status = $${values.length}`);
  }
  if (filters.severity) {
    values.push(filters.severity);
    clauses.push(`severity = $${values.length}`);
  }
  if (filters.caseId) {
    values.push(filters.caseId);
    clauses.push(`case_id = $${values.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const { rows } = await db.query(`SELECT * FROM case_conflict ${where} ORDER BY created_at DESC LIMIT 500`, values);
  return rows;
}

export async function markConflictReviewed(conflictId: string, reviewedBy = "operator") {
  if (!db) return { ok: false };
  await db.query(`UPDATE case_conflict SET review_status = 'reviewed', reviewed_by = $2, reviewed_at = now() WHERE id = $1`, [conflictId, reviewedBy]);
  return { ok: true };
}

export async function listSourceExtractionReview(filters: { sourceType?: string; confidenceMin?: number } = {}) {
  if (!db) return [];
  const clauses = [`ss.source_channel IN ('html','pdf')`];
  const values: unknown[] = [];
  if (filters.sourceType) {
    values.push(filters.sourceType);
    clauses.push(`ss.source_channel = $${values.length}`);
  }
  if (filters.confidenceMin !== undefined) {
    values.push(filters.confidenceMin);
    clauses.push(`sr.parse_confidence >= $${values.length}`);
  }
  const { rows } = await db.query(
    `SELECT sr.id, sr.source_record_key, sr.parse_confidence, sr.parsed_payload, ss.source_uri, ss.source_channel, ss.snapshot_at
     FROM source_record sr
     JOIN source_snapshot ss ON ss.id = sr.snapshot_id
     WHERE ${clauses.join(" AND ")}
     ORDER BY ss.snapshot_at DESC
     LIMIT 500`,
    values
  );
  return rows;
}
