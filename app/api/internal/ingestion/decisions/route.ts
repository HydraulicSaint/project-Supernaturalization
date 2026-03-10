import { NextRequest, NextResponse } from "next/server";
import { listMergeDecisions } from "@/lib/repositories/ingestionRunsRepository";

export async function GET(request: NextRequest) {
  const caseId = request.nextUrl.searchParams.get("caseId") ?? undefined;
  const search = request.nextUrl.searchParams;
  return NextResponse.json(
    await listMergeDecisions(caseId, {
      limit: search.get("limit") ? Number(search.get("limit")) : undefined,
      offset: search.get("offset") ? Number(search.get("offset")) : undefined
    })
  );
}
