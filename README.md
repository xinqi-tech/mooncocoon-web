# 月光茧官网 (mooncocoon-web)

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
