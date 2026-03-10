import fs from "node:fs";
import path from "node:path";

import { db } from "@/lib/db";

type GeoJsonFeature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown };
};

async function run() {
  if (!db) {
    throw new Error("DATABASE_URL is required");
  }

  const filePath = path.join(process.cwd(), "fixtures/gis/reference_layers.geojson");
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as { features: GeoJsonFeature[] };

  for (const feature of parsed.features) {
    const props = feature.properties;
    const layer = String(props.layer ?? "");
    const geomJson = JSON.stringify(feature.geometry);

    if (layer === "hydrography") {
      await db.query(
        `INSERT INTO gis_hydrography (feature_name, feature_class, source_dataset, geom)
         VALUES ($1,$2,$3, ST_SetSRID(ST_GeomFromGeoJSON($4), 4326))`,
        [props.name ?? null, props.class ?? null, "baseline_fixture", geomJson]
      );
      continue;
    }

    if (layer === "roads") {
      await db.query(
        `INSERT INTO gis_roads (road_name, road_class, source_dataset, geom)
         VALUES ($1,$2,$3, ST_SetSRID(ST_GeomFromGeoJSON($4), 4326))`,
        [props.name ?? null, props.class ?? null, "baseline_fixture", geomJson]
      );
      continue;
    }

    if (layer === "trails") {
      await db.query(
        `INSERT INTO gis_trails (trail_name, trail_class, source_dataset, geom)
         VALUES ($1,$2,$3, ST_SetSRID(ST_GeomFromGeoJSON($4), 4326))`,
        [props.name ?? null, props.class ?? null, "baseline_fixture", geomJson]
      );
      continue;
    }

    if (layer === "admin_boundary") {
      await db.query(
        `INSERT INTO gis_admin_boundaries (admin_type, admin_name, admin_code, source_dataset, geom)
         VALUES ($1,$2,$3,$4, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($5), 4326)))`,
        [props.adminType ?? "unknown", props.adminName ?? "unknown", props.adminCode ?? null, "baseline_fixture", geomJson]
      );
      continue;
    }

    if (layer === "protected_area") {
      await db.query(
        `INSERT INTO gis_protected_areas (unit_name, designation, source_dataset, geom)
         VALUES ($1,$2,$3, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)))`,
        [props.name ?? "unknown", props.designation ?? null, "baseline_fixture", geomJson]
      );
    }
  }

  console.log(`Imported ${parsed.features.length} reference GIS features.`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
