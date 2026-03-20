import test from "node:test";
import assert from "node:assert/strict";

import { listIngestionIssues } from "@/lib/repositories/ingestionRunsRepository";

test("issue queue supports pagination envelope in demo mode", async () => {
  const result = await listIngestionIssues({ reviewed: "unreviewed", limit: 10, offset: 0 });
  assert.ok(Array.isArray(result.data));
  assert.equal(typeof result.pagination.hasMore, "boolean");
});
