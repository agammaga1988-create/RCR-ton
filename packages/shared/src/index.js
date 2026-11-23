export const TOKEN = Object.freeze({
  symbol: "RCR",
  totalSupply: 1_000_000_000n,
  rewardsAllocation: 400_000_000n,
  sessionDurationSeconds: 24 * 60 * 60,
});

export const SessionStatus = Object.freeze({
  READY: "ready",
  ACTIVE: "active",
  COMPLETED: "completed",
  CLAIMED: "claimed",
});

export function calculateSessionReward({ baseReward, multiplierBps = 10_000, remainingAllocation }) {
  for (const [name, value] of Object.entries({ baseReward, multiplierBps, remainingAllocation })) {
    if (typeof value !== "bigint" || value < 0n) throw new TypeError(`${name} must be a non-negative bigint`);
  }
  if (multiplierBps > 100_000n) throw new RangeError("multiplierBps exceeds the hard safety ceiling");
  const calculated = (baseReward * multiplierBps) / 10_000n;
  return calculated > remainingAllocation ? remainingAllocation : calculated;
}

export function startSession({ userId, nowSeconds, existingSession = null }) {
  if (!userId || typeof userId !== "string") throw new TypeError("userId is required");
  if (!Number.isSafeInteger(nowSeconds) || nowSeconds < 0) throw new TypeError("nowSeconds must be a valid timestamp");
  if (existingSession?.status === SessionStatus.ACTIVE && existingSession.endsAt > nowSeconds) {
    throw new Error("an active session already exists");
  }
  return Object.freeze({
    id: crypto.randomUUID(),
    userId,
    status: SessionStatus.ACTIVE,
    startsAt: nowSeconds,
    endsAt: nowSeconds + TOKEN.sessionDurationSeconds,
    reward: null,
    claimedAt: null,
  });
}

export function completeSession(session, nowSeconds, reward) {
  if (!session || session.status !== SessionStatus.ACTIVE) throw new Error("session is not active");
  if (!Number.isSafeInteger(nowSeconds) || nowSeconds < session.endsAt) throw new Error("session has not completed");
  if (typeof reward !== "bigint" || reward < 0n) throw new TypeError("reward must be a non-negative bigint");
  return Object.freeze({ ...session, status: SessionStatus.COMPLETED, reward: reward.toString() });
}
