import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createEarningSession, getCurrentEarningSession, getPool, closePool } from "../src/database.js";

const enabled = process.env.RCR_TEST_DATABASE === "1" && Boolean(process.env.DATABASE_URL);
function testUserId() {
  return String(BigInt(Date.now()) * 1_000n + BigInt(Math.floor(Math.random() * 999)));
}

after(async () => {
  await closePool();
});

test("PostgreSQL creates one durable 24-hour session and rejects a duplicate", { skip: !enabled }, async () => {
  const telegramUserId = testUserId();
  const session = await createEarningSession(telegramUserId);
  assert.equal(session.userId, telegramUserId);
  assert.equal(session.status, "active");
  assert.equal(session.endsAt - session.startsAt, 86_400);
  const persisted = await getPool().query(
    "SELECT reward_formula_version FROM earning_sessions WHERE id = $1",
    [session.id]
  );
  assert.equal(persisted.rows[0].reward_formula_version, null);
  const nonceColumn = await getPool().query(
    "SELECT is_identity FROM information_schema.columns WHERE table_name = 'reward_claims' AND column_name = 'chain_claim_id'"
  );
  assert.equal(nonceColumn.rows[0].is_identity, "YES");
  await assert.rejects(
    createEarningSession(telegramUserId),
    error => error.code === "active_session_exists"
  );
});

test("concurrent PostgreSQL requests cannot create two active sessions", { skip: !enabled }, async () => {
  const telegramUserId = testUserId();
  const results = await Promise.allSettled([
    createEarningSession(telegramUserId),
    createEarningSession(telegramUserId),
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  const rejected = results.find(result => result.status === "rejected");
  assert.equal(rejected.reason.code, "active_session_exists");
});

test("audit rows reject UPDATE and TRUNCATE", { skip: !enabled }, async () => {
  const telegramUserId = testUserId();
  const session = await createEarningSession(telegramUserId);
  const pool = getPool();
  await assert.rejects(
    pool.query("UPDATE audit_events SET event_type = 'tampered' WHERE entity_id = $1", [session.id]),
    /append-only/
  );
  await assert.rejects(pool.query("DELETE FROM audit_events WHERE entity_id = $1", [session.id]), /append-only/);
  await assert.rejects(pool.query("TRUNCATE audit_events"), /append-only/);
});

test("PostgreSQL restores the active session for its verified Telegram identity", { skip: !enabled }, async () => {
  const telegramUserId = testUserId();
  const created = await createEarningSession(telegramUserId);
  const restored = await getCurrentEarningSession(telegramUserId);
  assert.equal(restored.id, created.id);
  assert.equal(restored.userId, telegramUserId);
  assert.equal(restored.endsAt, created.endsAt);
});


test("reward accounting migration installs a disabled policy and rejects invalid ledger facts", { skip: !enabled }, async () => {
  const pool = getPool();
  const policy = await pool.query(
    "SELECT enabled, formula_version, decimals, reward_rate_units, mining_cap_units FROM reward_program_config WHERE singleton = TRUE"
  );
  assert.equal(policy.rowCount, 1);
  assert.equal(policy.rows[0].enabled, false);
  assert.equal(policy.rows[0].formula_version, null);
  assert.equal(policy.rows[0].decimals, null);
  assert.equal(policy.rows[0].reward_rate_units, null);
  assert.equal(policy.rows[0].mining_cap_units, null);
  await assert.rejects(
    pool.query("UPDATE reward_program_config SET enabled = TRUE WHERE singleton = TRUE"),
    error => error.code === "23514"
  );
  await pool.query(
    `UPDATE reward_program_config
     SET formula_version = 1, decimals = 9, reward_rate_units = 1,
         mining_cap_units = 400000000000000000,
         approved_by = 'automated-test', approved_at = now()
     WHERE singleton = TRUE`
  );
  await pool.query("UPDATE reward_program_config SET enabled = TRUE WHERE singleton = TRUE");
  await pool.query("UPDATE reward_program_config SET enabled = FALSE WHERE singleton = TRUE");
  const pausedPolicy = await pool.query(
    "SELECT enabled, approved_by, approved_at FROM reward_program_config WHERE singleton = TRUE"
  );
  assert.equal(pausedPolicy.rows[0].enabled, false);
  assert.equal(pausedPolicy.rows[0].approved_by, "automated-test");
  assert.ok(pausedPolicy.rows[0].approved_at);
  await assert.rejects(
    pool.query(
      "UPDATE reward_program_config SET enabled = TRUE, mining_cap_units = 400000000000000001 WHERE singleton = TRUE"
    ),
    error => error.code === "23514"
  );

  const telegramUserId = testUserId();
  const session = await createEarningSession(telegramUserId);
  const user = await pool.query("SELECT id FROM app_users WHERE telegram_user_id = $1", [telegramUserId]);
  await assert.rejects(
    pool.query(
      `INSERT INTO reward_ledger (id, session_id, user_id, formula_version, amount_units)
       VALUES (gen_random_uuid(), $1, $2, 1, 0)`,
      [session.id, user.rows[0].id]
    ),
    error => error.code === "23514"
  );
  await pool.query(
    `INSERT INTO reward_ledger (id, session_id, user_id, formula_version, amount_units)
     VALUES (gen_random_uuid(), $1, $2, 1, 1)`,
    [session.id, user.rows[0].id]
  );
  await assert.rejects(
    pool.query("UPDATE reward_ledger SET amount_units = 2 WHERE session_id = $1", [session.id]),
    /accounting facts are immutable/
  );
  await assert.rejects(
    pool.query(
      `INSERT INTO reward_ledger (id, session_id, user_id, formula_version, amount_units)
       VALUES (gen_random_uuid(), $1, $2, 1, 1)`,
      [session.id, user.rows[0].id]
    ),
    error => error.code === "23505"
  );
});
