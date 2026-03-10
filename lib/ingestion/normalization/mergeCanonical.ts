import { CanonicalCandidate } from "@/lib/ingestion/types";

export function mergeCanonicalCandidates(candidates: CanonicalCandidate[]): CanonicalCandidate[] {
  const byRef = new Map<string, CanonicalCandidate>();

  for (const candidate of candidates) {
    const existing = byRef.get(candidate.canonicalCaseRef);
    if (!existing) {
      byRef.set(candidate.canonicalCaseRef, { ...candidate, locations: [...(candidate.locations ?? [])] });
      continue;
    }

    byRef.set(candidate.canonicalCaseRef, {
      ...existing,
      displayName: existing.displayName || candidate.displayName,
      caseStatus: existing.caseStatus === "resolved" ? existing.caseStatus : candidate.caseStatus || existing.caseStatus,
      missingFrom: existing.missingFrom || candidate.missingFrom,
      missingTo: existing.missingTo || candidate.missingTo,
      narrativeSummary:
        (existing.narrativeSummary?.length || 0) >= (candidate.narrativeSummary?.length || 0)
          ? existing.narrativeSummary
          : candidate.narrativeSummary,
      sourceConfidence: Math.max(existing.sourceConfidence ?? 0, candidate.sourceConfidence ?? 0),
      completenessScore: Math.max(existing.completenessScore ?? 0, candidate.completenessScore ?? 0),
      anomalyTags: [...new Set([...(existing.anomalyTags ?? []), ...(candidate.anomalyTags ?? [])])],
      motifTags: [...new Set([...(existing.motifTags ?? []), ...(candidate.motifTags ?? [])])],
      locations: [...(existing.locations ?? []), ...(candidate.locations ?? [])]
    });
  }

  return Array.from(byRef.values()).sort((a, b) => a.canonicalCaseRef.localeCompare(b.canonicalCaseRef));
}
