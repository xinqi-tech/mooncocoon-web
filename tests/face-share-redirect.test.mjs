import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

const require = createRequire(import.meta.url);
const { buildRedirectTarget, resolveRedirectTarget } = require("../f/redirect.js");

const TARGET_PREFIX = "lunakoru://customization/";

test("合法分享码唤起固定 App 深链", () => {
  assert.equal(buildRedirectTarget("ABCDEFG2"), `${TARGET_PREFIX}ABCDEFG2`);
  assert.equal(resolveRedirectTarget("?c=ABCDEFG2"), `${TARGET_PREFIX}ABCDEFG2`);
  assert.equal(buildRedirectTarget("abc123"), `${TARGET_PREFIX}abc123`);
});

test("其他 query 不影响唯一且合法的分享码", () => {
  assert.equal(
    resolveRedirectTarget("?source=scanner&c=Z9Y8X7W6"),
    `${TARGET_PREFIX}Z9Y8X7W6`,
  );
});

test("缺少或重复 c 参数时不跳转", () => {
  assert.equal(resolveRedirectTarget(""), null);
  assert.equal(resolveRedirectTarget("?source=scanner"), null);
  assert.equal(resolveRedirectTarget("?c=ABCDEFG2&c=Z9Y8X7W6"), null);
});

test("非法字符、错误字符集和超长输入不跳转", () => {
  assert.equal(buildRedirectTarget("ABC-DEF2"), null);
  assert.equal(buildRedirectTarget("ABCDE"), null);
  assert.equal(buildRedirectTarget("ABCDEFGHIJKLMNO"), null);
});

test("URL 注入输入无法改变固定跳转目标", () => {
  assert.equal(resolveRedirectTarget("?c=https%3A%2F%2Fevil.example"), null);
  assert.equal(resolveRedirectTarget("?c=ABCDEF2%26next%3Dhttps%3A%2F%2Fevil.example"), null);
  assert.equal(resolveRedirectTarget("?c=ABCDEF2%23evil"), null);
});

test("静态页保留 App 按钮并尝试自动唤起", async () => {
  const html = await readFile(new URL("../f/index.html", import.meta.url), "utf8");
  assert.match(html, /<script src="redirect\.js\?v=20261116"><\/script>/);
  assert.match(html, /id="open-app"/);
  assert.match(html, /id="download-app"/);
  assert.match(html, /window\.location\.href = target/);
  assert.doesNotMatch(html, /tencentscf\.com/);
  assert.match(html, /返回月光茧官网/);
});
