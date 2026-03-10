import { NextResponse } from "next/server";
import { getCanonicalCase } from "@/lib/repositories/canonicalCasesRepository";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const data = await getCanonicalCase(params.id);
  if (!data) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  return NextResponse.json({ data });
}
