-- A disabled policy may retain its approved parameters for audit/restart.
-- The mining cap remains bounded to the 400M RCR allocation at the configured precision.
ALTER TABLE reward_program_config
  DROP CONSTRAINT IF EXISTS reward_program_config_check;

ALTER TABLE reward_program_config
  ADD CONSTRAINT reward_program_config_valid_when_enabled CHECK (
    enabled = FALSE
    OR (
      formula_version IS NOT NULL AND formula_version > 0
      AND decimals IS NOT NULL AND decimals BETWEEN 0 AND 18
      AND reward_rate_units IS NOT NULL AND reward_rate_units > 0
      AND mining_cap_units IS NOT NULL AND mining_cap_units > 0
      AND mining_cap_units <= 400000000::numeric * power(10::numeric, decimals::numeric)
      AND approved_by IS NOT NULL AND length(btrim(approved_by)) > 0
      AND approved_at IS NOT NULL
    )
  );
