import { AdapterResult } from "@/lib/ingestion/types";

export function importHtmlDocument(html: string, sourceUri: string): AdapterResult {
  return {
    snapshot: {
      sourceSystem: "nps",
      sourceChannel: "html",
      ingestionMode: "snapshot",
      sourceUri,
      snapshotAt: new Date().toISOString(),
      rawText: html,
      metadata: { parser: "stub-html" }
    },
    records: [],
    candidates: [],
    issues: [{ severity: "info", issueType: "stub", message: "HTML adapter scaffolded" }]
  };
}

export function importPdfDocument(base64Pdf: string, sourceUri: string): AdapterResult {
  return {
    snapshot: {
      sourceSystem: "nps",
      sourceChannel: "pdf",
      ingestionMode: "snapshot",
      sourceUri,
      snapshotAt: new Date().toISOString(),
      rawBinaryBase64: base64Pdf,
      metadata: { parser: "stub-pdf" }
    },
    records: [],
    candidates: [],
    issues: [{ severity: "info", issueType: "stub", message: "PDF adapter scaffolded" }]
  };
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
    issues: [{ severity: "info", issueType: "stub", message: "Manual JSON scaffolded" }]
  };
}
