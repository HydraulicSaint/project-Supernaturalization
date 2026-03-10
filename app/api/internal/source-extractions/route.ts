import { NextRequest, NextResponse } from "next/server";
import { listSourceExtractionReview } from "@/lib/repositories/ingestionRunsRepository";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  return NextResponse.json(await listSourceExtractionReview({
    sourceType: search.get("sourceType") ?? undefined,
    confidenceMax: search.get("confidenceMax") ? Number(search.get("confidenceMax")) : 0.8,
    limit: search.get("limit") ? Number(search.get("limit")) : undefined,
    offset: search.get("offset") ? Number(search.get("offset")) : undefined
  }));
}
