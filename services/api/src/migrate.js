import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { getPool, closePool } from "./database.js";

const migrationsDirectory = fileURLToPath(new URL("../migrations/", import.meta.url));
const LOCK_KEY_A = 723901;
const LOCK_KEY_B = 1;

let client;
let lockAcquired = false;
let failed = false;

try {
  const entries = await readdir(migrationsDirectory, { withFileTypes: true });
  const migrations = entries
    .filter(entry => entry.isFile() && /^\d+_[a-z0-9_-]+\.sql$/.test(entry.name))
    .map(entry => ({ version: entry.name.slice(0, -4), path: join(migrationsDirectory, entry.name) }))
    .sort((a, b) => a.version.localeCompare(b.version, "en", { numeric: true }));

  if (migrations.length === 0) throw new Error("no_migrations_found");

  client = await getPool().connect();
  await client.query("SELECT pg_advisory_lock($1, $2)", [LOCK_KEY_A, LOCK_KEY_B]);
  lockAcquired = true;

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  for (const migration of migrations) {
    const existing = await client.query(
      "SELECT 1 FROM schema_migrations WHERE version = $1",
      [migration.version]
    );
    if (existing.rowCount) {
      process.stdout.write(`Migration ${migration.version} already applied\n`);
      continue;
    }

    const sql = await readFile(migration.path, "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (version) VALUES ($1)",
        [migration.version]
      );
      await client.query("COMMIT");
      process.stdout.write(`Applied ${migration.version}\n`);
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch {}
      throw error;
    }
  }
} catch (error) {
  failed = true;
  if (client) {
    try { await client.query("ROLLBACK"); } catch {}
  }
  process.stderr.write("Migration failed; the failed version was not recorded.\n");
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

if (failed) process.exitCode = 1;
