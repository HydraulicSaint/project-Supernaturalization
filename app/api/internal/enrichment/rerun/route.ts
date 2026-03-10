import { NextRequest, NextResponse } from "next/server";
import { rerunEnrichmentForBatch, rerunEnrichmentForCase, rerunEnrichmentForStale } from "@/lib/ingestion/jobs/jobRunner";
import { resolveActorId } from "@/lib/operatorAudit";

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const actorId = resolveActorId(payload.actorId ?? request.headers.get("x-operator-id"));

  if (payload.mode === "stale") {
    return NextResponse.json(await rerunEnrichmentForStale(actorId));
  }

  if (payload.mode === "batch") {
    if (!Array.isArray(payload.caseIds) || payload.caseIds.length === 0) {
      return NextResponse.json({ error: "caseIds required for batch mode" }, { status: 400 });
    }
    return NextResponse.json(await rerunEnrichmentForBatch(payload.caseIds, actorId));
  }

  if (!payload.caseId) {
    return NextResponse.json({ error: "caseId required" }, { status: 400 });
  }

  const result = await rerunEnrichmentForCase(payload.caseId, actorId);
  if (!result.ok) {
    return NextResponse.json(result, { status: 422 });
  }

  return NextResponse.json(result);
}
