import { NextRequest, NextResponse } from "next/server";
import { listIngestionIssues, markIssueReviewed } from "@/lib/repositories/ingestionRunsRepository";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const data = await listIngestionIssues({ severity: search.get("severity") ?? undefined, reviewed: search.get("reviewed") ?? undefined });
  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  if (!body.issueId) return NextResponse.json({ error: "issueId required" }, { status: 400 });
  return NextResponse.json(await markIssueReviewed(body.issueId, body.reviewedBy ?? "operator"));
}
