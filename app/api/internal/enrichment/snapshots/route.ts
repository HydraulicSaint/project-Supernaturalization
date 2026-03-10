import { NextRequest, NextResponse } from "next/server";
import { listSpatialEnrichmentSnapshots } from "@/lib/repositories/ingestionRunsRepository";

export async function GET(request: NextRequest) {
  const stale = request.nextUrl.searchParams.get("stale") ?? undefined;
  const data = await listSpatialEnrichmentSnapshots({ stale });
  return NextResponse.json({ data });
}
