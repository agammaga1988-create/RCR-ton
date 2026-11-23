import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getPool, closePool } from "./database.js";

const migration = Object.freeze({
  version: "001_initial",
  path: new URL("../migrations/001_initial.sql", import.meta.url),
});
const LOCK_KEY_A = 723901;
const LOCK_KEY_B = 1;

let client;
let lockAcquired = false;
try {
  const sql = await readFile(fileURLToPath(migration.path), "utf8");
  client = await getPool().connect();
  await client.query("SELECT pg_advisory_lock($1, $2)", [LOCK_KEY_A, LOCK_KEY_B]);
  lockAcquired = true;
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  const existing = await client.query(
    "SELECT 1 FROM schema_migrations WHERE version = $1",
    [migration.version]
  );
  if (existing.rowCount) {
    process.stdout.write(`Migration ${migration.version} already applied\n`);
  } else {
    await client.query(sql);
    await client.query(
      "INSERT INTO schema_migrations (version) VALUES ($1)",
      [migration.version]
    );
    process.stdout.write(`Applied ${migration.version}\n`);
  }
} catch (error) {
  if (client) {
    try { await client.query("ROLLBACK"); } catch {}
  }
  process.stderr.write("Migration failed; no migration success was recorded.\n");
  process.exitCode = 1;
} finally {
  if (client) {
    if (lockAcquired) {
      try { await client.query("SELECT pg_advisory_unlock($1, $2)", [LOCK_KEY_A, LOCK_KEY_B]); } catch {}
    }
    client.release();
  }
  await closePool();
}
