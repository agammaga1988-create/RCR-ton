import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

test("API exposes health and safe configuration", async () => {
  const port = 3100 + Math.floor(Math.random() * 500);
  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", NODE_ENV: "test" },
    stdio: "ignore"
  });
  try {
    let response;
    for (let i = 0; i < 30; i++) {
      try { response = await fetch(`http://127.0.0.1:${port}/health`); break; }
      catch { await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    assert.ok(response, "server should start");
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ok, true);
    const config = await fetch(`http://127.0.0.1:${port}/config`).then(r => r.json());
    assert.equal(config.claimsEnabled, false);
  } finally {
    child.kill("SIGTERM");
  }
});
