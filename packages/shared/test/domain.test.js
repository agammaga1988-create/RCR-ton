import test from "node:test";
import assert from "node:assert/strict";
import { TOKEN, calculateSessionReward, startSession, completeSession } from "../src/index.js";

test("token supply and rewards allocation are fixed", () => {
  assert.equal(TOKEN.totalSupply, 1_000_000_000n);
  assert.equal(TOKEN.rewardsAllocation, 400_000_000n);
});

test("reward calculation is bounded by remaining allocation", () => {
  assert.equal(calculateSessionReward({ baseReward: 1000n, remainingAllocation: 50n }), 50n);
  assert.equal(calculateSessionReward({ baseReward: 1000n, multiplierBps: 15000n, remainingAllocation: 5000n }), 1500n);
});

test("active session lasts exactly 24 hours", () => {
  const session = startSession({ userId: "test-user", nowSeconds: 1000 });
  assert.equal(session.endsAt - session.startsAt, 86400);
  assert.throws(() => startSession({ userId: "test-user", nowSeconds: 1001, existingSession: session }), /active session/);
});

test("session cannot complete early", () => {
  const session = startSession({ userId: "test-user", nowSeconds: 1000 });
  assert.throws(() => completeSession(session, session.endsAt - 1, 10n), /not completed/);
  assert.equal(completeSession(session, session.endsAt, 10n).status, "completed");
});
