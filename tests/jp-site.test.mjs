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

test("予約送信はfileプロトコルでもpreflight不要なフォーム形式を使う", async () => {
  let captured;
  const form = {
    elements: {
      email: { value: "USER@example.com" },
      consent: { checked: true },
      variantInterest: { value: "WHITE" },
      website: { value: "" }
    },
    querySelector(selector) {
      if (selector === "button[type='submit']") return { disabled: false };
      if (selector === "[data-form-message]") return { textContent: "", dataset: {} };
      return null;
    }
  };
  const ok = await site.submitWaitlist(form, async (_url, options) => {
    captured = options;
    return { ok: true, json: async () => ({ result: 0 }) };
  }, { body: { dataset: { apiBase: "https://example.test" } } });
  assert.equal(ok, true);
  assert.equal(captured.headers["Content-Type"], undefined);
  assert.equal(captured.body instanceof URLSearchParams, true);
  assert.equal(captured.body.get("email"), "user@example.com");
});

test("登録済みメールには重複不要の案内を表示する", async () => {
  const message = { textContent: "", dataset: {} };
  const form = {
    elements: {
      email: { value: "user@example.com" },
      consent: { checked: true },
      variantInterest: { value: "WHITE" },
      website: { value: "" }
    },
    querySelector(selector) {
      if (selector === "button[type='submit']") return { disabled: false };
      if (selector === "[data-form-message]") return message;
      return null;
    }
  };

  const ok = await site.submitWaitlist(form, async () => ({
    ok: true,
    json: async () => ({ result: 0, data: { accepted: true, alreadyRegistered: true } })
  }), { body: { dataset: { apiBase: "https://example.test" } } });

  assert.equal(ok, true);
  assert.equal(message.textContent, "このメールアドレスは登録済みです。再度ご登録いただく必要はありません。");
  assert.equal(message.dataset.kind, "info");
});

test("商品ページのBGMボタンは再生と停止の状態を切り替える", async () => {
  let clickHandler;
  let paused = true;
  const classes = new Set();
  const attributes = {};
  const button = {
    classList: {
      add(value) { classes.add(value); },
      remove(value) { classes.delete(value); }
    },
    setAttribute(name, value) { attributes[name] = value; },
    addEventListener(_name, handler) { clickHandler = handler; }
  };
  const audio = {
    volume: 1,
    get paused() { return paused; },
    play() { paused = false; return Promise.resolve(); },
    pause() { paused = true; }
  };
  site.initBgm({
    querySelector(selector) {
      if (selector === "[data-bgm-toggle]") return button;
      if (selector === "[data-bgm-audio]") return audio;
      return null;
    }
  });

  clickHandler();
  await Promise.resolve();
  assert.equal(audio.volume, 0.55);
  assert.equal(classes.has("playing"), true);
  assert.equal(attributes["aria-pressed"], "true");

  clickHandler();
  assert.equal(paused, true);
  assert.equal(classes.has("playing"), false);
  assert.equal(attributes["aria-pressed"], "false");
});

test("商品ページはスクロール時にホームと同じ上部マスクを表示する", () => {
  let scrollHandler;
  const classes = new Set();
  const header = {
    classList: {
      toggle(value, enabled) {
        if (enabled) classes.add(value);
        else classes.delete(value);
      }
    }
  };
  const viewport = {
    scrollY: 0,
    addEventListener(_name, handler) { scrollHandler = handler; }
  };
  site.initScrollMask({ querySelector: () => header }, viewport);
  assert.equal(classes.has("scrolled"), false);

  viewport.scrollY = 120;
  scrollHandler();
  assert.equal(classes.has("scrolled"), true);
});

test("国内站不链接日本站，日本站保留加载页、原首页结构和商品入口", async () => {
  const domestic = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const home = await readFile(new URL("../jp/index.html", import.meta.url), "utf8");
  const product = await readFile(new URL("../jp/product/index.html", import.meta.url), "utf8");
  const styles = await readFile(new URL("../jp/styles.css", import.meta.url), "utf8");
  const siteJs = await readFile(new URL("../jp/site.js", import.meta.url), "utf8");
  assert.doesNotMatch(domestic, /href="jp\//);
  assert.match(home, /class="loader"/);
  assert.match(home, /sessionStorage\.getItem\('lunakoru\.jp\.loader\.seen'\)/);
  assert.match(home, /sessionStorage\.setItem\('lunakoru\.jp\.loader\.seen','1'\)/);
  assert.match(home, /window\.__LUNAKORU_SKIP_LOADER/);
  assert.match(home, /id="hero"/);
  assert.match(home, /id="modules"/);
  assert.match(home, /href="product\/index\.html"/);
  assert.match(home, /href="https:\/\/www\.instagram\.com\/"[\s\S]*?src="assets\/instagram\.png"/);
  assert.match(home, /href="https:\/\/x\.com\/"[\s\S]*?src="assets\/x\.png"/);
  assert.equal((home.match(/src="\.\.\/images\/icon_douyin\.png"/g) || []).length, 1);
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
  assert.doesNotMatch(product, /class="policy-alert"/);
  assert.match(product, /<div class="product-media"><span class="status-badge">/);
  assert.match(styles, /\.product-page \.nav-links a\s*\{[\s\S]*?justify-content:\s*center/);
  assert.doesNotMatch(styles, /a\[aria-current="page"\] > span\s*\{\s*transform:/);
  assert.match(styles, /\.product-page \.section,[\s\S]*?\.product-page \.footer-inner\s*\{\s*width:\s*min\(1440px, 100%\)/);
  assert.match(styles, /\.product-page \.nav\s*\{[\s\S]*?max-width:\s*1440px;[\s\S]*?padding:\s*0 var\(--page-x\)/);
  assert.match(styles, /\.product-page\s*\{\s*--page-x:\s*18px;\s*line-height:\s*1\.72/);
  assert.match(styles, /\.product-page \.site-header\.scrolled::after\s*\{\s*opacity:\s*1/);
  assert.match(product, /class="product-title"/);
  assert.match(product, /class="title-initial">想<\/span>/);
  assert.match(styles, /@keyframes product-halo/);
  assert.match(styles, /\.product-page\.motion-ready \[data-reveal\]\.is-visible/);
  assert.match(styles, /\.product-page main > \.section \+ \.section\s*\{[\s\S]*?border-top:\s*1px solid/);
  assert.match(styles, /\.product-page \.section-heading > \.eyebrow,[\s\S]*?margin-bottom:\s*32px/);
  assert.match(siteJs, /function initProductMotion/);
  assert.match(product, /data-bgm-toggle/);
  assert.match(product, /data-bgm-audio/);
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
    "tab-selected-frame.png", "instagram.png", "x.png"
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
