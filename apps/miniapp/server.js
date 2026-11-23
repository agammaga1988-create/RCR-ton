import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const apiBase = process.env.RCR_API_BASE || "";
let apiOrigin = "'self'";
if (apiBase) {
  const parsedApiBase = new URL(apiBase);
  if (parsedApiBase.protocol !== "https:") throw new Error("RCR_API_BASE must use HTTPS");
  apiOrigin = parsedApiBase.origin;
}

function send(res, status, type, body) {
  res.writeHead(status, {
    "content-type": type,
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "cache-control": "no-store",
    "content-security-policy": "default-src 'self'; script-src 'self' https://telegram.org; style-src 'self' 'unsafe-inline'; connect-src 'self' ${apiOrigin}; img-src 'self' data:; frame-ancestors https://web.telegram.org https://*.telegram.org",
  });
  res.end(body);
}

const server = createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "text/plain; charset=utf-8", "Method not allowed");
  const path = (req.url || "/").split("?")[0];
  if (path === "/health") return send(res, 200, "application/json; charset=utf-8", JSON.stringify({ ok: true }));
  if (path === "/config.js") {
    return send(res, 200, "text/javascript; charset=utf-8", `window.RCR_CONFIG = Object.freeze({ apiBase: ${JSON.stringify(apiBase)} });`);
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
server.listen(port, host);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
