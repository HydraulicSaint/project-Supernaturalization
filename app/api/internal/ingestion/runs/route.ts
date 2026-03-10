import { NextResponse } from "next/server";
import { listIngestionRuns } from "@/lib/repositories/ingestionRunsRepository";

export async function GET() {
  const data = await listIngestionRuns();
  return NextResponse.json({ data });
}
