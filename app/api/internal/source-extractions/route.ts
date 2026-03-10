import { NextRequest, NextResponse } from "next/server";
import { listSourceExtractionReview } from "@/lib/repositories/ingestionRunsRepository";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const data = await listSourceExtractionReview({
    sourceType: search.get("sourceType") ?? undefined,
    confidenceMin: search.get("confidenceMin") ? Number(search.get("confidenceMin")) : undefined
  });
  return NextResponse.json({ data });
}
