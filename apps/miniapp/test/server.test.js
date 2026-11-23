import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

async function startMiniApp(extraEnv = {}) {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: { ...process.env, PORT: "0", HOST: "127.0.0.1", RCR_API_BASE: "", RCR_TEST_SERVER_PORT: "1", ...extraEnv },
    stdio: ["ignore", "pipe", "ignore"]
  });
  let port = null;
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", chunk => {
    const prefix = "RCR Mini App listening on http://127.0.0.1:";
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
    assert.match(await config.text(), /tonConnectManifestUrl: ""/);
    assert.match(config.headers.get("content-security-policy"), /frame-ancestors https:\/\/web\.telegram\.org/);
    const appScript = await fetch(base + "/app.js");
    assert.equal(appScript.status, 200);
    assert.match(await appScript.text(), /restoreSession/);
    assert.match(await appScript.text(), /setConnectionNetwork\("-3"\)/);
    const page = await fetch(base + "/");
    assert.equal(page.status, 200);
    const pageText = await page.text();
    assert.ok(pageText.includes('<script src="/app.js" defer></script>'));
    assert.ok(pageText.includes("@tonconnect/ui@3.0.2"));
    assert.match(pageText, /24-hour earning sessions/);
    assert.equal((await fetch(base + "/tonconnect-manifest.json")).status, 503);
    const icon = await fetch(base + "/rcr-icon.png");
    assert.equal(icon.status, 200);
    assert.match(icon.headers.get("content-type"), /image\\/png/);
    const iconBytes = Buffer.from(await icon.arrayBuffer());
    assert.deepEqual([...iconBytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(iconBytes.readUInt32BE(16), 180);
    assert.equal(iconBytes.readUInt32BE(20), 180);
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

test("Mini App publishes a valid TON Connect manifest only for configured HTTPS origin", async () => {
  const { child, port } = await startMiniApp({ RCR_PUBLIC_URL: "https://rcr.example" });
  try {
    const base = "http://127.0.0.1:" + port;
    const manifestResponse = await fetch(base + "/tonconnect-manifest.json");
    assert.equal(manifestResponse.status, 200);
    assert.equal(manifestResponse.headers.get("access-control-allow-origin"), "*");
    assert.deepEqual(await manifestResponse.json(), {
      url: "https://rcr.example",
      name: "RCR TON Rewards",
      iconUrl: "https://rcr.example/rcr-icon.png",
    });
    const config = await (await fetch(base + "/config.js")).text();
    assert.ok(config.includes("https://rcr.example/tonconnect-manifest.json"));
  } finally { child.kill("SIGTERM"); }
});
