import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../tolk/", import.meta.url);
const minter = await readFile(new URL("src/JettonMinter.tolk", root), "utf8");
const storage = await readFile(new URL("src/storage.tolk", root), "utf8");
const messages = await readFile(new URL("src/messages.tolk", root), "utf8");
const tests = await readFile(new URL("tests/admin-and-governance.test.tolk", root), "utf8");

test("RCR minter stores a configured maximum supply and exposes a getter", () => {
  assert.match(storage, /struct MinterStorage\s*\{[\s\S]*?maxSupply:\s*coins/);
  assert.match(minter, /get fun get_max_supply\(\): coins/);
});

test("mint rejects amounts above the lifetime cap before increasing cumulative minted supply", () => {
  const guard = minter.indexOf("storage.totalMinted + internalTransferMsg.jettonAmount <= storage.maxSupply");
  const increase = minter.indexOf("storage.totalMinted += internalTransferMsg.jettonAmount");
  assert.ok(guard >= 0 && increase > guard);
});

test("privileged code upgrades are absent so an admin cannot raise the stored cap", () => {
  assert.doesNotMatch(minter, /UpgradeMinterCode|setCodePostponed|contract\.setData/);
  assert.doesNotMatch(messages, /UpgradeMinterCode/);
});

test("transaction-level regression test covers an over-cap mint", () => {
  assert.match(tests, /mint cannot exceed the fixed max supply/);
  assert.match(tests, /ERROR_MAX_SUPPLY/);
});

test("burns do not reduce cumulative minted supply", () => {
  const burn = minter.indexOf("BurnNotificationForMinter =>");
  const next = minter.indexOf("RequestWalletAddress =>", burn);
  const burnBranch = minter.slice(burn, next);
  assert.match(burnBranch, /storage\.totalSupply -= msg\.jettonAmount/);
  assert.doesNotMatch(burnBranch, /totalMinted/);
  assert.match(tests, /burning does not replenish lifetime mint cap/);
});

test("public and mining issuers have separate immutable lifetime caps", () => {
  assert.match(minter, /rcrPublicIssuanceCapBaseUnits\(\)/);
  assert.match(minter, /rcrMiningIssuerCapBaseUnits\(\)/);
  assert.match(minter, /SetMiningIssuer/);
  assert.match(tests, /public issuer cannot exceed 600 million RCR/);
  assert.match(tests, /configured mining issuer is capped at 400 million RCR/);
});

test("mint settlement callbacks are correlated and wallet-authenticated", () => {
  assert.match(minter, /internalTransferMsg\.queryId == msg\.queryId/);
  assert.match(minter, /pendingMints\.get\(msg\.queryId\)/);
  assert.match(minter, /calcAddressOfJettonWallet\(\s*pending\.recipient/);
  assert.match(minter, /MintSuccessNotification/);
  assert.match(minter, /MintFailureNotification/);
});
