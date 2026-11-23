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
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("cache-control"), "no-store");
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

test("session endpoint rejects non-JSON and malformed JSON without leaking details", async () => {
  const { child, port } = await startApi();
  try {
    const wrongType = await fetch(`http://127.0.0.1:${port}/sessions`, {
      method: "POST", headers: { "content-type": "text/plain" }, body: "{}"
    });
    assert.equal(wrongType.status, 415);
    assert.equal((await wrongType.json()).error, "unsupported_content_type");

    const malformed = await fetch(`http://127.0.0.1:${port}/sessions`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{"
    });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).error, "invalid_json");
  } finally { child.kill("SIGTERM"); }
});

test("session endpoint rejects oversized request bodies", async () => {
  const { child, port } = await startApi();
  try {
    const response = await fetch(`http://127.0.0.1:${port}/sessions`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "x".repeat(17_000) })
    });
    assert.equal(response.status, 413);
    assert.equal((await response.json()).error, "request_too_large");
  } finally { child.kill("SIGTERM"); }
});

test("session endpoint rate-limits repeated requests from one client", async () => {
  const { child, port } = await startApi();
  try {
    let last;
    for (let i = 0; i < 21; i++) {
      last = await fetch(`http://127.0.0.1:${port}/sessions`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({})
      });
    }
    assert.equal(last.status, 429);
    assert.equal((await last.json()).error, "rate_limit_exceeded");
  } finally { child.kill("SIGTERM"); }
});

test("current-session endpoint does not expose another identity and reports no session", async () => {
  const { child, port } = await startApi();
  try {
    const response = await fetch(`http://127.0.0.1:${port}/sessions/current`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "local-user" })
    });
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error, "active_session_not_found");
  } finally { child.kill("SIGTERM"); }
});
