import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { importHtmlDocument, importPdfDocument } from "@/lib/ingestion/adapters/documentAdapters";

test("html extraction parses key fields with provenance", () => {
  const html = fs.readFileSync(path.join(process.cwd(), "fixtures/nps/html/nps_case_page.html"), "utf8");
  const result = importHtmlDocument(html, "https://example.nps.gov/case-html");

  assert.equal(result.records.length, 1);
  assert.equal(result.candidates[0].sourceSystem, "nps");
  assert.equal(result.candidates[0].sourceCaseId, "NPS-CASE-7781");
  assert.equal(result.candidates[0].displayName, "Riley Carter");
  assert.ok(result.candidates[0].provenance?.extraction);
});

test("pdf extraction parses text-extractable fixture", async () => {
  const b64 = fs.readFileSync(path.join(process.cwd(), "fixtures/nps/pdf/nps_case_text_extractable.pdf.b64"), "utf8").trim();
  const result = await importPdfDocument(b64, "https://example.nps.gov/case-pdf");

  assert.equal(result.records.length, 1);
  assert.equal(result.candidates[0].sourceCaseId, "NPS-PDF-1149");
  assert.equal(result.candidates[0].displayName, "Jordan Miller");
  assert.match(result.candidates[0].caseStatus ?? "", /Found deceased/i);
  assert.ok(result.issues.length >= 0);
});
