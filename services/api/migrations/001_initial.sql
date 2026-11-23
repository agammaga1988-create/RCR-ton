CREATE TABLE IF NOT EXISTS app_users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  telegram_user_id BIGINT UNIQUE NOT NULL,
  wallet_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS earning_sessions (
  id UUID PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_users(id),
  status TEXT NOT NULL CHECK (status IN ('active','completed','claimed','cancelled')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reward_units NUMERIC(78,0),
  reward_formula_version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at = starts_at + INTERVAL '24 hours'),
  CHECK (reward_units IS NULL OR reward_units >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_session_per_user
  ON earning_sessions(user_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS reward_claims (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL UNIQUE REFERENCES earning_sessions(id),
  user_id BIGINT NOT NULL REFERENCES app_users(id),
  amount_units NUMERIC(78,0) NOT NULL CHECK (amount_units > 0),
  destination_wallet TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','submitted','confirmed','failed')),
  transaction_hash TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user','system','admin')),
  actor_id TEXT,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_entity_idx
  ON audit_events(entity_type, entity_id, created_at);

-- Defense in depth: reject row mutation and table truncation even if grants are misconfigured.
CREATE OR REPLACE FUNCTION reject_audit_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS audit_events_no_row_mutation ON audit_events;
CREATE TRIGGER audit_events_no_row_mutation
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();

DROP TRIGGER IF EXISTS audit_events_no_truncate ON audit_events;
CREATE TRIGGER audit_events_no_truncate
  BEFORE TRUNCATE ON audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_mutation();

REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM PUBLIC;

