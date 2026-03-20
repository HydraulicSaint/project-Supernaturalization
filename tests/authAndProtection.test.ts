import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

import { hashPassword } from "@/lib/auth";
import { PATCH as patchIssue } from "@/app/api/internal/ingestion/issues/route";
import { PATCH as patchConflict } from "@/app/api/internal/conflicts/route";

test("password hashing uses deterministic envelope", () => {
  const first = hashPassword("example");
  assert.ok(first.startsWith("pbkdf2_sha256$210000$"));
  assert.notEqual(first, hashPassword("example"));
});

test("issue mutation endpoint rejects unauthenticated requests", async () => {
  const req = new NextRequest("http://localhost/api/internal/ingestion/issues", {
    method: "PATCH",
    body: JSON.stringify({ issueId: "123" })
  });
  const res = await patchIssue(req);
  assert.equal(res.status, 401);
});

test("conflict mutation endpoint rejects unauthenticated requests", async () => {
  const req = new NextRequest("http://localhost/api/internal/conflicts", {
    method: "PATCH",
    body: JSON.stringify({ conflictId: "123" })
  });
  const res = await patchConflict(req);
  assert.equal(res.status, 401);
});
