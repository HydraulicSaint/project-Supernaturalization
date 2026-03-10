import fs from "fs";
import path from "path";
import { importNamusCsvSnapshot } from "@/lib/ingestion/adapters/csvSnapshotAdapter";
import { importNpsRssFeed } from "@/lib/ingestion/adapters/rssFeedAdapter";
import { mergeCanonicalCandidates } from "@/lib/ingestion/normalization/mergeCanonical";
import { diffSnapshots } from "@/lib/ingestion/diff/snapshotDiff";
import { recordHash } from "@/lib/ingestion/utils/hash";

const csv = fs.readFileSync(path.join(process.cwd(), "fixtures/namus/namus_tx_sample.csv"), "utf8");
const feed = fs.readFileSync(path.join(process.cwd(), "fixtures/nps/nps_missing_feed.xml"), "utf8");

const namus = importNamusCsvSnapshot(csv, "TX");
const nps = importNpsRssFeed(feed, "https://example.nps.gov/missing.rss");
const merged = mergeCanonicalCandidates([...namus.candidates, ...nps.candidates]);

const keyed = namus.records.map((record) => ({ ...record, recordHash: recordHash(record.parsedPayload) }));
const diff = diffSnapshots([], keyed);

console.log(JSON.stringify({ snapshots: [namus.snapshot, nps.snapshot], mergedCount: merged.length, diff }, null, 2));
