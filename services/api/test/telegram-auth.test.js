import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyTelegramInitData } from "../src/telegram-auth.js";

const token = "123456:TEST_ONLY_SYNTHETIC_TOKEN";
const now = 1_800_000_000;

function signedInitData(fields) {
  const params = new URLSearchParams(fields);
  const checkString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  params.set("hash", createHmac("sha256", secret).update(checkString).digest("hex"));
  return params.toString();
}

test("accepts valid Telegram initData and returns verified identity", () => {
  const initData = signedInitData({
    auth_date: String(now),
    query_id: "AAE-test",
    user: JSON.stringify({ id: 987654321, first_name: "RCR", username: "rcr_test" }),
  });
  const result = verifyTelegramInitData(initData, token, { nowSeconds: now });
  assert.equal(result.telegramUserId, "987654321");
  assert.equal(result.user.username, "rcr_test");
});

test("rejects modified signed user data", () => {
  const params = new URLSearchParams(signedInitData({ auth_date: String(now), user: JSON.stringify({ id: 7 }) }));
  params.set("user", JSON.stringify({ id: 8 }));
  assert.throws(() => verifyTelegramInitData(params.toString(), token, { nowSeconds: now }), /signature/);
});

test("rejects expired data", () => {
  const initData = signedInitData({ auth_date: String(now - 901), user: JSON.stringify({ id: 7 }) });
  assert.throws(() => verifyTelegramInitData(initData, token, { nowSeconds: now }), /expired/);
});

test("rejects duplicate fields", () => {
  const initData = signedInitData({ auth_date: String(now), user: JSON.stringify({ id: 7 }) });
  assert.throws(() => verifyTelegramInitData(`${initData}&auth_date=${now}`, token, { nowSeconds: now }), /duplicate/);
});

test("rejects a future auth_date beyond allowed clock skew", () => {
  const initData = signedInitData({ auth_date: String(now + 31), user: JSON.stringify({ id: 7 }) });
  assert.throws(() => verifyTelegramInitData(initData, token, { nowSeconds: now }), /future/);
});

test("rejects missing token and malformed signatures", () => {
  const initData = signedInitData({ auth_date: String(now), user: JSON.stringify({ id: 7 }) });
  assert.throws(() => verifyTelegramInitData(initData, "", { nowSeconds: now }), /not_configured/);
  const malformed = new URLSearchParams(initData);
  malformed.set("hash", "bad");
  assert.throws(() => verifyTelegramInitData(malformed.toString(), token, { nowSeconds: now }), /signature/);
});

test("rejects non-object and unsafe Telegram identities", () => {
  for (const user of ["null", "[]", JSON.stringify({ id: 0 }), JSON.stringify({ id: Number.MAX_SAFE_INTEGER + 1 })]) {
    const initData = signedInitData({ auth_date: String(now), user });
    assert.throws(() => verifyTelegramInitData(initData, token, { nowSeconds: now }), /invalid_telegram_user/);
  }
});
