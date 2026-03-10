export type Confidence = "high" | "medium" | "low";

export type ProvenanceField<T> = {
  value: T;
  confidence: Confidence;
  sourceRecordId: string;
  assertedAt: string;
  notes?: string;
};

export type SourceRecord = {
  id: string;
  system: string;
  sourceType: "official_report" | "news" | "crowd_tip" | "satellite";
  citation: string;
  ingestedAt: string;
  trustScore: number;
};

export type LocationEvent = {
  id: string;
  caseId: string;
  eventType: "last_seen" | "evidence" | "search_operation" | "sighting";
  geom: [number, number];
  occurredAt: string;
  sourceRecordId: string;
  confidence: Confidence;
};

export type EnvironmentalSnapshot = {
  id: string;
  locationEventId: string;
  elevationM: ProvenanceField<number>;
  slopeDeg: ProvenanceField<number>;
  landCover: ProvenanceField<string>;
  nearestHydroFeatureM: ProvenanceField<number>;
  trailDistanceM: ProvenanceField<number>;
  weatherSummary: ProvenanceField<string>;
};

export type CaseRecord = {
  id: string;
  caseNumber: string;
  status: ProvenanceField<"open" | "resolved" | "suspended">;
  subjectName: ProvenanceField<string>;
  age: ProvenanceField<number>;
  riskProfile: ProvenanceField<string>;
  primaryBiome: ProvenanceField<string>;
  parkUnit: ProvenanceField<string>;
  disappearedAt: ProvenanceField<string>;
  narrative: ProvenanceField<string>;
  sourceRecordIds: string[];
};
