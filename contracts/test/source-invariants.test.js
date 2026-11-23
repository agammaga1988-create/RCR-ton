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

test("mint rejects amounts above the cap before increasing total supply", () => {
  const guard = minter.indexOf("storage.totalSupply + internalTransferMsg.jettonAmount <= storage.maxSupply");
  const increase = minter.indexOf("storage.totalSupply += internalTransferMsg.jettonAmount");
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
