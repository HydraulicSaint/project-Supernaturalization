import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export type AuthenticatedOperator = {
  operatorId: string;
  username: string;
  displayName: string;
  role: string;
  authSource: string;
};

const SESSION_COOKIE = "internal_operator_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

function timingSafeEqualHex(a: string, b: string) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function pbkdf2(password: string, salt: string) {
  return crypto.pbkdf2Sync(password, salt, 210000, 32, "sha256").toString("hex");
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const digest = pbkdf2(password, salt);
  return `pbkdf2_sha256$210000$${salt}$${digest}`;
}

function verifyPassword(password: string, encoded: string) {
  const [scheme, roundsStr, salt, digest] = encoded.split("$");
  if (scheme !== "pbkdf2_sha256" || !roundsStr || !salt || !digest) return false;
  const rounds = Number(roundsStr);
  if (rounds !== 210000) return false;
  const computed = pbkdf2(password, salt);
  return timingSafeEqualHex(computed, digest);
}

function sessionSecret() {
  return process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret-change-me";
}

function signPayload(payload: string) {
  return crypto.createHmac("sha256", sessionSecret()).update(payload).digest("hex");
}

function encodeSession(payload: Record<string, unknown>) {
  const raw = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${raw}.${signPayload(raw)}`;
}

function decodeSession(session: string): Record<string, unknown> | null {
  const [raw, sig] = session.split(".");
  if (!raw || !sig) return null;
  if (!timingSafeEqualHex(signPayload(raw), sig)) return null;
  const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Record<string, unknown>;
  if (typeof parsed.exp !== "number" || parsed.exp < Math.floor(Date.now() / 1000)) return null;
  return parsed;
}

export function attachSessionCookie(response: NextResponse, actor: AuthenticatedOperator) {
  const payload = {
    sub: actor.operatorId,
    usr: actor.username,
    name: actor.displayName,
    role: actor.role,
    src: actor.authSource,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  };
  response.cookies.set({
    name: SESSION_COOKIE,
    value: encodeSession(payload),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({ name: SESSION_COOKIE, value: "", path: "/", maxAge: 0 });
}

export function getAuthenticatedOperatorFromRequest(request: NextRequest): AuthenticatedOperator | null {
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (!session) return null;
  const payload = decodeSession(session);
  if (!payload) return null;
  if (typeof payload.sub !== "string" || typeof payload.usr !== "string" || typeof payload.name !== "string" || typeof payload.role !== "string") {
    return null;
  }
  return {
    operatorId: payload.sub,
    username: payload.usr,
    displayName: payload.name,
    role: payload.role,
    authSource: typeof payload.src === "string" ? payload.src : "local_password"
  };
}

export function requireAuthenticatedOperator(request: NextRequest) {
  const operator = getAuthenticatedOperatorFromRequest(request);
  if (!operator) {
    return { operator: null, response: NextResponse.json({ error: "authentication required" }, { status: 401 }) } as const;
  }
  return { operator, response: null } as const;
}

export async function authenticateOperator(username: string, password: string): Promise<AuthenticatedOperator | null> {
  if (!db) return null;
  const result = await db.query(
    `SELECT id, username, display_name, role, auth_source, password_hash
     FROM internal_operator_account
     WHERE username = $1 AND is_active = true`,
    [username]
  );
  const row = result.rows[0];
  if (!row || !verifyPassword(password, row.password_hash)) return null;

  await db.query(`UPDATE internal_operator_account SET last_login_at = now() WHERE id = $1`, [row.id]);
  return {
    operatorId: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    authSource: row.auth_source
  };
}

export async function bootstrapDefaultOperators() {
  if (!db) return;
  const defaults = [
    { username: "analyst1", displayName: "Analyst One", role: "operator", password: "analyst1-change-me" },
    { username: "admin1", displayName: "Admin One", role: "admin", password: "admin1-change-me" }
  ];
  for (const item of defaults) {
    await db.query(
      `INSERT INTO internal_operator_account (username, password_hash, display_name, role)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (username) DO NOTHING`,
      [item.username, hashPassword(item.password), item.displayName, item.role]
    );
  }
}
