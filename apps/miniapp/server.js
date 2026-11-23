import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const apiBase = (process.env.RCR_API_BASE || "").replace(/\/+$/, "");
const publicUrl = (process.env.RCR_PUBLIC_URL || "").replace(/\/+$/, "");
const manifestUrl = publicUrl.startsWith("https://") ? publicUrl + "/tonconnect-manifest.json" : "";
const RCR_ICON_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAALQAAAC0CAIAAACyr5FlAAAEjElEQVR42u3dPXYbRxBFYbAPQ4UOHXkJjpRpBw4dexdeg3fh2AtwrkyRVqGFKPPhgYnRAOifqurv5iSnqy9fVQ8wwMuHn365AO/RlADkADlADpAD5EBIXjdc869//PnYD379+6+tCvVS/j7HwyrQpaAcQ23YypU6ctzlxAO7OPr3k2OBE0P3ae1fJ8cju7JkSwJe0l5yHGxAqOpnuc4ictwqd/BaJ73sNHK8W990KZ1xFaHlqKFF3hUFleP/RSx2CyHFAsPJUV6LRIuNJcdVsTZ5LSPsqqPIsVVgZFl+CDn2DIz4dVgsBy0i16SpQjSu6rDwReZlyfF2zbSIWaIFcgiMLLVqzNBiQiSHVpKrdI0Z6SJkWn40ZvBjpRzMSOpHYwY/1gyk/109LTLWtjEje4SMy4/GDH5MlWPhywG6TGg5TKBl5tPGDH7MkIMZxfxoo68V8/0IJ4fjSb3DS+trBiodXlrf6xAblYaPNujKUGD4eFYOo0bh4aN1MQMlh4/WV1VUai7teSWZUbW5nH0/x7d/Pk5b1c+/f+n7C4Nc/PzLePIg6eOtNRdymEzvby7kEB7k4Mf94UEOkEN43B8e5AA5hMf94dHhm5pm3rN67BZT9yvszqwafr5cLr/9+0ly4CYnw4McIAcGyeF9G3t2FskBcmCEHHpKMc7f8JAcIAe6y6Gn7NxZJAfIgb5y6Ck7cLDLp5LDkymFxw5tBWYOkANzuPk45NWjsPEfh4z/TrCANTx+4FlyQFsBOUAOkAMB5XDjfDfe3fEfJIcb57U53l9tBTcZ+zhk6kcUZxKzhpID5AA5QA6QA+QAOUAOVOF16G93fyx1DSUHyAFygBwgByLL4S1htXnk8zm8AWw3PNSE+3hd9Ye739sJ9bWMSWsoOeC0AnJggRzPf9k1spxjbx1OJQe0FZADs+UwdhQeOA64+ZlgJ2cWVJ1GtRWYOTBCDnc7tu0pkgPaCgbJobPs2VMkB8iBcXLoLBv2FMmBrnIIjwKx0VkOr61U4uRuaivoIYexdJ9RVHKgqxzCY5/YkBzoKofw2CQ2nk0OfiQyY0ZyXNzzyMkDu9YWionIsfG4HMKjfGw8lRwm06pzaOejLD+KNZQOcmguVRtKn+TQXEo2lJ5thR/FGko3Od7qyY84Zjzf9Pskh+Gj0qjRv60YPsqMGkNmDs2lxqgxRA7DR41RY1Ry8KOMGUPaCj9qmDFq5nB4SXo8mSGHw0vS48kkOfiR3YzLDz9NMHhTNGcMLenwd5+bT/P+s814NIEfSWN40nMr/MjYoOc91MSPdKPb8IH0YJFG1OAVm/045NXaREjk/6XZyeGIm6hEy+TQYuJXZuVT9lpM8P+ZlckhQoLXIYQc78bGVorEXH4UOXaOkLCrjiXHbhESfLHh5NhEkRQLDCrHwfkltSW5VhRajkqKZFxFAjkOihu/vkkvO5kcx7WOVu4s11lKjjPVX7UBAS9pUzlObsnoXVn718nRbZ+e3LPRv58c4SzpS7GbMQXlmOlK7Rv89eXoqMtuLxfvKAdO4is1QA6QA+QAObCU7wRIcIakd55qAAAAAElFTkSuQmCC";

function send(res, status, type, body, extraHeaders = {}) {
  res.writeHead(status, {
    "content-type": type,
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "cache-control": "no-store",
    "content-security-policy": "default-src 'self'; script-src 'self' https://telegram.org https://unpkg.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https:; img-src 'self' data: https:; frame-src https:; frame-ancestors https://web.telegram.org https://*.telegram.org",
    ...extraHeaders,
  });
  res.end(body);
}

const server = createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "text/plain; charset=utf-8", "Method not allowed");
  const path = (req.url || "/").split("?")[0];
  if (path === "/health") return send(res, 200, "application/json; charset=utf-8", JSON.stringify({ ok: true }));
  if (path === "/app.js") {
    try {
      const body = await readFile(join(root, "app.js"));
      return send(res, 200, "text/javascript; charset=utf-8", req.method === "HEAD" ? "" : body);
    } catch {
      return send(res, 500, "text/plain; charset=utf-8", "Mini App script unavailable");
    }
  }
  if (path === "/config.js") {
    return send(res, 200, "text/javascript; charset=utf-8", `window.RCR_CONFIG = Object.freeze({ apiBase: ${JSON.stringify(apiBase)}, tonConnectManifestUrl: ${JSON.stringify(manifestUrl)} });`);
  }
  if (path === "/tonconnect-manifest.json") {
    if (!manifestUrl) return send(res, 503, "application/json; charset=utf-8", JSON.stringify({ error: "https_manifest_not_configured" }));
    const manifest = { url: publicUrl, name: "RCR TON Rewards", iconUrl: publicUrl + "/rcr-icon.png" };
    return send(res, 200, "application/json; charset=utf-8", JSON.stringify(manifest), {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, HEAD",
      "cache-control": "public, max-age=300",
    });
  }
  if (path === "/rcr-icon.png") {
    const iconBytes = Buffer.from(RCR_ICON_BASE64, "base64");
    return send(res, 200, "image/png", req.method === "HEAD" ? "" : iconBytes, { "access-control-allow-origin": "*", "cache-control": "public, max-age=86400" });
  }
  if (path !== "/" && path !== "/index.html") return send(res, 404, "text/plain; charset=utf-8", "Not found");
  try {
    const body = await readFile(join(root, "index.html"));
    return send(res, 200, "text/html; charset=utf-8", req.method === "HEAD" ? "" : body);
  } catch {
    return send(res, 500, "text/plain; charset=utf-8", "Mini App unavailable");
  }
});
server.headersTimeout = 10_000;
server.requestTimeout = 15_000;
server.listen(port, host, () => {
  const boundAddress = server.address();
  const boundPort = boundAddress && typeof boundAddress === "object" ? boundAddress.port : port;
  if (process.env.RCR_TEST_SERVER_PORT === "1") process.stdout.write(`RCR Mini App listening on http://${host}:${boundPort}\n`);
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
