import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const minter = await readFile(new URL("../src/jetton-minter.tact", import.meta.url), "utf8");
const wallet = await readFile(new URL("../src/jetton-wallet.tact", import.meta.url), "utf8");

test("RCR master has immutable constructor cap and a separate cap getter", () => {
  assert.match(minter, /maxSupply:\s*Int as coins/);
  assert.match(minter, /get fun get_max_supply\(\): Int/);
  assert.doesNotMatch(minter, /maxSupply:\s*self\.maxSupply,\s*adminAddress:/);
});

test("mint authorization, mint switch, positive amount and cap precede supply increase", () => {
  const auth = minter.indexOf('require(sender() == self.owner, "Incorrect sender")', minter.indexOf("receive(msg: Mint)"));
  const open = minter.indexOf('require(self.mintable, "Mint is closed")', auth);
  const positive = minter.indexOf('require(msg.mintMessage.amount > 0, "Mint amount must be positive")', open);
  const cap = minter.indexOf('require(self.totalSupply + msg.mintMessage.amount <= self.maxSupply, "Maximum supply exceeded")', positive);
  const increase = minter.indexOf("self.totalSupply += msg.mintMessage.amount", cap);
  assert.ok(auth >= 0 && open > auth && positive > open && cap > positive && increase > cap);
});

test("mint bounce rolls total supply back", () => {
  assert.match(minter, /bounced\(msg: bounced<JettonTransferInternal>\)\s*\{\s*self\.totalSupply -= msg\.amount;/);
});

test("wallet transfer requires owner authorization and rejects negative resulting balance", () => {
  assert.match(wallet, /receive\(msg: JettonTransfer\)\s*\{[\s\S]*?require\(sender\(\) == self\.owner, "Incorrect sender"\)/);
  assert.match(wallet, /self\.balance -= msg\.amount;\s*require\(self\.balance >= 0, "Incorrect balance after send"\)/);
});

test("master getter keeps TEP-74 response fields separate from custom cap getter", () => {
  const getter = minter.match(/get fun get_jetton_data\(\): JettonMinterState\s*\{([\s\S]*?)\n    \}/)?.[1] ?? "";
  for (const field of ["totalSupply:", "mintable:", "adminAddress:", "jettonContent:", "jettonWalletCode:"]) assert.ok(getter.includes(field));
  assert.ok(!getter.includes("maxSupply:"));
});
