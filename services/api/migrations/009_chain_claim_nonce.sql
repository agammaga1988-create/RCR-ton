-- A monotonic BIGINT claim nonce maps each durable database claim to the
-- uint64 queryId used by the MiningIssuer contract. The UUID remains the
-- application idempotency key; chain_claim_id is the on-chain replay key.
ALTER TABLE reward_claims
  ADD COLUMN chain_claim_id BIGINT GENERATED ALWAYS AS IDENTITY;

ALTER TABLE reward_claims
  ADD CONSTRAINT reward_claims_chain_claim_id_unique UNIQUE (chain_claim_id);
