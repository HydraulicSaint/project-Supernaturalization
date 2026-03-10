import { NextRequest, NextResponse } from "next/server";
import { listReferenceLayerInventory } from "@/lib/repositories/ingestionRunsRepository";
import { resolveActorId } from "@/lib/operatorAudit";
import { importReferenceLayersFromManifest } from "@/lib/ingestion/enrichment/referenceImport";

export async function GET() {
  return NextResponse.json({ data: await listReferenceLayerInventory() });
}

export async function POST(request: NextRequest) {
  const payload = await request.json();
  if (!payload?.layers || !Array.isArray(payload.layers)) {
    return NextResponse.json({ error: "manifest.layers[] required" }, { status: 400 });
  }
  const actorId = resolveActorId(payload.actorId ?? request.headers.get("x-operator-id"));
  return NextResponse.json({ data: await importReferenceLayersFromManifest(payload, actorId) });
}
