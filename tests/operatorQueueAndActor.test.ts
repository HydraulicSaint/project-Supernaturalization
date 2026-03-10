import test from "node:test";
import assert from "node:assert/strict";

import { resolveActorId } from "@/lib/operatorAudit";
import { listIngestionIssues } from "@/lib/repositories/ingestionRunsRepository";

test("actor identity resolver is deterministic fallback", () => {
  assert.equal(resolveActorId(" analyst-1 "), "analyst-1");
  assert.equal(resolveActorId(""), "internal-operator");
});

test("issue queue supports pagination envelope in demo mode", async () => {
  const result = await listIngestionIssues({ reviewed: "unreviewed", limit: 10, offset: 0 });
  assert.ok(Array.isArray(result.data));
  assert.equal(typeof result.pagination.hasMore, "boolean");
});
