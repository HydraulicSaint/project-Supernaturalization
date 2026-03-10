import fs from "node:fs";
import path from "node:path";

import { db } from "@/lib/db";

type GeoJsonFeature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown };
};

type Manifest = {
  sourceName: string;
  effectiveVersion: string;
  provenanceNotes?: string;
  files: Array<{ layerType: "hydrography" | "roads" | "trails" | "admin_boundaries" | "protected_areas"; file: string }>;
};

async function importLayer(manifest: Manifest, layerType: Manifest["files"][number]["layerType"], file: string) {
  if (!db) throw new Error("DATABASE_URL is required");

  const filePath = path.join(process.cwd(), file);
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as { features: GeoJsonFeature[] };

  const geomSummary = parsed.features.reduce<Record<string, number>>((acc, item) => {
    acc[item.geometry.type] = (acc[item.geometry.type] ?? 0) + 1;
    return acc;
  }, {});

  const layerRes = await db.query(
    `INSERT INTO reference_layer_version
      (layer_source_name, layer_type, source_manifest, effective_version, feature_count, geometry_type_summary, provenance_notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (layer_type, effective_version)
     DO UPDATE SET feature_count = EXCLUDED.feature_count,
                   geometry_type_summary = EXCLUDED.geometry_type_summary,
                   source_manifest = EXCLUDED.source_manifest,
                   provenance_notes = EXCLUDED.provenance_notes,
                   imported_at = now()
     RETURNING id`,
    [manifest.sourceName, layerType, file, manifest.effectiveVersion, parsed.features.length, JSON.stringify(geomSummary), manifest.provenanceNotes ?? null]
  );
  const versionId = layerRes.rows[0].id;

  const layerToTable: Record<string, string> = {
    hydrography: "gis_hydrography",
    roads: "gis_roads",
    trails: "gis_trails",
    admin_boundaries: "gis_admin_boundaries",
    protected_areas: "gis_protected_areas"
  };

  await db.query(`DELETE FROM ${layerToTable[layerType]} WHERE layer_version_id = $1`, [versionId]);

  for (const feature of parsed.features) {
    const props = feature.properties;
    const geomJson = JSON.stringify(feature.geometry);
    if (layerType === "hydrography") {
      await db.query(
        `INSERT INTO gis_hydrography (layer_version_id, feature_name, feature_class, source_dataset, geom)
         VALUES ($1,$2,$3,$4, ST_SetSRID(ST_GeomFromGeoJSON($5), 4326))`,
        [versionId, props.name ?? null, props.class ?? null, manifest.sourceName, geomJson]
      );
    } else if (layerType === "roads") {
      await db.query(
        `INSERT INTO gis_roads (layer_version_id, road_name, road_class, source_dataset, geom)
         VALUES ($1,$2,$3,$4, ST_SetSRID(ST_GeomFromGeoJSON($5), 4326))`,
        [versionId, props.name ?? null, props.class ?? null, manifest.sourceName, geomJson]
      );
    } else if (layerType === "trails") {
      await db.query(
        `INSERT INTO gis_trails (layer_version_id, trail_name, trail_class, source_dataset, geom)
         VALUES ($1,$2,$3,$4, ST_SetSRID(ST_GeomFromGeoJSON($5), 4326))`,
        [versionId, props.name ?? null, props.class ?? null, manifest.sourceName, geomJson]
      );
    } else if (layerType === "admin_boundaries") {
      await db.query(
        `INSERT INTO gis_admin_boundaries (layer_version_id, admin_type, admin_name, admin_code, source_dataset, geom)
         VALUES ($1,$2,$3,$4,$5, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($6), 4326)))`,
        [versionId, props.adminType ?? "unknown", props.adminName ?? "unknown", props.adminCode ?? null, manifest.sourceName, geomJson]
      );
    } else if (layerType === "protected_areas") {
      await db.query(
        `INSERT INTO gis_protected_areas (layer_version_id, unit_name, designation, source_dataset, geom)
         VALUES ($1,$2,$3,$4, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($5), 4326)))`,
        [versionId, props.name ?? "unknown", props.designation ?? null, manifest.sourceName, geomJson]
      );
    }
  }

  return { layerType, versionId, featureCount: parsed.features.length };
}

async function run() {
  if (!db) throw new Error("DATABASE_URL is required");

  const manifestPath = process.argv[2] ?? path.join(process.cwd(), "fixtures/gis/reference_manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Manifest;

  const results = [];
  for (const entry of manifest.files) {
    results.push(await importLayer(manifest, entry.layerType, entry.file));
  }

  console.log(`Imported ${results.length} layers`, results);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
