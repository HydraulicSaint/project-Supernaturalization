import { db } from "@/lib/db";

export type LayerType = "hydrography" | "roads" | "trails" | "admin_boundaries" | "protected_areas";

export async function getCurrentReferenceLayerSnapshot() {
  if (!db) {
    return {
      hydrography: "demo-v1",
      roads: "demo-v1",
      trails: "demo-v1",
      admin_boundaries: "demo-v1",
      protected_areas: "demo-v1"
    };
  }

  const { rows } = await db.query(
    `SELECT DISTINCT ON (layer_type) layer_type, effective_version
     FROM reference_layer_version
     ORDER BY layer_type, imported_at DESC`
  );
  const snapshot: Record<string, string> = {};
  for (const row of rows) snapshot[row.layer_type] = row.effective_version;
  return snapshot;
}

export async function markStaleEnvironmentSnapshots() {
  if (!db) return { updated: 0 };

  const snapshot = await getCurrentReferenceLayerSnapshot();
  const { rowCount } = await db.query(
    `UPDATE environment_snapshot
     SET stale_reference_data = (
      coalesce(reference_layer_snapshot->>'hydrography','') <> $1 OR
      coalesce(reference_layer_snapshot->>'roads','') <> $2 OR
      coalesce(reference_layer_snapshot->>'trails','') <> $3 OR
      coalesce(reference_layer_snapshot->>'admin_boundaries','') <> $4 OR
      coalesce(reference_layer_snapshot->>'protected_areas','') <> $5
     )`,
    [
      snapshot.hydrography ?? "",
      snapshot.roads ?? "",
      snapshot.trails ?? "",
      snapshot.admin_boundaries ?? "",
      snapshot.protected_areas ?? ""
    ]
  );

  return { updated: rowCount ?? 0 };
}

export async function listReferenceLayerVersions() {
  if (!db) return [];
  const { rows } = await db.query(`SELECT * FROM reference_layer_version ORDER BY imported_at DESC LIMIT 500`);
  return rows;
}
