import { CanonicalCandidate } from "@/lib/ingestion/types";

export type DetectedConflict = { conflictType: string; previousValue: unknown; nextValue: unknown; normalizedPreviousValue?: unknown; normalizedNextValue?: unknown; severity: string };

const norm = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : v);

export function detectContradictions(existing: Record<string, unknown>, candidate: CanonicalCandidate): DetectedConflict[] {
  const out: DetectedConflict[] = [];
  const demo = (existing.demographics as Record<string, unknown> | null) ?? {};
  const cDemo = candidate.demographics ?? {};
  const add = (conflictType: string, previousValue: unknown, nextValue: unknown, severity: string) => {
    if (previousValue == null || nextValue == null || previousValue === nextValue) return;
    out.push({ conflictType, previousValue, nextValue, normalizedPreviousValue: norm(previousValue), normalizedNextValue: norm(nextValue), severity });
  };
  add("conflicting_status", existing.case_status, candidate.caseStatus, "high");
  add("conflicting_missing_date", existing.missing_from, candidate.missingFrom, "high");
  add("conflicting_location_description", existing.narrative_summary, candidate.narrativeSummary, "medium");
  add("conflicting_outcome", existing.outcome, candidate.outcome, "high");

  [["age", "conflicting_demographic_age", "medium"], ["sex", "conflicting_demographic_sex_gender", "high"], ["gender", "conflicting_demographic_sex_gender", "high"], ["race", "conflicting_demographic_race_ethnicity", "medium"], ["ethnicity", "conflicting_demographic_race_ethnicity", "medium"], ["height", "conflicting_demographic_height", "low"], ["weight", "conflicting_demographic_weight", "low"]].forEach(([f, t, s]) => add(t as string, demo[f as string], cDemo[f as string], s as string));

  const ej = (existing.jurisdiction as Record<string, unknown> | null) ?? {};
  const cj = candidate.jurisdiction ?? {};
  add("conflicting_case_identifier", ej.caseNumber, cj.caseNumber, "high");
  add("conflicting_jurisdiction_park", ej.park, cj.park, "medium");
  return out;
}
