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
- 定向检查：`node --test tests/recharge.test.mjs tests/recharge-review.test.mjs`。发布只包含网页资源，不上传 `tests/`、预览服务器、文档、压缩源素材或本地凭据。

### 本地验证

充值页位于 `recharge/`，生产 HTML 不引用测试夹具。页面来源先绑定预期环境，再要求服务端 `/api/web-recharge/config` 返回相同的 `environment`；服务器响应、查询参数和浏览器存储都不能切换环境。安全态和内存接口状态可通过仅监听 loopback 的预览服务检查：

```bash
node tests/recharge-preview-server.mjs --port 8908
```

- `http://127.0.0.1:8908/recharge/`：原始页面，不注入夹具；固定连接本机 9000 端口并要求 `sandbox` 配置，没有可信配置服务时会锁定登录、短信和支付。
- `http://127.0.0.1:8908/fixture/`：内存登录、钱包与档位接口，不发送真实短信或网络请求。
- `http://127.0.0.1:8908/fixture/pending/`：内存待确认订单，依次进入待付款、已付款、已到账。
- `http://127.0.0.1:8908/fixture/mobile/`：用 390×844 iframe 固定手机视口，便于不支持调整 viewport 的浏览器验收。

页面仅在 `http://127.0.0.1`、`http://localhost` 或 `http://[::1]` 下选择本机 `127.0.0.1:9000`；`https://www.lunakoru.com` 固定连接官网既有正式 SCF API，并要求服务端返回 `environment=production`。正式 API 地址复用 `reservation.js` 与 `preview_server.py` 已维护的生产入口，不从服务器响应推导。其他公网来源默认无 API 基址并 fail-closed，避免 GitHub Pages、镜像站或恶意域名接入正式接口。

支付宝支付地址按环境精确限制为对应的 HTTPS `gateway.do`，拒绝沙箱/正式串用、非标准端口、userinfo、fragment、重复或错误的 `method`；订单查询也必须返回当前环境的准确 channel。会话和待确认记录以环境及 API host 隔离，待确认记录再按 UID 隔离。

正式手机网站支付审核等待期间，后端保持 `available=false`：页面不展示本地虚构档位，也不允许首次访问者发短信或登录。浏览器中的 pending 只用于提供 requestId 和恢复线索，不能自行解锁入口：正常登录由服务端签发绑定 UID、环境和通道的 `resumeExchangeCredential`；建单响应丢失时，前端用它与 requestId 调用 `POST /api/web-recharge/resume`，服务端按真实非终态订单换发固定期限的 `resumeCredential`。该凭证还绑定订单号，并且 `/config`、短信和登录三个请求都必须携带 `X-Web-Recharge-Resume`；只有服务端再次验证后返回 `loginAvailable=true` 才开放恢复认证。伪造、过期、终态、跨 UID、跨环境及网络未知结果全部 fail-closed，不允许浏览器存储、URL 或配置响应选择环境、UID 或支付通道。

审核通过、生产配置注入与真实小额验收前不得将 `available` 打开。服务端 CORS 白名单需允许官网 Origin 使用 `X-Web-Recharge-Resume`，但不得放宽 Origin；未来测试站发布必须由受控构建同时固定 `recharge/recharge.js` 的 `DEPLOYED_TEST_API_BASE` 与 `DEPLOYED_TEST_SITE_HOST`，并保留 `environment=sandbox` 二次校验；不得改为 query、localStorage 或任意运行时输入。

当前充值页是中国大陆站，所有接口固定携带 `X-App-Market: CN`，并显式使用 `credentials: 'omit'`，防止浏览器残留 Cookie 参与鉴权。服务端跨域白名单需精确包含实际测试站域名；本地预览仅用于内存夹具验收，不会请求云端接口。
## 本地预约预览

运行 `python preview_server.py`，打开 http://127.0.0.1:8769/。预约面板直接展示，PV 位于预约首屏之后；开放状态以后台活动配置为准。预览服务器只代理真实活动状态 GET 请求，避免 localhost 被线上 CORS 拒绝；不转发短信、登录或预约写请求。生产仍直连原 API。普通静态服务器无法提供这个本地代理。

### 真实测试环境预览

运行 `python preview_server.py --test` 后打开 http://127.0.0.1:8769/，预约面板直接显示。此模式仅连接固定测试 API；短信实际发送，预约写入测试库。未配置上线提醒模板时隐藏订阅选项。

代理只允许预约所需的指定接口，写请求须来自本机同源页面；不代理 App 发奖和管理接口。为支持本机 HTTP，测试会话 Cookie 的本地副本移除 Secure/Domain 并设为 SameSite=Lax，保留 HttpOnly；上游配置不变。默认启动方式仍只读生产活动状态。
