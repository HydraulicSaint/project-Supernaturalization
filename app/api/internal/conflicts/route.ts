import { NextRequest, NextResponse } from "next/server";
import { listConflicts, markConflictReviewed } from "@/lib/repositories/ingestionRunsRepository";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const data = await listConflicts({
    reviewStatus: search.get("reviewStatus") ?? undefined,
    severity: search.get("severity") ?? undefined,
    caseId: search.get("caseId") ?? undefined
  });
  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  if (!body.conflictId) return NextResponse.json({ error: "conflictId required" }, { status: 400 });
  return NextResponse.json(await markConflictReviewed(body.conflictId, body.reviewedBy ?? "operator"));
}
