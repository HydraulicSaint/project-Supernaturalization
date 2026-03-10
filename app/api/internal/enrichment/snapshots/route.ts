import { NextResponse } from "next/server";
import { listSpatialEnrichmentSnapshots } from "@/lib/repositories/ingestionRunsRepository";

export async function GET() {
  const data = await listSpatialEnrichmentSnapshots();
  return NextResponse.json({ data });
}
