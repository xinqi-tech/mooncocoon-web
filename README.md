# 月光茧官网 (mooncocoon-web)

## 预约回归

- 基础检查：`node --test tests/reservation.test.mjs`。
- Cookie 兼容回归：在已安装 `playwright` 及其 WebKit runtime 的环境运行 `node --test tests/reservation-cookie.browser.cjs`。使用真实 HTML/交互和 iPhone 视口，全部网络请求由合成响应拦截，不发送短信或访问生产数据；覆盖无 Cookie 成功、验证码错误、失败重试、响应丢失、重复提交和弹窗关闭竞态。
- 官网使用 `/api/reservation-gift/reserve-with-code` 同请求校验短信并保存预约，后端必须先于官网发布。该接口返回公开预约回执，不签发或暴露会话 Token。领奖登录继续使用既有 Cookie 流程，本次不改变其部署域名要求。

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


## 本地预约预览

运行 `python preview_server.py`，打开 http://127.0.0.1:8769/。预约面板直接展示，PV 位于预约首屏之后；开放状态以后台活动配置为准。预览服务器只代理真实活动状态 GET 请求，避免 localhost 被线上 CORS 拒绝；不转发短信、登录或预约写请求。生产仍直连原 API。普通静态服务器无法提供这个本地代理。

### 真实测试环境预览

运行 `python preview_server.py --test` 后打开 http://127.0.0.1:8769/，预约面板直接显示。此模式仅连接固定测试 API；短信实际发送，预约写入测试库。未配置上线提醒模板时隐藏订阅选项。

代理只允许预约所需的指定接口，写请求须来自本机同源页面；不代理 App 发奖和管理接口。为支持本机 HTTP，测试会话 Cookie 的本地副本移除 Secure/Domain 并设为 SameSite=Lax，保留 HttpOnly；上游配置不变。默认启动方式仍只读生产活动状态。
