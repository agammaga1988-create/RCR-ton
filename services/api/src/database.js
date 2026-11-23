import pg from "pg";
import { randomUUID } from "node:crypto";

const { Pool } = pg;
let pool;

export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("database_not_configured");
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX || 5),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: process.env.PGSSL === "require" ? { rejectUnauthorized: true } : undefined,
    });
  }
  return pool;
}

export async function createEarningSession(telegramUserId, now = new Date()) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const userResult = await client.query(
      `INSERT INTO app_users (telegram_user_id) VALUES ($1)
       ON CONFLICT (telegram_user_id) DO UPDATE SET updated_at = now()
       RETURNING id`,
      [telegramUserId]
    );
    const userId = userResult.rows[0].id;
    const active = await client.query(
      `SELECT id, starts_at, ends_at, status FROM earning_sessions
       WHERE user_id = $1 AND status = 'active' AND ends_at > $2
       FOR UPDATE`,
      [userId, now]
    );
    if (active.rowCount) {
      await client.query("ROLLBACK");
      const error = new Error("an active session already exists");
      error.code = "active_session_exists";
      throw error;
    }
    // Expire stale active session before inserting the next session.
    await client.query(
      `UPDATE earning_sessions SET status = 'completed'
       WHERE user_id = $1 AND status = 'active' AND ends_at <= $2`,
      [userId, now]
    );
    const id = randomUUID();
    const inserted = await client.query(
      `INSERT INTO earning_sessions
       (id, user_id, status, starts_at, ends_at, reward_formula_version)
       VALUES ($1, $2, 'active', $3::timestamptz, $3::timestamptz + INTERVAL '24 hours', NULL)
       RETURNING id, status, starts_at, ends_at`,
      [id, userId, now]
    );
    await client.query(
      `INSERT INTO audit_events
       (actor_type, actor_id, event_type, entity_type, entity_id, payload)
       VALUES ('user', $1, 'session.started', 'earning_session', $2, $3::jsonb)`,
      [String(telegramUserId), id, JSON.stringify({ rewardFormulaVersion: null })]
    );
    await client.query("COMMIT");
    const row = inserted.rows[0];
    return {
      id: row.id,
      userId: String(telegramUserId),
      status: row.status,
      startsAt: Math.floor(new Date(row.starts_at).getTime() / 1000),
      endsAt: Math.floor(new Date(row.ends_at).getTime() / 1000),
      reward: null,
      claimedAt: null,
    };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    if (error.code === "23505") {
      const conflict = new Error("an active session already exists");
      conflict.code = "active_session_exists";
      throw conflict;
    }
    throw error;
  } finally {
    client.release();
  }
}


// Internal service primitive only. The amount must come from the server-side,
// owner-approved formula engine; this function is never exposed as an API input.
export async function accrueCompletedSessionReward(sessionId, amountUnits, formulaVersion, now = new Date()) {
  const amount = String(amountUnits);
  if (!/^[1-9][0-9]{0,77}$/.test(amount)) {
    const error = new Error("invalid_reward_amount");
    error.code = "invalid_reward_amount";
    throw error;
  }
  if (!Number.isSafeInteger(formulaVersion) || formulaVersion < 1) {
    const error = new Error("invalid_reward_formula_version");
    error.code = "invalid_reward_formula_version";
    throw error;
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const policyResult = await client.query(
      `SELECT enabled, formula_version, mining_cap_units
       FROM reward_program_config WHERE singleton = TRUE FOR UPDATE`
    );
    const policy = policyResult.rows[0];
    if (!policy || !policy.enabled) {
      const error = new Error("reward_program_disabled");
      error.code = "reward_program_disabled";
      throw error;
    }
    if (policy.formula_version !== formulaVersion) {
      const error = new Error("reward_formula_version_mismatch");
      error.code = "reward_formula_version_mismatch";
      throw error;
    }

    const sessionResult = await client.query(
      `SELECT id, user_id, status, ends_at, reward_formula_version
       FROM earning_sessions WHERE id = $1 FOR UPDATE`,
      [sessionId]
    );
    if (!sessionResult.rowCount) {
      const error = new Error("earning_session_not_found");
      error.code = "earning_session_not_found";
      throw error;
    }
    const session = sessionResult.rows[0];
    if (new Date(session.ends_at) > now) {
      const error = new Error("earning_session_not_completed");
      error.code = "earning_session_not_completed";
      throw error;
    }
    if (session.status === "active") {
      await client.query(
        "UPDATE earning_sessions SET status = 'completed' WHERE id = $1 AND status = 'active'",
        [sessionId]
      );
    } else if (session.status !== "completed") {
      const error = new Error("earning_session_not_eligible");
      error.code = "earning_session_not_eligible";
      throw error;
    }
    if (session.reward_formula_version !== null && session.reward_formula_version !== formulaVersion) {
      const error = new Error("reward_formula_version_mismatch");
      error.code = "reward_formula_version_mismatch";
      throw error;
    }

    const existingResult = await client.query(
      `SELECT id, amount_units, formula_version, status
       FROM reward_ledger WHERE session_id = $1`,
      [sessionId]
    );
    if (existingResult.rowCount) {
      const existing = existingResult.rows[0];
      if (existing.status === "void") {
        const error = new Error("reward_already_void");
        error.code = "reward_already_void";
        throw error;
      }
      if (existing.amount_units !== amount || existing.formula_version !== formulaVersion) {
        const error = new Error("reward_idempotency_conflict");
        error.code = "reward_idempotency_conflict";
        throw error;
      }
      await client.query("COMMIT");
      return {
        id: existing.id,
        sessionId,
        amountUnits: existing.amount_units,
        formulaVersion: existing.formula_version,
        status: existing.status,
        created: false,
      };
    }

    const totalResult = await client.query(
      "SELECT COALESCE(SUM(amount_units), 0)::text AS total FROM reward_ledger WHERE status <> 'void'"
    );
    if (BigInt(totalResult.rows[0].total) + BigInt(amount) > BigInt(policy.mining_cap_units)) {
      const error = new Error("mining_reward_allocation_exceeded");
      error.code = "mining_reward_allocation_exceeded";
      throw error;
    }

    const ledgerId = randomUUID();
    await client.query(
      `UPDATE earning_sessions
       SET status = 'completed', reward_units = $2, reward_formula_version = $3
       WHERE id = $1`,
      [sessionId, amount, formulaVersion]
    );
    await client.query(
      `INSERT INTO reward_ledger
       (id, session_id, user_id, formula_version, amount_units, status)
       VALUES ($1, $2, $3, $4, $5, 'accrued')`,
      [ledgerId, sessionId, session.user_id, formulaVersion, amount]
    );
    await client.query(
      `INSERT INTO audit_events
       (actor_type, actor_id, event_type, entity_type, entity_id, payload)
       VALUES ('system', 'reward-engine', 'reward.accrued', 'reward_ledger', $1, $2::jsonb)`,
      [ledgerId, JSON.stringify({ sessionId, formulaVersion, amountUnits: amount })]
    );
    await client.query("COMMIT");
    return {
      id: ledgerId,
      sessionId,
      amountUnits: amount,
      formulaVersion,
      status: "accrued",
      created: true,
    };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
  }
}


export async function getCurrentEarningSession(telegramUserId, now = new Date()) {
  const result = await getPool().query(
    `SELECT s.id, s.status, s.starts_at, s.ends_at
     FROM earning_sessions s
     JOIN app_users u ON u.id = s.user_id
     WHERE u.telegram_user_id = $1 AND s.status = 'active' AND s.ends_at > $2
     ORDER BY s.starts_at DESC
     LIMIT 1`,
    [telegramUserId, now]
  );
  if (!result.rowCount) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    userId: String(telegramUserId),
    status: row.status,
    startsAt: Math.floor(new Date(row.starts_at).getTime() / 1000),
    endsAt: Math.floor(new Date(row.ends_at).getTime() / 1000),
    reward: null,
    claimedAt: null,
  };
}

export async function closePool() {
  if (pool) {
    const current = pool;
    pool = undefined;
    await current.end();
  }
}
