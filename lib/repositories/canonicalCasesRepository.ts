import { db } from "@/lib/db";
import { demoCases } from "@/lib/ingestion/demoStore";

type Filters = {
  source?: string;
  state?: string;
  status?: string;
  confidenceMin?: number;
};

export async function listCanonicalCases(filters: Filters) {
  if (!db) {
    return demoCases.filter((c) => {
      if (filters.source && c.sourceSystem !== filters.source) return false;
      if (filters.status && c.caseStatus !== filters.status) return false;
      if (filters.confidenceMin && (c.sourceConfidence ?? 0) < filters.confidenceMin) return false;
      if (filters.state && c.jurisdiction?.state !== filters.state) return false;
      return true;
    });
  }

  const clauses: string[] = [];
  const values: unknown[] = [];

  if (filters.status) {
    values.push(filters.status);
    clauses.push(`case_status = $${values.length}`);
  }

  if (filters.confidenceMin !== undefined) {
    values.push(filters.confidenceMin);
    clauses.push(`source_confidence >= $${values.length}`);
  }

  if (filters.state) {
    values.push(filters.state);
    clauses.push(`jurisdiction->>'state' = $${values.length}`);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const { rows } = await db.query(`SELECT * FROM case_canonical ${whereClause} ORDER BY updated_at DESC LIMIT 500`, values);
  return rows;
}

export async function getCanonicalCase(caseId: string) {
  if (!db) {
    return demoCases.find((c) => c.id === caseId || c.canonicalCaseRef === caseId) ?? null;
  }

  const caseResult = await db.query(`SELECT * FROM case_canonical WHERE id = $1 OR canonical_case_ref = $1`, [caseId]);
  if (!caseResult.rowCount) return null;

  const record = caseResult.rows[0];
  const [links, locations, environment, conflicts, decisions, issues, actions] = await Promise.all([
    db.query(
      `SELECT csl.*, sr.parsed_payload, sr.source_record_key, ss.source_system, ss.source_channel, ss.source_uri, ss.snapshot_at
       FROM case_source_link csl
       JOIN source_record sr ON sr.id = csl.source_record_id
       JOIN source_snapshot ss ON ss.id = sr.snapshot_id
       WHERE csl.case_id = $1
       ORDER BY csl.last_linked_at DESC`,
      [record.id]
    ),
    db.query(`SELECT *, ST_AsText(geometry) AS geometry_wkt FROM location_event WHERE case_id = $1 ORDER BY created_at DESC`, [record.id]),
    db.query(`SELECT * FROM environment_snapshot WHERE case_id = $1 ORDER BY captured_at DESC`, [record.id]),
    db.query(`SELECT * FROM case_conflict WHERE case_id = $1 ORDER BY created_at DESC`, [record.id]),
    db.query(`SELECT * FROM reconciliation_decision WHERE case_id = $1 ORDER BY created_at DESC`, [record.id]),
    db.query(
      `SELECT ii.* FROM ingestion_issue ii
       WHERE ii.source_record_id IN (
         SELECT source_record_id FROM case_source_link WHERE case_id = $1
       )
       ORDER BY ii.created_at DESC`,
      [record.id]
    ),
    db.query(
      `SELECT * FROM operator_action_audit
       WHERE target_entity_id = $1
          OR context->>'caseId' = $1
          OR context->'caseIds' ? $1
       ORDER BY created_at DESC`,
      [record.id]
    )
  ]);

  return {
    case: record,
    links: links.rows,
    locations: locations.rows,
    environment: environment.rows,
    conflicts: conflicts.rows,
    reconciliationDecisions: decisions.rows,
    ingestionIssues: issues.rows,
    operatorActions: actions.rows,
    relationshipSummary: {
      sourceRecords: links.rowCount,
      conflicts: conflicts.rowCount,
      decisions: decisions.rowCount,
      locationEvents: locations.rowCount,
      environmentSnapshots: environment.rowCount,
      ingestionIssues: issues.rowCount,
      operatorActions: actions.rowCount
    }
  };
}
