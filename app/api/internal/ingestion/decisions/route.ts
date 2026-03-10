import { NextRequest, NextResponse } from "next/server";
import { listMergeDecisions } from "@/lib/repositories/ingestionRunsRepository";

export async function GET(request: NextRequest) {
  const caseId = request.nextUrl.searchParams.get("caseId") ?? undefined;
  const data = await listMergeDecisions(caseId);
  return NextResponse.json({ data });
}
