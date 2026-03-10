import { NextResponse } from "next/server";
import { listReferenceLayerInventory } from "@/lib/repositories/ingestionRunsRepository";

export async function GET() {
  return NextResponse.json({ data: await listReferenceLayerInventory() });
}
