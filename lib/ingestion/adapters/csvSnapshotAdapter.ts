import { AdapterResult, CanonicalCandidate } from "@/lib/ingestion/types";

function parseCsv(csvText: string): Record<string, string>[] {
  const lines = csvText.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = line.split(",");
    return headers.reduce<Record<string, string>>((acc, header, idx) => {
      acc[header] = (values[idx] ?? "").trim();
      return acc;
    }, {});
  });
}

function confidenceFromLocation(row: Record<string, string>) {
  if (row.latitude && row.longitude) return "exact_or_near_exact" as const;
  if (row.location_text) return "city_or_general_area" as const;
  return "state_only" as const;
}

export function importNamusCsvSnapshot(csvText: string, stateBatch: string): AdapterResult {
  const rows = parseCsv(csvText);
  const snapshotAt = new Date().toISOString();
  const issues: import("@/lib/ingestion/types").IngestionIssueInput[] = [];

  const records = rows.map((row, idx) => ({
    sourceRecordKey: row.case_id || `${stateBatch}-${idx + 1}`,
    sourceCaseId: row.case_id,
    parsedPayload: row,
    parseConfidence: 0.95
  }));

  const candidates: CanonicalCandidate[] = rows.map((row, idx) => {
    const canonicalCaseRef = `namus:${row.case_id || `${stateBatch}-${idx + 1}`}`;
    return {
      canonicalCaseRef,
      displayName: row.person_name || undefined,
      missingFrom: row.missing_date || undefined,
      caseStatus: row.status || "open",
      narrativeSummary: row.narrative || undefined,
      sourceConfidence: 0.9,
      completenessScore: row.person_name && row.missing_date ? 0.75 : 0.4,
      jurisdiction: { state: row.state || null, county: row.county || null },
      agency: { primary: row.agency || null },
      sourceCaseId: row.case_id,
      sourceSystem: "namus",
      anomalyTags: [],
      motifTags: [],
      locations: [
        {
          eventType: "last_known",
          reportedLocationText: row.location_text || row.county || row.state,
          geometryType: row.latitude && row.longitude ? "Point" : "Unknown",
          geometryWkt: row.latitude && row.longitude ? `POINT(${row.longitude} ${row.latitude})` : undefined,
          geomMethod: row.latitude && row.longitude ? "source_provided" : "text_only",
          precisionMeters: row.latitude && row.longitude ? 50 : 50000,
          locationConfidence: confidenceFromLocation(row),
          isCentroid: !row.latitude || !row.longitude
        }
      ],
      provenance: { source: "namus_csv", stateBatch }
    };
  });

  return {
    snapshot: {
      sourceSystem: "namus",
      sourceChannel: "csv",
      ingestionMode: "snapshot",
      snapshotAt,
      stateBatch,
      rawText: csvText,
      metadata: { rowCount: rows.length }
    },
    records,
    candidates,
    issues
  };
}
