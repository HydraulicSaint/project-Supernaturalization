import { NextRequest, NextResponse } from "next/server";
import { listConflicts, markConflictReviewed } from "@/lib/repositories/ingestionRunsRepository";
import { resolveActorId } from "@/lib/operatorAudit";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  return NextResponse.json(await listConflicts({
    reviewStatus: search.get("reviewStatus") ?? undefined,
    severity: search.get("severity") ?? undefined,
    caseId: search.get("caseId") ?? undefined,
    limit: search.get("limit") ? Number(search.get("limit")) : undefined,
    offset: search.get("offset") ? Number(search.get("offset")) : undefined,
    sort: search.get("sort") ?? undefined
  }));
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  if (!body.conflictId) return NextResponse.json({ error: "conflictId required" }, { status: 400 });
  const actorId = resolveActorId(body.reviewedBy ?? request.headers.get("x-operator-id"));
  return NextResponse.json(await markConflictReviewed(body.conflictId, actorId, body.notes));
}
