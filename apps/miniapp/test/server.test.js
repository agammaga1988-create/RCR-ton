import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

async function startMiniApp() {
  const port = 18_000 + Math.floor(Math.random() * 10_000);
  const child = spawn(process.execPath, ["server.js"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", RCR_API_BASE: "" },
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
  throw new Error("Mini App server did not start");
}

test("Mini App serves safe health and API configuration", async () => {
  const { child, port } = await startMiniApp();
  try {
    const base = `http://127.0.0.1:${port}`;
    const health = await fetch(base + "/health");
    assert.equal((await health.json()).ok, true);
    assert.equal(health.headers.get("x-content-type-options"), "nosniff");
    const config = await fetch(base + "/config.js");
    assert.match(await config.text(), /apiBase: ""/);
    assert.match(config.headers.get("content-security-policy"), /frame-ancestors https:\/\/web\.telegram\.org/);
    const page = await fetch(base + "/");
    assert.equal(page.status, 200);
    assert.match(await page.text(), /24-hour earning sessions/);
  } finally { child.kill("SIGTERM"); }
});

test("Mini App rejects unsupported methods and unknown paths", async () => {
  const { child, port } = await startMiniApp();
  try {
    const base = `http://127.0.0.1:${port}`;
    assert.equal((await fetch(base + "/", { method: "POST" })).status, 405);
    assert.equal((await fetch(base + "/../../.env")).status, 404);
  } finally { child.kill("SIGTERM"); }
});
