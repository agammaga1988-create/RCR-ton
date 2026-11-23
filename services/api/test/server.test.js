import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

async function startApi(extraEnv = {}) {
  const port = 3400 + Math.floor(Math.random() * 400);
  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", NODE_ENV: "test", DATABASE_URL: "", TELEGRAM_BOT_TOKEN: "", ...extraEnv },
    stdio: "ignore"
  });
  for (let i = 0; i < 40; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return { child, port };
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  child.kill("SIGTERM");
  throw new Error("API did not start");
}

test("API exposes health and safe configuration", async () => {
  const { child, port } = await startApi();
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ok, true);
    const config = await fetch(`http://127.0.0.1:${port}/config`).then(r => r.json());
    assert.equal(config.claimsEnabled, false);
    assert.equal(config.persistence, "memory-development-only");
  } finally { child.kill("SIGTERM"); }
});

test("development session endpoint rejects missing user identity", async () => {
  const { child, port } = await startApi();
  try {
    const response = await fetch(`http://127.0.0.1:${port}/sessions`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({})
    });
    assert.equal(response.status, 400);
  } finally { child.kill("SIGTERM"); }
});

test("production fails closed without Telegram and database configuration", async () => {
  const { child, port } = await startApi({ NODE_ENV: "production" });
  try {
    const response = await fetch(`http://127.0.0.1:${port}/sessions`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "spoofed-user" })
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, "telegram_auth_not_configured");
  } finally { child.kill("SIGTERM"); }
});
