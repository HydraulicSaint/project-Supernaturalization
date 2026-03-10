import { CaseRecord, EnvironmentalSnapshot, LocationEvent, SourceRecord } from "@/lib/types";

export const sourceRecords: SourceRecord[] = [
  {
    id: "src-nps-883",
    system: "NPS",
    sourceType: "official_report",
    citation: "NPS Incident Record 883 (Redwood Backcountry)",
    ingestedAt: "2026-01-10T16:20:00Z",
    trustScore: 0.93
  },
  {
    id: "src-usgs-dem-22",
    system: "USGS",
    sourceType: "satellite",
    citation: "USGS 10m DEM Tile CA_NW_22",
    ingestedAt: "2026-01-10T16:25:00Z",
    trustScore: 0.98
  },
  {
    id: "src-sar-brief-18",
    system: "County SAR",
    sourceType: "official_report",
    citation: "SAR Operational Brief Day 2",
    ingestedAt: "2026-01-11T12:02:00Z",
    trustScore: 0.89
  }
];

export const cases: CaseRecord[] = [
  {
    id: "case-001",
    caseNumber: "NPS-CA-2026-001",
    status: { value: "open", confidence: "high", sourceRecordId: "src-nps-883", assertedAt: "2026-01-10T16:20:00Z" },
    subjectName: { value: "Avery Cole", confidence: "high", sourceRecordId: "src-nps-883", assertedAt: "2026-01-10T16:20:00Z" },
    age: { value: 29, confidence: "high", sourceRecordId: "src-nps-883", assertedAt: "2026-01-10T16:20:00Z" },
    riskProfile: { value: "solo hiker / overnight missing", confidence: "medium", sourceRecordId: "src-sar-brief-18", assertedAt: "2026-01-11T12:02:00Z" },
    primaryBiome: { value: "temperate rainforest", confidence: "high", sourceRecordId: "src-usgs-dem-22", assertedAt: "2026-01-10T16:25:00Z" },
    parkUnit: { value: "Redwood National and State Parks", confidence: "high", sourceRecordId: "src-nps-883", assertedAt: "2026-01-10T16:20:00Z" },
    disappearedAt: { value: "2026-01-09T18:45:00Z", confidence: "medium", sourceRecordId: "src-sar-brief-18", assertedAt: "2026-01-11T12:02:00Z" },
    narrative: { value: "Last confirmed at trail junction before severe fog event.", confidence: "medium", sourceRecordId: "src-sar-brief-18", assertedAt: "2026-01-11T12:02:00Z" },
    sourceRecordIds: ["src-nps-883", "src-usgs-dem-22", "src-sar-brief-18"]
  }
];

export const locationEvents: LocationEvent[] = [
  {
    id: "loc-001",
    caseId: "case-001",
    eventType: "last_seen",
    geom: [-124.0012, 41.2134],
    occurredAt: "2026-01-09T18:45:00Z",
    sourceRecordId: "src-sar-brief-18",
    confidence: "medium"
  },
  {
    id: "loc-002",
    caseId: "case-001",
    eventType: "search_operation",
    geom: [-124.0164, 41.2261],
    occurredAt: "2026-01-10T09:30:00Z",
    sourceRecordId: "src-nps-883",
    confidence: "high"
  }
];

export const environmentalSnapshots: EnvironmentalSnapshot[] = [
  {
    id: "env-001",
    locationEventId: "loc-001",
    elevationM: { value: 434, confidence: "high", sourceRecordId: "src-usgs-dem-22", assertedAt: "2026-01-10T16:25:00Z" },
    slopeDeg: { value: 19, confidence: "high", sourceRecordId: "src-usgs-dem-22", assertedAt: "2026-01-10T16:25:00Z" },
    landCover: { value: "dense conifer", confidence: "medium", sourceRecordId: "src-usgs-dem-22", assertedAt: "2026-01-10T16:25:00Z" },
    nearestHydroFeatureM: { value: 132, confidence: "medium", sourceRecordId: "src-nps-883", assertedAt: "2026-01-10T16:20:00Z" },
    trailDistanceM: { value: 47, confidence: "high", sourceRecordId: "src-nps-883", assertedAt: "2026-01-10T16:20:00Z" },
    weatherSummary: { value: "Fog bank + low visibility", confidence: "low", sourceRecordId: "src-sar-brief-18", assertedAt: "2026-01-11T12:02:00Z" }
  }
];
