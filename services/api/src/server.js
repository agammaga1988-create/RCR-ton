import { createServer } from "node:http";
import { startSession, TOKEN } from "@rcr/shared";

const sessions = new Map();
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    return send(res, 200, { ok: true, service: "rcr-api", mode: "development-scaffold" });
  }
  if (req.method === "GET" && req.url === "/config") {
    return send(res, 200, {
      token: TOKEN.symbol,
      sessionDurationSeconds: TOKEN.sessionDurationSeconds,
      network: "testnet-not-configured",
      claimsEnabled: false
    });
  }
  if (req.method === "POST" && req.url === "/sessions") {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 4096) req.destroy();
    });
    req.on("end", () => {
      try {
        const body = JSON.parse(raw || "{}");
        // Development-only identity stub. Production must validate Telegram initData server-side.
        if (process.env.NODE_ENV === "production") {
          return send(res, 503, { error: "Telegram authentication is not configured; session creation is disabled." });
        }
        const userId = typeof body.userId === "string" ? body.userId : "";
        const current = sessions.get(userId);
        const session = startSession({ userId, nowSeconds: Math.floor(Date.now() / 1000), existingSession: current });
        sessions.set(userId, session);
        return send(res, 201, { session });
      } catch (error) {
        return send(res, 400, { error: error.message });
      }
    });
    return;
  }
  return send(res, 404, { error: "not_found" });
});

server.listen(port, host, () => {
  if (process.env.NODE_ENV !== "test") process.stdout.write(`RCR API listening on http://${host}:${port}\n`);
});
