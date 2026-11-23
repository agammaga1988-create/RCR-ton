import { createServer } from "node:http";
import { startSession, TOKEN } from "@rcr/shared";
import { verifyTelegramInitData } from "./telegram-auth.js";
import { createEarningSession, getCurrentEarningSession, closePool } from "./database.js";

const sessions = new Map();
const requestWindows = new Map();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
const MAX_BODY_BYTES = 16_384;
const MAX_RATE_LIMIT_KEYS = 10_000;
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";

function send(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  });
  res.end(JSON.stringify(body));
}

function allowSessionRequest(req, now = Date.now()) {
  const key = req.socket.remoteAddress || "unknown";
  let window = requestWindows.get(key);
  if (!window) {
    if (requestWindows.size >= MAX_RATE_LIMIT_KEYS) {
      for (const [address, timestamps] of requestWindows) {
        if (!timestamps.length || timestamps[timestamps.length - 1] <= now - RATE_WINDOW_MS) {
          requestWindows.delete(address);
        }
      }
    }
    if (requestWindows.size >= MAX_RATE_LIMIT_KEYS) return false;
    window = [];
    requestWindows.set(key, window);
  }
  while (window.length && window[0] <= now - RATE_WINDOW_MS) window.shift();
  if (window.length >= RATE_LIMIT) return false;
  window.push(now);
  return true;
}

async function readJsonBody(req) {
  const contentType = req.headers["content-type"] || "";
  if (!/^application\/json(?:\s*;|\s*$)/i.test(contentType)) {
    const error = new Error("unsupported_content_type");
    error.statusCode = 415;
    throw error;
  }
  const declaredLength = Number(req.headers["content-length"] || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    req.resume();
    const error = new Error("request_too_large");
    error.statusCode = 413;
    throw error;
  }
  let raw = "";
  let tooLarge = false;
  for await (const chunk of req) {
    if (tooLarge) continue;
    raw += chunk;
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      raw = "";
      tooLarge = true;
    }
  }
  if (tooLarge) {
    const error = new Error("request_too_large");
    error.statusCode = 413;
    throw error;
  }
  const body = JSON.parse(raw || "{}");
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const error = new Error("invalid_request_body");
    error.statusCode = 400;
    throw error;
  }
  return body;
}

async function handleSession(req, res) {
  if (!allowSessionRequest(req)) return send(res, 429, { error: "rate_limit_exceeded" });
  try {
    const body = await readJsonBody(req);
    let userId;
    if (process.env.TELEGRAM_BOT_TOKEN) {
      const identity = verifyTelegramInitData(body.initData, process.env.TELEGRAM_BOT_TOKEN);
      userId = identity.telegramUserId;
    } else {
      if (process.env.NODE_ENV === "production") {
        return send(res, 503, { error: "telegram_auth_not_configured" });
      }
      userId = typeof body.userId === "string" ? body.userId.trim() : "";
      if (!userId || userId.length > 128) {
        return send(res, 400, { error: "invalid_user_identity" });
      }
    }
    if (process.env.DATABASE_URL) {
      const session = await createEarningSession(userId);
      return send(res, 201, { session, persistence: "postgresql" });
    }
    if (process.env.NODE_ENV === "production") {
      return send(res, 503, { error: "database_not_configured" });
    }
    const current = sessions.get(userId);
    const session = startSession({ userId, nowSeconds: Math.floor(Date.now() / 1000), existingSession: current });
    sessions.set(userId, session);
    return send(res, 201, { session, persistence: "memory-development-only" });
  } catch (error) {
    const authErrors = new Set([
      "invalid_init_data", "invalid_init_data_signature", "missing_init_data_hash",
      "duplicate_init_data_field", "invalid_auth_date", "auth_date_in_future",
      "init_data_expired", "invalid_telegram_user", "telegram_bot_token_not_configured",
      "invalid_verification_clock",
    ]);
    if (authErrors.has(error.message)) return send(res, 401, { error: error.message });
    if (error.code === "active_session_exists") return send(res, 409, { error: "active_session_exists" });
    if (error.statusCode) return send(res, error.statusCode, { error: error.message });
    if (error instanceof SyntaxError) return send(res, 400, { error: "invalid_json" });
    process.stderr.write("RCR API session request failed\n");
    return send(res, 500, { error: "internal_server_error" });
  }
}


async function handleCurrentSession(req, res) {
  if (!allowSessionRequest(req)) return send(res, 429, { error: "rate_limit_exceeded" });
  try {
    const body = await readJsonBody(req);
    let userId;
    if (process.env.TELEGRAM_BOT_TOKEN) {
      const identity = verifyTelegramInitData(body.initData, process.env.TELEGRAM_BOT_TOKEN);
      userId = identity.telegramUserId;
    } else {
      if (process.env.NODE_ENV === "production") return send(res, 503, { error: "telegram_auth_not_configured" });
      userId = typeof body.userId === "string" ? body.userId.trim() : "";
      if (!userId || userId.length > 128) return send(res, 400, { error: "invalid_user_identity" });
    }
    const session = process.env.DATABASE_URL
      ? await getCurrentEarningSession(userId)
      : sessions.get(userId) || null;
    if (!session || session.endsAt <= Math.floor(Date.now() / 1000)) {
      return send(res, 404, { error: "active_session_not_found" });
    }
    return send(res, 200, { session });
  } catch (error) {
    const authErrors = new Set([
      "invalid_init_data", "invalid_init_data_signature", "missing_init_data_hash",
      "duplicate_init_data_field", "invalid_auth_date", "auth_date_in_future",
      "init_data_expired", "invalid_telegram_user", "telegram_bot_token_not_configured",
      "invalid_verification_clock",
    ]);
    if (authErrors.has(error.message)) return send(res, 401, { error: error.message });
    if (error.statusCode) return send(res, error.statusCode, { error: error.message });
    if (error instanceof SyntaxError) return send(res, 400, { error: "invalid_json" });
    process.stderr.write("RCR API current-session request failed\n");
    return send(res, 500, { error: "internal_server_error" });
  }
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    return send(res, 200, { ok: true, service: "rcr-api" });
  }
  if (req.method === "GET" && req.url === "/config") {
    return send(res, 200, {
      token: TOKEN.symbol,
      sessionDurationSeconds: TOKEN.sessionDurationSeconds,
      network: "testnet-not-configured",
      claimsEnabled: false,
      persistence: process.env.DATABASE_URL ? "postgresql" : "memory-development-only"
    });
  }
  if (req.method === "POST" && req.url === "/sessions") return handleSession(req, res);
  if (req.method === "POST" && req.url === "/sessions/current") return handleCurrentSession(req, res);
  return send(res, 404, { error: "not_found" });
});

server.headersTimeout = 10_000;
server.requestTimeout = 15_000;
server.keepAliveTimeout = 5_000;
server.listen(port, host, () => {
  if (process.env.NODE_ENV !== "test") process.stdout.write(`RCR API listening on http://${host}:${port}\n`);
});

async function shutdown() {
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
