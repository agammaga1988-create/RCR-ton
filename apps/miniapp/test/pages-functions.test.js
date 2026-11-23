import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/[[path]].js";

test("Pages config injects only public runtime URLs", async () => {
  const response = await onRequest({
    request: new Request("https://rcr.example/config.js"),
    env: { RCR_PUBLIC_URL: "https://rcr.example", RCR_API_BASE: "https://api.rcr.example/" },
  });
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.ok(body.includes('apiBase: "https://api.rcr.example"'));
  assert.ok(body.includes('tonConnectManifestUrl: "https://rcr.example/tonconnect-manifest.json"'));
});

test("Pages manifest requires HTTPS and publishes CORS-enabled PNG icon URL", async () => {
  const response = await onRequest({
    request: new Request("https://rcr.example/tonconnect-manifest.json"),
    env: { RCR_PUBLIC_URL: "https://rcr.example/" },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.deepEqual(await response.json(), {
    url: "https://rcr.example",
    name: "RCR TON Rewards",
    iconUrl: "https://rcr.example/rcr-icon.png",
  });

  const invalid = await onRequest({
    request: new Request("http://rcr.example/tonconnect-manifest.json"),
    env: { RCR_PUBLIC_URL: "http://rcr.example" },
  });
  assert.equal(invalid.status, 503);
});

test("Pages icon is a 180 by 180 PNG", async () => {
  const response = await onRequest({
    request: new Request("https://rcr.example/rcr-icon.png"),
    env: {},
  });
  assert.equal(response.headers.get("content-type"), "image/png");
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(bytes.readUInt32BE(16), 180);
  assert.equal(bytes.readUInt32BE(20), 180);
});

test("Pages catch-all rejects paths it does not own", async () => {
  const response = await onRequest({
    request: new Request("https://rcr.example/unknown"),
    env: {},
  });
  assert.equal(response.status, 404);
});
