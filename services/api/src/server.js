import { createServer } from "node:http";
import { startSession, TOKEN } from "@rcr/shared";
import { verifyTelegramInitData } from "./telegram-auth.js";

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
      if (Buffer.byteLength(raw, "utf8") > 16_384) {
        send(res, 413, { error: "request_too_large" });
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        const body = JSON.parse(raw || "{}");
        let userId;
        if (process.env.TELEGRAM_BOT_TOKEN) {
          const identity = verifyTelegramInitData(body.initData, process.env.TELEGRAM_BOT_TOKEN);
          userId = identity.telegramUserId;
        } else {
          if (process.env.NODE_ENV === "production") {
            return send(res, 503, { error: "telegram_auth_not_configured" });
          }
          // Explicit local-development fallback only; never enabled in production.
          userId = typeof body.userId === "string" ? body.userId : "";
        }
        const current = sessions.get(userId);
        const session = startSession({ userId, nowSeconds: Math.floor(Date.now() / 1000), existingSession: current });
        sessions.set(userId, session);
        return send(res, 201, { session });
      } catch (error) {
        const authErrors = new Set([
          "invalid_init_data", "invalid_init_data_signature", "missing_init_data_hash",
          "duplicate_init_data_field", "invalid_auth_date", "auth_date_in_future",
          "init_data_expired", "invalid_telegram_user", "telegram_bot_token_not_configured"
        ]);
        const status = authErrors.has(error.message) ? 401 : 400;
        return send(res, status, { error: error.message || "invalid_request" });
      }
    });
    return;
  }
  return send(res, 404, { error: "not_found" });
});

server.listen(port, host, () => {
  if (process.env.NODE_ENV !== "test") process.stdout.write(`RCR API listening on http://${host}:${port}\n`);
});
