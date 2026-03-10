CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  age_years INT,
  risk_profile TEXT,
  primary_biome TEXT,
  park_unit TEXT,
  disappeared_at TIMESTAMPTZ,
  narrative TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE source_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system TEXT NOT NULL,
  source_type TEXT NOT NULL,
  citation TEXT NOT NULL,
  trust_score NUMERIC(4,3) NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_payload JSONB
);

CREATE TABLE case_source_records (
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  source_record_id UUID NOT NULL REFERENCES source_records(id) ON DELETE CASCADE,
  PRIMARY KEY (case_id, source_record_id)
);

CREATE TABLE location_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  geom GEOMETRY(Point, 4326) NOT NULL,
  occurred_at TIMESTAMPTZ,
  confidence TEXT NOT NULL,
  source_record_id UUID NOT NULL REFERENCES source_records(id)
);

CREATE INDEX location_events_geom_idx ON location_events USING GIST (geom);

CREATE TABLE environmental_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_event_id UUID NOT NULL REFERENCES location_events(id) ON DELETE CASCADE,
  elevation_m NUMERIC,
  slope_deg NUMERIC,
  land_cover TEXT,
  nearest_hydro_feature_m NUMERIC,
  trail_distance_m NUMERIC,
  weather_summary TEXT,
  source_record_id UUID NOT NULL REFERENCES source_records(id),
  confidence TEXT NOT NULL
);

CREATE TABLE field_provenance (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  source_record_id UUID NOT NULL REFERENCES source_records(id),
  confidence TEXT NOT NULL,
  asserted_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  UNIQUE (entity_type, entity_id, field_name, source_record_id)
);

-- Planned expansion surfaces for AI-assisted extraction and contradiction analysis.
CREATE TABLE extracted_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  claim_text TEXT NOT NULL,
  model_name TEXT,
  contradiction_group TEXT,
  confidence NUMERIC(4,3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
