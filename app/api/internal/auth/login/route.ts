import { NextRequest, NextResponse } from "next/server";
import { attachSessionCookie, authenticateOperator, bootstrapDefaultOperators } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const payload = await request.json();
  if (!payload?.username || !payload?.password) {
    return NextResponse.json({ error: "username and password required" }, { status: 400 });
  }

  await bootstrapDefaultOperators();
  const operator = await authenticateOperator(payload.username, payload.password);
  if (!operator) {
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, operator });
  attachSessionCookie(response, operator);
  return response;
}
