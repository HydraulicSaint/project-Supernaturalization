import { NextResponse } from "next/server";
import { getCaseBundle } from "@/lib/casesRepository";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const bundle = await getCaseBundle(params.id);
  if (!bundle) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  return NextResponse.json(bundle);
}
