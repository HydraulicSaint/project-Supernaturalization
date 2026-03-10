ALTER TABLE reconciliation_decision
  ADD COLUMN IF NOT EXISTS actor_id TEXT;

ALTER TABLE reference_layer_version
  ADD COLUMN IF NOT EXISTS input_format TEXT NOT NULL DEFAULT 'geojson',
  ADD COLUMN IF NOT EXISTS layer_name TEXT,
  ADD COLUMN IF NOT EXISTS source_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_srid INT;

ALTER TABLE case_conflict
  ADD COLUMN IF NOT EXISTS normalized_competing_values JSONB;

CREATE TABLE IF NOT EXISTS operator_action_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_entity_type TEXT NOT NULL,
  target_entity_id TEXT,
  notes TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS operator_action_audit_actor_idx ON operator_action_audit(actor_id, created_at DESC);
