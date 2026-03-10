import fs from "node:fs";

import { NextRequest, NextResponse } from "next/server";
import { importHtmlDocument, importPdfDocument } from "@/lib/ingestion/adapters/documentAdapters";
import { runIngestionJob } from "@/lib/ingestion/jobs/jobRunner";

type ManifestEntry = { url: string; type: "html" | "pdf"; fixturePath?: string };

export async function POST(request: NextRequest) {
  const body = await request.json();
  const manifest: ManifestEntry[] = body.manifest ?? [];
  if (!Array.isArray(manifest) || manifest.length === 0) {
    return NextResponse.json({ error: "manifest[] required" }, { status: 400 });
  }

  const results = [];
  for (const entry of manifest) {
    try {
      let adapter;
      if (entry.fixturePath) {
        const content = fs.readFileSync(entry.fixturePath, "utf8");
        adapter = entry.type === "html" ? importHtmlDocument(content, entry.url) : await importPdfDocument(content.trim(), entry.url);
      } else {
        const res = await fetch(entry.url);
        if (!res.ok) throw new Error(`Failed to fetch ${entry.url}`);
        if (entry.type === "html") {
          adapter = importHtmlDocument(await res.text(), entry.url);
        } else {
          const buf = Buffer.from(await res.arrayBuffer());
          adapter = await importPdfDocument(buf.toString("base64"), entry.url);
        }
      }

      const persisted = await runIngestionJob({
        jobType: `nps_document_${entry.type}`,
        sourceSystem: "nps",
        triggerMode: "manual",
        payload: adapter
      });
      results.push({ url: entry.url, ok: true, persisted });
    } catch (error) {
      results.push({ url: entry.url, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return NextResponse.json({ results });
}
