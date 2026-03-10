import fs from "fs";
import path from "path";
import { importNamusCsvSnapshot } from "@/lib/ingestion/adapters/csvSnapshotAdapter";
import { importNpsRssFeed } from "@/lib/ingestion/adapters/rssFeedAdapter";
import { mergeCanonicalCandidates } from "@/lib/ingestion/normalization/mergeCanonical";
import { recordHash } from "@/lib/ingestion/utils/hash";

const namusCsv = fs.readFileSync(path.join(process.cwd(), "fixtures/namus/namus_tx_sample.csv"), "utf8");
const npsRss = fs.readFileSync(path.join(process.cwd(), "fixtures/nps/nps_missing_feed.xml"), "utf8");

const namus = importNamusCsvSnapshot(namusCsv, "TX");
const nps = importNpsRssFeed(npsRss, "https://example.nps.gov/missing.rss");

const merged = mergeCanonicalCandidates([...namus.candidates, ...nps.candidates]);

export const demoSnapshots = [namus.snapshot, nps.snapshot].map((snapshot) => ({
  ...snapshot,
  id: recordHash(snapshot).slice(0, 12)
}));

export const demoIssues = [...namus.issues, ...nps.issues].map((issue, idx) => ({
  id: `issue-${idx + 1}`,
  ...issue,
  createdAt: new Date().toISOString()
}));

export const demoCases = merged.map((candidate, idx) => ({
  id: `case-${idx + 1}`,
  ...candidate
}));
