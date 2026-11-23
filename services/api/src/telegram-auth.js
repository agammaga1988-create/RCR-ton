import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60;
const FUTURE_CLOCK_SKEW_SECONDS = 30;

function safeHexEqual(left, right) {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) return false;
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Verify Telegram Mini App initData on the server.
 * Never accept a user id supplied separately by the browser.
 */
export function verifyTelegramInitData(initData, botToken, {
  nowSeconds = Math.floor(Date.now() / 1000),
  maxAgeSeconds = MAX_AUTH_AGE_SECONDS,
} = {}) {
  if (typeof initData !== "string" || initData.length === 0 || initData.length > 16_384) {
    throw new Error("invalid_init_data");
  }
  if (typeof botToken !== "string" || botToken.length < 10) {
    throw new Error("telegram_bot_token_not_configured");
  }
  if (!Number.isSafeInteger(nowSeconds) || !Number.isSafeInteger(maxAgeSeconds) || maxAgeSeconds < 1) {
    throw new Error("invalid_verification_clock");
  }

  const params = new URLSearchParams(initData);
  const entries = [...params.entries()];
  const values = new Map();
  for (const [key, value] of entries) {
    if (values.has(key)) throw new Error("duplicate_init_data_field");
    values.set(key, value);
  }

  const receivedHash = values.get("hash") || "";
  if (!receivedHash) throw new Error("missing_init_data_hash");

  const checkString = entries
    .filter(([key]) => key !== "hash")
    .map(([key, value]) => [key, value])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = createHmac("sha256", secretKey).update(checkString).digest("hex");
  if (!safeHexEqual(receivedHash, expectedHash)) throw new Error("invalid_init_data_signature");

  const authDate = Number(values.get("auth_date"));
  if (!Number.isSafeInteger(authDate) || authDate <= 0) throw new Error("invalid_auth_date");
  if (authDate > nowSeconds + FUTURE_CLOCK_SKEW_SECONDS) throw new Error("auth_date_in_future");
  if (nowSeconds - authDate > maxAgeSeconds) throw new Error("init_data_expired");

  let user;
  try {
    user = JSON.parse(values.get("user") || "null");
  } catch {
    throw new Error("invalid_telegram_user");
  }
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0) {
    throw new Error("invalid_telegram_user");
  }

  return Object.freeze({
    telegramUserId: String(user.id),
    authDate,
    user: Object.freeze({
      id: user.id,
      firstName: typeof user.first_name === "string" ? user.first_name : "",
      username: typeof user.username === "string" ? user.username : null,
    }),
  });
}
