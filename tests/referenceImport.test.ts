import test from "node:test";
import assert from "node:assert/strict";

import { loadFeatures } from "@/lib/ingestion/enrichment/referenceImport";

test("fgdb manifests return structured unsupported issue", async () => {
  const result = await loadFeatures({
    layer_type: "roads",
    source_name: "nps_fgdb",
    effective_version: "v1",
    input_format: "fgdb",
    source_paths: ["fixtures/gis/fgdb/sample.gdb"],
    layer_name: "roads"
  });

  assert.equal(result.features.length, 0);
  assert.equal(result.issue?.issue_type, "unsupported_reference_format");
});

test("malformed geojson surfaces structured issue", async () => {
  const result = await loadFeatures({
    layer_type: "roads",
    source_name: "bad_geojson",
    effective_version: "v1",
    input_format: "geojson",
    source_paths: ["package.json"]
  });

  assert.equal(result.features.length, 0);
  assert.equal(result.issue?.issue_type, "malformed_reference_layer");
});
