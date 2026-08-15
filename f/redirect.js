/**
 * @fileoverview 捏脸分享二维码短入口的参数校验与固定目标 URL 构造。
 *
 * AI Context
 * -----------
 * 关联文件:
 * - 上游: f/index.html — 读取二维码短链接参数并调用本文件
 * - 下游: Aildo-JAVA live2d-share 静态页 — 唯一允许的跳转目标
 * - 测试: tests/face-share-redirect.test.mjs — 校验短码契约与开放重定向防护
 *
 * 核心概念:
 * - share code — 6–14 位字母数字短码；后端当前生成 8 位，区间用于兼容既有客户端契约
 * - fixed target — 写死的捏脸分享 H5 地址，不接受调用方传入 origin
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

  const TARGET_PREFIX =
    "https://1259219143-fp8pc6xpyz.ap-guangzhou.tencentscf.com/live2d-share/?code=";
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
