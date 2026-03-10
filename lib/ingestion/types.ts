export type SourceSystem = "namus" | "nps" | "ncmec" | "manual";
export type SourceChannel = "csv" | "html" | "pdf" | "rss" | "json";

export type LocationConfidenceLadder =
  | "state_only"
  | "county_or_park_unit"
  | "city_or_general_area"
  | "named_feature"
  | "estimated_point_with_radius"
  | "exact_or_near_exact";

export type IngestionIssueInput = {
  severity: "info" | "warning" | "error";
  issueType: string;
  message: string;
  fieldPath?: string;
  context?: Record<string, unknown>;
  recoverable?: boolean;
};

export type SourceSnapshotInput = {
  sourceSystem: SourceSystem;
  sourceChannel: SourceChannel;
  ingestionMode: "snapshot" | "delta";
  sourceUri?: string;
  stateBatch?: string;
  snapshotAt: string;
  rawPayload?: unknown;
  rawText?: string;
  rawBinaryBase64?: string;
  metadata?: Record<string, unknown>;
};

export type ParsedSourceRecord = {
  sourceRecordKey: string;
  sourceCaseId?: string;
  parsedPayload: Record<string, unknown>;
  parseConfidence: number;
  isInferred?: boolean;
};

export type CanonicalLocation = {
  reportedLocationText?: string;
  geometryWkt?: string;
  geometryType?: string;
  geomMethod?: string;
  precisionMeters?: number;
  locationConfidence: LocationConfidenceLadder;
  isCentroid?: boolean;
};

export type CanonicalCandidate = {
  canonicalCaseRef: string;
  displayName?: string;
  demographics?: Record<string, unknown>;
  missingFrom?: string;
  missingTo?: string;
  caseStatus?: string;
  outcome?: string;
  foundAt?: string;
  recoveryLocation?: string;
  narrativeSummary?: string;
  sourceConfidence?: number;
  completenessScore?: number;
  anomalyTags?: string[];
  motifTags?: string[];
  jurisdiction?: Record<string, unknown>;
  agency?: Record<string, unknown>;
  sourceCaseId?: string;
  sourceSystem: SourceSystem;
  inferredFields?: string[];
  locations?: Array<CanonicalLocation & { eventType: string }>;
  provenance?: Record<string, unknown>;
};

export type AdapterResult = {
  snapshot: SourceSnapshotInput;
  records: ParsedSourceRecord[];
  candidates: CanonicalCandidate[];
  issues: IngestionIssueInput[];
};
