/**
 * @fileoverview 捏脸分享二维码短入口的参数校验与固定目标 URL 构造。
 *
 * AI Context
 * -----------
 * 关联文件:
 * - 上游: f/index.html — 读取二维码短链接参数并调用本文件
 * - 下游: Android 捏脸导入深链 — 从浏览器唤起 App
 * - 测试: tests/face-share-redirect.test.mjs — 校验短码契约与开放重定向防护
 *
 * 核心概念:
 * - share code — 6–14 位字母数字短码；后端当前生成 8 位，区间用于兼容既有客户端契约
 * - fixed target — 固定的捏脸导入协议，只将校验过的分享码拼入路径
 */
(function exposeFaceShareRedirect(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.FaceShareRedirect = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createFaceShareRedirect() {
  "use strict";

  const TARGET_PREFIX = "lunakoru://customization/";
  const SHARE_CODE_PATTERN = /^[A-Za-z0-9]{6,14}$/;

  function buildRedirectTarget(code) {
    if (typeof code !== "string" || !SHARE_CODE_PATTERN.test(code)) {
      return null;
    }
    return TARGET_PREFIX + encodeURIComponent(code);
  }

  function resolveRedirectTarget(search) {
    const params = new URLSearchParams(typeof search === "string" ? search : "");
    const codes = params.getAll("c");
    if (codes.length !== 1) {
      return null;
    }
    return buildRedirectTarget(codes[0]);
  }

  return Object.freeze({
    buildRedirectTarget,
    resolveRedirectTarget,
  });
});
