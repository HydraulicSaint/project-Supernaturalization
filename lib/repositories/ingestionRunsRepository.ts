import { db } from "@/lib/db";
import { demoIssues, demoSnapshots } from "@/lib/ingestion/demoStore";
import { listReferenceLayerVersions, markStaleEnvironmentSnapshots } from "@/lib/ingestion/enrichment/referenceLayers";
import { recordOperatorAction } from "@/lib/operatorAudit";
import type { AuthenticatedOperator } from "@/lib/auth";

type QueueFilters = { limit?: number; offset?: number; sort?: string };
const safeLimit = (n?: number) => Math.min(200, Math.max(1, n ?? 50));

export async function listIngestionRuns() {
  if (!db) {
    return demoSnapshots.map((snapshot, idx) => ({ id: `run-${idx + 1}`, job_type: `${snapshot.sourceSystem}_${snapshot.sourceChannel}_ingest`, status: "success", started_at: snapshot.snapshotAt, finished_at: snapshot.snapshotAt, summary: { snapshotId: snapshot.id } }));
  }
  const { rows } = await db.query(`SELECT * FROM ingestion_job_run ORDER BY started_at DESC LIMIT 200`);
  return rows;
}

export async function listIngestionIssues(filters: { severity?: string; reviewed?: string } & QueueFilters = {}) {
  if (!db) return { data: demoIssues, pagination: { limit: safeLimit(filters.limit), offset: 0, hasMore: false } };
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (filters.severity) { values.push(filters.severity); clauses.push(`severity = $${values.length}`); }
  if (filters.reviewed === "reviewed") clauses.push(`review_status = 'reviewed'`);
  if (filters.reviewed === "unreviewed") clauses.push(`review_status = 'unreviewed'`);
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const sort = filters.sort === "severity" ? "CASE severity WHEN 'error' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, created_at DESC" : "created_at DESC";
  const limit = safeLimit(filters.limit);
  const offset = Math.max(0, filters.offset ?? 0);
  values.push(limit, offset);
  const { rows } = await db.query(`SELECT * FROM ingestion_issue ${where} ORDER BY ${sort} LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
  return { data: rows, pagination: { limit, offset, hasMore: rows.length === limit } };
}

export async function markIssueReviewed(issueId: string, actor: AuthenticatedOperator, notes?: string) {
  if (!db) return { ok: false };
  await db.query(`UPDATE ingestion_issue SET review_status = 'reviewed', reviewed_by = $2, reviewed_at = now() WHERE id = $1`, [issueId, actor.username]);
  await recordOperatorAction({
    actorId: actor.operatorId,
    actorDisplayName: actor.displayName,
    authSource: actor.authSource,
    actionType: "review_issue",
    targetEntityType: "ingestion_issue",
    targetEntityId: issueId,
    notes,
    context: { username: actor.username, role: actor.role }
  });
  return { ok: true };
}

export async function listMergeDecisions(caseId?: string, filters: QueueFilters = {}) {
  if (!db) return { data: [], pagination: { limit: safeLimit(filters.limit), offset: 0, hasMore: false } };
  const values: unknown[] = [];
  const where = caseId ? (values.push(caseId), `WHERE case_id = $1`) : "";
  const limit = safeLimit(filters.limit); const offset = Math.max(0, filters.offset ?? 0);
  values.push(limit, offset);
  const { rows } = await db.query(`SELECT * FROM reconciliation_decision ${where} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
  return { data: rows, pagination: { limit, offset, hasMore: rows.length === limit } };
}

export async function listSpatialEnrichmentSnapshots(filters: { stale?: string } & QueueFilters = {}) {
  if (!db) return { data: [], pagination: { limit: safeLimit(filters.limit), offset: 0, hasMore: false } };
  await markStaleEnvironmentSnapshots();
  const staleWhere = filters.stale === "true" ? "AND stale_reference_data = true" : filters.stale === "false" ? "AND stale_reference_data = false" : "";
  const limit = safeLimit(filters.limit); const offset = Math.max(0, filters.offset ?? 0);
  const { rows } = await db.query(`SELECT * FROM environment_snapshot WHERE source = 'postgis_reference_layers' ${staleWhere} ORDER BY captured_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
  return { data: rows, pagination: { limit, offset, hasMore: rows.length === limit } };
}

export async function listReferenceLayerInventory() { return listReferenceLayerVersions(); }

export async function listConflicts(filters: { reviewStatus?: string; severity?: string; caseId?: string } & QueueFilters = {}) {
  if (!db) return { data: [], pagination: { limit: safeLimit(filters.limit), offset: 0, hasMore: false } };
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (filters.reviewStatus) { values.push(filters.reviewStatus); clauses.push(`review_status = $${values.length}`); }
  if (filters.severity) { values.push(filters.severity); clauses.push(`severity = $${values.length}`); }
  if (filters.caseId) { values.push(filters.caseId); clauses.push(`case_id = $${values.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const sort = filters.sort === "severity" ? "CASE severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, created_at DESC" : "created_at DESC";
  const limit = safeLimit(filters.limit); const offset = Math.max(0, filters.offset ?? 0);
  values.push(limit, offset);
  const { rows } = await db.query(`SELECT * FROM case_conflict ${where} ORDER BY ${sort} LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
  return { data: rows, pagination: { limit, offset, hasMore: rows.length === limit } };
}

export async function markConflictReviewed(conflictId: string, actor: AuthenticatedOperator, notes?: string) {
  if (!db) return { ok: false };
  await db.query(`UPDATE case_conflict SET review_status = 'reviewed', reviewed_by = $2, reviewed_at = now() WHERE id = $1`, [conflictId, actor.username]);
  await recordOperatorAction({
    actorId: actor.operatorId,
    actorDisplayName: actor.displayName,
    authSource: actor.authSource,
    actionType: "review_conflict",
    targetEntityType: "case_conflict",
    targetEntityId: conflictId,
    notes,
    context: { username: actor.username, role: actor.role }
  });
  return { ok: true };
}

export async function listSourceExtractionReview(filters: { sourceType?: string; confidenceMax?: number } & QueueFilters = {}) {
  if (!db) return { data: [], pagination: { limit: safeLimit(filters.limit), offset: 0, hasMore: false } };
  const clauses = [`ss.source_channel IN ('html','pdf')`];
  const values: unknown[] = [];
  if (filters.sourceType) { values.push(filters.sourceType); clauses.push(`ss.source_channel = $${values.length}`); }
  if (filters.confidenceMax !== undefined) { values.push(filters.confidenceMax); clauses.push(`sr.parse_confidence <= $${values.length}`); }
  const limit = safeLimit(filters.limit); const offset = Math.max(0, filters.offset ?? 0);
  values.push(limit, offset);
  const { rows } = await db.query(`SELECT sr.id, sr.source_record_key, sr.parse_confidence, sr.parsed_payload, ss.source_uri, ss.source_channel, ss.snapshot_at FROM source_record sr JOIN source_snapshot ss ON ss.id = sr.snapshot_id WHERE ${clauses.join(" AND ")} ORDER BY sr.parse_confidence ASC, ss.snapshot_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
  return { data: rows, pagination: { limit, offset, hasMore: rows.length === limit } };
}

export async function listRecentOperatorActions(filters: QueueFilters = {}) {
  if (!db) return { data: [], pagination: { limit: safeLimit(filters.limit), offset: 0, hasMore: false } };
  const limit = safeLimit(filters.limit); const offset = Math.max(0, filters.offset ?? 0);
  const { rows } = await db.query(
    `SELECT oa.*, cc.canonical_case_ref
     FROM operator_action_audit oa
     LEFT JOIN case_canonical cc ON cc.id::text = oa.target_entity_id
     ORDER BY oa.created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return { data: rows, pagination: { limit, offset, hasMore: rows.length === limit } };
}

export async function listRecentActivitySummary() {
  if (!db) return { ingestionRuns: [], reEnrichment: [], reconciliation: [], severeQueues: [] };
  const [ingestionRuns, reEnrichment, reconciliation, severeIssues, severeConflicts] = await Promise.all([
    db.query(`SELECT id, job_type, status, started_at, finished_at, summary, error_message FROM ingestion_job_run ORDER BY started_at DESC LIMIT 30`),
    db.query(`SELECT * FROM operator_action_audit WHERE action_type LIKE 'rerun_enrichment_%' ORDER BY created_at DESC LIMIT 30`),
    db.query(`SELECT * FROM reconciliation_decision ORDER BY created_at DESC LIMIT 30`),
    db.query(`SELECT * FROM ingestion_issue WHERE severity = 'error' ORDER BY created_at DESC LIMIT 20`),
    db.query(`SELECT * FROM case_conflict WHERE severity = 'high' ORDER BY created_at DESC LIMIT 20`)
  ]);
  return {
    ingestionRuns: ingestionRuns.rows,
    reEnrichment: reEnrichment.rows,
    reconciliation: reconciliation.rows,
    severeQueues: {
      ingestionIssues: severeIssues.rows,
      conflicts: severeConflicts.rows
    }
  };
}
