import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createEarningSession, getPool, closePool } from "../src/database.js";

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
  await assert.rejects(pool.query("TRUNCATE audit_events"), /append-only/);
});
