import { NextRequest, NextResponse } from "next/server";
import { listRecentActivitySummary, listRecentOperatorActions } from "@/lib/repositories/ingestionRunsRepository";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const includeSummary = search.get("summary") !== "false";
  const actions = await listRecentOperatorActions({
    limit: search.get("limit") ? Number(search.get("limit")) : 50,
    offset: search.get("offset") ? Number(search.get("offset")) : 0
  });

  const summary = includeSummary ? await listRecentActivitySummary() : null;
  return NextResponse.json({ actions, summary });
}
