import fs from "node:fs";
import path from "node:path";

import { importReferenceLayersFromManifest, ReferenceManifest } from "@/lib/ingestion/enrichment/referenceImport";

async function run() {
  const manifestPath = process.argv[2] ?? path.join(process.cwd(), "fixtures/gis/reference_manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as ReferenceManifest;
  const actorId = process.env.OPERATOR_ACTOR_ID ?? "cli-operator";

  const results = await importReferenceLayersFromManifest(manifest, actorId);
  console.log(JSON.stringify({ actorId, results }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
