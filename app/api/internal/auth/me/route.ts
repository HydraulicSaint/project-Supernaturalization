import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedOperatorFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const operator = getAuthenticatedOperatorFromRequest(request);
  if (!operator) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, operator });
}
