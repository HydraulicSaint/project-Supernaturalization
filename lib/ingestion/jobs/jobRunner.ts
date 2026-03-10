import { enrichLocationFromPointWkt } from "@/lib/ingestion/enrichment/geospatialEnrichment";
import { demoCases } from "@/lib/ingestion/demoStore";

export async function rerunEnrichmentForCase(caseId: string) {
  const found = demoCases.find((item) => item.id === caseId);
  if (!found) {
    return { ok: false, message: "case not found" };
  }

  const pointWkt = found.locations?.find((location) => location.geometryWkt)?.geometryWkt;
  if (!pointWkt) {
    return { ok: false, message: "no geometry available for enrichment" };
  }

  const enrichment = await enrichLocationFromPointWkt(pointWkt);
  return { ok: true, caseId, enrichment };
}
