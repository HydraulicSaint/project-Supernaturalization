import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import { importNamusCsvSnapshot } from "@/lib/ingestion/adapters/csvSnapshotAdapter";
import { importNpsRssFeed } from "@/lib/ingestion/adapters/rssFeedAdapter";
import { recordHash } from "@/lib/ingestion/utils/hash";
import { diffSnapshots } from "@/lib/ingestion/diff/snapshotDiff";
import { mergeCanonicalCandidates } from "@/lib/ingestion/normalization/mergeCanonical";
import { enrichLocationFromPointWkt } from "@/lib/ingestion/enrichment/geospatialEnrichment";

const csv = fs.readFileSync(path.join(process.cwd(), "fixtures/namus/namus_tx_sample.csv"), "utf8");
const rss = fs.readFileSync(path.join(process.cwd(), "fixtures/nps/nps_missing_feed.xml"), "utf8");

test("csv import parses rows and candidates", () => {
  const result = importNamusCsvSnapshot(csv, "TX");
  assert.equal(result.records.length, 2);
  assert.equal(result.candidates[0].sourceSystem, "namus");
  assert.equal(result.candidates[1].locations?.[0].locationConfidence, "city_or_general_area");
});

test("rss parser emits candidate", () => {
  const result = importNpsRssFeed(rss, "https://example.nps.gov/missing.rss");
  assert.equal(result.candidates.length, 1);
});

test("record hashing and diff detects changed rows", () => {
  const base = importNamusCsvSnapshot(csv, "TX");
  const changedCsv = csv.replace("Jamie Doe", "Jamie X Doe");
  const updated = importNamusCsvSnapshot(changedCsv, "TX");

  const baseRows = base.records.map((r) => ({ ...r, recordHash: recordHash(r.parsedPayload) }));
  const updatedRows = updated.records.map((r) => ({ ...r, recordHash: recordHash(r.parsedPayload) }));

  const diff = diffSnapshots(baseRows, updatedRows);
  assert.equal(diff.changed.length, 1);
  assert.equal(diff.missing.length, 0);
});

test("merge logic deterministic and non-destructive", () => {
  const c1 = importNamusCsvSnapshot(csv, "TX").candidates;
  const c2 = importNpsRssFeed(rss, "https://example").candidates;
  const mergedA = mergeCanonicalCandidates([...c1, ...c2]);
  const mergedB = mergeCanonicalCandidates([...c2, ...c1]);
  assert.deepEqual(mergedA, mergedB);
});

test("geospatial enrichment fallback returns metrics", async () => {
  const result = await enrichLocationFromPointWkt("POINT(-97.772 30.263)");
  assert.ok(result.nearestTrailMeters !== undefined);
});
