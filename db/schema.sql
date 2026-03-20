CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE location_confidence_ladder AS ENUM (
  'state_only',
  'county_or_park_unit',
  'city_or_general_area',
  'named_feature',
  'estimated_point_with_radius',
  'exact_or_near_exact'
);

CREATE TABLE source_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system TEXT NOT NULL,
  source_channel TEXT NOT NULL,
  ingestion_mode TEXT NOT NULL,
  source_uri TEXT,
  state_batch TEXT,
  snapshot_at TIMESTAMPTZ NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_payload JSONB,
  raw_text TEXT,
  raw_binary_base64 TEXT,
  content_hash TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (source_system, source_channel, content_hash)
);

CREATE TABLE source_record (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES source_snapshot(id) ON DELETE CASCADE,
  source_record_key TEXT NOT NULL,
  source_case_id TEXT,
  record_hash TEXT NOT NULL,
  parsed_payload JSONB NOT NULL,
  parse_confidence NUMERIC(5,4),
  visibility_state TEXT NOT NULL DEFAULT 'visible',
  is_inferred BOOLEAN NOT NULL DEFAULT false,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (snapshot_id, source_record_key)
);

CREATE TABLE case_canonical (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_case_ref TEXT NOT NULL UNIQUE,
  display_name TEXT,
  demographics JSONB NOT NULL DEFAULT '{}'::jsonb,
  missing_from TIMESTAMPTZ,
  missing_to TIMESTAMPTZ,
  case_status TEXT,
  outcome TEXT,
  jurisdiction JSONB NOT NULL DEFAULT '{}'::jsonb,
  agency JSONB NOT NULL DEFAULT '{}'::jsonb,
  narrative_summary TEXT,
  source_confidence NUMERIC(5,4),
  completeness_score NUMERIC(5,4),
  anomaly_tags TEXT[] NOT NULL DEFAULT '{}',
  motif_tags TEXT[] NOT NULL DEFAULT '{}',
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  inferred_fields TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE case_source_link (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES case_canonical(id) ON DELETE CASCADE,
  source_record_id UUID NOT NULL REFERENCES source_record(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  source_case_id TEXT,
  relationship_type TEXT NOT NULL DEFAULT 'matched',
  field_confidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  link_confidence NUMERIC(5,4),
  first_linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(case_id, source_record_id)
);

CREATE TABLE location_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES case_canonical(id) ON DELETE CASCADE,
  source_record_id UUID REFERENCES source_record(id),
  event_type TEXT NOT NULL,
  event_time_from TIMESTAMPTZ,
  event_time_to TIMESTAMPTZ,
  reported_location_text TEXT,
  geometry GEOMETRY(Geometry, 4326),
  geometry_type TEXT,
  geom_method TEXT,
  precision_meters NUMERIC,
  location_confidence location_confidence_ladder NOT NULL,
  confidence_score NUMERIC(5,4),
  is_centroid BOOLEAN NOT NULL DEFAULT false,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  event_fingerprint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX location_event_fingerprint_uidx ON location_event(event_fingerprint);
CREATE INDEX location_event_geom_gix ON location_event USING GIST (geometry);

CREATE TABLE environment_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES case_canonical(id) ON DELETE CASCADE,
  location_event_id UUID REFERENCES location_event(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  elevation_m NUMERIC,
  slope_deg NUMERIC,
  nearest_water_m NUMERIC,
  nearest_trail_m NUMERIC,
  nearest_road_m NUMERIC,
  admin_membership JSONB NOT NULL DEFAULT '{}'::jsonb,
  park_membership JSONB NOT NULL DEFAULT '{}'::jsonb,
  land_water_class TEXT,
  confidence_score NUMERIC(5,4),
  reference_layer_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  stale_reference_data BOOLEAN NOT NULL DEFAULT false,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX environment_snapshot_unique_source_per_event_idx ON environment_snapshot(location_event_id, source);

CREATE TABLE gis_hydrography (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_version_id UUID,
  feature_name TEXT,
  feature_class TEXT,
  source_dataset TEXT NOT NULL,
  geom GEOMETRY(Geometry, 4326) NOT NULL
);
CREATE INDEX gis_hydrography_geom_gix ON gis_hydrography USING GIST (geom);

CREATE TABLE gis_roads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_version_id UUID,
  road_name TEXT,
  road_class TEXT,
  source_dataset TEXT NOT NULL,
  geom GEOMETRY(Geometry, 4326) NOT NULL
);
CREATE INDEX gis_roads_geom_gix ON gis_roads USING GIST (geom);

CREATE TABLE gis_trails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_version_id UUID,
  trail_name TEXT,
  trail_class TEXT,
  source_dataset TEXT NOT NULL,
  geom GEOMETRY(Geometry, 4326) NOT NULL
);
CREATE INDEX gis_trails_geom_gix ON gis_trails USING GIST (geom);

CREATE TABLE gis_admin_boundaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_version_id UUID,
  admin_type TEXT NOT NULL,
  admin_name TEXT NOT NULL,
  admin_code TEXT,
  source_dataset TEXT NOT NULL,
  geom GEOMETRY(MultiPolygon, 4326) NOT NULL
);
CREATE INDEX gis_admin_boundaries_geom_gix ON gis_admin_boundaries USING GIST (geom);

CREATE TABLE gis_protected_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_version_id UUID,
  unit_name TEXT NOT NULL,
  designation TEXT,
  source_dataset TEXT NOT NULL,
  geom GEOMETRY(MultiPolygon, 4326) NOT NULL
);
CREATE INDEX gis_protected_areas_geom_gix ON gis_protected_areas USING GIST (geom);

CREATE TABLE derived_metric (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES case_canonical(id) ON DELETE CASCADE,
  location_event_id UUID REFERENCES location_event(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC,
  metric_unit TEXT,
  metric_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  derived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  derivation_method TEXT NOT NULL,
  confidence_score NUMERIC(5,4),
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE ingestion_job_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_key TEXT NOT NULL,
  job_type TEXT NOT NULL,
  source_system TEXT,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  attempt INT NOT NULL DEFAULT 1,
  trigger_mode TEXT NOT NULL,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT
);
CREATE INDEX ingestion_job_run_job_key_idx ON ingestion_job_run(job_key, started_at DESC);

CREATE TABLE reconciliation_decision (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_run_id UUID REFERENCES ingestion_job_run(id) ON DELETE SET NULL,
  snapshot_id UUID REFERENCES source_snapshot(id) ON DELETE SET NULL,
  source_record_id UUID REFERENCES source_record(id) ON DELETE SET NULL,
  case_id UUID REFERENCES case_canonical(id) ON DELETE SET NULL,
  decision_type TEXT NOT NULL,
  inputs_considered JSONB NOT NULL DEFAULT '{}'::jsonb,
  rule_triggered TEXT NOT NULL,
  previous_value JSONB,
  new_value JSONB,
  confidence NUMERIC(5,4),
  actor_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ingestion_issue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_run_id UUID REFERENCES ingestion_job_run(id) ON DELETE SET NULL,
  snapshot_id UUID REFERENCES source_snapshot(id) ON DELETE SET NULL,
  source_record_id UUID REFERENCES source_record(id) ON DELETE SET NULL,
  severity TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  field_path TEXT,
  message TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  recoverable BOOLEAN NOT NULL DEFAULT true,
  review_status TEXT NOT NULL DEFAULT 'unreviewed',
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE reference_layer_version (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_source_name TEXT NOT NULL,
  layer_type TEXT NOT NULL,
  source_manifest TEXT NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_version TEXT NOT NULL,
  feature_count INT NOT NULL DEFAULT 0,
  geometry_type_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  input_format TEXT NOT NULL DEFAULT 'geojson',
  layer_name TEXT,
  source_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_srid INT,
  provenance_notes TEXT,
  UNIQUE(layer_type, effective_version)
);

ALTER TABLE gis_hydrography ADD CONSTRAINT gis_hydrography_layer_version_fk FOREIGN KEY (layer_version_id) REFERENCES reference_layer_version(id);
ALTER TABLE gis_roads ADD CONSTRAINT gis_roads_layer_version_fk FOREIGN KEY (layer_version_id) REFERENCES reference_layer_version(id);
ALTER TABLE gis_trails ADD CONSTRAINT gis_trails_layer_version_fk FOREIGN KEY (layer_version_id) REFERENCES reference_layer_version(id);
ALTER TABLE gis_admin_boundaries ADD CONSTRAINT gis_admin_boundaries_layer_version_fk FOREIGN KEY (layer_version_id) REFERENCES reference_layer_version(id);
ALTER TABLE gis_protected_areas ADD CONSTRAINT gis_protected_areas_layer_version_fk FOREIGN KEY (layer_version_id) REFERENCES reference_layer_version(id);

CREATE TABLE case_conflict (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES case_canonical(id) ON DELETE CASCADE,
  conflict_type TEXT NOT NULL,
  source_record_ids UUID[] NOT NULL DEFAULT '{}',
  competing_values JSONB NOT NULL,
  normalized_competing_values JSONB,
  severity TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'unreviewed',
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE operator_action_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  actor_display_name TEXT,
  auth_source TEXT,
  action_type TEXT NOT NULL,
  target_entity_type TEXT NOT NULL,
  target_entity_id TEXT,
  notes TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX case_conflict_case_idx ON case_conflict(case_id, created_at DESC);
CREATE INDEX case_conflict_review_idx ON case_conflict(review_status, severity);
CREATE INDEX environment_snapshot_stale_idx ON environment_snapshot(stale_reference_data, captured_at DESC);
CREATE INDEX reference_layer_version_layer_idx ON reference_layer_version(layer_type, imported_at DESC);
CREATE INDEX operator_action_audit_actor_idx ON operator_action_audit(actor_id, created_at DESC);

CREATE TABLE internal_operator_account (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator',
  auth_source TEXT NOT NULL DEFAULT 'local_password',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX source_record_key_idx ON source_record(source_record_key);
CREATE INDEX source_record_hash_idx ON source_record(record_hash);
CREATE INDEX case_canonical_status_idx ON case_canonical(case_status);
CREATE INDEX case_source_link_source_idx ON case_source_link(source_system, source_case_id);
