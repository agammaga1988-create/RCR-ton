import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";

async function startApi(extraEnv = {}) {
  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, PORT: "0", HOST: "127.0.0.1", NODE_ENV: "test", DATABASE_URL: "", TELEGRAM_BOT_TOKEN: "", RCR_TEST_SERVER_PORT: "1", ...extraEnv },
    stdio: ["ignore", "pipe", "ignore"]
  });
  let port = null;
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", chunk => {
    const prefix = "RCR API listening on http://127.0.0.1:";
    const index = chunk.indexOf(prefix);
    if (index >= 0) port = Number(chunk.slice(index + prefix.length).trim().split(/\s/)[0]);
  });
  for (let i = 0; i < 80; i++) {
    if (port !== null) {
      try {
        const response = await fetch("http://127.0.0.1:" + port + "/health");
        if (response.ok) return { child, port };
      } catch {}
    }
    if (child.exitCode !== null) break;
    await new Promise(resolve => setTimeout(resolve, 50));
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

test("Mini App can restore an active development session after reload", async () => {
  const { child, port } = await startApi();
  try {
    const base = `http://127.0.0.1:${port}`;
    const started = await fetch(base + "/sessions", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "reload-test-user" })
    });
    assert.equal(started.status, 201);
    const created = (await started.json()).session;
    const restoredResponse = await fetch(base + "/sessions/current", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "reload-test-user" })
    });
    assert.equal(restoredResponse.status, 200);
    const restored = (await restoredResponse.json()).session;
    assert.equal(restored.id, created.id);
    assert.equal(restored.endsAt, created.endsAt);
  } finally { child.kill("SIGTERM"); }
});


function makeTelegramInitData(botToken, authDate) {
  const user = JSON.stringify({ id: 123456, first_name: "Test" });
  const fields = [`auth_date=${authDate}`, `user=${user}`].sort();
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secret).update(fields.join("\n")).digest("hex");
  return fields.join("&") + "&hash=" + hash;
}

test("production current-session endpoint fails closed without PostgreSQL", async () => {
  const token = "123456:test-bot-token";
  const { child, port } = await startApi({
    NODE_ENV: "production", TELEGRAM_BOT_TOKEN: token, DATABASE_URL: ""
  });
  try {
    const initData = makeTelegramInitData(token, Math.floor(Date.now() / 1000));
    const response = await fetch("http://127.0.0.1:" + port + "/sessions/current", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData })
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, "database_not_configured");
  } finally { child.kill("SIGTERM"); }
});

test("API CORS allows only the configured HTTPS Mini App origin", async () => {
  const { child, port } = await startApi({ RCR_PUBLIC_URL: "https://rcr.example" });
  try {
    const base = "http://127.0.0.1:" + port;
    const allowed = await fetch(base + "/sessions", {
      method: "OPTIONS",
      headers: { Origin: "https://rcr.example", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" },
    });
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers.get("access-control-allow-origin"), "https://rcr.example");
    const actual = await fetch(base + "/sessions", { method: "POST", headers: { Origin: "https://rcr.example", "content-type": "application/json" }, body: "{}" });
    assert.equal(actual.status, 400);
    assert.equal(actual.headers.get("access-control-allow-origin"), "https://rcr.example");
    const denied = await fetch(base + "/sessions", { method: "OPTIONS", headers: { Origin: "https://attacker.example" } });
    assert.equal(denied.status, 403);
  } finally { child.kill("SIGTERM"); }
});
