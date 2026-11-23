import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getPool, closePool } from "./database.js";

const migrationPath = new URL("../migrations/001_initial.sql", import.meta.url);
try {
  const sql = await readFile(fileURLToPath(migrationPath), "utf8");
  await getPool().query(sql);
  process.stdout.write("Applied 001_initial.sql\n");
} catch (error) {
  process.stderr.write(`Migration failed: ${error.message}\n`);
  process.exitCode = 1;
} finally {
  await closePool();
}
