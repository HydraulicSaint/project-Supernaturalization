import test from "node:test";
import assert from "node:assert/strict";

import { enrichLocationFromPointWkt } from "@/lib/ingestion/enrichment/geospatialEnrichment";
import { getCurrentReferenceLayerSnapshot, markStaleEnvironmentSnapshots } from "@/lib/ingestion/enrichment/referenceLayers";
import { rerunEnrichmentForBatch } from "@/lib/ingestion/jobs/jobRunner";

test("reference layer snapshot returns deterministic demo values without db", async () => {
  const snapshot = await getCurrentReferenceLayerSnapshot();
  assert.equal(snapshot.hydrography, "demo-v1");
});

test("enrichment includes reference layer snapshot metadata", async () => {
  const result = await enrichLocationFromPointWkt("POINT(-97.772 30.263)");
  assert.equal(result.referenceLayerSnapshot?.roads, "demo-v1");
});

test("stale marker no-ops in demo mode", async () => {
  const result = await markStaleEnvironmentSnapshots();
  assert.equal(result.updated, 0);
});

test("batch re-enrichment path executes", async () => {
  const result = await rerunEnrichmentForBatch(["case-001", "case-unknown"]);
  assert.equal(result.ok, true);
});
