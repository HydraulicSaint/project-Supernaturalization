import { db } from "@/lib/db";
import { demoIssues, demoSnapshots } from "@/lib/ingestion/demoStore";

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

export async function listIngestionIssues() {
  if (!db) return demoIssues;
  const { rows } = await db.query(`SELECT * FROM ingestion_issue ORDER BY created_at DESC LIMIT 500`);
  return rows;
}
