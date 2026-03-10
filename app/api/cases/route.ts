import { NextResponse } from "next/server";
import { z } from "zod";
import { listCases } from "@/lib/casesRepository";

const importSchema = z.object({
  cases: z.array(
    z.object({
      caseNumber: z.string(),
      subjectName: z.string(),
      status: z.enum(["open", "resolved", "suspended"]),
      parkUnit: z.string(),
      disappearedAt: z.string(),
      sourceCitation: z.string()
    })
  )
});

export async function GET() {
  const data = await listCases();
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = importSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  return NextResponse.json({
    accepted: parsed.data.cases.length,
    message:
      "Structured import accepted. Persist to PostgreSQL/PostGIS via ingestion worker and join with authoritative GIS overlays (boundaries, hydrography, elevation, trails)."
  });
}
