---
title: 官网兑换页修复记录
type: 技术文档
status: 评审中
created: 2026-11-13
updated: 2026-11-13
author: Codex
tags: [兑换码, 官网, i18n, 校验]
---

<!-- AI 阅读指南
本文记录 mooncocoon-web PR #41 第二轮修复、测试和边界。
上游：Workspace docs/impl/affection-economy/PRD-兑换码.md；不改需求原文。
下游：redeem/redeem.js、redeem/i18n.js、redeem/index.html 及 tests/redeem*。
国家码默认只读浏览器首选 locale；显示语言回退可扫描次选；两者独立。
-->

# 官网兑换页修复

[PR #41](https://github.com/xinqi-tech/mooncocoon-web/pull/41) 的 base 为 `main`，继续使用任务分支 `codex/redeem-web`。本轮不改中文根首页（含公共导航）、预约脚本/样式、iOS 或预约接线，不部署、不执行真实兑换，也不把历史真实 TEST 记录视为本轮重验。

## 最终行为

| 项目 | 行为 |
| --- | --- |
| 手机号 | 去空格/括号/连字符后，两栏各自去掉匹配所选国家码的 `+` 前缀；不同国家码的前缀拒绝。日本国内格式去掉一个前导 `0`。规范化后匹配并本地打码确认，接口仅提交国家码加本地号码。 |
| 号码有效性 | 与后端 `PhoneNumbers.normalize` 同用 Google 9.0.39，要求有效号码且类型为 `MOBILE` / `FIXED_LINE_OR_MOBILE`；+86 另保留 `1[3-9]` 开头的 11 位约束。所有手填国家码均使用同一库，不再使用四组宽正则或仅长度校验。格式/类型校验不证明号码存在、归属或收信能力。 |
| 国家码默认 | `region` → 地区域名 → 浏览器首选 locale；仅四默认码。zh/ja/en 首选中受支持的地区子标签决定国家码，未命中则按语言回退 +86/+81/+1，`en-GB`/`en-AU` 因而为 +1。ko、zh-TW、其他首选语言回退 +86，不扫描次选。 |
| 显示语言默认 | `lang` → 地区站点 → 浏览器列表第一个受支持语言 → zh；不会重选国家码。 |
| 码规范化 | 输入、校验及 fragment 预填复用 NFKC → 去空格/连字符 → 大写；fragment 随即清除，首个文档 GET 不含码。 |
| 术语/读屏/缓存 | 英文结果使用 Bag；错误区只留 `role=alert` 的隐式 live 行为。四项运行资源（含离线校验库）共享 `?v=20261113-phone3`，后续变更应同步刷新。 |

前轮用外部号段公告制定前端正则的做法已由本轮后端契约对齐替代。当前唯一依据是实际后端锁定的 Google 9.0.39：其元数据接受日本 60 号段，官网随之接受，不再以此前公告推测覆盖后端规则。

## 验证

- RED：新增 Node 5 项按预期失败（其余 10 项通过）；Chromium/WebKit 新增国际号码与次选语言共 4 项按预期失败。失败断言只输出布尔值与固定说明，没有输入、浏览器调用详情或快照。
- GREEN：`node --test tests/*.test.cjs tests/*.test.mjs`：102 项通过。
- GREEN：`node --test tests/redeem.browser.cjs`：19 项通过（Chromium 9、WebKit 9、跨两引擎地区导航矩阵 1）。覆盖四态统一、重复锁、超时/离页/BFCache、五语、窄屏、两次国际号码和前缀、兼容字符、语言回退。所有请求由合成响应截获。
- 五语 key/非空值/占位符/错误词条平价在本站 Node 测试中通过。Workspace 通用 i18n gate 不解析本站字典；以本站路径调用后返回缺子仓/未测量（exit 1），该结果不记为通过。LLM eval impact 用实际本站路径测量为 `NOT_APPLICABLE`。
- 沙箱内预览服务测试初次因 loopback 监听 EPERM 失败 3 项；切换已授权执行环境后整套 102 项通过，不修改实现规避检查。
- 非敏感原始日志保存在本机 `/private/tmp/redeem-review2/web/`；截图仅空输入态。没有真实码、真实手机号、短信、数据库或生产 API 调用。上述为实现者回归结果，不是独立复核结论。


## 2026-11-13 手机号与后端规范对齐

### 原因与最终行为

后端 `RedeemController.web` 调用 `modules/auth/util/PhoneNumbers.normalize`，`user-api/pom.xml` 锁定 `com.googlecode.libphonenumber:libphonenumber:9.0.39`。前轮手写正则会误放大陆未分配子号段、未分配 NANP 区号和新加坡部分号码，并拒绝后端接受的日本 60、无 `+` 的中日国际写法及其他国家的国内格式。此轮直接使用同版本源代码和元数据。

- `redeem/redeem.js` 按后端顺序校验国家码、输入字符、86/81 无 `+` 国际写法、所选国家码一致性、`isValidNumber`、`MOBILE` / `FIXED_LINE_OR_MOBILE` 类型和大陆存量号码约束。两栏分别规范化，再本地比较、打码确认，发送的国家码与本地号码仍由后端再次规范化。
- `redeem/phone-libphonenumber-9.0.39.js` 为约 260KB 的同源离线运行资源；`redeem/phone-libphonenumber-LICENSE.txt` 保留 Apache 2.0 许可与来源。没有 CDN、额外校验接口、整仓源码或 node_modules 随发布。
- `redeem/index.html`、运行资源、预览 allowlist 和浏览器 fixture 同步接入离线库，四项缓存标记均为 `20261113-phone3`。缺库时本地校验拒绝，不提交号码。
- 国家码默认、语言回退、NFKC 码规范化、四态统一、生命周期和隐私规则不变。本地格式/类型校验只判断规则，不验证归属、是否开通或短信可达。

### 可复现来源与构建

| 输入 | 精确版本 / SHA-256 |
| --- | --- |
| [Google 官方源代码](https://github.com/google/libphonenumber/tree/v9.0.39/javascript/i18n/phonenumbers) | `v9.0.39`；源码 tar `e30c2aea5b66f53821d1eb971f81b9be1350e4b04a4577c8283803a1c8c5210b` |
| [Closure Library](https://github.com/google/closure-library/tree/v20201006) | npm `google-closure-library@20201006.0.0`；tar `7f1057b8d7eaa2e1b2b27f6b6baeb6be04dae34489b5ab082581f5364616bf49` |
| [Closure Compiler](https://github.com/google/closure-compiler/releases/tag/v20210302) | Maven `closure-compiler:v20210302`；jar `065845e6827d245e6367aa5074f21e63a86eca433098f741ee6d1fa7a2c8354d` |

仅编译官方 `metadata.js`（完整全球号码类型元数据）、`phonemetadata.pb.js`、`phonenumber.pb.js`、`phonenumberutil.js` 及所需 Closure 依赖；不编译短号码、AsYouType 或 demo。Closure 两版本为该 tag 的官方 JavaScript README 明确支持版本。没有使用 npm `google-libphonenumber` 的编译包或其元数据。

入口 `entry.js` 如下（仅导出调用所需 API；供下次同步同版本重建）：

```javascript
goog.provide('LunaKoruPhoneLib');
goog.require('i18n.phonenumbers.PhoneNumberUtil');
goog.exportSymbol('LunaKoruPhoneLib', {
 'PhoneNumberUtil': i18n.phonenumbers.PhoneNumberUtil,
 'MOBILE': i18n.phonenumbers.PhoneNumberType.MOBILE,
 'FIXED_LINE_OR_MOBILE': i18n.phonenumbers.PhoneNumberType.FIXED_LINE_OR_MOBILE,
 'E164': i18n.phonenumbers.PhoneNumberFormat.E164
});
goog.exportProperty(i18n.phonenumbers.PhoneNumberUtil, 'getInstance', i18n.phonenumbers.PhoneNumberUtil.getInstance);
var p=i18n.phonenumbers.PhoneNumberUtil.prototype;
goog.exportProperty(p,'parse',p.parse);
goog.exportProperty(p,'getRegionCodeForCountryCode',p.getRegionCodeForCountryCode);
goog.exportProperty(p,'isValidNumber',p.isValidNumber);
goog.exportProperty(p,'getNumberType',p.getNumberType);
goog.exportProperty(p,'format',p.format);
goog.exportProperty(i18n.phonenumbers.PhoneNumber.prototype,'getCountryCode',i18n.phonenumbers.PhoneNumber.prototype.getCountryCode);
```

在解压后的固定目录运行（JDK 11）：

```bash
java -jar closure-compiler-v20210302.jar \
  --compilation_level ADVANCED --dependency_mode PRUNE \
  --entry_point goog:LunaKoruPhoneLib \
  --js 'closure-library/closure/goog/**.js' \
  --js 'closure-library/third_party/closure/goog/**.js' \
  --js libphonenumber-9.0.39/javascript/i18n/phonenumbers/phonemetadata.pb.js \
  --js libphonenumber-9.0.39/javascript/i18n/phonenumbers/phonenumber.pb.js \
  --js libphonenumber-9.0.39/javascript/i18n/phonenumbers/metadata.js \
  --js libphonenumber-9.0.39/javascript/i18n/phonenumbers/phonenumberutil.js \
  --js entry.js --language_out ECMASCRIPT_2017 \
  --output_wrapper '(function(){%output%}).call(typeof globalThis!=="undefined"?globalThis:this);if(typeof module==="object"&&module.exports)module.exports=globalThis.LunaKoruPhoneLib;' \
  --js_output_file phone-libphonenumber-9.0.39.js
```

生成文件（尚未加仓库顶部来源注释）的 SHA-256：`4b5e92dded30c6da8d328f311addee538798573f2a2294c96d543a6524156ba7`。仓库运行文件（含来源注释）SHA-256：`93906f5822cccdde87ce633b7b8158d181a41ad354d248dcd6512a2952dabf2a`。检查实际后端升级版本后同步重建并重跑 oracle，不单独更新前端元数据。

### 本轮实际验证

- RED：新增 Node 契约测试和 Chromium/WebKit 各一项，均以 case ID `cn-unallocated-prefix` 的误放行按预期失败；预览静态 allowlist 在库不可访问时按预期失败。仅输出固定说明、布尔值或 case ID，不输出号码。
- 实际 backend oracle：JDK **11.0.30** 直接编译只读目标 checkout 的 `PhoneNumbers.java`，classpath 为本机 Maven **9.0.39** jar；Node 通过进程 stdin/stdout 在内存比较，不写号码文件。53 类独立合成向量 **53/53** 一致，覆盖四默认码及手填 +44、手机/共用类型、固话、免费电话、未分配号段、错误/重复国家前缀、无 `+` 的中日写法、国内干线和空值。
- 扩展 oracle 使用该 Java jar 的官方示例，仅将真实 `PhoneNumbers.normalize` 的结果作为预期：245 地区、mobile/fixed-line/toll-free 三类和 E.164/本地/国内格式，共 **2019/2019** 与前端一致；官方示例不用于真实 API。
- GREEN：`NODE_PATH=/private/tmp/redeem-reviewfix/browser-runtime/node_modules:/private/tmp/ptm-test-deps/node_modules node --test tests/*.test.cjs tests/*.test.mjs`：**103/103**。包含本站五语 key/占位符平价和预览资源实际 GET。
- GREEN：`NODE_PATH=/private/tmp/redeem-reviewfix/browser-runtime/node_modules:/private/tmp/ptm-test-deps/node_modules node --test tests/redeem.browser.cjs`：**21/21**（两引擎各 10 项及地区导航矩阵 1 项）。契约场景在 Chromium/WebKit 都覆盖 53 类输入，本地确认之前零 API。全套请求均由合成响应截获。
- 无固定用户文案改动；通用 i18n gate 不解析本站字典，不将其作为通过。本轮 LLM eval impact 对实际 worktree 测量为 `NOT_APPLICABLE`。
- 同步最新 `origin/main` 用普通 merge，保留双方全部 changelog；未重写远端历史。Workspace 发布 skill 的 node_modules 排除由根任务维护，本站运行资源不在该目录。没有修改 PRD、根首页/预约/iOS，没有部署、真实短信或真实兑换。

原始非敏感结果位于本机 `/private/tmp/redeem-review3/web/`；oracle 程序只输出 case ID/计数，库来源文件均为公开上游源码。
