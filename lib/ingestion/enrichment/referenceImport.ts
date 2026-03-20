import fs from "node:fs";
import path from "node:path";

import shapefile from "shapefile";

import { db } from "@/lib/db";
import type { AuthenticatedOperator } from "@/lib/auth";
import { recordOperatorAction } from "@/lib/operatorAudit";

export type LayerType = "hydrography" | "roads" | "trails" | "admin_boundaries" | "protected_areas";
export type InputFormat = "geojson" | "shapefile" | "fgdb";

type ManifestEntry = {
  layer_type: LayerType;
  source_name: string;
  effective_version: string;
  input_format: InputFormat;
  source_paths: string[];
  layer_name?: string;
  provenance_notes?: string;
  source_srid?: number;
};

export type ReferenceManifest = {
  layers: ManifestEntry[];
};

type GeoJsonFeature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates?: unknown } | null;
};

const allowedGeomByLayer: Record<LayerType, string[]> = {
  hydrography: ["LineString", "MultiLineString", "Polygon", "MultiPolygon"],
  roads: ["LineString", "MultiLineString"],
  trails: ["LineString", "MultiLineString"],
  admin_boundaries: ["Polygon", "MultiPolygon"],
  protected_areas: ["Polygon", "MultiPolygon"]
};

function toAbs(p: string) {
  return path.isAbsolute(p) ? p : path.join(process.cwd(), p);
}

export async function loadFeatures(entry: ManifestEntry): Promise<{ features: GeoJsonFeature[]; issue?: Record<string, unknown> }> {
  if (entry.input_format === "fgdb") {
    return {
      features: [],
      issue: {
        issue_type: "unsupported_reference_format",
        message: "FGDB import is not available in the current runtime. Install GDAL/ogr2ogr support to enable it.",
        context: { input_format: entry.input_format, layer_name: entry.layer_name ?? null, source_paths: entry.source_paths }
      }
    };
  }

  if (entry.input_format === "geojson") {
    const raw = fs.readFileSync(toAbs(entry.source_paths[0]), "utf8");
    const parsed = JSON.parse(raw) as { features?: GeoJsonFeature[] };
    if (!Array.isArray(parsed.features)) {
      return { features: [], issue: { issue_type: "malformed_reference_layer", message: "GeoJSON missing features[]", context: { source: entry.source_paths[0] } } };
    }
    return { features: parsed.features };
  }

  const shpPath = entry.source_paths.find((item) => item.toLowerCase().endsWith(".shp"));
  if (!shpPath) {
    return { features: [], issue: { issue_type: "malformed_reference_layer", message: "Shapefile import requires .shp path", context: { source_paths: entry.source_paths } } };
  }
  const source = await shapefile.open(toAbs(shpPath));
  const features: GeoJsonFeature[] = [];
  while (true) {
    const next = await source.read();
    if (next.done) break;
    features.push({ type: "Feature", properties: next.value.properties ?? {}, geometry: next.value.geometry ?? null });
  }
  return { features };
}

function normalizeValue(value: unknown) {
  if (typeof value === "string") return value.trim().toLowerCase();
  return value;
}

export async function importReferenceLayersFromManifest(manifest: ReferenceManifest, actor: AuthenticatedOperator) {
  if (!db) throw new Error("DATABASE_URL is required");
  const results: Array<Record<string, unknown>> = [];

  for (const entry of manifest.layers) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const loaded = await loadFeatures(entry);
      if (loaded.issue) {
        await client.query(
          `INSERT INTO ingestion_issue (severity, issue_type, message, context, recoverable, reviewed_by)
           VALUES ('warning', $1, $2, $3, true, $4)`,
          [loaded.issue.issue_type, loaded.issue.message, JSON.stringify(loaded.issue.context ?? {}), actor.username]
        );
        await client.query("COMMIT");
        results.push({ layer_type: entry.layer_type, status: "unsupported_or_malformed", issue: loaded.issue });
        continue;
      }

      const features = loaded.features.filter((f) => !!f.geometry);
      const badGeom = features.find((f) => f.geometry && !allowedGeomByLayer[entry.layer_type].includes(f.geometry.type));
      if (badGeom?.geometry?.type) {
        await client.query("ROLLBACK");
        results.push({
          layer_type: entry.layer_type,
          status: "unsupported_geometry",
          issue: { issue_type: "unsupported_geometry_type", geometry_type: badGeom.geometry.type }
        });
        continue;
      }

      const geomSummary = features.reduce<Record<string, number>>((acc, item) => {
        if (!item.geometry?.type) return acc;
        acc[item.geometry.type] = (acc[item.geometry.type] ?? 0) + 1;
        return acc;
      }, {});

      const layerRes = await client.query(
        `INSERT INTO reference_layer_version
          (layer_source_name, layer_type, source_manifest, effective_version, feature_count, geometry_type_summary, provenance_notes, input_format, layer_name, source_paths, source_srid)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (layer_type, effective_version)
         DO UPDATE SET feature_count = EXCLUDED.feature_count,
                       geometry_type_summary = EXCLUDED.geometry_type_summary,
                       source_manifest = EXCLUDED.source_manifest,
                       provenance_notes = EXCLUDED.provenance_notes,
                       input_format = EXCLUDED.input_format,
                       layer_name = EXCLUDED.layer_name,
                       source_paths = EXCLUDED.source_paths,
                       source_srid = EXCLUDED.source_srid,
                       imported_at = now()
         RETURNING id`,
        [
          entry.source_name,
          entry.layer_type,
          JSON.stringify(entry),
          entry.effective_version,
          features.length,
          JSON.stringify(geomSummary),
          entry.provenance_notes ?? null,
          entry.input_format,
          entry.layer_name ?? null,
          JSON.stringify(entry.source_paths),
          entry.source_srid ?? 4326
        ]
      );
      const versionId = layerRes.rows[0].id;
      const tableMap: Record<LayerType, string> = {
        hydrography: "gis_hydrography",
        roads: "gis_roads",
        trails: "gis_trails",
        admin_boundaries: "gis_admin_boundaries",
        protected_areas: "gis_protected_areas"
      };

      await client.query(`DELETE FROM ${tableMap[entry.layer_type]} WHERE layer_version_id = $1`, [versionId]);

      const sourceSrid = entry.source_srid ?? 4326;
      const geomSql = sourceSrid === 4326 ? "ST_SetSRID(ST_GeomFromGeoJSON($5), 4326)" : `ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($5), ${sourceSrid}), 4326)`;
      for (const feature of features) {
        const props = feature.properties ?? {};
        const geomJson = JSON.stringify(feature.geometry);
        if (entry.layer_type === "hydrography") {
          await client.query(
            `INSERT INTO gis_hydrography (layer_version_id, feature_name, feature_class, source_dataset, geom)
             VALUES ($1,$2,$3,$4, ${geomSql})`,
            [versionId, props.name ?? null, props.class ?? null, entry.source_name, geomJson]
          );
        } else if (entry.layer_type === "roads") {
          await client.query(
            `INSERT INTO gis_roads (layer_version_id, road_name, road_class, source_dataset, geom)
             VALUES ($1,$2,$3,$4, ${geomSql})`,
            [versionId, props.name ?? null, props.class ?? null, entry.source_name, geomJson]
          );
        } else if (entry.layer_type === "trails") {
          await client.query(
            `INSERT INTO gis_trails (layer_version_id, trail_name, trail_class, source_dataset, geom)
             VALUES ($1,$2,$3,$4, ${geomSql})`,
            [versionId, props.name ?? null, props.class ?? null, entry.source_name, geomJson]
          );
        } else if (entry.layer_type === "admin_boundaries") {
          await client.query(
            `INSERT INTO gis_admin_boundaries (layer_version_id, admin_type, admin_name, admin_code, source_dataset, geom)
             VALUES ($1,$2,$3,$4,$5, ST_Multi(${geomSql}))`,
            [versionId, props.adminType ?? "unknown", props.adminName ?? "unknown", props.adminCode ?? null, entry.source_name, geomJson]
          );
        } else {
          await client.query(
            `INSERT INTO gis_protected_areas (layer_version_id, unit_name, designation, source_dataset, geom)
             VALUES ($1,$2,$3,$4, ST_Multi(${geomSql}))`,
            [versionId, props.name ?? "unknown", props.designation ?? null, entry.source_name, geomJson]
          );
        }
      }

      await client.query("COMMIT");
      results.push({
        layer_type: entry.layer_type,
        status: "imported",
        feature_count: features.length,
        version_id: versionId,
        geometry_type_summary: geomSummary,
        normalized_provenance: normalizeValue(entry.provenance_notes ?? null)
      });
    } catch (error) {
      await client.query("ROLLBACK");
      results.push({ layer_type: entry.layer_type, status: "failed", error: error instanceof Error ? error.message : String(error) });
    } finally {
      client.release();
    }
  }

  await recordOperatorAction({
    actorId: actor.operatorId,
    actorDisplayName: actor.displayName,
    authSource: actor.authSource,
    actionType: "import_reference_manifest",
    targetEntityType: "reference_layer_version",
    context: { layerCount: manifest.layers.length, username: actor.username, statuses: results.map((r) => r.status) }
  });

  return results;
}
