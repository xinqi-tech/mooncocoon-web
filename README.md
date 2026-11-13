# 月光茧官网 (mooncocoon-web)

## 预约回归

- 基础检查：`node --test tests/reservation.test.mjs`。
- Cookie 兼容回归：在已安装 `playwright` 及其 WebKit runtime 的环境运行 `node --test tests/reservation-cookie.browser.cjs`。使用真实 HTML/交互和 iPhone 视口，全部网络请求由合成响应拦截，不发送短信或访问生产数据；覆盖无 Cookie 成功、验证码错误、失败重试、响应丢失/持续无响应超时恢复、重复提交和弹窗关闭竞态。
- 官网使用 `/api/reservation-gift/reserve-with-code` 同请求校验短信并保存预约，后端必须先于官网发布。该接口返回公开预约回执，不签发或暴露会话 Token。领奖登录继续使用既有 Cookie 流程，本次不改变其部署域名要求。
- 同 Wi-Fi 手机测试：`python3 preview_server.py --test --host <电脑局域网IPv4> --port 8879`，在手机打开打印的地址。显式绑定 RFC1918 私网地址，仅允许匹配 Host/Origin；页面强制走固定测试 API 代理并显示测试提示，静态入口不提供源码配置/隐藏文件。默认仍只监听 127.0.0.1，未加 `--test` 时只能只读活动查询。路由回归：`python3 -m unittest discover -s tests -p 'test_preview_server.py'`。

## 相关链接

- **飞书设计方案文档**：https://feishu.cn/docx/AgdjdWXJloI1LJxRoZrc8SU7nwe
- **Figma 线框原型**：https://www.figma.com/design/iO27mrD2V65fuP6S2DGiLH
- **GitHub Pages 在线预览**：https://xinqi-tech.github.io/mooncocoon-web/
- **飞书设计方案文档**：https://feishu.cn/docx/AgdjdWXJloI1LJxRoZrc8SU7nwe
- **Figma 线框原型**：https://www.figma.com/design/iO27mrD2V65fuP6S2DGiLH
- **飞书原始需求文档**：https://pcni5ldjg9t4.feishu.cn/wiki/NXIZwPrCCihYQKkcYeecfPaTnig

## 目录结构

```
├── index.html          # 主页面
├── images/             # 图片素材
└── videos/             # 视频素材（按模块分类）
    ├── 01_persona_setup/
    ├── 02_appearance_customization/
    ├── 03_intimate_interaction/
    ├── 04_boyfriend_daily/
    ├── 05_dream_theater/
    └── 06_skill_system/
```

## 独立充值页本地预览

### 支付开通审核材料

- 公开审核路径：`https://www.lunakoru.com/recharge/review/`。仅在正式发布并回读验证后作为可访问链接交付。
- 审核页沿用充值页样式，纯静态、无 JavaScript、无表单，不登录、不收集手机号、不访问 API，不展示虚假付款或到账成功。CSP 禁止脚本、接口请求和表单提交。
- 示例档位来自本地演示数据，全部明确标注不可购买；不代表实际价格、优惠或已获支付许可。交易入口 `/recharge/` 继续 fail-closed，并链接审核页。
- 定向检查：`node --test tests/recharge.test.mjs tests/recharge-review.test.mjs`。官网 staging 由后端维护的 `tools/deploy_lunakoru_tcb.py` 的 `prepare_staging()` 生成；当前按名称排除 `tests/`、`preview_server.py`、`README.md`、`CHANGELOG.md`、`designe-html.md`、`.env` 和 Git/编辑器缓存目录。该过滤不按文档或压缩包后缀排除文件，合法下载资源会保留；发布前以该脚本实际过滤项和 staging 清单为准。

### 本地验证

充值页位于 `recharge/`，生产 HTML 不引用测试夹具。安全态和内存接口状态可通过仅监听 loopback 的预览服务检查：

```bash
node tests/recharge-preview-server.mjs --port 8908
```

- `http://127.0.0.1:8908/recharge/`：原始页面，不注入夹具；本机 9000 端口没有可信配置服务时会锁定登录、短信和支付。
- `http://127.0.0.1:8908/fixture/`：内存登录、钱包与档位接口，不发送真实短信或网络请求。
- `http://127.0.0.1:8908/fixture/pending/`：内存待确认订单，依次进入待付款、已付款、已到账。
- `http://127.0.0.1:8908/fixture/mobile/`：用 390×844 iframe 固定手机视口，便于不支持调整 viewport 的浏览器验收。

页面仅在 `http://127.0.0.1`、`http://localhost` 或 `http://[::1]` 下选择本机 `127.0.0.1:9000`。非 loopback 页面默认无 API 基址并 fail-closed，避免官网访问者误连自己电脑。未来测试站发布必须由受控构建将 `recharge/recharge.js` 的 `DEPLOYED_TEST_API_BASE` 替换为固定 HTTPS 测试 API，并保留服务端 `environment=sandbox` 二次校验：`loginAvailable` 只开放登录与历史订单恢复，`available` 才允许新建充值；不得改为 query、localStorage 或任意运行时输入。

当前充值页是中国大陆站，所有接口固定携带 `X-App-Market: CN`，并显式使用 `credentials: 'omit'`，防止浏览器残留 Cookie 参与鉴权。服务端跨域白名单需精确包含实际测试站域名；本地预览仅用于内存夹具验收，不会请求云端接口。
## 本地预约预览

运行 `python preview_server.py`，打开 http://127.0.0.1:8769/。预约面板直接展示，PV 位于预约首屏之后；开放状态以后台活动配置为准。预览服务器只代理真实活动状态 GET 请求，避免 localhost 被线上 CORS 拒绝；不转发短信、登录或预约写请求。生产仍直连原 API。普通静态服务器无法提供这个本地代理。

### 真实测试环境预览

运行 `python preview_server.py --test` 后打开 http://127.0.0.1:8769/，预约面板直接显示。此模式仅连接固定测试 API；短信实际发送，预约写入测试库。未配置上线提醒模板时隐藏订阅选项。

代理只允许预约所需的指定接口，写请求须来自本机同源页面；不代理 App 发奖和管理接口。为支持本机 HTTP，测试会话 Cookie 的本地副本移除 Secure/Domain 并设为 SameSite=Lax，保留 HttpOnly；上游配置不变。默认启动方式仍只读生产活动状态。

## 独立兑换页（未部署）

- `/redeem/` 可直达，仅支持 fragment 参数 `#code=` 预填并规范化，读取后从地址栏移除码；片段不会进入首个文档 GET。`region/lang` 可继续放非敏感 query，例如 `/redeem/?region=jp&lang=ja#code=<code>`。query 中的 `code` 不再作为预填来源，不能靠脚本清理撤销已发送的初始 URL。日本、新加坡、美国站导航带受限的 `region` 值，设定默认国家码和语言。显式 `region` 优先于地区域名和浏览器；没有显式地区时，仅使用浏览器首选 locale，已识别的 CN/JP/SG/US 地区子标签对应 +86/+81/+65/+1，仅语言 zh/ja/en 分别对应 +86/+81/+1。ko、zh-TW 和不支持的首选语言回退 +86，不扫描次选语言推断国家码。`lang` 与页面五语选择器仅改变显示语言，不覆盖上述国家码默认值；用户仍可手动修改国家码。中文首页入口随预约有礼接线后续开发。
- 页面不登录、不发送短信、不查询账号资料、不保存手机号。两次手机号均在本地去除空格、括号和连字符后校验并要求相同；+86 号码必须为 1 开头、第二位 3–9 的 11 位数字，无效或不一致不打开确认且不发送兑换请求。提交前由用户输入本地生成打码确认。所有账号结果统一为“已提交”，奖励内容由 `data.rewardItems` 提供。
- `POST /api/redeem-code/web-redeem` 请求 `{countryCode,phoneNumber,code}`；生产只使用固定 `https://api.lunakoru.com`，不支持通过 query 或存储覆盖。不会自动重试兑换写入。离页会取消请求并使当前请求代际失效；BFCache 恢复新建代际，旧成功/失败/超时/埋点/清理回调都不能覆盖或解锁新提交。
- 定向验证：`node --test tests/redeem.test.cjs tests/redeem-lifecycle.test.cjs tests/redeem-preview.test.mjs`；真实浏览器合成回归需 Playwright 与对应 Chromium/WebKit runtime：`node --test tests/redeem.browser.cjs`。五语词典平价由定向测试覆盖；工作区通用 parity gate 不解析本站字典。
- 只读静态/本地合成预览：`node tests/redeem-preview-server.mjs`，访问打印的 loopback 地址。合成成功响应与账号状态归并只是 mock 验证，不代表真实测试库发奖验收。
- 经授权的真实测试环境联调：`node tests/redeem-preview-server.mjs --test`；仅将兑换与匿名埋点 POST 转发至现有官网预览工具同一固定测试后端，页面显示测试横幅。服务只绑定 loopback、校验 Host/Origin、限制请求大小、不记录请求体/URL查询/上游错误内容，不提供任意代理。当前维护的官网 staging 按名称排除 `tests/` 与 `preview_server.py`，保留 `/redeem/` 运行资源；此过滤修复随 [后端 PR #2887](https://github.com/xinqi-tech/Aildo-JAVA/pull/2887) 交付，发布须使用包含该修复的维护脚本。没有按 `.zip` 等后缀一概排除下载资源。后端必须先于官网上线。


### 2026-11-12 实际 TEST 联调记录

官网行为源码为 `8644793c1039f2ec676c8a29c8840044edcb929c`；本节为后续文档记录，官网静态资源没有部署到生产或测试站。真实 Chromium 页面通过 loopback 固定 TEST 代理验收，最终两阶段实际后端 source 为 `315f48930119c1274d7e40678843e44408ae83e5`；只接受经逐项验证的源码家族，未验证的新 SHA 会停止执行。

| PRD §16 验收项 | 真实 TEST 结果 |
|---|---|
| 第7项：码状态 | PAUSED、NOT_STARTED、EXPIRED 各独立一次真实请求，均 HTTP 200，数字错误码分别 260003/260004/260005，后端与网页中文提示逐字一致，表单保持可用、未进入已提交结果页。 |
| 第12项：官网四态 | 成功、未注册、已兑、不符合条件四次完整 HTTP 状态/响应体与结果文本完全相同；六行奖励包包含称号。成功新增一条兑换记录、五条非称号 ledger 且资产增量符合奖励包；其余三态的七张兑换表、目标码/批次/日额度、记录、ledger 与指定账号资产聚合前后全部不变。两次手机号不同不发请求；确认仅本地打码，不显示昵称、头像或 UID。 |
| 第13项：官网部分 | Android 已完成首码成功后，官网实际提交同批余四码，四次均为已提交；选定表、计数、记录、ledger 与资产聚合全部保持不变，没有额外发奖或记录。Android 余码的 App 表现由其报告单独验收。 |
| 第15项：参数预填 | 真页面采用 fragment `#code=` 预填，实际首个文档 GET 不含码；非敏感地区/语言参数保留。 |

四态四次与余码四次共八次业务请求，没有重放。最后业务请求为 `2026-11-12T19:02:12.784Z`。原先遇到共享 TEST 前滚至未验证 SHA 的预检在零业务请求处停止，保留失败证据，完成源码/配置与存量码兼容验证后以新 attempt 继续，没有放开来源校验。

本次真实网页验收将 analytics 在本地拦截，并阻断所有外部资源请求：不代表埋点实际落库或奖励图标 CDN 加载已验收。网页结果与后端资产聚合已核；App 背包页面展示由 Android 独立确认。没有短信、注册动作、填表截图、HAR、trace 或生产请求；只保留不含输入的 HTTP/结果文本和只读聚合证据，截图仅为空输入态。

操作员接受多次提交可通过 USED/SOLD_OUT 推断状态的限制，保留消费规则（PRD §14/17）；本页仅承诺单次账号相关结果统一。此前五语、窄屏、超时/重复锁和生命周期回归证据继续有效，本次只补真实 TEST 验收与文档，没有重复未变套件。


### 2026-11-12 Review 修复验证

- 三个地区商品页刷新共享样式缓存版本；日本首页及商品导航文字保持单行。实际 Chromium/WebKit 覆盖三个地区首页/商品页的 320/390/768/1280px 视口、控制项边界与兑换链接点击。
- +86 本地号码前缀/长度、格式规范化、两次输入与浏览器 locale/显式地区优先级均有定向测试；所有浏览器请求使用本地合成响应，无真实短信、兑换或生产访问。
- 官网部署排除契约以维护脚本的名称过滤及其合成 staging 回归为准，不把文档陈述当成已执行发布；本站仍未部署。
