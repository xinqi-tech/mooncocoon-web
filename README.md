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
