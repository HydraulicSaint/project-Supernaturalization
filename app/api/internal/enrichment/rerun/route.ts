import { NextRequest, NextResponse } from "next/server";
import { rerunEnrichmentForBatch, rerunEnrichmentForCase, rerunEnrichmentForStale } from "@/lib/ingestion/jobs/jobRunner";
import { requireAuthenticatedOperator } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { operator, response } = requireAuthenticatedOperator(request);
  if (!operator) return response;

  const payload = await request.json();
  if (payload.mode === "stale") {
    return NextResponse.json(await rerunEnrichmentForStale(operator));
  }

  if (payload.mode === "batch") {
    if (!Array.isArray(payload.caseIds) || payload.caseIds.length === 0) {
      return NextResponse.json({ error: "caseIds required for batch mode" }, { status: 400 });
    }
    return NextResponse.json(await rerunEnrichmentForBatch(payload.caseIds, operator));
  }

  if (!payload.caseId) {
    return NextResponse.json({ error: "caseId required" }, { status: 400 });
  }

  const result = await rerunEnrichmentForCase(payload.caseId, operator);
  if (!result.ok) {
    return NextResponse.json(result, { status: 422 });
  }

  return NextResponse.json(result);
}
