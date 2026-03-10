import { AdapterResult, CanonicalCandidate, IngestionIssueInput } from "@/lib/ingestion/types";

function xmlTag(content: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g");
  return Array.from(content.matchAll(regex)).map((match) => match[1].trim());
}

export function importNpsRssFeed(feedXml: string, sourceUri: string): AdapterResult {
  const items = feedXml.split("<item>").slice(1).map((raw) => raw.split("</item>")[0]);
  const issues: IngestionIssueInput[] = [];

  const candidates: CanonicalCandidate[] = items.map((item, idx) => {
    const title = xmlTag(item, "title")[0] || `nps-item-${idx + 1}`;
    const link = xmlTag(item, "link")[0];
    const description = xmlTag(item, "description")[0];
    const pubDate = xmlTag(item, "pubDate")[0];

    if (!description) {
      issues.push({
        severity: "warning",
        issueType: "missing_description",
        message: "RSS item missing description",
        context: { title },
        recoverable: true
      });
    }

    return {
      canonicalCaseRef: `nps:${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      displayName: title,
      missingFrom: pubDate ? new Date(pubDate).toISOString() : undefined,
      caseStatus: "open",
      narrativeSummary: description,
      sourceConfidence: 0.65,
      completenessScore: description ? 0.5 : 0.35,
      sourceCaseId: link,
      sourceSystem: "nps",
      jurisdiction: { parkUnit: "unknown" },
      motifTags: ["public_notice"],
      anomalyTags: [],
      locations: [
        {
          eventType: "public_notice",
          reportedLocationText: "Park unit unknown",
          locationConfidence: "county_or_park_unit",
          geomMethod: "document_extraction",
          precisionMeters: 20000,
          isCentroid: true
        }
      ],
      provenance: { sourceUri, extractor: "rssFeedAdapter" }
    };
  });

  const records = candidates.map((candidate, idx) => ({
    sourceRecordKey: candidate.canonicalCaseRef,
    sourceCaseId: candidate.sourceCaseId,
    parsedPayload: { ...candidate, rawItemIndex: idx },
    parseConfidence: 0.8
  }));

  return {
    snapshot: {
      sourceSystem: "nps",
      sourceChannel: "rss",
      ingestionMode: "delta",
      sourceUri,
      snapshotAt: new Date().toISOString(),
      rawText: feedXml,
      metadata: { itemCount: items.length }
    },
    records,
    candidates,
    issues
  };
}
