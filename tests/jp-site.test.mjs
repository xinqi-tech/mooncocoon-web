import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, stat } from "node:fs/promises";
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
  const styles = await readFile(new URL("../jp/styles.css", import.meta.url), "utf8");
  assert.doesNotMatch(domestic, /href="jp\//);
  assert.match(home, /class="loader"/);
  assert.match(home, /sessionStorage\.getItem\('lunakoru\.jp\.loader\.seen'\)/);
  assert.match(home, /sessionStorage\.setItem\('lunakoru\.jp\.loader\.seen','1'\)/);
  assert.match(home, /window\.__LUNAKORU_SKIP_LOADER/);
  assert.match(home, /id="hero"/);
  assert.match(home, /id="modules"/);
  assert.match(home, /href="product\/index\.html"/);
  assert.match(home, /<html lang="ja">/);
  const homeNav = home.match(/<div class="nav-links">([\s\S]*?)<\/div>/)?.[1] || "";
  const productNav = product.match(/<div class="nav-links"[^>]*>([\s\S]*?)<\/div>/)?.[1] || "";
  assert.equal((homeNav.match(/<a\b/g) || []).length, 2);
  assert.equal((productNav.match(/<a\b/g) || []).length, 2);
  assert.equal((homeNav.match(/<span>/g) || []).length, 2);
  assert.equal((productNav.match(/<span>/g) || []).length, 2);
  assert.match(productNav, /href="\.\.\/index\.html"/);
  assert.match(product, /<body class="product-page">/);
  assert.doesNotMatch(product, /data-menu-button/);
  assert.match(home, /querySelectorAll\('\.nav-links a\[href\^="#"\]'\)/);
  assert.match(product, /ホワイト/);
  assert.match(product, /パープル/);
  assert.match(product, /product-angle-01\.png/);
  assert.match(product, /側面図 1/);
  assert.match(product, /側面図 2/);
  assert.match(product, /正面図/);
  assert.match(product, /側面図 3/);
  assert.match(styles, /grid-template-columns:\s*repeat\(6,/);
  assert.match(styles, /\.angle-card:nth-child\(-n \+ 2\)\s*\{\s*grid-column:\s*span 3/);
  assert.match(styles, /\.angle-card:nth-child\(n \+ 3\)\s*\{\s*grid-column:\s*span 2/);
  assert.match(styles, /\.product-page \.nav-links a\[aria-current="page"\]::before/);
  assert.match(styles, /background:\s*transparent url\("assets\/tab-selected-frame\.png"\) center \/ contain no-repeat/);
  assert.match(product, /<section class="section" id="specs">/);
  assert.match(product, /安全な使用について/);
  assert.match(product, /保証について（1年保証）/);
  assert.match(product, /水深30cm以上/);
  assert.match(product, /manual-white\.png/);
  assert.match(product, /manual-purple\.png/);
  assert.equal((product.match(/class="manual-card"/g) || []).length, 2);
  assert.equal((product.match(/data-waitlist-form/g) || []).length, 1);
  assert.ok(product.indexOf('id="waitlist"') < product.indexOf("THREE WAYS TO CONNECT"));
  assert.match(product, /PRE-LAUNCH/);
  assert.match(product, /購入手続きではありません/);
  assert.doesNotMatch(product, /今すぐ購入/);
});

test("补充的品牌、商品角度和说明书素材均已接入", async () => {
  const assets = [
    "brand-logo.png", "product-white.png", "product-purple.png",
    "product-angle-01.png", "product-angle-02.png", "product-angle-03.png",
    "product-angle-04.png", "product-angle-05.png", "manual-white.png", "manual-purple.png",
    "tab-selected-frame.png"
  ];
  const files = await Promise.all(assets.map((name) => stat(new URL(`../jp/assets/${name}`, import.meta.url))));
  assert.equal(files.every((file) => file.isFile() && file.size > 0), true);
});

test("隐私页说明邮箱用途、去重和退订", async () => {
  const privacy = await readFile(new URL("../jp/privacy/index.html", import.meta.url), "utf8");
  assert.match(privacy, /メールアドレス/);
  assert.match(privacy, /複数回登録/);
  assert.match(privacy, /配信停止/);
});
