---
title: 官网兑换页第二轮修复记录
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

# 官网兑换页第二轮修复

[PR #41](https://github.com/xinqi-tech/mooncocoon-web/pull/41) 的 base 为 `main`，继续使用任务分支 `codex/redeem-web`。本轮不改中文根首页（含公共导航）、预约脚本/样式、iOS 或预约接线，不部署、不执行真实兑换，也不把历史真实 TEST 记录视为本轮重验。

## 最终行为

| 项目 | 行为 |
| --- | --- |
| 手机号 | 去空格/括号/连字符后，两栏各自去掉匹配所选国家码的 `+` 前缀；不同国家码的前缀拒绝。日本国内格式去掉一个前导 `0`。规范化后匹配并本地打码确认，接口仅提交国家码加本地号码。 |
| 四默认码格式 | +86：`1[3-9]` 加 9 位；+81：70/80/90 加 8 位；+65：8/9 加 7 位；+1：NXX-NXX-XXXX，其中两个 N 均为 2–9。其他手填国家码保留原 E.164 长度检查。格式校验不证明号码存在、归属或支持收信。 |
| 国家码默认 | `region` → 地区域名 → 浏览器首选 locale；仅四默认码。zh/ja/en 首选中受支持的地区子标签决定国家码，未命中则按语言回退 +86/+81/+1，`en-GB`/`en-AU` 因而为 +1。ko、zh-TW、其他首选语言回退 +86，不扫描次选。 |
| 显示语言默认 | `lang` → 地区站点 → 浏览器列表第一个受支持语言 → zh；不会重选国家码。 |
| 码规范化 | 输入、校验及 fragment 预填复用 NFKC → 去空格/连字符 → 大写；fragment 随即清除，首个文档 GET 不含码。 |
| 术语/读屏/缓存 | 英文结果使用 Bag；错误区只留 `role=alert` 的隐式 live 行为。三项运行资源共享 `?v=20261113-review2`，后续变更应同步刷新。 |

日本 070/080/090 的现有使用由 [IIJ 官方说明](https://www.iijmio.jp/info/iij/1764547486.html) 确认。060 虽已列入扩展计划，但五家运营商 [2026-07-08 官方联合公告](https://www.softbank.jp/corp/news/press/sbkk/2026/20260708_01/) 明确延期、开始时点另行通知；本轮不把计划日期当成已开通证明，不新增 060 支持。后续启用新号段需重新核验。新加坡手机 8/9 和八位格式依据 [IMDA 编号计划](https://www.imda.gov.sg/-/media/imda/files/regulation-licensing-and-consultations/frameworks-and-policies/numbering/national-numbering-plan-and-allocation-process/imda-national-numbering-plan.pdf)；北美格式依据 [NANPA](https://nanpa.com/about)。

## 验证

- RED：新增 Node 5 项按预期失败（其余 10 项通过）；Chromium/WebKit 新增国际号码与次选语言共 4 项按预期失败。失败断言只输出布尔值与固定说明，没有输入、浏览器调用详情或快照。
- GREEN：`node --test tests/*.test.cjs tests/*.test.mjs`：102 项通过。
- GREEN：`node --test tests/redeem.browser.cjs`：19 项通过（Chromium 9、WebKit 9、跨两引擎地区导航矩阵 1）。覆盖四态统一、重复锁、超时/离页/BFCache、五语、窄屏、两次国际号码和前缀、兼容字符、语言回退。所有请求由合成响应截获。
- 五语 key/非空值/占位符/错误词条平价在本站 Node 测试中通过。Workspace 通用 i18n gate 不解析本站字典；以本站路径调用后返回缺子仓/未测量（exit 1），该结果不记为通过。LLM eval impact 用实际本站路径测量为 `NOT_APPLICABLE`。
- 沙箱内预览服务测试初次因 loopback 监听 EPERM 失败 3 项；切换已授权执行环境后整套 102 项通过，不修改实现规避检查。
- 非敏感原始日志保存在本机 `/private/tmp/redeem-review2/web/`；截图仅空输入态。没有真实码、真实手机号、短信、数据库或生产 API 调用。上述为实现者回归结果，不是独立复核结论。
