import { cases, environmentalSnapshots, locationEvents, sourceRecords } from "@/lib/mockData";
import { db } from "@/lib/db";

export async function listCases() {
  if (!db) return cases;
  const { rows } = await db.query("SELECT id, case_number FROM cases ORDER BY created_at DESC LIMIT 250");
  return rows;
}

export async function getCaseBundle(id: string) {
  if (!db) {
    const caseRecord = cases.find((c) => c.id === id);
    if (!caseRecord) return null;
    return {
      case: caseRecord,
      locationEvents: locationEvents.filter((l) => l.caseId === id),
      environmentalSnapshots,
      sourceRecords: sourceRecords.filter((s) => caseRecord.sourceRecordIds.includes(s.id))
    };
  }

  const caseResult = await db.query("SELECT * FROM cases WHERE id = $1", [id]);
  if (!caseResult.rowCount) return null;
  const events = await db.query("SELECT * FROM location_events WHERE case_id = $1 ORDER BY occurred_at", [id]);
  const sources = await db.query(
    `SELECT sr.* FROM source_records sr
     JOIN case_source_records csr ON csr.source_record_id = sr.id
     WHERE csr.case_id = $1`,
    [id]
  );

  return {
    case: caseResult.rows[0],
    locationEvents: events.rows,
    sourceRecords: sources.rows,
    environmentalSnapshots: []
  };
}
