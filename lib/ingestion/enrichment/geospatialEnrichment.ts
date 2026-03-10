import { db } from "@/lib/db";
import { getCurrentReferenceLayerSnapshot } from "@/lib/ingestion/enrichment/referenceLayers";

export type EnrichmentResult = {
  nearestRoadMeters?: number;
  nearestTrailMeters?: number;
  nearestWaterMeters?: number;
  elevationMeters?: number;
  adminMembership?: Record<string, unknown>;
  protectedAreaMembership?: Record<string, unknown>;
  method: string;
  referenceLayerSnapshot?: Record<string, string>;
};

export async function enrichLocationFromPointWkt(pointWkt: string): Promise<EnrichmentResult> {
  if (!db) {
    return {
      nearestRoadMeters: 1200,
      nearestTrailMeters: 450,
      nearestWaterMeters: 900,
      elevationMeters: 1720,
      adminMembership: { state: "demo", county: "demo-county" },
      protectedAreaMembership: { inProtectedArea: false },
      method: "demo-fallback",
      referenceLayerSnapshot: { hydrography: "demo-v1", roads: "demo-v1", trails: "demo-v1", admin_boundaries: "demo-v1", protected_areas: "demo-v1" }
    };
  }

  const sql = `
    WITH p AS (SELECT ST_GeomFromText($1, 4326) AS geom)
    SELECT
      (SELECT ST_Distance(p.geom::geography, r.geom::geography) FROM gis_roads r ORDER BY r.geom <-> p.geom LIMIT 1) AS nearest_road_m,
      (SELECT ST_Distance(p.geom::geography, t.geom::geography) FROM gis_trails t ORDER BY t.geom <-> p.geom LIMIT 1) AS nearest_trail_m,
      (SELECT ST_Distance(p.geom::geography, h.geom::geography) FROM gis_hydrography h ORDER BY h.geom <-> p.geom LIMIT 1) AS nearest_water_m,
      0::numeric AS elevation_m,
      (SELECT coalesce(jsonb_object_agg(b.admin_type, b.admin_name), '{}'::jsonb)
       FROM gis_admin_boundaries b
       WHERE ST_Contains(b.geom, p.geom)) AS admin_membership,
      (
        SELECT jsonb_build_object(
          'inProtectedArea', true,
          'unitName', pa.unit_name,
          'designation', pa.designation
        )
        FROM gis_protected_areas pa
        WHERE ST_Contains(pa.geom, p.geom)
        LIMIT 1
      ) AS protected_membership
    FROM p;
  `;

  const { rows } = await db.query(sql, [pointWkt]);
  const row = rows[0] || {};
  const referenceLayerSnapshot = await getCurrentReferenceLayerSnapshot();

  return {
    nearestRoadMeters: Number(row.nearest_road_m || 0),
    nearestTrailMeters: Number(row.nearest_trail_m || 0),
    nearestWaterMeters: Number(row.nearest_water_m || 0),
    elevationMeters: Number(row.elevation_m || 0),
    adminMembership: row.admin_membership || {},
    protectedAreaMembership: row.protected_membership || { inProtectedArea: false },
    method: "postgis-nearest",
    referenceLayerSnapshot
  };
}
