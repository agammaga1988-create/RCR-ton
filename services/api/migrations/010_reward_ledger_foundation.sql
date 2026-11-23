-- Durable reward-accounting foundation. This migration deliberately does not
-- approve or enable an emission formula, and exposes no payout capability.
CREATE TABLE IF NOT EXISTS reward_program_config (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  formula_version INTEGER,
  decimals SMALLINT,
  reward_rate_units NUMERIC(78,0),
  mining_cap_units NUMERIC(78,0),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (enabled = FALSE AND approved_at IS NULL)
    OR
    (enabled = TRUE
      AND formula_version IS NOT NULL AND formula_version > 0
      AND decimals IS NOT NULL AND decimals BETWEEN 0 AND 18
      AND reward_rate_units IS NOT NULL AND reward_rate_units > 0
      AND mining_cap_units IS NOT NULL AND mining_cap_units > 0
      AND approved_by IS NOT NULL AND length(btrim(approved_by)) > 0
      AND approved_at IS NOT NULL)
  )
);

INSERT INTO reward_program_config (singleton, enabled)
VALUES (TRUE, FALSE)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS reward_ledger (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL UNIQUE REFERENCES earning_sessions(id),
  user_id BIGINT NOT NULL REFERENCES app_users(id),
  formula_version INTEGER NOT NULL CHECK (formula_version > 0),
  amount_units NUMERIC(78,0) NOT NULL CHECK (amount_units > 0),
  status TEXT NOT NULL DEFAULT 'accrued'
    CHECK (status IN ('accrued', 'claim_pending', 'claimed', 'void')),
  claim_id UUID UNIQUE REFERENCES reward_claims(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (status = 'accrued' AND claim_id IS NULL)
    OR (status = 'claim_pending' AND claim_id IS NOT NULL)
    OR (status = 'claimed' AND claim_id IS NOT NULL)
    OR (status = 'void' AND claim_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS reward_ledger_user_status_idx
  ON reward_ledger(user_id, status, created_at);

CREATE OR REPLACE FUNCTION guard_reward_ledger_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'reward_ledger rows cannot be deleted';
  END IF;
  IF NEW.id <> OLD.id
     OR NEW.session_id <> OLD.session_id
     OR NEW.user_id <> OLD.user_id
     OR NEW.formula_version <> OLD.formula_version
     OR NEW.amount_units <> OLD.amount_units
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'reward_ledger accounting facts are immutable';
  END IF;
  IF NOT (
    (OLD.status = 'accrued' AND NEW.status IN ('claim_pending', 'void'))
    OR (OLD.status = 'claim_pending' AND NEW.status IN ('claimed', 'accrued'))
    OR (OLD.status = NEW.status)
  ) THEN
    RAISE EXCEPTION 'invalid reward_ledger state transition';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reward_ledger_guard_update ON reward_ledger;
CREATE TRIGGER reward_ledger_guard_update
  BEFORE UPDATE OR DELETE ON reward_ledger
  FOR EACH ROW EXECUTE FUNCTION guard_reward_ledger_mutation();

REVOKE DELETE ON reward_ledger FROM PUBLIC;
