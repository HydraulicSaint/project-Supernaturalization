import { NextRequest, NextResponse } from "next/server";
import { listSpatialEnrichmentSnapshots } from "@/lib/repositories/ingestionRunsRepository";

export async function GET(request: NextRequest) {
  const stale = request.nextUrl.searchParams.get("stale") ?? undefined;
  const search = request.nextUrl.searchParams;
  return NextResponse.json(
    await listSpatialEnrichmentSnapshots({
      stale,
      limit: search.get("limit") ? Number(search.get("limit")) : undefined,
      offset: search.get("offset") ? Number(search.get("offset")) : undefined
    })
  );
}
