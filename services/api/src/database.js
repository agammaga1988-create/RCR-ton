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
       VALUES ($1, $2, 'active', $3::timestamptz, $3::timestamptz + INTERVAL '24 hours', 1)
       RETURNING id, status, starts_at, ends_at`,
      [id, userId, now]
    );
    await client.query(
      `INSERT INTO audit_events
       (actor_type, actor_id, event_type, entity_type, entity_id, payload)
       VALUES ('user', $1, 'session.started', 'earning_session', $2, $3::jsonb)`,
      [String(telegramUserId), id, JSON.stringify({ formulaVersion: 1 })]
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

export async function closePool() {
  if (pool) {
    const current = pool;
    pool = undefined;
    await current.end();
  }
}
