import { NextResponse } from "next/server";
import { listMergeDecisions } from "@/lib/repositories/ingestionRunsRepository";

export async function GET() {
  const data = await listMergeDecisions();
  return NextResponse.json({ data });
}
