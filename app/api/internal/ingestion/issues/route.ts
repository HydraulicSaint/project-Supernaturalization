import { NextRequest, NextResponse } from "next/server";
import { listIngestionIssues, markIssueReviewed } from "@/lib/repositories/ingestionRunsRepository";
import { resolveActorId } from "@/lib/operatorAudit";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  return NextResponse.json(await listIngestionIssues({
    severity: search.get("severity") ?? undefined,
    reviewed: search.get("reviewed") ?? undefined,
    limit: search.get("limit") ? Number(search.get("limit")) : undefined,
    offset: search.get("offset") ? Number(search.get("offset")) : undefined,
    sort: search.get("sort") ?? undefined
  }));
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  if (!body.issueId) return NextResponse.json({ error: "issueId required" }, { status: 400 });
  const actorId = resolveActorId(body.reviewedBy ?? request.headers.get("x-operator-id"));
  return NextResponse.json(await markIssueReviewed(body.issueId, actorId, body.notes));
}
