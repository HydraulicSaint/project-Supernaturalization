import { NextResponse } from "next/server";
import { listIngestionIssues } from "@/lib/repositories/ingestionRunsRepository";

export async function GET() {
  const data = await listIngestionIssues();
  return NextResponse.json({ data });
}
