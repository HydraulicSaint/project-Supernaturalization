import { db } from "@/lib/db";

export type EnrichmentResult = {
  nearestRoadMeters?: number;
  nearestTrailMeters?: number;
  nearestWaterMeters?: number;
  elevationMeters?: number;
  adminMembership?: Record<string, unknown>;
  method: string;
};

export async function enrichLocationFromPointWkt(pointWkt: string): Promise<EnrichmentResult> {
  if (!db) {
    return {
      nearestRoadMeters: 1200,
      nearestTrailMeters: 450,
      nearestWaterMeters: 900,
      elevationMeters: 1720,
      adminMembership: { state: "demo", county: "demo-county" },
      method: "demo-fallback"
    };
  }

  const sql = `
    WITH p AS (SELECT ST_GeomFromText($1, 4326) AS geom)
    SELECT
      (SELECT ST_Distance(p.geom::geography, r.geom::geography) FROM gis_roads r ORDER BY r.geom <-> p.geom LIMIT 1) AS nearest_road_m,
      (SELECT ST_Distance(p.geom::geography, t.geom::geography) FROM gis_trails t ORDER BY t.geom <-> p.geom LIMIT 1) AS nearest_trail_m,
      (SELECT ST_Distance(p.geom::geography, h.geom::geography) FROM gis_hydro h ORDER BY h.geom <-> p.geom LIMIT 1) AS nearest_water_m,
      (SELECT elevation_m FROM gis_dem ORDER BY geom <-> p.geom LIMIT 1) AS elevation_m,
      (SELECT jsonb_build_object('state', b.state_name, 'unit', b.unit_name) FROM gis_boundaries b WHERE ST_Contains(b.geom, p.geom) LIMIT 1) AS admin_membership
    FROM p;
  `;

  const { rows } = await db.query(sql, [pointWkt]);
  const row = rows[0] || {};
  return {
    nearestRoadMeters: Number(row.nearest_road_m || 0),
    nearestTrailMeters: Number(row.nearest_trail_m || 0),
    nearestWaterMeters: Number(row.nearest_water_m || 0),
    elevationMeters: Number(row.elevation_m || 0),
    adminMembership: row.admin_membership || {},
    method: "postgis-nearest"
  };
}
