import fs from "node:fs";
import path from "node:path";

import { importReferenceLayersFromManifest, ReferenceManifest } from "@/lib/ingestion/enrichment/referenceImport";

async function run() {
  const manifestPath = process.argv[2] ?? path.join(process.cwd(), "fixtures/gis/reference_manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as ReferenceManifest;
  const actor = {
    operatorId: process.env.OPERATOR_ACTOR_ID ?? "cli-operator",
    username: process.env.OPERATOR_USERNAME ?? "cli-operator",
    displayName: process.env.OPERATOR_DISPLAY_NAME ?? "CLI Operator",
    role: process.env.OPERATOR_ROLE ?? "admin",
    authSource: "cli"
  };

  const results = await importReferenceLayersFromManifest(manifest, actor);
  console.log(JSON.stringify({ actorId: actor.operatorId, results }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
