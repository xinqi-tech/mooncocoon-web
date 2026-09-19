import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

const require = createRequire(import.meta.url);
const site = require("../jp/site.js");

test("予約メールをtrimして小文字へ正規化する", () => {
  assert.equal(site.normalizeEmail("  USER@Example.COM "), "user@example.com");
});

test("明らかな不正メールを拒否する", () => {
  assert.equal(site.isValidEmail("user@example.com"), true);
  assert.equal(site.isValidEmail("user@localhost"), false);
  assert.equal(site.isValidEmail("a b@example.com"), false);
  assert.equal(site.isValidEmail(""), false);
});

test("API baseは末尾スラッシュを除去し未設定時は本番SCFを使う", () => {
  assert.equal(site.apiBase({ body: { dataset: { apiBase: "https://example.test/" } } }), "https://example.test");
  assert.equal(site.apiBase({ body: { dataset: {} } }), site.DEFAULT_API_BASE);
});

test("国内站不链接日本站，日本站保留加载页、原首页结构和商品入口", async () => {
  const domestic = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const home = await readFile(new URL("../jp/index.html", import.meta.url), "utf8");
  const product = await readFile(new URL("../jp/product/index.html", import.meta.url), "utf8");
  assert.doesNotMatch(domestic, /href="jp\//);
  assert.match(home, /class="loader"/);
  assert.match(home, /id="hero"/);
  assert.match(home, /id="modules"/);
  assert.match(home, /href="product\/"/);
  assert.match(home, /<html lang="ja">/);
  assert.match(product, /ホワイト/);
  assert.match(product, /パープル/);
  assert.match(product, /PRE-LAUNCH/);
  assert.match(product, /購入手続きではありません/);
  assert.doesNotMatch(product, /今すぐ購入/);
});

test("隐私页说明邮箱用途、去重和退订", async () => {
  const privacy = await readFile(new URL("../jp/privacy/index.html", import.meta.url), "utf8");
  assert.match(privacy, /メールアドレス/);
  assert.match(privacy, /複数回登録/);
  assert.match(privacy, /配信停止/);
});
