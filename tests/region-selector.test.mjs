import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("销售区域映射到 jp、us、sg 页面", async () => {
  const script = await read("region.js");
  assert.match(script, /id: "jp"[\s\S]*home: "jp\/index\.html"/);
  assert.match(script, /id: "us"[\s\S]*home: "us\/index\.html"/);
  assert.match(script, /id: "sg"[\s\S]*home: "sg\/index\.html"/);
  assert.match(script, /product: "us\/product\/index\.html"/);
  assert.match(script, /product: "sg\/product\/index\.html"/);
  assert.match(script, /new URL\(region\[page\], source\)/);
  assert.match(script, /rootPath = new URL\("\.\/", source\)/);
});

test("英语区域页面的资源路径可从项目子路径解析", async () => {
  for (const file of ["us/index.html", "sg/index.html"]) {
    const html = await read(file);
    assert.doesNotMatch(html, /(?:src|href|poster|data-src-[^=]+)="\/(?:images|videos|audio|jp\/assets)/);
    assert.match(html, /\.\.\/images\//);
    assert.match(html, /\.\.\/videos\//);
  }
  for (const file of ["us/product/index.html", "sg/product/index.html"]) {
    const html = await read(file);
    assert.doesNotMatch(html, /(?:src|href)=\"\/(?:jp\/styles|jp\/site|region\.js|images|audio|jp\/assets)/);
    assert.match(html, /\.\.\/\.\.\/jp\/styles\.css/);
    assert.match(html, /\.\.\/\.\.\/region\.js/);
  }
});

test("区域选择器出现在中文首页、日文首页和商品页", async () => {
  for (const file of ["index.html", "jp/index.html", "jp/product/index.html", "us/index.html", "sg/index.html", "us/product/index.html", "sg/product/index.html"]) {
    const html = await read(file);
    assert.match(html, /data-region-switcher/);
    assert.match(html, /data-region-button/);
    assert.match(html, /data-region-menu/);
  }
});

test("备案号只保留在根目录中文首页，英语页面没有日文字符", async () => {
  const domestic = await read("index.html");
  assert.equal((domestic.match(/京ICP备2025150534号-1/g) || []).length, 1);
  for (const file of ["jp/index.html", "us/index.html", "sg/index.html", "us/product/index.html", "sg/product/index.html"]) {
    const html = await read(file);
    assert.doesNotMatch(html, /京ICP备2025150534号-1/);
  }
  for (const file of ["us/index.html", "sg/index.html", "us/product/index.html", "sg/product/index.html"]) {
    const html = await read(file);
    assert.doesNotMatch(html, /[ぁ-んァ-ン一-龯]/);
  }
});
