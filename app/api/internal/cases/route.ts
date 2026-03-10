import { NextRequest, NextResponse } from "next/server";
import { listCanonicalCases } from "@/lib/repositories/canonicalCasesRepository";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const data = await listCanonicalCases({
    source: search.get("source") ?? undefined,
    state: search.get("state") ?? undefined,
    status: search.get("status") ?? undefined,
    confidenceMin: search.get("confidenceMin") ? Number(search.get("confidenceMin")) : undefined
  });

  return NextResponse.json({ data });
}
