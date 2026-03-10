import { NextRequest, NextResponse } from "next/server";
import { rerunEnrichmentForCase } from "@/lib/ingestion/jobs/jobRunner";

export async function POST(request: NextRequest) {
  const payload = await request.json();
  if (!payload.caseId) {
    return NextResponse.json({ error: "caseId required" }, { status: 400 });
  }

  const result = await rerunEnrichmentForCase(payload.caseId);
  if (!result.ok) {
    return NextResponse.json(result, { status: 422 });
  }

  return NextResponse.json(result);
}
