import { NextRequest, NextResponse } from "next/server";
import { listReferenceLayerInventory } from "@/lib/repositories/ingestionRunsRepository";
import { requireAuthenticatedOperator } from "@/lib/auth";
import { importReferenceLayersFromManifest } from "@/lib/ingestion/enrichment/referenceImport";

export async function GET() {
  return NextResponse.json({ data: await listReferenceLayerInventory() });
}

export async function POST(request: NextRequest) {
  const { operator, response } = requireAuthenticatedOperator(request);
  if (!operator) return response;

  const payload = await request.json();
  if (!payload?.layers || !Array.isArray(payload.layers)) {
    return NextResponse.json({ error: "manifest.layers[] required" }, { status: 400 });
  }
  return NextResponse.json({ data: await importReferenceLayersFromManifest(payload, operator) });
}
