BEGIN;
-- No reward formula has been approved. Existing session rows must not imply formula v1.
ALTER TABLE earning_sessions
  ALTER COLUMN reward_formula_version DROP NOT NULL;
COMMIT;
