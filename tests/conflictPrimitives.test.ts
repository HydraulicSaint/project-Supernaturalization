import test from "node:test";
import assert from "node:assert/strict";

import { detectContradictions } from "@/lib/ingestion/normalization/conflictPrimitives";

test("expanded contradiction primitives include demographics, outcome, and jurisdiction", () => {
  const existing = {
    case_status: "missing",
    missing_from: "2024-01-01",
    narrative_summary: "Seen near north trail",
    outcome: "found alive",
    demographics: { age: 21, sex: "Female", height: "5ft 8in", weight: "130" },
    jurisdiction: { caseNumber: "ABC-1", park: "Yellowstone" }
  };

  const candidate = {
    canonicalCaseRef: "case-1",
    sourceSystem: "nps" as const,
    caseStatus: "resolved",
    missingFrom: "2024-01-03",
    narrativeSummary: "Seen near south trail",
    outcome: "found deceased",
    demographics: { age: 22, sex: "male", height: "5ft 10in", weight: "145" },
    jurisdiction: { caseNumber: "XYZ-9", park: "Yosemite" }
  };

  const conflicts = detectContradictions(existing, candidate);
  const types = conflicts.map((c) => c.conflictType);
  assert.ok(types.includes("conflicting_demographic_age"));
  assert.ok(types.includes("conflicting_demographic_sex_gender"));
  assert.ok(types.includes("conflicting_outcome"));
  assert.ok(types.includes("conflicting_case_identifier"));
});
