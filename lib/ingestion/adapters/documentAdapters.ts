import { createHash } from "node:crypto";
import pdf from "pdf-parse";

import { AdapterResult, CanonicalCandidate, IngestionIssueInput, ParsedSourceRecord } from "@/lib/ingestion/types";

type ExtractedField = {
  value?: string;
  confidence: number;
  inferred: boolean;
  provenance: string;
};

type DocumentExtraction = {
  title: ExtractedField;
  personName: ExtractedField;
  caseIdentifier: ExtractedField;
  parkUnit: ExtractedField;
  incidentDate: ExtractedField;
  status: ExtractedField;
  locationDescription: ExtractedField;
  narrativeSummary: ExtractedField;
  recoveryLanguage: ExtractedField;
};

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<\/(p|div|h1|h2|h3|li|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\t ]+/g, " ")
    .replace(/\n+/g, "\n")
    .trim();
}

function pick(regex: RegExp, text: string, provenance: string): ExtractedField {
  const match = text.match(regex);
  if (!match) return { confidence: 0, inferred: false, provenance };
  return { value: (match[1] ?? match[0]).trim(), confidence: 0.78, inferred: false, provenance };
}

function inferTitle(text: string, provenance: string): ExtractedField {
  const line = text.split(/\n+/).map((l) => l.trim()).find((l) => l.length > 12 && l.length < 160);
  return line ? { value: line, confidence: 0.55, inferred: true, provenance } : { confidence: 0, inferred: true, provenance };
}

function extractDocumentFields(rawText: string, sourceUri: string): { extraction: DocumentExtraction; issues: IngestionIssueInput[] } {
  const issues: IngestionIssueInput[] = [];

  const title = pick(/(?:headline|title)\s*[:\-]\s*([^\n]+)/i, rawText, "regex:title") || inferTitle(rawText, "inferred:first-line");
  const personName = pick(/(?:person\s*name|subject\s*name|missing\s*name)\s*[:\-]\s*([^\n\)]+)/i, rawText, "regex:person");
  const caseIdentifier = pick(/(?:case|incident)\s*(?:id|number|#)\s*[:\-]\s*([A-Z0-9\-]+)/i, rawText, "regex:case-id");
  const parkUnit = pick(/(?:park|unit|jurisdiction)\s*[:\-]\s*([^\n]+)/i, rawText, "regex:park-unit");
  const incidentDate = pick(/(?:missing|incident|date)\s*(?:on|from)?\s*[:\-]\s*([A-Za-z0-9,\-\/ ]{5,40})/i, rawText, "regex:date");
  const status = pick(/(?:status|disposition)\s*[:\-]\s*([^\n]+)/i, rawText, "regex:status");
  const locationDescription = pick(/(?:location|last seen|area)\s*[:\-]\s*([^\n]+)/i, rawText, "regex:location");
  const recoveryLanguage = pick(/((?:found|recovered|deceased|alive)[^\.]{0,120})/i, rawText, "regex:recovery");

  const narrativeSummary: ExtractedField = {
    value: rawText.slice(0, 1200),
    confidence: 0.62,
    inferred: true,
    provenance: "derived:trimmed-document-text"
  };

  const extraction: DocumentExtraction = {
    title: title.value ? title : inferTitle(rawText, "inferred:first-line"),
    personName,
    caseIdentifier,
    parkUnit,
    incidentDate,
    status,
    locationDescription,
    narrativeSummary,
    recoveryLanguage
  };

  for (const [field, item] of Object.entries(extraction)) {
    if (!item.value && field !== "recoveryLanguage") {
      issues.push({
        severity: "warning",
        issueType: "field_not_extracted",
        message: `Could not extract ${field}`,
        fieldPath: field,
        context: { sourceUri },
        recoverable: true
      });
    }
  }

  return { extraction, issues };
}

function toAdapterResult(rawText: string, sourceUri: string, sourceChannel: "html" | "pdf", metadata: Record<string, unknown>): AdapterResult {
  const { extraction, issues } = extractDocumentFields(rawText, sourceUri);

  const sourceRecordKey = createHash("sha256").update(`${sourceUri}:${rawText.slice(0, 500)}`).digest("hex");
  const parsedPayload = {
    documentUrl: sourceUri,
    extracted: extraction,
    extractedAt: new Date().toISOString(),
    sourceSpecific: { sourceSystem: "nps-public-document" }
  };

  const record: ParsedSourceRecord = {
    sourceRecordKey,
    sourceCaseId: extraction.caseIdentifier.value,
    parsedPayload,
    parseConfidence: 0.73,
    isInferred: Object.values(extraction).some((f) => f.inferred)
  };

  const candidate: CanonicalCandidate = {
    canonicalCaseRef: extraction.caseIdentifier.value ?? `nps-doc:${sourceRecordKey.slice(0, 16)}`,
    displayName: extraction.personName.value,
    sourceCaseId: extraction.caseIdentifier.value,
    caseStatus: extraction.status.value,
    missingFrom: extraction.incidentDate.value,
    narrativeSummary: extraction.narrativeSummary.value,
    sourceConfidence: 0.72,
    sourceSystem: "nps",
    jurisdiction: { parkUnit: extraction.parkUnit.value },
    inferredFields: Object.entries(extraction)
      .filter(([, f]) => f.inferred)
      .map(([field]) => field),
    provenance: {
      extraction,
      separation: {
        directlyExtractedFields: Object.entries(extraction).filter(([, f]) => !f.inferred).map(([field]) => field),
        inferredFields: Object.entries(extraction).filter(([, f]) => f.inferred).map(([field]) => field)
      }
    },
    locations: extraction.locationDescription.value
      ? [
          {
            eventType: "reported_last_seen",
            reportedLocationText: extraction.locationDescription.value,
            locationConfidence: "county_or_park_unit"
          }
        ]
      : undefined
  };

  return {
    snapshot: {
      sourceSystem: "nps",
      sourceChannel,
      ingestionMode: "snapshot",
      sourceUri,
      snapshotAt: new Date().toISOString(),
      rawText: sourceChannel === "html" ? rawText : undefined,
      rawBinaryBase64: sourceChannel === "pdf" ? Buffer.from(rawText, "utf8").toString("base64") : undefined,
      metadata
    },
    records: [record],
    candidates: [candidate],
    issues
  };
}

export function importHtmlDocument(html: string, sourceUri: string): AdapterResult {
  return toAdapterResult(stripHtml(html), sourceUri, "html", { parser: "deterministic-html-regex-v1" });
}

export async function importPdfDocument(base64Pdf: string, sourceUri: string): Promise<AdapterResult> {
  const pdfBuffer = Buffer.from(base64Pdf, "base64");
  try {
    const data = await pdf(pdfBuffer);
    return toAdapterResult(data.text, sourceUri, "pdf", { parser: "pdf-parse-v1", pages: data.numpages });
  } catch (error) {
    const fallbackText = pdfBuffer
      .toString("latin1")
      .replace(/[^\x20-\x7E\n]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const result = toAdapterResult(fallbackText, sourceUri, "pdf", { parser: "pdf-text-fallback-v1" });
    result.issues.push({
      severity: "warning",
      issueType: "pdf_parse_fallback",
      message: error instanceof Error ? error.message : String(error),
      recoverable: true
    });
    return result;
  }
}

export function importManualJson(payload: unknown): AdapterResult {
  return {
    snapshot: {
      sourceSystem: "manual",
      sourceChannel: "json",
      ingestionMode: "snapshot",
      snapshotAt: new Date().toISOString(),
      rawPayload: payload
    },
    records: [],
    candidates: [],
    issues: []
  };
}
